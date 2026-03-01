import { useCallback, useEffect, useState } from 'react';
import { PROVIDER_MODEL_OPTIONS, type ProviderModelOption } from '../services/ai/modelCatalog';
import { filterModelOptions } from '../services/ai/modelFilter';

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

function normalizeModelName(rawName: string): string {
    return rawName.replace(/^models\//, '');
}

function isGeminiTextModel(entry: GeminiModelEntry): boolean {
    const rawName = entry.name ?? '';
    const modelName = normalizeModelName(rawName).toLowerCase();
    const methods = entry.supportedGenerationMethods ?? [];

    const supportsGenerateContent = methods.some((m) => m.toLowerCase() === 'generatecontent');
    if (!supportsGenerateContent) return false;

    const match = modelName.match(/^gemini-(\d+(?:\.\d+)?)-(flash|pro)$/);
    if (!match) return false;

    if (!EXPLICIT_GEMINI_MODEL_IDS.has(modelName)) return false;

    const version = Number.parseFloat(match[1]);
    return Number.isFinite(version) && version >= 2.5;
}

function mapModelToOption(entry: GeminiModelEntry): ProviderModelOption | null {
    const rawName = (entry.name ?? '').trim();
    if (!rawName) return null;

    const value = normalizeModelName(rawName);
    return {
        value,
        label: entry.displayName?.trim() || value,
        desc: entry.description?.trim() || 'Automatisch via API erkannt',
    };
}

function getGeminiSortMeta(modelValue: string): { version: number; tier: number } {
    const normalized = modelValue.toLowerCase();
    const match = normalized.match(/^gemini-(\d+(?:\.\d+)?)-(flash|pro)$/);

    if (!match) return { version: -1, tier: 99 };

    const version = Number.parseFloat(match[1]);
    const family = match[2];
    const tier = family === 'pro' ? 0 : 1;

    return { version: Number.isFinite(version) ? version : -1, tier };
}

export function useGeminiModels(apiKey: string, enabled: boolean) {
    const [models, setModels] = useState<ProviderModelOption[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        if (!enabled) {
            setModels([]);
            setError(null);
            return;
        }

        if (!apiKey.trim()) {
            setModels([]);
            setError('Kein API-Key gesetzt.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const payload = (await response.json()) as GeminiModelsResponse;
            const options = (payload.models ?? [])
                .filter(isGeminiTextModel)
                .map(mapModelToOption)
                .filter((opt): opt is ProviderModelOption => Boolean(opt));

            if (options.length === 0) {
                setModels([]);
                setError('Keine passenden Gemini-Modelle gefunden.');
                return;
            }

            const deduped = Array.from(new Map(options.map((opt) => [opt.value, opt])).values())
                .sort((a, b) => {
                    const metaA = getGeminiSortMeta(a.value);
                    const metaB = getGeminiSortMeta(b.value);

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
                setModels([]);
                setError('Keine passenden Gemini-Modelle gefunden.');
                return;
            }

            setModels(filtered);
        } catch {
            setModels([]);
            setError('Gemini-Modelle konnten nicht automatisch geladen werden.');
        } finally {
            setIsLoading(false);
        }
    }, [apiKey, enabled]);

    useEffect(() => {
        void reload();
    }, [reload]);

    return { models, isLoading, error, reload };
}
