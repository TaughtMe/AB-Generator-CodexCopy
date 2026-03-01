import {
    Paragraph,
    TextRun,
    ImageRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    VerticalAlign,
    HeightRule,
    TableLayoutType,
    AlignmentType,
    ShadingType,
    convertMillimetersToTwip,
} from 'docx';
import type {
    Task,
    MultipleChoiceTask,
    LineaturTask,
    ClozeTask,
    MathTask,
    ImagePlaceholderTask,
    ColumnsTask,
    InstructionTask,
    HeadingTask,
    TableTask,
    ImageAlignment,
} from '../../types/worksheet';
import { renderLineBlockToImage } from '../lineBlockToImage';
import { convertMathToImage } from '../mathExportUtils';
import { mmToPx, A4_INNER_WIDTH_MM } from '../mmToEmu';
import { getImage } from '../../store/dexieStore';
import { getRowHeightMM } from '../lineaturStyles';
import { processImageForDocx } from './imagePipeline';
import {
    DEFAULT_CLOZE_GAP_MULTIPLIER,
    DEFAULT_CLOZE_GAP_STYLE,
    getClozeGapText,
    tokenizeClozeContent,
} from '../clozeParser';
import { htmlToDocxParagraphs } from './htmlToDocx';

type DocxAlignment = (typeof AlignmentType)[keyof typeof AlignmentType];
type BorderStyleValue = 'none' | 'single';

function imageAlignmentToDocx(value: ImageAlignment | undefined): DocxAlignment {
    switch (value) {
        case 'center':
            return AlignmentType.CENTER;
        case 'right':
            return AlignmentType.RIGHT;
        case 'left':
        default:
            return AlignmentType.LEFT;
    }
}

/* ── CSS-Helper für Tabellen-Zellen (Slice 3) ── */

/**
 * Parst einen CSS-Farbwert (#xxx, #xxxxxx, rgb) in ein 6-stelliges HEX ohne '#'.
 * Gibt undefined zurück, wenn das Format nicht erkannt wird.
 */
function cssColorToHex(color: string): string | undefined {
    const c = color.trim();
    const h6 = /^#([0-9A-Fa-f]{6})$/.exec(c);
    if (h6) return h6[1].toUpperCase();
    const h3 = /^#([0-9A-Fa-f]{3})$/.exec(c);
    if (h3) {
        const [r, g, b] = h3[1].split('');
        return `${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(c);
    if (rgb) {
        return [rgb[1], rgb[2], rgb[3]]
            .map((n) => parseInt(n, 10).toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
    }
    return undefined;
}

interface CellDocxStyle {
    shading?: { fill: string; type: typeof ShadingType.CLEAR };
    borders: {
        top: { style: BorderStyleValue; size: number; color: string };
        right: { style: BorderStyleValue; size: number; color: string };
        bottom: { style: BorderStyleValue; size: number; color: string };
        left: { style: BorderStyleValue; size: number; color: string };
    };
}

/** Standard-Hintergrund für <th>-Kopfzellen (aus dem Editor-CSS). */
const DEFAULT_HEADER_BG = 'F1F5F9';
const DEFAULT_CELL_BORDER_COLOR = 'CBD5E1';
const DEFAULT_CELL_BORDER_SIZE = 2;

function defaultCellBorder() {
    return {
        style: 'single' as const,
        size: DEFAULT_CELL_BORDER_SIZE,
        color: DEFAULT_CELL_BORDER_COLOR,
    };
}

function readCellStyleValue(cell: Element, cssProperty: string): string | undefined {
    const styleAttr = cell.getAttribute('style') ?? '';
    const hasHTMLElementApi = typeof HTMLElement !== 'undefined';

    if (hasHTMLElementApi && cell instanceof HTMLElement) {
        const inlineValue = cell.style.getPropertyValue(cssProperty).trim();
        if (inlineValue) return inlineValue;
    }

    const escapedProperty = cssProperty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const styleMatch = new RegExp(`${escapedProperty}\\s*:\\s*([^;]+)`, 'i').exec(styleAttr);
    if (styleMatch?.[1]) return styleMatch[1].trim();

    if (typeof window !== 'undefined' && typeof getComputedStyle === 'function' && hasHTMLElementApi && cell instanceof HTMLElement) {
        const computedValue = getComputedStyle(cell).getPropertyValue(cssProperty).trim();
        if (computedValue) return computedValue;
    }

    return undefined;
}

function cssBorderWidthToDocxSize(borderWidth: string | undefined): number {
    if (!borderWidth) return DEFAULT_CELL_BORDER_SIZE;
    const widthMatch = /(\d+(?:\.\d+)?)\s*px/i.exec(borderWidth);
    if (!widthMatch) return DEFAULT_CELL_BORDER_SIZE;
    const px = parseFloat(widthMatch[1]);
    return Math.max(2, Math.round(px * 8));
}

function parseBorderDeclaration(borderValue: string | undefined): { style: BorderStyleValue; size: number; color: string } {
    if (!borderValue) return defaultCellBorder();

    const normalized = borderValue.trim().toLowerCase();
    if (!normalized || normalized === 'none' || normalized === '0' || normalized === '0px' || /\bnone\b/.test(normalized)) {
        return {
            style: 'none',
            size: 0,
            color: DEFAULT_CELL_BORDER_COLOR,
        };
    }

    const colorMatch = /(#[0-9A-Fa-f]{3,6}|rgb\([^)]+\))/i.exec(borderValue);
    const parsedColor = colorMatch ? cssColorToHex(colorMatch[1]) : undefined;

    return {
        style: 'single',
        size: cssBorderWidthToDocxSize(borderValue),
        color: parsedColor ?? DEFAULT_CELL_BORDER_COLOR,
    };
}

function buildLegacyBorderDeclaration(cell: Element): string | undefined {
    const sharedBorder = readCellStyleValue(cell, 'border');
    if (sharedBorder) return sharedBorder;

    const sharedBorderWidth = readCellStyleValue(cell, 'border-width');
    const sharedBorderStyle = readCellStyleValue(cell, 'border-style') ?? 'solid';
    const sharedBorderColor = readCellStyleValue(cell, 'border-color') ?? '#cbd5e1';
    if (!sharedBorderWidth) return undefined;

    return `${sharedBorderWidth} ${sharedBorderStyle} ${sharedBorderColor}`;
}

/**
 * Liest background-color und border-top/right/bottom/left aus
 * inline/computed styles eines <td>/<th>-Elements und gibt
 * docx-kompatible Werte zurück.
 */
function parseCellStyle(cell: Element | undefined): CellDocxStyle {
    if (!cell) {
        return {
            borders: {
                top: defaultCellBorder(),
                right: defaultCellBorder(),
                bottom: defaultCellBorder(),
                left: defaultCellBorder(),
            },
        };
    }

    const result: CellDocxStyle = {
        borders: {
            top: defaultCellBorder(),
            right: defaultCellBorder(),
            bottom: defaultCellBorder(),
            left: defaultCellBorder(),
        },
    };

    const bgValue = readCellStyleValue(cell, 'background-color');
    if (bgValue) {
        const hex = cssColorToHex(bgValue);
        if (hex) result.shading = { fill: hex, type: ShadingType.CLEAR };
    }

    const legacyBorder = buildLegacyBorderDeclaration(cell);
    const borderTopValue = readCellStyleValue(cell, 'border-top') ?? legacyBorder;
    const borderRightValue = readCellStyleValue(cell, 'border-right') ?? legacyBorder;
    const borderBottomValue = readCellStyleValue(cell, 'border-bottom') ?? legacyBorder;
    const borderLeftValue = readCellStyleValue(cell, 'border-left') ?? legacyBorder;

    result.borders = {
        top: parseBorderDeclaration(borderTopValue),
        right: parseBorderDeclaration(borderRightValue),
        bottom: parseBorderDeclaration(borderBottomValue),
        left: parseBorderDeclaration(borderLeftValue),
    };

    return result;
}

function parseCellAlignment(cell: Element | undefined): DocxAlignment | undefined {
    if (!cell) return undefined;
    const styleAttr = cell.getAttribute('style') ?? '';
    const alignMatch = /text-align\s*:\s*(left|center|right|justify)/i.exec(styleAttr);
    if (!alignMatch) return undefined;

    switch (alignMatch[1].toLowerCase()) {
        case 'left': return AlignmentType.LEFT;
        case 'center': return AlignmentType.CENTER;
        case 'right': return AlignmentType.RIGHT;
        case 'justify': return AlignmentType.JUSTIFIED;
        default: return undefined;
    }
}

/**
 * Renderer-Layer der modularisierten DOCX-Pipeline.
 *
 * Architekturrolle:
 * - `index.ts` steuert den Ablauf und delegiert hierher für Task-spezifische
 *   Darstellung.
 * - Diese Trennung verhindert, dass Orchestrierung und Layoutregeln vermischt
 *   werden, was künftige Erweiterungen (neue Tasktypen) deutlich sicherer macht.
 */
interface DocxTheme {
    taskTitle: string;
    text: string;
    correctAnswer: string;
    teacherBanner: string;
    placeholder: string;
    muted: string;
    fieldLabel: string;
    error: string;
}

interface TaskRendererConfig {
    fontFamily: string;
    fontSizePt: number;
    taskGapAfter: number;
    taskTitleRowDxa: number;
    a4InnerWidthDxa: number;
    checkboxColDxa: number;
    mcOptionRowDxa: number;
    noTableBorders: {
        top: { style: BorderStyleValue; size: number; color: string };
        bottom: { style: BorderStyleValue; size: number; color: string };
        left: { style: BorderStyleValue; size: number; color: string };
        right: { style: BorderStyleValue; size: number; color: string };
        insideHorizontal: { style: BorderStyleValue; size: number; color: string };
        insideVertical: { style: BorderStyleValue; size: number; color: string };
    };
    docxTheme: DocxTheme;
}

function renderMultipleChoice(
    task: MultipleChoiceTask,
    isTeacherVersion: boolean,
    config: TaskRendererConfig,
): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];

    if (task.question && task.question.trim()) {
        // Unterstützt jetzt HTML-Content aus dem Tiptap-Editor (Bold/Italic/Underline/Listen)
        const questionParagraphs = htmlToDocxParagraphs(task.question, {
            fontFamily: config.fontFamily,
            fontSizePt: config.fontSizePt,
            color: config.docxTheme.text,
            bold: true,
        }, 120);
        elements.push(...questionParagraphs);
    }

    const answerColDXA = config.a4InnerWidthDxa - config.checkboxColDxa;
    const MC_CHECKBOX_SIZE_PT = 14;

    const optionRows = task.options.map((option) => {
        const isCorrectTeacher = isTeacherVersion && option.isCorrect;
        const checkChar = isCorrectTeacher ? '☑' : '☐';
        const textColor = isCorrectTeacher ? config.docxTheme.correctAnswer : config.docxTheme.text;
        const isBold = isCorrectTeacher;

        return new TableRow({
            height: { value: config.mcOptionRowDxa, rule: HeightRule.EXACT },
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: checkChar,
                                    font: config.fontFamily,
                                    size: MC_CHECKBOX_SIZE_PT * 2,
                                    color: textColor,
                                    bold: isBold,
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                        }),
                    ],
                    width: { size: config.checkboxColDxa, type: WidthType.DXA },
                    verticalAlign: VerticalAlign.CENTER,
                    borders: config.noTableBorders,
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: option.text,
                                    font: config.fontFamily,
                                    size: config.fontSizePt * 2,
                                    color: textColor,
                                    bold: isBold,
                                }),
                            ],
                        }),
                    ],
                    width: { size: answerColDXA, type: WidthType.DXA },
                    verticalAlign: VerticalAlign.CENTER,
                    borders: config.noTableBorders,
                }),
            ],
        });
    });

    if (optionRows.length > 0) {
        elements.push(
            new Table({
                rows: optionRows,
                width: { size: config.a4InnerWidthDxa, type: WidthType.DXA },
                layout: TableLayoutType.FIXED,
                borders: config.noTableBorders,
            }),
        );
    }

    return elements;
}

async function renderLineatur(task: LineaturTask, config: TaskRendererConfig): Promise<Paragraph[]> {
    const elements: Paragraph[] = [];

    if (task.promptHtml && task.promptHtml.trim()) {
        const promptParagraphs = htmlToDocxParagraphs(task.promptHtml, {
            fontFamily: config.fontFamily,
            fontSizePt: config.fontSizePt,
            color: config.docxTheme.text,
        }, 80);
        elements.push(...promptParagraphs);
    }

    const rows = task.lineRows ?? 4;
    const rowHeight = getRowHeightMM(task.lineStyle);
    const heightMM = rows * rowHeight;

    const rawImageData = await renderLineBlockToImage(task, heightMM);
    const imageMeta = await processImageForDocx(rawImageData);
    const widthPx = mmToPx(A4_INNER_WIDTH_MM);
    const heightPx = mmToPx(heightMM);

    elements.push(
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
            spacing: { after: config.taskGapAfter },
        }),
    );

    return elements;
}

function renderCloze(task: ClozeTask, isTeacherVersion: boolean, config: TaskRendererConfig): Paragraph[] {
    if (!task.content || !task.content.trim()) {
        return [
            new Paragraph({
                children: [
                    new TextRun({
                        text: '(Leerer Lückentext)',
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.placeholder,
                        italics: true,
                    }),
                ],
            }),
        ];
    }

    const gapStyle = task.gapStyle ?? DEFAULT_CLOZE_GAP_STYLE;
    const gapMultiplier = task.gapMultiplier ?? DEFAULT_CLOZE_GAP_MULTIPLIER;
    const parts = tokenizeClozeContent(task.content);
    const runs: TextRun[] = [];

    for (const part of parts) {
        if (part.type === 'gap') {
            const word = part.answer;
            if (isTeacherVersion) {
                runs.push(
                    new TextRun({
                        text: word,
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.correctAnswer,
                        bold: true,
                        underline: { type: 'single' },
                    }),
                );
            } else {
                runs.push(
                    new TextRun({
                        text: getClozeGapText(word, gapStyle, gapMultiplier),
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.muted,
                    }),
                );
            }
        } else if (part.value) {
            runs.push(
                new TextRun({
                    text: part.value,
                    font: config.fontFamily,
                    size: config.fontSizePt * 2,
                }),
            );
        }
    }

    return [
        new Paragraph({
            children: runs,
            spacing: { after: config.taskGapAfter },
        }),
    ];
}

async function renderMath(task: MathTask, config: TaskRendererConfig): Promise<Paragraph[]> {
    if (!task.content || !task.content.trim()) {
        return [
            new Paragraph({
                children: [
                    new TextRun({
                        text: '(Leere Formel)',
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.placeholder,
                        italics: true,
                    }),
                ],
            }),
        ];
    }

    const blob = await convertMathToImage(task.content);
    const imageMeta = await processImageForDocx(blob);

    const maxDisplayWidthMM = A4_INNER_WIDTH_MM * 0.7;
    let displayWidthMM = maxDisplayWidthMM;
    let displayHeightMM = maxDisplayWidthMM / (imageMeta.ratio || 1);

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
            spacing: { before: 80, after: config.taskGapAfter },
        }),
    ];
}

async function renderImagePlaceholder(task: ImagePlaceholderTask, config: TaskRendererConfig): Promise<Paragraph[]> {
    const paragraphs: Paragraph[] = [];
    const imageAlignment = imageAlignmentToDocx(task.imageAlign);

    if (task.caption && task.caption.trim()) {
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: task.caption,
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        italics: true,
                        color: config.docxTheme.fieldLabel,
                    }),
                ],
                alignment: imageAlignment,
                spacing: { after: 80 },
            }),
        );
    }

    if (task.imageId) {
        try {
            const imageRecord = await getImage(task.imageId);
            if (imageRecord?.blob) {
                const imageMeta = await processImageForDocx(imageRecord.blob);

                const boxW = task.widthMm;
                const boxH = task.heightMm;
                const ratio = imageMeta.ratio || 1;

                let fitW: number;
                let fitH: number;

                if (boxW / boxH > ratio) {
                    fitH = boxH;
                    fitW = boxH * ratio;
                } else {
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
                        alignment: imageAlignment,
                        spacing: { after: config.taskGapAfter },
                    }),
                );
            } else {
                console.warn('[docxExport] Image not found for task:', task.id);
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '(Bild nicht gefunden)',
                                font: config.fontFamily,
                                size: config.fontSizePt * 2,
                                color: config.docxTheme.error,
                                italics: true,
                            }),
                        ],
                        alignment: imageAlignment,
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
                            font: config.fontFamily,
                            size: config.fontSizePt * 2,
                            color: config.docxTheme.error,
                            italics: true,
                        }),
                    ],
                    alignment: imageAlignment,
                }),
            );
        }
    } else {
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `[Bildplatzhalter: ${task.widthMm}mm × ${task.heightMm}mm]`,
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.muted,
                        italics: true,
                    }),
                ],
                alignment: imageAlignment,
                spacing: { after: config.taskGapAfter },
            }),
        );
    }

    return paragraphs;
}

export function wrapTaskInGrid(
    taskIndex: number | null,
    contentElements: (Paragraph | Table)[],
    config: TaskRendererConfig,
    accentColor?: string,
): Table {
    /**
     * Hybrid-Grid-Vertrag:
     * - Zeile 1 enthält optional die Aufgabennummer.
     * - Zeile 2 enthält den eigentlichen Taskinhalt.
     *
     * Warum Tabelle statt freier Paragraphen:
     * Word ist bei vertikalen Abständen kontextabhängig. Das Grid stabilisiert
     * die Höhe und reduziert Layoutdrift über unterschiedliche Tasktypen hinweg.
     */
    const titleText = taskIndex !== null ? `Aufgabe ${taskIndex}` : '';
    // Per-Task accentColor → hex ohne '#' für DOCX
    const titleColor = accentColor
        ? accentColor.replace('#', '')
        : config.docxTheme.taskTitle;
    const titleCellBorders: TaskRendererConfig['noTableBorders'] = titleText
        ? {
            ...config.noTableBorders,
            bottom: { style: 'single', size: 2, color: titleColor },
        }
        : config.noTableBorders;

    const titleRow = new TableRow({
        height: { value: titleText ? config.taskTitleRowDxa : 0, rule: titleText ? HeightRule.EXACT : HeightRule.AUTO },
        children: [
            new TableCell({
                children: [
                    new Paragraph({
                        children: titleText
                            ? [
                                new TextRun({
                                    text: titleText,
                                    font: config.fontFamily,
                                    size: config.fontSizePt * 2,
                                    bold: true,
                                    color: titleColor,
                                }),
                            ]
                            : [],
                    }),
                ],
                width: { size: config.a4InnerWidthDxa, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                borders: titleCellBorders,
            }),
        ],
    });

    const contentRow = new TableRow({
        children: [
            new TableCell({
                children: contentElements.length > 0
                    ? contentElements
                    : [new Paragraph({ children: [] })],
                width: { size: config.a4InnerWidthDxa, type: WidthType.DXA },
                borders: config.noTableBorders,
            }),
        ],
    });

    return new Table({
        rows: [titleRow, contentRow],
        width: { size: config.a4InnerWidthDxa, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        borders: config.noTableBorders,
    });
}

function renderInstruction(
    task: InstructionTask,
    config: TaskRendererConfig,
): (Paragraph | Table)[] {
    if (!task.text || !task.text.trim()) {
        return [
            new Paragraph({
                children: [
                    new TextRun({
                        text: '(Kein Aufgabentext)',
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.muted,
                        italics: true,
                    }),
                ],
            }),
        ];
    }

    // Unterstützt jetzt HTML-Content aus dem Tiptap-Editor
    return htmlToDocxParagraphs(task.text, {
        fontFamily: config.fontFamily,
        fontSizePt: config.fontSizePt,
        color: config.docxTheme.text,
    }, 80);
}

function renderHeading(
    task: HeadingTask,
    config: TaskRendererConfig,
): Paragraph[] {
    const text = task.text?.trim() || 'Zwischenüberschrift';

    return [
        new Paragraph({
            children: [
                new TextRun({
                    text,
                    font: config.fontFamily,
                    size: (config.fontSizePt + 4) * 2,
                    color: config.docxTheme.text,
                    bold: true,
                }),
            ],
            spacing: { before: 200, after: 120 },
        }),
    ];
}

function renderTableTask(
    task: TableTask,
    config: TaskRendererConfig,
): (Paragraph | Table)[] {
    const fallbackRows = Math.max(1, Math.min(20, Math.round(task.rows || 3)));
    const fallbackCols = Math.max(1, Math.min(10, Math.round(task.cols || 3)));

    const hasHtmlContent = Boolean(task.content && task.content.trim().length > 0);
    const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
    const doc = parser && hasHtmlContent
        ? parser.parseFromString(task.content, 'text/html')
        : null;
    const htmlTable = doc?.querySelector('table') ?? null;

    // Fallback: Kein <table>-Markup vorhanden -> als normaler Rich-Text exportieren.
    if (!htmlTable) {
        if (!hasHtmlContent) {
            const rows = Array.from({ length: fallbackRows }, (_, rowIndex) => (
                new TableRow({
                    children: Array.from({ length: fallbackCols }, (_, colIndex) => {
                        const colWidthBase = Math.floor(config.a4InnerWidthDxa / fallbackCols);
                        const colWidth = colIndex === fallbackCols - 1
                            ? config.a4InnerWidthDxa - colWidthBase * (fallbackCols - 1)
                            : colWidthBase;
                        return new TableCell({
                            children: rowIndex === 0
                                ? [
                                    new Paragraph({
                                        children: [
                                            new TextRun({
                                                text: '',
                                                font: config.fontFamily,
                                                size: config.fontSizePt * 2,
                                                bold: true,
                                                color: config.docxTheme.text,
                                            }),
                                        ],
                                    }),
                                ]
                                : [new Paragraph({ children: [] })],
                            width: { size: colWidth, type: WidthType.DXA },
                            verticalAlign: VerticalAlign.TOP,
                            borders: {
                                top: { style: 'single', size: 2, color: 'CBD5E1' },
                                bottom: { style: 'single', size: 2, color: 'CBD5E1' },
                                left: { style: 'single', size: 2, color: 'CBD5E1' },
                                right: { style: 'single', size: 2, color: 'CBD5E1' },
                            },
                        });
                    }),
                })
            ));

            return [
                new Table({
                    rows,
                    width: { size: config.a4InnerWidthDxa, type: WidthType.DXA },
                    layout: TableLayoutType.FIXED,
                    borders: {
                        top: { style: 'single', size: 2, color: 'CBD5E1' },
                        bottom: { style: 'single', size: 2, color: 'CBD5E1' },
                        left: { style: 'single', size: 2, color: 'CBD5E1' },
                        right: { style: 'single', size: 2, color: 'CBD5E1' },
                        insideHorizontal: { style: 'single', size: 2, color: 'CBD5E1' },
                        insideVertical: { style: 'single', size: 2, color: 'CBD5E1' },
                    },
                }),
            ];
        }

        return htmlToDocxParagraphs(task.content, {
            fontFamily: config.fontFamily,
            fontSizePt: config.fontSizePt,
            color: config.docxTheme.text,
        }, 80);
    }

    const tableRows = Array.from(htmlTable.querySelectorAll('tr'));
    const colCount = Math.max(
        1,
        ...tableRows.map((row) => Math.max(1, row.querySelectorAll('th,td').length)),
    );
    const columnBaseWidth = Math.floor(config.a4InnerWidthDxa / colCount);

    // ── Spaltenbreiten aus colwidth-Attribut der ersten Zeile lesen ──
    const firstRowCells = tableRows[0]
        ? Array.from(tableRows[0].querySelectorAll('th,td'))
        : [];
    const cellPixelWidths: number[] = firstRowCells.map((c) => {
        const cw = c.getAttribute('colwidth');
        return cw ? parseInt(cw, 10) : 0;
    });
    const hasCustomWidths = cellPixelWidths.some((w) => w > 0);
    const totalPixelWidth = cellPixelWidths.reduce((s, w) => s + (w || 0), 0) || 1;

    const docxRows = tableRows.map((rowElement) => {
        const cells = Array.from(rowElement.querySelectorAll('th,td'));
        const rowCells = Array.from({ length: colCount }, (_, colIndex) => {
            const cell = cells[colIndex];
            const isHeaderCell = cell?.tagName.toLowerCase() === 'th';
            const cellHtml = cell?.innerHTML?.trim() ?? '';
            const cellAlignment = parseCellAlignment(cell);
            const cellParagraphs = cellHtml
                ? htmlToDocxParagraphs(cellHtml, {
                    fontFamily: config.fontFamily,
                    fontSizePt: config.fontSizePt,
                    color: config.docxTheme.text,
                    bold: isHeaderCell || undefined,
                }, 40, { defaultAlignment: cellAlignment })
                : [];

            // Proportionale Spaltenbreite wenn colwidth vorhanden
            let colWidth: number;
            if (hasCustomWidths && cellPixelWidths[colIndex] > 0) {
                colWidth = Math.round(
                    (cellPixelWidths[colIndex] / totalPixelWidth) * config.a4InnerWidthDxa,
                );
            } else {
                colWidth = colIndex === colCount - 1
                    ? config.a4InnerWidthDxa - columnBaseWidth * (colCount - 1)
                    : columnBaseWidth;
            }

            // Tiptap background-color und border-top/right/bottom/left auslesen
            const cellDocxStyle = parseCellStyle(cell);

            // Standard-Hintergrund für Header-Zellen anwenden (wie im Editor-CSS)
            if (isHeaderCell && !cellDocxStyle.shading) {
                cellDocxStyle.shading = { fill: DEFAULT_HEADER_BG, type: ShadingType.CLEAR };
            }

            return new TableCell({
                children: cellParagraphs.length > 0 ? cellParagraphs : [new Paragraph({ children: [] })],
                width: { size: colWidth, type: WidthType.DXA },
                verticalAlign: VerticalAlign.TOP,
                shading: cellDocxStyle.shading,
                borders: {
                    top: cellDocxStyle.borders.top,
                    right: cellDocxStyle.borders.right,
                    bottom: cellDocxStyle.borders.bottom,
                    left: cellDocxStyle.borders.left,
                },
            });
        });

        return new TableRow({ children: rowCells });
    });

    return [
        new Table({
            rows: docxRows,
            width: { size: config.a4InnerWidthDxa, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            borders: config.noTableBorders,
        }),
    ];
}

export async function renderTaskContent(
    task: Task,
    isTeacherVersion: boolean,
    config: TaskRendererConfig,
): Promise<(Paragraph | Table)[]> {
    switch (task.type) {
        case 'multiple-choice':
            return renderMultipleChoice(task, isTeacherVersion, config);
        case 'lineatur':
            return await renderLineatur(task, config);
        case 'cloze':
            return renderCloze(task, isTeacherVersion, config);
        case 'math':
            return await renderMath(task, config);
        case 'image-placeholder':
            return await renderImagePlaceholder(task, config);
        case 'instruction':
            return renderInstruction(task as InstructionTask, config);
        case 'heading':
            return renderHeading(task as HeadingTask, config);
        case 'table':
            return renderTableTask(task as TableTask, config);
        default:
            return [
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `(Unbekannter Aufgabentyp)`,
                            font: config.fontFamily,
                            size: config.fontSizePt * 2,
                            color: config.docxTheme.error,
                            italics: true,
                        }),
                    ],
                }),
            ];
    }
}

function layoutToFractions(layout: string): [number, number] {
    switch (layout) {
        case '60-40': return [0.6, 0.4];
        case '40-60': return [0.4, 0.6];
        default: return [0.5, 0.5];
    }
}

export async function renderColumnsTask(
    task: ColumnsTask,
    tasksById: Record<string, Task>,
    isTeacherVersion: boolean,
    config: TaskRendererConfig,
): Promise<Table> {
    /**
     * DXA/Twip-Geometrie für Spaltenlayout.
     *
     * Rechenweg:
     * - `config.a4InnerWidthDxa` entspricht der effektiven Druckbreite.
     * - Von dieser Breite wird der Spaltenabstand (`COLUMN_GAP_DXA`) abgezogen.
     * - Der Rest wird per Fraktion auf links/rechts verteilt.
     *
     * Beispiel bei aktuellem Setup (50/50):
     * `leftWidth = floor((inner - gap) * 0.5)`,
     * `rightWidth = (inner - gap) - leftWidth`.
     *
     * Der floor + Restzuweisung verhindert Summenfehler durch Rundung.
     */
    const COLUMN_GAP_DXA = convertMillimetersToTwip(6);
    const [leftFrac] = layoutToFractions(task.layout);
    const usableWidth = config.a4InnerWidthDxa - COLUMN_GAP_DXA;
    const leftWidth = Math.floor(usableWidth * leftFrac);
    const rightWidth = usableWidth - leftWidth;

    const renderCellContent = async (childId: string | null): Promise<(Paragraph | Table)[]> => {
        if (!childId || !tasksById[childId]) {
            return [
                new Paragraph({
                    children: [
                        new TextRun({
                            text: '(leer)',
                            font: config.fontFamily,
                            size: config.fontSizePt * 2,
                            color: config.docxTheme.placeholder,
                            italics: true,
                        }),
                    ],
                }),
            ];
        }
        return await renderTaskContent(tasksById[childId], isTeacherVersion, config);
    };

    const [leftContent, rightContent] = await Promise.all([
        renderCellContent(task.children[0]),
        renderCellContent(task.children[1]),
    ]);

    const cellBorders = {
        ...config.noTableBorders,
    };

    // Slice 2: Explizite Gap-Zelle zwischen den Spalten statt "virtuell abgezogener" Breite.
    // Word versteht Layout-Tabellen mit festen Spaltenbreiten zuverlässig; der Abstand
    // wird als leere Zelle ohne Rahmen und Inhalt abgebildet.
    const gapCell = new TableCell({
        children: [new Paragraph({ children: [] })],
        width: { size: COLUMN_GAP_DXA, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
    });

    const leftCell = new TableCell({
        children: leftContent.length > 0 ? leftContent : [new Paragraph({ children: [] })],
        width: { size: leftWidth, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
    });

    const rightCell = new TableCell({
        children: rightContent.length > 0 ? rightContent : [new Paragraph({ children: [] })],
        width: { size: rightWidth, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
    });

    return new Table({
        rows: [
            new TableRow({
                children: [leftCell, gapCell, rightCell],
            }),
        ],
        width: { size: config.a4InnerWidthDxa, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        borders: config.noTableBorders,
    });
}
