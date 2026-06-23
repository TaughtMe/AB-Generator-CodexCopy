import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    normalizeDesignSnapshot,
    normalizeHeaderFields,
    type DesignSnapshot,
} from '../types/designTemplate';
import type { ModelRole } from '../features/ai/aiRoutes';

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

export type AIProvider = 'gemini' | 'openai' | 'openrouter' | 'local';
export type AIConnectionStatus = 'unknown' | 'testing' | 'ready' | 'error';

export interface ProviderConfig {
    apiKey: string;
    model: string;
    baseUrl?: string;
    selectedModelIds: string[];
}

interface AIProviderSettings {
    gemini: ProviderConfig;
    openai: ProviderConfig;
    openrouter: ProviderConfig;
    local: ProviderConfig;
}

type ThemeMode = 'light' | 'dark';

interface SettingsState {
    aiProvider: AIProvider;
    providers: AIProviderSettings;
    chatModelPreferences: Record<AIProvider, string>;
    /** Rollen→Modell-Zuordnung der Modellbibliothek. 'auto' = aktives Chat-Modell nutzen. */
    roleModelPreferences: Record<ModelRole, string>;
    themeMode: ThemeMode;
    schoolType: string;
    subject: string;
    curriculumContext: string;
    aiConnectionStatusByProvider: Record<AIProvider, AIConnectionStatus>;
    aiConnectionErrorByProvider: Record<AIProvider, string | null>;
    availableLocalModels: string[];
    isFetchingModels: boolean;
    submitOnEnter: boolean;
    /** Editor-Menüband (Ribbon) ein- oder ausgeklappt (Word-artig). */
    ribbonExpanded: boolean;
    /** Symbolleiste auf schmalen Bildschirmen kompakt (ohne Beschriftungen) darstellen. */
    compactRibbonOnNarrow: boolean;
    hasSeenOnboarding: boolean;
    // Design Settings
    schoolName: string;
    logoImageId: number | null;
    logoText: string;
    headerFields: HeaderFields;
    brandColor: string;
    fontFamily: string;
    showHeaderTitle: boolean;
    showWorksheetTitle: boolean;
    applyColorToTasks: boolean;
}

interface SettingsActions {
    setAIProvider: (provider: AIProvider) => void;
    setProviderApiKey: (provider: AIProvider, key: string) => void;
    setProviderModel: (provider: AIProvider, model: string) => void;
    setProviderBaseUrl: (provider: AIProvider, baseUrl: string) => void;
    setProviderSelectedModelIds: (provider: AIProvider, ids: string[]) => void;
    setChatModelPreference: (provider: AIProvider, model: string) => void;
    /** Setzt das Modell für eine KI-Rolle ('auto' oder leer → aktives Modell). */
    setRoleModelPreference: (role: ModelRole, model: string) => void;
    setThemeMode: (mode: ThemeMode) => void;
    toggleThemeMode: () => void;
    setSchoolType: (type: string) => void;
    setSubject: (subject: string) => void;
    setCurriculumContext: (context: string) => void;
    setAiConnectionStatus: (provider: AIProvider, status: AIConnectionStatus, error?: string | null) => void;
    refreshLocalModels: () => Promise<string[]>;
    setSubmitOnEnter: (value: boolean) => void;
    toggleRibbonExpanded: () => void;
    setRibbonExpanded: (value: boolean) => void;
    setCompactRibbonOnNarrow: (value: boolean) => void;
    completeOnboarding: () => void;
    restartOnboarding: () => void;
    // Design Actions
    setSchoolName: (name: string) => void;
    setLogoImageId: (id: number | null) => void;
    setLogoText: (text: string) => void;
    setHeaderFields: (fields: Partial<HeaderFields>) => void;
    setBrandColor: (color: string) => void;
    setFontFamily: (font: string) => void;
    setShowHeaderTitle: (value: boolean) => void;
    setShowWorksheetTitle: (value: boolean) => void;
    setApplyColorToTasks: (value: boolean) => void;
    getDesignSnapshot: () => DesignSnapshot;
    applyDesignSnapshot: (snapshot: Partial<DesignSnapshot>) => void;
}

type SettingsStore = SettingsState & SettingsActions;

type PersistedSettingsSlice = Omit<
    SettingsState,
    'aiConnectionStatusByProvider' | 'aiConnectionErrorByProvider' | 'availableLocalModels' | 'isFetchingModels'
>;

const MODEL_ROLES: ModelRole[] = ['fast', 'balanced', 'strong', 'cheap'];

function getDefaultRoleModelPreferences(): Record<ModelRole, string> {
    return { fast: 'auto', balanced: 'auto', strong: 'auto', cheap: 'auto' };
}

function sanitizeRoleModelPreferences(value: unknown): Record<ModelRole, string> {
    const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const result = getDefaultRoleModelPreferences();
    for (const role of MODEL_ROLES) {
        const raw = source[role];
        result[role] = typeof raw === 'string' && raw.trim() ? raw.trim() : 'auto';
    }
    return result;
}

function getDefaultAiConnectionStatusByProvider(): Record<AIProvider, AIConnectionStatus> {
    return {
        gemini: 'unknown',
        openai: 'unknown',
        openrouter: 'unknown',
        local: 'unknown',
    };
}

function getDefaultAiConnectionErrorByProvider(): Record<AIProvider, string | null> {
    return {
        gemini: null,
        openai: null,
        openrouter: null,
        local: null,
    };
}

function toPersistedSettingsSlice(state: SettingsStore): PersistedSettingsSlice {
    return {
        aiProvider: state.aiProvider,
        providers: state.providers,
        chatModelPreferences: state.chatModelPreferences,
        roleModelPreferences: state.roleModelPreferences,
        themeMode: state.themeMode,
        schoolType: state.schoolType,
        subject: state.subject,
        curriculumContext: state.curriculumContext,
        submitOnEnter: state.submitOnEnter,
        ribbonExpanded: state.ribbonExpanded,
        compactRibbonOnNarrow: state.compactRibbonOnNarrow,
        hasSeenOnboarding: state.hasSeenOnboarding,
        schoolName: state.schoolName,
        logoImageId: state.logoImageId,
        logoText: state.logoText,
        headerFields: state.headerFields,
        brandColor: state.brandColor,
        fontFamily: state.fontFamily,
        showHeaderTitle: state.showHeaderTitle,
        showWorksheetTitle: state.showWorksheetTitle,
        applyColorToTasks: state.applyColorToTasks,
    };
}

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
    flash: 'gemini-3.1-flash-lite-preview',
    pro: 'gemini-3.0-pro',
} as const;

const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const DEFAULT_OPENAI_MODEL = 'gpt-5.2-mini';
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4.1-mini';
const DEFAULT_LOCAL_MODEL = 'qwen2.5-7b-instruct';

const EXPLICIT_GEMINI_MODEL_IDS = new Set([
    'gemini-2.5-flash',
    'gemini-3.1-flash',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-pro',
    'gemini-3.0-pro',
    'gemini-3.1-pro',
]);

const DEFAULT_PROVIDER_MODELS: Record<AIProvider, string> = {
    gemini: DEFAULT_GEMINI_MODEL,
    openai: DEFAULT_OPENAI_MODEL,
    openrouter: DEFAULT_OPENROUTER_MODEL,
    local: DEFAULT_LOCAL_MODEL,
};

function sanitizeProviderModel(provider: AIProvider, model: string | undefined | null): string {
    const normalized = typeof model === 'string' ? model.trim() : '';

    if (provider === 'gemini') {
        return EXPLICIT_GEMINI_MODEL_IDS.has(normalized) ? normalized : DEFAULT_GEMINI_MODEL;
    }

    return normalized || DEFAULT_PROVIDER_MODELS[provider];
}

function sanitizeSelectedModelIds(provider: AIProvider, ids: string[] | undefined): string[] {
    const normalized = Array.from(new Set((ids ?? []).map((id) => id.trim()).filter(Boolean)));

    if (provider !== 'gemini') {
        return normalized;
    }

    return normalized.filter((id) => EXPLICIT_GEMINI_MODEL_IDS.has(id));
}

function sanitizeChatPreference(
    provider: AIProvider,
    preference: string | undefined,
    sanitizedProviderModel: string,
): string {
    const normalized = typeof preference === 'string' ? preference.trim() : '';
    if (!normalized || normalized === 'auto') return 'auto';

    if (provider !== 'gemini') {
        return normalized;
    }

    return EXPLICIT_GEMINI_MODEL_IDS.has(normalized) ? normalized : sanitizedProviderModel;
}

function sanitizeModelState<T extends SettingsStore>(state: T): T {
    const geminiConfig = state.providers?.gemini ?? {
        apiKey: '',
        model: DEFAULT_GEMINI_MODEL,
        selectedModelIds: [],
    };
    const openaiConfig = state.providers?.openai ?? {
        apiKey: '',
        model: DEFAULT_OPENAI_MODEL,
        baseUrl: 'https://api.openai.com/v1',
        selectedModelIds: [],
    };
    const openrouterConfig = state.providers?.openrouter ?? {
        apiKey: '',
        model: DEFAULT_OPENROUTER_MODEL,
        baseUrl: 'https://openrouter.ai/api/v1',
        selectedModelIds: [],
    };
    const localConfig = state.providers?.local ?? {
        apiKey: '',
        model: DEFAULT_LOCAL_MODEL,
        baseUrl: 'http://localhost:1234/v1',
        selectedModelIds: [],
    };

    const geminiModel = sanitizeProviderModel('gemini', geminiConfig.model);
    const openaiModel = sanitizeProviderModel('openai', openaiConfig.model);
    const openrouterModel = sanitizeProviderModel('openrouter', openrouterConfig.model);
    const localModel = sanitizeProviderModel('local', localConfig.model);

    return {
        ...state,
        providers: {
            ...state.providers,
            gemini: {
                ...geminiConfig,
                model: geminiModel,
                selectedModelIds: sanitizeSelectedModelIds('gemini', geminiConfig.selectedModelIds),
            },
            openai: {
                ...openaiConfig,
                model: openaiModel,
                selectedModelIds: sanitizeSelectedModelIds('openai', openaiConfig.selectedModelIds),
            },
            openrouter: {
                ...openrouterConfig,
                model: openrouterModel,
                selectedModelIds: sanitizeSelectedModelIds('openrouter', openrouterConfig.selectedModelIds),
            },
            local: {
                ...localConfig,
                model: localModel,
                selectedModelIds: sanitizeSelectedModelIds('local', localConfig.selectedModelIds),
            },
        },
        chatModelPreferences: {
            gemini: sanitizeChatPreference('gemini', state.chatModelPreferences?.gemini, geminiModel),
            openai: sanitizeChatPreference('openai', state.chatModelPreferences?.openai, openaiModel),
            openrouter: sanitizeChatPreference('openrouter', state.chatModelPreferences?.openrouter, openrouterModel),
            local: sanitizeChatPreference('local', state.chatModelPreferences?.local, localModel),
        },
        roleModelPreferences: sanitizeRoleModelPreferences(state.roleModelPreferences),
    };
}

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set, get) => ({
            // State – legacy key gets migrated on first load
            aiProvider: 'gemini' as AIProvider,
            providers: {
                gemini: {
                    apiKey: migrateLegacyApiKey(),
                    model: DEFAULT_GEMINI_MODEL,
                    selectedModelIds: [],
                },
                openai: {
                    apiKey: '',
                    model: DEFAULT_OPENAI_MODEL,
                    baseUrl: 'https://api.openai.com/v1',
                    selectedModelIds: [],
                },
                openrouter: {
                    apiKey: '',
                    model: DEFAULT_OPENROUTER_MODEL,
                    baseUrl: 'https://openrouter.ai/api/v1',
                    selectedModelIds: [],
                },
                local: {
                    apiKey: '',
                    model: DEFAULT_LOCAL_MODEL,
                    baseUrl: 'http://localhost:1234/v1',
                    selectedModelIds: [],
                },
            },
            chatModelPreferences: {
                gemini: 'auto',
                openai: 'auto',
                openrouter: 'auto',
                local: 'auto',
            },
            roleModelPreferences: getDefaultRoleModelPreferences(),
            themeMode: 'light' as ThemeMode,
            schoolType: '',
            subject: '',
            curriculumContext: '',
            aiConnectionStatusByProvider: getDefaultAiConnectionStatusByProvider(),
            aiConnectionErrorByProvider: getDefaultAiConnectionErrorByProvider(),
            availableLocalModels: [],
            isFetchingModels: false,
            submitOnEnter: true,
            ribbonExpanded: true,
            compactRibbonOnNarrow: true,
            hasSeenOnboarding: false,
            // Design defaults
            schoolName: '',
            logoImageId: null,
            logoText: '',
            headerFields: { showName: true, showDate: true, showClass: true },
            brandColor: '#3b82f6',
            fontFamily: 'Inter',
            showHeaderTitle: true,
            showWorksheetTitle: true,
            applyColorToTasks: true,

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
                            model: sanitizeProviderModel(provider, model),
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
                            selectedModelIds: sanitizeSelectedModelIds(provider, ids),
                        },
                    },
                })),
            setChatModelPreference: (provider, model) =>
                set((state) => {
                    const providerModel = sanitizeProviderModel(provider, state.providers[provider].model);
                    return {
                        chatModelPreferences: {
                            ...state.chatModelPreferences,
                            [provider]: sanitizeChatPreference(provider, model, providerModel),
                        },
                    };
                }),
            setRoleModelPreference: (role, model) =>
                set((state) => {
                    const normalized = typeof model === 'string' && model.trim() ? model.trim() : 'auto';
                    return {
                        roleModelPreferences: {
                            ...state.roleModelPreferences,
                            [role]: normalized,
                        },
                    };
                }),
            setThemeMode: (mode) => set({ themeMode: mode }),
            toggleThemeMode: () =>
                set((state) => ({
                    themeMode: state.themeMode === 'dark' ? 'light' : 'dark',
                })),
            setSchoolType: (type) => set({ schoolType: type }),
            setSubject: (subject) => set({ subject }),
            setCurriculumContext: (context) => set({ curriculumContext: context }),
            setAiConnectionStatus: (provider, status, error = null) =>
                set((state) => ({
                    aiConnectionStatusByProvider: {
                        ...state.aiConnectionStatusByProvider,
                        [provider]: status,
                    },
                    aiConnectionErrorByProvider: {
                        ...state.aiConnectionErrorByProvider,
                        [provider]: status === 'error' ? (error ?? 'Unbekannter Verbindungsfehler') : null,
                    },
                })),
            refreshLocalModels: async () => {
                const { providers } = get();
                const baseUrlRaw = providers.local.baseUrl?.trim() || 'http://localhost:1234/v1';
                const normalizedBaseUrl = /\/v1$/i.test(baseUrlRaw.replace(/\/$/, ''))
                    ? baseUrlRaw.replace(/\/$/, '')
                    : `${baseUrlRaw.replace(/\/$/, '')}/v1`;

                set({ isFetchingModels: true });
                try {
                    const response = await fetch(`${normalizedBaseUrl}/models`, {
                        headers: providers.local.apiKey?.trim()
                            ? { Authorization: `Bearer ${providers.local.apiKey}` }
                            : undefined,
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const payload = (await response.json()) as { data?: Array<{ id?: string }> };
                    const ids = Array.from(
                        new Set(
                            (payload.data ?? [])
                                .map((entry) => entry.id?.trim() ?? '')
                                .filter(Boolean),
                        ),
                    ).sort((a, b) => a.localeCompare(b));

                    set({
                        availableLocalModels: ids,
                    });

                    return ids;
                } catch {
                    set({
                        availableLocalModels: [],
                    });
                    return [];
                } finally {
                    set({ isFetchingModels: false });
                }
            },
            setSubmitOnEnter: (value) => set({ submitOnEnter: value }),
            toggleRibbonExpanded: () => set((s) => ({ ribbonExpanded: !s.ribbonExpanded })),
            setRibbonExpanded: (value) => set({ ribbonExpanded: value }),
            setCompactRibbonOnNarrow: (value) => set({ compactRibbonOnNarrow: value }),
            completeOnboarding: () => set({ hasSeenOnboarding: true }),
            restartOnboarding: () => set({ hasSeenOnboarding: false }),
            // Design Actions
            setSchoolName: (name) => set({ schoolName: name }),
            setLogoImageId: (id) => set({ logoImageId: id }),
            setLogoText: (text) => set({ logoText: text.slice(0, 3) }),
            setHeaderFields: (fields) =>
                set((s) => ({ headerFields: normalizeHeaderFields({ ...s.headerFields, ...fields }) })),
            setBrandColor: (color) => set({ brandColor: color }),
            setFontFamily: (font) => set({ fontFamily: font }),
            setShowHeaderTitle: (value) => set({ showHeaderTitle: value }),
            setShowWorksheetTitle: (value) => set({ showWorksheetTitle: value }),
            setApplyColorToTasks: (value) => set({ applyColorToTasks: value }),
            getDesignSnapshot: () => {
                const state = get();
                return normalizeDesignSnapshot({
                    schoolName: state.schoolName,
                    logoImageId: state.logoImageId,
                    logoText: state.logoText,
                    headerFields: state.headerFields,
                    brandColor: state.brandColor,
                    fontFamily: state.fontFamily,
                    showHeaderTitle: state.showHeaderTitle,
                    showWorksheetTitle: state.showWorksheetTitle,
                    applyColorToTasks: state.applyColorToTasks,
                });
            },
            applyDesignSnapshot: (snapshot) => {
                const normalized = normalizeDesignSnapshot(snapshot);
                set({
                    schoolName: normalized.schoolName,
                    logoImageId: normalized.logoImageId,
                    logoText: normalized.logoText,
                    headerFields: normalized.headerFields,
                    brandColor: normalized.brandColor,
                    fontFamily: normalized.fontFamily,
                    showHeaderTitle: normalized.showHeaderTitle,
                    showWorksheetTitle: normalized.showWorksheetTitle,
                    applyColorToTasks: normalized.applyColorToTasks,
                });
            },
        }),
        {
            name: 'ab-generator-settings',
            version: 9,
            partialize: (state) => toPersistedSettingsSlice(state),
            merge: (persistedState, currentState) => {
                const persisted = (persistedState ?? {}) as Partial<SettingsStore>;
                const merged = {
                    ...currentState,
                    ...persisted,
                    providers: {
                        ...currentState.providers,
                        ...(persisted.providers ?? {}),
                    },
                    chatModelPreferences: {
                        ...currentState.chatModelPreferences,
                        ...(persisted.chatModelPreferences ?? {}),
                    },
                    roleModelPreferences: {
                        ...currentState.roleModelPreferences,
                        ...(persisted.roleModelPreferences ?? {}),
                    },
                } as SettingsStore;

                return sanitizeModelState(merged);
            },
            migrate: (persistedState, version) => {
                if (!persistedState || typeof persistedState !== 'object') {
                    return persistedState as SettingsStore;
                }

                if (version >= 8) {
                    return sanitizeModelState(persistedState as SettingsStore);
                }

                if (version === 7) {
                    return sanitizeModelState(persistedState as SettingsStore);
                }

                if (version === 6) {
                    const stateV6 = persistedState as Partial<SettingsState> & Record<string, unknown>;
                    const {
                        aiConnectionStatusByProvider: _ignoredStatus,
                        aiConnectionErrorByProvider: _ignoredError,
                        availableLocalModels: _ignoredModels,
                        isFetchingModels: _ignoredFetching,
                        ...rest
                    } = stateV6;

                    void _ignoredStatus;
                    void _ignoredError;
                    void _ignoredModels;
                    void _ignoredFetching;

                    return sanitizeModelState({
                        ...rest,
                        submitOnEnter: typeof rest.submitOnEnter === 'boolean' ? rest.submitOnEnter : true,
                        ribbonExpanded: typeof rest.ribbonExpanded === 'boolean' ? rest.ribbonExpanded : true,
                        compactRibbonOnNarrow: typeof rest.compactRibbonOnNarrow === 'boolean' ? rest.compactRibbonOnNarrow : true,
                        hasSeenOnboarding: typeof rest.hasSeenOnboarding === 'boolean' ? rest.hasSeenOnboarding : false,
                    } as SettingsStore);
                }

                if (version === 5) {
                    const stateV5 = persistedState as SettingsStore;
                    return sanitizeModelState({
                        ...stateV5,
                        chatModelPreferences: {
                            gemini: stateV5.chatModelPreferences?.gemini ?? 'auto',
                            openai: stateV5.chatModelPreferences?.openai ?? 'auto',
                            openrouter: stateV5.chatModelPreferences?.openrouter ?? 'auto',
                            local: stateV5.chatModelPreferences?.local ?? 'auto',
                        },
                    } as SettingsStore);
                }

                if (version === 4) {
                    const stateV4 = persistedState as SettingsStore;
                    return sanitizeModelState({
                        ...stateV4,
                        chatModelPreferences: {
                            gemini: stateV4.chatModelPreferences?.gemini ?? 'auto',
                            openai: stateV4.chatModelPreferences?.openai ?? 'auto',
                            openrouter: stateV4.chatModelPreferences?.openrouter ?? 'auto',
                            local: stateV4.chatModelPreferences?.local ?? 'auto',
                        },
                        showHeaderTitle: stateV4.showHeaderTitle ?? true,
                        showWorksheetTitle: stateV4.showWorksheetTitle ?? true,
                        applyColorToTasks: stateV4.applyColorToTasks ?? true,
                    } as SettingsStore);
                }

                if (version === 3) {
                    const stateV3 = persistedState as SettingsStore;

                    return sanitizeModelState({
                        ...stateV3,
                        chatModelPreferences: {
                            gemini: stateV3.chatModelPreferences?.gemini ?? 'auto',
                            openai: stateV3.chatModelPreferences?.openai ?? 'auto',
                            openrouter: stateV3.chatModelPreferences?.openrouter ?? 'auto',
                            local: stateV3.chatModelPreferences?.local ?? 'auto',
                        },
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
                            openrouter: {
                                ...stateV3.providers.openrouter,
                                selectedModelIds: stateV3.providers.openrouter?.selectedModelIds ?? [],
                            },
                            local: {
                                ...stateV3.providers.local,
                                selectedModelIds: stateV3.providers.local.selectedModelIds ?? [],
                            },
                        },
                    } as SettingsStore);
                }

                if (version === 2) {
                    const stateV2 = persistedState as SettingsStore;
                    const geminiModel =
                        stateV2.providers?.gemini?.model === 'gemini-2.5-pro'
                            ? 'gemini-3.0-pro'
                            : stateV2.providers?.gemini?.model ?? DEFAULT_GEMINI_MODEL;

                    const openaiModel = stateV2.providers?.openai?.model ?? DEFAULT_OPENAI_MODEL;

                    return sanitizeModelState({
                        ...stateV2,
                        chatModelPreferences: {
                            gemini: stateV2.chatModelPreferences?.gemini ?? 'auto',
                            openai: stateV2.chatModelPreferences?.openai ?? 'auto',
                            openrouter: stateV2.chatModelPreferences?.openrouter ?? 'auto',
                            local: stateV2.chatModelPreferences?.local ?? 'auto',
                        },
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
                            openrouter: {
                                ...stateV2.providers.openrouter,
                                model: stateV2.providers.openrouter?.model ?? DEFAULT_OPENROUTER_MODEL,
                                baseUrl: stateV2.providers.openrouter?.baseUrl ?? 'https://openrouter.ai/api/v1',
                                selectedModelIds: stateV2.providers.openrouter?.selectedModelIds ?? [],
                            },
                            local: {
                                ...stateV2.providers.local,
                                selectedModelIds: stateV2.providers.local.selectedModelIds ?? [],
                            },
                        },
                    } as SettingsStore);
                }

                const legacyState = persistedState as {
                    apiKey?: string;
                    geminiModel?: 'flash' | 'pro';
                    aiProvider?: AIProvider;
                    providers?: AIProviderSettings;
                };

                const mappedLegacyModel = legacyState.geminiModel
                    ? LEGACY_GEMINI_MODEL_MAP[legacyState.geminiModel] ?? DEFAULT_GEMINI_MODEL
                    : DEFAULT_GEMINI_MODEL;

                return sanitizeModelState({
                    ...legacyState,
                    aiProvider: legacyState.aiProvider ?? 'gemini',
                    chatModelPreferences: {
                        gemini: 'auto',
                        openai: 'auto',
                        openrouter: 'auto',
                        local: 'auto',
                    },
                    providers: {
                        gemini: {
                            apiKey: legacyState.apiKey ?? '',
                            model: mappedLegacyModel,
                            selectedModelIds: [],
                        },
                        openai: {
                            apiKey: '',
                            model: DEFAULT_OPENAI_MODEL,
                            baseUrl: 'https://api.openai.com/v1',
                            selectedModelIds: [],
                        },
                        openrouter: {
                            apiKey: '',
                            model: DEFAULT_OPENROUTER_MODEL,
                            baseUrl: 'https://openrouter.ai/api/v1',
                            selectedModelIds: [],
                        },
                        local: {
                            apiKey: '',
                            model: DEFAULT_LOCAL_MODEL,
                            baseUrl: 'http://localhost:1234/v1',
                            selectedModelIds: [],
                        },
                        ...(legacyState.providers ?? {}),
                    },
                } as SettingsStore);
            },
        }
    )
);
