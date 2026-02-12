import { create } from 'zustand';
import {
    saveWorksheet,
    loadWorksheet,
    deleteWorksheet,
    listRecentWorksheets,
    type WorksheetMeta,
} from './dexieStore';
import { useWorksheetStore } from './worksheetStore';

/* ══════════════════════════════════════════════════
   workspaceStore.ts – Workspace / Worksheet Management
   Verbindet worksheetStore (In-Memory) mit Dexie (Persistenz).
   ══════════════════════════════════════════════════ */

interface WorkspaceState {
    recentWorksheets: WorksheetMeta[];
    currentWorksheetId: string | null;
    isLoading: boolean;
}

interface WorkspaceActions {
    /** Lädt die "Zuletzt bearbeitet" Liste aus Dexie */
    loadRecent: () => Promise<void>;
    /** Speichert das aktuelle Arbeitsblatt in Dexie */
    saveCurrentWorksheet: () => Promise<void>;
    /** Öffnet ein gespeichertes Arbeitsblatt im Editor */
    openWorksheet: (id: string) => Promise<boolean>;
    /** Erstellt ein neues leeres Arbeitsblatt */
    createNewWorksheet: () => void;
    /** Löscht ein Arbeitsblatt aus Dexie und aktualisiert die Liste */
    removeWorksheet: (id: string) => Promise<void>;
}

type WorkspaceStore = WorkspaceState & WorkspaceActions;

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
    recentWorksheets: [],
    currentWorksheetId: null,
    isLoading: false,

    loadRecent: async () => {
        const recent = await listRecentWorksheets(12);
        set({ recentWorksheets: recent });
    },

    saveCurrentWorksheet: async () => {
        const ws = useWorksheetStore.getState();
        await saveWorksheet(ws.id, ws.title, ws.tasksById, ws.taskIds);
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
}));
