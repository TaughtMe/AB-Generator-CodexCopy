import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import {
    getActiveProviderLabel,
    isActiveProviderConfigured,
} from '../../services/aiService';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useSettingsStore } from '../../store/settingsStore';
import { ICON_SIZES } from '../ui/iconSizes';

export const EditorChatSidebar: React.FC = () => {
    const chatMessages = useWorkspaceStore((s) => s.chatMessages);
    const isChatLoading = useWorkspaceStore((s) => s.isChatLoading);
    const chatError = useWorkspaceStore((s) => s.chatError);
    const chatStatusNotice = useWorkspaceStore((s) => s.chatStatusNotice);
    const isChatGenerating = useWorkspaceStore((s) => s.isChatGenerating);
    const sendChatMessage = useWorkspaceStore((s) => s.sendChatMessage);
    const startNewChat = useWorkspaceStore((s) => s.startNewChat);
    const seedGreetingIfEmpty = useWorkspaceStore((s) => s.seedGreetingIfEmpty);

    const [input, setInput] = useState('');
    const historyRef = useRef<HTMLDivElement>(null);
    const submitOnEnter = useSettingsStore((s) => s.submitOnEnter);

    const providerReady = useMemo(() => isActiveProviderConfigured(), []);

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
        </aside>
    );
};
