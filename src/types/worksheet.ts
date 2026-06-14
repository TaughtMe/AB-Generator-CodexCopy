export type TaskType = 'multiple-choice' | 'lineatur' | 'cloze' | 'image-placeholder' | 'math' | 'page-break' | 'columns' | 'instruction' | 'heading' | 'table' | 'information';
import type { ChatMessage } from './ai';

export type ColumnsLayout = '50-50' | '60-40' | '40-60';

export type LineStyle = 'grid-5mm' | 'grid-10mm' | 'lines-8mm' | 'primary-4-lines';

/** Reiner Informationsblock ohne Punktevergabe / Antwortfelder */
export interface VocabularyItem {
    id: string;
    word: string;
    pos: string; // Wortart (Part of Speech)
    definition: string;
}

/** Schwierigkeitsgrad einer Aufgabe (für Differenzierung / Filter). */
export type TaskDifficulty = 'easy' | 'medium' | 'hard';

export interface BaseTask {
    id: string;
    type: TaskType;
    title: string;
    /** Globale Vokabelliste für markierte Wörter in dieser Aufgabe. */
    vocabulary: VocabularyItem[];
    /** When false the task is unnumbered and does not count towards the running index. Defaults to true. */
    showNumber?: boolean;
    /** Per-Task Akzentfarbe – überschreibt die globale brandColor wenn gesetzt (hex). */
    accentColor?: string;
    /**
     * Anzahl der Schreibzeilen, die direkt NACH dieser Aufgabe gerendert werden.
     * Ersetzt eigenständige Lineatur-Blöcke im KI-Generierungspfad.
     * Wenn > 0, wird ein Lineatur-Block als abhängiges Element unter der Aufgabe angezeigt.
     */
    linesAfter?: number;
    /** Linienstil für linesAfter. Defaults to 'lines-8mm'. */
    linesAfterStyle?: LineStyle;

    /* ── Lehrer-/Differenzierungsfelder (Phase 8, alle optional) ──
       Fundament für Lehrerfassung, Lösungs-/Lehrerblätter, KI-Aktionen
       ("Ergänze Lösungen", "Mach Aufgabe leichter") und Differenzierung.
       Bewusst optional, damit Bestand, Generierung und Persistenz
       unverändert weiterlaufen. */

    /** Musterlösung / Erwartungshorizont (HTML, wie die übrigen Rich-Text-Felder). */
    solution?: string;
    /** Gestufte Hilfen/Tipps für Lernende. */
    hints?: string[];
    /** Erreichbare Punkte. */
    points?: number;
    /** Schwierigkeitsgrad (Differenzierung). */
    difficulty?: TaskDifficulty;
    /** Bezug zu einer Kompetenz/Lernziel (Freitext). */
    competence?: string;
    /** Geschätzte Bearbeitungszeit in Minuten. */
    estimatedTime?: number;
    /** Interne Notizen für die Lehrkraft (nicht auf der Schülerfassung). */
    teacherNotes?: string;
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
    rowCount?: number;
    lineHeight?: number;
    gapColor?: string;
}

export type ClozeGapStyle = 'continuous' | 'per-letter';
export type ClozeWordBankMode = 'hidden' | 'mixed' | 'upside-down';
export type ImageAlignment = 'left' | 'center' | 'right';

export interface ClozeTask extends BaseTask {
    type: 'cloze';
    content: string;        // Text with gap placeholders, e.g. "Die [Sonne] scheint jeden [Tag]."
    gapStyle?: ClozeGapStyle; // Default: 'continuous'
    gapMultiplier?: number;   // Default: 1.5 – scales gap width relative to word length
    wordBankMode?: ClozeWordBankMode; // Default: 'hidden'
    distractors?: string; // Kommagetrennte falsche Wörter
}

export interface ImagePlaceholderTask extends BaseTask {
    type: 'image-placeholder';
    imageId?: number;   // Dexie-ID des hochgeladenen Bildes
    caption: string;
    imageAlign?: ImageAlignment; // Default: 'left'
    align?: ImageAlignment; // Ribbon-Sync
    opacity?: number; // 0..1
    width?: string; // z.B. "320px" / "100%"
    height?: string; // z.B. "auto" / "180px"
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

/** Visueller Abschnittstrenner / Zwischenüberschrift */
export interface HeadingTask extends BaseTask {
    type: 'heading';
    text: string;
}

export interface TableTask extends BaseTask {
    type: 'table';
    content: string;
    rows: number;
    cols: number;
}

/** Reiner Informationsblock ohne Punktevergabe / Antwortfelder */
/** Ein einzelner Textabschnitt im Abschnitts-Modus (Chunked Reading). */
export interface TextChunk {
    id: string;
    heading: string;
    content: string;
    notesHeading: string;
}

/** Reiner Informationsblock ohne Punktevergabe / Antwortfelder */
export interface InformationTextTask extends BaseTask {
    type: 'information';
    content: string;
    hasNotesColumn: boolean;
    textWidthRatio: number; // z.B. 50 bis 100 (%)
    highlightVocabulary: boolean;
    /** Abschnitts-Modus (Chunked Reading) aktiv */
    isChunked?: boolean;
    /** Textabschnitte im Chunked-Modus */
    chunks?: TextChunk[];
}

export type InformationTask = InformationTextTask;

export type Task = MultipleChoiceTask | LineaturTask | ClozeTask | ImagePlaceholderTask | MathTask | PageBreakTask | ColumnsTask | InstructionTask | HeadingTask | TableTask | InformationTextTask;

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
    /** Unix-Timestamp (ms) wenn im Papierkorb, sonst undefined */
    deletedAt?: number;
}

export interface WorksheetSource {
    id: string;
    url: string;
    title: string;
}
