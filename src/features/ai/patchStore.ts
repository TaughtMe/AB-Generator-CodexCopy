import { create } from 'zustand';
import type { Task } from '../../types/worksheet';
import { useWorksheetStore } from '../../store/worksheetStore';
import type { WorksheetOperation } from './operations';

/* ══════════════════════════════════════════════════
   patchStore – Ausstehender KI-Patch mit Nutzer-Bestätigung.

   Lebenszyklus:
     stagePatch(ops, errors, source)  → Dialog öffnet sich
     toggleAccepted(index)            → Nutzer wählt einzelne Ops ab/an
     applyAccepted()                  → wendet gewählte Ops über die
                                        worksheetStore-Mutationen an
                                        (→ zundo: ein Undo-Schritt pro Op)
     clearPatch()                     → verwerfen

   Bewusst KEIN persist: ein Patch ist flüchtig; nach Reload wäre er
   gegen einen veralteten Bestand validiert.
   ══════════════════════════════════════════════════ */

export type PatchSource = 'chat' | 'variant' | 'manual';

export interface PendingPatch {
    operations: WorksheetOperation[];
    /** Parallel zu operations: vom Nutzer (ab)gewählt. */
    accepted: boolean[];
    /** Validierungsfehler verworfener Operationen (nur Anzeige). */
    errors: string[];
    source: PatchSource;
}

export interface ApplyCounts {
    added: number;
    updated: number;
    removed: number;
    moved: number;
    duplicated: number;
}

interface PatchState {
    pendingPatch: PendingPatch | null;
    stagePatch: (operations: WorksheetOperation[], errors: string[], source: PatchSource) => void;
    toggleAccepted: (index: number) => void;
    clearPatch: () => void;
    /** Wendet die angenommenen Operationen an und leert den Patch. */
    applyAccepted: () => ApplyCounts;
}

export const usePatchStore = create<PatchState>()((set, get) => ({
    pendingPatch: null,

    stagePatch: (operations, errors, source) => {
        if (operations.length === 0 && errors.length === 0) return;
        set({
            pendingPatch: {
                operations,
                accepted: operations.map(() => true),
                errors,
                source,
            },
        });
    },

    toggleAccepted: (index) => set((state) => {
        if (!state.pendingPatch) return state;
        const accepted = [...state.pendingPatch.accepted];
        accepted[index] = !accepted[index];
        return { pendingPatch: { ...state.pendingPatch, accepted } };
    }),

    clearPatch: () => set({ pendingPatch: null }),

    applyAccepted: () => {
        const counts: ApplyCounts = { added: 0, updated: 0, removed: 0, moved: 0, duplicated: 0 };
        const patch = get().pendingPatch;
        if (!patch) return counts;

        const ws = () => useWorksheetStore.getState();

        patch.operations.forEach((op, index) => {
            if (!patch.accepted[index]) return;

            switch (op.action) {
                case 'update_task':
                    if (!ws().tasksById[op.taskId]) return;
                    ws().updateTask(op.taskId, op.updates as Partial<Task>);
                    counts.updated += 1;
                    return;

                case 'replace_task':
                    if (!ws().tasksById[op.taskId]) return;
                    // updateTask unterstützt Typwechsel (behält ID/Titel/Nummerierung)
                    ws().updateTask(op.taskId, op.payload as Partial<Task>);
                    counts.updated += 1;
                    return;

                case 'add_task':
                    if (op.payload) {
                        ws().addTasksFromAI([{ type: op.type, ...op.payload } as Omit<Task, 'id'>]);
                    } else {
                        ws().addTask(op.type);
                    }
                    counts.added += 1;
                    return;

                case 'delete_task':
                    if (!ws().tasksById[op.taskId]) return;
                    ws().removeTask(op.taskId);
                    counts.removed += 1;
                    return;

                case 'duplicate_task':
                    if (!ws().tasksById[op.taskId]) return;
                    ws().duplicateTask(op.taskId);
                    counts.duplicated += 1;
                    return;

                case 'move_task': {
                    const current = ws().taskIds;
                    const from = current.indexOf(op.taskId);
                    if (from === -1) return;
                    const next = [...current];
                    next.splice(from, 1);
                    const to = Math.max(0, Math.min(op.toIndex, next.length));
                    next.splice(to, 0, op.taskId);
                    ws().reorderTasks(next);
                    counts.moved += 1;
                    return;
                }

                case 'no_op':
                    return;
            }
        });

        set({ pendingPatch: null });
        return counts;
    },
}));

/** Menschlich lesbare Zusammenfassung der angewendeten Änderungen (für den Chat). */
export function formatApplyCounts(counts: ApplyCounts): string {
    const parts: string[] = [];
    if (counts.updated > 0) parts.push(`${counts.updated} geändert`);
    if (counts.added > 0) parts.push(`${counts.added} hinzugefügt`);
    if (counts.removed > 0) parts.push(`${counts.removed} gelöscht`);
    if (counts.moved > 0) parts.push(`${counts.moved} verschoben`);
    if (counts.duplicated > 0) parts.push(`${counts.duplicated} dupliziert`);
    if (parts.length === 0) return 'Keine Änderungen übernommen.';
    return `Erledigt: ${parts.join(', ')}. (Rückgängig mit Strg+Z)`;
}
