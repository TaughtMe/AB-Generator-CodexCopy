import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import type { Task, WorksheetSource } from '../types/worksheet';
import { useSettingsStore, type AIProvider } from '../store/settingsStore';
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
            });
            return { ok: true };
        }

        await requestOpenAICompatible({
            provider,
            userPrompt: 'Antworte nur mit OK.',
            systemPrompt: 'Antworte nur mit OK.',
            modelOverride: provider === 'openai' ? getPreferredChatModel('openai') : getPreferredChatModel('local'),
        });
        return { ok: true };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : 'Verbindungstest fehlgeschlagen.',
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
            }),
        });

        return result.response.text();
    },

    async modifyTaskText(task, instruction) {
        const model = getGeminiModel();
        const userPrompt = buildModifyUserPrompt(task, instruction);

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemInstruction: MODIFY_SYSTEM_PROMPT,
        });

        return result.response.text();
    },

    async chatAssistantText(messages) {
        const model = getGeminiModel(getPreferredChatModel('gemini'));
        const userPrompt = buildChatUserPrompt(messages);

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemInstruction: CHAT_ASSISTANT_SYSTEM_PROMPT,
        });

        return result.response.text();
    },

    async generateTasksFromCompiledPromptText(compiledPrompt) {
        const model = getGeminiModel();
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: compiledPrompt }] }],
            systemInstruction: BASE_SYSTEM_PROMPT,
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
            }),
            screenshotBase64: options.screenshotBase64,
        });
    },

    modifyTaskText(task, instruction) {
        return requestOpenAICompatible({
            provider: 'openai',
            userPrompt: buildModifyUserPrompt(task, instruction),
            systemPrompt: MODIFY_SYSTEM_PROMPT,
        });
    },

    chatAssistantText(messages) {
        return requestOpenAICompatible({
            provider: 'openai',
            userPrompt: buildChatUserPrompt(messages),
            systemPrompt: CHAT_ASSISTANT_SYSTEM_PROMPT,
            modelOverride: getPreferredChatModel('openai'),
        });
    },

    generateTasksFromCompiledPromptText(compiledPrompt) {
        return requestOpenAICompatible({
            provider: 'openai',
            userPrompt: compiledPrompt,
            systemPrompt: BASE_SYSTEM_PROMPT,
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
            }),
            screenshotBase64: options.screenshotBase64,
        });
    },

    modifyTaskText(task, instruction) {
        return requestOpenAICompatible({
            provider: 'local',
            userPrompt: buildModifyUserPrompt(task, instruction),
            systemPrompt: MODIFY_SYSTEM_PROMPT,
        });
    },

    chatAssistantText(messages) {
        return requestOpenAICompatible({
            provider: 'local',
            userPrompt: buildChatUserPrompt(messages),
            systemPrompt: CHAT_ASSISTANT_SYSTEM_PROMPT,
            modelOverride: getPreferredChatModel('local'),
        });
    },

    generateTasksFromCompiledPromptText(compiledPrompt) {
        return requestOpenAICompatible({
            provider: 'local',
            userPrompt: compiledPrompt,
            systemPrompt: BASE_SYSTEM_PROMPT,
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
  "lineStyle": "lines-8mm",
  "gridColumns": 32
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

async function generateTaskRevisionText(userPrompt: string): Promise<string> {
    const { provider } = getActiveProviderState();

    if (provider === 'gemini') {
        const model = getGeminiModel(getPreferredChatModel('gemini'));
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemInstruction: TASK_REVISION_SYSTEM_PROMPT,
        });
        return result.response.text();
    }

    return requestOpenAICompatible({
        provider,
        userPrompt,
        systemPrompt: TASK_REVISION_SYSTEM_PROMPT,
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
                        lineStyle: (['grid-5mm', 'grid-10mm', 'lines-8mm', 'primary-4-lines'].includes(String(item.lineStyle))
                            ? String(item.lineStyle)
                            : 'lines-8mm') as Task extends { lineStyle: infer L } ? L : never,
                        gridColumns: typeof item.gridColumns === 'number' ? item.gridColumns : 32,
                    };

                case 'math':
                    return {
                        type: 'math' as const,
                        title: String(item.title || 'Mathematik'),
                        content: String(item.content || ''),
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
