import type { AIProvider } from '../../store/settingsStore';

export interface ProviderModelOption {
    value: string;
    label: string;
    desc: string;
}

export const PROVIDER_LABELS: Record<AIProvider, string> = {
    gemini: 'Gemini',
    openai: 'OpenAI',
    openrouter: 'OpenRouter',
    local: 'Local (LM Studio)',
};

export const PROVIDER_MODEL_OPTIONS: Record<AIProvider, ProviderModelOption[]> = {
    gemini: [
        { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash-Lite (Kostenoptimiert)', desc: 'Günstigstes Modell für schnelle Antworten' },
        { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'Stabil und schnell' },
        { value: 'gemini-3.1-flash', label: 'Gemini 3.1 Flash', desc: 'Neueste Flash-Generation' },
        { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: 'Höhere Qualität für komplexe Inhalte' },
        { value: 'gemini-3.0-pro', label: 'Gemini 3.0 Pro', desc: 'Leistungsstark für anspruchsvolle Aufgaben' },
        { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', desc: 'Maximale Qualität' },
    ],
    openai: [
        { value: 'gpt-5.2-mini', label: 'GPT-5.2 mini', desc: 'Aktueller schneller Standard' },
        { value: 'gpt-5.2-thinking', label: 'GPT-5.2 thinking', desc: 'Mehr Reasoning-Tiefe' },
        { value: 'gpt-4.1', label: 'GPT-4.1', desc: 'Höhere Qualität' },
    ],
    openrouter: [
        { value: 'openai/gpt-4.1-mini', label: 'OpenAI GPT-4.1 mini', desc: 'Schnell und kosteneffizient' },
        { value: 'openai/gpt-4.1', label: 'OpenAI GPT-4.1', desc: 'Ausgewogene Qualität' },
        { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', desc: 'Stark bei komplexen Aufgaben' },
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
