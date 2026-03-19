import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import type { Task, WorksheetSource } from '../types/worksheet';
import { useSettingsStore, type AIProvider } from '../store/settingsStore';
import { useSourceStore } from '../store/sourceStore';
import { PROVIDER_LABELS, PROVIDER_MODEL_OPTIONS, type ProviderModelOption } from './ai/modelCatalog';
import { filterModelOptions } from './ai/modelFilter';
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
   Einheitlicher Einstieg für Gemini, OpenAI, OpenRouter, Local.
   ══════════════════════════════════════════════════ */

interface ProviderAdapter {
    generateTasksText: (options: GenerateTasksOptions) => Promise<string>;
    modifyTaskText: (task: Task, instruction: string) => Promise<string>;
    chatAssistantText: (messages: ChatMessage[]) => Promise<string>;
    generateTasksFromCompiledPromptText: (compiledPrompt: string) => Promise<string>;
    listModels: () => Promise<ProviderModelOption[]>;
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
            modelOverride: getPreferredChatModel(provider),
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
    if (provider === 'openrouter') {
        return 'Kein OpenRouter API-Key gesetzt. Bitte zuerst in den Einstellungen hinterlegen.';
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

function getCandidateBaseUrls(baseUrl: string, provider: 'openai' | 'openrouter' | 'local'): string[] {
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

interface OpenAICompatibleModelsResponse {
    data?: Array<{ id?: string }>;
}

interface GeminiModelEntry {
    name?: string;
    displayName?: string;
    description?: string;
    supportedGenerationMethods?: string[];
}

interface GeminiModelsResponse {
    models?: GeminiModelEntry[];
}

const EXPLICIT_GEMINI_MODEL_IDS = new Set(
    PROVIDER_MODEL_OPTIONS.gemini.map((option) => option.value.toLowerCase()),
);

function normalizeOpenAICompatibleBaseUrl(provider: 'openai' | 'openrouter', baseUrl: string | undefined): string {
    const trimmed = (baseUrl ?? '').trim().replace(/\/$/, '');
    if (!trimmed) {
        return provider === 'openrouter'
            ? 'https://openrouter.ai/api/v1'
            : 'https://api.openai.com/v1';
    }
    if (/\/v1$/i.test(trimmed)) return trimmed;
    return `${trimmed}/v1`;
}

function normalizeLocalBaseUrl(baseUrl: string | undefined): string {
    const trimmed = (baseUrl ?? '').trim().replace(/\/$/, '');
    if (!trimmed) return '';
    if (/\/v1$/i.test(trimmed)) return trimmed;
    return `${trimmed}/v1`;
}

function normalizeGeminiModelName(rawName: string): string {
    return rawName.replace(/^models\//, '');
}

function isLikelyOpenAIChatModel(id: string): boolean {
    const normalized = id.toLowerCase();
    return (
        normalized.startsWith('gpt-') ||
        normalized.includes('o3') ||
        normalized.includes('o4') ||
        normalized.includes('reasoning')
    );
}

function isGeminiTextModel(entry: GeminiModelEntry): boolean {
    const rawName = entry.name ?? '';
    const modelName = normalizeGeminiModelName(rawName).toLowerCase();
    const methods = entry.supportedGenerationMethods ?? [];

    const supportsGenerateContent = methods.some((method) => method.toLowerCase() === 'generatecontent');
    if (!supportsGenerateContent) return false;

    const match = modelName.match(/^gemini-(\d+(?:\.\d+)?)-(flash(?:-lite)?|pro)(?:-[a-z0-9-]+)?$/);
    if (!match) return false;
    if (!EXPLICIT_GEMINI_MODEL_IDS.has(modelName)) return false;

    const version = Number.parseFloat(match[1]);
    return Number.isFinite(version) && version >= 2.5;
}

function mapGeminiModelToOption(entry: GeminiModelEntry): ProviderModelOption | null {
    const rawName = (entry.name ?? '').trim();
    if (!rawName) return null;

    const value = normalizeGeminiModelName(rawName);
    return {
        value,
        label: entry.displayName?.trim() || value,
        desc: entry.description?.trim() || 'Automatisch via API erkannt',
    };
}

function getGeminiModelSortMeta(modelValue: string): { version: number; tier: number } {
    const normalized = modelValue.toLowerCase();
    const match = normalized.match(/^gemini-(\d+(?:\.\d+)?)-(flash(?:-lite)?|pro)(?:-[a-z0-9-]+)?$/);
    if (!match) return { version: -1, tier: 99 };

    const version = Number.parseFloat(match[1]);
    const family = match[2];
    const tier = family === 'pro' ? 0 : family === 'flash' ? 1 : 2;

    return { version: Number.isFinite(version) ? version : -1, tier };
}

function mapModelIdsToOptions(ids: string[]): ProviderModelOption[] {
    return filterModelOptions(
        ids.map((id) => ({
            value: id,
            label: id,
            desc: 'Vom lokalen Server erkannt',
        })),
    );
}

async function listGeminiModelOptions(): Promise<ProviderModelOption[]> {
    const { providers } = useSettingsStore.getState();
    const apiKey = providers.gemini.apiKey?.trim() ?? '';

    if (!apiKey) {
        throw new Error('Kein API-Key gesetzt.');
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as GeminiModelsResponse;
        const options = (payload.models ?? [])
            .filter(isGeminiTextModel)
            .map(mapGeminiModelToOption)
            .filter((option): option is ProviderModelOption => Boolean(option));

        const deduped = Array.from(new Map(options.map((option) => [option.value, option])).values())
            .sort((a, b) => {
                const metaA = getGeminiModelSortMeta(a.value);
                const metaB = getGeminiModelSortMeta(b.value);

                if (metaA.version !== metaB.version) {
                    return metaB.version - metaA.version;
                }

                if (metaA.tier !== metaB.tier) {
                    return metaA.tier - metaB.tier;
                }

                return a.value.localeCompare(b.value);
            });

        const filtered = filterModelOptions(deduped);
        if (filtered.length === 0) {
            throw new Error('Keine passenden Gemini-Modelle gefunden.');
        }

        return filtered;
    } catch (error) {
        if (error instanceof Error && (
            error.message === 'Kein API-Key gesetzt.' ||
            error.message === 'Keine passenden Gemini-Modelle gefunden.'
        )) {
            throw error;
        }

        throw new Error('Gemini-Modelle konnten nicht automatisch geladen werden.');
    }
}

async function listOpenAIModelOptions(): Promise<ProviderModelOption[]> {
    const { providers } = useSettingsStore.getState();
    const config = providers.openai;
    const apiKey = config.apiKey?.trim() ?? '';

    if (!apiKey) {
        throw new Error('Kein API-Key gesetzt.');
    }

    try {
        const baseUrl = normalizeOpenAICompatibleBaseUrl('openai', config.baseUrl);
        const candidateBaseUrls = getCandidateBaseUrls(baseUrl, 'openai');
        let payload: OpenAICompatibleModelsResponse | null = null;
        let responseOk = false;

        for (const candidateBaseUrl of candidateBaseUrls) {
            try {
                const response = await fetch(`${candidateBaseUrl}/models`, {
                    headers: { Authorization: `Bearer ${apiKey}` },
                });

                if (!response.ok) continue;

                payload = (await response.json()) as OpenAICompatibleModelsResponse;
                responseOk = true;
                break;
            } catch {
                continue;
            }
        }

        if (!responseOk || !payload) {
            throw new Error('openai-models-unreachable');
        }

        const ids = (payload.data ?? [])
            .map((entry) => entry.id?.trim() ?? '')
            .filter(Boolean)
            .filter(isLikelyOpenAIChatModel);

        if (ids.length === 0) {
            throw new Error('Keine passenden Chat-Modelle gefunden.');
        }

        const uniqueSorted = Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
        const options = filterModelOptions(
            uniqueSorted.map((id) => ({
                value: id,
                label: id,
                desc: 'Automatisch via API erkannt',
            })),
        );

        if (options.length === 0) {
            throw new Error('Keine passenden Chat-Modelle gefunden.');
        }

        return options;
    } catch (error) {
        if (error instanceof Error && (
            error.message === 'Kein API-Key gesetzt.' ||
            error.message === 'Keine passenden Chat-Modelle gefunden.'
        )) {
            throw error;
        }

        throw new Error('Modelle konnten nicht automatisch geladen werden.');
    }
}

async function listOpenRouterModelOptions(): Promise<ProviderModelOption[]> {
    const { providers } = useSettingsStore.getState();
    const config = providers.openrouter;
    const apiKey = config.apiKey?.trim() ?? '';

    if (!apiKey) {
        throw new Error('Kein API-Key gesetzt.');
    }

    try {
        const baseUrl = normalizeOpenAICompatibleBaseUrl('openrouter', config.baseUrl);
        const candidateBaseUrls = getCandidateBaseUrls(baseUrl, 'openrouter');
        let payload: OpenAICompatibleModelsResponse | null = null;
        let responseOk = false;

        for (const candidateBaseUrl of candidateBaseUrls) {
            try {
                const response = await fetch(`${candidateBaseUrl}/models`, {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
                        'X-Title': 'AB-Generator',
                    },
                });

                if (!response.ok) continue;

                payload = (await response.json()) as OpenAICompatibleModelsResponse;
                responseOk = true;
                break;
            } catch {
                continue;
            }
        }

        if (!responseOk || !payload) {
            throw new Error('openrouter-models-unreachable');
        }

        const ids = (payload.data ?? [])
            .map((entry) => entry.id?.trim() ?? '')
            .filter(Boolean);

        if (ids.length === 0) {
            throw new Error('Keine passenden Chat-Modelle gefunden.');
        }

        const uniqueSorted = Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
        const options = filterModelOptions(
            uniqueSorted.map((id) => ({
                value: id,
                label: id,
                desc: 'Automatisch via API erkannt',
            })),
        );

        if (options.length === 0) {
            throw new Error('Keine passenden Chat-Modelle gefunden.');
        }

        return options;
    } catch (error) {
        if (error instanceof Error && (
            error.message === 'Kein API-Key gesetzt.' ||
            error.message === 'Keine passenden Chat-Modelle gefunden.'
        )) {
            throw error;
        }

        throw new Error('Modelle konnten nicht automatisch geladen werden.');
    }
}

async function listLocalModelOptions(): Promise<ProviderModelOption[]> {
    const { providers } = useSettingsStore.getState();
    const config = providers.local;
    const baseUrl = normalizeLocalBaseUrl(config.baseUrl);

    if (!baseUrl) {
        throw new Error('Keine Base-URL gesetzt.');
    }

    try {
        const candidateBaseUrls = getCandidateBaseUrls(baseUrl, 'local');
        let payload: OpenAICompatibleModelsResponse | null = null;
        let connected = false;

        for (const candidateBaseUrl of candidateBaseUrls) {
            try {
                const response = await fetch(`${candidateBaseUrl}/models`, {
                    headers: config.apiKey?.trim()
                        ? { Authorization: `Bearer ${config.apiKey}` }
                        : undefined,
                });

                if (!response.ok) continue;

                payload = (await response.json()) as OpenAICompatibleModelsResponse;
                connected = true;
                break;
            } catch {
                continue;
            }
        }

        if (!connected || !payload) {
            throw new Error('local-models-unreachable');
        }

        const ids = (payload.data ?? [])
            .map((entry) => entry.id?.trim() ?? '')
            .filter(Boolean);

        if (ids.length === 0) {
            throw new Error('Keine Modelle gefunden.');
        }

        const uniqueSorted = Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
        return mapModelIdsToOptions(uniqueSorted);
    } catch (error) {
        if (error instanceof Error && (
            error.message === 'Keine Base-URL gesetzt.' ||
            error.message === 'Keine Modelle gefunden.'
        )) {
            throw error;
        }

        throw new Error('Lokalen Server nicht erreicht. Tipp: im Dev-Container statt 127.0.0.1 ggf. host.docker.internal nutzen.');
    }
}

async function requestOpenAICompatible(params: {
    provider: 'openai' | 'openrouter' | 'local';
    userPrompt: string;
    systemPrompt: string;
    screenshotBase64?: string;
    modelOverride?: string;
    signal?: AbortSignal;
}): Promise<string> {
    const config = requireProviderConfig(params.provider);
    const baseUrl = (
        config.baseUrl
        || (params.provider === 'openai'
            ? 'https://api.openai.com/v1'
            : params.provider === 'openrouter'
                ? 'https://openrouter.ai/api/v1'
                : '')
    ).replace(/\/$/, '');

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
    if (params.provider === 'openrouter') {
        headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
        headers['X-Title'] = 'AB-Generator';
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
                signal: params.signal,
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

    listModels() {
        return listGeminiModelOptions();
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

    listModels() {
        return listOpenAIModelOptions();
    },
};

const openRouterAdapter: ProviderAdapter = {
    generateTasksText(options) {
        return requestOpenAICompatible({
            provider: 'openrouter',
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
            provider: 'openrouter',
            userPrompt: buildModifyUserPrompt(task, instruction),
            systemPrompt: withInjectedSourceContext(MODIFY_SYSTEM_PROMPT),
        });
    },

    chatAssistantText(messages) {
        return requestOpenAICompatible({
            provider: 'openrouter',
            userPrompt: buildChatUserPrompt(messages),
            systemPrompt: withInjectedSourceContext(CHAT_ASSISTANT_SYSTEM_PROMPT),
            modelOverride: getPreferredChatModel('openrouter'),
        });
    },

    generateTasksFromCompiledPromptText(compiledPrompt) {
        return requestOpenAICompatible({
            provider: 'openrouter',
            userPrompt: compiledPrompt,
            systemPrompt: withInjectedSourceContext(BASE_SYSTEM_PROMPT),
        });
    },

    listModels() {
        return listOpenRouterModelOptions();
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

    listModels() {
        return listLocalModelOptions();
    },
};

const ADAPTERS: Record<AIProvider, ProviderAdapter> = {
    gemini: geminiAdapter,
    openai: openaiAdapter,
    openrouter: openRouterAdapter,
    local: localAdapter,
};

function getAdapter(): ProviderAdapter {
    const { provider } = getActiveProviderState();
    return ADAPTERS[provider];
}

export async function listProviderModels(provider: AIProvider): Promise<ProviderModelOption[]> {
    return ADAPTERS[provider].listModels();
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

/** Maximum number of recent messages to send for the conversational path */
const MAX_CHAT_CONTEXT_MESSAGES = 12;
/** Maximum characters per single message in the chat transcript */
const MAX_CHAT_MESSAGE_CHARS = 2000;

function buildChatUserPrompt(messages: ChatMessage[]): string {
    // Limit to recent messages to avoid context overload
    const recent = messages.slice(-MAX_CHAT_CONTEXT_MESSAGES);
    const transcript = recent
        .map((message) => {
            const label = message.role === 'user' ? 'Lehrkraft' : 'Assistent';
            const content = message.content.length > MAX_CHAT_MESSAGE_CHARS
                ? message.content.slice(0, MAX_CHAT_MESSAGE_CHARS) + ' [… gekürzt]'
                : message.content;
            return `${label}: ${content}`;
        })
        .join('\n\n');

    return `Aktueller Chatverlauf:\n${transcript}\n\nAntworte als nächster Assistenten-Beitrag auf die letzte Lehrkraft-Nachricht.`;
}

async function generateTaskRevisionText(userPrompt: string, signal?: AbortSignal): Promise<string> {
    const { provider } = getActiveProviderState();

    if (provider === 'gemini') {
        try {
            const model = getGeminiModel(getPreferredChatModel('gemini'));
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                systemInstruction: withInjectedSourceContext(TASK_REVISION_SYSTEM_PROMPT),
            });
            signal?.throwIfAborted();
            return result.response.text();
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') throw error;
            throw normalizeProviderError('gemini', error);
        }
    }

    return requestOpenAICompatible({
        provider,
        userPrompt,
        systemPrompt: withInjectedSourceContext(TASK_REVISION_SYSTEM_PROMPT),
        modelOverride: getPreferredChatModel(provider),
        signal,
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
    signal?: AbortSignal,
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

    signal?.throwIfAborted();
    const responseText = await generateTaskRevisionText(userPrompt, signal);
    signal?.throwIfAborted();
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
    signal?: AbortSignal,
): Promise<string> {
    void aiClassContext;
    const cleaned = messages.filter((message) => message.content.trim().length > 0);
    if (cleaned.length === 0) {
        return 'Gerne. Womit soll ich dir für dein Arbeitsblatt helfen (Thema, Klasse, Aufgabentypen)?';
    }

    signal?.throwIfAborted();
    const responseText = await getAdapter().chatAssistantText(cleaned);
    signal?.throwIfAborted();
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
