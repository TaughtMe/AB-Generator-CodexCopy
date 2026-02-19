export type TaskType = 'multiple-choice' | 'lineatur' | 'cloze' | 'image-placeholder' | 'math' | 'page-break' | 'columns';

export type ColumnsLayout = '50-50' | '60-40' | '40-60';

export type LineStyle = 'grid-5mm' | 'grid-10mm' | 'lines-8mm' | 'primary-4-lines';

export interface BaseTask {
    id: string;
    type: TaskType;
    title: string;
    /** When false the task is unnumbered and does not count towards the running index. Defaults to true. */
    showNumber?: boolean;
}

export interface MultipleChoiceOption {
    id: string;
    text: string;
    isCorrect: boolean;
}

export interface MultipleChoiceTask extends BaseTask {
    type: 'multiple-choice';
    question: string;
    options: MultipleChoiceOption[];
}

export interface LineaturTask extends BaseTask {
    type: 'lineatur';
    gridColumns: number;
    lineStyle: LineStyle;
    lineRows: number; // Number of line groups/rows (min 1, default 4)
}

export interface ClozeTask extends BaseTask {
    type: 'cloze';
    content: string; // Text with placeholders like {{word}}
}

export interface ImagePlaceholderTask extends BaseTask {
    type: 'image-placeholder';
    imageId?: number;   // Dexie-ID des hochgeladenen Bildes
    caption: string;
    widthMm: number;    // Breite auf dem A4-Blatt
    heightMm: number;   // Höhe auf dem A4-Blatt
}

export interface MathTask extends BaseTask {
    type: 'math';
    content: string; // Raw LaTeX string, e.g. "\frac{1}{2} + \sqrt{x}"
}

export interface PageBreakTask extends BaseTask {
    type: 'page-break';
}

export interface ColumnsTask extends BaseTask {
    type: 'columns';
    layout: ColumnsLayout;
    gapMm: number;
    children: [string | null, string | null]; // taskId refs
}

export type Task = MultipleChoiceTask | LineaturTask | ClozeTask | ImagePlaceholderTask | MathTask | PageBreakTask | ColumnsTask;

export interface Worksheet {
    id: string;
    title: string;
    tasksById: Record<string, Task>;
    taskIds: string[];
}
