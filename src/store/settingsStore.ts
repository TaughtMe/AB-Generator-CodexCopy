import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ══════════════════════════════════════════════════
   settingsStore.ts – Globale Einstellungen
   API-Key, Schulform, Fach, Lehrplan-Kontext,
   Design-Einstellungen (Schule, Logo, Header, Farben).
   Persistiert via Zustand persist → localStorage.
   ══════════════════════════════════════════════════ */

interface HeaderFields {
    showName: boolean;
    showDate: boolean;
    showClass: boolean;
}

export type AIProvider = 'gemini' | 'openai' | 'local';

export interface ProviderConfig {
    apiKey: string;
    model: string;
    baseUrl?: string;
    selectedModelIds: string[];
}

interface AIProviderSettings {
    gemini: ProviderConfig;
    openai: ProviderConfig;
    local: ProviderConfig;
}

type ThemeMode = 'light' | 'dark';

interface SettingsState {
    aiProvider: AIProvider;
    providers: AIProviderSettings;
    themeMode: ThemeMode;
    schoolType: string;
    subject: string;
    curriculumContext: string;
    // Design Settings
    schoolName: string;
    logoImageId: number | null;
    logoText: string;
    headerFields: HeaderFields;
    brandColor: string;
    fontFamily: string;
}

interface SettingsActions {
    setAIProvider: (provider: AIProvider) => void;
    setProviderApiKey: (provider: AIProvider, key: string) => void;
    setProviderModel: (provider: AIProvider, model: string) => void;
    setProviderBaseUrl: (provider: AIProvider, baseUrl: string) => void;
    setProviderSelectedModelIds: (provider: AIProvider, ids: string[]) => void;
    setThemeMode: (mode: ThemeMode) => void;
    toggleThemeMode: () => void;
    setSchoolType: (type: string) => void;
    setSubject: (subject: string) => void;
    setCurriculumContext: (context: string) => void;
    // Design Actions
    setSchoolName: (name: string) => void;
    setLogoImageId: (id: number | null) => void;
    setLogoText: (text: string) => void;
    setHeaderFields: (fields: Partial<HeaderFields>) => void;
    setBrandColor: (color: string) => void;
    setFontFamily: (font: string) => void;
}

type SettingsStore = SettingsState & SettingsActions;

/** Migrate legacy API key from old localStorage entry */
function migrateLegacyApiKey(): string {
    const legacy = localStorage.getItem('gemini-api-key');
    if (legacy) {
        localStorage.removeItem('gemini-api-key');
        return legacy;
    }
    return '';
}

const LEGACY_GEMINI_MODEL_MAP = {
    flash: 'gemini-2.5-flash',
    pro: 'gemini-3.0-pro',
} as const;

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => ({
            // State – legacy key gets migrated on first load
            aiProvider: 'gemini' as AIProvider,
            providers: {
                gemini: {
                    apiKey: migrateLegacyApiKey(),
                    model: 'gemini-2.5-flash',
                    selectedModelIds: [],
                },
                openai: {
                    apiKey: '',
                    model: 'gpt-5.2-mini',
                    baseUrl: 'https://api.openai.com/v1',
                    selectedModelIds: [],
                },
                local: {
                    apiKey: '',
                    model: 'qwen2.5-7b-instruct',
                    baseUrl: 'http://localhost:1234/v1',
                    selectedModelIds: [],
                },
            },
            themeMode: 'light' as ThemeMode,
            schoolType: '',
            subject: '',
            curriculumContext: '',
            // Design defaults
            schoolName: '',
            logoImageId: null,
            logoText: '',
            headerFields: { showName: true, showDate: true, showClass: true },
            brandColor: '#3b82f6',
            fontFamily: 'Inter',

            // Actions
            setAIProvider: (provider) => set({ aiProvider: provider }),
            setProviderApiKey: (provider, key) =>
                set((state) => ({
                    providers: {
                        ...state.providers,
                        [provider]: {
                            ...state.providers[provider],
                            apiKey: key,
                        },
                    },
                })),
            setProviderModel: (provider, model) =>
                set((state) => ({
                    providers: {
                        ...state.providers,
                        [provider]: {
                            ...state.providers[provider],
                            model,
                        },
                    },
                })),
            setProviderBaseUrl: (provider, baseUrl) =>
                set((state) => ({
                    providers: {
                        ...state.providers,
                        [provider]: {
                            ...state.providers[provider],
                            baseUrl,
                        },
                    },
                })),
            setProviderSelectedModelIds: (provider, ids) =>
                set((state) => ({
                    providers: {
                        ...state.providers,
                        [provider]: {
                            ...state.providers[provider],
                            selectedModelIds: Array.from(new Set(ids.filter(Boolean))),
                        },
                    },
                })),
            setThemeMode: (mode) => set({ themeMode: mode }),
            toggleThemeMode: () =>
                set((state) => ({
                    themeMode: state.themeMode === 'dark' ? 'light' : 'dark',
                })),
            setSchoolType: (type) => set({ schoolType: type }),
            setSubject: (subject) => set({ subject }),
            setCurriculumContext: (context) => set({ curriculumContext: context }),
            // Design Actions
            setSchoolName: (name) => set({ schoolName: name }),
            setLogoImageId: (id) => set({ logoImageId: id }),
            setLogoText: (text) => set({ logoText: text.slice(0, 3) }),
            setHeaderFields: (fields) =>
                set((s) => ({ headerFields: { ...s.headerFields, ...fields } })),
            setBrandColor: (color) => set({ brandColor: color }),
            setFontFamily: (font) => set({ fontFamily: font }),
        }),
        {
            name: 'ab-generator-settings',
            version: 4,
            migrate: (persistedState, version) => {
                if (!persistedState || typeof persistedState !== 'object') {
                    return persistedState as SettingsStore;
                }

                if (version >= 4) {
                    return persistedState as SettingsStore;
                }

                if (version === 3) {
                    const stateV3 = persistedState as SettingsStore;

                    return {
                        ...stateV3,
                        providers: {
                            ...stateV3.providers,
                            gemini: {
                                ...stateV3.providers.gemini,
                                selectedModelIds: stateV3.providers.gemini.selectedModelIds ?? [],
                            },
                            openai: {
                                ...stateV3.providers.openai,
                                selectedModelIds: stateV3.providers.openai.selectedModelIds ?? [],
                            },
                            local: {
                                ...stateV3.providers.local,
                                selectedModelIds: stateV3.providers.local.selectedModelIds ?? [],
                            },
                        },
                    } as SettingsStore;
                }

                if (version === 2) {
                    const stateV2 = persistedState as SettingsStore;
                    const geminiModel =
                        stateV2.providers?.gemini?.model === 'gemini-2.5-pro'
                            ? 'gemini-3.0-pro'
                            : stateV2.providers?.gemini?.model ?? 'gemini-2.5-flash';

                    const openaiModel = stateV2.providers?.openai?.model ?? 'gpt-5.2-mini';

                    return {
                        ...stateV2,
                        providers: {
                            ...stateV2.providers,
                            gemini: {
                                ...stateV2.providers.gemini,
                                model: geminiModel,
                                selectedModelIds: stateV2.providers.gemini.selectedModelIds ?? [],
                            },
                            openai: {
                                ...stateV2.providers.openai,
                                model: openaiModel,
                                selectedModelIds: stateV2.providers.openai.selectedModelIds ?? [],
                            },
                            local: {
                                ...stateV2.providers.local,
                                selectedModelIds: stateV2.providers.local.selectedModelIds ?? [],
                            },
                        },
                    } as SettingsStore;
                }

                const legacyState = persistedState as {
                    apiKey?: string;
                    geminiModel?: 'flash' | 'pro';
                    aiProvider?: AIProvider;
                    providers?: AIProviderSettings;
                };

                const mappedLegacyModel = legacyState.geminiModel
                    ? LEGACY_GEMINI_MODEL_MAP[legacyState.geminiModel] ?? 'gemini-2.5-flash'
                    : 'gemini-2.5-flash';

                return {
                    ...legacyState,
                    aiProvider: legacyState.aiProvider ?? 'gemini',
                    providers: {
                        gemini: {
                            apiKey: legacyState.apiKey ?? '',
                            model: mappedLegacyModel,
                            selectedModelIds: [],
                        },
                        openai: {
                            apiKey: '',
                            model: 'gpt-5.2-mini',
                            baseUrl: 'https://api.openai.com/v1',
                            selectedModelIds: [],
                        },
                        local: {
                            apiKey: '',
                            model: 'qwen2.5-7b-instruct',
                            baseUrl: 'http://localhost:1234/v1',
                            selectedModelIds: [],
                        },
                        ...(legacyState.providers ?? {}),
                    },
                } as SettingsStore;
            },
        }
    )
);
