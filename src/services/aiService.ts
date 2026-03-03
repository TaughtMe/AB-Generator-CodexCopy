import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import type { Task, WorksheetSource } from '../types/worksheet';
import { useSettingsStore, type AIProvider } from '../store/settingsStore';
import { useSourceStore } from '../store/sourceStore';
import { PROVIDER_LABELS } from './ai/modelCatalog';
import type { ChatMessage } from '../types/ai';
import {
    AI_JSON_TRUNCATED_USER_MESSAGE,
    TASK_REVISION_SYSTEM_PROMPT,
    buildTaskRevisionUserPrompt,
    looksLikeTruncatedJson,
    parseTaskRevisionOperations,
    type AIClassContext,
    type TaskRevisionResult,
} from './ai/taskRevision';

export { AI_JSON_TRUNCATED_USER_MESSAGE };
export type { AIClassContext, TaskRevisionResult };

/* ══════════════════════════════════════════════════
   aiService.ts – Zentrale KI-Fassade
   Einheitlicher Einstieg für Gemini, OpenAI, Local.
   ══════════════════════════════════════════════════ */

interface ProviderAdapter {
    generateTasksText: (options: GenerateTasksOptions) => Promise<string>;
    modifyTaskText: (task: Task, instruction: string) => Promise<string>;
    chatAssistantText: (messages: ChatMessage[]) => Promise<string>;
    generateTasksFromCompiledPromptText: (compiledPrompt: string) => Promise<string>;
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

const MAX_CONTEXT_TOTAL_CHARS = 45000;
const MAX_CONTEXT_SOURCE_CHARS = 10000;
const MODEL_SELECTION_ERROR_PATTERNS = [
    /\bmodel\b[\s\S]*\bnot found\b/i,
    /\bnot found\b[\s\S]*\bmodel\b/i,
    /\bunknown model\b/i,
    /\bno such model\b/i,
    /\bunsupported model\b/i,
    /\bmodel\b[\s\S]*\bnot supported\b/i,
    /\binvalid model\b/i,
    /\bnot a valid model\b/i,
    /\bmodel\b[\s\S]*\bdoes not exist\b/i,
];

function isModelSelectionError(message: string): boolean {
    const normalized = message.trim();
    if (!normalized) return false;
    return MODEL_SELECTION_ERROR_PATTERNS.some((pattern) => pattern.test(normalized));
}

function getModelSelectionErrorMessage(provider: AIProvider): string {
    return `Gewähltes Modell für ${PROVIDER_LABELS[provider]} ist nicht verfügbar. Bitte in den Einstellungen ein anderes Modell auswählen.`;
}

function normalizeProviderError(provider: AIProvider, error: unknown, fallbackMessage?: string): Error {
    const rawMessage = typeof error === 'string'
        ? error
        : error instanceof Error
            ? error.message
            : '';
    const message = rawMessage.trim() || fallbackMessage || `${PROVIDER_LABELS[provider]} Anfrage fehlgeschlagen.`;

    if (isModelSelectionError(message)) {
        return new Error(getModelSelectionErrorMessage(provider));
    }

    return new Error(message);
}

function buildActiveSourceContextBlock(): string {
    const allSources = useSourceStore.getState().sources;
    const activeSources = allSources.filter((source) => source.isActive && source.extractedText.trim().length > 0);
    if (activeSources.length === 0) return '';

    let usedChars = 0;
    const chunks: string[] = [];

    for (const source of activeSources) {
        if (usedChars >= MAX_CONTEXT_TOTAL_CHARS) break;
        const trimmedText = source.extractedText.trim();
        const slice = trimmedText.slice(0, MAX_CONTEXT_SOURCE_CHARS);
        const remaining = MAX_CONTEXT_TOTAL_CHARS - usedChars;
        const finalSlice = slice.slice(0, remaining);
        if (!finalSlice) continue;

        chunks.push(`[Quelle: ${source.name}]\n${finalSlice}`);
        usedChars += finalSlice.length;
    }

    if (chunks.length === 0) return '';

    return [
        'Nutze ausschließlich die folgenden Unterrichtsmaterialien als Basis für deine Generierung:',
        '<context>',
        chunks.join('\n\n'),
        '</context>',
    ].join('\n');
}

function withInjectedSourceContext(systemPrompt: string): string {
    const sourceContextBlock = buildActiveSourceContextBlock();
    if (!sourceContextBlock) return systemPrompt;
    return `${systemPrompt}\n\n${sourceContextBlock}`;
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

export async function testConnection(provider: AIProvider): Promise<{ ok: boolean; message?: string }> {
    try {
        if (provider === 'gemini') {
            const model = getGeminiModel();
            await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'Antworte nur mit OK.' }] }],
                systemInstruction: withInjectedSourceContext('Antworte nur mit OK.'),
            });
            return { ok: true };
        }

        await requestOpenAICompatible({
            provider,
            userPrompt: 'Antworte nur mit OK.',
            systemPrompt: withInjectedSourceContext('Antworte nur mit OK.'),
            modelOverride: provider === 'openai' ? getPreferredChatModel('openai') : getPreferredChatModel('local'),
        });
        return { ok: true };
    } catch (error) {
        const normalizedError = normalizeProviderError(provider, error, 'Verbindungstest fehlgeschlagen.');
        return {
            ok: false,
            message: normalizedError.message,
        };
    }
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

async function requestOpenAICompatible(params: {
    provider: 'openai' | 'local';
    userPrompt: string;
    systemPrompt: string;
    screenshotBase64?: string;
    modelOverride?: string;
}): Promise<string> {
    const config = requireProviderConfig(params.provider);
    const baseUrl = (config.baseUrl || (params.provider === 'openai' ? 'https://api.openai.com/v1' : '')).replace(/\/$/, '');

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

    for (const candidateBaseUrl of candidateBaseUrls) {
        try {
            const candidateResponse = await fetch(`${candidateBaseUrl}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: params.modelOverride ?? config.model,
                    messages: [
                        { role: 'system', content: params.systemPrompt },
                        { role: 'user', content },
                    ],
                }),
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
            throw normalizeProviderError(
                params.provider,
                detail,
                'Lokaler KI-Server nicht erreichbar. Tipp: im Dev-Container statt 127.0.0.1 ggf. host.docker.internal nutzen.',
            );
        }
        throw normalizeProviderError(
            params.provider,
            detail,
            `${PROVIDER_LABELS[params.provider]} Anfrage fehlgeschlagen${response ? ` (HTTP ${response.status})` : ''}.`,
        );
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

    throw normalizeProviderError(params.provider, `${PROVIDER_LABELS[params.provider]} hat keine lesbare Antwort geliefert.`);
}

const geminiAdapter: ProviderAdapter = {
    async generateTasksText(options) {
        try {
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
                systemInstruction: withInjectedSourceContext(buildSystemPrompt({
                    subjectName: options.subjectName,
                    curriculumText: options.curriculumText,
                    className: options.className,
                    classCharacteristic: options.classCharacteristic,
                })),
            });

            return result.response.text();
        } catch (error) {
            throw normalizeProviderError('gemini', error);
        }
    },

    async modifyTaskText(task, instruction) {
        try {
            const model = getGeminiModel();
            const userPrompt = buildModifyUserPrompt(task, instruction);

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                systemInstruction: withInjectedSourceContext(MODIFY_SYSTEM_PROMPT),
            });

            return result.response.text();
        } catch (error) {
            throw normalizeProviderError('gemini', error);
        }
    },

    async chatAssistantText(messages) {
        try {
            const model = getGeminiModel(getPreferredChatModel('gemini'));
            const userPrompt = buildChatUserPrompt(messages);

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                systemInstruction: withInjectedSourceContext(CHAT_ASSISTANT_SYSTEM_PROMPT),
            });

            return result.response.text();
        } catch (error) {
            throw normalizeProviderError('gemini', error);
        }
    },

    async generateTasksFromCompiledPromptText(compiledPrompt) {
        try {
            const model = getGeminiModel();
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: compiledPrompt }] }],
                systemInstruction: withInjectedSourceContext(BASE_SYSTEM_PROMPT),
            });

            return result.response.text();
        } catch (error) {
            throw normalizeProviderError('gemini', error);
        }
    },
};

const openaiAdapter: ProviderAdapter = {
    generateTasksText(options) {
        return requestOpenAICompatible({
            provider: 'openai',
            userPrompt: buildGenerateUserPrompt(options),
            systemPrompt: withInjectedSourceContext(buildSystemPrompt({
                subjectName: options.subjectName,
                curriculumText: options.curriculumText,
                className: options.className,
                classCharacteristic: options.classCharacteristic,
            })),
            screenshotBase64: options.screenshotBase64,
        });
    },

    modifyTaskText(task, instruction) {
        return requestOpenAICompatible({
            provider: 'openai',
            userPrompt: buildModifyUserPrompt(task, instruction),
            systemPrompt: withInjectedSourceContext(MODIFY_SYSTEM_PROMPT),
        });
    },

    chatAssistantText(messages) {
        return requestOpenAICompatible({
            provider: 'openai',
            userPrompt: buildChatUserPrompt(messages),
            systemPrompt: withInjectedSourceContext(CHAT_ASSISTANT_SYSTEM_PROMPT),
            modelOverride: getPreferredChatModel('openai'),
        });
    },

    generateTasksFromCompiledPromptText(compiledPrompt) {
        return requestOpenAICompatible({
            provider: 'openai',
            userPrompt: compiledPrompt,
            systemPrompt: withInjectedSourceContext(BASE_SYSTEM_PROMPT),
        });
    },
};

const localAdapter: ProviderAdapter = {
    generateTasksText(options) {
        return requestOpenAICompatible({
            provider: 'local',
            userPrompt: buildGenerateUserPrompt(options),
            systemPrompt: withInjectedSourceContext(buildSystemPrompt({
                subjectName: options.subjectName,
                curriculumText: options.curriculumText,
                className: options.className,
                classCharacteristic: options.classCharacteristic,
            })),
            screenshotBase64: options.screenshotBase64,
        });
    },

    modifyTaskText(task, instruction) {
        return requestOpenAICompatible({
            provider: 'local',
            userPrompt: buildModifyUserPrompt(task, instruction),
            systemPrompt: withInjectedSourceContext(MODIFY_SYSTEM_PROMPT),
        });
    },

    chatAssistantText(messages) {
        return requestOpenAICompatible({
            provider: 'local',
            userPrompt: buildChatUserPrompt(messages),
            systemPrompt: withInjectedSourceContext(CHAT_ASSISTANT_SYSTEM_PROMPT),
            modelOverride: getPreferredChatModel('local'),
        });
    },

    generateTasksFromCompiledPromptText(compiledPrompt) {
        return requestOpenAICompatible({
            provider: 'local',
            userPrompt: compiledPrompt,
            systemPrompt: withInjectedSourceContext(BASE_SYSTEM_PROMPT),
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

3. Mathematik-Formel:
{
  "type": "math",
  "title": "Aufgabe: ...",
  "content": "a^2 + b^2 = c^2"
}

Optionales Attribut "linesAfter" – Schreibzeilen nach einer Aufgabe:
Wenn eine Aufgabe Platz zum Schreiben benötigt, füge dem Aufgaben-Objekt das Feld "linesAfter" hinzu.
Beispiel – Lückentext MIT angehängten Schreibzeilen:
{
  "type": "cloze",
  "title": "Aufgabe: Vervollständige den Satz.",
  "content": "Die [Sonne] scheint jeden [Tag].",
  "linesAfter": 4,
  "linesAfterStyle": "lines-8mm"
}
Erlaubte Werte für "linesAfterStyle": "lines-8mm" (Standard), "primary-4-lines" (Klasse 1-2), "grid-5mm", "grid-10mm".
"linesAfter" ist die Zeilenanzahl (1-10). Nutze es NUR, wenn die Aufgabe explizit Schreibplatz erfordert.

STRIKTE RESTRIKTION – KEINE isolierten Lineatur-Blöcke:
- Generiere NIEMALS Objekte mit "type": "lineatur" als eigenständigen Block.
- Schreibzeilen/Lineaturen dürfen AUSSCHLIESSLICH als Eigenschaft ("linesAfter") einer konkreten Aufgabe existieren.
- Wenn du Schreibplatz für eine Aufgabe benötigst, füge "linesAfter" und optional "linesAfterStyle" zum Aufgaben-Objekt hinzu.
- Leere Lineatur-Blöcke ohne zugehörige Aufgabe sind VERBOTEN und werden automatisch verworfen.

Regeln:
- Erstelle GENAU die Anzahl an Aufgaben, die der Benutzer angibt (Standard: 4-6 gemischte Aufgaben)
- Aufgaben müssen altersgerecht für die angegebene Klassenstufe sein
- Formuliere klar und eindeutig auf Deutsch
- Multiple-Choice: immer genau 4 Optionen, genau 1 richtig
- Lückentext: markiere Lücken mit [Wort]
- Schreibzeilen: nutze "linesAfter" mit "lines-8mm" für ältere Schüler, "primary-4-lines" für Klasse 1-2
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

/** Baut den System-Prompt mit optionalem Lehrplan-Kontext + Profildaten */
function buildSystemPrompt(options?: {
    subjectName?: string;
    curriculumText?: string;
    className?: string;
    classCharacteristic?: string;
}): string {
    const { curriculumContext } = useSettingsStore.getState();
    const parts: string[] = [];

    if (options?.subjectName || options?.className) {
        let profilePrompt = 'Erstelle Aufgaben';
        if (options.subjectName) {
            profilePrompt += ` für ${options.subjectName}`;
        }
        if (options.curriculumText) {
            profilePrompt += ` unter Berücksichtigung von: ${options.curriculumText}`;
        }
        if (options.className) {
            profilePrompt += ` für die Klasse ${options.className}`;
            if (options.classCharacteristic) {
                profilePrompt += `, die ${options.classCharacteristic} ist`;
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
    const { id: removedId, ...taskData } = task;
    void removedId;

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

async function generateTaskRevisionText(userPrompt: string): Promise<string> {
    const { provider } = getActiveProviderState();

    if (provider === 'gemini') {
        try {
            const model = getGeminiModel(getPreferredChatModel('gemini'));
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                systemInstruction: withInjectedSourceContext(TASK_REVISION_SYSTEM_PROMPT),
            });
            return result.response.text();
        } catch (error) {
            throw normalizeProviderError('gemini', error);
        }
    }

    return requestOpenAICompatible({
        provider,
        userPrompt,
        systemPrompt: withInjectedSourceContext(TASK_REVISION_SYSTEM_PROMPT),
        modelOverride: getPreferredChatModel(provider),
    });
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

/* ── Hilfsfunktion: JSON aus KI-Antwort extrahieren ── */
function extractJSON(text: string): string {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) return codeBlockMatch[1].trim();

    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) return arrayMatch[0];

    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) return objMatch[0];

    return text.trim();
}

function normalizeClozePlaceholders(content: string): string {
    return content.replace(/\{\{(.*?)\}\}/g, '[$1]');
}

import type { LineStyle } from '../types/worksheet';

/* ── Hilfs-Konstante: erlaubte linesAfterStyle-Werte ── */
const VALID_LINE_STYLES: LineStyle[] = ['grid-5mm', 'grid-10mm', 'lines-8mm', 'primary-4-lines'];

/**
 * Extrahiert linesAfter / linesAfterStyle aus einem rohen KI-Item und gibt
 * ein partielles Objekt zurück, das auf den Task gemergt werden kann.
 */
function extractLinesAfterFields(item: Record<string, unknown>): { linesAfter?: number; linesAfterStyle?: LineStyle } {
    const result: { linesAfter?: number; linesAfterStyle?: LineStyle } = {};
    if (typeof item.linesAfter === 'number' && item.linesAfter >= 1 && item.linesAfter <= 20) {
        result.linesAfter = Math.round(item.linesAfter);
    }
    if (typeof item.linesAfterStyle === 'string' && VALID_LINE_STYLES.includes(item.linesAfterStyle as LineStyle)) {
        result.linesAfterStyle = item.linesAfterStyle as LineStyle;
    }
    return result;
}

/**
 * Marker-Interface für verwaiste Lineatur-Blöcke, die der Merge-Pass
 * nachträglich in das linesAfter-Feld des vorhergehenden Tasks überführt.
 */
interface OrphanedLineatur {
    __orphanedLineatur: true;
    lineRows: number;
    lineStyle: LineStyle;
}

/** Validiert und normalisiert Tasks aus der KI-Antwort */
function validateAndNormalizeTasks(raw: unknown[]): Omit<Task, 'id'>[] {
    type ParsedItem = Omit<Task, 'id'> | OrphanedLineatur | null;

    // ── Pass 1: Parse jedes Item ──
    const items = raw
        .filter((item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null && 'type' in item
        );

    const parsed: ParsedItem[] = [];
    for (const item of items) {
        const type = item.type as string;
        const linesFields = extractLinesAfterFields(item);

        switch (type) {
            case 'multiple-choice':
                parsed.push({
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
                    ...linesFields,
                } as Omit<Task, 'id'>);
                break;

            case 'cloze': {
                const content = normalizeClozePlaceholders(String(item.content || ''));
                // Cloze → Math-Konvertierung (LaTeX-Erkennung)
                const mathMatch = content.match(/^\$\$(.+)\$\$$/s);
                if (mathMatch) {
                    parsed.push({
                        type: 'math' as const,
                        title: String(item.title || 'Lückentext'),
                        content: mathMatch[1].trim(),
                        ...linesFields,
                    } as Omit<Task, 'id'>);
                } else {
                    parsed.push({
                        type: 'cloze' as const,
                        title: String(item.title || 'Lückentext'),
                        content,
                        ...linesFields,
                    } as Omit<Task, 'id'>);
                }
                break;
            }

            case 'lineatur': {
                // ── Verwaiste Lineatur: nicht als Task akzeptieren, sondern
                //    als Merge-Kandidat für den nachfolgenden Pass markieren. ──
                const lineRows = typeof item.lineRows === 'number' ? Math.max(1, Math.min(20, Math.round(item.lineRows))) : 4;
                const lineStyle = (VALID_LINE_STYLES.includes(String(item.lineStyle) as LineStyle)
                    ? String(item.lineStyle)
                    : 'lines-8mm') as LineStyle;
                parsed.push({
                    __orphanedLineatur: true,
                    lineRows,
                    lineStyle,
                } as OrphanedLineatur);
                break;
            }

            case 'math':
                parsed.push({
                    type: 'math' as const,
                    title: String(item.title || 'Mathematik'),
                    content: String(item.content || ''),
                    ...linesFields,
                } as Omit<Task, 'id'>);
                break;

            default:
                // Unbekannter Typ → überspringen
                break;
        }
    }

    // ── Pass 2: Verwaiste Lineaturen in vorhergehenden Task mergen ──
    const result: Omit<Task, 'id'>[] = [];
    for (const item of parsed) {
        if (item === null) continue;

        if ('__orphanedLineatur' in item) {
            // Orphaned lineatur block → merge linesAfter into preceding task
            const orphan = item as OrphanedLineatur;
            if (result.length > 0) {
                const prev = result[result.length - 1];
                // Addiere Zeilen falls bereits linesAfter vorhanden (z. B. mehrere Lineaturen hintereinander)
                const existingLines = (prev as { linesAfter?: number }).linesAfter ?? 0;
                (prev as Record<string, unknown>).linesAfter = Math.min(20, existingLines + orphan.lineRows);
                if (!(prev as { linesAfterStyle?: string }).linesAfterStyle) {
                    (prev as Record<string, unknown>).linesAfterStyle = orphan.lineStyle;
                }
            }
            // Verwaiste Lineatur ohne vorhergehenden Task wird stillschweigend verworfen
            continue;
        }

        result.push(item as Omit<Task, 'id'>);
    }

    return result;
}

/** Validiert eine einzelne modifizierte Task */
function validateSingleTask(raw: Record<string, unknown>, originalType: string): Omit<Task, 'id'> | null {
    const tasks = validateAndNormalizeTasks([{ ...raw, type: originalType }]);
    return tasks.length > 0 ? tasks[0] : null;
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
}

export async function generateTasks(options: GenerateTasksOptions): Promise<Omit<Task, 'id'>[]> {
    const responseText = await getAdapter().generateTasksText(options);
    const jsonStr = extractJSON(responseText);

    let parsed: unknown[];
    try {
        parsed = JSON.parse(jsonStr);
    } catch {
        throw new Error(`KI hat kein valides JSON zurückgegeben:\n${responseText.substring(0, 500)}`);
    }

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
    const jsonStr = extractJSON(responseText);

    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(jsonStr);
    } catch {
        throw new Error(`KI hat kein valides JSON zurückgegeben:\n${responseText.substring(0, 500)}`);
    }

    const modified = validateSingleTask(parsed, task.type);
    if (!modified) {
        throw new Error('Die modifizierte Aufgabe konnte nicht validiert werden.');
    }

    return modified;
}

export async function generateTaskRevisionResult(
    messages: ChatMessage[],
    tasksById: Record<string, Task>,
    taskIds: string[],
    sources: WorksheetSource[],
    aiClassContext?: AIClassContext,
): Promise<TaskRevisionResult> {
    const cleanedMessages = messages.filter((message) => message.content.trim().length > 0);
    if (cleanedMessages.length === 0) {
        return { operations: [] };
    }

    const userPrompt = buildTaskRevisionUserPrompt({
        messages: cleanedMessages,
        tasksById,
        taskIds,
        sources,
        aiClassContext,
    });

    const responseText = await generateTaskRevisionText(userPrompt);
    const jsonStr = extractJSON(responseText);

    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonStr);
    } catch {
        if (looksLikeTruncatedJson(responseText) || looksLikeTruncatedJson(jsonStr)) {
            throw new Error(AI_JSON_TRUNCATED_USER_MESSAGE);
        }
        throw new Error(`KI hat keine validen Änderungsoperationen zurückgegeben:\n${responseText.substring(0, 500)}`);
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { operations: [] };
    }

    return {
        operations: parseTaskRevisionOperations((parsed as { operations?: unknown }).operations, tasksById, taskIds),
    };
}

export async function generateChatAssistantReply(
    messages: ChatMessage[],
    aiClassContext?: AIClassContext,
): Promise<string> {
    void aiClassContext;
    const cleaned = messages.filter((message) => message.content.trim().length > 0);
    if (cleaned.length === 0) {
        return 'Gerne. Womit soll ich dir für dein Arbeitsblatt helfen (Thema, Klasse, Aufgabentypen)?';
    }

    const responseText = await getAdapter().chatAssistantText(cleaned);
    return responseText.trim();
}

export async function generateTasksFromCompiledPrompt(compiledPrompt: string): Promise<Omit<Task, 'id'>[]> {
    const responseText = await getAdapter().generateTasksFromCompiledPromptText(compiledPrompt);
    const jsonStr = extractJSON(responseText);

    let parsed: unknown[];
    try {
        parsed = JSON.parse(jsonStr);
    } catch {
        throw new Error(`KI hat kein valides JSON zurückgegeben:\n${responseText.substring(0, 500)}`);
    }

    if (!Array.isArray(parsed)) {
        throw new Error('KI-Antwort ist kein Array.');
    }

    const tasks = validateAndNormalizeTasks(parsed);
    if (tasks.length === 0) {
        throw new Error('Keine gültigen Aufgaben in der KI-Antwort gefunden.');
    }

    return tasks;
}
