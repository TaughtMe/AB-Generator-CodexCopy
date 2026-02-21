import { useSettingsStore } from '../store/settingsStore';
import {
    generateTasks,
    modifyTask,
    type GenerateTasksOptions,
    isActiveProviderConfigured,
    getActiveProviderLabel,
} from './aiService';

export { generateTasks, modifyTask, isActiveProviderConfigured, getActiveProviderLabel };
export type { GenerateTasksOptions };

export function getApiKey(): string | null {
    const { providers } = useSettingsStore.getState();
    const key = providers.gemini.apiKey;
    return key || null;
}

export function setApiKey(key: string): void {
    useSettingsStore.getState().setProviderApiKey('gemini', key);
}
