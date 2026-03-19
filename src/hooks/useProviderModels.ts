import { useCallback, useEffect, useState } from 'react';
import type { AIProvider } from '../store/settingsStore';
import { useSettingsStore } from '../store/settingsStore';
import type { ProviderModelOption } from '../services/ai/modelCatalog';
import { listProviderModels } from '../services/aiService';

export function useProviderModels(provider: AIProvider, enabled: boolean) {
    const providerConfig = useSettingsStore((state) => state.providers[provider]);
    const [models, setModels] = useState<ProviderModelOption[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        if (!enabled) {
            setModels([]);
            setError(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const loadedModels = await listProviderModels(provider);
            setModels(loadedModels);
        } catch (err) {
            setModels([]);
            setError(err instanceof Error ? err.message : 'Modelle konnten nicht geladen werden.');
        } finally {
            setIsLoading(false);
        }
    }, [
        enabled,
        provider,
    ]);

    useEffect(() => {
        void reload();
    }, [
        reload,
        providerConfig.apiKey,
        providerConfig.baseUrl,
    ]);

    return { models, isLoading, error, reload };
}
