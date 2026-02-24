import React, { useMemo, useRef, useState } from 'react';
import { Cpu, Database, MessageSquare, Moon, Settings, Sun, X } from 'lucide-react';
import { useSettingsStore, type AIProvider } from '../../store/settingsStore';
import { PROVIDER_LABELS, PROVIDER_MODEL_OPTIONS } from '../../services/ai/modelCatalog';
import { useLocalModels } from '../../hooks/useLocalModels';
import { useGeminiModels } from '../../hooks/useGeminiModels';
import { useOpenAIModels } from '../../hooks/useOpenAIModels';
import { exportLocalBackup, importLocalBackup } from '../../utils/dataManagement';
import { clearAllIndexedDbData } from '../../store/dexieStore';
import { IconButton } from '../ui/IconButton';
import { ICON_SIZES } from '../ui/iconSizes';

type SettingsTab = 'display' | 'ai' | 'chat' | 'data' | 'legal';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ElementType }> = [
    { id: 'display', label: 'Anzeige', icon: Sun },
    { id: 'ai', label: 'KI', icon: Cpu },
    { id: 'chat', label: 'KI-Chat', icon: MessageSquare },
    { id: 'data', label: 'Datenverwaltung', icon: Database },
    { id: 'legal', label: 'Rechtliches & Kontakt', icon: Settings },
];

const PROVIDERS: AIProvider[] = ['gemini', 'openai', 'local'];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
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
    const submitOnEnter = useSettingsStore((state) => state.submitOnEnter);

    const setAIProvider = useSettingsStore((state) => state.setAIProvider);
    const setProviderApiKey = useSettingsStore((state) => state.setProviderApiKey);
    const setProviderBaseUrl = useSettingsStore((state) => state.setProviderBaseUrl);
    const setProviderModel = useSettingsStore((state) => state.setProviderModel);
    const setThemeMode = useSettingsStore((state) => state.setThemeMode);
    const setChatModelPreference = useSettingsStore((state) => state.setChatModelPreference);
    const setSubmitOnEnter = useSettingsStore((state) => state.setSubmitOnEnter);
    const restartOnboarding = useSettingsStore((state) => state.restartOnboarding);

    const activeConfig = providers[aiProvider];
    const { models: detectedLocalModels } = useLocalModels(activeConfig.baseUrl ?? '', isOpen && aiProvider === 'local');
    const { models: detectedGeminiModels } = useGeminiModels(activeConfig.apiKey ?? '', isOpen && aiProvider === 'gemini');
    const { models: detectedOpenAIModels } = useOpenAIModels(activeConfig.baseUrl ?? '', activeConfig.apiKey ?? '', isOpen && aiProvider === 'openai');

    const mergedGeminiModels = useMemo(
        () => Array.from(
            new Map([
                ...detectedGeminiModels,
                ...PROVIDER_MODEL_OPTIONS.gemini,
            ].map((option) => [option.value, option])).values()
        ),
        [detectedGeminiModels]
    );

    const modelOptions = useMemo(() => {
        if (aiProvider === 'local' && detectedLocalModels.length > 0) return detectedLocalModels;
        if (aiProvider === 'gemini' && mergedGeminiModels.length > 0) return mergedGeminiModels;
        if (aiProvider === 'openai' && detectedOpenAIModels.length > 0) return detectedOpenAIModels;
        return PROVIDER_MODEL_OPTIONS[aiProvider];
    }, [aiProvider, detectedLocalModels, mergedGeminiModels, detectedOpenAIModels]);

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
        onClose();
        restartOnboarding();
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-5xl h-[82vh] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Globale Einstellungen</h2>
                        <p className="text-[11px] text-slate-500">Zentral für Dashboard, Editor und KI-Funktionen.</p>
                    </div>
                    <IconButton
                        onClick={onClose}
                        size="md"
                        className="rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Schließen"
                    >
                        <X className={ICON_SIZES[18]} />
                    </IconButton>
                </div>

                <div className="h-[calc(82vh-57px)] flex">
                    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 p-3 bg-slate-50/70 dark:bg-slate-900/40">
                        <nav className="space-y-1">
                            {TABS.map(({ id, label, icon: Icon }) => {
                                const active = activeTab === id;
                                return (
                                    <button
                                        key={id}
                                        onClick={() => setActiveTab(id)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                                            active
                                                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <Icon className={ICON_SIZES[16]} />
                                        {label}
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

                    <section className="flex-1 p-5 overflow-y-auto">
                        {activeTab === 'display' && (
                            <div className="max-w-2xl space-y-4">
                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Anzeige</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Hier stellst du das Erscheinungsbild der App ein.</p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setThemeMode('light')}
                                        className={`flex items-center gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                                            themeMode === 'light'
                                                ? 'border-blue-300 bg-blue-50 dark:bg-blue-500/10'
                                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <Sun className={`${ICON_SIZES[18]} text-amber-500`} />
                                        <div className="text-left">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Light Mode</p>
                                            <p className="text-xs text-slate-500">Heller Hintergrund</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setThemeMode('dark')}
                                        className={`flex items-center gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                                            themeMode === 'dark'
                                                ? 'border-blue-300 bg-blue-50 dark:bg-blue-500/10'
                                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <Moon className={`${ICON_SIZES[18]} text-indigo-500`} />
                                        <div className="text-left">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Dark Mode</p>
                                            <p className="text-xs text-slate-500">Dunkler Hintergrund</p>
                                        </div>
                                    </button>
                                </div>

                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/60 dark:bg-slate-800/40">
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Onboarding & Hilfe</p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Starte die Einführung erneut, wenn du die wichtigsten Bereiche der App noch einmal sehen möchtest.
                                    </p>
                                    <button
                                        onClick={handleRestartOnboarding}
                                        className="mt-3 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                    >
                                        Tour erneut starten
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'ai' && (
                            <div className="max-w-2xl space-y-4">
                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">KI</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">API-Keys bleiben im Browser (LocalStorage) und werden nicht automatisch übertragen.</p>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Aktiver Anbieter</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {PROVIDERS.map((provider) => (
                                            <button
                                                key={provider}
                                                onClick={() => setAIProvider(provider)}
                                                className={`px-3 py-2 rounded-lg text-xs border transition-colors cursor-pointer ${
                                                    aiProvider === provider
                                                        ? 'border-blue-300 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                            >
                                                {PROVIDER_LABELS[provider]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{PROVIDER_LABELS[aiProvider]} API-Key</label>
                                    <input
                                        type="password"
                                        value={activeConfig.apiKey}
                                        onChange={(e) => setProviderApiKey(aiProvider, e.target.value)}
                                        placeholder={aiProvider === 'local' ? 'Optional für lokalen Server' : 'API-Key eingeben'}
                                        className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-200"
                                    />
                                </div>

                                {(aiProvider === 'openai' || aiProvider === 'local') && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Base URL</label>
                                        <input
                                            type="text"
                                            value={activeConfig.baseUrl ?? ''}
                                            onChange={(e) => setProviderBaseUrl(aiProvider, e.target.value)}
                                            placeholder={aiProvider === 'openai' ? 'https://api.openai.com/v1' : 'http://localhost:1234/v1'}
                                            className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-200"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Standardmodell</label>
                                    <select
                                        value={activeConfig.model}
                                        onChange={(e) => setProviderModel(aiProvider, e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-200 cursor-pointer"
                                    >
                                        {modelOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {activeTab === 'chat' && (
                            <div className="max-w-2xl space-y-4">
                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">KI-Chat</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Lege fest, welches Modell der Chat bevorzugt nutzt. „Auto“ nimmt das Standardmodell aus dem KI-Tab.</p>

                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/60 dark:bg-slate-800/40">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Aktiver Anbieter: <span className="font-semibold text-slate-700 dark:text-slate-200">{PROVIDER_LABELS[aiProvider]}</span></p>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Bevorzugtes Chat-Modell</label>
                                    <select
                                        value={chatPreference}
                                        onChange={(e) => setChatModelPreference(aiProvider, e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-200 cursor-pointer"
                                    >
                                        <option value="auto">Auto (nutzt Standardmodell)</option>
                                        {modelOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Aktiv für den Chat: {effectiveChatModel}</p>
                                </div>

                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/60 dark:bg-slate-800/40">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Enter sendet Nachricht</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Wenn aktiv: <strong>Enter</strong> sendet, <strong>Shift+Enter</strong> macht Zeilenumbruch.</p>
                                        </div>
                                        <button
                                            onClick={() => setSubmitOnEnter(!submitOnEnter)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                                submitOnEnter ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
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
                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Datenverwaltung</h3>
                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                                    <p className="text-sm text-slate-700 dark:text-slate-200">Alle Daten werden lokal im Browser gespeichert (LocalStorage + IndexedDB).</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Backups enthalten Arbeitsblätter, Einstellungen und Vorlagen. Bilddaten werden in dieser Version nicht exportiert.</p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 bg-white/70 dark:bg-slate-900/40">
                                            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Wird gesichert</p>
                                            <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                                                <li>Arbeitsblätter</li>
                                                <li>Globale Einstellungen</li>
                                                <li>Design-Vorlagen (ohne Bilder)</li>
                                            </ul>
                                        </div>
                                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 bg-white/70 dark:bg-slate-900/40">
                                            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Nicht enthalten</p>
                                            <ul className="space-y-1 text-slate-600 dark:text-slate-300">
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
                                            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            Backup wiederherstellen
                                        </button>

                                        <button
                                            onClick={handleDeleteAllLocalData}
                                            disabled={isDataActionRunning}
                                            className={`px-3 py-2 text-xs rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                                                isConfirmingReset
                                                    ? 'border-red-600 bg-red-600 text-white hover:bg-red-700 motion-safe:animate-pulse'
                                                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
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
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{dataActionInfo}</p>
                                    )}

                                    {dataActionError && (
                                        <p className="text-xs text-red-600 dark:text-red-300">{dataActionError}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'legal' && (
                            <div className="max-w-2xl space-y-4">
                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Rechtliches & Kontakt</h3>
                                <div className="space-y-3">
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Kontakt</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Support und Rückfragen bitte über die Projektkanäle des Teams.</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Impressum</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Impressumsangaben werden von der betreibenden Organisation bereitgestellt.</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-blue-50/70 dark:bg-blue-500/10">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Datenschutz</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-300">Wichtiger Hinweis: Daten verlassen standardmäßig nicht den Browser. API-Anfragen werden nur bei aktiver KI-Nutzung direkt an den gewählten Anbieter gesendet.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};
