import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { z } from 'zod';
import type { Task, WorksheetSource } from '../types/worksheet';
import { useSettingsStore, type AIProvider } from '../store/settingsStore';
import { useSourceStore } from '../store/sourceStore';
import { PROVIDER_LABELS, PROVIDER_MODEL_OPTIONS, type ProviderModelOption } from './ai/modelCatalog';
import { filterModelOptions } from './ai/modelFilter';
import { getActiveAiEndpoint, type ActiveAiEndpoint } from './ai/activeEndpoint';
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
export const MICRO_AI_TRUNCATION_USER_MESSAGE =
    'Die KI-Antwort wurde unerwartet abgebrochen. Bitte versuche es erneut.';

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

/**
 * Run-scoped Modell-Override (von runAI über runWithModelOverride gesetzt).
 * Wenn gesetzt, steuert er den tatsächlichen Provider-Call – so wirkt die
 * Rollen→Modell-Auswahl der Modellbibliothek echt und nicht nur in der
 * Telemetrie. Wird in getPreferredChatModel sowie an den beiden Provider-
 * Chokepoints (getGeminiModel, requestOpenAICompatible) berücksichtigt.
 *
 * Die KI-Aufrufe der App sind effektiv serialisiert (laufende Anfragen
 * werden vor neuen abgebrochen); save/restore via finally trägt zudem
 * verschachtelte Aufrufe.
 */
let currentModelOverride: string | null = null;

export async function runWithModelOverride<T>(
    model: string | undefined,
    fn: () => Promise<T>,
): Promise<T> {
    const override = model?.trim();
    if (!override) return fn();

    const previous = currentModelOverride;
    currentModelOverride = override;
    try {
        return await fn();
    } finally {
        currentModelOverride = previous;
    }
}

function getPreferredChatModel(provider: AIProvider): string {
    if (currentModelOverride) return currentModelOverride;

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
    const endpoint = getActiveAiEndpoint();
    if (endpoint) return endpoint.providerName;
    const { provider } = getActiveProviderState();
    return PROVIDER_LABELS[provider];
}

/**
 * Aktiver Provider + effektiv genutztes Chat-Modell – für die runAI-Telemetrie
 * (Route → provider/model). Kapselt die internen Helfer, ohne sie zu exportieren.
 */
export function getActiveModelInfo(): { provider: AIProvider; model: string } {
    const endpoint = getActiveAiEndpoint();
    const { provider } = getActiveProviderState();
    // Bei aktivem Custom-Endpoint ist das echte Modell dessen model (provider-Feld
    // bleibt der eingebaute Typ, da AIProvider die Custom-Anbieter nicht kennt).
    return { provider, model: endpoint ? endpoint.model : getPreferredChatModel(provider) };
}

export function isActiveProviderConfigured(): boolean {
    // Aktiver Custom-Provider-Endpoint (KI-Tab) gilt als konfiguriert.
    if (getActiveAiEndpoint()) return true;

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
    return genAI.getGenerativeModel({ model: modelOverride ?? currentModelOverride ?? config.model });
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
    maxTokens?: number;
    signal?: AbortSignal;
    /** Wenn gesetzt: aktiver Custom-Provider-Endpoint statt eingebauter Providerkonfiguration. */
    endpoint?: ActiveAiEndpoint;
}): Promise<string> {
    const { endpoint } = params;
    const config = endpoint ? null : requireProviderConfig(params.provider);

    const rawBaseUrl = endpoint
        ? endpoint.baseUrl
        : (config!.baseUrl
            || (params.provider === 'openai'
                ? 'https://api.openai.com/v1'
                : params.provider === 'openrouter'
                    ? 'https://openrouter.ai/api/v1'
                    : ''));
    const baseUrl = rawBaseUrl.replace(/\/$/, '');
    const apiKey = endpoint ? endpoint.apiKey : config!.apiKey;
    // Custom-Endpoint erzwingt sein Modell; sonst greift die bestehende Override-Kette.
    const modelToUse = endpoint
        ? endpoint.model
        : (params.modelOverride ?? currentModelOverride ?? config!.model);

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

    if (apiKey?.trim()) {
        headers.Authorization = `Bearer ${apiKey}`;
    }
    if (!endpoint && params.provider === 'openrouter') {
        headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
        headers['X-Title'] = 'AB-Generator';
    }

    // Custom-Endpoints (häufig localhost) bekommen die local-Kandidatenliste (docker-Fallback).
    const candidateBaseUrls = getCandidateBaseUrls(baseUrl, endpoint ? 'local' : params.provider);
    let response: Response | null = null;
    let payload: unknown = null;

    for (const candidateBaseUrl of candidateBaseUrls) {
        try {
            const candidateResponse = await fetch(`${candidateBaseUrl}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: modelToUse,
                    max_tokens: params.maxTokens ?? 1500,
                    stream: false,
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

/**
 * One-Shot-Completion mit einheitlichem Provider-Routing für die direkten
 * (nicht adapterbasierten) KI-Funktionen (Revision, Komprimierung, JSON-Repair,
 * Export-Analyse, Vokabeln). Reihenfolge: aktiver Custom-Endpoint → Gemini-SDK
 * → OpenAI-kompatibel (eingebaut). Vermeidet, dass jede Funktion die Branch-Logik
 * dupliziert und das Custom-Endpoint-Routing vergisst.
 */
async function runOneShotCompletion(params: {
    userPrompt: string;
    systemPrompt: string;
    signal?: AbortSignal;
    maxTokens?: number;
}): Promise<string> {
    const endpoint = getActiveAiEndpoint();
    if (endpoint) {
        return requestOpenAICompatible({
            provider: 'local',
            endpoint,
            userPrompt: params.userPrompt,
            systemPrompt: params.systemPrompt,
            maxTokens: params.maxTokens,
            signal: params.signal,
        });
    }

    const { provider } = getActiveProviderState();
    if (provider === 'gemini') {
        const model = getGeminiModel(getPreferredChatModel('gemini'));
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: params.userPrompt }] }],
            systemInstruction: params.systemPrompt,
        });
        return result.response.text();
    }

    return requestOpenAICompatible({
        provider,
        userPrompt: params.userPrompt,
        systemPrompt: params.systemPrompt,
        modelOverride: getPreferredChatModel(provider),
        maxTokens: params.maxTokens,
        signal: params.signal,
    });
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
                generationConfig: { maxOutputTokens: 1500 },
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
            maxTokens: 1500,
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
            maxTokens: 1500,
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
            maxTokens: 1500,
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

/** OpenAI-kompatibler Adapter für einen aktiven Custom-Provider-Endpoint (KI-Tab). */
function createCustomEndpointAdapter(endpoint: ActiveAiEndpoint): ProviderAdapter {
    const call = (
        userPrompt: string,
        systemPrompt: string,
        extra?: { screenshotBase64?: string; maxTokens?: number },
    ) => requestOpenAICompatible({ provider: 'local', endpoint, userPrompt, systemPrompt, ...extra });

    return {
        generateTasksText: (options) => call(
            buildGenerateUserPrompt(options),
            withInjectedSourceContext(buildSystemPrompt({
                subjectName: options.subjectName,
                curriculumText: options.curriculumText,
                className: options.className,
                classCharacteristic: options.classCharacteristic,
            })),
            { screenshotBase64: options.screenshotBase64 },
        ),
        modifyTaskText: (task, instruction) => call(
            buildModifyUserPrompt(task, instruction),
            withInjectedSourceContext(MODIFY_SYSTEM_PROMPT),
            { maxTokens: 1500 },
        ),
        chatAssistantText: (messages) => call(
            buildChatUserPrompt(messages),
            withInjectedSourceContext(CHAT_ASSISTANT_SYSTEM_PROMPT),
        ),
        generateTasksFromCompiledPromptText: (compiledPrompt) => call(
            compiledPrompt,
            withInjectedSourceContext(BASE_SYSTEM_PROMPT),
        ),
        listModels: () => Promise.resolve([]),
    };
}

function getAdapter(): ProviderAdapter {
    // Aktiver Custom-Provider hat Vorrang vor der eingebauten Providerwahl.
    const endpoint = getActiveAiEndpoint();
    if (endpoint) return createCustomEndpointAdapter(endpoint);
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

4. Reihenfolge (Nummerierungsaufgabe – Elemente in die richtige Reihenfolge bringen):
{
  "type": "ordering",
  "title": "Aufgabe: ...",
  "prompt": "Bringe die Schritte in die richtige Reihenfolge.",
  "items": [
    { "text": "Wasser kochen", "correctPosition": 1 },
    { "text": "Teebeutel einlegen", "correctPosition": 2 },
    { "text": "Ziehen lassen", "correctPosition": 3 }
  ]
}
Regeln für "ordering": mindestens 2 Elemente; "correctPosition" ist 1-basiert und
bildet GENAU die Permutation 1..n (jede Position genau einmal). Liste die Elemente
ruhig in gemischter Reihenfolge; "correctPosition" definiert die Lösung.

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
Ändere nur den 'content'-Bereich. Halte die Formatierung exakt bei. Fasse dich extrem kurz, um Token zu sparen.
`;

const CHAT_ASSISTANT_SYSTEM_PROMPT = `Du bist ein didaktischer KI-Co-Pilot für Lehrkräfte.
DU BIST AUSSCHLIESSLICH DER PLANER. Deine einzige Aufgabe ist es, mit dem Lehrer die Struktur, das Thema und die Aufgabentypen zu definieren.

STRICKTES VERBOT: Generiere NIEMALS das finale Arbeitsblatt, keine Informationstexte, keine Lückentexte und keine konkreten Aufgaben im Chat!

SOBALD DIE PLANUNG STEHT: Schreibe exakt und nur diesen Satz: 'Die Planung ist abgeschlossen. Klicke nun unten auf den Button "Arbeitsblatt erstellen", damit ich die Inhalte generiere und in den Editor lade.'

Planungsfokus:
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
- Liefere niemals ausformulierte Aufgaben, keine Aufgabensammlungen und keinen finalen Arbeitsblatt-Content.
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
    try {
        const text = await runOneShotCompletion({
            userPrompt,
            systemPrompt: withInjectedSourceContext(TASK_REVISION_SYSTEM_PROMPT),
            signal,
        });
        signal?.throwIfAborted();
        return text;
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw normalizeProviderError(getActiveAiEndpoint() ? 'local' : getActiveProviderState().provider, error);
    }
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

type TeacherFields = Pick<
    Task,
    'solution' | 'hints' | 'points' | 'difficulty' | 'competence' | 'estimatedTime' | 'teacherNotes'
>;

/**
 * Extrahiert die optionalen Lehrer-/Differenzierungsfelder (Phase 8) aus einem
 * rohen KI-Item, damit sie beim Normalisieren NICHT still verloren gehen.
 * Nur valide Werte werden übernommen; fehlende Felder bleiben weg (kein Überschreiben).
 */
function extractTeacherFields(item: Record<string, unknown>): Partial<TeacherFields> {
    const result: Partial<TeacherFields> = {};

    if (typeof item.solution === 'string' && item.solution.trim()) {
        result.solution = item.solution;
    }
    if (Array.isArray(item.hints)) {
        const hints = item.hints.filter((h): h is string => typeof h === 'string' && h.trim().length > 0);
        if (hints.length > 0) result.hints = hints;
    }
    if (typeof item.points === 'number' && Number.isFinite(item.points) && item.points >= 0) {
        result.points = item.points;
    }
    if (item.difficulty === 'easy' || item.difficulty === 'medium' || item.difficulty === 'hard') {
        result.difficulty = item.difficulty;
    }
    if (typeof item.competence === 'string' && item.competence.trim()) {
        result.competence = item.competence;
    }
    if (typeof item.estimatedTime === 'number' && Number.isFinite(item.estimatedTime) && item.estimatedTime >= 0) {
        result.estimatedTime = item.estimatedTime;
    }
    if (typeof item.teacherNotes === 'string' && item.teacherNotes.trim()) {
        result.teacherNotes = item.teacherNotes;
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
export function validateAndNormalizeTasks(raw: unknown[]): Omit<Task, 'id'>[] {
    type ParsedItem = Omit<Task, 'id'> | OrphanedLineatur | null;

    // ── Pass 1: Parse jedes Item ──
    const items = raw
        .filter((item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null && 'type' in item
        );

    const parsed: ParsedItem[] = [];
    for (const item of items) {
        const rawType = String(item.type ?? '')
            .trim()
            .toLowerCase()
            .replace(/_/g, '-');
        const type = rawType === 'multiplechoice' ? 'multiple-choice' : rawType;
        const linesFields = extractLinesAfterFields(item);
        const teacherFields = extractTeacherFields(item);

        switch (type) {
            case 'multiple-choice':
            case 'mc':
                parsed.push({
                    type: 'multiple-choice' as const,
                    title: String(item.title || 'Multiple-Choice'),
                    question: String(item.question || ''),
                    vocabulary: [],
                    options: Array.isArray(item.options)
                        ? item.options
                            .filter((opt): opt is Record<string, unknown> => typeof opt === 'object' && opt !== null)
                            .map((opt) => ({
                                id: crypto.randomUUID(),
                                text: String(opt.text || ''),
                                isCorrect: Boolean(opt.isCorrect),
                            }))
                        : [],
                    ...linesFields,
                    ...teacherFields,
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
                        vocabulary: [],
                        ...linesFields,
                        ...teacherFields,
                    } as Omit<Task, 'id'>);
                } else {
                    parsed.push({
                        type: 'cloze' as const,
                        title: String(item.title || 'Lückentext'),
                        content,
                        vocabulary: [],
                        ...linesFields,
                        ...teacherFields,
                    } as Omit<Task, 'id'>);
                }
                break;
            }

            case 'instruction':
                parsed.push({
                    type: 'instruction' as const,
                    title: String(item.title || 'Aufgabe'),
                    text: String(item.text ?? item.content ?? ''),
                    vocabulary: [],
                    ...linesFields,
                    ...teacherFields,
                } as Omit<Task, 'id'>);
                break;

            case 'information':
            case 'information-text': {
                const textWidthRatioRaw = typeof item.textWidthRatio === 'number'
                    ? item.textWidthRatio
                    : 60;
                const textWidthRatio = Math.max(30, Math.min(100, Math.round(textWidthRatioRaw)));
                const chunks = Array.isArray(item.chunks)
                    ? item.chunks
                        .filter((chunk): chunk is Record<string, unknown> => typeof chunk === 'object' && chunk !== null)
                        .map((chunk) => ({
                            id: typeof chunk.id === 'string' && chunk.id.trim() ? chunk.id : crypto.randomUUID(),
                            heading: String(chunk.heading ?? ''),
                            content: String(chunk.content ?? ''),
                            notesHeading: String(chunk.notesHeading ?? 'Notizen'),
                        }))
                    : [];

                parsed.push({
                    type: 'information' as const,
                    title: String(item.title || 'Informationstext'),
                    content: String(item.content ?? item.text ?? ''),
                    hasNotesColumn: Boolean(item.hasNotesColumn),
                    textWidthRatio,
                    highlightVocabulary: Boolean(item.highlightVocabulary),
                    isChunked: Boolean(item.isChunked),
                    chunks,
                    showNumber: false,
                    vocabulary: [],
                    ...linesFields,
                    ...teacherFields,
                } as Omit<Task, 'id'>);
                break;
            }

            case 'heading':
                parsed.push({
                    type: 'heading' as const,
                    title: String(item.title || 'Zwischenüberschrift'),
                    text: String(item.text ?? item.title ?? 'Zwischenüberschrift'),
                    showNumber: false,
                    vocabulary: [],
                } as Omit<Task, 'id'>);
                break;

            case 'table': {
                const rows = typeof item.rows === 'number'
                    ? Math.max(1, Math.min(20, Math.round(item.rows)))
                    : 3;
                const cols = typeof item.cols === 'number'
                    ? Math.max(1, Math.min(12, Math.round(item.cols)))
                    : 3;
                parsed.push({
                    type: 'table' as const,
                    title: String(item.title || 'Tabelle'),
                    content: String(item.content ?? ''),
                    rows,
                    cols,
                    vocabulary: [],
                    ...linesFields,
                    ...teacherFields,
                } as Omit<Task, 'id'>);
                break;
            }

            case 'image-placeholder':
            case 'image':
                parsed.push({
                    type: 'image-placeholder' as const,
                    title: String(item.title || 'Bild-Platzhalter'),
                    caption: String(item.caption ?? ''),
                    imageAlign: item.imageAlign === 'center' || item.imageAlign === 'right' ? item.imageAlign : 'left',
                    align: item.align === 'center' || item.align === 'right' ? item.align : 'left',
                    opacity: typeof item.opacity === 'number' ? Math.max(0, Math.min(1, item.opacity)) : 1,
                    width: typeof item.width === 'string' ? item.width : '100%',
                    height: typeof item.height === 'string' ? item.height : 'auto',
                    widthMm: typeof item.widthMm === 'number' ? Math.max(20, Math.min(180, item.widthMm)) : 80,
                    heightMm: typeof item.heightMm === 'number' ? Math.max(20, Math.min(260, item.heightMm)) : 60,
                    vocabulary: [],
                    ...linesFields,
                    ...teacherFields,
                } as Omit<Task, 'id'>);
                break;

            case 'columns': {
                const layout = item.layout === '60-40' || item.layout === '40-60' ? item.layout : '50-50';
                const gapMm = typeof item.gapMm === 'number' ? Math.max(2, Math.min(20, item.gapMm)) : 6;
                parsed.push({
                    type: 'columns' as const,
                    title: String(item.title || 'Zweispaltig'),
                    layout,
                    gapMm,
                    children: [null, null],
                    showNumber: false,
                    vocabulary: [],
                } as Omit<Task, 'id'>);
                break;
            }

            case 'page-break':
            case 'pagebreak':
                parsed.push({
                    type: 'page-break' as const,
                    title: String(item.title || 'Seitenumbruch'),
                    showNumber: false,
                    vocabulary: [],
                } as Omit<Task, 'id'>);
                break;

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
                    vocabulary: [],
                    ...linesFields,
                    ...teacherFields,
                } as Omit<Task, 'id'>);
                break;

            case 'ordering': {
                const items = Array.isArray(item.items)
                    ? item.items
                        .filter((it): it is Record<string, unknown> => typeof it === 'object' && it !== null)
                        .map((it, index) => ({
                            id: crypto.randomUUID(),
                            text: String(it.text ?? ''),
                            correctPosition:
                                typeof it.correctPosition === 'number' && Number.isFinite(it.correctPosition)
                                    ? Math.max(1, Math.round(it.correctPosition))
                                    : index + 1,
                        }))
                    : [];
                parsed.push({
                    type: 'ordering' as const,
                    title: String(item.title || 'Reihenfolge'),
                    prompt: String(item.prompt ?? item.question ?? item.text ?? 'Bringe die Elemente in die richtige Reihenfolge.'),
                    items,
                    vocabulary: [],
                    ...linesFields,
                    ...teacherFields,
                } as Omit<Task, 'id'>);
                break;
            }

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

const JSON_REPAIR_SYSTEM_PROMPT =
    'Du erhältst fehlerhaftes, abgeschnittenes oder mit Fließtext vermischtes JSON. '
    + 'Gib AUSSCHLIESSLICH ein einziges, valides JSON-Objekt oder -Array zurück, das den erkennbaren '
    + 'Inhalt bewahrt. Schließe offene Strukturen, entferne Markdown und Erklärungen. '
    + 'Erfinde keine neuen Inhalte und ändere vorhandene Werte nicht.';

/**
 * Repariert fehlerhaftes/abgeschnittenes KI-JSON zu validem JSON (Route
 * 'jsonRepair'). Bewusst ein günstiger, in sich geschlossener Helfer: er wird
 * sowohl direkt aus den Parse-Pfaden (generateTasks*, Revision) genutzt als
 * auch über runAI als öffentliche Route exponiert. Gibt extrahiertes JSON
 * zurück (Aufrufer parst).
 */
export async function repairJSON(
    brokenJson: string,
    schemaHint?: string,
    signal?: AbortSignal,
): Promise<string> {
    const trimmed = brokenJson.trim();
    if (!trimmed) return '';

    const userPrompt = `${schemaHint ? `Erwartetes Schema: ${schemaHint}\n\n` : ''}`
        + `Repariere den folgenden Text zu validem JSON:\n\n${trimmed}`;

    signal?.throwIfAborted();

    try {
        const responseText = await runOneShotCompletion({
            userPrompt,
            systemPrompt: JSON_REPAIR_SYSTEM_PROMPT,
            signal,
        });
        signal?.throwIfAborted();
        return extractJSON(responseText);
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw normalizeProviderError(getActiveAiEndpoint() ? 'local' : getActiveProviderState().provider, error);
    }
}

/**
 * Parst KI-JSON; schlägt JSON.parse fehl, wird EIN Reparaturversuch über
 * repairJSON unternommen und erneut geparst. Scheitert auch das, propagiert
 * der Fehler – so behält jeder Aufrufer seine eigene Fehlersemantik.
 */
async function parseAiJsonOrRepair(
    responseText: string,
    jsonStr: string,
    schemaHint: string,
    signal?: AbortSignal,
): Promise<unknown> {
    try {
        return JSON.parse(jsonStr);
    } catch {
        const repaired = await repairJSON(responseText, schemaHint, signal);
        return JSON.parse(repaired);
    }
}

export type ExportAnalysisSeverity = 'suggestion' | 'warning' | 'info';

export interface ExportAnalysisHint {
    severity: ExportAnalysisSeverity;
    message: string;
    /** Optionaler, rein informativer Bezug auf eine Aufgabe (Nummer/Titel). */
    taskRef?: string;
}

export interface ExportAnalysisResult {
    hints: ExportAnalysisHint[];
}

const EXPORT_ANALYSIS_SYSTEM_PROMPT =
    'Du prüfst ein Arbeitsblatt vor dem Export auf inhaltliche und didaktische Schwachstellen '
    + '(unklare Aufgabenstellungen, fehlende Lösungen/Erwartungshorizont, uneinheitliche Schwierigkeit, '
    + 'Dopplungen, unpassende Reihenfolge). Gib AUSSCHLIESSLICH JSON in der Form '
    + '{"hints":[{"severity":"suggestion|warning|info","message":"...","taskRef":"..."}]} zurück. '
    + 'Höchstens 6 Hinweise, jeweils knapp und auf Deutsch, taskRef optional. '
    + 'Wenn alles in Ordnung ist, gib {"hints":[]} zurück. Erfinde keine Probleme.';

const ALLOWED_ANALYSIS_SEVERITIES: ExportAnalysisSeverity[] = ['suggestion', 'warning', 'info'];
const MAX_EXPORT_ANALYSIS_HINTS = 6;

function normalizeExportAnalysisResult(parsed: unknown): ExportAnalysisResult {
    // extractJSON ist array-first und liefert bei {"hints":[...]} u. U. nur das
    // innere Array – daher beide Formen (Objekt mit hints ODER bloßes Array) tragen.
    const rawHints = Array.isArray(parsed)
        ? parsed
        : (parsed as { hints?: unknown })?.hints;
    if (!Array.isArray(rawHints)) return { hints: [] };

    const hints: ExportAnalysisHint[] = [];
    for (const entry of rawHints) {
        if (!entry || typeof entry !== 'object') continue;
        const candidate = entry as Record<string, unknown>;
        const message = typeof candidate.message === 'string' ? candidate.message.trim() : '';
        if (!message) continue;
        const severity = ALLOWED_ANALYSIS_SEVERITIES.includes(candidate.severity as ExportAnalysisSeverity)
            ? (candidate.severity as ExportAnalysisSeverity)
            : 'suggestion';
        const taskRef = typeof candidate.taskRef === 'string' && candidate.taskRef.trim()
            ? candidate.taskRef.trim()
            : undefined;
        hints.push({ severity, message, taskRef });
        if (hints.length >= MAX_EXPORT_ANALYSIS_HINTS) break;
    }
    return { hints };
}

/**
 * Analysiert ein Arbeitsblatt vor dem Export und liefert knappe KI-Hinweise
 * (Route 'exportAnalysis', Rolle 'fast'). Ergänzt den deterministischen
 * exportValidator um inhaltlich-didaktische Hinweise. Robust gegen kaputtes
 * JSON über parseAiJsonOrRepair.
 */
export async function analyzeWorksheetForExport(
    tasksById: Record<string, Task>,
    taskIds: string[],
    signal?: AbortSignal,
): Promise<ExportAnalysisResult> {
    const ordered = taskIds.map((id) => tasksById[id]).filter(Boolean);
    if (ordered.length === 0) return { hints: [] };

    // Kompakte, gekappte Serialisierung – die Analyse braucht Struktur/Text, nicht jedes Detail.
    const worksheetJson = JSON.stringify(ordered).slice(0, 14000);
    const userPrompt = `Analysiere dieses Arbeitsblatt (JSON, Aufgaben in Reihenfolge):\n\n${worksheetJson}`;

    signal?.throwIfAborted();

    let responseText: string;
    try {
        responseText = await runOneShotCompletion({
            userPrompt,
            systemPrompt: EXPORT_ANALYSIS_SYSTEM_PROMPT,
            signal,
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw normalizeProviderError(getActiveAiEndpoint() ? 'local' : getActiveProviderState().provider, error);
    }

    signal?.throwIfAborted();
    const jsonStr = extractJSON(responseText);
    try {
        const parsed = await parseAiJsonOrRepair(responseText, jsonStr, '{ "hints": [ ... ] }', signal);
        return normalizeExportAnalysisResult(parsed);
    } catch {
        // Analyse ist optional/ergänzend – bei unbrauchbarer Antwort lieber keine Hinweise als ein Fehler.
        return { hints: [] };
    }
}

export async function generateTasks(options: GenerateTasksOptions): Promise<Omit<Task, 'id'>[]> {
    const responseText = await getAdapter().generateTasksText(options);
    const jsonStr = extractJSON(responseText);

    let parsed: unknown;
    try {
        parsed = await parseAiJsonOrRepair(responseText, jsonStr, 'Array<Task>', undefined);
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

interface ModifyTaskApiRequest {
    task: Omit<Task, 'id'>;
    instruction: string;
    provider: 'openai' | 'google' | 'openrouter' | 'lmstudio';
    model: string;
    providerApiKey?: string;
    providerBaseURL?: string;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function requestModifiedTaskObject(task: Task, instruction: string): Promise<Record<string, unknown>> {
    const { provider } = getActiveProviderState();
    const config = requireProviderConfig(provider);
    const { id: removedId, ...taskData } = task;
    void removedId;

    const requestPayload: ModifyTaskApiRequest = {
        task: taskData,
        instruction,
        provider: mapAgentProvider(provider),
        model: config.model,
        providerApiKey: config.apiKey?.trim() || undefined,
        providerBaseURL: config.baseUrl?.trim() || undefined,
    };

    const response = await fetch('/api/modify-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
    });

    let responseBody: unknown = null;
    try {
        responseBody = await response.json();
    } catch {
        responseBody = null;
    }

    if (!response.ok) {
        const errorMessage =
            isPlainRecord(responseBody) && typeof responseBody.error === 'string'
                ? responseBody.error
                : `${PROVIDER_LABELS[provider]} Anfrage fehlgeschlagen (HTTP ${response.status}).`;
        throw normalizeProviderError(provider, errorMessage);
    }

    if (!isPlainRecord(responseBody)) {
        console.error('[modifyTask] Ungültige API-Antwort für /api/modify-task.', {
            responseBody,
        });
        throw new Error(MICRO_AI_TRUNCATION_USER_MESSAGE);
    }

    return responseBody;
}

export async function modifyTask(task: Task, instruction: string): Promise<Omit<Task, 'id'>> {
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction) {
        throw new Error('Leere KI-Anweisung ist nicht erlaubt.');
    }

    const parsed = await requestModifiedTaskObject(task, trimmedInstruction);

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
        parsed = await parseAiJsonOrRepair(responseText, jsonStr, 'WorksheetRevision { "operations": [ ... ] }', signal);
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

const CHAT_COMPRESSION_SYSTEM_PROMPT =
    'Du fasst den bisherigen Planungs-/Chatverlauf für ein Arbeitsblatt kompakt zusammen. '
    + 'Bewahre alle für die weitere Arbeit wichtigen Fakten: Thema, Klassenstufe/Fach, gewünschte '
    + 'Aufgabentypen, Schwierigkeitsgrad, besondere Vorgaben und bereits getroffene Entscheidungen. '
    + 'Schreibe auf Deutsch, dicht und neutral, höchstens 150 Wörter, ohne Anrede und ohne Rückfragen.';

/**
 * Komprimiert einen langen Chatverlauf zu einer kompakten Zusammenfassung
 * (Route 'chatCompression'). Bewusst eine günstige/schnelle Aufgabe – nutzt
 * vorerst dasselbe aktive Chat-Modell wie der reguläre Chat (echtes
 * Rollen→Modell-Routing folgt mit der Modellbibliothek).
 */
export async function compressChatHistory(
    messages: ChatMessage[],
    signal?: AbortSignal,
): Promise<string> {
    const cleaned = messages.filter((message) => message.content.trim().length > 0);
    if (cleaned.length === 0) return '';

    const transcript = cleaned
        .map((message) => `${message.role === 'user' ? 'Nutzer' : 'Assistent'}: ${message.content.trim()}`)
        .join('\n');
    const userPrompt = `Fasse den folgenden Verlauf zusammen:\n\n${transcript}`;

    signal?.throwIfAborted();

    try {
        const responseText = await runOneShotCompletion({
            userPrompt,
            systemPrompt: CHAT_COMPRESSION_SYSTEM_PROMPT,
            signal,
        });
        signal?.throwIfAborted();
        return responseText.trim();
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw normalizeProviderError(getActiveAiEndpoint() ? 'local' : getActiveProviderState().provider, error);
    }
}

export async function generateVocabularyDefinitions(
    words: Array<{ id: string; word: string }>,
): Promise<Array<{ id: string; pos: string; definition: string }>> {
    const wordList = words.map((w) => w.word).join(', ');
    const userPrompt = `Gib für folgende Wörter jeweils die Wortart (pos) und eine sehr kurze, einfache Definition (definition, maximal 8–10 Wörter) auf Deutsch zurück.
Antwort NUR als JSON-Array: [{"word":"...","pos":"...","definition":"..."}]
Wörter: ${wordList}`;

    const systemPrompt = 'Du bist ein Sprachexperte und Lehrassistent. Antworte ausschließlich mit validem JSON.';

    const responseText = await runOneShotCompletion({ userPrompt, systemPrompt });

    const jsonStr = extractJSON(responseText);
    const parsed: Array<{ word: string; pos: string; definition: string }> = JSON.parse(jsonStr);

    return words.map((w) => {
        const match = parsed.find((p) => p.word.toLowerCase() === w.word.toLowerCase());
        return {
            id: w.id,
            pos: match?.pos ?? '',
            definition: match?.definition ?? '',
        };
    });
}

export async function generateTasksFromCompiledPrompt(compiledPrompt: string): Promise<Omit<Task, 'id'>[]> {
    const responseText = await getAdapter().generateTasksFromCompiledPromptText(compiledPrompt);
    const jsonStr = extractJSON(responseText);

    let parsed: unknown;
    try {
        parsed = await parseAiJsonOrRepair(responseText, jsonStr, 'Array<Task>', undefined);
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

export interface AgentAfbConfig {
    isActive: boolean;
    reproduktion: number;
    reorganisation: number;
    transfer: number;
    problemloesung: number;
}

export interface AgentWorkflowRequest {
    input: string;
    provider: AIProvider;
    model: string;
    providerApiKey?: string;
    providerBaseURL?: string;
    afbConfig: AgentAfbConfig;
}

const streamPhaseSchema = z.enum(['planning', 'creating', 'validating', 'success', 'error']);

const agentAfbConfigSchema = z.object({
    isActive: z.boolean(),
    reproduktion: z.number(),
    reorganisation: z.number(),
    transfer: z.number(),
    problemloesung: z.number(),
}).strict();

const agentTaskItemSchema = z.object({
    type: z.string(),
    title: z.string(),
}).passthrough();

const agentPlannerSchema = z.object({
    topic: z.string(),
    subject: z.string(),
    grade: z.string(),
    learningGoals: z.array(z.string()),
    difficulty: z.number(),
}).strict();

const agentValidationSchema = z.object({
    isValid: z.boolean(),
    score: z.number(),
    errors: z.array(z.string()),
}).strict();

const agentWorkflowResponseSchema = z.object({
    planner: agentPlannerSchema,
    tasks: z.array(agentTaskItemSchema).min(1),
    validation: agentValidationSchema,
    afbConfig: agentAfbConfigSchema,
}).strict();

const agentStreamEventSchema = z.object({
    phase: streamPhaseSchema,
    log: z.string(),
    result: z.unknown().optional(),
}).strict();

export type AgentWorkflowResponse = z.infer<typeof agentWorkflowResponseSchema>;
type AgentStreamEvent = z.infer<typeof agentStreamEventSchema>;

type AgentTaskItem = z.infer<typeof agentTaskItemSchema>;
type AgentPlanner = z.infer<typeof agentPlannerSchema>;
type AgentValidation = z.infer<typeof agentValidationSchema>;

const DEFAULT_AGENT_PLANNER: AgentPlanner = {
    topic: 'unknown',
    subject: 'unknown',
    grade: 'unknown',
    learningGoals: [],
    difficulty: 3,
};

const DEFAULT_AGENT_VALIDATION: AgentValidation = {
    isValid: true,
    score: 100,
    errors: [],
};

function mapAgentProvider(provider: AIProvider): 'openai' | 'google' | 'openrouter' | 'lmstudio' {
    if (provider === 'gemini') return 'google';
    if (provider === 'local') return 'lmstudio';
    return provider;
}

function sanitizeJsonPayload(rawPayload: string): string {
    return rawPayload
        .replace(/^\uFEFF/, '')
        .replace(/```(?:json)?/gi, '')
        .replace(/```/g, '')
        .trim();
}

function extractJsonArrayCandidates(rawText: string): string[] {
    const candidates: string[] = [];
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < rawText.length; index += 1) {
        const char = rawText[index];

        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === '\\') {
                escaped = true;
                continue;
            }
            if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === '[') {
            if (depth === 0) {
                start = index;
            }
            depth += 1;
            continue;
        }

        if (char === ']' && depth > 0) {
            depth -= 1;
            if (depth === 0 && start >= 0) {
                candidates.push(rawText.slice(start, index + 1));
                start = -1;
            }
        }
    }

    return candidates;
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isTaskLikeEntry(value: unknown): value is Record<string, unknown> {
    return isRecordObject(value) && typeof value.type === 'string';
}

function isTaskLikeArray(value: unknown): value is Record<string, unknown>[] {
    return Array.isArray(value) && value.length > 0 && value.every((entry) => isTaskLikeEntry(entry));
}

function tryParseJson(
    payload: string,
    options: { context?: string; logErrors?: boolean } = {},
): unknown | null {
    const { context = 'unknown', logErrors = false } = options;
    const sanitizedPayload = sanitizeJsonPayload(payload);
    if (!sanitizedPayload) return null;

    try {
        return JSON.parse(sanitizedPayload);
    } catch (error) {
        const extracted = extractJSON(sanitizedPayload);
        if (extracted && extracted !== sanitizedPayload) {
            try {
                return JSON.parse(sanitizeJsonPayload(extracted));
            } catch (nestedError) {
                if (logErrors) {
                    console.error('[aiService] JSON-Parsing fehlgeschlagen (mit Fallback).', {
                        context,
                        error,
                        nestedError,
                        payloadPreview: sanitizedPayload.slice(0, 1200),
                    });
                }
                return null;
            }
        }
        if (logErrors) {
            console.error('[aiService] JSON-Parsing fehlgeschlagen.', {
                context,
                error,
                payloadPreview: sanitizedPayload.slice(0, 1200),
            });
        }
        return null;
    }
}

function findTaskArrayInUnknown(candidate: unknown): Record<string, unknown>[] | null {
    if (!candidate) return null;

    if (typeof candidate === 'string') {
        const parsedStringCandidate = tryParseJson(candidate, {
            context: 'find-task-array:string',
            logErrors: false,
        });
        if (parsedStringCandidate !== null) {
            return findTaskArrayInUnknown(parsedStringCandidate);
        }

        const arrayCandidates = extractJsonArrayCandidates(sanitizeJsonPayload(candidate));
        for (let index = arrayCandidates.length - 1; index >= 0; index -= 1) {
            const parsedArrayCandidate = tryParseJson(arrayCandidates[index], {
                context: `find-task-array:string-candidate-${index}`,
                logErrors: false,
            });
            if (isTaskLikeArray(parsedArrayCandidate)) {
                return parsedArrayCandidate;
            }
        }
        return null;
    }

    if (isTaskLikeArray(candidate)) {
        return candidate;
    }

    if (Array.isArray(candidate)) {
        for (const entry of candidate) {
            const nested = findTaskArrayInUnknown(entry);
            if (nested) return nested;
        }
        return null;
    }

    if (!isRecordObject(candidate)) {
        return null;
    }

    if ('tasks' in candidate) {
        const fromTasks = findTaskArrayInUnknown(candidate.tasks);
        if (fromTasks) return fromTasks;
    }

    for (const value of Object.values(candidate)) {
        const nested = findTaskArrayInUnknown(value);
        if (nested) return nested;
    }

    return null;
}

function normalizeAgentTasksFromUnknown(candidate: unknown, context: string): AgentTaskItem[] | null {
    const rawTasks = findTaskArrayInUnknown(candidate);
    if (!rawTasks) return null;

    const parsedTasks = z.array(agentTaskItemSchema).min(1).safeParse(rawTasks);
    if (!parsedTasks.success) {
        console.error('[aiService] Task-Array aus Agent-Stream ist ungültig.', {
            context,
            issues: parsedTasks.error.issues,
        });
        return null;
    }

    return parsedTasks.data;
}

function normalizeAgentWorkflowResultFromUnknown(
    candidate: unknown,
    fallbackAfbConfig: AgentAfbConfig,
    context: string,
): AgentWorkflowResponse | null {
    const parsedStrict = agentWorkflowResponseSchema.safeParse(candidate);
    if (parsedStrict.success) {
        return parsedStrict.data;
    }

    const tasks = normalizeAgentTasksFromUnknown(candidate, context);
    if (!tasks) return null;

    const record = isRecordObject(candidate) ? candidate : {};
    const planner = agentPlannerSchema.safeParse(record.planner).success
        ? agentPlannerSchema.parse(record.planner)
        : DEFAULT_AGENT_PLANNER;
    const validation = agentValidationSchema.safeParse(record.validation).success
        ? agentValidationSchema.parse(record.validation)
        : DEFAULT_AGENT_VALIDATION;
    const afbConfig = agentAfbConfigSchema.safeParse(record.afbConfig).success
        ? agentAfbConfigSchema.parse(record.afbConfig)
        : agentAfbConfigSchema.parse(fallbackAfbConfig);

    return {
        planner,
        tasks,
        validation,
        afbConfig,
    };
}

function collectAgentStreamEvents(candidate: unknown, events: AgentStreamEvent[]): void {
    if (!candidate) return;

    if (Array.isArray(candidate)) {
        for (const item of candidate) collectAgentStreamEvents(item, events);
        return;
    }

    if (typeof candidate === 'string') {
        const parsedStringPayload = tryParseJson(candidate, {
            context: 'collect-agent-stream-events:string',
            logErrors: false,
        });
        if (parsedStringPayload !== null) {
            collectAgentStreamEvents(parsedStringPayload, events);
        }
        return;
    }

    if (typeof candidate !== 'object') return;

    const parsedEvent = agentStreamEventSchema.safeParse(candidate);
    if (parsedEvent.success) {
        events.push(parsedEvent.data);
        return;
    }

    const record = candidate as Record<string, unknown>;
    if ('data' in record) {
        collectAgentStreamEvents(record.data, events);
    }
    if ('parts' in record && Array.isArray(record.parts)) {
        collectAgentStreamEvents(record.parts, events);
    }
}

function parseAgentStreamLine(line: string): AgentStreamEvent[] {
    const trimmed = line.trim();
    if (!trimmed) return [];
    if (trimmed === '[DONE]') return [];

    let payload = trimmed;
    if (payload.startsWith('data:')) {
        payload = payload.slice(5).trim();
    }
    if (!payload || payload === '[DONE]') return [];

    const protocolPrefixMatch = payload.match(/^\d+:(.*)$/s);
    if (protocolPrefixMatch) {
        payload = protocolPrefixMatch[1].trim();
    }
    if (!payload) return [];

    const parsedPayload = tryParseJson(payload, {
        context: 'parse-agent-stream-line',
        logErrors: false,
    });
    if (parsedPayload === null) return [];

    const events: AgentStreamEvent[] = [];
    collectAgentStreamEvents(parsedPayload, events);
    return events;
}

const AGENT_WORKFLOW_ENDPOINT = '/api/generate-worksheet';

export async function runAgentWorkflowStream(request: AgentWorkflowRequest): Promise<AgentWorkflowResponse> {
    const { useWorkspaceStore } = await import('../store/workspaceStore');
    try {
        const normalizedAfbConfig = agentAfbConfigSchema.parse(request.afbConfig);
        const response = await fetch(AGENT_WORKFLOW_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input: request.input,
                provider: mapAgentProvider(request.provider),
                model: request.model,
                providerApiKey: request.providerApiKey?.trim() || undefined,
                providerBaseURL: request.providerBaseURL?.trim() || undefined,
                afbConfig: normalizedAfbConfig,
                stream: true,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP Error ${response.status} bei ${AGENT_WORKFLOW_ENDPOINT}: ${errorText || 'Keine Fehlerdetails vom Server.'}`);
        }

        if (!response.body) {
            throw new Error('Kein Stream-Body in der Agenten-Antwort vorhanden.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let rawStreamText = '';
        let finalResult: AgentWorkflowResponse | null = null;
        let streamError: string | null = null;

        const applyEvents = (events: AgentStreamEvent[], sourceLabel: string) => {
            for (const event of events) {
                const store = useWorkspaceStore.getState();
                store.setAgentPhase(event.phase);
                store.addAgentLog(event.log);
                if (event.phase === 'error') {
                    streamError = event.log;
                }
                if (event.result !== undefined) {
                    const normalizedResult = normalizeAgentWorkflowResultFromUnknown(
                        event.result,
                        normalizedAfbConfig,
                        sourceLabel,
                    );
                    if (normalizedResult) {
                        finalResult = normalizedResult;
                    }
                }
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                const flushed = decoder.decode();
                if (flushed) {
                    rawStreamText += flushed;
                    buffer += flushed;
                }
                break;
            }

            const decodedChunk = decoder.decode(value, { stream: true });
            rawStreamText += decodedChunk;
            buffer += decodedChunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                const events = parseAgentStreamLine(line);
                applyEvents(events, 'stream-line');
            }
        }

        if (buffer.trim().length > 0) {
            const trailingLines = buffer
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0);

            for (const line of trailingLines) {
                const events = parseAgentStreamLine(line);
                applyEvents(events, 'stream-trailing-buffer');
            }
        }

        if (streamError) {
            throw new Error(streamError);
        }

        if (!finalResult) {
            const fallbackTasks = normalizeAgentTasksFromUnknown(rawStreamText, 'stream-raw-fallback');
            if (fallbackTasks) {
                useWorkspaceStore.getState().addAgentLog('Fallback-Parsing aktiv: Aufgaben aus Raw-Stream hydriert.');
                finalResult = {
                    planner: DEFAULT_AGENT_PLANNER,
                    tasks: fallbackTasks,
                    validation: DEFAULT_AGENT_VALIDATION,
                    afbConfig: normalizedAfbConfig,
                };
            } else {
                const parsedRawPayload = tryParseJson(rawStreamText, {
                    context: 'stream-raw-fallback:json',
                    logErrors: true,
                });
                if (parsedRawPayload) {
                    finalResult = normalizeAgentWorkflowResultFromUnknown(
                        parsedRawPayload,
                        normalizedAfbConfig,
                        'stream-raw-fallback:parsed',
                    );
                }
                if (!finalResult) {
                    console.error('[runAgentWorkflowStream] Kein auswertbares finales Ergebnis im Stream gefunden.', {
                        streamTail: rawStreamText.slice(-2000),
                    });
                }
            }
        }

        if (!finalResult) {
            throw new Error('Agenten-Stream abgeschlossen, aber kein finales Ergebnis empfangen.');
        }

        const store = useWorkspaceStore.getState();
        if (store.agentPhase !== 'success') {
            store.setAgentPhase('success');
        }

        return finalResult;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unbekannter Fehler im Agenten-Workflow.';
        const store = useWorkspaceStore.getState();
        store.setAgentPhase('error');
        store.addAgentLog(message);
        console.error('[runAgentWorkflowStream] Fehler:', error);
        throw (error instanceof Error ? error : new Error(message));
    }
}
