import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Send, Sparkles } from 'lucide-react';
import {
    compileWorksheetPromptFromChat,
    generateChatAssistantReply,
    generateTasksFromCompiledPrompt,
    getActiveProviderLabel,
    isActiveProviderConfigured,
} from '../../services/aiService';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useWorksheetStore } from '../../store/worksheetStore';
import type { ChatMessage } from '../../types/ai';

interface ChatAssistantProps {
    onBack: () => void;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({ onBack }) => {
    const chatMessages = useWorkspaceStore((s) => s.chatMessages);
    const addChatMessage = useWorkspaceStore((s) => s.addChatMessage);
    const clearChat = useWorkspaceStore((s) => s.clearChat);
    const setCurrentView = useWorkspaceStore((s) => s.setCurrentView);
    const setIsChatGenerating = useWorkspaceStore((s) => s.setIsChatGenerating);
    const isChatGenerating = useWorkspaceStore((s) => s.isChatGenerating);

    const addTasksFromAI = useWorksheetStore((s) => s.addTasksFromAI);
    const resetWorksheet = useWorksheetStore((s) => s.resetWorksheet);

    const [input, setInput] = useState('');
    const [isReplyLoading, setIsReplyLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const historyRef = useRef<HTMLDivElement>(null);
    const didSeedGreetingRef = useRef(false);

    const providerReady = useMemo(() => isActiveProviderConfigured(), []);

    useEffect(() => {
        if (didSeedGreetingRef.current) return;
        if (chatMessages.length > 0) return;

        addChatMessage({
            role: 'assistant',
            content: 'Hallo! Ich helfe dir beim Planen deines Arbeitsblatts. Nenne mir zuerst Thema, Klasse und gewünschte Aufgabentypen.',
        });
        didSeedGreetingRef.current = true;
    }, [addChatMessage, chatMessages.length]);

    const pushAssistantMessage = (content: string) => {
        addChatMessage({ role: 'assistant', content });
        queueMicrotask(() => {
            historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: 'smooth' });
        });
    };

    const handleStartNewConversation = () => {
        if (isReplyLoading || isChatGenerating) return;

        setError(null);
        clearChat();
        didSeedGreetingRef.current = false;
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed || isReplyLoading || isChatGenerating) return;

        setError(null);
        setInput('');

        const userMessage: ChatMessage = { role: 'user', content: trimmed };
        addChatMessage(userMessage);

        const nextMessages = [...chatMessages, userMessage];

        setIsReplyLoading(true);
        try {
            const reply = await generateChatAssistantReply(nextMessages);
            pushAssistantMessage(reply || 'Ich habe dazu gerade keine gute Antwort. Kannst du es bitte anders formulieren?');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unbekannter Fehler bei der KI-Antwort.');
        } finally {
            setIsReplyLoading(false);
        }
    };

    const handleGenerateWorksheet = async () => {
        if (isChatGenerating || isReplyLoading) return;

        setError(null);
        setIsChatGenerating(true);

        try {
            const compiledPrompt = compileWorksheetPromptFromChat(chatMessages);
            const generatedTasks = await generateTasksFromCompiledPrompt(compiledPrompt);

            resetWorksheet();
            addTasksFromAI(generatedTasks);
            clearChat();
            setCurrentView('editor');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Arbeitsblatt konnte nicht erstellt werden.');
        } finally {
            setIsChatGenerating(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-6 py-8 md:py-10">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onBack}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                        <ArrowLeft size={14} /> Zurück zum Dashboard
                    </button>
                    <button
                        onClick={handleStartNewConversation}
                        disabled={isReplyLoading || isChatGenerating}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Neues Gespräch
                    </button>
                </div>

                <button
                    onClick={handleGenerateWorksheet}
                    disabled={chatMessages.length === 0 || isChatGenerating || isReplyLoading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-colors shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isChatGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    ✨ Arbeitsblatt erstellen
                </button>
            </div>

            <div className="rounded-2xl bg-white/75 dark:bg-slate-900/80 backdrop-blur-md shadow-xl overflow-hidden">
                <div className="px-5 py-4">
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">KI-Assistent</h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Besprich Thema, Zielgruppe und Aufgabentypen. Danach klickst du auf „✨ Arbeitsblatt erstellen“.
                    </p>
                </div>

                <div ref={historyRef} className="h-[52vh] overflow-y-auto p-4 space-y-3 bg-slate-50/80 dark:bg-slate-950/50">
                    {chatMessages.length === 0 && (
                        <div className="h-full flex items-center justify-center text-center px-6">
                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">
                                Starte den Chat mit einem kurzen Auftrag, z.B. „Deutsch Klasse 6, Thema Märchen, 5 gemischte Aufgaben".
                            </p>
                        </div>
                    )}

                    {chatMessages.map((message, index) => (
                        <div
                            key={`${message.role}-${index}`}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                                    message.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-md'
                                        : 'bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-100 rounded-bl-md'
                                }`}
                            >
                                {message.content}
                            </div>
                        </div>
                    ))}

                    {isReplyLoading && (
                        <div className="flex justify-start">
                            <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-white/90 dark:bg-slate-800/90 px-3 py-2 text-xs text-slate-500">
                                <Loader2 size={13} className="animate-spin" /> KI denkt nach...
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4">
                    {!providerReady && (
                        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            KI nicht konfiguriert. Bitte Einstellungen für {getActiveProviderLabel()} prüfen.
                        </div>
                    )}

                    {error && (
                        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSend} className="flex items-center gap-2 rounded-full bg-white/85 dark:bg-slate-800/85 backdrop-blur px-2 py-2">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            rows={1}
                            placeholder="Nachricht an den KI-Assistenten..."
                            disabled={!providerReady || isReplyLoading || isChatGenerating}
                            className="flex-1 h-10 max-h-24 resize-none rounded-full bg-transparent px-3 py-2 text-sm text-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                        />
                        <button
                            type="submit"
                            disabled={!providerReady || !input.trim() || isReplyLoading || isChatGenerating}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Nachricht senden"
                        >
                            <Send size={16} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
