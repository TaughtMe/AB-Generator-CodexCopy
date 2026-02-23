import { create } from 'zustand';
import {
    saveWorksheet,
    loadWorksheet,
    deleteWorksheet,
    listRecentWorksheets,
    listClassProfiles,
    getClassProfile,
    createClassProfile as createClassProfileRecord,
    updateClassProfile as updateClassProfileRecord,
    deleteClassProfile as deleteClassProfileRecord,
    countWorksheetsByClassId,
    unlinkClassFromWorksheets,
    createDesignTemplate,
    deleteDesignTemplate,
    getDesignTemplate,
    getImage,
    addImage,
    listDesignTemplates,
    markDesignTemplateUsed,
    updateDesignTemplate,
    getDesignTemplateByName,
    upsertDesignTemplateByName,
    type WorksheetMeta,
    type WorksheetFilter,
} from './dexieStore';
import { useWorksheetStore } from './worksheetStore';
import type { ChatMessage } from '../types/ai';
import { useSettingsStore } from './settingsStore';
import { useProfileStore } from './profileStore';
import { normalizeTemplateName, type DesignTemplate } from '../types/designTemplate';
import {
    AI_JSON_TRUNCATED_USER_MESSAGE,
    generateChatAssistantReply,
    generateTaskRevisionResult,
    type AIClassContext,
} from '../services/aiService';
import type { Task, WorksheetSource } from '../types/worksheet';
import type { ClassProfile } from '../types/profiles';

const CHAT_GREETING = 'Hallo! Ich helfe dir beim Planen deines Arbeitsblatts. Nenne mir zuerst Thema, Klasse und gewünschte Aufgabentypen.';
const LEGACY_CLASS_MIGRATION_FLAG = 'ab-generator-classprofiles-migrated-v1';

function hasLegacyClassMigrationRun(): boolean {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(LEGACY_CLASS_MIGRATION_FLAG) === '1';
}

function markLegacyClassMigrationDone(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LEGACY_CLASS_MIGRATION_FLAG, '1');
}

function getVisibleTaskNumberById(
    taskId: string,
    tasksById: Record<string, Task>,
    taskIds: string[],
): number | null | undefined {
    if (!tasksById[taskId]) return undefined;

    let counter = 0;
    for (const id of taskIds) {
        const task = tasksById[id];
        if (!task || task.type === 'page-break') continue;

        if (task.showNumber === false) {
            if (id === taskId) return null;
            continue;
        }

        counter += 1;
        if (id === taskId) return counter;
    }

    return undefined;
}

function buildRevisionConfirmationMessage(updatedCount: number, addedCount: number): string {
    const parts: string[] = [];

    if (updatedCount > 0) {
        parts.push(`${updatedCount} Aufgabe${updatedCount === 1 ? '' : 'n'} aktualisiert`);
    }
    if (addedCount > 0) {
        parts.push(`${addedCount} Aufgabe${addedCount === 1 ? '' : 'n'} hinzugefügt`);
    }

    if (parts.length === 0) return 'Änderungen übernommen.';
    return `Erledigt: Insgesamt ${parts.join(', ')}.`;
}

function buildPreciseRevisionConfirmationMessage(
    updatedTaskIds: string[],
    addedCount: number,
    tasksById: Record<string, Task>,
    taskIds: string[],
): string {
    if (updatedTaskIds.length === 1 && addedCount === 0) {
        const taskNumber = getVisibleTaskNumberById(updatedTaskIds[0], tasksById, taskIds);

        if (typeof taskNumber === 'number') {
            return `Erledigt: Aufgabe ${taskNumber} wurde aktualisiert.`;
        }

        if (taskNumber === null) {
            return 'Erledigt: Eine unnummerierte Aufgabe wurde aktualisiert.';
        }

        return 'Erledigt: Eine Aufgabe wurde aktualisiert.';
    }

    return buildRevisionConfirmationMessage(updatedTaskIds.length, addedCount);
}

function buildAIClassContextFromProfile(profile?: ClassProfile): AIClassContext | undefined {
    if (!profile) return undefined;

    const subject = profile.subjectId
        ? useProfileStore.getState().subjects.find((entry) => entry.id === profile.subjectId)
        : undefined;

    return {
        className: profile.name,
        subjectName: subject?.name,
        curriculumContext: profile.curriculumContext,
        studentProfile: profile.studentProfile || profile.characteristic || '',
    };
}

/* ══════════════════════════════════════════════════
   workspaceStore.ts – Workspace / Worksheet Management
   Verbindet worksheetStore (In-Memory) mit Dexie (Persistenz).
   ══════════════════════════════════════════════════ */

interface WorkspaceState {
    recentWorksheets: WorksheetMeta[];
    classProfiles: ClassProfile[];
    currentWorksheetId: string | null;
    isLoading: boolean;
    isClassProfilesLoading: boolean;
    classProfilesError: string | null;
    /** Aktive Filter für die Materialien-Ansicht */
    filter: WorksheetFilter;
    currentView: WorkspaceView;
    chatMessages: ChatMessage[];
    isChatLoading: boolean;
    chatError: string | null;
    chatStatusNotice: string | null;
    isChatGenerating: boolean;
    isAiSidebarOpen: boolean;
    /** Outline-Navigator (linke Sidebar im Editor) */
    isOutlineOpen: boolean;
    /** Placement-Modus: Nutzer platziert eine neue Aufgabe per Klick im Canvas */
    isPlacingNewTask: boolean;
    designTemplates: DesignTemplate[];
    selectedTemplateId: string | null;
    isTemplateLoading: boolean;
    isTemplateGalleryOpen: boolean;
    editingTemplateId: string | null;
}

export type WorkspaceView = 'dashboard' | 'ai-chat' | 'editor';

interface WorkspaceActions {
    loadClassProfiles: () => Promise<void>;
    createClassProfile: (payload: {
        name: string;
        subjectId?: string;
        curriculumContext?: string;
        studentProfile?: string;
    }) => Promise<ClassProfile>;
    updateClassProfile: (id: string, patch: {
        name?: string;
        subjectId?: string | null;
        curriculumContext?: string;
        studentProfile?: string;
    }) => Promise<ClassProfile | undefined>;
    removeClassProfile: (id: string) => Promise<void>;
    getClassProfileById: (id: string) => ClassProfile | undefined;
    /** Lädt die "Zuletzt bearbeitet" Liste aus Dexie (mit optionalem Filter) */
    loadRecent: (filter?: WorksheetFilter) => Promise<void>;
    /** Setzt den aktiven Filter und lädt neu */
    setFilter: (filter: WorksheetFilter) => Promise<void>;
    /** Speichert das aktuelle Arbeitsblatt in Dexie.
     *  Optionaler `thumbnail`-Blob wird direkt mitgespeichert.
     *  Wird kein Blob übergeben, bleibt das alte Thumbnail erhalten. */
    saveCurrentWorksheet: (thumbnail?: Blob) => Promise<void>;
    /** Öffnet ein gespeichertes Arbeitsblatt im Editor */
    openWorksheet: (id: string) => Promise<boolean>;
    /** Erstellt ein neues leeres Arbeitsblatt */
    createNewWorksheet: () => void;
    /** Löscht ein Arbeitsblatt aus Dexie und aktualisiert die Liste */
    removeWorksheet: (id: string) => Promise<void>;
    setCurrentView: (view: WorkspaceView) => void;
    addChatMessage: (message: ChatMessage) => void;
    setChatMessages: (messages: ChatMessage[]) => void;
    clearChat: () => void;
    setIsChatGenerating: (isGenerating: boolean) => void;
    setChatError: (error: string | null) => void;
    setChatStatusNotice: (notice: string | null) => void;
    clearChatError: () => void;
    seedGreetingIfEmpty: () => void;
    startNewChat: () => void;
    sendChatMessage: (text: string) => Promise<void>;
    setWorksheetSources: (sources: WorksheetSource[]) => Promise<void>;
    upsertWorksheetSource: (source: WorksheetSource) => Promise<void>;
    removeWorksheetSource: (sourceId: string) => Promise<void>;
    toggleAiSidebar: () => void;
    toggleOutline: () => void;
    /** Startet den Placement-Modus: Maus-Klick im Canvas platziert neue Aufgabe */
    startPlacingTask: () => void;
    /** Bricht den Placement-Modus ab */
    cancelPlacingTask: () => void;
    loadDesignTemplates: () => Promise<void>;
    saveCurrentDesignAsTemplate: (name: string, overwrite?: boolean, targetTemplateId?: string) => Promise<DesignTemplate>;
    applyTemplateToCurrentWorksheet: (templateId: string) => Promise<boolean>;
    removeDesignTemplate: (templateId: string) => Promise<void>;
    openTemplateGallery: () => void;
    closeTemplateGallery: () => void;
    startTemplateEdit: (templateId: string) => void;
    clearTemplateEdit: () => void;
}

type WorkspaceStore = WorkspaceState & WorkspaceActions;

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
    recentWorksheets: [],
    classProfiles: [],
    currentWorksheetId: null,
    isLoading: false,
    isClassProfilesLoading: false,
    classProfilesError: null,
    filter: {},
    currentView: 'dashboard',
    chatMessages: [],
    isChatLoading: false,
    chatError: null,
    chatStatusNotice: null,
    isChatGenerating: false,
    isAiSidebarOpen: false,
    isOutlineOpen: false,
    isPlacingNewTask: false,
    designTemplates: [],
    selectedTemplateId: null,
    isTemplateLoading: false,
    isTemplateGalleryOpen: false,
    editingTemplateId: null,

    loadClassProfiles: async () => {
        set({ isClassProfilesLoading: true, classProfilesError: null });
        try {
            let profiles = await listClassProfiles();

            if (profiles.length === 0 && !hasLegacyClassMigrationRun()) {
                const legacyClasses = useProfileStore.getState().classes;

                for (const legacy of legacyClasses) {
                    const legacyStudentProfile = typeof legacy.studentProfile === 'string'
                        ? legacy.studentProfile
                        : (legacy.characteristic ?? '');

                    await createClassProfileRecord({
                        id: legacy.id,
                        name: legacy.name,
                        subjectId: legacy.subjectId,
                        curriculumContext: legacy.curriculumContext ?? '',
                        studentProfile: legacyStudentProfile,
                    });
                }

                markLegacyClassMigrationDone();
                profiles = await listClassProfiles();
            }

            set({ classProfiles: profiles, isClassProfilesLoading: false, classProfilesError: null });
        } catch (error) {
            set({
                isClassProfilesLoading: false,
                classProfilesError: error instanceof Error ? error.message : 'Klassenprofile konnten nicht geladen werden.',
            });
        }
    },

    createClassProfile: async (payload) => {
        const created = await createClassProfileRecord(payload);
        set((state) => ({
            classProfiles: [created, ...state.classProfiles.filter((entry) => entry.id !== created.id)],
            classProfilesError: null,
        }));
        return created;
    },

    updateClassProfile: async (id, patch) => {
        const updated = await updateClassProfileRecord(id, patch);
        if (!updated) return undefined;

        set((state) => ({
            classProfiles: state.classProfiles
                .map((entry) => (entry.id === id ? updated : entry))
                .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()),
            classProfilesError: null,
        }));

        return updated;
    },

    removeClassProfile: async (id) => {
        const linkedCount = await countWorksheetsByClassId(id);
        if (linkedCount > 0) {
            await unlinkClassFromWorksheets(id);
        }

        await deleteClassProfileRecord(id);
        if (useProfileStore.getState().activeClassId === id) {
            useProfileStore.getState().setActiveClass(null);
        }

        set((state) => ({
            classProfiles: state.classProfiles.filter((entry) => entry.id !== id),
            classProfilesError: null,
            filter: state.filter.classId === id ? { ...state.filter, classId: undefined } : state.filter,
        }));

        const ws = useWorksheetStore.getState();
        if (ws.classId === id) {
            ws.setClassId(undefined);
        }

        await get().loadRecent();
    },

    getClassProfileById: (id) => {
        return get().classProfiles.find((entry) => entry.id === id);
    },

    loadRecent: async (filter) => {
        const activeFilter = filter ?? get().filter;
        const recent = await listRecentWorksheets(50, activeFilter);
        set({ recentWorksheets: recent });
    },

    setFilter: async (filter) => {
        set({ filter });
        await get().loadRecent(filter);
    },

    saveCurrentWorksheet: async (thumbnail?: Blob) => {
        const ws = useWorksheetStore.getState();
        await saveWorksheet(
            ws.id,
            ws.title,
            ws.tasksById,
            ws.taskIds,
            ws.chatHistory,
            ws.sources,
            undefined,
            ws.classId,
            thumbnail,
        );
        set({ currentWorksheetId: ws.id });
        // Refresh recent list
        await get().loadRecent();
    },

    openWorksheet: async (id: string) => {
        set({ isLoading: true });
        try {
            const record = await loadWorksheet(id);
            if (!record) {
                set({ isLoading: false });
                return false;
            }
            // Push data into worksheetStore
            const wsStore = useWorksheetStore.getState();
            wsStore.loadFromRecord(
                record.id,
                record.title,
                record.tasksById,
                record.taskIds,
                record.chatHistory,
                record.sources,
                record.classId,
            );
            set({
                currentWorksheetId: id,
                chatMessages: record.chatHistory ?? [],
                chatError: null,
                chatStatusNotice: null,
                isChatLoading: false,
                isLoading: false,
            });
            return true;
        } catch {
            set({ isLoading: false });
            return false;
        }
    },

    createNewWorksheet: () => {
        const wsStore = useWorksheetStore.getState();
        wsStore.resetWorksheet();
        set({
            currentWorksheetId: useWorksheetStore.getState().id,
            chatMessages: [],
            chatError: null,
            chatStatusNotice: null,
            isChatLoading: false,
        });
    },

    removeWorksheet: async (id: string) => {
        await deleteWorksheet(id);
        await get().loadRecent();
    },

    setCurrentView: (view) => {
        set({ currentView: view });
    },

    addChatMessage: (message) => {
        const messages = [...get().chatMessages, message];
        useWorksheetStore.getState().setChatHistory(messages);
        set({ chatMessages: messages });
        void (async () => {
            const ws = useWorksheetStore.getState();
            await saveWorksheet(
                ws.id,
                ws.title,
                ws.tasksById,
                ws.taskIds,
                ws.chatHistory,
                ws.sources,
                undefined,
                ws.classId,
            );
        })();
    },

    setChatMessages: (messages) => {
        useWorksheetStore.getState().setChatHistory(messages);
        set({ chatMessages: messages });
        void (async () => {
            const ws = useWorksheetStore.getState();
            await saveWorksheet(
                ws.id,
                ws.title,
                ws.tasksById,
                ws.taskIds,
                ws.chatHistory,
                ws.sources,
                undefined,
                ws.classId,
            );
        })();
    },

    clearChat: () => {
        useWorksheetStore.getState().setChatHistory([]);
        set({ chatMessages: [] });
        void (async () => {
            const ws = useWorksheetStore.getState();
            await saveWorksheet(
                ws.id,
                ws.title,
                ws.tasksById,
                ws.taskIds,
                ws.chatHistory,
                ws.sources,
                undefined,
                ws.classId,
            );
        })();
    },

    setIsChatGenerating: (isGenerating) => {
        set({ isChatGenerating: isGenerating });
    },

    setChatError: (error) => {
        set({ chatError: error });
    },

    setChatStatusNotice: (notice) => {
        set({ chatStatusNotice: notice });
    },

    clearChatError: () => {
        set({ chatError: null });
    },

    seedGreetingIfEmpty: () => {
        set((state) => {
            if (state.chatMessages.length > 0) return state;
            const seeded = [{ role: 'assistant', content: CHAT_GREETING } as ChatMessage];
            useWorksheetStore.getState().setChatHistory(seeded);
            void (async () => {
                const ws = useWorksheetStore.getState();
                await saveWorksheet(
                    ws.id,
                    ws.title,
                    ws.tasksById,
                    ws.taskIds,
                    ws.chatHistory,
                    ws.sources,
                    undefined,
                    ws.classId,
                );
            })();
            return {
                chatMessages: seeded,
                chatError: null,
                chatStatusNotice: null,
            };
        });
    },

    startNewChat: () => {
        const seeded = [{ role: 'assistant', content: CHAT_GREETING } as ChatMessage];
        useWorksheetStore.getState().setChatHistory(seeded);
        set({
            chatMessages: seeded,
            chatError: null,
            chatStatusNotice: null,
            isChatLoading: false,
        });
        void (async () => {
            const ws = useWorksheetStore.getState();
            await saveWorksheet(
                ws.id,
                ws.title,
                ws.tasksById,
                ws.taskIds,
                ws.chatHistory,
                ws.sources,
                undefined,
                ws.classId,
            );
        })();
    },

    sendChatMessage: async (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        const state = get();
        if (state.isChatLoading || state.isChatGenerating) return;

        const userMessage: ChatMessage = { role: 'user', content: trimmed };
        const nextMessages = [...state.chatMessages, userMessage];
        const wsStore = useWorksheetStore.getState();

        wsStore.setChatHistory(nextMessages);
        set({
            chatMessages: nextMessages,
            isChatLoading: true,
            chatError: null,
            chatStatusNotice: null,
        });

        void saveWorksheet(
            wsStore.id,
            wsStore.title,
            wsStore.tasksById,
            wsStore.taskIds,
            nextMessages,
            wsStore.sources,
            undefined,
            wsStore.classId,
        );

        try {
            const latestWorksheet = useWorksheetStore.getState();
            let aiClassContext: AIClassContext | undefined;
            if (latestWorksheet.classId) {
                let classProfile = get().getClassProfileById(latestWorksheet.classId);
                if (!classProfile) {
                    classProfile = await getClassProfile(latestWorksheet.classId);
                    if (classProfile) {
                        const resolvedProfile = classProfile;
                        set((state) => ({
                            classProfiles: [resolvedProfile, ...state.classProfiles.filter((entry) => entry.id !== resolvedProfile.id)],
                        }));
                    }
                }
                aiClassContext = buildAIClassContextFromProfile(classProfile);
            }

            let assistantMessageContent = '';
            let revisionApplied = false;
            let updatedCount = 0;
            let addedCount = 0;
            const updatedTaskIds: string[] = [];

            try {
                const revision = await generateTaskRevisionResult(
                    nextMessages,
                    latestWorksheet.tasksById,
                    latestWorksheet.taskIds,
                    latestWorksheet.sources,
                    aiClassContext,
                );

                for (const operation of revision.operations) {
                    if (operation.action === 'update_task') {
                        const currentWs = useWorksheetStore.getState();
                        if (!currentWs.tasksById[operation.taskId]) continue;

                        currentWs.updateTask(operation.taskId, operation.updates as Partial<Task>);
                        updatedTaskIds.push(operation.taskId);
                        updatedCount += 1;
                        continue;
                    }

                    if (operation.action === 'add_task') {
                        const currentWs = useWorksheetStore.getState();

                        if (operation.payload) {
                            currentWs.addTasksFromAI([operation.payload]);
                            addedCount += 1;
                            continue;
                        }

                        currentWs.addTask(operation.type);
                        addedCount += 1;
                    }
                }

                if (updatedCount + addedCount > 0) {
                    revisionApplied = true;
                    const currentWs = useWorksheetStore.getState();
                    assistantMessageContent = buildPreciseRevisionConfirmationMessage(
                        updatedTaskIds,
                        addedCount,
                        currentWs.tasksById,
                        currentWs.taskIds,
                    );
                }
            } catch (revisionError) {
                if (revisionError instanceof Error && revisionError.message === AI_JSON_TRUNCATED_USER_MESSAGE) {
                    throw revisionError;
                }
                revisionApplied = false;
            }

            if (!revisionApplied) {
                const reply = await generateChatAssistantReply(nextMessages, aiClassContext);
                assistantMessageContent =
                    reply || 'Ich habe dazu gerade keine gute Antwort. Kannst du es bitte anders formulieren?';
            }

            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: assistantMessageContent,
            };

            const finalMessages = [...nextMessages, assistantMessage];
            useWorksheetStore.getState().setChatHistory(finalMessages);

            set({
                chatMessages: finalMessages,
                isChatLoading: false,
                chatStatusNotice: revisionApplied ? 'Änderungen wurden ins Arbeitsblatt übernommen.' : null,
            });

            const wsAfterReply = useWorksheetStore.getState();
            await saveWorksheet(
                wsAfterReply.id,
                wsAfterReply.title,
                wsAfterReply.tasksById,
                wsAfterReply.taskIds,
                wsAfterReply.chatHistory,
                wsAfterReply.sources,
                undefined,
                wsAfterReply.classId,
            );
        } catch (err) {
            set({
                isChatLoading: false,
                chatError: err instanceof Error ? err.message : 'Unbekannter Fehler bei der KI-Antwort.',
                chatStatusNotice: null,
            });
        }
    },

    setWorksheetSources: async (sources) => {
        useWorksheetStore.getState().setSources(sources);
        const ws = useWorksheetStore.getState();
        await saveWorksheet(
            ws.id,
            ws.title,
            ws.tasksById,
            ws.taskIds,
            ws.chatHistory,
            sources,
            undefined,
            ws.classId,
        );
    },

    upsertWorksheetSource: async (source) => {
        useWorksheetStore.getState().upsertSource(source);
        const ws = useWorksheetStore.getState();
        await saveWorksheet(
            ws.id,
            ws.title,
            ws.tasksById,
            ws.taskIds,
            ws.chatHistory,
            ws.sources,
            undefined,
            ws.classId,
        );
    },

    removeWorksheetSource: async (sourceId) => {
        useWorksheetStore.getState().removeSource(sourceId);
        const ws = useWorksheetStore.getState();
        await saveWorksheet(
            ws.id,
            ws.title,
            ws.tasksById,
            ws.taskIds,
            ws.chatHistory,
            ws.sources,
            undefined,
            ws.classId,
        );
    },

    toggleAiSidebar: () => {
        set((state) => ({ isAiSidebarOpen: !state.isAiSidebarOpen }));
    },

    toggleOutline: () => {
        set((state) => ({ isOutlineOpen: !state.isOutlineOpen }));
    },

    startPlacingTask: () => {
        set({ isPlacingNewTask: true });
    },

    cancelPlacingTask: () => {
        set({ isPlacingNewTask: false });
    },

    loadDesignTemplates: async () => {
        const templates = await listDesignTemplates({ sortBy: 'updatedAt' });
        const sortedTemplates = [...templates].sort((a, b) => {
            const aTime = new Date(a.lastUsedAt ?? a.updatedAt).getTime();
            const bTime = new Date(b.lastUsedAt ?? b.updatedAt).getTime();
            return bTime - aTime;
        });
        set({ designTemplates: sortedTemplates });
    },

    saveCurrentDesignAsTemplate: async (name, overwrite = false, targetTemplateId) => {
        const normalizedName = normalizeTemplateName(name);
        const settings = useSettingsStore.getState();
        const snapshot = settings.getDesignSnapshot();
        const existingLogo =
            typeof snapshot.logoImageId === 'number' ? await getImage(snapshot.logoImageId) : undefined;

        const savePayload = {
            name: normalizedName,
            idForCreate: crypto.randomUUID(),
            design: snapshot,
            embeddedLogoBlob: existingLogo?.blob,
        };

        let template: DesignTemplate;

        if (targetTemplateId) {
            try {
                const updated = await updateDesignTemplate(targetTemplateId, {
                    name: savePayload.name,
                    design: savePayload.design,
                    embeddedLogoBlob: savePayload.embeddedLogoBlob,
                });
                if (!updated) {
                    throw new Error('TEMPLATE_UPDATE_FAILED');
                }
                template = updated;
            } catch (error) {
                if (
                    overwrite &&
                    error instanceof Error &&
                    error.message === 'TEMPLATE_NAME_EXISTS'
                ) {
                    const conflicting = await getDesignTemplateByName(savePayload.name);
                    if (conflicting && conflicting.id !== targetTemplateId) {
                        await deleteDesignTemplate(conflicting.id);
                    }

                    const updated = await updateDesignTemplate(targetTemplateId, {
                        name: savePayload.name,
                        design: savePayload.design,
                        embeddedLogoBlob: savePayload.embeddedLogoBlob,
                    });

                    if (!updated) {
                        throw new Error('TEMPLATE_UPDATE_FAILED');
                    }
                    template = updated;
                } else {
                    throw error;
                }
            }
        } else {
            template = overwrite
                ? await upsertDesignTemplateByName(savePayload)
                : await createDesignTemplate({
                    id: savePayload.idForCreate,
                    name: savePayload.name,
                    design: savePayload.design,
                    embeddedLogoBlob: savePayload.embeddedLogoBlob,
                });
        }

        await get().loadDesignTemplates();
        set({ selectedTemplateId: template.id });
        return template;
    },

    applyTemplateToCurrentWorksheet: async (templateId) => {
        set({ isTemplateLoading: true });
        try {
            const template = await getDesignTemplate(templateId);
            if (!template) return false;

            let resolvedLogoImageId = template.design.logoImageId;

            if (typeof resolvedLogoImageId === 'number') {
                const existing = await getImage(resolvedLogoImageId);
                if (!existing) {
                    resolvedLogoImageId = null;
                }
            }

            if (resolvedLogoImageId == null && template.embeddedLogoBlob) {
                resolvedLogoImageId = await addImage(`${template.name}-logo`, template.embeddedLogoBlob);
            }

            useSettingsStore.getState().applyDesignSnapshot({
                ...template.design,
                logoImageId: resolvedLogoImageId,
            });

            await markDesignTemplateUsed(template.id);
            await get().loadDesignTemplates();

            set({ selectedTemplateId: template.id });
            return true;
        } finally {
            set({ isTemplateLoading: false });
        }
    },

    removeDesignTemplate: async (templateId) => {
        await deleteDesignTemplate(templateId);
        await get().loadDesignTemplates();

        set((state) => ({
            selectedTemplateId: state.selectedTemplateId === templateId ? null : state.selectedTemplateId,
            editingTemplateId: state.editingTemplateId === templateId ? null : state.editingTemplateId,
        }));
    },

    openTemplateGallery: () => {
        set({ isTemplateGalleryOpen: true });
        void get().loadDesignTemplates();
    },

    closeTemplateGallery: () => {
        set({ isTemplateGalleryOpen: false });
    },

    startTemplateEdit: (templateId) => {
        set({ editingTemplateId: templateId, selectedTemplateId: templateId });
    },

    clearTemplateEdit: () => {
        set({ editingTemplateId: null });
    },
}));
