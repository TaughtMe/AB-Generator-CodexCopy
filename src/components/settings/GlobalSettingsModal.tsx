import React, { useState } from 'react';
import { X, Settings, KeyRound, CheckCircle, XCircle, Cpu, Server, RefreshCw } from 'lucide-react';
import { useSettingsStore, type AIProvider } from '../../store/settingsStore';
import { PROVIDER_LABELS, PROVIDER_MODEL_OPTIONS } from '../../services/ai/modelCatalog';
import { useLocalModels } from '../../hooks/useLocalModels';
import { useOpenAIModels } from '../../hooks/useOpenAIModels';
import { useGeminiModels } from '../../hooks/useGeminiModels';

interface GlobalSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PROVIDER_OPTIONS: Array<{ value: AIProvider; desc: string }> = [
    { value: 'gemini', desc: 'Google API' },
    { value: 'openai', desc: 'OpenAI API' },
    { value: 'local', desc: 'Lokaler Server' },
];

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({ isOpen, onClose }) => {
    const {
        aiProvider,
        providers,
        setAIProvider,
        setProviderApiKey,
        setProviderModel,
        setProviderBaseUrl,
        setProviderSelectedModelIds,
    } = useSettingsStore();

    const [isEditing, setIsEditing] = useState(false);

    const activeConfig = providers[aiProvider];
    const {
        models: detectedLocalModels,
        isLoading: isLoadingLocalModels,
        error: localModelsError,
        serverReachable,
        lastCheckedLabel,
        reload: reloadLocalModels,
    } = useLocalModels(activeConfig.baseUrl ?? '', isOpen && aiProvider === 'local');
    const {
        models: detectedGeminiModels,
        isLoading: isLoadingGeminiModels,
        error: geminiModelsError,
        reload: reloadGeminiModels,
    } = useGeminiModels(activeConfig.apiKey ?? '', isOpen && aiProvider === 'gemini');
    const {
        models: detectedOpenAIModels,
        isLoading: isLoadingOpenAIModels,
        error: openAIModelsError,
        reload: reloadOpenAIModels,
    } = useOpenAIModels(activeConfig.baseUrl ?? '', activeConfig.apiKey ?? '', isOpen && aiProvider === 'openai');
    const mergedGeminiModels = Array.from(
        new Map([
            ...detectedGeminiModels,
            ...PROVIDER_MODEL_OPTIONS.gemini,
        ].map((option) => [option.value, option])).values()
    );
    const modelOptions = aiProvider === 'local' && detectedLocalModels.length > 0
        ? detectedLocalModels
        : aiProvider === 'gemini' && mergedGeminiModels.length > 0
            ? mergedGeminiModels
        : aiProvider === 'openai' && detectedOpenAIModels.length > 0
            ? detectedOpenAIModels
            : PROVIDER_MODEL_OPTIONS[aiProvider];
    const requiresApiKey = aiProvider !== 'local';
    const hasApiKey = Boolean(activeConfig.apiKey.trim());
    const hasCompleteLocalConfig = Boolean(activeConfig.baseUrl?.trim() && activeConfig.model.trim());
    const hasConnection = requiresApiKey ? hasApiKey : hasCompleteLocalConfig;
    const selectedModelIds = activeConfig.selectedModelIds ?? [];

    const handleToggleFavoriteModel = (modelId: string, checked: boolean) => {
        const nextIds = checked
            ? Array.from(new Set([...selectedModelIds, modelId]))
            : selectedModelIds.filter((id) => id !== modelId);

        setProviderSelectedModelIds(aiProvider, nextIds);

        if (!checked && activeConfig.model === modelId && nextIds.length > 0) {
            setProviderModel(aiProvider, nextIds[0]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
                            <Settings size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                KI-Einstellungen
                            </h2>
                            <p className="text-[10px] text-slate-400">
                                Zentral für Dashboard und Editor
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                            <Server size={12} />
                            Anbieter
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                            {PROVIDER_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        setAIProvider(option.value);
                                        setIsEditing(false);
                                    }}
                                    className={`px-2 py-2 rounded-lg text-[11px] transition-all cursor-pointer border ${aiProvider === option.value
                                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    <span className="font-medium block">{PROVIDER_LABELS[option.value]}</span>
                                    <span className="text-[9px] opacity-70">{option.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                            <KeyRound size={12} />
                            {requiresApiKey ? `${PROVIDER_LABELS[aiProvider]} API-Key` : 'Lokaler Zugriff'}
                        </label>

                        <div className="flex items-center gap-2 mb-2">
                            {hasConnection ? (
                                <>
                                    <CheckCircle size={14} className="text-emerald-500" />
                                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                        Aktiv
                                    </span>
                                    {requiresApiKey && (
                                        <span className="text-[10px] text-slate-400 ml-1">
                                            •••• {activeConfig.apiKey.slice(-4)}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <XCircle size={14} className="text-red-400" />
                                    <span className="text-xs font-medium text-red-500 dark:text-red-400">
                                        Fehlt
                                    </span>
                                </>
                            )}

                            {!isEditing && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="ml-auto text-[10px] text-blue-500 hover:text-blue-600 font-medium cursor-pointer hover:underline"
                                >
                                    {hasConnection ? 'Ändern' : 'Einrichten'}
                                </button>
                            )}
                        </div>

                        {isEditing && (
                            <div className="space-y-2">
                                {requiresApiKey && (
                                    <div>
                                        <input
                                            type="password"
                                            value={activeConfig.apiKey}
                                            onChange={(e) => setProviderApiKey(aiProvider, e.target.value)}
                                            placeholder="API-Key einfügen..."
                                            className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-700 dark:text-slate-300 font-mono"
                                            autoFocus
                                        />
                                    </div>
                                )}

                                {(aiProvider === 'local' || aiProvider === 'openai') && (
                                    <div className="space-y-1.5">
                                        <input
                                            type="text"
                                            value={activeConfig.baseUrl ?? ''}
                                            onChange={(e) => setProviderBaseUrl(aiProvider, e.target.value)}
                                            placeholder={aiProvider === 'local' ? 'http://localhost:1234/v1' : 'https://api.openai.com/v1'}
                                            className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-700 dark:text-slate-300"
                                        />
                                        {aiProvider === 'local' && (
                                            <div className="text-[10px] text-slate-500 space-y-0.5">
                                                <p className="flex items-center gap-1.5">
                                                    <span
                                                        className={`inline-block w-2 h-2 rounded-full ${isLoadingLocalModels
                                                            ? 'bg-amber-400'
                                                            : serverReachable
                                                                ? 'bg-emerald-500'
                                                                : serverReachable === false
                                                                    ? 'bg-red-500'
                                                                    : 'bg-slate-300'
                                                            }`}
                                                    />
                                                    {isLoadingLocalModels
                                                        ? 'Serverstatus: wird geprüft...'
                                                        : serverReachable
                                                            ? 'Serverstatus: erreichbar'
                                                            : serverReachable === false
                                                                ? 'Serverstatus: nicht erreichbar'
                                                                : 'Serverstatus: unbekannt'}
                                                </p>
                                                {lastCheckedLabel && (
                                                    <p className="flex items-center gap-2">
                                                        <span>Letzte Prüfung: {lastCheckedLabel}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => void reloadLocalModels()}
                                                            disabled={isLoadingLocalModels}
                                                            className="underline hover:no-underline disabled:opacity-50 cursor-pointer"
                                                        >
                                                            Jetzt prüfen
                                                        </button>
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <p className="mt-1 text-[10px] text-slate-400">
                            Wird nur lokal gespeichert. Nie an Dritte übertragen.
                        </p>
                    </div>

                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                            <Cpu size={12} />
                            KI-Modell
                        </label>
                        {aiProvider === 'local' && (
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-[10px] text-slate-500">
                                    {detectedLocalModels.length > 0
                                        ? `${detectedLocalModels.length} lokale Modelle erkannt`
                                        : localModelsError
                                            ? 'Keine Modelle automatisch erkannt – nutze Fallback-Liste.'
                                            : 'Suche lokale Modelle...'}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => void reloadLocalModels()}
                                    disabled={isLoadingLocalModels}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                                >
                                    <RefreshCw size={10} className={isLoadingLocalModels ? 'animate-spin' : ''} />
                                    Aktualisieren
                                </button>
                            </div>
                        )}
                        {aiProvider === 'openai' && (
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-[10px] text-slate-500">
                                    {detectedOpenAIModels.length > 0
                                        ? `${detectedOpenAIModels.length} OpenAI-Modelle erkannt`
                                        : openAIModelsError
                                            ? 'Auto-Erkennung nicht verfügbar – nutze Fallback-Liste.'
                                            : isLoadingOpenAIModels
                                                ? 'Suche OpenAI-Modelle...'
                                                : 'Keine OpenAI-Modelle erkannt.'}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => void reloadOpenAIModels()}
                                    disabled={isLoadingOpenAIModels}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                                >
                                    <RefreshCw size={10} className={isLoadingOpenAIModels ? 'animate-spin' : ''} />
                                    Aktualisieren
                                </button>
                            </div>
                        )}
                        {aiProvider === 'gemini' && (
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-[10px] text-slate-500">
                                    {detectedGeminiModels.length > 0
                                        ? `${detectedGeminiModels.length} Gemini-Modelle erkannt`
                                        : geminiModelsError
                                            ? 'Auto-Erkennung nicht verfügbar – nutze Fallback-Liste.'
                                            : isLoadingGeminiModels
                                                ? 'Suche Gemini-Modelle...'
                                                : 'Keine Gemini-Modelle erkannt.'}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => void reloadGeminiModels()}
                                    disabled={isLoadingGeminiModels}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                                >
                                    <RefreshCw size={10} className={isLoadingGeminiModels ? 'animate-spin' : ''} />
                                    Aktualisieren
                                </button>
                            </div>
                        )}
                        <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1">
                            {modelOptions.map(({ value, label, desc }) => (
                                <div
                                    key={value}
                                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg border ${activeConfig.model === value
                                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedModelIds.includes(value)}
                                        onChange={(e) => handleToggleFavoriteModel(value, e.target.checked)}
                                        className="w-3.5 h-3.5 accent-amber-600 cursor-pointer"
                                        title="Als Favorit im Editor anzeigen"
                                    />

                                    <button
                                        onClick={() => setProviderModel(aiProvider, value)}
                                        className="flex-1 flex items-center justify-between text-left px-1 py-0.5 rounded text-xs transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                                    >
                                        <div>
                                            <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                                            <span className="ml-2 text-[10px] text-slate-500 dark:text-slate-400">{desc}</span>
                                        </div>
                                        {activeConfig.model === value && (
                                            <CheckCircle size={14} className="text-amber-500 shrink-0" />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400">
                            Checkbox = Favorit für den Editor · Klick auf Zeile = aktives Modell.
                        </p>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-[11px] text-blue-600 dark:text-blue-400">
                            💡 Profile (Fach, Klasse, Lehrplan) werden im <strong>Dashboard</strong> verwaltet.
                        </p>
                        {(aiProvider === 'gemini' || aiProvider === 'openai') && (
                            <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                                💸 Neuere Gemini-/GPT-Modelle verursachen in der Regel höhere API-Kosten.
                            </p>
                        )}
                        {aiProvider === 'local' && (
                            <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                                ⚠️ Für lokale KI muss <strong>CORS</strong> im lokalen Server aktiviert sein, sonst blockiert der Browser die Anfrage.
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <p className="text-[10px] text-slate-400">
                        Änderungen werden automatisch gespeichert.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-all cursor-pointer shadow-sm hover:shadow"
                    >
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    );
};
