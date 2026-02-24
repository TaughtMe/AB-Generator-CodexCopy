import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquare, Send, Sparkles } from 'lucide-react';
import {
    getActiveProviderLabel,
    isActiveProviderConfigured,
} from '../../services/aiService';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useWorksheetStore } from '../../store/worksheetStore';
import { useSettingsStore } from '../../store/settingsStore';
import { ICON_SIZES } from '../ui/iconSizes';

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

export const EditorChatSidebar: React.FC = () => {
    const chatMessages = useWorkspaceStore((s) => s.chatMessages);
    const isChatLoading = useWorkspaceStore((s) => s.isChatLoading);
    const chatError = useWorkspaceStore((s) => s.chatError);
    const chatStatusNotice = useWorkspaceStore((s) => s.chatStatusNotice);
    const isChatGenerating = useWorkspaceStore((s) => s.isChatGenerating);
    const sendChatMessage = useWorkspaceStore((s) => s.sendChatMessage);
    const createDifferentiatedVariantFromPrompt = useWorkspaceStore((s) => s.createDifferentiatedVariantFromPrompt);
    const startNewChat = useWorkspaceStore((s) => s.startNewChat);
    const seedGreetingIfEmpty = useWorkspaceStore((s) => s.seedGreetingIfEmpty);
    const variants = useWorksheetStore((s) => s.variants);
    const activeVariantId = useWorksheetStore((s) => s.activeVariantId);

    const [input, setInput] = useState('');
    const [isVariantPanelOpen, setIsVariantPanelOpen] = useState(false);
    const [variantPreset, setVariantPreset] = useState<VariantDifferentiationPreset>('simplify');
    const [variantInstruction, setVariantInstruction] = useState('');
    const [variantLabelInput, setVariantLabelInput] = useState('');
    const historyRef = useRef<HTMLDivElement>(null);
    const submitOnEnter = useSettingsStore((s) => s.submitOnEnter);

    const providerReady = useMemo(() => isActiveProviderConfigured(), []);
    const activeVariantLabel = useMemo(
        () => variants.find((variant) => variant.id === activeVariantId)?.label ?? 'Standard',
        [variants, activeVariantId],
    );

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
        <aside className="h-full flex flex-col bg-white/70 dark:bg-slate-900/80 backdrop-blur-md shadow-xl">
            <div className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <MessageSquare className={`${ICON_SIZES[16]} text-slate-500 dark:text-slate-300`} />
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">KI-Chatverlauf</h2>
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

            <div ref={historyRef} className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {chatMessages.length === 0 && (
                    <div className="h-full flex items-center justify-center text-center px-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
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
                            className={`max-w-[92%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                                message.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-md'
                                    : 'bg-white/85 dark:bg-slate-800/90 text-slate-700 dark:text-slate-100 rounded-bl-md'
                            }`}
                        >
                            {message.content}
                        </div>
                    </div>
                ))}

                {isChatLoading && (
                    <div className="flex justify-start">
                        <div className="inline-flex items-center gap-2 rounded-xl rounded-bl-md bg-white/85 dark:bg-slate-800/90 px-3 py-2 text-xs text-slate-500">
                            <Loader2 className={`${ICON_SIZES[12]} animate-spin`} /> KI denkt nach...
                        </div>
                    </div>
                )}
            </div>

            <div className="p-3 space-y-2">
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

                <form onSubmit={handleSend} className="flex items-center gap-2 rounded-full bg-white/85 dark:bg-slate-800/85 backdrop-blur px-2 py-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        rows={1}
                        placeholder="Nachricht an den KI-Assistenten..."
                        disabled={!providerReady || isChatLoading || isChatGenerating}
                        className="flex-1 h-9 max-h-24 resize-none rounded-full bg-transparent px-3 py-2 text-xs text-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={!providerReady || !input.trim() || isChatLoading || isChatGenerating}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
