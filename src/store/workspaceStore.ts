import { create } from 'zustand';
import {
    saveWorksheet,
    loadWorksheet,
    deleteWorksheet,
    listRecentWorksheets,
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
import { normalizeTemplateName, type DesignTemplate } from '../types/designTemplate';

/* ══════════════════════════════════════════════════
   workspaceStore.ts – Workspace / Worksheet Management
   Verbindet worksheetStore (In-Memory) mit Dexie (Persistenz).
   ══════════════════════════════════════════════════ */

interface WorkspaceState {
    recentWorksheets: WorksheetMeta[];
    currentWorksheetId: string | null;
    isLoading: boolean;
    /** Aktive Filter für die Materialien-Ansicht */
    filter: WorksheetFilter;
    currentView: WorkspaceView;
    chatMessages: ChatMessage[];
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
    currentWorksheetId: null,
    isLoading: false,
    filter: {},
    currentView: 'dashboard',
    chatMessages: [],
    isChatGenerating: false,
    isAiSidebarOpen: false,
    isOutlineOpen: false,
    isPlacingNewTask: false,
    designTemplates: [],
    selectedTemplateId: null,
    isTemplateLoading: false,
    isTemplateGalleryOpen: false,
    editingTemplateId: null,

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
        await saveWorksheet(ws.id, ws.title, ws.tasksById, ws.taskIds, undefined, undefined, thumbnail);
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
            wsStore.loadFromRecord(record.id, record.title, record.tasksById, record.taskIds);
            set({ currentWorksheetId: id, isLoading: false });
            return true;
        } catch {
            set({ isLoading: false });
            return false;
        }
    },

    createNewWorksheet: () => {
        const wsStore = useWorksheetStore.getState();
        wsStore.resetWorksheet();
        set({ currentWorksheetId: useWorksheetStore.getState().id });
    },

    removeWorksheet: async (id: string) => {
        await deleteWorksheet(id);
        await get().loadRecent();
    },

    setCurrentView: (view) => {
        set({ currentView: view });
    },

    addChatMessage: (message) => {
        set((state) => ({ chatMessages: [...state.chatMessages, message] }));
    },

    setChatMessages: (messages) => {
        set({ chatMessages: messages });
    },

    clearChat: () => {
        set({ chatMessages: [] });
    },

    setIsChatGenerating: (isGenerating) => {
        set({ isChatGenerating: isGenerating });
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
