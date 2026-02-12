/**
 * docxExport.ts – Word (.docx) Export Engine
 *
 * Iterates through all tasks (in order) and generates a Word document.
 * Uses discriminated unions for type-safe rendering of each task type.
 * Supports teacher mode (correct answers highlighted) and student mode.
 * Includes validated header with Logo, school name, and form fields.
 */

import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    ImageRun,
    HeadingLevel,
    BorderStyle,
    Table,
    TableRow,
    TableCell,
    WidthType,
    VerticalAlign,
    convertMillimetersToTwip,
} from 'docx';
import { saveAs } from 'file-saver';
import type { Task, MultipleChoiceTask, LineaturTask, ClozeTask, MathTask } from '../types/worksheet';
import { renderLineBlockToImage } from './lineBlockToImage';
import { convertMathToImage, blobToArrayBuffer } from './mathExportUtils';
import { mmToEmu, A4_INNER_WIDTH_MM } from './mmToEmu';
import { validateForExport, formatWarnings } from './exportValidator';
import { useSettingsStore } from '../store/settingsStore';
import { useWorksheetStore } from '../store/worksheetStore';
import { getImage } from '../store/dexieStore';
import { getRowHeightMM } from './lineaturStyles';

// ── Constants ────────────────────────────────────────────────

const FONT_FAMILY = 'Calibri';
const FONT_SIZE_PT = 11;
const HEADING_SIZE_PT = 13;

// ── Logo Validation ──────────────────────────────────────────

/** Validates that a Uint8Array starts with valid PNG or JPEG magic bytes */
function isValidImageData(data: Uint8Array): boolean {
    if (data.length < 8) return false;

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    const isPNG =
        data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47 &&
        data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a;

    // JPEG: FF D8 FF
    const isJPEG = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;

    return isPNG || isJPEG;
}

/** Determines the image type from magic bytes */
function getImageType(data: Uint8Array): 'png' | 'jpg' {
    if (data[0] === 0x89 && data[1] === 0x50) return 'png';
    return 'jpg';
}

// ── Header Builder ───────────────────────────────────────────

/**
 * Builds the header section (logo + school name + form fields) as valid docx elements.
 * Returns an array of Paragraphs/Tables, or empty array on failure.
 */
async function buildHeaderSection(): Promise<(Paragraph | Table)[]> {
    const { schoolName, logoImageId, headerFields, brandColor } = useSettingsStore.getState();
    const { showHeader } = useWorksheetStore.getState();

    // Respect the showHeader toggle
    if (!showHeader) return [];

    const hasHeader = schoolName || logoImageId;
    const hasFields = headerFields.showName || headerFields.showDate || headerFields.showClass;

    if (!hasHeader && !hasFields) return [];

    const elements: (Paragraph | Table)[] = [];

    try {
        // ── Logo + School Name Row (as Table) ──
        if (hasHeader) {
            let logoImageData: Uint8Array | null = null;
            let logoType: 'png' | 'jpg' = 'png';

            // Load and validate logo from Dexie
            if (logoImageId) {
                try {
                    const imageRecord = await getImage(logoImageId);
                    if (imageRecord?.blob) {
                        const arrayBuffer = await imageRecord.blob.arrayBuffer();
                        const data = new Uint8Array(arrayBuffer);
                        if (isValidImageData(data)) {
                            logoImageData = data;
                            logoType = getImageType(data);
                        } else {
                            console.warn('[docxExport] Logo image has invalid magic bytes, skipping logo.');
                        }
                    }
                } catch (logoErr) {
                    console.warn('[docxExport] Failed to load logo from Dexie:', logoErr);
                }
            }

            // Build the logo cell children
            const logoCellChildren: Paragraph[] = [];
            if (logoImageData) {
                logoCellChildren.push(
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: logoImageData,
                                transformation: { width: mmToEmu(15), height: mmToEmu(15) },
                                type: logoType,
                            }),
                        ],
                    }),
                );
            } else {
                // Empty paragraph as placeholder
                logoCellChildren.push(new Paragraph({ children: [] }));
            }

            // Build the school name cell
            const nameCellChildren: Paragraph[] = [
                new Paragraph({
                    children: [
                        new TextRun({
                            text: schoolName || '',
                            font: FONT_FAMILY,
                            size: HEADING_SIZE_PT * 2,
                            bold: true,
                            color: brandColor.replace('#', ''),
                        }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: 'Arbeitsblatt',
                            font: FONT_FAMILY,
                            size: 9 * 2,
                            color: '94A3B8',
                        }),
                    ],
                }),
            ];

            const noBorders = {
                top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            };

            const headerTable = new Table({
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                children: logoCellChildren,
                                width: { size: 20, type: WidthType.PERCENTAGE },
                                verticalAlign: VerticalAlign.CENTER,
                                borders: noBorders,
                            }),
                            new TableCell({
                                children: nameCellChildren,
                                width: { size: 80, type: WidthType.PERCENTAGE },
                                verticalAlign: VerticalAlign.CENTER,
                                borders: noBorders,
                            }),
                        ],
                    }),
                ],
                width: { size: 100, type: WidthType.PERCENTAGE },
            });

            elements.push(headerTable);

            // Color separator line
            elements.push(
                new Paragraph({
                    spacing: { before: 60, after: 120 },
                    border: {
                        bottom: {
                            color: brandColor.replace('#', ''),
                            style: BorderStyle.SINGLE,
                            size: 3,
                            space: 2,
                        },
                    },
                    children: [],
                }),
            );
        }

        // ── Name / Date / Class Fields (as Table) ──
        if (hasFields) {
            const fieldCells: TableCell[] = [];
            const noBorders = {
                top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
            };

            if (headerFields.showName) {
                fieldCells.push(
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: 'Name: ___________________',
                                        font: FONT_FAMILY,
                                        size: 10 * 2,
                                        color: '64748B',
                                    }),
                                ],
                            }),
                        ],
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: noBorders,
                    }),
                );
            }

            if (headerFields.showDate) {
                fieldCells.push(
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: 'Datum: __________',
                                        font: FONT_FAMILY,
                                        size: 10 * 2,
                                        color: '64748B',
                                    }),
                                ],
                            }),
                        ],
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        borders: noBorders,
                    }),
                );
            }

            if (headerFields.showClass) {
                fieldCells.push(
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: 'Klasse: ________',
                                        font: FONT_FAMILY,
                                        size: 10 * 2,
                                        color: '64748B',
                                    }),
                                ],
                            }),
                        ],
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        borders: noBorders,
                    }),
                );
            }

            if (fieldCells.length > 0) {
                const fieldsTable = new Table({
                    rows: [
                        new TableRow({ children: fieldCells }),
                    ],
                    width: { size: 100, type: WidthType.PERCENTAGE },
                });
                elements.push(fieldsTable);
                elements.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
            }
        }
    } catch (headerErr) {
        console.warn('[docxExport] Header construction failed, exporting without header:', headerErr);
        return [];
    }

    return elements;
}

// ── Task Renderers ───────────────────────────────────────────

/**
 * Renders a Multiple-Choice task as Word paragraphs.
 * Teacher mode: ✅ green for correct, ☐ for incorrect
 * Student mode: ☐ empty checkbox for all
 */
function renderMultipleChoice(task: MultipleChoiceTask, isTeacherMode: boolean): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    // Question
    if (task.question && task.question.trim()) {
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: task.question,
                        font: FONT_FAMILY,
                        size: FONT_SIZE_PT * 2, // half-points
                        bold: true,
                    }),
                ],
                spacing: { after: 120 },
            }),
        );
    }

    // Options
    for (const option of task.options) {
        if (isTeacherMode && option.isCorrect) {
            // Teacher mode: green checkmark for correct answers
            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: '☑ ',
                            font: FONT_FAMILY,
                            size: FONT_SIZE_PT * 2,
                            color: '16A34A', // green-600
                            bold: true,
                        }),
                        new TextRun({
                            text: option.text,
                            font: FONT_FAMILY,
                            size: FONT_SIZE_PT * 2,
                            color: '16A34A',
                            bold: true,
                        }),
                    ],
                    spacing: { after: 60 },
                }),
            );
        } else {
            // Student mode or incorrect answer: empty checkbox
            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: '☐ ',
                            font: FONT_FAMILY,
                            size: FONT_SIZE_PT * 2,
                        }),
                        new TextRun({
                            text: option.text,
                            font: FONT_FAMILY,
                            size: FONT_SIZE_PT * 2,
                        }),
                    ],
                    spacing: { after: 60 },
                }),
            );
        }
    }

    return paragraphs;
}

/**
 * Renders a Lineatur task as an embedded high-res PNG image.
 */
async function renderLineatur(task: LineaturTask): Promise<Paragraph[]> {
    // Calculate height from lineRows (fallback to 80mm for legacy tasks)
    const rows = task.lineRows ?? 4;
    const rowHeight = getRowHeightMM(task.lineStyle);
    const heightMM = rows * rowHeight;

    const imageData = await renderLineBlockToImage(task);
    const widthEmu = mmToEmu(A4_INNER_WIDTH_MM);
    const heightEmu = mmToEmu(heightMM);

    return [
        new Paragraph({
            children: [
                new ImageRun({
                    data: imageData,
                    transformation: {
                        width: widthEmu,
                        height: heightEmu,
                    },
                    type: 'png',
                }),
            ],
            spacing: { after: 120 },
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
                        color: '9CA3AF',
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
                        color: '16A34A',
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
                        color: '94A3B8',
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
            spacing: { after: 120 },
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
                        color: '9CA3AF',
                        italics: true,
                    }),
                ],
            }),
        ];
    }

    const blob = await convertMathToImage(task.content);
    const arrayBuffer = await blobToArrayBuffer(blob);

    // Use a reasonable size for the formula image in the document
    const widthEmu = mmToEmu(A4_INNER_WIDTH_MM * 0.7); // ~70% of page width
    const heightEmu = mmToEmu(20); // ~20mm height for a typical formula

    return [
        new Paragraph({
            children: [
                new ImageRun({
                    data: arrayBuffer,
                    transformation: {
                        width: widthEmu,
                        height: heightEmu,
                    },
                    type: 'png',
                }),
            ],
            spacing: { after: 120 },
        }),
    ];
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
    // ── Pre-export validation ──
    const warnings = validateForExport(tasksById, taskIds);
    if (warnings.length > 0) {
        const proceed = window.confirm(
            formatWarnings(warnings) + '\n\nTrotzdem exportieren?',
        );
        if (!proceed) return;
    }

    try {
        // ── Build header (with error-handling) ──
        let headerElements: (Paragraph | Table)[] = [];
        try {
            headerElements = await buildHeaderSection();
        } catch (headerErr) {
            console.warn('[docxExport] Header failed, exporting without:', headerErr);
        }

        // ── Build paragraphs for each task ──
        const allChildren: (Paragraph | Table)[] = [...headerElements];

        // Document title
        allChildren.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: title,
                        font: FONT_FAMILY,
                        size: HEADING_SIZE_PT * 2,
                        bold: true,
                    }),
                ],
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 200 },
                border: {
                    bottom: {
                        color: 'E2E8F0',
                        style: BorderStyle.SINGLE,
                        size: 1,
                        space: 4,
                    },
                },
            }),
        );

        // Mode indicator for teacher version
        if (isTeacherMode) {
            allChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: '📋 Lehrer-Version (mit Lösungen)',
                            font: FONT_FAMILY,
                            size: 9 * 2,
                            color: '16A34A',
                            italics: true,
                        }),
                    ],
                    spacing: { after: 200 },
                }),
            );
        }

        // ── Task loop – discriminated union switch ──
        for (let i = 0; i < taskIds.length; i++) {
            const task = tasksById[taskIds[i]];
            if (!task) continue;

            // Task number header
            allChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Aufgabe ${i + 1}`,
                            font: FONT_FAMILY,
                            size: FONT_SIZE_PT * 2,
                            bold: true,
                            color: '3B82F6',
                        }),
                    ],
                    spacing: { before: 240, after: 80 },
                }),
            );

            // Render based on discriminated union type
            switch (task.type) {
                case 'multiple-choice':
                    allChildren.push(...renderMultipleChoice(task, isTeacherMode));
                    break;

                case 'lineatur':
                    allChildren.push(...(await renderLineatur(task)));
                    break;

                case 'cloze':
                    allChildren.push(...renderCloze(task, isTeacherMode));
                    break;

                case 'math':
                    allChildren.push(...(await renderMath(task)));
                    break;

                default:
                    // Exhaustive check – TypeScript will error if a case is missed
                    allChildren.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `(Unbekannter Aufgabentyp)`,
                                    font: FONT_FAMILY,
                                    size: FONT_SIZE_PT * 2,
                                    color: 'EF4444',
                                    italics: true,
                                }),
                            ],
                        }),
                    );
            }
        }

        // ── Create document ──
        const doc = new Document({
            sections: [
                {
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
                },
            ],
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
