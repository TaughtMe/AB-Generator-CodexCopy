import { useCallback, useEffect, useState } from 'react';
import type { ProviderModelOption } from '../services/ai/modelCatalog';
import { filterModelOptions } from '../services/ai/modelFilter';

function normalizeBaseUrl(baseUrl: string): string {
    const trimmed = baseUrl.trim().replace(/\/$/, '');
    if (!trimmed) return '';
    if (/\/v1$/i.test(trimmed)) return trimmed;
    return `${trimmed}/v1`;
}

function getCandidateBaseUrls(normalizedBaseUrl: string): string[] {
    const candidates = [normalizedBaseUrl];

    try {
        const url = new URL(normalizedBaseUrl);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            const dockerHostUrl = new URL(normalizedBaseUrl);
            dockerHostUrl.hostname = 'host.docker.internal';
            candidates.push(dockerHostUrl.toString().replace(/\/$/, ''));
        }
    } catch {
        return candidates;
    }

    return Array.from(new Set(candidates));
}

interface LocalModelsResponse {
    data?: Array<{ id?: string }>;
}

export function mapModelIdsToOptions(ids: string[]): ProviderModelOption[] {
    const options = ids.map((id) => ({
        value: id,
        label: id,
        desc: 'Vom lokalen Server erkannt',
    }));

    return filterModelOptions(options);
}

export function useLocalModels(baseUrl: string, enabled: boolean) {
    const [models, setModels] = useState<ProviderModelOption[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [serverReachable, setServerReachable] = useState<boolean | null>(null);
    const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
    const [nowTs, setNowTs] = useState<number>(() => Date.now());

    const reload = useCallback(async () => {
        if (!enabled) {
            setModels([]);
            setError(null);
            setServerReachable(null);
            return;
        }

        const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
        if (!normalizedBaseUrl) {
            setModels([]);
            setError('Keine Base-URL gesetzt.');
            setServerReachable(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const candidateBaseUrls = getCandidateBaseUrls(normalizedBaseUrl);
            let payload: LocalModelsResponse | null = null;
            let connected = false;

            for (const candidateBaseUrl of candidateBaseUrls) {
                try {
                    const response = await fetch(`${candidateBaseUrl}/models`);
                    if (!response.ok) continue;
                    payload = (await response.json()) as LocalModelsResponse;
                    connected = true;
                    break;
                } catch {
                    continue;
                }
            }

            if (!connected || !payload) {
                throw new Error('no-reachable-local-endpoint');
            }

            setServerReachable(true);

            const ids = (payload.data ?? [])
                .map((entry) => entry.id?.trim() ?? '')
                .filter(Boolean);

            if (ids.length === 0) {
                setModels([]);
                setError('Keine Modelle gefunden.');
                return;
            }

            const uniqueSorted = Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
            setModels(mapModelIdsToOptions(uniqueSorted));
        } catch {
            setModels([]);
            setError('Lokalen Server nicht erreicht. Tipp: im Dev-Container statt 127.0.0.1 ggf. host.docker.internal nutzen.');
            setServerReachable(false);
        } finally {
            setLastCheckedAt(Date.now());
            setIsLoading(false);
        }
    }, [baseUrl, enabled]);

    useEffect(() => {
        void reload();
    }, [reload]);

    useEffect(() => {
        if (!lastCheckedAt) return;

        const timer = window.setInterval(() => {
            setNowTs(Date.now());
        }, 1000);

        return () => window.clearInterval(timer);
    }, [lastCheckedAt]);

    const lastCheckedLabel = (() => {
        if (!lastCheckedAt) return null;
        const seconds = Math.max(0, Math.floor((nowTs - lastCheckedAt) / 1000));
        if (seconds < 60) {
            return `vor ${seconds} Sek.`;
        }
        const minutes = Math.floor(seconds / 60);
        return `vor ${minutes} Min.`;
    })();

    return { models, isLoading, error, serverReachable, lastCheckedLabel, reload };
}
