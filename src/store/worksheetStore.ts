import { create } from 'zustand';
import type { Task, TaskType, Worksheet, LineStyle, ColumnsTask, ImagePlaceholderTask } from '../types/worksheet';
import { getGridColumns } from '../utils/lineaturStyles';

/**
 * Zentrale Runtime-Quelle für ein Arbeitsblatt im Editor.
 *
 * Warum dieses Interface wichtig ist:
 * - Es definiert den Mutationsvertrag zwischen UI, DnD und Export.
 * - `tasksById` + `taskIds` bilden bewusst ein normalisiertes Modell
 *   (Map + Reihenfolge), damit Reordering O(n) auf IDs bleibt und
 *   Task-Inhalte unabhängig von der Listenstruktur mutiert werden können.
 * - Bei `columns`-Tasks müssen Child-Referenzen konsistent mit beiden
 *   Strukturen bleiben; alle betroffenen Actions halten diese Invariante.
 */
interface WorksheetStore extends Worksheet {
    // State
    isTeacherMode: boolean;
    showHeader: boolean;
    // Actions
    addTask: (type: TaskType) => void;
    addTasksFromAI: (tasks: Omit<Task, 'id'>[]) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    removeTask: (id: string) => void;
    reorderTasks: (taskIds: string[]) => void;
    duplicateTask: (id: string) => void;
    toggleTeacherMode: () => void;
    setTitle: (title: string) => void;
    setShowHeader: (show: boolean) => void;
    /** Assign a task to a column slot */
    assignToColumn: (columnsId: string, slotIndex: 0 | 1, taskId: string | null) => void;
    /** Remove a child from its column and place it back in the root list */
    detachFromColumn: (columnsId: string, slotIndex: 0 | 1) => void;
    /** Lädt ein gespeichertes Arbeitsblatt (aus Dexie) */
    loadFromRecord: (id: string, title: string, tasksById: Record<string, Task>, taskIds: string[]) => void;
    /** Setzt das Arbeitsblatt auf einen leeren Zustand zurück */
    resetWorksheet: () => void;
}

/** Default line style for new lineatur tasks */
const DEFAULT_LINE_STYLE: LineStyle = 'grid-5mm';

/**
 * Normalisiert Legacy-Persistenzdaten beim Laden.
 *
 * Hintergrund:
 * Frühere Versionen konnten `imageId` als String speichern. Der Editor,
 * Dexie-Layer und Export erwarten jedoch numerische IDs. Diese Funktion
 * migriert "soft" beim Laden, ohne persistierte Alt-Daten sofort zu
 * überschreiben.
 */
function normalizeLegacyTaskData(tasksById: Record<string, Task>): Record<string, Task> {
    const normalized: Record<string, Task> = {};

    for (const [id, task] of Object.entries(tasksById)) {
        if (task.type !== 'image-placeholder') {
            normalized[id] = task;
            continue;
        }

        const imageTask = task as ImagePlaceholderTask & { imageId?: unknown };
        const rawImageId = imageTask.imageId;
        const numericImageId =
            typeof rawImageId === 'number'
                ? rawImageId
                : typeof rawImageId === 'string'
                    ? Number(rawImageId)
                    : undefined;

        normalized[id] = {
            ...task,
            imageId: typeof numericImageId === 'number' && Number.isFinite(numericImageId)
                ? numericImageId
                : undefined,
        };
    }

    return normalized;
}

export const useWorksheetStore = create<WorksheetStore>((set) => ({
    id: crypto.randomUUID(),
    title: 'Neues Arbeitsblatt',
    tasksById: {},
    taskIds: [],
    isTeacherMode: false,
    showHeader: false,

    /**
     * Erstellt einen Root-Task und hängt ihn an das Ende von `taskIds`.
     *
     * Referenzielle Integrität:
     * - Jede Erstellung schreibt Task und ID atomar im selben `set`.
     * - Bei `columns` wird nur der Container erzeugt; Child-Slots starten als
     *   `null`, damit keine dangling references entstehen.
     */
    addTask: (type: TaskType) => set((state) => {
        const id = crypto.randomUUID();
        let newTask: Task;

        const base = {
            id,
            type,
            title: `Neue Aufgabe (${type})`,
        };

        switch (type) {
            case 'multiple-choice':
                newTask = {
                    ...base,
                    type: 'multiple-choice',
                    question: '',
                    options: [
                        { id: crypto.randomUUID(), text: 'Option 1', isCorrect: false },
                        { id: crypto.randomUUID(), text: 'Option 2', isCorrect: false },
                    ],
                };
                break;
            case 'lineatur':
                newTask = {
                    ...base,
                    type: 'lineatur',
                    lineStyle: DEFAULT_LINE_STYLE,
                    gridColumns: getGridColumns(DEFAULT_LINE_STYLE),
                    lineRows: 4,
                };
                break;
            case 'cloze':
                newTask = {
                    ...base,
                    type: 'cloze',
                    content: '',
                };
                break;
            case 'image-placeholder':
                newTask = {
                    ...base,
                    type: 'image-placeholder',
                    caption: '',
                    widthMm: 80,
                    heightMm: 60,
                };
                break;
            case 'math':
                newTask = {
                    ...base,
                    type: 'math',
                    content: '',
                };
                break;
            case 'page-break':
                newTask = {
                    ...base,
                    type: 'page-break',
                    title: 'Seitenumbruch',
                };
                break;
            case 'columns':
                newTask = {
                    ...base,
                    type: 'columns',
                    title: 'Zweispaltig',
                    layout: '50-50',
                    gapMm: 6,
                    children: [null, null],
                };
                break;
            default:
                throw new Error(`Unsupported task type: ${type}`);
        }

        return {
            tasksById: { ...state.tasksById, [id]: newTask },
            taskIds: [...state.taskIds, id],
        };
    }),

    /**
     * Batch-Import (KI), wobei pro Task eine neue ID erzeugt wird.
     *
     * Architekturhinweis:
     * Importierte Tasks werden als Root-Elemente behandelt. Verschachtelung
     * in `columns.children` passiert explizit über `assignToColumn`.
     */
    addTasksFromAI: (tasks) => set((state) => {
        const newTasksById = { ...state.tasksById };
        const newTaskIds = [...state.taskIds];

        for (const taskData of tasks) {
            const id = crypto.randomUUID();
            const task = { ...taskData, id } as Task;
            newTasksById[id] = task;
            newTaskIds.push(id);
        }

        return {
            tasksById: newTasksById,
            taskIds: newTaskIds,
        };
    }),

    /**
     * Partielle Task-Mutation auf bestehender ID.
     *
     * Referenzielle Integrität:
     * - Die Task-ID bleibt stabil; nur Payload-Felder ändern sich.
     * - Für `lineatur` wird `gridColumns` deterministisch aus `lineStyle`
     *   nachgeführt, damit Editor- und Export-Raster konsistent bleiben.
     */
    updateTask: (id, updates) => set((state) => {
        const task = state.tasksById[id];
        if (!task) return state;

        // If lineStyle changes, recalculate gridColumns
        let finalUpdates = { ...updates };
        if (task.type === 'lineatur' && 'lineStyle' in updates && updates.lineStyle) {
            finalUpdates = {
                ...finalUpdates,
                gridColumns: getGridColumns(updates.lineStyle as LineStyle),
            };
        }

        return {
            tasksById: {
                ...state.tasksById,
                [id]: { ...task, ...finalUpdates } as Task,
            },
        };
    }),

    /**
     * Entfernt einen Task inklusive referenzieller Aufräumarbeiten.
     *
     * Integritätsregeln:
     * - Entfernen eines `columns`-Containers entfernt auch dessen Child-Tasks.
     * - Entfernen eines Child-Tasks nullt alle Verweise aus anderen
     *   `columns.children`-Slots, um dangling references zu vermeiden.
     */
    removeTask: (id) => set((state) => {
        const { [id]: removed, ...remainingTasks } = state.tasksById;

        // If the removed task is a columns container, also remove its children
        if (removed && removed.type === 'columns') {
            const cols = removed as ColumnsTask;
            for (const childId of cols.children) {
                if (childId && remainingTasks[childId]) {
                    delete remainingTasks[childId];
                }
            }
        }

        // Clear references in any columns container that pointed to the removed task
        for (const key of Object.keys(remainingTasks)) {
            const t = remainingTasks[key];
            if (t.type === 'columns') {
                const cols = t as ColumnsTask;
                const newChildren: [string | null, string | null] = [...cols.children];
                let changed = false;
                if (newChildren[0] === id) { newChildren[0] = null; changed = true; }
                if (newChildren[1] === id) { newChildren[1] = null; changed = true; }
                if (changed) {
                    remainingTasks[key] = { ...cols, children: newChildren };
                }
            }
        }

        return {
            tasksById: remainingTasks,
            taskIds: state.taskIds.filter((taskId) => taskId !== id),
        };
    }),

    reorderTasks: (taskIds) => set({ taskIds }),

    toggleTeacherMode: () => set((s) => ({ isTeacherMode: !s.isTeacherMode })),

    setTitle: (title) => set({ title }),

    setShowHeader: (show) => set({ showHeader: show }),

    /**
     * Lädt ein Arbeitsblatt aus Persistenz und wendet Legacy-Normalisierung an,
     * bevor der Zustand in den Editor injiziert wird.
     */
    loadFromRecord: (id, title, tasksById, taskIds) => set({
        id,
        title,
        tasksById: normalizeLegacyTaskData(tasksById),
        taskIds,
    }),

    resetWorksheet: () => set({
        id: crypto.randomUUID(),
        title: 'Neues Arbeitsblatt',
        tasksById: {},
        taskIds: [],
    }),

    /**
     * Dupliziert einen Task in Root-Reihenfolge direkt hinter dem Original.
     *
     * Sonderfall `columns`:
     * - Container wird deep-cloned.
     * - Referenzierte Children werden mit neuen IDs kopiert.
     * - Damit zeigen neue Slots nie auf alte Child-Objekte.
     */
    duplicateTask: (id) => set((state) => {
        const original = state.tasksById[id];
        if (!original) return state;

        const newId = crypto.randomUUID();
        let cloned: Task;

        if (original.type === 'multiple-choice') {
            cloned = {
                ...original,
                id: newId,
                title: `${original.title} (Kopie)`,
                options: original.options.map((opt) => ({
                    ...opt,
                    id: crypto.randomUUID(),
                })),
            };
        } else if (original.type === 'columns') {
            // Deep-clone columns container: duplicate children too
            const cols = original as ColumnsTask;
            const newChildren: [string | null, string | null] = [null, null];
            const extraTasks: Record<string, Task> = {};
            for (let s = 0; s < 2; s++) {
                const childId = cols.children[s as 0 | 1];
                if (childId && state.tasksById[childId]) {
                    const childCloneId = crypto.randomUUID();
                    extraTasks[childCloneId] = {
                        ...state.tasksById[childId],
                        id: childCloneId,
                        title: `${state.tasksById[childId].title}`,
                    } as Task;
                    newChildren[s as 0 | 1] = childCloneId;
                }
            }
            cloned = {
                ...cols,
                id: newId,
                title: `${original.title} (Kopie)`,
                children: newChildren,
            };
            const insertIndex = state.taskIds.indexOf(id) + 1;
            const newTaskIds = [...state.taskIds];
            newTaskIds.splice(insertIndex, 0, newId);
            return {
                tasksById: { ...state.tasksById, [newId]: cloned, ...extraTasks },
                taskIds: newTaskIds,
            };
        } else {
            cloned = {
                ...original,
                id: newId,
                title: `${original.title} (Kopie)`,
            } as Task;
        }

        const insertIndex = state.taskIds.indexOf(id) + 1;
        const newTaskIds = [...state.taskIds];
        newTaskIds.splice(insertIndex, 0, newId);

        return {
            tasksById: { ...state.tasksById, [newId]: cloned },
            taskIds: newTaskIds,
        };
    }),

    /**
     * Weist einem Columns-Slot einen Child-Task zu.
     *
     * Integritätsvertrag:
     * - Nur existierende Tasks dürfen zugewiesen werden.
     * - Zugewiesene Child-Tasks werden aus `taskIds` entfernt, damit sie nicht
     *   gleichzeitig als Root-Task und Slot-Task erscheinen.
     */
    assignToColumn: (columnsId, slotIndex, taskId) => set((state) => {
        const container = state.tasksById[columnsId];
        if (!container || container.type !== 'columns') return state;
        const cols = container as ColumnsTask;
        const newChildren: [string | null, string | null] = [...cols.children];

        // If a task is being assigned, create it fresh in tasksById if missing
        if (taskId && !state.tasksById[taskId]) return state;

        newChildren[slotIndex] = taskId;
        const updatedContainer = { ...cols, children: newChildren };

        // Remove the assigned task from root taskIds (it's now inside the container)
        const newTaskIds = taskId
            ? state.taskIds.filter((id) => id !== taskId)
            : state.taskIds;

        return {
            tasksById: { ...state.tasksById, [columnsId]: updatedContainer },
            taskIds: newTaskIds,
        };
    }),

    /**
     * Löst einen Child-Task aus einem Columns-Slot und setzt ihn zurück in die
     * Root-Reihenfolge direkt hinter den Container.
     *
     * Damit bleibt das Bearbeiten außerhalb des Containers ohne Datenverlust
     * möglich und die Reihenfolge bleibt für Nutzer nachvollziehbar.
     */
    detachFromColumn: (columnsId, slotIndex) => set((state) => {
        const container = state.tasksById[columnsId];
        if (!container || container.type !== 'columns') return state;
        const cols = container as ColumnsTask;
        const childId = cols.children[slotIndex];
        if (!childId) return state;

        const newChildren: [string | null, string | null] = [...cols.children];
        newChildren[slotIndex] = null;
        const updatedContainer = { ...cols, children: newChildren };

        // Insert child back into root list (right after the container)
        const containerIdx = state.taskIds.indexOf(columnsId);
        const newTaskIds = [...state.taskIds];
        newTaskIds.splice(containerIdx + 1, 0, childId);

        return {
            tasksById: { ...state.tasksById, [columnsId]: updatedContainer },
            taskIds: newTaskIds,
        };
    }),
}));
