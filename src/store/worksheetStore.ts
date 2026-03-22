import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import type {
    Task,
    TaskType,
    Worksheet,
    WorksheetVariant,
    WorksheetTaskState,
    LineStyle,
    ColumnsTask,
    ColumnsLayout,
    ImagePlaceholderTask,
    LineaturTask,
    MultipleChoiceOption,
    ClozeGapStyle,
    ClozeWordBankMode,
    ImageAlignment,
} from '../types/worksheet';
import type { ChatMessage } from '../types/ai';
import type { WorksheetSource } from '../types/worksheet';
import { getGridColumns } from '../utils/lineaturStyles';

export type WorksheetSaveStatus = 'saved' | 'unsaved' | 'saving';

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
    saveStatus: WorksheetSaveStatus;
    showHeader: boolean;
    activeTaskId: string | null;
    /** @internal Undo-Stack (Task-Snapshots) */
    _undoStack: WorksheetTaskState[];
    /** @internal Redo-Stack (Task-Snapshots) */
    _redoStack: WorksheetTaskState[];
    // Actions
    addTask: (type: TaskType) => void;
    /** Fügt einen neuen Task an einer bestimmten Position ein */
    insertTaskAt: (type: TaskType, index: number) => void;
    addTasksFromAI: (tasks: Omit<Task, 'id'>[]) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    removeTask: (id: string) => void;
    reorderTasks: (taskIds: string[]) => void;
    moveTask: (taskId: string, sourceContainerId: string, targetContainerId: string, newIndex: number) => void;
    duplicateTask: (id: string) => void;
    setActiveVariant: (variantId: string) => void;
    addVariant: (label: string, mode?: 'empty' | 'duplicate-active') => void;
    renameVariant: (variantId: string, label: string) => void;
    reorderVariants: (variantIds: string[]) => void;
    removeVariant: (variantId: string) => void;
    setTitle: (title: string) => void;
    setShowHeader: (show: boolean) => void;
    setActiveTask: (id: string | null) => void;
    setClassId: (classId: string | undefined) => void;
    setChatHistory: (messages: ChatMessage[]) => void;
    setSources: (sources: WorksheetSource[]) => void;
    upsertSource: (source: WorksheetSource) => void;
    removeSource: (sourceId: string) => void;
    setSaveStatus: (status: WorksheetSaveStatus) => void;
    /** Assign a task to a column slot */
    assignToColumn: (columnsId: string, slotIndex: 0 | 1, taskId: string | null) => void;
    /** Remove a child from its column and place it back in the root list */
    detachFromColumn: (columnsId: string, slotIndex: 0 | 1) => void;
    /** Undo letzte Task-Mutation */
    undo: () => void;
    /** Redo letzte rückgängig gemachte Task-Mutation */
    redo: () => void;
    /** Lädt ein gespeichertes Arbeitsblatt (aus Dexie) */
    loadFromRecord: (
        id: string,
        title: string,
        tasksById: Record<string, Task>,
        taskIds: string[],
        chatHistory?: ChatMessage[],
        sources?: WorksheetSource[],
        classId?: string,
        variants?: WorksheetVariant[],
        activeVariantId?: string,
    ) => void;
    /** Setzt das Arbeitsblatt auf einen leeren Zustand zurück */
    resetWorksheet: () => void;
}

type PersistedWorksheetSlice = Pick<
    WorksheetStore,
    'id'
    | 'title'
    | 'variants'
    | 'activeVariantId'
    | 'tasksById'
    | 'taskIds'
    | 'chatHistory'
    | 'sources'
    | 'classId'
    | 'showHeader'
>;

type WorksheetTemporalSlice = Pick<
    WorksheetStore,
    'title'
    | 'showHeader'
    | 'variants'
    | 'activeVariantId'
    | 'tasksById'
    | 'taskIds'
>;

/** Default line style for new lineatur tasks */
const DEFAULT_LINE_STYLE: LineStyle = 'primary-4-lines';
const VALID_LINE_STYLES: LineStyle[] = ['grid-5mm', 'grid-10mm', 'lines-8mm', 'primary-4-lines'];
const VALID_COLUMNS_LAYOUTS: ColumnsLayout[] = ['50-50', '60-40', '40-60'];
const VALID_CLOZE_GAP_STYLES: ClozeGapStyle[] = ['continuous', 'per-letter'];
const VALID_CLOZE_WORD_BANK_MODES: ClozeWordBankMode[] = ['hidden', 'mixed', 'upside-down'];
const VALID_IMAGE_ALIGNMENTS: ImageAlignment[] = ['left', 'center', 'right'];

/**
 * Erzeugt ein neues Task-Objekt mit einer frischen UUID.
 * Wird von addTask und insertTaskAt gemeinsam genutzt.
 */
function createNewTask(type: TaskType): Task {
    const id = crypto.randomUUID();
    const base = { id, type, title: `Neue Aufgabe (${type})` };

    switch (type) {
        case 'multiple-choice':
            return {
                ...base, type: 'multiple-choice', question: '',
                options: [
                    { id: crypto.randomUUID(), text: 'Option 1', isCorrect: false },
                    { id: crypto.randomUUID(), text: 'Option 2', isCorrect: false },
                ],
            };
        case 'lineatur':
            return {
                ...base, type: 'lineatur',
                promptHtml: '',
                lineStyle: DEFAULT_LINE_STYLE,
                gridColumns: getGridColumns(DEFAULT_LINE_STYLE),
                lineRows: 5,
                rowCount: 5,
                lineHeight: 12,
                gapColor: '#eaf4e8',
            };
        case 'cloze':
            return {
                ...base,
                type: 'cloze',
                title: 'Lückentext',
                content: '',
                wordBankMode: 'hidden',
                distractors: '',
            };
        case 'image-placeholder':
            return {
                ...base,
                type: 'image-placeholder',
                caption: '',
                imageAlign: 'left',
                align: 'left',
                opacity: 1,
                width: '100%',
                height: 'auto',
                widthMm: 80,
                heightMm: 60,
            };
        case 'math':
            return { ...base, type: 'math', content: '' };
        case 'page-break':
            return { ...base, type: 'page-break', title: 'Seitenumbruch' };
        case 'columns':
            return {
                ...base, type: 'columns', title: 'Zweispaltig',
                layout: '50-50', gapMm: 6, children: [null, null],
            };
        case 'instruction':
            return { ...base, type: 'instruction', title: 'Neue Aufgabe', text: '' };
        case 'heading':
            return {
                ...base,
                type: 'heading',
                title: 'Zwischenüberschrift',
                text: 'Zwischenüberschrift',
                showNumber: false,
            };
        case 'table':
            return {
                ...base,
                type: 'table',
                title: 'Tabelle',
                content: '',
                rows: 3,
                cols: 3,
            };
        case 'information':
            return {
                ...base,
                type: 'information',
                title: 'Information',
                text: '',
                showNumber: false,
            };
        default:
            throw new Error(`Unsupported task type: ${type}`);
    }
}

type TaskByType<T extends TaskType> = Extract<Task, { type: T }>;

function createDefaultTaskOfType<T extends TaskType>(type: T): TaskByType<T> {
    return createNewTask(type) as TaskByType<T>;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function cloneMultipleChoiceOptions(options: MultipleChoiceOption[]): MultipleChoiceOption[] {
    return options.map((option, index) => ({
        id: typeof option.id === 'string' && option.id.trim() ? option.id : crypto.randomUUID(),
        text: typeof option.text === 'string' ? option.text : `Option ${index + 1}`,
        isCorrect: Boolean(option.isCorrect),
    }));
}

function normalizeMultipleChoiceOptionsForStore(
    rawOptions: unknown,
    fallbackOptions: MultipleChoiceOption[],
    isTypeSwitch: boolean,
): MultipleChoiceOption[] {
    if (!Array.isArray(rawOptions)) {
        return cloneMultipleChoiceOptions(fallbackOptions);
    }

    const normalized = rawOptions
        .filter(isObjectRecord)
        .map((option, index) => ({
            id: typeof option.id === 'string' && option.id.trim() ? option.id : crypto.randomUUID(),
            text: typeof option.text === 'string' ? option.text : `Option ${index + 1}`,
            isCorrect: Boolean(option.isCorrect),
        }));

    // KI-Typwechsel produziert gelegentlich ein leeres options-Array.
    // Dann behalten wir die Defaults des Zieltyps, damit der Editor stabil bleibt.
    if (isTypeSwitch && normalized.length === 0) {
        return cloneMultipleChoiceOptions(fallbackOptions);
    }

    return normalized;
}

function sanitizeTaskForStore(task: Task, fallbackTask: Task, isTypeSwitch: boolean): Task {
    switch (task.type) {
        case 'multiple-choice': {
            const fallback: TaskByType<'multiple-choice'> = fallbackTask.type === 'multiple-choice'
                ? fallbackTask
                : createDefaultTaskOfType('multiple-choice');

            return {
                ...task,
                title: typeof task.title === 'string' ? task.title : fallback.title,
                question: typeof task.question === 'string' ? task.question : fallback.question,
                options: normalizeMultipleChoiceOptionsForStore(task.options, fallback.options, isTypeSwitch),
            };
        }

        case 'lineatur': {
            const fallback: TaskByType<'lineatur'> = fallbackTask.type === 'lineatur'
                ? fallbackTask
                : createDefaultTaskOfType('lineatur');

            const lineStyle = VALID_LINE_STYLES.includes(task.lineStyle as LineStyle)
                ? (task.lineStyle as LineStyle)
                : fallback.lineStyle;

            const rawRowCount = typeof task.rowCount === 'number' && Number.isFinite(task.rowCount)
                ? task.rowCount
                : task.lineRows;
            const lineRows =
                typeof rawRowCount === 'number' && Number.isFinite(rawRowCount)
                    ? Math.max(1, Math.min(20, Math.round(rawRowCount)))
                    : fallback.lineRows;
            const lineHeight =
                typeof task.lineHeight === 'number' && Number.isFinite(task.lineHeight)
                    ? Math.max(4, Math.min(20, task.lineHeight))
                    : (typeof fallback.lineHeight === 'number' ? Math.max(4, Math.min(20, fallback.lineHeight)) : 12);
            const gapColor =
                typeof task.gapColor === 'string' && task.gapColor.trim().length > 0
                    ? task.gapColor.trim()
                    : (typeof fallback.gapColor === 'string' && fallback.gapColor.trim().length > 0 ? fallback.gapColor.trim() : '#eaf4e8');

            return {
                ...task,
                title: typeof task.title === 'string' ? task.title : fallback.title,
                promptHtml: typeof task.promptHtml === 'string' ? task.promptHtml : fallback.promptHtml,
                lineStyle,
                lineRows,
                rowCount: lineRows,
                lineHeight,
                gapColor,
                gridColumns: getGridColumns(lineStyle),
            };
        }

        case 'cloze': {
            const fallback: TaskByType<'cloze'> = fallbackTask.type === 'cloze'
                ? fallbackTask
                : createDefaultTaskOfType('cloze');

            const gapStyle = VALID_CLOZE_GAP_STYLES.includes(task.gapStyle as ClozeGapStyle)
                ? (task.gapStyle as ClozeGapStyle)
                : fallback.gapStyle;

            const gapMultiplier =
                typeof task.gapMultiplier === 'number' && Number.isFinite(task.gapMultiplier)
                    ? task.gapMultiplier
                    : fallback.gapMultiplier;

            const wordBankMode = VALID_CLOZE_WORD_BANK_MODES.includes(task.wordBankMode as ClozeWordBankMode)
                ? (task.wordBankMode as ClozeWordBankMode)
                : (fallback.wordBankMode ?? 'hidden');

            const distractors = typeof task.distractors === 'string'
                ? task.distractors
                : (fallback.distractors ?? '');

            return {
                ...task,
                title: typeof task.title === 'string' ? task.title : fallback.title,
                content: typeof task.content === 'string' ? task.content : fallback.content,
                gapStyle,
                gapMultiplier,
                wordBankMode,
                distractors,
            };
        }

        case 'image-placeholder': {
            const fallback: TaskByType<'image-placeholder'> = fallbackTask.type === 'image-placeholder'
                ? fallbackTask
                : createDefaultTaskOfType('image-placeholder');

            const imageId =
                typeof task.imageId === 'number' && Number.isFinite(task.imageId)
                    ? task.imageId
                    : fallback.imageId;
            const imageAlign = VALID_IMAGE_ALIGNMENTS.includes(task.imageAlign as ImageAlignment)
                ? (task.imageAlign as ImageAlignment)
                : (fallback.imageAlign ?? 'left');
            const align = VALID_IMAGE_ALIGNMENTS.includes(task.align as ImageAlignment)
                ? (task.align as ImageAlignment)
                : (imageAlign ?? fallback.align ?? 'left');
            const opacity =
                typeof task.opacity === 'number' && Number.isFinite(task.opacity)
                    ? Math.max(0, Math.min(1, task.opacity))
                    : (typeof fallback.opacity === 'number' ? Math.max(0, Math.min(1, fallback.opacity)) : 1);
            const width = typeof task.width === 'string' && task.width.trim().length > 0
                ? task.width
                : fallback.width;
            const height = typeof task.height === 'string' && task.height.trim().length > 0
                ? task.height
                : fallback.height;

            return {
                ...task,
                title: typeof task.title === 'string' ? task.title : fallback.title,
                caption: typeof task.caption === 'string' ? task.caption : fallback.caption,
                imageId,
                imageAlign,
                align,
                opacity,
                width,
                height,
                widthMm:
                    typeof task.widthMm === 'number' && Number.isFinite(task.widthMm)
                        ? Math.max(10, Math.round(task.widthMm))
                        : fallback.widthMm,
                heightMm:
                    typeof task.heightMm === 'number' && Number.isFinite(task.heightMm)
                        ? Math.max(10, Math.round(task.heightMm))
                        : fallback.heightMm,
            };
        }

        case 'math': {
            const fallback: TaskByType<'math'> = fallbackTask.type === 'math'
                ? fallbackTask
                : createDefaultTaskOfType('math');

            return {
                ...task,
                title: typeof task.title === 'string' ? task.title : fallback.title,
                content: typeof task.content === 'string' ? task.content : fallback.content,
            };
        }

        case 'columns': {
            const fallback: TaskByType<'columns'> = fallbackTask.type === 'columns'
                ? fallbackTask
                : createDefaultTaskOfType('columns');

            const children: [string | null, string | null] = Array.isArray(task.children)
                ? [
                    typeof task.children[0] === 'string' ? task.children[0] : null,
                    typeof task.children[1] === 'string' ? task.children[1] : null,
                ]
                : [fallback.children[0], fallback.children[1]];

            const layout = VALID_COLUMNS_LAYOUTS.includes(task.layout as ColumnsLayout)
                ? (task.layout as ColumnsLayout)
                : fallback.layout;

            return {
                ...task,
                title: typeof task.title === 'string' ? task.title : fallback.title,
                layout,
                gapMm:
                    typeof task.gapMm === 'number' && Number.isFinite(task.gapMm)
                        ? Math.max(0, Math.round(task.gapMm))
                        : fallback.gapMm,
                children,
            };
        }

        case 'instruction': {
            const fallback: TaskByType<'instruction'> = fallbackTask.type === 'instruction'
                ? fallbackTask
                : createDefaultTaskOfType('instruction');

            return {
                ...task,
                title: typeof task.title === 'string' ? task.title : fallback.title,
                text: typeof task.text === 'string' ? task.text : fallback.text,
            };
        }

        case 'heading': {
            const fallback: TaskByType<'heading'> = fallbackTask.type === 'heading'
                ? fallbackTask
                : createDefaultTaskOfType('heading');

            return {
                ...task,
                title: typeof task.title === 'string' ? task.title : fallback.title,
                text: typeof task.text === 'string' ? task.text : fallback.text,
            };
        }

        case 'table': {
            const fallback: TaskByType<'table'> = fallbackTask.type === 'table'
                ? fallbackTask
                : createDefaultTaskOfType('table');

            const rows =
                typeof task.rows === 'number' && Number.isFinite(task.rows)
                    ? Math.max(1, Math.min(20, Math.round(task.rows)))
                    : fallback.rows;

            const cols =
                typeof task.cols === 'number' && Number.isFinite(task.cols)
                    ? Math.max(1, Math.min(10, Math.round(task.cols)))
                    : fallback.cols;

            return {
                ...task,
                title: typeof task.title === 'string' ? task.title : fallback.title,
                content: typeof task.content === 'string' ? task.content : fallback.content,
                rows,
                cols,
            };
        }

        case 'page-break': {
            const fallback: TaskByType<'page-break'> = fallbackTask.type === 'page-break'
                ? fallbackTask
                : createDefaultTaskOfType('page-break');

            return {
                ...task,
                title: typeof task.title === 'string' ? task.title : fallback.title,
            };
        }

        case 'information': {
            const fallback: TaskByType<'information'> = fallbackTask.type === 'information'
                ? fallbackTask
                : createDefaultTaskOfType('information');

            return {
                ...task,
                title: typeof task.title === 'string' ? task.title : fallback.title,
                text: typeof task.text === 'string' ? task.text : fallback.text,
            };
        }

        default:
            return task;
    }
}

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
        if (task.type === 'image-placeholder') {
            const imageTask = task as ImagePlaceholderTask & { imageId?: unknown; imageAlign?: unknown };
            const rawImageId = imageTask.imageId;
            const numericImageId =
                typeof rawImageId === 'number'
                    ? rawImageId
                    : typeof rawImageId === 'string'
                        ? Number(rawImageId)
                        : undefined;
            const normalizedImageAlign = VALID_IMAGE_ALIGNMENTS.includes(imageTask.imageAlign as ImageAlignment)
                ? (imageTask.imageAlign as ImageAlignment)
                : 'left';

            normalized[id] = {
                ...task,
                imageId: typeof numericImageId === 'number' && Number.isFinite(numericImageId)
                    ? numericImageId
                    : undefined,
                imageAlign: normalizedImageAlign,
            };
            continue;
        }

        if (task.type === 'lineatur') {
            const lineTask = task as LineaturTask & {
                promptHtml?: unknown;
                lineRows?: unknown;
                rowCount?: unknown;
                lineHeight?: unknown;
                gapColor?: unknown;
                lineStyle?: unknown;
                gridColumns?: unknown;
            };

            const normalizedLineStyle =
                typeof lineTask.lineStyle === 'string' && VALID_LINE_STYLES.includes(lineTask.lineStyle as LineStyle)
                    ? (lineTask.lineStyle as LineStyle)
                    : DEFAULT_LINE_STYLE;
            const normalizedRowCount =
                typeof lineTask.rowCount === 'number' && Number.isFinite(lineTask.rowCount)
                    ? Math.max(1, Math.min(20, Math.round(lineTask.rowCount)))
                    : typeof lineTask.lineRows === 'number' && Number.isFinite(lineTask.lineRows)
                        ? Math.max(1, Math.min(20, Math.round(lineTask.lineRows)))
                        : 5;
            const normalizedLineHeight =
                typeof lineTask.lineHeight === 'number' && Number.isFinite(lineTask.lineHeight)
                    ? Math.max(4, Math.min(20, lineTask.lineHeight))
                    : 12;
            const normalizedGapColor =
                typeof lineTask.gapColor === 'string' && lineTask.gapColor.trim().length > 0
                    ? lineTask.gapColor.trim()
                    : '#eaf4e8';

            normalized[id] = {
                ...task,
                promptHtml: typeof lineTask.promptHtml === 'string' ? lineTask.promptHtml : '',
                lineRows: normalizedRowCount,
                rowCount: normalizedRowCount,
                lineHeight: normalizedLineHeight,
                gapColor: normalizedGapColor,
                lineStyle: normalizedLineStyle,
                gridColumns:
                    typeof lineTask.gridColumns === 'number' && lineTask.gridColumns > 0
                        ? lineTask.gridColumns
                        : getGridColumns(normalizedLineStyle),
            } as Task;
            continue;
        }

        if (task.type === 'cloze') {
            const clozeTask = task as TaskByType<'cloze'>;
            const normalizedWordBankMode = VALID_CLOZE_WORD_BANK_MODES.includes(clozeTask.wordBankMode as ClozeWordBankMode)
                ? (clozeTask.wordBankMode as ClozeWordBankMode)
                : 'hidden';

            normalized[id] = {
                ...task,
                wordBankMode: normalizedWordBankMode,
                distractors: typeof clozeTask.distractors === 'string' ? clozeTask.distractors : '',
            };
            continue;
        }

        normalized[id] = task;
    }

    return normalized;
}

function normalizeLegacyChatHistory(chatHistory?: unknown): ChatMessage[] {
    if (!Array.isArray(chatHistory)) return [];

    return chatHistory
        .filter((entry): entry is { role: unknown; content: unknown } =>
            typeof entry === 'object' && entry !== null && 'role' in entry && 'content' in entry
        )
        .map((entry): ChatMessage => ({
            role: entry.role === 'assistant' ? 'assistant' : 'user',
            content: typeof entry.content === 'string' ? entry.content : '',
        }))
        .filter((entry) => entry.content.trim().length > 0);
}

function normalizeLegacySources(sources?: unknown): WorksheetSource[] {
    if (!Array.isArray(sources)) return [];

    return sources
        .filter((entry): entry is { id?: unknown; url?: unknown; title?: unknown } =>
            typeof entry === 'object' && entry !== null
        )
        .map((entry) => {
            const rawUrl = typeof entry.url === 'string' ? entry.url.trim() : '';
            if (!rawUrl) return null;

            return {
                id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : crypto.randomUUID(),
                url: rawUrl,
                title: typeof entry.title === 'string' ? entry.title : '',
            } satisfies WorksheetSource;
        })
        .filter((entry): entry is WorksheetSource => entry !== null);
}

function createWorksheetVariant(
    label: string,
    taskState?: Partial<WorksheetTaskState>,
): WorksheetVariant {
    return {
        id: crypto.randomUUID(),
        label: label.trim() || 'Variante',
        tasksById: taskState?.tasksById ? normalizeLegacyTaskData(taskState.tasksById) : {},
        taskIds: Array.isArray(taskState?.taskIds) ? [...taskState.taskIds] : [],
    };
}

function normalizeWorksheetVariantsInput(
    tasksById: Record<string, Task>,
    taskIds: string[],
    variants?: WorksheetVariant[],
    activeVariantId?: string,
): { variants: WorksheetVariant[]; activeVariantId: string; tasksById: Record<string, Task>; taskIds: string[] } {
    const normalizedVariants = Array.isArray(variants)
        ? variants
            .filter((variant): variant is WorksheetVariant => Boolean(variant && typeof variant === 'object'))
            .map((variant, index) => ({
                id: typeof variant.id === 'string' && variant.id.trim() ? variant.id : crypto.randomUUID(),
                label: typeof variant.label === 'string' && variant.label.trim() ? variant.label : `Variante ${index + 1}`,
                tasksById: normalizeLegacyTaskData(variant.tasksById ?? {}),
                taskIds: Array.isArray(variant.taskIds) ? [...variant.taskIds] : [],
            }))
        : [];

    if (normalizedVariants.length === 0) {
        normalizedVariants.push(createWorksheetVariant('Standard', {
            tasksById: normalizeLegacyTaskData(tasksById ?? {}),
            taskIds: Array.isArray(taskIds) ? [...taskIds] : [],
        }));
    }

    const resolvedActiveVariant = normalizedVariants.find((variant) => variant.id === activeVariantId) ?? normalizedVariants[0];

    return {
        variants: normalizedVariants,
        activeVariantId: resolvedActiveVariant.id,
        tasksById: resolvedActiveVariant.tasksById,
        taskIds: resolvedActiveVariant.taskIds,
    };
}

function getActiveVariantIndex(state: Pick<WorksheetStore, 'variants' | 'activeVariantId'>): number {
    const index = state.variants.findIndex((variant) => variant.id === state.activeVariantId);
    return index >= 0 ? index : 0;
}

function syncActiveVariantTaskState(
    state: WorksheetStore,
    nextTaskState: WorksheetTaskState,
    activeVariantId = state.activeVariantId,
    variantsOverride?: WorksheetVariant[],
): Pick<WorksheetStore, 'variants' | 'activeVariantId' | 'tasksById' | 'taskIds'> {
    const variants = variantsOverride ? [...variantsOverride] : [...state.variants];
    const variantIndex = variants.findIndex((variant) => variant.id === activeVariantId);

    if (variantIndex >= 0) {
        variants[variantIndex] = {
            ...variants[variantIndex],
            tasksById: nextTaskState.tasksById,
            taskIds: nextTaskState.taskIds,
        };
    }

    return {
        variants,
        activeVariantId,
        tasksById: nextTaskState.tasksById,
        taskIds: nextTaskState.taskIds,
    };
}

const TEMPORAL_HISTORY_LIMIT = 50;
const MAX_UNDO_STACK = TEMPORAL_HISTORY_LIMIT;

function partializePersistedWorksheetSlice(state: WorksheetStore): PersistedWorksheetSlice {
    return {
        id: state.id,
        title: state.title,
        variants: state.variants,
        activeVariantId: state.activeVariantId,
        tasksById: state.tasksById,
        taskIds: state.taskIds,
        chatHistory: state.chatHistory,
        sources: state.sources,
        classId: state.classId,
        showHeader: state.showHeader,
    };
}

function partializeTemporalWorksheetSlice(state: WorksheetStore): WorksheetTemporalSlice {
    return {
        title: state.title,
        showHeader: state.showHeader,
        variants: state.variants,
        activeVariantId: state.activeVariantId,
        tasksById: state.tasksById,
        taskIds: state.taskIds,
    };
}

/** Push current task state to undo stack (call before mutations) */
function pushUndoSnapshot(state: WorksheetStore): { _undoStack: WorksheetTaskState[]; _redoStack: WorksheetTaskState[] } {
    const activeVariant = state.variants[getActiveVariantIndex(state)];
    if (!activeVariant) return { _undoStack: state._undoStack, _redoStack: [] };
    const snapshot: WorksheetTaskState = {
        tasksById: activeVariant.tasksById,
        taskIds: activeVariant.taskIds,
    };
    const stack = [...state._undoStack, snapshot];
    if (stack.length > MAX_UNDO_STACK) stack.shift();
    return { _undoStack: stack, _redoStack: [] };
}

function syncActiveVariantTaskStateUnsaved(
    state: WorksheetStore,
    nextTaskState: WorksheetTaskState,
    activeVariantId = state.activeVariantId,
    variantsOverride?: WorksheetVariant[],
): Pick<WorksheetStore, 'variants' | 'activeVariantId' | 'tasksById' | 'taskIds' | 'saveStatus'> {
    return {
        ...syncActiveVariantTaskState(state, nextTaskState, activeVariantId, variantsOverride),
        saveStatus: 'unsaved',
    };
}

const INITIAL_WORKSHEET_VARIANT = createWorksheetVariant('Standard');

export const useWorksheetStore = create<WorksheetStore>()(
    persist(
        temporal(
            (set) => ({
    variants: [INITIAL_WORKSHEET_VARIANT],
    activeVariantId: INITIAL_WORKSHEET_VARIANT.id,
    id: crypto.randomUUID(),
    title: 'Neues Arbeitsblatt',
    tasksById: INITIAL_WORKSHEET_VARIANT.tasksById,
    taskIds: INITIAL_WORKSHEET_VARIANT.taskIds,
    saveStatus: 'unsaved',
    chatHistory: [],
    sources: [],
    classId: undefined,
    showHeader: false,
    activeTaskId: null,
    _undoStack: [],
    _redoStack: [],

    /**
     * Erstellt einen Root-Task und hängt ihn an das Ende von `taskIds`.
     */
    addTask: (type: TaskType) => set((state) => {
        const activeVariant = state.variants[getActiveVariantIndex(state)];
        if (!activeVariant) return state;
        const newTask = createNewTask(type);
        const nextTaskState = {
            tasksById: { ...activeVariant.tasksById, [newTask.id]: newTask },
            taskIds: [...activeVariant.taskIds, newTask.id],
        };
        return { ...syncActiveVariantTaskStateUnsaved(state, nextTaskState), ...pushUndoSnapshot(state) };
    }),

    /**
     * Erstellt einen Root-Task und fügt ihn an Position `index` ein.
     * index = 0 → ganz oben, index >= taskIds.length → am Ende.
     */
    insertTaskAt: (type: TaskType, index: number) => set((state) => {
        const activeVariant = state.variants[getActiveVariantIndex(state)];
        if (!activeVariant) return state;
        const newTask = createNewTask(type);
        const newTaskIds = [...activeVariant.taskIds];
        const clampedIndex = Math.max(0, Math.min(index, newTaskIds.length));
        newTaskIds.splice(clampedIndex, 0, newTask.id);
        return {
            ...syncActiveVariantTaskStateUnsaved(state, {
                tasksById: { ...activeVariant.tasksById, [newTask.id]: newTask },
                taskIds: newTaskIds,
            }),
            ...pushUndoSnapshot(state),
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
        const activeVariant = state.variants[getActiveVariantIndex(state)];
        if (!activeVariant) return state;
        const newTasksById = { ...activeVariant.tasksById };
        const newTaskIds = [...activeVariant.taskIds];

        for (const taskData of tasks) {
            const id = crypto.randomUUID();
            const normalizedTaskData = taskData.type === 'lineatur'
                ? {
                    ...taskData,
                    promptHtml: typeof (taskData as Partial<LineaturTask>).promptHtml === 'string'
                        ? (taskData as Partial<LineaturTask>).promptHtml
                        : '',
                    lineRows: (() => {
                        const partial = taskData as Partial<LineaturTask>;
                        const rawRows = typeof partial.rowCount === 'number' ? partial.rowCount : partial.lineRows;
                        return typeof rawRows === 'number'
                            ? Math.max(1, Math.min(20, Math.round(rawRows)))
                            : 5;
                    })(),
                    rowCount: (() => {
                        const partial = taskData as Partial<LineaturTask>;
                        const rawRows = typeof partial.rowCount === 'number' ? partial.rowCount : partial.lineRows;
                        return typeof rawRows === 'number'
                            ? Math.max(1, Math.min(20, Math.round(rawRows)))
                            : 5;
                    })(),
                    lineHeight:
                        typeof (taskData as Partial<LineaturTask>).lineHeight === 'number'
                            ? Math.max(4, Math.min(20, (taskData as Partial<LineaturTask>).lineHeight as number))
                            : 12,
                    gapColor:
                        typeof (taskData as Partial<LineaturTask>).gapColor === 'string'
                            ? ((taskData as Partial<LineaturTask>).gapColor as string)
                            : '#eaf4e8',
                }
                : taskData;

            const task = { ...normalizedTaskData, id } as Task;
            newTasksById[id] = task;
            newTaskIds.push(id);
        }

        return syncActiveVariantTaskStateUnsaved(state, {
            tasksById: newTasksById,
            taskIds: newTaskIds,
        });
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
        const activeVariant = state.variants[getActiveVariantIndex(state)];
        if (!activeVariant) return state;
        const task = activeVariant.tasksById[id];
        if (!task) return state;

        const requestedType = typeof updates.type === 'string' ? updates.type : undefined;
        const isTypeSwitch = Boolean(requestedType && requestedType !== task.type);

        const baseTask: Task = isTypeSwitch
            ? ({
                ...createNewTask(requestedType as TaskType),
                // Keep stable ID and common editor metadata when switching types.
                id,
                title: task.title,
                showNumber: task.showNumber,
                accentColor: task.accentColor,
            } as Task)
            : task;

        let finalTask = { ...baseTask, ...updates } as Task;
        finalTask = sanitizeTaskForStore(finalTask, baseTask, isTypeSwitch);

        return syncActiveVariantTaskStateUnsaved(state, {
            tasksById: {
                ...activeVariant.tasksById,
                [id]: finalTask,
            },
            taskIds: activeVariant.taskIds,
        });
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
        const activeVariant = state.variants[getActiveVariantIndex(state)];
        if (!activeVariant) return state;
        const undoData = pushUndoSnapshot(state);
        const { [id]: removed, ...remainingTasks } = activeVariant.tasksById;
        const removedTaskIds = new Set<string>([id]);

        // If the removed task is a columns container, also remove its children
        if (removed && removed.type === 'columns') {
            const cols = removed as ColumnsTask;
            for (const childId of cols.children) {
                if (childId && remainingTasks[childId]) {
                    delete remainingTasks[childId];
                    removedTaskIds.add(childId);
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

        const nextState = syncActiveVariantTaskStateUnsaved(state, {
            tasksById: remainingTasks,
            taskIds: activeVariant.taskIds.filter((taskId) => taskId !== id),
        });

        const nextActiveTaskId =
            state.activeTaskId && !removedTaskIds.has(state.activeTaskId) && remainingTasks[state.activeTaskId]
                ? state.activeTaskId
                : null;

        return {
            ...nextState,
            activeTaskId: nextActiveTaskId,
            ...undoData,
        };
    }),

    reorderTasks: (taskIds) => set((state) => ({
        ...syncActiveVariantTaskStateUnsaved(state, {
            tasksById: state.tasksById,
            taskIds,
        }),
        ...pushUndoSnapshot(state),
    })),

    moveTask: (taskId, sourceContainerId, targetContainerId, newIndex) => set((state) => {
        const activeVariant = state.variants[getActiveVariantIndex(state)];
        if (!activeVariant) return state;

        const task = activeVariant.tasksById[taskId];
        if (!task) return state;

        // Containers/page breaks are not supported as column children in the MVP.
        if (targetContainerId !== 'root' && (task.type === 'columns' || task.type === 'page-break')) {
            return state;
        }

        const nextTasksById = { ...activeVariant.tasksById };
        let nextTaskIds = [...activeVariant.taskIds];
        const detachFromSource = (): boolean => {
            if (sourceContainerId === 'root') {
                const existsInRoot = nextTaskIds.includes(taskId);
                nextTaskIds = nextTaskIds.filter((id) => id !== taskId);
                return existsInRoot;
            }

            const sourceContainer = nextTasksById[sourceContainerId];
            if (!sourceContainer || sourceContainer.type !== 'columns') return false;

            const sourceCols = sourceContainer as ColumnsTask;
            const foundSourceSlotIndex = sourceCols.children.findIndex((childId) => childId === taskId);
            if (foundSourceSlotIndex === -1) return false;

            const nextChildren: [string | null, string | null] = [...sourceCols.children];
            nextChildren[foundSourceSlotIndex as 0 | 1] = null;
            nextTasksById[sourceContainerId] = { ...sourceCols, children: nextChildren };
            return true;
        };

        if (!detachFromSource()) return state;

        if (targetContainerId === 'root') {
            const clampedIndex = Math.max(0, Math.min(Math.round(newIndex), nextTaskIds.length));
            nextTaskIds.splice(clampedIndex, 0, taskId);

            return syncActiveVariantTaskStateUnsaved(state, {
                tasksById: nextTasksById,
                taskIds: nextTaskIds,
            });
        }

        const targetContainer = nextTasksById[targetContainerId];
        if (!targetContainer || targetContainer.type !== 'columns') return state;
        if (taskId === targetContainerId) return state;

        if (newIndex !== 0 && newIndex !== 1) return state;
        const targetSlotIndex = newIndex as 0 | 1;

        const targetCols = targetContainer as ColumnsTask;
        const currentOccupant = targetCols.children[targetSlotIndex];
        if (currentOccupant && currentOccupant !== taskId) return state;

        const nextChildren: [string | null, string | null] = [...targetCols.children];
        nextChildren[targetSlotIndex] = taskId;
        nextTasksById[targetContainerId] = { ...targetCols, children: nextChildren };

        // Ensure the task is not duplicated in root.
        nextTaskIds = nextTaskIds.filter((id) => id !== taskId);

        return syncActiveVariantTaskStateUnsaved(state, {
            tasksById: nextTasksById,
            taskIds: nextTaskIds,
        });
    }),

    setTitle: (title) => set({ title, saveStatus: 'unsaved' }),

    setShowHeader: (show) => set({ showHeader: show }),

    setActiveTask: (id) => set((state) => {
        if (id === null) return { activeTaskId: null };
        if (!state.tasksById[id]) return { activeTaskId: null };
        return { activeTaskId: id };
    }),

    setClassId: (classId) => set({ classId: classId?.trim() || undefined, saveStatus: 'unsaved' }),

    setChatHistory: (messages) => set({ chatHistory: messages, saveStatus: 'unsaved' }),

    setSources: (sources) => set({ sources, saveStatus: 'unsaved' }),

    upsertSource: (source) => set((state) => {
        const existingIndex = state.sources.findIndex((entry) => entry.id === source.id);
        if (existingIndex === -1) {
            return { sources: [...state.sources, source], saveStatus: 'unsaved' };
        }

        const next = [...state.sources];
        next[existingIndex] = source;
        return { sources: next, saveStatus: 'unsaved' };
    }),

    removeSource: (sourceId) => set((state) => ({
        sources: state.sources.filter((entry) => entry.id !== sourceId),
        saveStatus: 'unsaved',
    })),

    setSaveStatus: (status) => set({ saveStatus: status }),

    /**
     * Lädt ein Arbeitsblatt aus Persistenz und wendet Legacy-Normalisierung an,
     * bevor der Zustand in den Editor injiziert wird.
     */
    loadFromRecord: (id, title, tasksById, taskIds, chatHistory, sources, classId, variants, activeVariantId) => set(() => {
        const normalized = normalizeWorksheetVariantsInput(tasksById, taskIds, variants, activeVariantId);
        return {
            id,
            title,
            variants: normalized.variants,
            activeVariantId: normalized.activeVariantId,
            tasksById: normalized.tasksById,
            taskIds: normalized.taskIds,
            chatHistory: normalizeLegacyChatHistory(chatHistory),
            sources: normalizeLegacySources(sources),
            classId: typeof classId === 'string' && classId.trim() ? classId : undefined,
            saveStatus: 'saved',
            activeTaskId: null,
            _undoStack: [],
            _redoStack: [],
        };
    }),

    resetWorksheet: () => set(() => {
        const standardVariant = createWorksheetVariant('Standard');
        return {
            id: crypto.randomUUID(),
            title: 'Neues Arbeitsblatt',
            variants: [standardVariant],
            activeVariantId: standardVariant.id,
            tasksById: standardVariant.tasksById,
            taskIds: standardVariant.taskIds,
            chatHistory: [],
            sources: [],
            classId: undefined,
            saveStatus: 'unsaved',
            activeTaskId: null,
            _undoStack: [],
            _redoStack: [],
        };
    }),

    undo: () => set((state) => {
        if (state._undoStack.length === 0) return state;
        const stack = [...state._undoStack];
        const prev = stack.pop()!;
        const activeVariant = state.variants[getActiveVariantIndex(state)];
        const currentSnapshot: WorksheetTaskState = activeVariant
            ? { tasksById: activeVariant.tasksById, taskIds: activeVariant.taskIds }
            : { tasksById: state.tasksById, taskIds: state.taskIds };
        return {
            ...syncActiveVariantTaskState(state, prev),
            _undoStack: stack,
            _redoStack: [...state._redoStack, currentSnapshot],
            saveStatus: 'unsaved',
        };
    }),

    redo: () => set((state) => {
        if (state._redoStack.length === 0) return state;
        const stack = [...state._redoStack];
        const next = stack.pop()!;
        const activeVariant = state.variants[getActiveVariantIndex(state)];
        const currentSnapshot: WorksheetTaskState = activeVariant
            ? { tasksById: activeVariant.tasksById, taskIds: activeVariant.taskIds }
            : { tasksById: state.tasksById, taskIds: state.taskIds };
        return {
            ...syncActiveVariantTaskState(state, next),
            _undoStack: [...state._undoStack, currentSnapshot],
            _redoStack: stack,
            saveStatus: 'unsaved',
        };
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
        const activeVariant = state.variants[getActiveVariantIndex(state)];
        if (!activeVariant) return state;
        const original = activeVariant.tasksById[id];
        if (!original) return state;
        const undoData = pushUndoSnapshot(state);

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
                if (childId && activeVariant.tasksById[childId]) {
                    const childCloneId = crypto.randomUUID();
                    extraTasks[childCloneId] = {
                        ...activeVariant.tasksById[childId],
                        id: childCloneId,
                        title: `${activeVariant.tasksById[childId].title}`,
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
            const insertIndex = activeVariant.taskIds.indexOf(id) + 1;
            const newTaskIds = [...activeVariant.taskIds];
            newTaskIds.splice(insertIndex, 0, newId);
            return {
                ...syncActiveVariantTaskStateUnsaved(state, {
                    tasksById: { ...activeVariant.tasksById, [newId]: cloned, ...extraTasks },
                    taskIds: newTaskIds,
                }),
                ...undoData,
            };
        } else {
            cloned = {
                ...original,
                id: newId,
                title: `${original.title} (Kopie)`,
            } as Task;
        }

        const insertIndex = activeVariant.taskIds.indexOf(id) + 1;
        const newTaskIds = [...activeVariant.taskIds];
        newTaskIds.splice(insertIndex, 0, newId);

        return {
            ...syncActiveVariantTaskStateUnsaved(state, {
                tasksById: { ...activeVariant.tasksById, [newId]: cloned },
                taskIds: newTaskIds,
            }),
            ...undoData,
        };
    }),

    setActiveVariant: (variantId) => set((state) => {
        const target = state.variants.find((variant) => variant.id === variantId);
        if (!target) return state;
        return {
            activeVariantId: target.id,
            tasksById: target.tasksById,
            taskIds: target.taskIds,
            saveStatus: 'unsaved',
            activeTaskId: null,
        };
    }),

    addVariant: (label, mode = 'duplicate-active') => set((state) => {
        const activeVariant = state.variants[getActiveVariantIndex(state)];
        const nextVariant = createWorksheetVariant(
            label,
            mode === 'duplicate-active' && activeVariant
                ? {
                    tasksById:
                        typeof structuredClone === 'function'
                            ? structuredClone(activeVariant.tasksById)
                            : JSON.parse(JSON.stringify(activeVariant.tasksById)),
                    taskIds: [...activeVariant.taskIds],
                }
                : undefined,
        );
        const variants = [...state.variants, nextVariant];
        return {
            ...syncActiveVariantTaskState(state, {
                tasksById: nextVariant.tasksById,
                taskIds: nextVariant.taskIds,
            }, nextVariant.id, variants),
            saveStatus: 'unsaved',
        };
    }),

    renameVariant: (variantId, label) => set((state) => {
        const nextLabel = label.trim();
        if (!nextLabel) return state;

        const index = state.variants.findIndex((variant) => variant.id === variantId);
        if (index === -1) return state;

        const variants = [...state.variants];
        variants[index] = { ...variants[index], label: nextLabel };
        return { variants, saveStatus: 'unsaved' };
    }),

    reorderVariants: (variantIds) => set((state) => {
        if (!Array.isArray(variantIds) || variantIds.length !== state.variants.length) return state;

        const byId = new Map(state.variants.map((variant) => [variant.id, variant]));
        const nextVariants: WorksheetVariant[] = [];

        for (const id of variantIds) {
            const variant = byId.get(id);
            if (!variant) return state;
            nextVariants.push(variant);
        }

        const activeVariant = nextVariants.find((variant) => variant.id === state.activeVariantId) ?? nextVariants[0];
        if (!activeVariant) return state;

        return {
            variants: nextVariants,
            activeVariantId: activeVariant.id,
            tasksById: activeVariant.tasksById,
            taskIds: activeVariant.taskIds,
            saveStatus: 'unsaved',
            activeTaskId: null,
        };
    }),

    removeVariant: (variantId) => set((state) => {
        if (state.variants.length <= 1) return state;

        const removeIndex = state.variants.findIndex((variant) => variant.id === variantId);
        if (removeIndex === -1) return state;

        const nextVariants = state.variants.filter((variant) => variant.id !== variantId);
        const fallbackIndex = Math.max(0, removeIndex - 1);
        const nextActiveVariant =
            state.activeVariantId === variantId
                ? (nextVariants[fallbackIndex] ?? nextVariants[0])
                : (nextVariants.find((variant) => variant.id === state.activeVariantId) ?? nextVariants[0]);

        if (!nextActiveVariant) return state;

        return {
            variants: nextVariants,
            activeVariantId: nextActiveVariant.id,
            tasksById: nextActiveVariant.tasksById,
            taskIds: nextActiveVariant.taskIds,
            saveStatus: 'unsaved',
            activeTaskId: null,
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
        const activeVariant = state.variants[getActiveVariantIndex(state)];
        if (!activeVariant) return state;
        const container = activeVariant.tasksById[columnsId];
        if (!container || container.type !== 'columns') return state;
        const cols = container as ColumnsTask;
        const newChildren: [string | null, string | null] = [...cols.children];

        // If a task is being assigned, create it fresh in tasksById if missing
        if (taskId && !activeVariant.tasksById[taskId]) return state;

        newChildren[slotIndex] = taskId;
        const updatedContainer = { ...cols, children: newChildren };

        // Remove the assigned task from root taskIds (it's now inside the container)
        const newTaskIds = taskId
            ? activeVariant.taskIds.filter((id) => id !== taskId)
            : activeVariant.taskIds;

        return syncActiveVariantTaskStateUnsaved(state, {
            tasksById: { ...activeVariant.tasksById, [columnsId]: updatedContainer },
            taskIds: newTaskIds,
        });
    }),

    /**
     * Löst einen Child-Task aus einem Columns-Slot und setzt ihn zurück in die
     * Root-Reihenfolge direkt hinter den Container.
     *
     * Damit bleibt das Bearbeiten außerhalb des Containers ohne Datenverlust
     * möglich und die Reihenfolge bleibt für Nutzer nachvollziehbar.
     */
    detachFromColumn: (columnsId, slotIndex) => set((state) => {
        const activeVariant = state.variants[getActiveVariantIndex(state)];
        if (!activeVariant) return state;
        const container = activeVariant.tasksById[columnsId];
        if (!container || container.type !== 'columns') return state;
        const cols = container as ColumnsTask;
        const childId = cols.children[slotIndex];
        if (!childId) return state;

        const newChildren: [string | null, string | null] = [...cols.children];
        newChildren[slotIndex] = null;
        const updatedContainer = { ...cols, children: newChildren };

        // Insert child back into root list (right after the container)
        const containerIdx = activeVariant.taskIds.indexOf(columnsId);
        const newTaskIds = [...activeVariant.taskIds];
        newTaskIds.splice(containerIdx + 1, 0, childId);

        return syncActiveVariantTaskStateUnsaved(state, {
            tasksById: { ...activeVariant.tasksById, [columnsId]: updatedContainer },
            taskIds: newTaskIds,
        });
    }),
            }),
            {
                limit: TEMPORAL_HISTORY_LIMIT,
                partialize: partializeTemporalWorksheetSlice,
            },
        ),
        {
            name: 'worksheet-storage',
            partialize: partializePersistedWorksheetSlice,
        },
    ),
);
