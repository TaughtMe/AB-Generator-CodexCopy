import type { AIProvider } from '../../store/settingsStore';

export interface ProviderModelOption {
    value: string;
    label: string;
    desc: string;
}

export const PROVIDER_LABELS: Record<AIProvider, string> = {
    gemini: 'Gemini',
    openai: 'OpenAI',
    local: 'Local (LM Studio)',
};

export const PROVIDER_MODEL_OPTIONS: Record<AIProvider, ProviderModelOption[]> = {
    gemini: [
        { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Stabil)', desc: 'Stabiler Standard' },
        { value: 'gemini-flash-latest', label: 'Gemini Flash Latest (Immer aktuell)', desc: 'Automatisch aktuelles Flash-Modell' },
        { value: 'gemini-3.0-flash-preview', label: 'Gemini 3.0 Flash Preview', desc: 'Preview zum Testen' },
    ],
    openai: [
        { value: 'gpt-5.2-mini', label: 'GPT-5.2 mini', desc: 'Aktueller schneller Standard' },
        { value: 'gpt-5.2-thinking', label: 'GPT-5.2 thinking', desc: 'Mehr Reasoning-Tiefe' },
        { value: 'gpt-4.1', label: 'GPT-4.1', desc: 'Höhere Qualität' },
    ],
    local: [
        { value: 'qwen2.5-7b-instruct', label: 'Qwen2.5 7B Instruct', desc: 'Guter lokaler Startpunkt' },
        { value: 'llama3.1-8b-instruct', label: 'Llama 3.1 8B Instruct', desc: 'Alternative lokal' },
    ],
};

export function getModelLabel(provider: AIProvider, model: string): string {
    const match = PROVIDER_MODEL_OPTIONS[provider].find((option) => option.value === model);
    return match?.label ?? model;
}
