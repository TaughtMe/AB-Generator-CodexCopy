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
    convertMillimetersToTwip,
} from 'docx';
import type { Task, MultipleChoiceTask, LineaturTask, ClozeTask, MathTask, ImagePlaceholderTask, ColumnsTask } from '../../types/worksheet';
import { renderLineBlockToImage } from '../lineBlockToImage';
import { convertMathToImage } from '../mathExportUtils';
import { mmToPx, A4_INNER_WIDTH_MM } from '../mmToEmu';
import { getImage } from '../../store/dexieStore';
import { getRowHeightMM } from '../lineaturStyles';
import { processImageForDocx } from './imagePipeline';

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

type BorderStyleValue = 'none' | 'single';

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
    isTeacherMode: boolean,
    config: TaskRendererConfig,
): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];

    if (task.question && task.question.trim()) {
        elements.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: task.question,
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        bold: true,
                    }),
                ],
                spacing: { after: 120 },
            }),
        );
    }

    const answerColDXA = config.a4InnerWidthDxa - config.checkboxColDxa;
    const MC_CHECKBOX_SIZE_PT = 14;

    const optionRows = task.options.map((option) => {
        const isCorrectTeacher = isTeacherMode && option.isCorrect;
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
    const rows = task.lineRows ?? 4;
    const rowHeight = getRowHeightMM(task.lineStyle);
    const heightMM = rows * rowHeight;

    const rawImageData = await renderLineBlockToImage(task, heightMM);
    const imageMeta = await processImageForDocx(rawImageData);
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
            spacing: { after: config.taskGapAfter },
        }),
    ];
}

function renderCloze(task: ClozeTask, isTeacherMode: boolean, config: TaskRendererConfig): Paragraph[] {
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

    const parts = task.content.split(/(\{\{.*?\}\})/g);
    const runs: TextRun[] = [];

    for (const part of parts) {
        const match = part.match(/^\{\{(.+?)\}\}$/);
        if (match) {
            const word = match[1];
            if (isTeacherMode) {
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
                const blankWidth = Math.max(word.length * 2, 10);
                runs.push(
                    new TextRun({
                        text: '_'.repeat(blankWidth),
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.muted,
                    }),
                );
            }
        } else if (part) {
            runs.push(
                new TextRun({
                    text: part,
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
    const titleCellBorders: TaskRendererConfig['noTableBorders'] = titleText
        ? {
            ...config.noTableBorders,
            bottom: { style: 'single', size: 2, color: config.docxTheme.taskTitle },
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
                                    color: config.docxTheme.taskTitle,
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

export async function renderTaskContent(
    task: Task,
    isTeacherMode: boolean,
    config: TaskRendererConfig,
): Promise<(Paragraph | Table)[]> {
    switch (task.type) {
        case 'multiple-choice':
            return renderMultipleChoice(task, isTeacherMode, config);
        case 'lineatur':
            return await renderLineatur(task, config);
        case 'cloze':
            return renderCloze(task, isTeacherMode, config);
        case 'math':
            return await renderMath(task, config);
        case 'image-placeholder':
            return await renderImagePlaceholder(task, config);
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
    isTeacherMode: boolean,
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
        return await renderTaskContent(tasksById[childId], isTeacherMode, config);
    };

    const [leftContent, rightContent] = await Promise.all([
        renderCellContent(task.children[0]),
        renderCellContent(task.children[1]),
    ]);

    const cellBorders = {
        ...config.noTableBorders,
    };

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
                children: [leftCell, rightCell],
            }),
        ],
        width: { size: config.a4InnerWidthDxa, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        borders: config.noTableBorders,
    });
}
