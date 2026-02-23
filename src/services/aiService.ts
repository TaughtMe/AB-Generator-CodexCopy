import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import type { Task, TaskType, WorksheetSource } from '../types/worksheet';
import { useSettingsStore, type AIProvider } from '../store/settingsStore';
import { PROVIDER_LABELS } from './ai/modelCatalog';
import type { ChatMessage, TaskRevisionResult } from '../types/ai';

/* ══════════════════════════════════════════════════
   aiService.ts – Zentrale KI-Fassade
   Einheitlicher Einstieg für Gemini, OpenAI, Local.
   ══════════════════════════════════════════════════ */

interface ProviderAdapter {
    generateTasksText: (options: GenerateTasksOptions) => Promise<string>;
    modifyTaskText: (task: Task, instruction: string) => Promise<string>;
    chatAssistantText: (messages: ChatMessage[], systemPrompt?: string) => Promise<string>;
    generateTasksFromCompiledPromptText: (compiledPrompt: string, systemPrompt?: string) => Promise<string>;
    reviseTasksText: (payload: string, systemPrompt?: string) => Promise<string>;
}

type StructuredResponseMode = 'text' | 'json_object' | 'json_array';

const AI_MAX_OUTPUT_TOKENS = 4096;
export const AI_JSON_TRUNCATED_USER_MESSAGE = 'Die KI hat die Antwort abgebrochen. Bitte versuche es erneut.';

export interface AIClassContext {
    className?: string;
    subjectName?: string;
    curriculumContext?: string;
    studentProfile?: string;
}

function getActiveProviderState() {
    const { aiProvider, providers } = useSettingsStore.getState();
    return {
        provider: aiProvider,
        config: providers[aiProvider],
    };
}

function getPreferredChatModel(provider: AIProvider): string {
    const { providers, chatModelPreferences } = useSettingsStore.getState();
    const configuredModel = providers[provider].model;
    const preferred = chatModelPreferences?.[provider];

    if (!preferred || preferred === 'auto') {
        return configuredModel;
    }

    return preferred;
}

export function getActiveProviderLabel(): string {
    const { provider } = getActiveProviderState();
    return PROVIDER_LABELS[provider];
}

export function isActiveProviderConfigured(): boolean {
    const { provider, config } = getActiveProviderState();
    const hasModel = Boolean(config.model?.trim());

    if (!hasModel) return false;
    if (provider === 'local') return Boolean(config.baseUrl?.trim());

    return Boolean(config.apiKey?.trim());
}

function getMissingConfigurationMessage(provider: AIProvider): string {
    if (provider === 'local') {
        return 'Lokaler KI-Server ist nicht vollständig konfiguriert. Bitte Base-URL und Modell in den Einstellungen prüfen.';
    }
    if (provider === 'openai') {
        return 'Kein OpenAI API-Key gesetzt. Bitte zuerst in den Einstellungen hinterlegen.';
    }
    return 'Kein Gemini API-Key gesetzt. Bitte zuerst in den Einstellungen hinterlegen.';
}

function requireProviderConfig(provider: AIProvider) {
    const { providers } = useSettingsStore.getState();
    const config = providers[provider];

    if (!config.model?.trim()) {
        throw new Error(`Kein Modell für ${PROVIDER_LABELS[provider]} gesetzt. Bitte in den Einstellungen wählen.`);
    }

    if (provider !== 'local' && !config.apiKey?.trim()) {
        throw new Error(getMissingConfigurationMessage(provider));
    }

    if (provider === 'local' && !config.baseUrl?.trim()) {
        throw new Error(getMissingConfigurationMessage(provider));
    }

    return config;
}

function getGeminiModel(modelOverride?: string): GenerativeModel {
    const config = requireProviderConfig('gemini');
    const genAI = new GoogleGenerativeAI(config.apiKey);
    return genAI.getGenerativeModel({ model: modelOverride ?? config.model });
}

function getCandidateBaseUrls(baseUrl: string, provider: 'openai' | 'local'): string[] {
    const normalized = baseUrl.replace(/\/$/, '');
    const candidates = [normalized];

    if (provider !== 'local') {
        return candidates;
    }

    try {
        const url = new URL(normalized);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            const dockerHostUrl = new URL(normalized);
            dockerHostUrl.hostname = 'host.docker.internal';
            candidates.push(dockerHostUrl.toString().replace(/\/$/, ''));
        }
    } catch {
        return candidates;
    }

    return Array.from(new Set(candidates));
}

function buildLocalJsonStrictSystemPrompt(systemPrompt: string, responseMode: StructuredResponseMode): string {
    if (responseMode === 'text') return systemPrompt;

    const shapeHint =
        responseMode === 'json_array'
            ? 'Die Antwort MUSS ein vollständiges JSON-Array sein.'
            : 'Die Antwort MUSS ein vollständiges JSON-Objekt sein.';

    return `${systemPrompt}

LOKALE JSON-STRICT-REGELN (verbindlich):
- ${shapeHint}
- Kein Fließtext, keine Erklärungen, keine Markdown-Codeblöcke.
- Antworte vollständig und beende das JSON mit allen schließenden Klammern.`;
}

function buildGeminiGenerationConfig(responseMode: StructuredResponseMode): {
    maxOutputTokens: number;
    responseMimeType?: 'application/json';
} {
    return {
        maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
        ...(responseMode !== 'text' ? { responseMimeType: 'application/json' as const } : {}),
    };
}

async function requestOpenAICompatible(params: {
    provider: 'openai' | 'local';
    userPrompt: string;
    systemPrompt: string;
    screenshotBase64?: string;
    modelOverride?: string;
    responseMode?: StructuredResponseMode;
    maxTokens?: number;
}): Promise<string> {
    const config = requireProviderConfig(params.provider);
    const baseUrl = (config.baseUrl || (params.provider === 'openai' ? 'https://api.openai.com/v1' : '')).replace(/\/$/, '');
    const responseMode = params.responseMode ?? 'text';

    const content: Array<Record<string, unknown>> = [{ type: 'text', text: params.userPrompt }];

    if (params.screenshotBase64) {
        content.push({
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${params.screenshotBase64}` },
        });
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (config.apiKey?.trim()) {
        headers.Authorization = `Bearer ${config.apiKey}`;
    }

    const candidateBaseUrls = getCandidateBaseUrls(baseUrl, params.provider);
    let response: Response | null = null;
    let payload: unknown = null;
    const effectiveSystemPrompt =
        params.provider === 'local'
            ? buildLocalJsonStrictSystemPrompt(params.systemPrompt, responseMode)
            : params.systemPrompt;

    for (const candidateBaseUrl of candidateBaseUrls) {
        try {
            const requestBody: Record<string, unknown> = {
                model: params.modelOverride ?? config.model,
                messages: [
                    { role: 'system', content: effectiveSystemPrompt },
                    { role: 'user', content },
                ],
                max_tokens: params.maxTokens ?? AI_MAX_OUTPUT_TOKENS,
            };

            // OpenAI json_object only supports top-level objects, not arrays.
            if (params.provider === 'openai' && responseMode === 'json_object') {
                requestBody.response_format = { type: 'json_object' };
            }

            const candidateResponse = await fetch(`${candidateBaseUrl}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody),
            });

            const candidatePayload = await candidateResponse.json().catch(() => null);

            if (!candidateResponse.ok) {
                response = candidateResponse;
                payload = candidatePayload;
                continue;
            }

            response = candidateResponse;
            payload = candidatePayload;
            break;
        } catch {
            continue;
        }
    }

    if (!response || !response.ok) {
        const detail = (payload as { error?: { message?: string } })?.error?.message;
        if (params.provider === 'local') {
            throw new Error(detail || 'Lokaler KI-Server nicht erreichbar. Tipp: im Dev-Container statt 127.0.0.1 ggf. host.docker.internal nutzen.');
        }
        throw new Error(detail || `${PROVIDER_LABELS[params.provider]} Anfrage fehlgeschlagen${response ? ` (HTTP ${response.status})` : ''}.`);
    }

    const message = (payload as {
        choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    })?.choices?.[0]?.message?.content;

    if (typeof message === 'string' && message.trim()) {
        return message;
    }

    if (Array.isArray(message)) {
        const text = message
            .filter((part) => part.type === 'text' && typeof part.text === 'string')
            .map((part) => part.text)
            .join('\n')
            .trim();

        if (text) return text;
    }

    throw new Error(`${PROVIDER_LABELS[params.provider]} hat keine lesbare Antwort geliefert.`);
}

const geminiAdapter: ProviderAdapter = {
    async generateTasksText(options) {
        const model = getGeminiModel();
        const userPrompt = buildGenerateUserPrompt(options);

        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
            { text: userPrompt },
        ];

        if (options.screenshotBase64) {
            parts.push({
                inlineData: {
                    mimeType: 'image/png',
                    data: options.screenshotBase64,
                },
            });
        }

        const result = await model.generateContent({
            contents: [{ role: 'user', parts }],
            systemInstruction: buildSystemPrompt({
                subjectName: options.subjectName,
                curriculumText: options.curriculumText,
                className: options.className,
                classCharacteristic: options.classCharacteristic,
                studentProfile: options.studentProfile,
            }),
            generationConfig: buildGeminiGenerationConfig('json_array'),
        });

        return result.response.text();
    },

    async modifyTaskText(task, instruction) {
        const model = getGeminiModel();
        const userPrompt = buildModifyUserPrompt(task, instruction);

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemInstruction: MODIFY_SYSTEM_PROMPT,
            generationConfig: buildGeminiGenerationConfig('json_object'),
        });

        return result.response.text();
    },

    async chatAssistantText(messages, systemPrompt) {
        const model = getGeminiModel(getPreferredChatModel('gemini'));
        const userPrompt = buildChatUserPrompt(messages);

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemInstruction: systemPrompt ?? CHAT_ASSISTANT_SYSTEM_PROMPT,
            generationConfig: buildGeminiGenerationConfig('text'),
        });

        return result.response.text();
    },

    async generateTasksFromCompiledPromptText(compiledPrompt, systemPrompt) {
        const model = getGeminiModel();
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: compiledPrompt }] }],
            systemInstruction: systemPrompt ?? BASE_SYSTEM_PROMPT,
            generationConfig: buildGeminiGenerationConfig('json_array'),
        });

        return result.response.text();
    },

    async reviseTasksText(payload, systemPrompt) {
        const model = getGeminiModel(getPreferredChatModel('gemini'));
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: payload }] }],
            systemInstruction: systemPrompt ?? TASK_REVISION_SYSTEM_PROMPT,
            generationConfig: buildGeminiGenerationConfig('json_object'),
        });

        return result.response.text();
    },
};

const openaiAdapter: ProviderAdapter = {
    generateTasksText(options) {
        return requestOpenAICompatible({
            provider: 'openai',
            userPrompt: buildGenerateUserPrompt(options),
            systemPrompt: buildSystemPrompt({
                subjectName: options.subjectName,
                curriculumText: options.curriculumText,
                className: options.className,
                classCharacteristic: options.classCharacteristic,
                studentProfile: options.studentProfile,
            }),
            screenshotBase64: options.screenshotBase64,
            responseMode: 'json_array',
        });
    },

    modifyTaskText(task, instruction) {
        return requestOpenAICompatible({
            provider: 'openai',
            userPrompt: buildModifyUserPrompt(task, instruction),
            systemPrompt: MODIFY_SYSTEM_PROMPT,
            responseMode: 'json_object',
        });
    },

    chatAssistantText(messages, systemPrompt) {
        return requestOpenAICompatible({
            provider: 'openai',
            userPrompt: buildChatUserPrompt(messages),
            systemPrompt: systemPrompt ?? CHAT_ASSISTANT_SYSTEM_PROMPT,
            modelOverride: getPreferredChatModel('openai'),
            responseMode: 'text',
        });
    },

    generateTasksFromCompiledPromptText(compiledPrompt, systemPrompt) {
        return requestOpenAICompatible({
            provider: 'openai',
            userPrompt: compiledPrompt,
            systemPrompt: systemPrompt ?? BASE_SYSTEM_PROMPT,
            responseMode: 'json_array',
        });
    },

    reviseTasksText(payload, systemPrompt) {
        return requestOpenAICompatible({
            provider: 'openai',
            userPrompt: payload,
            systemPrompt: systemPrompt ?? TASK_REVISION_SYSTEM_PROMPT,
            modelOverride: getPreferredChatModel('openai'),
            responseMode: 'json_object',
        });
    },
};

const localAdapter: ProviderAdapter = {
    generateTasksText(options) {
        return requestOpenAICompatible({
            provider: 'local',
            userPrompt: buildGenerateUserPrompt(options),
            systemPrompt: buildSystemPrompt({
                subjectName: options.subjectName,
                curriculumText: options.curriculumText,
                className: options.className,
                classCharacteristic: options.classCharacteristic,
                studentProfile: options.studentProfile,
            }),
            screenshotBase64: options.screenshotBase64,
            responseMode: 'json_array',
        });
    },

    modifyTaskText(task, instruction) {
        return requestOpenAICompatible({
            provider: 'local',
            userPrompt: buildModifyUserPrompt(task, instruction),
            systemPrompt: MODIFY_SYSTEM_PROMPT,
            responseMode: 'json_object',
        });
    },

    chatAssistantText(messages, systemPrompt) {
        return requestOpenAICompatible({
            provider: 'local',
            userPrompt: buildChatUserPrompt(messages),
            systemPrompt: systemPrompt ?? CHAT_ASSISTANT_SYSTEM_PROMPT,
            modelOverride: getPreferredChatModel('local'),
            responseMode: 'text',
        });
    },

    generateTasksFromCompiledPromptText(compiledPrompt, systemPrompt) {
        return requestOpenAICompatible({
            provider: 'local',
            userPrompt: compiledPrompt,
            systemPrompt: systemPrompt ?? BASE_SYSTEM_PROMPT,
            responseMode: 'json_array',
        });
    },

    reviseTasksText(payload, systemPrompt) {
        return requestOpenAICompatible({
            provider: 'local',
            userPrompt: payload,
            systemPrompt: systemPrompt ?? TASK_REVISION_SYSTEM_PROMPT,
            modelOverride: getPreferredChatModel('local'),
            responseMode: 'json_object',
        });
    },
};

const ADAPTERS: Record<AIProvider, ProviderAdapter> = {
    gemini: geminiAdapter,
    openai: openaiAdapter,
    local: localAdapter,
};

function getAdapter(): ProviderAdapter {
    const { provider } = getActiveProviderState();
    return ADAPTERS[provider];
}

/** ── System Prompt für Task-Generierung ── */
const BASE_SYSTEM_PROMPT = `Du bist ein erfahrener Lehrer und Aufgaben-Ersteller für Arbeitsblätter.
Erstelle Aufgaben nach dieser didaktischen Gewichtung:
- 40% Reproduktion (Wissen abrufen, einfache Fakten)
- 30% Reorganisation (Zusammenhänge erkennen, Ordnen)
- 20% Transfer (Wissen in neuen Kontexten anwenden)
- 10% Problemlösendes Denken (Kreative Lösungen, Analyse)

WICHTIG: Die Antwort muss ein valides JSON-Array sein, OHNE Markdown-Codeblöcke.
Jedes Element muss einem dieser Typen entsprechen:

1. Multiple-Choice:
{
  "type": "multiple-choice",
  "title": "Aufgabe: ...",
  "question": "Fragetext",
  "options": [
    { "text": "Option A", "isCorrect": true },
    { "text": "Option B", "isCorrect": false },
    { "text": "Option C", "isCorrect": false },
    { "text": "Option D", "isCorrect": false }
  ]
}

2. Lückentext:
{
  "type": "cloze",
  "title": "Aufgabe: ...",
    "content": "Der [Hund] ist ein [Säugetier]."
}

3. Lineatur (Schreiblinien):
{
  "type": "lineatur",
  "title": "Aufgabe: ...",
    "promptHtml": "Kurze Arbeitsanweisung als Text oder HTML",
  "lineStyle": "lines-8mm",
    "gridColumns": 32,
    "lineRows": 4
}

4. Mathematik-Formel:
{
  "type": "math",
  "title": "Aufgabe: ...",
  "content": "a^2 + b^2 = c^2"
}

Regeln:
- Erstelle GENAU die Anzahl an Aufgaben, die der Benutzer angibt (Standard: 4-6 gemischte Aufgaben)
- Aufgaben müssen altersgerecht für die angegebene Klassenstufe sein
- Formuliere klar und eindeutig auf Deutsch
- Multiple-Choice: immer genau 4 Optionen, genau 1 richtig
- Lückentext: markiere Lücken mit [Wort]
- Bei Lineatur: nutze "lines-8mm" für ältere Schüler, "primary-4-lines" für Klasse 1-2
- Wenn das Fach Mathematik, Physik oder Chemie ist: Verwende den Typ "math" für Aufgaben mit Formeln. Schreibe den LaTeX-Code OHNE Dollarzeichen direkt in das "content"-Feld.
`;

const MODIFY_SYSTEM_PROMPT = `Du bist ein erfahrener Lehrer-Assistent.
Du erhältst eine einzelne Aufgabe als JSON und eine Anweisung des Lehrers.
Modifiziere die Aufgabe GENAU nach der Anweisung.

WICHTIG: Die Antwort muss ein valides JSON-Objekt sein, OHNE Markdown-Codeblöcke.
Das Format muss exakt dem Eingabe-Format entsprechen (gleicher "type").
Behalte den ursprünglichen "type" bei, ändere ihn NICHT.
Wenn der Typ "cloze" ist, markiere Lücken immer mit [Wort] (nicht mit {{Wort}}).
`;

const CHAT_ASSISTANT_SYSTEM_PROMPT = `Du bist ein didaktischer KI-Co-Pilot für Lehrkräfte.
Deine Aufgabe in dieser Chat-Phase ist NICHT das direkte Erstellen des Arbeitsblatts,
sondern das gemeinsame Schärfen von:
- Thema
- Zielgruppe / Klassenstufe
- gewünschte Aufgabentypen
- Schwierigkeitsgrad
- ggf. vorhandene Rohtexte oder Materialien

Regeln:
- Antworte klar, kurz und praktisch auf Deutsch.
- Stelle bei fehlenden Infos maximal 2 präzise Rückfragen.
- Gib keine JSON-Ausgabe und keine Codeblöcke aus.
- Wenn der Nutzer Rohtext einfügt, fasse ihn didaktisch strukturiert zusammen.
`;

const TASK_REVISION_SYSTEM_PROMPT = `Du bist ein KI-Lektor für Arbeitsblätter.
Dein Job: Bestehende Aufgaben gezielt überarbeiten ODER neue Aufgaben ergänzen.

WICHTIG (streng):
- Antworte IMMER mit GENAU EINEM \`\`\`json Codeblock.
- Kein Fließtext vor oder nach dem Codeblock.
- Wenn eine Aktion ausgeführt werden soll, darfst du NICHT nur beschreiben ("Ich habe ..."), sondern MUSST sie in "operations" maschinenlesbar liefern.
- Wenn keine eindeutige Aktion möglich ist: "operations": [] und eine kurze "assistantMessage".

Erlaubte Aktionen:
- "update_task" (Synonym "update")
- "add_task" (Synonym "add")

Regeln für Aktionen:
- "update_task": Nur EXISTIERENDE taskId aus dem Kontext verwenden.
- "update_task": Gib in "updates" IMMER das VOLLSTÄNDIGE Daten-Objekt der Ziel-Aufgabe zurück (kein Teilfragment).
- Wenn du bei "update_task" den "type" änderst (z. B. zu "multiple-choice"), MUSST du alle Pflichtfelder dieses Typs vollständig erzeugen (z. B. "question" + vollständiges "options"-Array).
- Generiere NIEMALS partielle Fragmente wie nur einen neuen Titel ohne die restlichen Pflichtfelder.
- "add_task": Neue Aufgabe OHNE id liefern. Verwende "type" + vollständiges "payload".
- Keine Löschaktionen, keine Fantasie-IDs, keine Änderungen außerhalb der Nutzeranfrage.

Pflichtformat (immer):
\`\`\`json
{
  "assistantMessage": "Kurz und sachlich",
  "operations": [
    {
      "action": "update_task",
      "taskId": "<id-aus-dem-kontext>",
      "updates": { ... }
    },
    {
      "action": "add_task",
      "type": "multiple-choice",
      "payload": {
        "type": "multiple-choice",
        "title": "Aufgabe: ...",
        "question": "...",
        "options": [
          { "text": "A", "isCorrect": true },
          { "text": "B", "isCorrect": false },
          { "text": "C", "isCorrect": false },
          { "text": "D", "isCorrect": false }
        ]
      }
    }
  ]
}
\`\`\`
`;

const MAX_CONTEXT_BLOCK_CHARS = 3000;

function clampContextBlock(text?: string): string {
    const normalized = (text ?? '').trim();
    if (!normalized) return '';
    if (normalized.length <= MAX_CONTEXT_BLOCK_CHARS) return normalized;
    return `${normalized.slice(0, MAX_CONTEXT_BLOCK_CHARS)}\n...[gekürzt]`;
}

function buildInjectedClassContextBlock(context?: AIClassContext): string | null {
    if (!context) return null;

    const className = context.className?.trim();
    const subjectName = context.subjectName?.trim();
    const curriculumContext = clampContextBlock(context.curriculumContext);
    const studentProfile = clampContextBlock(context.studentProfile);

    if (!className && !subjectName && !curriculumContext && !studentProfile) {
        return null;
    }

    const lines: string[] = [
        'ZUSAETZLICHER KLASSENKONTEXT (verbindlich beruecksichtigen):',
    ];

    if (className) lines.push(`- Klasse: ${className}`);
    if (subjectName) lines.push(`- Fach: ${subjectName}`);
    if (curriculumContext) {
        lines.push('- Klassenbezogener Lehrplan-/Curriculum-Kontext:');
        lines.push(curriculumContext);
    }
    if (studentProfile) {
        lines.push('- Lerngruppen-/Schuelerprofil (Sprache, Differenzierung, Niveau):');
        lines.push(studentProfile);
    }

    lines.push('Passe Sprache, Umfang, Hilfestellungen und Schwierigkeitsgrad zwingend an diesen Kontext an.');

    return lines.join('\n');
}

function prependContextToSystemPrompt(basePrompt: string, context?: AIClassContext): string {
    const block = buildInjectedClassContextBlock(context);
    if (!block) return basePrompt;
    return `${block}\n\n${basePrompt}`;
}

function buildChatAssistantSystemPrompt(context?: AIClassContext): string {
    return prependContextToSystemPrompt(CHAT_ASSISTANT_SYSTEM_PROMPT, context);
}

function buildTaskRevisionSystemPrompt(context?: AIClassContext): string {
    return prependContextToSystemPrompt(TASK_REVISION_SYSTEM_PROMPT, context);
}

/** Baut den System-Prompt mit optionalem Lehrplan-Kontext + Profildaten */
function buildSystemPrompt(options?: {
    subjectName?: string;
    curriculumText?: string;
    className?: string;
    classCharacteristic?: string;
    studentProfile?: string;
}): string {
    const { curriculumContext } = useSettingsStore.getState();
    const parts: string[] = [];
    const studentProfile = clampContextBlock(options?.studentProfile?.trim() || options?.classCharacteristic?.trim());
    const contextualCurriculumText = clampContextBlock(options?.curriculumText);

    if (options?.subjectName || options?.className) {
        let profilePrompt = 'Erstelle Aufgaben';
        if (options.subjectName) {
            profilePrompt += ` für ${options.subjectName}`;
        }
        if (contextualCurriculumText) {
            profilePrompt += ` unter Berücksichtigung von: ${contextualCurriculumText}`;
        }
        if (options.className) {
            profilePrompt += ` für die Klasse ${options.className}`;
            if (studentProfile) {
                profilePrompt += ` mit folgendem Profil: ${studentProfile}`;
            }
        }
        profilePrompt += '.';
        parts.push(profilePrompt);
    }

    if (curriculumContext.trim()) {
        parts.push(`Berücksichtige bei der Aufgabenerstellung zwingend diesen Lehrplan-Kontext:\n${curriculumContext.trim()}`);
    }

    if (parts.length === 0) return BASE_SYSTEM_PROMPT;

    return `${parts.join('\n\n')}\n\n${BASE_SYSTEM_PROMPT}`;
}

function buildGenerateUserPrompt(options: GenerateTasksOptions): string {
    const taskCountStr = options.taskCount
        ? `- Anzahl Aufgaben: GENAU ${options.taskCount} Aufgaben erstellen`
        : '- Anzahl Aufgaben: 4-6 gemischte Aufgaben';

    return `Erstelle Aufgaben für ein Arbeitsblatt:
- Thema: ${options.topic}
- Klassenstufe: ${options.classLevel}
${taskCountStr}
${options.schoolType ? `- Schulform: ${options.schoolType}` : ''}
${options.difficultyLevel ? `- Anforderungsniveau: ${options.difficultyLevel}` : ''}
${options.screenshotBase64 ? '\nDas angehängte Bild zeigt Kontext-Material, das als Grundlage dienen soll.' : ''}

Antworte NUR mit dem JSON-Array.`;
}

function buildModifyUserPrompt(task: Task, instruction: string): string {
    const { id: _, ...taskData } = task;

    return `Aktuelle Aufgabe:
${JSON.stringify(taskData, null, 2)}

Anweisung: ${instruction}

Antworte NUR mit dem modifizierten JSON-Objekt.`;
}

function buildChatUserPrompt(messages: ChatMessage[]): string {
    const transcript = messages
        .map((message) => {
            const label = message.role === 'user' ? 'Lehrkraft' : 'Assistent';
            return `${label}: ${message.content}`;
        })
        .join('\n\n');

    return `Aktueller Chatverlauf:\n${transcript}\n\nAntworte als nächster Assistenten-Beitrag auf die letzte Lehrkraft-Nachricht.`;
}

function buildTaskRevisionUserPrompt(
    messages: ChatMessage[],
    tasksById: Record<string, Task>,
    taskIds: string[],
    sources?: WorksheetSource[],
): string {
    const taskCatalog = taskIds
        .map((taskId, index) => {
            const task = tasksById[taskId];
            if (!task) return null;

            return {
                position: index + 1,
                taskId,
                type: task.type,
                title: task.title,
                task,
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const transcript = messages
        .map((message) => `${message.role === 'user' ? 'Lehrkraft' : 'Assistent'}: ${message.content}`)
        .join('\n\n');

    const normalizedSources = (sources ?? []).map((source) => ({
        id: source.id,
        url: source.url,
        title: source.title,
    }));

    return `KONTEXT FÜR LEKTOR-MODUS

Chatverlauf:
${transcript}

Verfügbare Aufgaben (mit stabilen IDs):
${JSON.stringify(taskCatalog, null, 2)}

Dokument-Quellen:
${JSON.stringify(normalizedSources, null, 2)}

AUFTRAG:
- Leite aus der letzten Lehrkraft-Nachricht konkrete Task-Änderungen ab.
- Wenn die Lehrkraft eine neue Aufgabe verlangt: nutze "add_task" (Synonym "add") mit "type" + vollständigem "payload" (ohne id).
- Wenn eine bestehende Aufgabe geändert werden soll: nutze "update_task" (Synonym "update") mit "taskId" + "updates" und liefere in "updates" IMMER das vollständige Zielobjekt (keine Teilfragmente).
- Wenn keine eindeutige Änderung möglich ist: operations = [] und eine hilfreiche assistantMessage.
- Verändere nur die betroffenen Tasks.
- Gib IMMER genau einen \`\`\`json-Codeblock im Pflichtformat zurück.
- Schreibe niemals nur erklärenden Fließtext, wenn eine Aktion ausgeführt werden soll.`;
}

export function compileWorksheetPromptFromChat(messages: ChatMessage[]): string {
    const cleaned = messages
        .map((message) => ({
            role: message.role,
            content: message.content.trim(),
        }))
        .filter((message) => message.content.length > 0);

    if (cleaned.length === 0) {
        throw new Error('Der Chatverlauf ist leer. Bitte zuerst mit dem KI-Assistenten arbeiten.');
    }

    const transcript = cleaned
        .map((message) => `${message.role === 'user' ? 'Lehrkraft' : 'Assistent'}: ${message.content}`)
        .join('\n\n');

    return `Nutze den folgenden Chat als vollständigen Kontext für die Arbeitsblatt-Erstellung.

CHATVERLAUF:
${transcript}

AUFGABE:
- Leite Thema, Klassenstufe/Zielgruppe, gewünschte Aufgabentypen und Schwierigkeitsniveau aus dem Verlauf ab.
- Wenn Informationen fehlen, triff konservative, schulnahe Annahmen.
- Erstelle ein ausgewogenes Set aus Aufgaben gemäß den im Verlauf besprochenen Wünschen.
- Halte dich streng an das geforderte JSON-Array-Format.`;
}

function extractJsonCodeBlockCandidates(text: string): string[] {
    const matches: string[] = [];
    const regexes = [
        /```json\s*([\s\S]*?)```/gi,
        /```(?:[a-z0-9_-]+)?\s*([\s\S]*?)```/gi,
    ];

    for (const regex of regexes) {
        for (const match of text.matchAll(regex)) {
            const candidate = match[1]?.trim();
            if (candidate) matches.push(candidate);
        }
    }

    return matches;
}

function dedupeCandidates(candidates: string[]): string[] {
    return Array.from(new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean)));
}

function extractJsonCandidates(text: string): string[] {
    const candidates: string[] = [...extractJsonCodeBlockCandidates(text)];

    const operationsObject = text.match(/\{[\s\S]*?"operations"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/i);
    if (operationsObject?.[0]) candidates.push(operationsObject[0]);

    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch?.[0]) candidates.push(arrayMatch[0]);

    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch?.[0]) candidates.push(objectMatch[0]);

    candidates.push(text.trim());
    return dedupeCandidates(candidates);
}

function asObject(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function parseJsonObjectLike(value: unknown): Record<string, unknown> | null {
    const direct = asObject(value);
    if (direct) return direct;

    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
        const parsed = JSON.parse(trimmed) as unknown;
        return asObject(parsed);
    } catch {
        return null;
    }
}

function parseFirstJsonObjectFromMarkdownCodeBlocks(text: string): Record<string, unknown> | null {
    for (const candidate of extractJsonCodeBlockCandidates(text)) {
        const parsed = parseJsonObjectLike(candidate);
        if (parsed) return parsed;
    }

    return null;
}

function isLikelyTruncatedJsonError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return /unexpected end of json input|unterminated|string literal|end of data/i.test(error.message);
}

function looksLikeTruncatedJsonCandidate(candidate: string): boolean {
    const trimmed = candidate.trim();
    if (!trimmed) return false;

    if (/[{[]/.test(trimmed) && !/[}\]]\s*$/.test(trimmed)) {
        return true;
    }

    let curlyBalance = 0;
    let squareBalance = 0;
    for (const char of trimmed) {
        if (char === '{') curlyBalance += 1;
        if (char === '}') curlyBalance -= 1;
        if (char === '[') squareBalance += 1;
        if (char === ']') squareBalance -= 1;
    }

    return curlyBalance > 0 || squareBalance > 0 || /[:,]\s*$/.test(trimmed);
}

function createJsonParseUserError(label: string, responseText: string, candidate?: string, cause?: unknown): Error {
    const likelyTruncated =
        (candidate ? looksLikeTruncatedJsonCandidate(candidate) : false) ||
        isLikelyTruncatedJsonError(cause);

    if (likelyTruncated) {
        return new Error(AI_JSON_TRUNCATED_USER_MESSAGE);
    }

    return new Error(`${label}:\n${responseText.substring(0, 500)}`);
}

function parseJsonObjectFromAIResponse(text: string, label: string): Record<string, unknown> {
    const candidates = extractJsonCandidates(text);
    let lastError: unknown = null;
    let lastCandidate = '';

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate) as unknown;
            const obj = asObject(parsed);
            if (obj) return obj;
        } catch (error) {
            lastError = error;
            lastCandidate = candidate;
        }
    }

    throw createJsonParseUserError(label, text, lastCandidate || undefined, lastError);
}

function parseJsonArrayFromAIResponse(text: string, label: string): unknown[] {
    const candidates = extractJsonCandidates(text);
    let lastError: unknown = null;
    let lastCandidate = '';

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate) as unknown;
            if (Array.isArray(parsed)) return parsed;

            const obj = asObject(parsed);
            if (obj) {
                const wrappedTasks = obj.tasks;
                if (Array.isArray(wrappedTasks)) return wrappedTasks;
                const wrappedItems = obj.items;
                if (Array.isArray(wrappedItems)) return wrappedItems;
            }
        } catch (error) {
            lastError = error;
            lastCandidate = candidate;
        }
    }

    throw createJsonParseUserError(label, text, lastCandidate || undefined, lastError);
}

function parseTaskRevisionResponseObject(text: string): Record<string, unknown> {
    const fromMarkdown = parseFirstJsonObjectFromMarkdownCodeBlocks(text);
    if (fromMarkdown) return fromMarkdown;
    return parseJsonObjectFromAIResponse(text, 'KI-Lektor hat kein valides JSON geliefert');
}

function normalizeRevisionAction(action: unknown): 'update_task' | 'add_task' | null {
    if (typeof action !== 'string') return null;
    const normalized = action.trim().toLowerCase();
    if (normalized === 'update_task' || normalized === 'update') return 'update_task';
    if (normalized === 'add_task' || normalized === 'add') return 'add_task';
    return null;
}

function normalizeTaskType(value: unknown): TaskType | null {
    if (typeof value !== 'string') return null;

    const normalized = value.trim();
    const allowed: TaskType[] = [
        'multiple-choice',
        'lineatur',
        'cloze',
        'image-placeholder',
        'math',
        'page-break',
        'columns',
        'instruction',
    ];

    return allowed.includes(normalized as TaskType) ? (normalized as TaskType) : null;
}

function normalizeClozePlaceholders(content: string): string {
    return content.replace(/\{\{(.*?)\}\}/g, '[$1]');
}

/** Validiert und normalisiert Tasks aus der KI-Antwort */
function validateAndNormalizeTasks(raw: unknown[]): Omit<Task, 'id'>[] {
    return raw
        .filter((item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null && 'type' in item
        )
        .map((item) => {
            const type = item.type as string;

            switch (type) {
                case 'multiple-choice':
                    return {
                        type: 'multiple-choice' as const,
                        title: String(item.title || 'Multiple-Choice'),
                        question: String(item.question || ''),
                        options: Array.isArray(item.options)
                            ? item.options.map((opt: Record<string, unknown>) => ({
                                id: crypto.randomUUID(),
                                text: String(opt.text || ''),
                                isCorrect: Boolean(opt.isCorrect),
                            }))
                            : [],
                    };

                case 'cloze':
                    return {
                        type: 'cloze' as const,
                        title: String(item.title || 'Lückentext'),
                        content: normalizeClozePlaceholders(String(item.content || '')),
                    };

                case 'lineatur':
                    return {
                        type: 'lineatur' as const,
                        title: String(item.title || 'Lineatur'),
                        promptHtml: typeof item.promptHtml === 'string'
                            ? item.promptHtml
                            : typeof item.prompt === 'string'
                                ? item.prompt
                                : '',
                        lineStyle: (['grid-5mm', 'grid-10mm', 'lines-8mm', 'primary-4-lines'].includes(String(item.lineStyle))
                            ? String(item.lineStyle)
                            : 'lines-8mm') as Task extends { lineStyle: infer L } ? L : never,
                        gridColumns: typeof item.gridColumns === 'number' ? item.gridColumns : 32,
                        lineRows: typeof item.lineRows === 'number' ? Math.max(1, Math.min(20, Math.round(item.lineRows))) : 4,
                    };

                case 'math':
                    return {
                        type: 'math' as const,
                        title: String(item.title || 'Mathematik'),
                        content: String(item.content || ''),
                    };

                case 'instruction':
                    return {
                        type: 'instruction' as const,
                        title: String(item.title || 'Aufgabe'),
                        text: String(item.text || ''),
                    };

                case 'page-break':
                    return {
                        type: 'page-break' as const,
                        title: String(item.title || 'Seitenumbruch'),
                    };

                case 'image-placeholder':
                    return {
                        type: 'image-placeholder' as const,
                        title: String(item.title || 'Bildplatzhalter'),
                        caption: String(item.caption || ''),
                        widthMm: typeof item.widthMm === 'number' ? Math.max(10, Math.round(item.widthMm)) : 80,
                        heightMm: typeof item.heightMm === 'number' ? Math.max(10, Math.round(item.heightMm)) : 60,
                    };

                case 'columns':
                    return {
                        type: 'columns' as const,
                        title: String(item.title || 'Zweispaltig'),
                        layout: (['50-50', '60-40', '40-60'].includes(String(item.layout))
                            ? String(item.layout)
                            : '50-50') as Task extends { layout: infer L } ? L : never,
                        gapMm: typeof item.gapMm === 'number' ? Math.max(0, Math.round(item.gapMm)) : 6,
                        children: [null, null],
                    };

                default:
                    return null;
            }
        })
        .map((item) => {
            if (item && item.type === 'cloze' && 'content' in item) {
                const content = (item as { content: string }).content;
                const mathMatch = content.match(/^\$\$(.+)\$\$$/s);
                if (mathMatch) {
                    return {
                        type: 'math' as const,
                        title: item.title,
                        content: mathMatch[1].trim(),
                    };
                }
            }
            return item;
        })
        .filter((task): task is NonNullable<typeof task> => task !== null);
}

/** Validiert eine einzelne modifizierte Task */
function validateSingleTask(raw: Record<string, unknown>, originalType: string): Omit<Task, 'id'> | null {
    const tasks = validateAndNormalizeTasks([{ ...raw, type: originalType }]);
    return tasks.length > 0 ? tasks[0] : null;
}

function validateTaskRevisionResult(
    raw: unknown,
    tasksById: Record<string, Task>,
): TaskRevisionResult {
    if (typeof raw !== 'object' || raw === null) {
        throw new Error('Lektor-Antwort ist kein gültiges Objekt.');
    }

    const payload = raw as {
        assistantMessage?: unknown;
        operations?: unknown;
        action?: unknown;
        taskId?: unknown;
        updates?: unknown;
        type?: unknown;
        payload?: unknown;
        arguments?: unknown;
        toolCall?: unknown;
        toolCalls?: unknown;
    };

    const assistantMessage =
        typeof payload.assistantMessage === 'string'
            ? payload.assistantMessage.trim()
            : 'Änderungen geprüft.';

    const rawOperations: unknown[] = [];

    if (Array.isArray(payload.operations)) {
        rawOperations.push(...payload.operations);
    }

    const pushActionCandidate = (candidate: unknown) => {
        const obj = asObject(candidate);
        if (!obj || !('action' in obj)) return;
        rawOperations.push(obj);
    };

    if ('action' in payload) {
        rawOperations.push(payload);
    }

    const payloadArguments = parseJsonObjectLike(payload.arguments);
    pushActionCandidate(payloadArguments);

    const payloadToolCall = asObject(payload.toolCall);
    if (payloadToolCall) {
        const toolArgs = parseJsonObjectLike(payloadToolCall.arguments);
        pushActionCandidate(toolArgs);
    }

    if (Array.isArray(payload.toolCalls)) {
        for (const toolCallEntry of payload.toolCalls) {
            const toolCall = asObject(toolCallEntry);
            if (!toolCall) continue;
            const toolArgs = parseJsonObjectLike(toolCall.arguments);
            pushActionCandidate(toolArgs);
        }
    }

    const operations: TaskRevisionResult['operations'] = [];

    for (const operation of rawOperations) {
        if (typeof operation !== 'object' || operation === null) continue;

        const typedOp = operation as {
            action?: unknown;
            taskId?: unknown;
            updates?: unknown;
        };

        const normalizedAction = normalizeRevisionAction(typedOp.action);
        if (!normalizedAction) continue;

        if (normalizedAction === 'update_task') {
            if (typeof typedOp.taskId !== 'string' || !typedOp.taskId.trim()) continue;
            const rawUpdates = asObject(typedOp.updates);
            if (!rawUpdates) continue;

            const originalTask = tasksById[typedOp.taskId];
            if (!originalTask) continue;
            const targetTaskType = normalizeTaskType(rawUpdates.type) ?? originalTask.type;

            const mergedTaskCandidate = {
                ...originalTask,
                ...rawUpdates,
            };
            const { id: _ignored, ...withoutId } = mergedTaskCandidate;

            const validated = validateSingleTask(withoutId as Record<string, unknown>, targetTaskType);
            if (!validated) continue;

            operations.push({
                action: normalizedAction,
                taskId: typedOp.taskId,
                updates: validated,
            });
            continue;
        }

        const operationObject = operation as Record<string, unknown>;
        const payloadObject =
            parseJsonObjectLike(operationObject.payload) ??
            parseJsonObjectLike(operationObject.task);

        const normalizedType =
            normalizeTaskType(operationObject.type) ??
            normalizeTaskType(payloadObject?.type);

        if (!normalizedType) continue;

        if (!payloadObject) {
            operations.push({
                action: 'add_task',
                type: normalizedType,
            });
            continue;
        }

        const [validatedAddTask] = validateAndNormalizeTasks([{ ...payloadObject, type: normalizedType }]);
        if (!validatedAddTask) {
            operations.push({
                action: 'add_task',
                type: normalizedType,
            });
            continue;
        }

        operations.push({
            action: 'add_task',
            type: normalizedType,
            payload: validatedAddTask,
        });
    }

    return {
        assistantMessage,
        operations,
    };
}

export interface GenerateTasksOptions {
    topic: string;
    classLevel: string;
    schoolType?: string;
    difficultyLevel?: string;
    screenshotBase64?: string;
    taskCount?: number;
    subjectName?: string;
    curriculumText?: string;
    className?: string;
    classCharacteristic?: string;
    studentProfile?: string;
}

export async function generateTasks(options: GenerateTasksOptions): Promise<Omit<Task, 'id'>[]> {
    const responseText = await getAdapter().generateTasksText(options);
    const parsed = parseJsonArrayFromAIResponse(responseText, 'KI hat kein valides JSON zurückgegeben');

    if (!Array.isArray(parsed)) {
        throw new Error('KI-Antwort ist kein Array.');
    }

    const tasks = validateAndNormalizeTasks(parsed);
    if (tasks.length === 0) {
        throw new Error('Keine gültigen Aufgaben in der KI-Antwort gefunden.');
    }

    return tasks;
}

export async function modifyTask(task: Task, instruction: string): Promise<Omit<Task, 'id'>> {
    const responseText = await getAdapter().modifyTaskText(task, instruction);
    const parsed = parseJsonObjectFromAIResponse(responseText, 'KI hat kein valides JSON zurückgegeben');

    const modified = validateSingleTask(parsed, task.type);
    if (!modified) {
        throw new Error('Die modifizierte Aufgabe konnte nicht validiert werden.');
    }

    return modified;
}

export async function generateChatAssistantReply(
    messages: ChatMessage[],
    classContext?: AIClassContext,
): Promise<string> {
    const cleaned = messages.filter((message) => message.content.trim().length > 0);
    if (cleaned.length === 0) {
        return 'Gerne. Womit soll ich dir für dein Arbeitsblatt helfen (Thema, Klasse, Aufgabentypen)?';
    }

    const responseText = await getAdapter().chatAssistantText(cleaned, buildChatAssistantSystemPrompt(classContext));
    return responseText.trim();
}

export async function generateTasksFromCompiledPrompt(
    compiledPrompt: string,
    classContext?: AIClassContext,
): Promise<Omit<Task, 'id'>[]> {
    const responseText = await getAdapter().generateTasksFromCompiledPromptText(
        compiledPrompt,
        prependContextToSystemPrompt(BASE_SYSTEM_PROMPT, classContext),
    );
    const parsed = parseJsonArrayFromAIResponse(responseText, 'KI hat kein valides JSON zurückgegeben');

    if (!Array.isArray(parsed)) {
        throw new Error('KI-Antwort ist kein Array.');
    }

    const tasks = validateAndNormalizeTasks(parsed);
    if (tasks.length === 0) {
        throw new Error('Keine gültigen Aufgaben in der KI-Antwort gefunden.');
    }

    return tasks;
}

export async function generateTaskRevisionResult(
    messages: ChatMessage[],
    tasksById: Record<string, Task>,
    taskIds: string[],
    sources?: WorksheetSource[],
    classContext?: AIClassContext,
): Promise<TaskRevisionResult> {
    const cleaned = messages.filter((message) => message.content.trim().length > 0);
    if (cleaned.length === 0) {
        return {
            assistantMessage: 'Kein Chatverlauf vorhanden.',
            operations: [],
        };
    }

    const payload = buildTaskRevisionUserPrompt(cleaned, tasksById, taskIds, sources);
    const responseText = await getAdapter().reviseTasksText(payload, buildTaskRevisionSystemPrompt(classContext));
    const parsed = parseTaskRevisionResponseObject(responseText);

    return validateTaskRevisionResult(parsed, tasksById);
}
