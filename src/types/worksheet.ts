export type TaskType = 'multiple-choice' | 'lineatur' | 'cloze' | 'image-placeholder' | 'math' | 'page-break' | 'columns' | 'instruction';
import type { ChatMessage } from './ai';

export type ColumnsLayout = '50-50' | '60-40' | '40-60';

export type LineStyle = 'grid-5mm' | 'grid-10mm' | 'lines-8mm' | 'primary-4-lines';

export interface BaseTask {
    id: string;
    type: TaskType;
    title: string;
    /** When false the task is unnumbered and does not count towards the running index. Defaults to true. */
    showNumber?: boolean;
    /** Per-Task Akzentfarbe – überschreibt die globale brandColor wenn gesetzt (hex). */
    accentColor?: string;
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
    promptHtml: string;
    gridColumns: number;
    lineStyle: LineStyle;
    lineRows: number; // Number of line groups/rows (min 1, default 4)
}

export type ClozeGapStyle = 'continuous' | 'per-letter';

export interface ClozeTask extends BaseTask {
    type: 'cloze';
    content: string;        // Text with gap placeholders, e.g. "Die [Sonne] scheint jeden [Tag]."
    gapStyle?: ClozeGapStyle; // Default: 'continuous'
    gapMultiplier?: number;   // Default: 1.5 – scales gap width relative to word length
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

/** Reine Aufgabe – freier Aufgabentext ohne interaktive Elemente. */
export interface InstructionTask extends BaseTask {
    type: 'instruction';
    text: string;
}

export type Task = MultipleChoiceTask | LineaturTask | ClozeTask | ImagePlaceholderTask | MathTask | PageBreakTask | ColumnsTask | InstructionTask;

export interface WorksheetTaskState {
    tasksById: Record<string, Task>;
    taskIds: string[];
}

export interface WorksheetVariant extends WorksheetTaskState {
    id: string;
    label: string;
}

export interface Worksheet {
    id: string;
    title: string;
    tasksById: Record<string, Task>;
    taskIds: string[];
    variants: WorksheetVariant[];
    activeVariantId: string;
    chatHistory: ChatMessage[];
    sources: WorksheetSource[];
    classId?: string;
}

export interface WorksheetSource {
    id: string;
    url: string;
    title: string;
}
