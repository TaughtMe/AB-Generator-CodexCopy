import type { ProviderModelOption } from './modelCatalog';

const EXCLUDED_TOKENS = [
    'audio',
    'tts',
    'speech',
    'vision',
    'image',
    'embedding',
    'embed',
    'whisper',
    'transcribe',
    'transcription',
];

function includesExcludedToken(text: string): boolean {
    const normalized = text.toLowerCase();
    return EXCLUDED_TOKENS.some((token) => normalized.includes(token));
}

export function isModelOptionEligible(option: ProviderModelOption): boolean {
    const haystack = `${option.value} ${option.label} ${option.desc}`;
    return !includesExcludedToken(haystack);
}

export function filterModelOptions(options: ProviderModelOption[]): ProviderModelOption[] {
    const filtered = options.filter(isModelOptionEligible);
    return Array.from(new Map(filtered.map((option) => [option.value, option])).values());
}
