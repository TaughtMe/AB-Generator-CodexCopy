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
        { value: 'gemini-3.1-flash', label: 'Gemini Flash 3.1', desc: 'Neu & sehr schnell' },
        { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', desc: 'Höchste Qualität' },
        { value: 'gemini-3.0-flash', label: 'Gemini Flash 3.0', desc: 'Neu & sehr schnell' },
        { value: 'gemini-3.0-pro', label: 'Gemini 3.0 Pro', desc: 'Höchste Qualität' },
        { value: 'gemini-2.5-flash', label: 'Gemini Flash 2.5', desc: 'Stabiler Standard' },
        { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: 'Höhere Qualität' },
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
