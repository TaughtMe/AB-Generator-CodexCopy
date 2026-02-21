import { create } from 'zustand';
import {
    saveWorksheet,
    loadWorksheet,
    deleteWorksheet,
    listRecentWorksheets,
    type WorksheetMeta,
    type WorksheetFilter,
} from './dexieStore';
import { useWorksheetStore } from './worksheetStore';
import type { ChatMessage } from '../types/ai';

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
}));
