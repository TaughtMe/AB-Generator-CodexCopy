/**
 * docxExport.ts – Word (.docx) Export Engine (WYSIWYG)
 *
 * Iterates through all tasks (in order) and generates a Word document.
 * Uses discriminated unions for type-safe rendering of each task type.
 * Supports teacher mode (correct answers highlighted) and student mode.
 * Header is rendered as paragraph blocks in the document body (first page only).
 * Tasks are wrapped in invisible "Hybrid Grid" tables for pixel-perfect spacing.
 */

import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    ImageRun,
    BorderStyle,
    Table,
    TableRow,
    TableCell,
    WidthType,
    VerticalAlign,
    HeightRule,
    TableLayoutType,
    AlignmentType,
    PageBreak,
    convertMillimetersToTwip,
} from 'docx';
import { saveAs } from 'file-saver';
import type { Task, MultipleChoiceTask, LineaturTask, ClozeTask, MathTask, ImagePlaceholderTask } from '../types/worksheet';
import { renderLineBlockToImage } from './lineBlockToImage';
import { convertMathToImage } from './mathExportUtils';
import { processImageForDocx, type ImageMeta } from './imageUtils';
import { mmToPx, A4_INNER_WIDTH_MM } from './mmToEmu';
import { validateForExport, formatWarnings } from './exportValidator';
import { useSettingsStore } from '../store/settingsStore';
import { useWorksheetStore } from '../store/worksheetStore';
import { getImage } from '../store/dexieStore';
import { getRowHeightMM } from './lineaturStyles';

// ── Constants ────────────────────────────────────────────────

/**
 * FONT_FAMILY – Resolved at export time from the user's settings.
 * Set once at the beginning of exportToDocx() so all renderers
 * automatically use the same font the user sees in the editor/PDF.
 */
let FONT_FAMILY = 'Inter';

const FONT_SIZE_PT = 11;
const HEADING_SIZE_PT = 13;

/** A4 inner width in DXA (twips). 170mm = printable area */
const A4_INNER_WIDTH_DXA = convertMillimetersToTwip(170);
/** Checkbox column width: 10mm */
const CHECKBOX_COL_DXA = convertMillimetersToTwip(10);
/** MC option row height: 8mm for consistent vertical rhythm */
const MC_OPTION_ROW_DXA = convertMillimetersToTwip(8);
/** Inter-task separator spacing */
const TASK_GAP_AFTER = convertMillimetersToTwip(4);
/** Hybrid-Grid task title row height: 8mm */
const TASK_TITLE_ROW_DXA = convertMillimetersToTwip(8);

// ── Centralized Color Theme ─────────────────────────────────

/**
 * DOCX_THEME – All colors used in the export, centralised for
 * visual consistency with the PDF / editor output.
 */
const DOCX_THEME = {
    /** Task title ("Aufgabe X") – dark slate instead of blue */
    taskTitle: '1E293B',
    /** Default body text */
    text: '000000',
    /** Correct-answer highlight (teacher mode) */
    correctAnswer: '16A34A',
    /** Teacher-mode banner */
    teacherBanner: '16A34A',
    /** Placeholder / empty-state text */
    placeholder: '9CA3AF',
    /** Muted secondary text (blanks, subtitles) */
    muted: '94A3B8',
    /** Field label text (Name / Datum / Klasse) */
    fieldLabel: '64748B',
    /** Error text */
    error: 'EF4444',
} as const;

// ── Grid Border Presets ─────────────────────────────────────

/** Shared "no border" preset – explicitly disables all 6 border directions
 *  (top, bottom, left, right, insideHorizontal, insideVertical) so Word
 *  never inherits or renders default gridlines.  Applied to both Table
 *  and TableCell objects for consistency. */
const NO_TABLE_BORDERS = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
} as const;

// ── Synthetic Logo Generator ─────────────────────────────────

/**
 * Generates a synthetic logo image (coloured rounded-rect with up to
 * 3 characters) on an OffscreenCanvas and returns the raw PNG Blob
 * ready for `processImageForDocx`.
 *
 * @param text  – 1-3 characters displayed in the centre.
 * @param color – CSS colour string used as background fill.
 *                Falls back to `#3B82F6` (blue-500) when empty.
 */
async function generateSyntheticLogo(
    text: string,
    color: string,
): Promise<Blob> {
    const fill = color && color.trim() ? color : '#3B82F6';
    const displayText = text || 'A';
    const SIZE = 256; // px – high-res square canvas
    const RADIUS = 40; // px – corner radius

    const canvas = new OffscreenCanvas(SIZE, SIZE);
    const ctx = canvas.getContext('2d')!;

    // ── Rounded rectangle background ──
    ctx.beginPath();
    ctx.moveTo(RADIUS, 0);
    ctx.lineTo(SIZE - RADIUS, 0);
    ctx.quadraticCurveTo(SIZE, 0, SIZE, RADIUS);
    ctx.lineTo(SIZE, SIZE - RADIUS);
    ctx.quadraticCurveTo(SIZE, SIZE, SIZE - RADIUS, SIZE);
    ctx.lineTo(RADIUS, SIZE);
    ctx.quadraticCurveTo(0, SIZE, 0, SIZE - RADIUS);
    ctx.lineTo(0, RADIUS);
    ctx.quadraticCurveTo(0, 0, RADIUS, 0);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    // ── Centred text (scale font size down for multi-char) ──
    const fontScale = displayText.length === 1 ? 0.55 : displayText.length === 2 ? 0.42 : 0.33;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(SIZE * fontScale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, SIZE / 2, SIZE / 2 + SIZE * 0.04);

    return await canvas.convertToBlob({ type: 'image/png' });
}

// ── Header Builder (Paragraph-based, first page only) ─────────

/**
 * Creates the header block (logo, school name, subtitle, optional
 * Name/Datum/Klasse line) as plain Paragraphs that are prepended to the
 * document body.  This avoids Word's native Header element entirely so
 * no table borders can leak through.  The header only appears once at
 * the top of the first page.
 *
 * Returns an empty array when showHeader is off or no data exists.
 */
async function createHeaderParagraphs(exportTitle: string): Promise<Paragraph[]> {
    const { schoolName, logoImageId, headerFields, brandColor, logoText } = useSettingsStore.getState();
    const { showHeader } = useWorksheetStore.getState();

    const worksheetTitle =
        exportTitle && exportTitle.trim() !== '' ? exportTitle : 'Neues Arbeitsblatt';

    if (!showHeader) return [];

    const paragraphs: Paragraph[] = [];

    try {
        // ── Logo ──
        {
            let logoMeta: ImageMeta | null = null;

            // 1. Try loading the user-uploaded logo
            if (logoImageId) {
                try {
                    const imageRecord = await getImage(logoImageId);
                    if (imageRecord?.blob) {
                        logoMeta = await processImageForDocx(imageRecord.blob);
                    }
                } catch (logoErr) {
                    console.warn('[docxExport] Failed to load/convert logo:', logoErr);
                }
            }

            // 2. Fallback – generate a synthetic coloured logo
            if (!logoMeta) {
                try {
                    const logoColor = brandColor || '#3B82F6';
                    const logoChars = logoText && logoText.trim()
                        ? logoText.trim().slice(0, 3)
                        : schoolName && schoolName.trim()
                            ? schoolName.charAt(0).toUpperCase()
                            : worksheetTitle.charAt(0).toUpperCase();
                    const syntheticBlob = await generateSyntheticLogo(logoChars, logoColor);
                    logoMeta = await processImageForDocx(syntheticBlob);
                } catch (synErr) {
                    console.warn('[docxExport] Synthetic logo generation failed:', synErr);
                }
            }

            if (logoMeta) {
                const logoTargetH = 15; // mm
                const logoTargetW = logoTargetH * logoMeta.ratio;
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: logoMeta.data,
                                transformation: { width: mmToPx(logoTargetW), height: mmToPx(logoTargetH) },
                                type: 'png',
                            }),
                        ],
                        spacing: { after: 40 },
                    }),
                );
            }
        }

        // ── School name ──
        if (schoolName && schoolName.trim()) {
            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: schoolName,
                            font: FONT_FAMILY,
                            size: HEADING_SIZE_PT * 2,
                            bold: true,
                            color: brandColor.replace('#', ''),
                        }),
                    ],
                    spacing: { after: 20 },
                }),
            );
        }

        // ── Worksheet title (subtitle) ──
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: worksheetTitle,
                        font: FONT_FAMILY,
                        size: 9 * 2,
                        color: DOCX_THEME.muted,
                    }),
                ],
                spacing: { after: 60 },
                border: {
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: brandColor.replace('#', ''), space: 4 },
                },
            }),
        );

        // ── Spacer after brand separator ──
        paragraphs.push(
            new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }),
        );

        // ── Name / Date / Class Fields ──
        const hasFields = headerFields.showName || headerFields.showDate || headerFields.showClass;
        if (hasFields) {
            const parts: string[] = [];
            if (headerFields.showName) parts.push(`Name: ${'_'.repeat(25)}`);
            if (headerFields.showDate) parts.push(`Datum: ${'_'.repeat(12)}`);
            if (headerFields.showClass) parts.push(`Klasse: ${'_'.repeat(12)}`);

            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: parts.join('     '),
                            font: FONT_FAMILY,
                            size: 10 * 2,
                            color: DOCX_THEME.fieldLabel,
                        }),
                    ],
                    spacing: { after: 200 },
                }),
            );
        }
    } catch (headerErr) {
        console.warn('[docxExport] Header construction failed:', headerErr);
        return [];
    }

    return paragraphs;
}

// ── Hybrid-Grid Task Wrapper ─────────────────────────────────

/**
 * Wraps a task's rendered content inside a structure table ("Hybrid Grid").
 * Row 1: Task title ("Aufgabe N") in theme colour.
 * Row 2: Task content (text, image, MC table, …).
 * Uses HeightRule.EXACT on the title row for deterministic spacing.
 *
 * When DEBUG_GRID is true the table has visible red borders so you
 * can verify that the grid structure is correct.
 */
function wrapTaskInGrid(
    taskIndex: number,
    contentElements: (Paragraph | Table)[],
    _isFirst: boolean,
): Table {
    // Title cell: bottom border matches the PDF's print-task-index
    // CSS rule: `border-bottom: 1px solid #1e293b`
    const titleCellBorders = {
        ...NO_TABLE_BORDERS,
        bottom: { style: BorderStyle.SINGLE, size: 2, color: DOCX_THEME.taskTitle },
    };

    // Title row
    const titleRow = new TableRow({
        height: { value: TASK_TITLE_ROW_DXA, rule: HeightRule.EXACT },
        children: [
            new TableCell({
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Aufgabe ${taskIndex + 1}`,
                                font: FONT_FAMILY,
                                size: FONT_SIZE_PT * 2,
                                bold: true,
                                color: DOCX_THEME.taskTitle,
                            }),
                        ],
                    }),
                ],
                width: { size: A4_INNER_WIDTH_DXA, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                borders: titleCellBorders,
            }),
        ],
    });

    // Content row – invisible borders
    const contentRow = new TableRow({
        children: [
            new TableCell({
                children: contentElements.length > 0
                    ? contentElements
                    : [new Paragraph({ children: [] })],
                width: { size: A4_INNER_WIDTH_DXA, type: WidthType.DXA },
                borders: NO_TABLE_BORDERS,
            }),
        ],
    });

    return new Table({
        rows: [titleRow, contentRow],
        width: { size: A4_INNER_WIDTH_DXA, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        borders: NO_TABLE_BORDERS,
    });
}

// ── Task Renderers ───────────────────────────────────────────

/**
 * Renders a Multiple-Choice task as an invisible table (border: none).
 * Column 1 (10mm): Checkbox character.
 * Column 2: Answer text.
 * Uses HeightRule.EXACT for pixel-perfect vertical spacing.
 *
 * Teacher mode: ☑ green for correct, ☐ for incorrect
 * Student mode: ☐ empty checkbox for all
 */
function renderMultipleChoice(task: MultipleChoiceTask, isTeacherMode: boolean): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];

    // Question
    if (task.question && task.question.trim()) {
        elements.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: task.question,
                        font: FONT_FAMILY,
                        size: FONT_SIZE_PT * 2,
                        bold: true,
                    }),
                ],
                spacing: { after: 120 },
            }),
        );
    }

    const answerColDXA = A4_INNER_WIDTH_DXA - CHECKBOX_COL_DXA;

    // Build rows – checkbox at 14pt for visual weight
    const MC_CHECKBOX_SIZE_PT = 14;
    const optionRows = task.options.map((option) => {
        const isCorrectTeacher = isTeacherMode && option.isCorrect;
        const checkChar = isCorrectTeacher ? '☑' : '☐';
        const textColor = isCorrectTeacher ? DOCX_THEME.correctAnswer : DOCX_THEME.text;
        const isBold = isCorrectTeacher;

        return new TableRow({
            height: { value: MC_OPTION_ROW_DXA, rule: HeightRule.EXACT },
            children: [
                // Checkbox column (10mm) – 14pt for larger visual checkbox
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: checkChar,
                                    font: FONT_FAMILY,
                                    size: MC_CHECKBOX_SIZE_PT * 2,
                                    color: textColor,
                                    bold: isBold,
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                        }),
                    ],
                    width: { size: CHECKBOX_COL_DXA, type: WidthType.DXA },
                    verticalAlign: VerticalAlign.CENTER,
                    borders: NO_TABLE_BORDERS,
                }),
                // Answer text column
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: option.text,
                                    font: FONT_FAMILY,
                                    size: FONT_SIZE_PT * 2,
                                    color: textColor,
                                    bold: isBold,
                                }),
                            ],
                        }),
                    ],
                    width: { size: answerColDXA, type: WidthType.DXA },
                    verticalAlign: VerticalAlign.CENTER,
                    borders: NO_TABLE_BORDERS,
                }),
            ],
        });
    });

    if (optionRows.length > 0) {
        elements.push(
            new Table({
                rows: optionRows,
                width: { size: A4_INNER_WIDTH_DXA, type: WidthType.DXA },
                layout: TableLayoutType.FIXED,
                borders: NO_TABLE_BORDERS,
            }),
        );
    }

    return elements;
}

/**
 * Renders a Lineatur task as an embedded high-res PNG image.
 * Uses renderLineBlockToImage (300 DPI) for print-quality output,
 * dimensioned via mmToPx() (96 DPI) for correct physical sizing in Word.
 */
async function renderLineatur(task: LineaturTask): Promise<Paragraph[]> {
    // Calculate height from lineRows (fallback to 80mm for legacy tasks)
    const rows = task.lineRows ?? 4;
    const rowHeight = getRowHeightMM(task.lineStyle);
    const heightMM = rows * rowHeight;

    const rawImageData = await renderLineBlockToImage(task, heightMM);
    const imageMeta = await processImageForDocx(rawImageData);
    // mmToPx() converts mm → screen px at 96 DPI for the docx ImageRun
    const widthPx = mmToPx(A4_INNER_WIDTH_MM);
    const heightPx = mmToPx(heightMM);

    return [
        new Paragraph({
            children: [
                new ImageRun({
                    data: imageMeta.data,
                    transformation: {
                        width: widthPx,
                        height: heightPx,
                    },
                    type: 'png',
                }),
            ],
            spacing: { after: TASK_GAP_AFTER },
        }),
    ];
}

/**
 * Renders a Cloze (Lückentext) task as Word paragraphs.
 * Replaces {{word}} placeholders with blanks (student) or green text (teacher).
 */
function renderCloze(task: ClozeTask, isTeacherMode: boolean): Paragraph[] {
    if (!task.content || !task.content.trim()) {
        return [
            new Paragraph({
                children: [
                    new TextRun({
                        text: '(Leerer Lückentext)',
                        font: FONT_FAMILY,
                        size: FONT_SIZE_PT * 2,
                        color: DOCX_THEME.placeholder,
                        italics: true,
                    }),
                ],
            }),
        ];
    }

    // Split content by {{...}} markers
    const parts = task.content.split(/(\\{\\{.*?\\}\\})/g);
    const runs: TextRun[] = [];

    for (const part of parts) {
        const match = part.match(/^\\{\\{(.+?)\\}\\}$/);
        if (match) {
            const word = match[1];
            if (isTeacherMode) {
                // Teacher: show the answer in green
                runs.push(
                    new TextRun({
                        text: word,
                        font: FONT_FAMILY,
                        size: FONT_SIZE_PT * 2,
                        color: DOCX_THEME.correctAnswer,
                        bold: true,
                        underline: { type: 'single' },
                    }),
                );
            } else {
                // Student: blank line (underscored spaces)
                const blankWidth = Math.max(word.length * 2, 10);
                runs.push(
                    new TextRun({
                        text: '_'.repeat(blankWidth),
                        font: FONT_FAMILY,
                        size: FONT_SIZE_PT * 2,
                        color: DOCX_THEME.muted,
                    }),
                );
            }
        } else if (part) {
            runs.push(
                new TextRun({
                    text: part,
                    font: FONT_FAMILY,
                    size: FONT_SIZE_PT * 2,
                }),
            );
        }
    }

    return [
        new Paragraph({
            children: runs,
            spacing: { after: TASK_GAP_AFTER },
        }),
    ];
}

/**
 * Renders a Math (LaTeX) task as an embedded high-res PNG image.
 * Since Word cannot render KaTeX HTML, we convert to an image first.
 */
async function renderMath(task: MathTask): Promise<Paragraph[]> {
    if (!task.content || !task.content.trim()) {
        return [
            new Paragraph({
                children: [
                    new TextRun({
                        text: '(Leere Formel)',
                        font: FONT_FAMILY,
                        size: FONT_SIZE_PT * 2,
                        color: DOCX_THEME.placeholder,
                        italics: true,
                    }),
                ],
            }),
        ];
    }

    const blob = await convertMathToImage(task.content);
    const imageMeta = await processImageForDocx(blob); // Converted to clean PNG with metadata

    // ── Aspect-ratio-aware sizing (using metadata from processImageForDocx) ──
    const maxDisplayWidthMM = A4_INNER_WIDTH_MM * 0.7;
    let displayWidthMM = maxDisplayWidthMM;
    let displayHeightMM = maxDisplayWidthMM / (imageMeta.ratio || 1);

    // Cap height at 60mm to avoid oversized formulas
    if (displayHeightMM > 60) {
        displayHeightMM = 60;
        displayWidthMM = 60 * imageMeta.ratio;
    }

    const widthPx = mmToPx(displayWidthMM);
    const heightPx = mmToPx(displayHeightMM);

    return [
        new Paragraph({
            children: [
                new ImageRun({
                    data: imageMeta.data,
                    transformation: {
                        width: widthPx,
                        height: heightPx,
                    },
                    type: 'png',
                }),
            ],
            spacing: { before: 80, after: TASK_GAP_AFTER },
        }),
    ];
}

/**
 * Renders an Image Placeholder task with optional caption.
 * Loads the image from Dexie and embeds it at the specified size.
 */
async function renderImagePlaceholder(task: ImagePlaceholderTask): Promise<Paragraph[]> {
    const paragraphs: Paragraph[] = [];

    // Add caption if present
    if (task.caption && task.caption.trim()) {
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: task.caption,
                        font: FONT_FAMILY,
                        size: FONT_SIZE_PT * 2,
                        italics: true,
                        color: DOCX_THEME.fieldLabel,
                    }),
                ],
                spacing: { after: 80 },
            }),
        );
    }

    // Load and embed the image
    if (task.imageId) {
        try {
            const imageRecord = await getImage(Number(task.imageId));
            if (imageRecord?.blob) {
                const imageMeta = await processImageForDocx(imageRecord.blob);

                // "Contain" – fit image into box (task.widthMm × task.heightMm)
                // while preserving the original aspect ratio.
                const boxW = task.widthMm;
                const boxH = task.heightMm;
                const ratio = imageMeta.ratio || 1; // width / height

                let fitW: number;
                let fitH: number;

                if (boxW / boxH > ratio) {
                    // Box is proportionally wider → height constrains
                    fitH = boxH;
                    fitW = boxH * ratio;
                } else {
                    // Box is proportionally taller → width constrains
                    fitW = boxW;
                    fitH = boxW / ratio;
                }

                const widthPx = mmToPx(fitW);
                const heightPx = mmToPx(fitH);

                paragraphs.push(
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: imageMeta.data,
                                transformation: {
                                    width: widthPx,
                                    height: heightPx,
                                },
                                type: 'png',
                            }),
                        ],
                        spacing: { after: TASK_GAP_AFTER },
                    }),
                );
            } else {
                console.warn('[docxExport] Image not found for task:', task.id);
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '(Bild nicht gefunden)',
                                font: FONT_FAMILY,
                                size: FONT_SIZE_PT * 2,
                                color: DOCX_THEME.error,
                                italics: true,
                            }),
                        ],
                    }),
                );
            }
        } catch (error) {
            console.error('[docxExport] Failed to load image:', error);
            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: '(Fehler beim Laden des Bildes)',
                            font: FONT_FAMILY,
                            size: FONT_SIZE_PT * 2,
                            color: DOCX_THEME.error,
                            italics: true,
                        }),
                    ],
                }),
            );
        }
    } else {
        // No image specified - show placeholder
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `[Bildplatzhalter: ${task.widthMm}mm × ${task.heightMm}mm]`,
                        font: FONT_FAMILY,
                        size: FONT_SIZE_PT * 2,
                        color: DOCX_THEME.muted,
                        italics: true,
                    }),
                ],
                spacing: { after: TASK_GAP_AFTER },
            }),
        );
    }

    return paragraphs;
}

// ── Main Export Function ─────────────────────────────────────

/**
 * Generates and downloads a .docx file from the current worksheet.
 *
 * @param title        – Worksheet title (used as filename)
 * @param tasksById    – Flat map of all tasks
 * @param taskIds      – Ordered task IDs
 * @param isTeacherMode – Whether to show correct answers
 */
export async function exportToDocx(
    title: string,
    tasksById: Record<string, Task>,
    taskIds: string[],
    isTeacherMode: boolean,
): Promise<void> {
    // ── Resolve font from settings (once, for all renderers) ──
    const { fontFamily: userFont } = useSettingsStore.getState();
    FONT_FAMILY = (userFont || 'Inter').split(',')[0].replace(/["']/g, '').trim();

    // ── Pre-export validation ──
    const warnings = validateForExport(tasksById, taskIds);
    if (warnings.length > 0) {
        const proceed = window.confirm(
            formatWarnings(warnings) + '\n\nTrotzdem exportieren?',
        );
        if (!proceed) return;
    }

    try {
        // ── Build body children ──
        const allChildren: (Paragraph | Table)[] = [];

        // ── Header paragraphs (first page only, no tables) ──
        try {
            const headerParas = await createHeaderParagraphs(title);
            allChildren.push(...headerParas);
        } catch (headerErr) {
            console.warn('[docxExport] Header failed, exporting without:', headerErr);
        }

        // Mode indicator for teacher version
        if (isTeacherMode) {
            allChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: '\uD83D\uDCCB Lehrer-Version (mit Lösungen)',
                            font: FONT_FAMILY,
                            size: 9 * 2,
                            color: DOCX_THEME.teacherBanner,
                            italics: true,
                        }),
                    ],
                    spacing: { after: 200 },
                }),
            );
        }

        // ── Task loop – Hybrid Grid wrappers ──
        let taskNumber = 0; // running counter (page-breaks don't count)
        for (let i = 0; i < taskIds.length; i++) {
            const task = tasksById[taskIds[i]];
            if (!task) continue;

            // Page-break: emit a native Word page break directly into
            // the section children – NOT wrapped in a grid table.
            if (task.type === 'page-break') {
                allChildren.push(
                    new Paragraph({ children: [new PageBreak()] }),
                );
                continue;
            }

            // Spacer paragraph between tasks
            if (taskNumber > 0) {
                allChildren.push(
                    new Paragraph({
                        spacing: { before: TASK_GAP_AFTER, after: 0 },
                        children: [],
                    }),
                );
            }

            // Render task content based on discriminated union type
            let taskContent: (Paragraph | Table)[] = [];

            switch (task.type) {
                case 'multiple-choice':
                    taskContent = renderMultipleChoice(task, isTeacherMode);
                    break;

                case 'lineatur': {
                    taskContent = await renderLineatur(task);
                    break;
                }

                case 'cloze':
                    taskContent = renderCloze(task, isTeacherMode);
                    break;

                case 'math': {
                    taskContent = await renderMath(task);
                    break;
                }

                case 'image-placeholder': {
                    taskContent = await renderImagePlaceholder(task);
                    break;
                }

                default:
                    taskContent = [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `(Unbekannter Aufgabentyp)`,
                                    font: FONT_FAMILY,
                                    size: FONT_SIZE_PT * 2,
                                    color: DOCX_THEME.error,
                                    italics: true,
                                }),
                            ],
                        }),
                    ];
            }

            // Wrap in Hybrid Grid table (title + content rows)
            allChildren.push(wrapTaskInGrid(taskNumber, taskContent, taskNumber === 0));
            taskNumber++;
        }

        // ── Create document ──
        const doc = new Document({
            styles: {
                default: {
                    document: {
                        run: {
                            font: FONT_FAMILY,
                            size: FONT_SIZE_PT * 2, // half-points
                        },
                    },
                },
            },
            sections: [{
                properties: {
                    page: {
                        size: {
                            width: convertMillimetersToTwip(210),
                            height: convertMillimetersToTwip(297),
                        },
                        margin: {
                            top: convertMillimetersToTwip(20),
                            right: convertMillimetersToTwip(20),
                            bottom: convertMillimetersToTwip(20),
                            left: convertMillimetersToTwip(20),
                        },
                    },
                },
                children: allChildren,
            }],
        });

        // ── Generate & download ──
        const blob = await Packer.toBlob(doc);
        const suffix = isTeacherMode ? '_Lehrer' : '_Schueler';
        const filename = `${title.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '')}${suffix}.docx`;
        saveAs(blob, filename);
    } catch (error) {
        console.error('[docxExport] Export failed:', error);
        window.alert('Export fehlgeschlagen. Bitte versuche es erneut.\n\n' + String(error));
    }
}
