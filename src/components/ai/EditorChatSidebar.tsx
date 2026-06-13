import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, MessageSquare, Paperclip, RefreshCw, Send, Sparkles, XCircle } from 'lucide-react';
import {
    getActiveProviderLabel,
    isActiveProviderConfigured,
} from '../../services/aiService';
import { PROVIDER_MODEL_OPTIONS } from '../../services/ai/modelCatalog';
import { useProviderModels } from '../../hooks/useProviderModels';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useWorksheetStore } from '../../store/worksheetStore';
import { useSettingsStore } from '../../store/settingsStore';
import { ICON_SIZES } from '../ui/iconSizes';
import { ChatContextCard } from './ChatContextCard';
import { estimateChatTokens, formatTokenCount } from '../../features/ai/tokenEstimate';

type VariantDifferentiationPreset = 'simplify' | 'standard' | 'deepen';

const VARIANT_PRESET_LABELS: Record<VariantDifferentiationPreset, string> = {
    simplify: 'Vereinfachen',
    standard: 'Standard',
    deepen: 'Vertiefen',
};

function buildVariantPresetInstruction(
    preset: VariantDifferentiationPreset,
    activeVariantLabel: string,
): string {
    switch (preset) {
        case 'simplify':
            return `Erstelle aus der aktuellen Variante "${activeVariantLabel}" eine vereinfachte Version. Vereinfache Sprache und Aufgabenstellungen, reduziere Komplexität und kognitive Last, aber behalte das Lernziel bei.`;
        case 'deepen':
            return `Erstelle aus der aktuellen Variante "${activeVariantLabel}" eine anspruchsvollere Version. Erhöhe Komplexität und Denktiefe, ergänze passende Erweiterungen, aber behalte das gleiche Lernziel bei.`;
        case 'standard':
        default:
            return `Erstelle aus der aktuellen Variante "${activeVariantLabel}" eine alternative Version auf Standardniveau. Behalte das Lernziel bei, formuliere klar und passe die Aufgaben ausgewogen an.`;
    }
}

interface EditorChatSidebarProps {
    onOpenSources?: () => void;
}

export const EditorChatSidebar: React.FC<EditorChatSidebarProps> = ({ onOpenSources }) => {
    const chatMessages = useWorkspaceStore((s) => s.chatMessages);
    const isChatLoading = useWorkspaceStore((s) => s.isChatLoading);
    const chatError = useWorkspaceStore((s) => s.chatError);
    const chatStatusNotice = useWorkspaceStore((s) => s.chatStatusNotice);
    const isChatGenerating = useWorkspaceStore((s) => s.isChatGenerating);
    const aiSidebarDraft = useWorkspaceStore((s) => s.aiSidebarDraft);
    const sendChatMessage = useWorkspaceStore((s) => s.sendChatMessage);
    const createDifferentiatedVariantFromPrompt = useWorkspaceStore((s) => s.createDifferentiatedVariantFromPrompt);
    const startNewChat = useWorkspaceStore((s) => s.startNewChat);
    const compressChat = useWorkspaceStore((s) => s.compressChat);
    const seedGreetingIfEmpty = useWorkspaceStore((s) => s.seedGreetingIfEmpty);
    const setAiSidebarDraft = useWorkspaceStore((s) => s.setAiSidebarDraft);
    const variants = useWorksheetStore((s) => s.variants);
    const activeVariantId = useWorksheetStore((s) => s.activeVariantId);
    const tasksById = useWorksheetStore((s) => s.tasksById);
    const aiProvider = useSettingsStore((s) => s.aiProvider);
    const chatModelPreferences = useSettingsStore((s) => s.chatModelPreferences);
    const aiConnectionStatusByProvider = useSettingsStore((s) => s.aiConnectionStatusByProvider);
    const setChatModelPreference = useSettingsStore((s) => s.setChatModelPreference);

    const [isVariantPanelOpen, setIsVariantPanelOpen] = useState(false);
    const [variantPreset, setVariantPreset] = useState<VariantDifferentiationPreset>('simplify');
    const [variantInstruction, setVariantInstruction] = useState('');
    const [variantLabelInput, setVariantLabelInput] = useState('');
    const historyRef = useRef<HTMLDivElement>(null);
    const submitOnEnter = useSettingsStore((s) => s.submitOnEnter);
    const input = aiSidebarDraft;
    const setInput = setAiSidebarDraft;

    const providerReady = isActiveProviderConfigured();
    /** §7.1/7.2: Heuristische Token-Schätzung (Chat + Entwurf + Arbeitsblatt-JSON). */
    const tokenEstimate = useMemo(
        () => estimateChatTokens(chatMessages, input, tasksById),
        [chatMessages, input, tasksById],
    );
    const activeVariantLabel = useMemo(
        () => variants.find((variant) => variant.id === activeVariantId)?.label ?? 'Standard',
        [variants, activeVariantId],
    );
    const aiConnectionStatus = aiConnectionStatusByProvider[aiProvider] ?? 'unknown';
    const {
        models: detectedProviderModels,
        isLoading: isLoadingProviderModels,
        error: providerModelsError,
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
    const chatModelOptions = useMemo(() => {
        if (aiProvider === 'gemini' && mergedGeminiModels.length > 0) {
            return mergedGeminiModels;
        }

        if (detectedProviderModels.length > 0) {
            return Array.from(
                new Map(detectedProviderModels.map((option) => [option.value, option])).values(),
            );
        }

        return PROVIDER_MODEL_OPTIONS[aiProvider];
    }, [aiProvider, detectedProviderModels, mergedGeminiModels]);
    const chatPreference = chatModelPreferences[aiProvider] ?? 'auto';

    useEffect(() => {
        if (!isVariantPanelOpen) return;
        setVariantInstruction((current) => current || buildVariantPresetInstruction(variantPreset, activeVariantLabel));
        setVariantLabelInput((current) => current || `${activeVariantLabel} (KI)`);
    }, [isVariantPanelOpen, variantPreset, activeVariantLabel]);

    useEffect(() => {
        if (!isVariantPanelOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsVariantPanelOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isVariantPanelOpen]);

    useEffect(() => {
        seedGreetingIfEmpty();
        return () => { useWorkspaceStore.getState().abortChat(); };
    }, [seedGreetingIfEmpty]);

    useEffect(() => {
        queueMicrotask(() => {
            historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: 'smooth' });
        });
    }, [chatMessages.length, isChatLoading]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed || isChatLoading || isChatGenerating) return;
        setInput('');
        await sendChatMessage(trimmed);
    };

    const handleInputKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!submitOnEnter) return;
        if (e.key !== 'Enter' || e.shiftKey) return;

        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed || isChatLoading || isChatGenerating) return;

        setInput('');
        await sendChatMessage(trimmed);
    };

    const openVariantPanel = () => {
        setIsVariantPanelOpen(true);
        setVariantPreset('simplify');
        setVariantInstruction(input.trim() || buildVariantPresetInstruction('simplify', activeVariantLabel));
        setVariantLabelInput(`${activeVariantLabel} (KI)`);
    };

    const handleCreateVariantWithAI = async () => {
        if (!providerReady || isChatLoading || isChatGenerating) return;
        const instruction = variantInstruction.trim();
        if (!instruction) return;

        const success = await createDifferentiatedVariantFromPrompt(instruction, variantLabelInput.trim() || undefined);
        if (!success) return;

        setIsVariantPanelOpen(false);
        setVariantInstruction('');
        setVariantLabelInput('');
    };

    return (
        <aside className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 shadow-xl backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/80">
            <div className="shrink-0 px-4 py-3 flex items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40">
                <div className="flex items-center gap-2">
                    <MessageSquare className={`${ICON_SIZES[16]} text-slate-500 dark:text-slate-300`} />
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">KI-Chatverlauf</h2>
                    {aiConnectionStatus === 'ready' ? (
                        <span
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                            title={`${getActiveProviderLabel()} aktiv`}
                        >
                            <CheckCircle2 className={ICON_SIZES[10]} />
                        </span>
                    ) : aiConnectionStatus === 'error' ? (
                        <span
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300"
                            title={`${getActiveProviderLabel()} nicht aktiv`}
                        >
                            <XCircle className={ICON_SIZES[10]} />
                        </span>
                    ) : (
                        <span
                            className="inline-block h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600"
                            title={`${getActiveProviderLabel()} noch nicht geprüft`}
                        />
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={startNewChat}
                        disabled={isChatLoading || isChatGenerating}
                        className="text-xs px-2.5 py-1 rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        title="Neues Gespräch"
                    >
                        Neu
                    </button>
                    <button
                        onClick={onOpenSources}
                        disabled={!onOpenSources || isChatLoading || isChatGenerating}
                        className="text-xs px-2.5 py-1 rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1"
                        title="Unterrichtsmaterialien hochladen und aktivieren"
                    >
                        <Paperclip className={ICON_SIZES[11]} />
                        <span>Quellen</span>
                    </button>
                    <button
                        onClick={openVariantPanel}
                        disabled={!providerReady || isChatLoading || isChatGenerating}
                        className="text-xs px-2.5 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1"
                        title={`Aktuelle Variante "${activeVariantLabel}" per KI als neue Variante differenzieren`}
                    >
                        <Sparkles className={ICON_SIZES[11]} />
                        <span>Variante</span>
                    </button>
                </div>
            </div>

            <div className="shrink-0 px-3 py-2 border-b border-slate-200/70 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Chat-Modell ({getActiveProviderLabel()})
                </label>
                <div className="flex items-center gap-2">
                    <select
                        value={chatPreference}
                        onChange={(e) => setChatModelPreference(aiProvider, e.target.value)}
                        disabled={isChatLoading || isChatGenerating}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 px-2.5 py-2 text-xs text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
                    >
                        <option value="auto">Auto (nutzt Standardmodell)</option>
                        {chatModelOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    {aiProvider === 'local' && (
                        <button
                            type="button"
                            onClick={() => void reloadProviderModels()}
                            disabled={isLoadingProviderModels || isChatLoading || isChatGenerating}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-500 transition-colors hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            title="Lokale Modelle aktualisieren"
                            aria-label="Lokale Modelle aktualisieren"
                        >
                            <RefreshCw className={`${ICON_SIZES[14]} ${isLoadingProviderModels ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                </div>
                {aiProvider === 'local' && (
                    <div className="mt-1.5 min-h-5">
                        {providerModelsError ? (
                            <div
                                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300"
                                title={providerModelsError}
                            >
                                <XCircle className={ICON_SIZES[12]} />
                                <span className="truncate">{providerModelsError}</span>
                            </div>
                        ) : detectedProviderModels.length > 0 ? (
                            <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                                <CheckCircle2 className={ICON_SIZES[12]} />
                                <span>{detectedProviderModels.length} lokale Modelle geladen</span>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            <ChatContextCard />

            <div ref={historyRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {chatMessages.length === 0 && (
                    <div className="h-full flex items-center justify-center text-center px-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Hier erscheint dein KI-Chatverlauf. Schreibe rechts unten eine Nachricht, um weiterzumachen.
                        </p>
                    </div>
                )}

                {chatMessages.map((message, index) => (
                    <div
                        key={`${message.role}-${index}`}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[88%] rounded-2xl border px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                                message.role === 'user'
                                    ? 'rounded-br-md border-transparent bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-md dark:from-purple-600 dark:to-fuchsia-600'
                                    : 'rounded-bl-md border-slate-200/80 bg-white/90 text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-slate-100'
                            }`}
                        >
                            {message.content}
                        </div>
                    </div>
                ))}

                {isChatLoading && (
                    <div className="flex justify-start">
                        <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200/80 bg-white/90 px-3.5 py-2.5 text-sm text-slate-500 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-slate-300">
                            <Loader2 className={`${ICON_SIZES[12]} animate-spin`} /> KI denkt nach...
                        </div>
                    </div>
                )}
            </div>

            <div className="relative z-10 shrink-0 space-y-2 border-t border-slate-200 p-3 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                {!providerReady && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700">
                        KI nicht konfiguriert. Bitte Einstellungen für {getActiveProviderLabel()} prüfen.
                    </div>
                )}

                {chatError && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">
                        {chatError}
                    </div>
                )}

                {chatStatusNotice && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] text-emerald-700">
                        {chatStatusNotice}
                    </div>
                )}

                {tokenEstimate.isLong && (
                    <div
                        data-token-warning
                        className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300"
                    >
                        Der Chat ist lang (≈ {formatTokenCount(tokenEstimate.chatTokens)} Tokens) — das kostet
                        mehr und kann die KI verwirren.
                        <div className="mt-1.5 flex flex-wrap gap-2">
                            <button
                                type="button"
                                data-compress-chat
                                onClick={() => { void compressChat(); }}
                                disabled={!providerReady || isChatLoading || isChatGenerating}
                                className="rounded-md border border-amber-300 bg-white/70 px-2 py-1 font-medium text-amber-800 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                            >
                                Verlauf komprimieren
                            </button>
                            <button
                                type="button"
                                onClick={startNewChat}
                                disabled={isChatLoading || isChatGenerating}
                                className="rounded-md px-2 py-1 font-medium text-amber-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-amber-300"
                            >
                                oder neu starten
                            </button>
                        </div>
                    </div>
                )}

                <p
                    data-token-estimate
                    className="px-1 text-[10px] tabular-nums text-slate-400 dark:text-slate-500"
                    title="Heuristische Schätzung (≈ Zeichen ÷ 4). Provider melden echte Tokens erst nach der Antwort."
                >
                    ≈ {formatTokenCount(tokenEstimate.totalTokens)} Tokens pro Anfrage
                    (Chat {formatTokenCount(tokenEstimate.chatTokens)} + Arbeitsblatt {formatTokenCount(tokenEstimate.worksheetTokens)})
                </p>

                <form onSubmit={handleSend} className="flex items-end gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-2 py-2 shadow-sm backdrop-blur dark:border-slate-700/80 dark:bg-slate-800/90">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        rows={1}
                        placeholder="Nachricht an den KI-Assistenten..."
                        disabled={!providerReady || isChatLoading || isChatGenerating}
                        className="flex-1 min-h-[40px] max-h-24 resize-none rounded-xl bg-transparent px-3 py-2 text-sm leading-5 text-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={!providerReady || !input.trim() || isChatLoading || isChatGenerating}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer dark:bg-purple-600 dark:hover:bg-purple-500"
                        aria-label="Nachricht senden"
                    >
                        <Send className={ICON_SIZES[14]} />
                    </button>
                </form>
            </div>

            {isVariantPanelOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <button
                        type="button"
                        aria-label="Dialog schließen"
                        onClick={() => setIsVariantPanelOpen(false)}
                        className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-[2px] cursor-pointer"
                    />

                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="ai-variant-modal-title"
                        className="relative w-full max-w-xl rounded-2xl border border-slate-200/90 dark:border-slate-700/70 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
                    >
                        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h3 id="ai-variant-modal-title" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        KI-Variante erstellen
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Basis: "{activeVariantLabel}"
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsVariantPanelOpen(false)}
                                    className="text-xs px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-100 cursor-pointer"
                                >
                                    Schließen
                                </button>
                            </div>
                        </div>

                        <div className="p-4 space-y-4">
                            <div>
                                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                                    Zielniveau / Preset
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(['simplify', 'standard', 'deepen'] as VariantDifferentiationPreset[]).map((preset) => {
                                        const isSelected = variantPreset === preset;
                                        return (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => {
                                                    setVariantPreset(preset);
                                                    setVariantInstruction(buildVariantPresetInstruction(preset, activeVariantLabel));
                                                }}
                                                className={`px-3 py-1.5 rounded-full text-xs border transition-colors cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:text-blue-700 dark:hover:text-blue-300'
                                                }`}
                                                title={`Preset: ${VARIANT_PRESET_LABELS[preset]}`}
                                            >
                                                {VARIANT_PRESET_LABELS[preset]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                                    Name der neuen Variante
                                </label>
                                <input
                                    type="text"
                                    value={variantLabelInput}
                                    onChange={(e) => setVariantLabelInput(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                    placeholder={`${activeVariantLabel} (KI)`}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                                    KI-Anweisung
                                </label>
                                <textarea
                                    value={variantInstruction}
                                    onChange={(e) => setVariantInstruction(e.target.value)}
                                    rows={7}
                                    className="w-full resize-y rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                    placeholder="Beschreibe, wie die Variante angepasst werden soll..."
                                />
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Tipp: Du kannst Anforderungen zu Sprache, Umfang, Hilfen oder Zusatzaufgaben kombinieren.
                                </p>
                            </div>
                        </div>

                        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsVariantPanelOpen(false)}
                                className="px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                            >
                                Abbrechen
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateVariantWithAI}
                                disabled={!providerReady || !variantInstruction.trim() || isChatLoading || isChatGenerating}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <Sparkles className={ICON_SIZES[11]} />
                                <span>Variante erzeugen</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};
