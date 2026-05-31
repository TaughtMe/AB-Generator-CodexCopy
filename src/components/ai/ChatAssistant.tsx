import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Paperclip, Send, Sparkles } from 'lucide-react';
import {
    compileWorksheetPromptFromChat,
    getActiveProviderLabel,
    isActiveProviderConfigured,
    runAgentWorkflowStream,
    validateAndNormalizeTasks,
} from '../../services/aiService';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useWorksheetStore } from '../../store/worksheetStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useSourceStore } from '../../store/sourceStore';
import { ICON_SIZES } from '../ui/iconSizes';
import { SourcesManagerModal } from '../editor/SourcesManagerModal';
import type { AIProvider } from '../../store/settingsStore';

interface ChatAssistantProps {
    onBack: () => void;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({ onBack }) => {
    const chatMessages = useWorkspaceStore((s) => s.chatMessages);
    const isChatLoading = useWorkspaceStore((s) => s.isChatLoading);
    const chatError = useWorkspaceStore((s) => s.chatError);
    const chatStatusNotice = useWorkspaceStore((s) => s.chatStatusNotice);
    const sendChatMessage = useWorkspaceStore((s) => s.sendChatMessage);
    const startNewChat = useWorkspaceStore((s) => s.startNewChat);
    const setChatMessages = useWorkspaceStore((s) => s.setChatMessages);
    const seedGreetingIfEmpty = useWorkspaceStore((s) => s.seedGreetingIfEmpty);
    const setChatError = useWorkspaceStore((s) => s.setChatError);
    const saveCurrentWorksheet = useWorkspaceStore((s) => s.saveCurrentWorksheet);
    const setIsChatGenerating = useWorkspaceStore((s) => s.setIsChatGenerating);
    const isChatGenerating = useWorkspaceStore((s) => s.isChatGenerating);
    const startAgent = useWorkspaceStore((s) => s.startAgent);
    const setAgentPhase = useWorkspaceStore((s) => s.setAgentPhase);
    const addAgentLog = useWorkspaceStore((s) => s.addAgentLog);
    const afbConfig = useWorkspaceStore((s) => s.afbConfig);

    const replaceTasksFromAI = useWorksheetStore((s) => s.replaceTasksFromAI);
    const resetWorksheet = useWorksheetStore((s) => s.resetWorksheet);
    const sourceCount = useSourceStore((s) => s.sources.length);
    const activeSourceCount = useSourceStore((s) => s.sources.filter((source) => source.isActive).length);
    const abortChat = useWorkspaceStore((s) => s.abortChat);

    const [input, setInput] = useState('');
    const [showSourcesManager, setShowSourcesManager] = useState(false);
    const historyRef = useRef<HTMLDivElement>(null);
    const submitOnEnter = useSettingsStore((s) => s.submitOnEnter);
    const aiProvider = useSettingsStore((s) => s.aiProvider);
    const providers = useSettingsStore((s) => s.providers);
    const chatModelPreferences = useSettingsStore((s) => s.chatModelPreferences);
    const setChatStatusNotice = useWorkspaceStore((s) => s.setChatStatusNotice);

    const providerReady = useMemo(() => isActiveProviderConfigured(), []);

    useEffect(() => {
        seedGreetingIfEmpty();
        return () => { abortChat(); };
    }, [seedGreetingIfEmpty, abortChat]);

    useEffect(() => {
        queueMicrotask(() => {
            historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: 'smooth' });
        });
    }, [chatMessages.length, isChatLoading]);

    const handleStartNewConversation = () => {
        if (isChatLoading || isChatGenerating) return;
        startNewChat();
    };

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

    const handleGenerateWorksheet = async () => {
        if (isChatGenerating || isChatLoading) return;

        startAgent();
        addAgentLog('Agenten-Streaming gestartet...');

        setChatError(null);
        setIsChatGenerating(true);
        let shouldOpenEditor = false;

        try {
            const chatSnapshot = chatMessages
                .map((message) => ({ ...message, content: message.content.trim() }))
                .filter((message) => message.content.length > 0);

            addAgentLog(`${chatSnapshot.length} Chat-Nachrichten analysiert.`);
            const compiledPrompt = compileWorksheetPromptFromChat(chatMessages);
            const afbPromptHint = afbConfig.isActive
                ? `\n\nAFB-PROFIL (STRICT): Reproduktion ${afbConfig.reproduktion}%, Reorganisation ${afbConfig.reorganisation}%, Transfer ${afbConfig.transfer}%, Problemlösung ${afbConfig.problemloesung}%.`
                : '\n\nAFB-PROFIL: Keine starre Prozentvorgabe. Nutze eine pädagogisch ausgewogene Mischung.';
            const compiledPromptWithAfb = `${compiledPrompt}${afbPromptHint}`;
            const providerConfig = providers[aiProvider];
            const chatPreference = chatModelPreferences[aiProvider];
            const activeModel = (chatPreference && chatPreference !== 'auto') ? chatPreference : providerConfig.model;

            const workflowResult = await runAgentWorkflowStream({
                input: compiledPromptWithAfb,
                provider: aiProvider as AIProvider,
                model: activeModel,
                providerApiKey: providerConfig.apiKey,
                providerBaseURL: providerConfig.baseUrl,
                afbConfig,
            });

            if (useWorkspaceStore.getState().agentPhase !== 'success') {
                throw new Error('Agentenlauf wurde nicht erfolgreich abgeschlossen.');
            }

            addAgentLog(`Auditor-Score: ${workflowResult.validation.score}`);
            if (!workflowResult.validation.isValid && workflowResult.validation.errors.length > 0) {
                addAgentLog(`Auditor-Fehler: ${workflowResult.validation.errors[0]}`);
            }

            setAgentPhase('creating');
            addAgentLog('Hydrate JSON-Tasks in den Editor...');
            const normalizedTasks = validateAndNormalizeTasks(workflowResult.tasks as unknown[]);
            addAgentLog(`${normalizedTasks.length} Aufgaben normalisiert.`);

            resetWorksheet();
            replaceTasksFromAI(normalizedTasks);
            setChatMessages([{
                role: 'assistant',
                content: 'Das Arbeitsblatt ist nun im Editor. Du kannst hier weiter mit mir planen oder Anpassungen vornehmen.',
            }]);
            setChatStatusNotice('Arbeitsblatt erfolgreich generiert und in den Editor geladen.');
            await saveCurrentWorksheet();

            setAgentPhase('success');
            addAgentLog('Fertigstellung erfolgreich. Editor wird geöffnet...');
            shouldOpenEditor = true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Arbeitsblatt konnte nicht erstellt werden.';
            addAgentLog(`Fehler: ${message}`);
            setAgentPhase('error');
            useWorkspaceStore.getState().setCurrentView('ai-chat');
            setChatError(message);
        } finally {
            setIsChatGenerating(false);
            if (shouldOpenEditor) {
                useWorkspaceStore.getState().setCurrentView('editor');
                window.setTimeout(() => {
                    useWorkspaceStore.getState().resetAgent();
                }, 400);
            }
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
                        <ArrowLeft className={ICON_SIZES[14]} /> Zurück zum Dashboard
                    </button>
                    <button
                        onClick={handleStartNewConversation}
                        disabled={isChatLoading || isChatGenerating}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Neues Gespräch
                    </button>
                    <button
                        onClick={() => setShowSourcesManager(true)}
                        disabled={isChatLoading || isChatGenerating}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Unterrichtsmaterialien für den KI-Kontext verwalten"
                    >
                        <Paperclip className={ICON_SIZES[14]} />
                        Quellen ({activeSourceCount}/{sourceCount})
                    </button>
                </div>

                <button
                    onClick={handleGenerateWorksheet}
                    disabled={chatMessages.length === 0 || isChatGenerating || isChatLoading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-colors shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isChatGenerating ? <Loader2 className={`${ICON_SIZES[16]} animate-spin`} /> : <Sparkles className={ICON_SIZES[16]} />}
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

                    {isChatLoading && (
                        <div className="flex justify-start">
                            <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-white/90 dark:bg-slate-800/90 px-3 py-2 text-xs text-slate-500">
                                <Loader2 className={`${ICON_SIZES[13]} animate-spin`} /> KI denkt nach...
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

                    {chatError && (
                        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            {chatError}
                        </div>
                    )}

                    {chatStatusNotice && (
                        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
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
                            className="flex-1 h-10 max-h-24 resize-none rounded-full bg-transparent px-3 py-2 text-sm text-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                        />
                        <button
                            type="submit"
                            disabled={!providerReady || !input.trim() || isChatLoading || isChatGenerating}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Nachricht senden"
                        >
                            <Send className={ICON_SIZES[16]} />
                        </button>
                    </form>
                </div>
            </div>

            <SourcesManagerModal
                isOpen={showSourcesManager}
                onClose={() => setShowSourcesManager(false)}
            />
        </div>
    );
};
