import { create } from 'zustand';
import type { Task, TaskType, Worksheet, LineStyle } from '../types/worksheet';
import { getGridColumns } from '../utils/lineaturStyles';

interface WorksheetStore extends Worksheet {
    // State
    isTeacherMode: boolean;
    showHeader: boolean;
    // Actions
    addSheet: (title: string) => void;
    addTask: (type: TaskType) => void;
    addTasksFromAI: (tasks: Omit<Task, 'id'>[]) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    removeTask: (id: string) => void;
    reorderTasks: (taskIds: string[]) => void;
    duplicateTask: (id: string) => void;
    toggleTeacherMode: () => void;
    setTitle: (title: string) => void;
    setShowHeader: (show: boolean) => void;
    /** Lädt ein gespeichertes Arbeitsblatt (aus Dexie) */
    loadFromRecord: (id: string, title: string, tasksById: Record<string, Task>, taskIds: string[]) => void;
    /** Setzt das Arbeitsblatt auf einen leeren Zustand zurück */
    resetWorksheet: () => void;
}

/** Default line style for new lineatur tasks */
const DEFAULT_LINE_STYLE: LineStyle = 'grid-5mm';

export const useWorksheetStore = create<WorksheetStore>((set) => ({
    id: crypto.randomUUID(),
    title: 'Neues Arbeitsblatt',
    tasksById: {},
    taskIds: [],
    isTeacherMode: false,
    showHeader: false,

    addSheet: (title: string) => set({
        id: crypto.randomUUID(),
        title,
        tasksById: {},
        taskIds: [],
    }),

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
            default:
                throw new Error(`Unsupported task type: ${type}`);
        }

        return {
            tasksById: { ...state.tasksById, [id]: newTask },
            taskIds: [...state.taskIds, id],
        };
    }),

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

    removeTask: (id) => set((state) => {
        const { [id]: _, ...remainingTasks } = state.tasksById;
        return {
            tasksById: remainingTasks,
            taskIds: state.taskIds.filter((taskId) => taskId !== id),
        };
    }),

    reorderTasks: (taskIds) => set({ taskIds }),

    toggleTeacherMode: () => set((s) => ({ isTeacherMode: !s.isTeacherMode })),

    setTitle: (title) => set({ title }),

    setShowHeader: (show) => set({ showHeader: show }),

    loadFromRecord: (id, title, tasksById, taskIds) => set({
        id,
        title,
        tasksById,
        taskIds,
    }),

    resetWorksheet: () => set({
        id: crypto.randomUUID(),
        title: 'Neues Arbeitsblatt',
        tasksById: {},
        taskIds: [],
    }),

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
}));
