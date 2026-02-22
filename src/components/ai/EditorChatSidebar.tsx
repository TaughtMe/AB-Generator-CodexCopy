import React, { useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import {
    generateChatAssistantReply,
    getActiveProviderLabel,
    isActiveProviderConfigured,
} from '../../services/aiService';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { ChatMessage } from '../../types/ai';

export const EditorChatSidebar: React.FC = () => {
    const chatMessages = useWorkspaceStore((s) => s.chatMessages);
    const addChatMessage = useWorkspaceStore((s) => s.addChatMessage);
    const clearChat = useWorkspaceStore((s) => s.clearChat);
    const isChatGenerating = useWorkspaceStore((s) => s.isChatGenerating);

    const [input, setInput] = useState('');
    const [isReplyLoading, setIsReplyLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const historyRef = useRef<HTMLDivElement>(null);

    const providerReady = useMemo(() => isActiveProviderConfigured(), []);

    const pushAssistantMessage = (content: string) => {
        addChatMessage({ role: 'assistant', content });
        queueMicrotask(() => {
            historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: 'smooth' });
        });
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

    return (
        <aside className="h-full flex flex-col bg-white/70 dark:bg-slate-900/80 backdrop-blur-md shadow-xl">
            <div className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-slate-500 dark:text-slate-300" />
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">KI-Chatverlauf</h2>
                </div>
                <button
                    onClick={clearChat}
                    disabled={isReplyLoading || isChatGenerating || chatMessages.length === 0}
                    className="text-xs px-2.5 py-1 rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Chat leeren"
                >
                    Neu
                </button>
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

                {isReplyLoading && (
                    <div className="flex justify-start">
                        <div className="inline-flex items-center gap-2 rounded-xl rounded-bl-md bg-white/85 dark:bg-slate-800/90 px-3 py-2 text-xs text-slate-500">
                            <Loader2 size={12} className="animate-spin" /> KI denkt nach...
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

                {error && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">
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
                        className="flex-1 h-9 max-h-24 resize-none rounded-full bg-transparent px-3 py-2 text-xs text-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={!providerReady || !input.trim() || isReplyLoading || isChatGenerating}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        aria-label="Nachricht senden"
                    >
                        <Send size={14} />
                    </button>
                </form>
            </div>
        </aside>
    );
};
