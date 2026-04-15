import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Cpu, Database, Globe, Loader2, MessageSquare, Moon, RefreshCw, Settings, Sun, Type, X, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type AIProvider } from '../../store/settingsStore';
import { PROVIDER_LABELS, PROVIDER_MODEL_OPTIONS } from '../../services/ai/modelCatalog';
import { testConnection } from '../../services/aiService';
import { useProviderModels } from '../../hooks/useProviderModels';
import { exportLocalBackup, importLocalBackup } from '../../utils/dataManagement';
import { clearAllIndexedDbData } from '../../store/dexieStore';
import { IconButton } from '../ui/IconButton';
import { ICON_SIZES } from '../ui/iconSizes';
import { FontUpload } from './FontUpload';
import { Modal } from '../ui/Modal';

type SettingsTab = 'display' | 'fonts' | 'ai' | 'chat' | 'data' | 'legal' | 'language';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TAB_KEYS: Array<{ id: SettingsTab; labelKey: string; icon: React.ElementType }> = [
    { id: 'display', labelKey: 'settings.tabs.display', icon: Sun },
    { id: 'fonts', labelKey: 'settings.tabs.fonts', icon: Type },
    { id: 'ai', labelKey: 'settings.tabs.ai', icon: Cpu },
    { id: 'chat', labelKey: 'settings.tabs.chat', icon: MessageSquare },
    { id: 'data', labelKey: 'settings.tabs.data', icon: Database },
    { id: 'language', labelKey: 'settings.tabs.language', icon: Globe },
    { id: 'legal', labelKey: 'settings.tabs.legal', icon: Settings },
];

const PROVIDERS: AIProvider[] = ['gemini', 'openai', 'openrouter', 'local'];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { t, i18n } = useTranslation();
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
    } = useProviderModels(aiProvider, isOpen);
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
        if (!isOpen || activeTab !== 'ai') return;

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
        isOpen,
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
            setDataActionInfo(t('settings.data.backupSuccess'));
        } catch (error) {
            setDataActionError(error instanceof Error ? error.message : t('settings.data.backupError'));
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
        setDataActionInfo(t('settings.data.restoreInfo'));
        setIsDataActionRunning(true);
        try {
            await importLocalBackup(file);
        } catch (error) {
            setDataActionError(error instanceof Error ? error.message : t('settings.data.restoreError'));
            setIsDataActionRunning(false);
        }
    }

    async function handleDeleteAllLocalData() {
        setDataActionError(null);
        if (!isConfirmingReset) {
            setIsConfirmingReset(true);
            setDataActionInfo(t('settings.data.confirmDeleteInfo'));
            return;
        }

        setIsConfirmingReset(false);
        setDataActionInfo(t('settings.data.deleteInfo'));
        setIsDataActionRunning(true);
        try {
            await clearAllIndexedDbData();
            await Promise.resolve().then(() => {
                localStorage.clear();
            });
            window.location.reload();
        } catch (error) {
            setDataActionError(error instanceof Error ? error.message : t('settings.data.deleteError'));
            setIsDataActionRunning(false);
        }
    }

    function handleRestartOnboarding() {
        onClose();
        restartOnboarding();
        localStorage.removeItem('onboarding_completed');
        localStorage.removeItem('tour_completed_dashboard');
        localStorage.removeItem('tour_completed_editor');
        window.location.reload();
    }

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            ariaLabel={t('settings.title')}
            className="w-full max-w-5xl h-[82vh] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        >
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('settings.title')}</h2>
                        <p className="text-[11px] text-slate-500">{t('settings.subtitle')}</p>
                    </div>
                    <IconButton
                        onClick={onClose}
                        size="md"
                        className="rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={t('common.close')}
                    >
                        <X className={ICON_SIZES[18]} />
                    </IconButton>
                </div>

                <div className="h-[calc(82vh-57px)] flex">
                    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 p-3 bg-slate-50/70 dark:bg-slate-900/40">
                        <nav className="space-y-1">
                            {TAB_KEYS.map(({ id, labelKey, icon: Icon }) => {
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
                                        {t(labelKey)}
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

                    <section className="flex-1 p-5 overflow-y-auto">
                        {activeTab === 'display' && (
                            <div className="max-w-2xl space-y-4">
                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('settings.display.title')}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.display.subtitle')}</p>

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
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('settings.display.lightMode')}</p>
                                            <p className="text-xs text-slate-500">{t('settings.display.lightModeDesc')}</p>
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
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('settings.display.darkMode')}</p>
                                            <p className="text-xs text-slate-500">{t('settings.display.darkModeDesc')}</p>
                                        </div>
                                    </button>
                                </div>

                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/60 dark:bg-slate-800/40">
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('settings.display.onboarding')}</p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {t('settings.display.onboardingDesc')}
                                    </p>
                                    <button
                                        onClick={handleRestartOnboarding}
                                        className="mt-3 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                    >
                                        {t('settings.display.restartTour')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'fonts' && (
                            <FontUpload />
                        )}

                        {activeTab === 'ai' && (
                            <div className="max-w-2xl space-y-4">
                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('settings.ai.title')}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.ai.subtitle')}</p>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{t('settings.ai.activeProvider')}</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{PROVIDER_LABELS[aiProvider]} {t('settings.ai.apiKey')}</label>
                                    <input
                                        type="password"
                                        value={activeConfig.apiKey}
                                        onChange={(e) => setProviderApiKey(aiProvider, e.target.value)}
                                        placeholder={aiProvider === 'local' ? t('settings.ai.apiKeyOptional') : t('settings.ai.apiKeyPlaceholder')}
                                        className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-200"
                                    />
                                    <div className="mt-2 min-h-5">
                                        {aiConnectionStatus === 'ready' && (
                                            <div className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                                                <CheckCircle2 className={ICON_SIZES[12]} />
                                                <span>{t('settings.ai.apiActive')}</span>
                                            </div>
                                        )}
                                        {aiConnectionStatus === 'error' && (
                                            <div
                                                className="inline-flex max-w-full items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300"
                                                title={aiConnectionError || t('settings.ai.apiInactive')}
                                            >
                                                <XCircle className={ICON_SIZES[12]} />
                                                <span className="max-w-[28rem] truncate">{aiConnectionError || t('settings.ai.apiInactive')}</span>
                                            </div>
                                        )}
                                        {aiConnectionStatus === 'testing' && (
                                            <div className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                                                <Loader2 className={`${ICON_SIZES[12]} animate-spin`} />
                                                <span>{t('settings.ai.testingApi')}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {(aiProvider === 'openai' || aiProvider === 'openrouter' || aiProvider === 'local') && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{t('settings.ai.baseUrl')}</label>
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
                                            className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-200"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{t('settings.ai.defaultModel')}</label>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={activeConfig.model}
                                            onChange={(e) => setProviderModel(aiProvider, e.target.value)}
                                            className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-200 cursor-pointer"
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
                                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                                                title={t('settings.ai.refreshModels')}
                                                aria-label={t('settings.ai.refreshModels')}
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
                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('settings.chat.title')}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.chat.subtitle')}</p>

                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/60 dark:bg-slate-800/40">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('settings.ai.activeProvider')}: <span className="font-semibold text-slate-700 dark:text-slate-200">{PROVIDER_LABELS[aiProvider]}</span></p>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{t('settings.chat.preferredModel')}</label>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={chatPreference}
                                            onChange={(e) => setChatModelPreference(aiProvider, e.target.value)}
                                            className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-200 cursor-pointer"
                                        >
                                            <option value="auto">{t('settings.chat.autoModel')}</option>
                                            {modelOptions.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                        {aiProvider === 'local' && (
                                            <button
                                                type="button"
                                                onClick={() => void reloadProviderModels()}
                                                disabled={isLoadingProviderModels}
                                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                                                title={t('settings.ai.refreshModels')}
                                                aria-label={t('settings.ai.refreshModels')}
                                            >
                                                <RefreshCw className={`${ICON_SIZES[16]} ${isLoadingProviderModels ? 'animate-spin' : ''}`} />
                                            </button>
                                        )}
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('settings.chat.activeForChat')} {effectiveChatModel}</p>
                                </div>

                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/60 dark:bg-slate-800/40">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('settings.chat.submitOnEnter')}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Wenn aktiv: <strong>Enter</strong> sendet, <strong>Shift+Enter</strong> macht Zeilenumbruch.</p>
                                        </div>
                                        <button
                                            onClick={() => setSubmitOnEnter(!submitOnEnter)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                                submitOnEnter ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                                            }`}
                                            aria-label={t('settings.chat.submitOnEnter')}
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
                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('settings.data.title')}</h3>
                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                                    <p className="text-sm text-slate-700 dark:text-slate-200">{t('settings.data.description')}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('settings.data.backupInfo')}</p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 bg-white/70 dark:bg-slate-900/40">
                                            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{t('settings.data.included')}</p>
                                            <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                                                <li>{t('settings.data.includedItems.worksheets')}</li>
                                                <li>{t('settings.data.includedItems.settings')}</li>
                                                <li>{t('settings.data.includedItems.templates')}</li>
                                            </ul>
                                        </div>
                                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 bg-white/70 dark:bg-slate-900/40">
                                            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{t('settings.data.excluded')}</p>
                                            <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                                                <li>{t('settings.data.excludedItems.images')}</li>
                                                <li>{t('settings.data.excludedItems.cloud')}</li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <button
                                            onClick={handleBackupDownload}
                                            disabled={isDataActionRunning}
                                            className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            {t('settings.data.downloadBackup')}
                                        </button>

                                        <button
                                            onClick={handleRestoreClick}
                                            disabled={isDataActionRunning}
                                            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            {t('settings.data.restoreBackup')}
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
                                            {isConfirmingReset ? t('settings.data.confirmDelete') : t('settings.data.deleteAllData')}
                                        </button>

                                        <button
                                            onClick={() => {
                                                localStorage.removeItem('workspace-storage');
                                                localStorage.removeItem('worksheet-storage');
                                                setDataActionInfo(t('settings.data.cacheCleared'));
                                            }}
                                            disabled={isDataActionRunning}
                                            className="px-3 py-2 text-xs rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            {t('settings.data.clearCache')}
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

                        {activeTab === 'language' && (
                            <div className="max-w-2xl space-y-4">
                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('settings.language')}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.tabs.language')}</p>
                                <div className="flex gap-2">
                                    {[
                                        { code: 'de', label: 'Deutsch' },
                                        { code: 'en', label: 'English' },
                                        { code: 'es', label: 'Español' },
                                        { code: 'fr', label: 'Français' },
                                    ].map((lang) => (
                                        <button
                                            key={lang.code}
                                            onClick={() => i18n.changeLanguage(lang.code)}
                                            className={`px-4 py-2 text-sm rounded-lg transition-colors border cursor-pointer ${
                                                i18n.resolvedLanguage === lang.code
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400 font-medium'
                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {lang.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'legal' && (
                            <div className="max-w-2xl space-y-4">
                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('settings.legal.title')}</h3>
                                <div className="space-y-3">
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('settings.legal.contact')}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.legal.contactInfo')}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('settings.legal.impressum')}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.legal.impressumInfo')}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-blue-50/70 dark:bg-blue-500/10">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('settings.legal.privacy')}</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-300">{t('settings.legal.privacyInfo')}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
        </Modal>
    );
};
