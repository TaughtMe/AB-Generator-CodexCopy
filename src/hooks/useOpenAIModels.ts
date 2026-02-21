import { useCallback, useEffect, useState } from 'react';
import type { ProviderModelOption } from '../services/ai/modelCatalog';
import { filterModelOptions } from '../services/ai/modelFilter';

interface OpenAIModelsResponse {
    data?: Array<{ id?: string }>;
}

function normalizeBaseUrl(baseUrl: string): string {
    const trimmed = baseUrl.trim().replace(/\/$/, '');
    if (!trimmed) return 'https://api.openai.com/v1';
    if (/\/v1$/i.test(trimmed)) return trimmed;
    return `${trimmed}/v1`;
}

function mapModelIdToOption(id: string): ProviderModelOption {
    return {
        value: id,
        label: id,
        desc: 'Automatisch via API erkannt',
    };
}

function isLikelyChatModel(id: string): boolean {
    const m = id.toLowerCase();
    return (
        m.startsWith('gpt-') ||
        m.includes('o3') ||
        m.includes('o4') ||
        m.includes('reasoning')
    );
}

export function useOpenAIModels(baseUrl: string, apiKey: string, enabled: boolean) {
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
            const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
            const response = await fetch(`${normalizedBaseUrl}/models`, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const payload = (await response.json()) as OpenAIModelsResponse;
            const ids = (payload.data ?? [])
                .map((entry) => entry.id?.trim() ?? '')
                .filter(Boolean)
                .filter(isLikelyChatModel);

            if (ids.length === 0) {
                setModels([]);
                setError('Keine passenden Chat-Modelle gefunden.');
                return;
            }

            const uniqueSorted = Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
            const options = filterModelOptions(uniqueSorted.map(mapModelIdToOption));

            if (options.length === 0) {
                setModels([]);
                setError('Keine passenden Chat-Modelle gefunden.');
                return;
            }

            setModels(options);
        } catch {
            setModels([]);
            setError('Modelle konnten nicht automatisch geladen werden.');
        } finally {
            setIsLoading(false);
        }
    }, [apiKey, baseUrl, enabled]);

    useEffect(() => {
        void reload();
    }, [reload]);

    return { models, isLoading, error, reload };
}
