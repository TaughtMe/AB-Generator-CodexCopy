import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Sparkles, X } from 'lucide-react';
import {
    compileWorksheetPromptFromChat,
    generateChatAssistantReply,
    generateTasksFromCompiledPrompt,
    getActiveProviderLabel,
    isActiveProviderConfigured,
} from '../../services/aiService';
import { useSettingsStore } from '../../store/settingsStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useWorksheetStore } from '../../store/worksheetStore';
import type { ChatMessage } from '../../types/ai';
import { ICON_SIZES } from '../ui/iconSizes';

interface PreCreationChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenEditor: () => void;
}

const PLANNING_GREETING: ChatMessage = {
    role: 'assistant',
    content: 'Ich plane mit dir dein Arbeitsblatt. Nenne Thema, Klasse, Fach und gewünschte Aufgabentypen. Schreibe anschließend "Blatt generieren", wenn ich starten soll.',
};

function isGenerateWorksheetCommand(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return /^(blatt|arbeitsblatt)\s+generieren!?$/.test(normalized)
        || /^(generiere|erstelle)\s+(das\s+)?(blatt|arbeitsblatt)!?$/.test(normalized);
}

function getInitialPlanningMessages(): ChatMessage[] {
    return [PLANNING_GREETING];
}

function stripTrailingGenerateCommand(messages: ChatMessage[]): ChatMessage[] {
    if (messages.length === 0) return messages;
    const last = messages[messages.length - 1];
    if (last.role !== 'user' || !isGenerateWorksheetCommand(last.content)) return messages;
    return messages.slice(0, -1);
}

export const PreCreationChatModal: React.FC<PreCreationChatModalProps> = ({ isOpen, onClose, onOpenEditor }) => {
    const saveCurrentWorksheet = useWorkspaceStore((s) => s.saveCurrentWorksheet);
    const setChatMessages = useWorkspaceStore((s) => s.setChatMessages);
    const setChatError = useWorkspaceStore((s) => s.setChatError);
    const setChatStatusNotice = useWorkspaceStore((s) => s.setChatStatusNotice);
    const setAiSidebarDraft = useWorkspaceStore((s) => s.setAiSidebarDraft);

    const resetWorksheet = useWorksheetStore((s) => s.resetWorksheet);
    const addTasksFromAI = useWorksheetStore((s) => s.addTasksFromAI);

    const submitOnEnter = useSettingsStore((s) => s.submitOnEnter);

    const providerReady = isActiveProviderConfigured();
    const historyRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const [messages, setMessages] = useState<ChatMessage[]>(getInitialPlanningMessages);
    const [input, setInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setMessages(getInitialPlanningMessages());
        setInput('');
        setIsChatLoading(false);
        setIsGenerating(false);
        setError(null);
        queueMicrotask(() => inputRef.current?.focus());
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        queueMicrotask(() => {
            historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: 'smooth' });
        });
    }, [isOpen, messages.length, isChatLoading]);

    const handleClose = () => {
        if (isChatLoading || isGenerating) return;
        onClose();
    };

    const handleGenerateWorksheet = async (messageSnapshot?: ChatMessage[]) => {
        if (isGenerating || isChatLoading) return;

        const fullSnapshot = (messageSnapshot ?? messages)
            .map((message) => ({ ...message, content: message.content.trim() }))
            .filter((message) => message.content.length > 0);
        const promptSnapshot = stripTrailingGenerateCommand(fullSnapshot);

        setError(null);
        setIsGenerating(true);

        try {
            const compiledPrompt = compileWorksheetPromptFromChat(promptSnapshot.length > 0 ? promptSnapshot : fullSnapshot);
            const generatedTasks = await generateTasksFromCompiledPrompt(compiledPrompt);

            resetWorksheet();
            addTasksFromAI(generatedTasks);
            setChatMessages(fullSnapshot);
            setChatError(null);
            setChatStatusNotice('Chatverlauf aus der KI-Planung übernommen.');
            setAiSidebarDraft('');
            await saveCurrentWorksheet();

            onClose();
            onOpenEditor();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Arbeitsblatt konnte nicht generiert werden.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendText = async (rawText: string) => {
        const trimmed = rawText.trim();
        if (!trimmed || isChatLoading || isGenerating) return;

        const userMessage: ChatMessage = { role: 'user', content: trimmed };
        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        setInput('');
        setError(null);

        if (isGenerateWorksheetCommand(trimmed)) {
            await handleGenerateWorksheet(nextMessages);
            return;
        }

        setIsChatLoading(true);
        try {
            const reply = await generateChatAssistantReply(nextMessages);
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: reply || 'Bitte präzisiere Thema, Klasse oder Aufgabentypen.',
            };
            setMessages((current) => [...current, assistantMessage]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'KI-Antwort fehlgeschlagen.');
        } finally {
            setIsChatLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleSendText(input);
    };

    const handleInputKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!submitOnEnter) return;
        if (e.key !== 'Enter' || e.shiftKey) return;
        e.preventDefault();
        await handleSendText(input);
    };

    const handleResetConversation = () => {
        if (isChatLoading || isGenerating) return;
        setMessages(getInitialPlanningMessages());
        setInput('');
        setError(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
            <div className="flex h-[min(86vh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Mit KI planen</h2>
                        <p className="text-xs text-slate-500">Planungschat vor der Erstellung. Mit "Blatt generieren" wird das Worksheet erzeugt.</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isChatLoading || isGenerating}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 cursor-pointer"
                        aria-label="Modal schließen"
                    >
                        <X className={ICON_SIZES[16]} />
                    </button>
                </div>

                <div ref={historyRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
                    {messages.map((message, index) => (
                        <div
                            key={`${message.role}-${index}`}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                                    message.role === 'user'
                                        ? 'rounded-br-md bg-blue-600 text-white'
                                        : 'rounded-bl-md bg-white text-slate-700 border border-slate-200'
                                }`}
                            >
                                {message.content}
                            </div>
                        </div>
                    ))}

                    {isChatLoading && (
                        <div className="flex justify-start">
                            <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                                <Loader2 className={`${ICON_SIZES[13]} animate-spin`} />
                                KI denkt nach...
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-3 border-t border-slate-200 px-4 py-4">
                    {!providerReady && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            KI nicht konfiguriert. Bitte Einstellungen für {getActiveProviderLabel()} prüfen.
                        </div>
                    )}

                    {error && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleResetConversation}
                            disabled={isChatLoading || isGenerating}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            Neues Gespräch
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleGenerateWorksheet()}
                            disabled={!providerReady || isChatLoading || isGenerating || messages.length === 0}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isGenerating ? <Loader2 className={`${ICON_SIZES[12]} animate-spin`} /> : <Sparkles className={ICON_SIZES[12]} />}
                            Blatt generieren
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-2">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            rows={1}
                            disabled={!providerReady || isChatLoading || isGenerating}
                            placeholder='Nachricht eingeben oder "Blatt generieren" schreiben...'
                            className="min-h-9 flex-1 resize-none bg-transparent px-2 py-1 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                        />
                        <button
                            type="submit"
                            disabled={!providerReady || !input.trim() || isChatLoading || isGenerating}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            aria-label="Nachricht senden"
                        >
                            <Send className={ICON_SIZES[14]} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
