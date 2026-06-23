import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Cpu, Database, Globe, Loader2, MessageSquare, Moon, Plus, RefreshCw, Settings, Sun, Trash2, Type, XCircle } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { PROVIDER_LABELS } from '../../services/ai/modelCatalog';
import { useProviderModels } from '../../hooks/useProviderModels';
import { exportLocalBackup, importLocalBackup } from '../../utils/dataManagement';
import { clearAllIndexedDbData } from '../../store/dexieStore';
import { ICON_SIZES } from '../ui/iconSizes';
import { FontUpload } from './FontUpload';
import { CloudBackupSettings } from './CloudBackupSettings';
import { ModelLibrarySettings } from './ModelLibrarySettings';
import { useShallow } from 'zustand/react/shallow';

type SettingsTab = 'display' | 'fonts' | 'ai' | 'chat' | 'data' | 'language' | 'legal';

const TABS: Array<{ id: SettingsTab; labelKey: string; icon: React.ElementType }> = [
    { id: 'display', labelKey: 'settings.tabs.display', icon: Sun },
    { id: 'fonts', labelKey: 'settings.tabs.fonts', icon: Type },
    { id: 'ai', labelKey: 'settings.tabs.ai', icon: Cpu },
    { id: 'chat', labelKey: 'settings.tabs.chat', icon: MessageSquare },
    { id: 'data', labelKey: 'settings.tabs.data', icon: Database },
    { id: 'language', labelKey: 'settings.tabs.language', icon: Globe },
    { id: 'legal', labelKey: 'settings.tabs.legal', icon: Settings },
];

const PROVIDER_PRESETS = [
    { id: 'custom', label: 'Benutzerdefiniert (Eigene URL)', name: '', baseUrl: '' },
    { id: 'openai', label: 'OpenAI (ChatGPT)', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
    { id: 'google', label: 'Google Gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/' },
    { id: 'mistral', label: 'Mistral AI', name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1' },
    { id: 'groq', label: 'Groq (High-Speed)', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
    { id: 'anthropic', label: 'Anthropic Claude (via OpenRouter)', name: 'Claude (OpenRouter)', baseUrl: 'https://openrouter.ai/api/v1' },
    { id: 'lmstudio', label: 'Lokales LM Studio', name: 'LM Studio', baseUrl: 'http://localhost:1234/v1' },
];

const formatModelName = (rawId: string) => rawId.split('/').pop() || rawId;
type ProviderModelLoadStatus = 'loading' | 'success' | 'error';
type ProviderModelLoadState = Record<string, { status: ProviderModelLoadStatus; message: string }>;

export const SettingsView: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState<SettingsTab>('display');
    const [dataActionError, setDataActionError] = useState<string | null>(null);
    const [dataActionInfo, setDataActionInfo] = useState<string | null>(null);
    const [isDataActionRunning, setIsDataActionRunning] = useState(false);
    const [isConfirmingReset, setIsConfirmingReset] = useState(false);
    const [providerModelLoadState, setProviderModelLoadState] = useState<ProviderModelLoadState>({});
    const backupFileInputRef = useRef<HTMLInputElement | null>(null);

    const aiProvider = useSettingsStore((state) => state.aiProvider);
    const providers = useSettingsStore((state) => state.providers);
    const themeMode = useSettingsStore((state) => state.themeMode);
    const chatModelPreferences = useSettingsStore((state) => state.chatModelPreferences);
    const submitOnEnter = useSettingsStore((state) => state.submitOnEnter);

    const setThemeMode = useSettingsStore((state) => state.setThemeMode);
    const compactRibbonOnNarrow = useSettingsStore((state) => state.compactRibbonOnNarrow);
    const setCompactRibbonOnNarrow = useSettingsStore((state) => state.setCompactRibbonOnNarrow);
    const setChatModelPreference = useSettingsStore((state) => state.setChatModelPreference);
    const setSubmitOnEnter = useSettingsStore((state) => state.setSubmitOnEnter);
    const restartOnboarding = useSettingsStore((state) => state.restartOnboarding);
    const {
        customProviders,
        availableModels,
        quickAccessModels,
        addProvider,
        updateProvider,
        removeProvider,
        toggleQuickAccessModel,
        fetchModelsForProvider,
    } = useWorkspaceStore(useShallow((state) => ({
        customProviders: state.providers,
        availableModels: state.availableModels,
        quickAccessModels: state.quickAccessModels,
        addProvider: state.addProvider,
        updateProvider: state.updateProvider,
        removeProvider: state.removeProvider,
        toggleQuickAccessModel: state.toggleQuickAccessModel,
        fetchModelsForProvider: state.fetchModelsForProvider,
    })));

    const activeConfig = providers[aiProvider];
    const {
        models: detectedProviderModels,
        isLoading: isLoadingProviderModels,
        error: providerModelsError,
        reload: reloadProviderModels,
    } = useProviderModels(aiProvider, true);

    const chatPreference = chatModelPreferences[aiProvider] ?? 'auto';
    const effectiveChatModel = chatPreference === 'auto' ? activeConfig.model : chatPreference;

    async function handleBackupDownload() {
        setIsConfirmingReset(false);
        setDataActionError(null);
        setDataActionInfo(null);
        setIsDataActionRunning(true);
        try {
            await exportLocalBackup();
            setDataActionInfo('Backup wurde als JSON-Datei heruntergeladen. Bilddaten sind bewusst ausgeschlossen.');
        } catch (error) {
            setDataActionError(error instanceof Error ? error.message : 'Backup konnte nicht erstellt werden.');
        } finally {
            setIsDataActionRunning(false);
        }
    }

    function handleRestoreClick() {
        setIsConfirmingReset(false);
        setDataActionError(null);
        setDataActionInfo(null);
        backupFileInputRef.current?.click();
    }

    async function handleRestoreFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setIsConfirmingReset(false);
        setDataActionError(null);
        setDataActionInfo('Backup wird wiederhergestellt. Die Seite wird danach neu geladen.');
        setIsDataActionRunning(true);
        try {
            await importLocalBackup(file);
        } catch (error) {
            setDataActionError(error instanceof Error ? error.message : 'Backup konnte nicht importiert werden.');
            setIsDataActionRunning(false);
        }
    }

    async function handleDeleteAllLocalData() {
        setDataActionError(null);
        if (!isConfirmingReset) {
            setIsConfirmingReset(true);
            setDataActionInfo('Erneut klicken, um alle lokalen Daten endgültig zu löschen.');
            return;
        }

        setIsConfirmingReset(false);
        setDataActionInfo('Lokale Daten werden gelöscht. Die Seite wird danach neu geladen.');
        setIsDataActionRunning(true);
        try {
            await clearAllIndexedDbData();
            await Promise.resolve().then(() => {
                localStorage.clear();
            });
            window.location.reload();
        } catch (error) {
            setDataActionError(error instanceof Error ? error.message : 'Lokale Daten konnten nicht gelöscht werden.');
            setIsDataActionRunning(false);
        }
    }

    function handleRestartOnboarding() {
        restartOnboarding();
        localStorage.removeItem('onboarding_completed');
        localStorage.removeItem('tour_completed_dashboard');
        localStorage.removeItem('tour_completed_editor');
        window.location.reload();
    }

    async function handleFetchModelsForProvider(providerId: string) {
        setProviderModelLoadState((state) => ({
            ...state,
            [providerId]: { status: 'loading', message: 'Modelle werden geladen...' },
        }));

        try {
            const models = await fetchModelsForProvider(providerId);
            setProviderModelLoadState((state) => ({
                ...state,
                [providerId]: {
                    status: 'success',
                    message: `${models.length} ${models.length === 1 ? 'Modell' : 'Modelle'} geladen. Wähle sie unten für Quick Access aus.`,
                },
            }));
        } catch (error) {
            setProviderModelLoadState((state) => ({
                ...state,
                [providerId]: {
                    status: 'error',
                    message: error instanceof Error ? error.message : 'Modelle konnten nicht geladen werden.',
                },
            }));
        }
    }

    return (
        <div className="w-full h-full p-8 max-w-5xl mx-auto bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200">
            <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Globale Einstellungen</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Zentral für Dashboard, Editor und KI-Funktionen.</p>
            </div>

            <div className="flex gap-6 min-h-0 h-[calc(100%-4rem)]">
                <aside className="w-56 shrink-0">
                    <nav className="space-y-1">
                        {TABS.map(({ id, labelKey, icon: Icon }) => {
                            const active = activeTab === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => setActiveTab(id)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                                        active
                                            ? 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white'
                                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Icon className={ICON_SIZES[16]} />
                                    {t(labelKey)}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                <section className="flex-1 overflow-y-auto">
                    {activeTab === 'display' && (
                        <div className="max-w-2xl space-y-4">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Anzeige</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Hier stellst du das Erscheinungsbild der App ein.</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    onClick={() => setThemeMode('light')}
                                    className={`flex items-center gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                                        themeMode === 'light'
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                                            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                                    }`}
                                >
                                    <Sun className={`${ICON_SIZES[18]} text-amber-500`} />
                                    <div className="text-left">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Light Mode</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Heller Hintergrund</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setThemeMode('dark')}
                                    className={`flex items-center gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                                        themeMode === 'dark'
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                                            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                                    }`}
                                >
                                    <Moon className={`${ICON_SIZES[18]} text-indigo-500`} />
                                    <div className="text-left">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Dark Mode</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Dunkler Hintergrund</p>
                                    </div>
                                </button>
                            </div>

                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800/40 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Kompakte Symbolleiste</p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Blendet auf schmalen Bildschirmen die Beschriftungen aus und rückt die Werkzeuge enger zusammen. Deaktivieren, um die Beschriftungen immer anzuzeigen.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={compactRibbonOnNarrow}
                                    onClick={() => setCompactRibbonOnNarrow(!compactRibbonOnNarrow)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                        compactRibbonOnNarrow ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                                    }`}
                                    title={compactRibbonOnNarrow ? 'Kompaktmodus deaktivieren' : 'Kompaktmodus aktivieren'}
                                >
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                        compactRibbonOnNarrow ? 'translate-x-5' : 'translate-x-1'
                                    }`} />
                                </button>
                            </div>

                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800/40">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Onboarding & Hilfe</p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Starte die Einführung erneut, wenn du die wichtigsten Bereiche der App noch einmal sehen möchtest.
                                </p>
                                <button
                                    onClick={handleRestartOnboarding}
                                    className="mt-3 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                >
                                    Tour erneut starten
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'fonts' && (
                        <FontUpload />
                    )}

                    {activeTab === 'ai' && (
                        <div className="max-w-2xl space-y-4">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">KI</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Füge beliebige OpenAI-kompatible API-Anbieter hinzu und lade deren Modelle in die Quick-Access-Auswahl.</p>

                            <button
                                type="button"
                                onClick={() => addProvider()}
                                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                            >
                                <Plus className="h-4 w-4" />
                                Neuen API-Anbieter hinzufügen
                            </button>

                            <div className="space-y-4">
                                {customProviders.map((provider) => {
                                    const loadState = providerModelLoadState[provider.id];
                                    const isLoadingModels = loadState?.status === 'loading';

                                    return (
                                    <div key={provider.id} className="bg-slate-800 border border-slate-700 p-5 rounded-xl mb-4 relative space-y-3">
                                        <button
                                            type="button"
                                            onClick={() => removeProvider(provider.id)}
                                            className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors cursor-pointer"
                                            title="Anbieter entfernen"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>

                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Schnell-Auswahl (Vorlage)</label>
                                            <select
                                                value={provider.presetId ?? 'custom'}
                                                onChange={(e) => {
                                                    const preset = PROVIDER_PRESETS.find((p) => p.id === e.target.value);
                                                    if (!preset) return;
                                                    if (preset.id === 'custom') {
                                                        updateProvider(provider.id, { presetId: 'custom' });
                                                    } else {
                                                        updateProvider(provider.id, { presetId: preset.id, name: preset.name, baseUrl: preset.baseUrl });
                                                    }
                                                }}
                                                className="w-full px-3 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-200 cursor-pointer"
                                            >
                                                {PROVIDER_PRESETS.map((preset) => (
                                                    <option key={preset.id} value={preset.id}>{preset.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">Anzeigename</label>
                                            <input
                                                type="text"
                                                value={provider.name}
                                                onChange={(e) => updateProvider(provider.id, { name: e.target.value })}
                                                disabled={provider.presetId !== 'custom' && !!provider.presetId}
                                                placeholder="z.B. Groq, HuggingFace, LM Studio …"
                                                className={`w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${provider.presetId !== 'custom' && provider.presetId ? 'bg-slate-900/50 text-slate-500 cursor-not-allowed border-transparent' : 'bg-slate-900 text-slate-200 border border-slate-700'}`}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">Base-URL</label>
                                            <input
                                                type="text"
                                                value={provider.baseUrl}
                                                onChange={(e) => updateProvider(provider.id, { baseUrl: e.target.value })}
                                                disabled={provider.presetId !== 'custom' && !!provider.presetId}
                                                placeholder="https://api.openai.com/v1"
                                                className={`w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${provider.presetId !== 'custom' && provider.presetId ? 'bg-slate-900/50 text-slate-500 cursor-not-allowed border-transparent' : 'bg-slate-900 text-slate-200 border border-slate-700'}`}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">API-Key</label>
                                            <input
                                                type="password"
                                                value={provider.apiKey}
                                                onChange={(e) => updateProvider(provider.id, { apiKey: e.target.value })}
                                                placeholder="sk-…"
                                                className="w-full px-3 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-200"
                                            />
                                        </div>

                                        <div className="pt-1">
                                            <button
                                                type="button"
                                                onClick={() => { void handleFetchModelsForProvider(provider.id); }}
                                                disabled={!provider.baseUrl.trim() || isLoadingModels}
                                                className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                            >
                                                {isLoadingModels && <Loader2 className={`${ICON_SIZES[14]} animate-spin`} />}
                                                {isLoadingModels ? 'Lade Modelle...' : 'Modelle laden'}
                                            </button>
                                            {loadState && (
                                                <div
                                                    className={`mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${
                                                        loadState.status === 'success'
                                                            ? 'border-emerald-900/50 bg-emerald-900/20 text-emerald-300'
                                                            : loadState.status === 'error'
                                                                ? 'border-red-900/50 bg-red-900/20 text-red-300'
                                                                : 'border-slate-700 bg-slate-900/40 text-slate-300'
                                                    }`}
                                                    title={loadState.message}
                                                >
                                                    {loadState.status === 'success' && <CheckCircle2 className={ICON_SIZES[12]} />}
                                                    {loadState.status === 'error' && <XCircle className={ICON_SIZES[12]} />}
                                                    {loadState.status === 'loading' && <Loader2 className={`${ICON_SIZES[12]} animate-spin`} />}
                                                    <span className="truncate">{loadState.message}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>

                            <div className="rounded-xl border border-slate-700 p-4 bg-slate-800/40 space-y-3">
                                <p className="text-xs font-semibold text-slate-300">Quick Access Modelle</p>
                                {availableModels.length === 0 ? (
                                    <p className="text-sm text-slate-400">Bitte einen Anbieter anlegen, API-Key eintragen und Modelle laden.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {availableModels.map((model) => {
                                            const providerName = customProviders.find((p) => p.id === model.providerId)?.name || model.providerId;
                                            return (
                                                <label
                                                    key={model.id}
                                                    className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 cursor-pointer hover:bg-slate-800"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={quickAccessModels.includes(model.id)}
                                                        onChange={() => toggleQuickAccessModel(model.id)}
                                                        className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-blue-500 focus:ring-blue-500/50"
                                                    />
                                                    <span className="inline-flex items-center gap-2 min-w-0">
                                                        <span className="shrink-0 rounded-md bg-slate-700 text-slate-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                                                            {providerName}
                                                        </span>
                                                        <span className="truncate" title={model.id}>{formatModelName(model.name)}</span>
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'chat' && (
                        <div className="max-w-2xl space-y-4">
                            <h3 className="text-base font-semibold text-slate-100">KI-Chat</h3>
                            <p className="text-sm text-slate-400">Lege fest, welches Modell der Chat bevorzugt nutzt. „Auto" nimmt das Standardmodell aus dem KI-Tab.</p>

                            <div className="rounded-xl border border-slate-700 p-4 bg-slate-800/40">
                                <p className="text-xs text-slate-400 mb-2">Aktiver Anbieter: <span className="font-semibold text-slate-200">{PROVIDER_LABELS[aiProvider]}</span></p>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Bevorzugtes Chat-Modell</label>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={chatPreference}
                                        onChange={(e) => setChatModelPreference(aiProvider, e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-200 cursor-pointer"
                                    >
                                        <option value="auto">Auto (nutzt Standardmodell)</option>
                                        {quickAccessModels.map((modelId) => (
                                            <option key={modelId} value={modelId}>{formatModelName(modelId)}</option>
                                        ))}
                                    </select>
                                    {aiProvider === 'local' && (
                                        <button
                                            type="button"
                                            onClick={() => void reloadProviderModels()}
                                            disabled={isLoadingProviderModels}
                                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                            title="Lokale Modelle aktualisieren"
                                            aria-label="Lokale Modelle aktualisieren"
                                        >
                                            <RefreshCw className={`${ICON_SIZES[16]} ${isLoadingProviderModels ? 'animate-spin' : ''}`} />
                                        </button>
                                    )}
                                </div>
                                {aiProvider === 'local' && (
                                    <div className="mt-2 min-h-5">
                                        {providerModelsError ? (
                                            <div
                                                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-red-900/50 bg-red-900/20 px-2 py-1 text-[11px] text-red-300"
                                                title={providerModelsError}
                                            >
                                                <XCircle className={ICON_SIZES[12]} />
                                                <span className="max-w-[28rem] truncate">{providerModelsError}</span>
                                            </div>
                                        ) : detectedProviderModels.length > 0 ? (
                                            <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-900/50 bg-emerald-900/20 px-2 py-1 text-[11px] text-emerald-300">
                                                <CheckCircle2 className={ICON_SIZES[12]} />
                                                <span>{detectedProviderModels.length} lokale Modelle geladen</span>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400">LM Studio starten, Server aktivieren und dann lokale Modelle aktualisieren.</p>
                                        )}
                                    </div>
                                )}
                                <p className="mt-2 text-xs text-slate-400">Aktiv für den Chat: {effectiveChatModel}</p>
                            </div>

                            <ModelLibrarySettings
                                modelOptions={quickAccessModels}
                                providerLabel={PROVIDER_LABELS[aiProvider]}
                            />

                            <div className="rounded-xl border border-slate-700 p-4 bg-slate-800/40">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-200">Enter sendet Nachricht</p>
                                        <p className="text-xs text-slate-400">Wenn aktiv: <strong>Enter</strong> sendet, <strong>Shift+Enter</strong> macht Zeilenumbruch.</p>
                                    </div>
                                    <button
                                        onClick={() => setSubmitOnEnter(!submitOnEnter)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                            submitOnEnter ? 'bg-blue-600' : 'bg-slate-600'
                                        }`}
                                        aria-label="Enter sendet Nachricht"
                                    >
                                        <span
                                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                                submitOnEnter ? 'translate-x-5' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'data' && (
                        <div className="max-w-2xl space-y-4">
                            <h3 className="text-base font-semibold text-slate-100">Datenverwaltung</h3>
                            <div className="rounded-xl border border-slate-700 p-4 bg-slate-800/40 space-y-3">
                                <p className="text-sm text-slate-200">Alle Daten werden lokal im Browser gespeichert (LocalStorage + IndexedDB).</p>
                                <p className="text-xs text-slate-400">Backups enthalten Arbeitsblätter, Einstellungen und Vorlagen. Bilddaten werden in dieser Version nicht exportiert.</p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                    <div className="rounded-lg border border-slate-700 p-2 bg-slate-900/40">
                                        <p className="font-semibold text-slate-200 mb-1">Wird gesichert</p>
                                        <ul className="space-y-1 text-slate-300">
                                            <li>Arbeitsblätter</li>
                                            <li>Globale Einstellungen</li>
                                            <li>Design-Vorlagen (ohne Bilder)</li>
                                        </ul>
                                    </div>
                                    <div className="rounded-lg border border-slate-700 p-2 bg-slate-900/40">
                                        <p className="font-semibold text-slate-200 mb-1">Nicht enthalten</p>
                                        <ul className="space-y-1 text-slate-300">
                                            <li>Bilddaten (Blob/Base64)</li>
                                            <li>Externe Dienste/Cloud-Daten</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 pt-1">
                                    <button
                                        onClick={handleBackupDownload}
                                        disabled={isDataActionRunning}
                                        className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        Backup herunterladen
                                    </button>

                                    <button
                                        onClick={handleRestoreClick}
                                        disabled={isDataActionRunning}
                                        className="px-3 py-2 text-xs rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        Backup wiederherstellen
                                    </button>

                                    <button
                                        onClick={handleDeleteAllLocalData}
                                        disabled={isDataActionRunning}
                                        className={`px-3 py-2 text-xs rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                                            isConfirmingReset
                                                ? 'border-red-600 bg-red-600 text-white hover:bg-red-700 motion-safe:animate-pulse'
                                                : 'border-slate-700 text-slate-200 hover:bg-slate-700'
                                        }`}
                                    >
                                        {isConfirmingReset ? 'Wirklich löschen?' : 'Alle lokalen Daten löschen'}
                                    </button>
                                </div>

                                <input
                                    ref={backupFileInputRef}
                                    type="file"
                                    accept="application/json,.json,.worksheet"
                                    onChange={handleRestoreFileChange}
                                    className="hidden"
                                />

                                {dataActionInfo && (
                                    <p className="text-xs text-slate-400">{dataActionInfo}</p>
                                )}

                                {dataActionError && (
                                    <p className="text-xs text-red-300">{dataActionError}</p>
                                )}
                            </div>

                            {/* ── Cloud-Backup ── */}
                            <CloudBackupSettings />
                        </div>
                    )}

                    {activeTab === 'language' && (
                        <div className="max-w-2xl space-y-4">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('settings.language')}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.tabs.language')}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
                                    { code: 'en', label: 'English', flag: '🇬🇧' },
                                    { code: 'es', label: 'Español', flag: '🇪🇸' },
                                    { code: 'fr', label: 'Français', flag: '🇫🇷' },
                                ].map((lang) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => i18n.changeLanguage(lang.code)}
                                        className={`flex items-center gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                                            i18n.resolvedLanguage === lang.code
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                                                : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        <span className="text-2xl">{lang.flag}</span>
                                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{lang.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'legal' && (
                        <div className="max-w-2xl space-y-4">
                            <h3 className="text-base font-semibold text-slate-100">Rechtliches & Kontakt</h3>
                            <div className="space-y-3">
                                <div className="rounded-xl border border-slate-700 p-4">
                                    <p className="text-sm font-semibold text-slate-100">Kontakt</p>
                                    <p className="text-sm text-slate-400">Support und Rückfragen: Toby.Bryson@schule.bayern.de</p>
                                </div>
                                <div className="rounded-xl border border-slate-700 p-4">
                                    <p className="text-sm font-semibold text-slate-100">Impressum</p>
                                    <p className="text-sm text-slate-400">Vollständige Angaben sind über den Sidebar-Link „Impressum" erreichbar.</p>
                                </div>
                                <div className="rounded-xl border border-slate-700 p-4 bg-blue-500/10">
                                    <p className="text-sm font-semibold text-slate-100">Datenschutz</p>
                                    <p className="text-sm text-slate-300">Hinweise zu lokaler Speicherung, optionaler KI-Nutzung und externen Diensten stehen in der Sidebar unter „Datenschutz".</p>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};
