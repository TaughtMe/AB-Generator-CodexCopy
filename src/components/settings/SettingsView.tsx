import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Cpu, Database, Loader2, MessageSquare, Moon, RefreshCw, Settings, Sun, Type, XCircle } from 'lucide-react';
import { useSettingsStore, type AIProvider } from '../../store/settingsStore';
import { PROVIDER_LABELS, PROVIDER_MODEL_OPTIONS } from '../../services/ai/modelCatalog';
import { testConnection } from '../../services/aiService';
import { useProviderModels } from '../../hooks/useProviderModels';
import { exportLocalBackup, importLocalBackup } from '../../utils/dataManagement';
import { clearAllIndexedDbData } from '../../store/dexieStore';
import { ICON_SIZES } from '../ui/iconSizes';
import { FontUpload } from './FontUpload';

type SettingsTab = 'display' | 'fonts' | 'ai' | 'chat' | 'data' | 'legal';

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ElementType }> = [
    { id: 'display', label: 'Anzeige', icon: Sun },
    { id: 'fonts', label: 'Schriftarten', icon: Type },
    { id: 'ai', label: 'KI', icon: Cpu },
    { id: 'chat', label: 'KI-Chat', icon: MessageSquare },
    { id: 'data', label: 'Datenverwaltung', icon: Database },
    { id: 'legal', label: 'Rechtliches & Kontakt', icon: Settings },
];

const PROVIDERS: AIProvider[] = ['gemini', 'openai', 'openrouter', 'local'];

export const SettingsView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('display');
    const [dataActionError, setDataActionError] = useState<string | null>(null);
    const [dataActionInfo, setDataActionInfo] = useState<string | null>(null);
    const [isDataActionRunning, setIsDataActionRunning] = useState(false);
    const [isConfirmingReset, setIsConfirmingReset] = useState(false);
    const backupFileInputRef = useRef<HTMLInputElement | null>(null);

    const aiProvider = useSettingsStore((state) => state.aiProvider);
    const providers = useSettingsStore((state) => state.providers);
    const themeMode = useSettingsStore((state) => state.themeMode);
    const chatModelPreferences = useSettingsStore((state) => state.chatModelPreferences);
    const aiConnectionStatusByProvider = useSettingsStore((state) => state.aiConnectionStatusByProvider);
    const aiConnectionErrorByProvider = useSettingsStore((state) => state.aiConnectionErrorByProvider);
    const submitOnEnter = useSettingsStore((state) => state.submitOnEnter);

    const setAIProvider = useSettingsStore((state) => state.setAIProvider);
    const setProviderApiKey = useSettingsStore((state) => state.setProviderApiKey);
    const setProviderBaseUrl = useSettingsStore((state) => state.setProviderBaseUrl);
    const setProviderModel = useSettingsStore((state) => state.setProviderModel);
    const setAiConnectionStatus = useSettingsStore((state) => state.setAiConnectionStatus);
    const setThemeMode = useSettingsStore((state) => state.setThemeMode);
    const setChatModelPreference = useSettingsStore((state) => state.setChatModelPreference);
    const setSubmitOnEnter = useSettingsStore((state) => state.setSubmitOnEnter);
    const restartOnboarding = useSettingsStore((state) => state.restartOnboarding);

    const activeConfig = providers[aiProvider];
    const {
        models: detectedProviderModels,
        isLoading: isLoadingProviderModels,
        reload: reloadProviderModels,
    } = useProviderModels(aiProvider, true);
    const mergedGeminiModels = useMemo(
        () => {
            if (aiProvider !== 'gemini') {
                return PROVIDER_MODEL_OPTIONS.gemini;
            }

            return Array.from(
                new Map([...detectedProviderModels, ...PROVIDER_MODEL_OPTIONS.gemini].map((option) => [option.value, option])).values(),
            );
        },
        [aiProvider, detectedProviderModels],
    );

    const modelOptions = useMemo(() => {
        if (aiProvider === 'gemini' && mergedGeminiModels.length > 0) {
            return mergedGeminiModels;
        }
        if (detectedProviderModels.length > 0) {
            return Array.from(new Map(detectedProviderModels.map((option) => [option.value, option])).values());
        }
        return PROVIDER_MODEL_OPTIONS[aiProvider];
    }, [aiProvider, detectedProviderModels, mergedGeminiModels]);

    const chatPreference = chatModelPreferences[aiProvider] ?? 'auto';
    const effectiveChatModel = chatPreference === 'auto' ? activeConfig.model : chatPreference;
    const aiConnectionStatus = aiConnectionStatusByProvider[aiProvider] ?? 'unknown';
    const aiConnectionError = aiConnectionErrorByProvider[aiProvider] ?? null;

    useEffect(() => {
        if (activeTab !== 'ai') return;

        const hasModel = Boolean(activeConfig.model?.trim());
        const hasKey = aiProvider === 'local' ? true : Boolean(activeConfig.apiKey?.trim());
        const hasBaseUrl = (aiProvider === 'openai' || aiProvider === 'openrouter' || aiProvider === 'local')
            ? Boolean(activeConfig.baseUrl?.trim())
            : true;

        if (!hasModel || !hasKey || !hasBaseUrl) {
            return;
        }

        let isCancelled = false;
        const timer = window.setTimeout(() => {
            setAiConnectionStatus(aiProvider, 'testing');
            void testConnection(aiProvider).then((result) => {
                if (isCancelled) return;
                setAiConnectionStatus(aiProvider, result.ok ? 'ready' : 'error', result.ok ? null : result.message);
            });
        }, 800);

        return () => {
            isCancelled = true;
            window.clearTimeout(timer);
        };
    }, [
        activeTab,
        aiProvider,
        activeConfig.apiKey,
        activeConfig.baseUrl,
        activeConfig.model,
        setAiConnectionStatus,
    ]);

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
                        {TABS.map(({ id, label, icon: Icon }) => {
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
                                    {label}
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
                            <h3 className="text-base font-semibold text-slate-100">KI</h3>
                            <p className="text-sm text-slate-400">API-Keys bleiben im Browser (LocalStorage) und werden nicht automatisch übertragen.</p>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Aktiver Anbieter</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {PROVIDERS.map((provider) => (
                                        <button
                                            key={provider}
                                            onClick={() => setAIProvider(provider)}
                                            className={`px-3 py-2 rounded-lg text-xs border transition-colors cursor-pointer ${
                                                aiProvider === provider
                                                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                                                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                                            }`}
                                        >
                                            {PROVIDER_LABELS[provider]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">{PROVIDER_LABELS[aiProvider]} API-Key</label>
                                <input
                                    type="password"
                                    value={activeConfig.apiKey}
                                    onChange={(e) => setProviderApiKey(aiProvider, e.target.value)}
                                    placeholder={aiProvider === 'local' ? 'Optional für lokalen Server' : 'API-Key eingeben'}
                                    className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-200"
                                />
                                <div className="mt-2 min-h-5">
                                    {aiConnectionStatus === 'ready' && (
                                        <div className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border border-emerald-900/50 bg-emerald-900/20 text-emerald-300">
                                            <CheckCircle2 className={ICON_SIZES[12]} />
                                            <span>API aktiv</span>
                                        </div>
                                    )}
                                    {aiConnectionStatus === 'error' && (
                                        <div
                                            className="inline-flex max-w-full items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border border-red-900/50 bg-red-900/20 text-red-300"
                                            title={aiConnectionError || 'API nicht aktiv'}
                                        >
                                            <XCircle className={ICON_SIZES[12]} />
                                            <span className="max-w-[28rem] truncate">{aiConnectionError || 'API nicht aktiv'}</span>
                                        </div>
                                    )}
                                    {aiConnectionStatus === 'testing' && (
                                        <div className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border border-slate-700 bg-slate-800/50 text-slate-300">
                                            <Loader2 className={`${ICON_SIZES[12]} animate-spin`} />
                                            <span>Prüfe API...</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {(aiProvider === 'openai' || aiProvider === 'openrouter' || aiProvider === 'local') && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Base URL</label>
                                    <input
                                        type="text"
                                        value={activeConfig.baseUrl ?? ''}
                                        onChange={(e) => setProviderBaseUrl(aiProvider, e.target.value)}
                                        placeholder={
                                            aiProvider === 'openai'
                                                ? 'https://api.openai.com/v1'
                                                : aiProvider === 'openrouter'
                                                    ? 'https://openrouter.ai/api/v1'
                                                    : 'http://localhost:1234/v1'
                                        }
                                        className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-200"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Standardmodell</label>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={activeConfig.model}
                                        onChange={(e) => setProviderModel(aiProvider, e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-200 cursor-pointer"
                                    >
                                        {modelOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
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
                                        {modelOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
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
                                <p className="mt-2 text-xs text-slate-400">Aktiv für den Chat: {effectiveChatModel}</p>
                            </div>

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
                                    accept="application/json,.json"
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
