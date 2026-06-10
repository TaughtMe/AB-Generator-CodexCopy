import {
    Packer,
    Paragraph,
    TextRun,
    Table,
    PageBreak,
    convertMillimetersToTwip,
} from 'docx';
import { saveAs } from 'file-saver';
import type { Task, ColumnsTask } from '../../types/worksheet';
import { useSettingsStore } from '../../store/settingsStore';
import { createHeaderTable } from './headerGenerator';
import { renderTaskContent, renderColumnsTask, wrapTaskInGrid } from './taskRenderer';
import { createStyledDocument } from './documentStyles';
import { toDocxFontFamily } from './fontFamily';

/**
 * Orchestrator der modularisierten DOCX-Pipeline.
 *
 * Warum aufgespalten:
 * - `index.ts` enthält nur Ablaufsteuerung (Validation, Task-Loop, SaveAs).
 * - Rendering-Details leben in `taskRenderer.ts`.
 * - Header-Aufbau lebt in `headerGenerator.ts`.
 * - Dokument-Defaults leben in `documentStyles.ts`.
 *
 * So bleiben fachliche Änderungen (z. B. neue Tasktypen) lokal und minimieren
 * Regressionen im Exportpfad.
 */

// 10.5pt matches the editor's rendered body text (Tailwind text-sm = 14px = 10.5pt).
const FONT_SIZE_PT = 10.5;
const HEADING_SIZE_PT = 13;

/** A4-Innenbreite in DXA (Twips) für 170 mm Druckbereich. */
const A4_INNER_WIDTH_DXA = convertMillimetersToTwip(170);
/** Checkbox-Spalte in DXA für Multiple-Choice-Layout (10 mm). */
const CHECKBOX_COL_DXA = convertMillimetersToTwip(10);
/** Feste Zeilenhöhe in DXA für MC-Optionen (8 mm), für ruhigen vertikalen Rhythmus. */
const MC_OPTION_ROW_DXA = convertMillimetersToTwip(8);
/** Abstand zwischen Tasks in DXA (4 mm). */
const TASK_GAP_AFTER = convertMillimetersToTwip(4);
/** Titelzeilenhöhe in DXA innerhalb des Hybrid-Grids (8 mm). */
const TASK_TITLE_ROW_DXA = convertMillimetersToTwip(8);

const DOCX_THEME = {
    taskTitle: '1E293B',
    text: '000000',
    correctAnswer: '16A34A',
    teacherBanner: '16A34A',
    placeholder: '9CA3AF',
    muted: '94A3B8',
    fieldLabel: '64748B',
    error: 'EF4444',
} as const;

const NO_TABLE_BORDERS = {
    top: { style: 'none', size: 0, color: 'FFFFFF' },
    bottom: { style: 'none', size: 0, color: 'FFFFFF' },
    left: { style: 'none', size: 0, color: 'FFFFFF' },
    right: { style: 'none', size: 0, color: 'FFFFFF' },
    insideHorizontal: { style: 'none', size: 0, color: 'FFFFFF' },
    insideVertical: { style: 'none', size: 0, color: 'FFFFFF' },
} as const;

/**
 * Exportiert das aktuelle Arbeitsblatt als DOCX.
 *
 * Vertrag:
 * - Reihenfolge wird ausschließlich aus `taskIds` gelesen.
 * - `page-break` erzeugt echte Word-Seitenumbrüche.
 * - Nummerierung ist zustandsbasiert (`showNumber`) und wird nur für sichtbare
 *   Aufgaben hochgezählt.
 * - Die Renderer erhalten ein einheitliches Config-Objekt, um Layoutdrift
 *   zwischen Tasktypen zu vermeiden.
 */
export async function exportToDocx(
    title: string,
    tasksById: Record<string, Task>,
    taskIds: string[],
    isTeacherVersion: boolean,
): Promise<void> {
    const { fontFamily: userFont, brandColor, applyColorToTasks } = useSettingsStore.getState();
    const fontFamily = toDocxFontFamily(userFont);

    // Validierung passiert zentral VOR dem Aufruf (App → ExportWarningsDialog).
    // Hier bewusst keine zweite window.confirm-Abfrage mehr.

    try {
        const allChildren: (Paragraph | Table)[] = [];

        try {
            const headerParas = await createHeaderTable(title, {
                fontFamily,
                headingSizePt: HEADING_SIZE_PT,
                a4InnerWidthDxa: A4_INNER_WIDTH_DXA,
                noTableBorders: NO_TABLE_BORDERS,
                docxTheme: DOCX_THEME,
            });
            allChildren.push(...headerParas);

            // Fallback: when no design header is configured, show a simple title
            // (matches WorksheetHeader component behaviour in the editor).
            if (headerParas.length === 0) {
                const safeTitle = (title || '').trim() || 'Neues Arbeitsblatt';
                allChildren.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: safeTitle,
                                font: fontFamily,
                                size: HEADING_SIZE_PT * 2,
                                bold: true,
                                color: DOCX_THEME.taskTitle,
                            }),
                        ],
                        spacing: { before: 0, after: convertMillimetersToTwip(4) },
                        border: {
                            bottom: {
                                style: 'single',
                                size: 12,
                                color: 'E2E8F0',
                                space: 4,
                            },
                        },
                    }),
                );
            }
        } catch (headerErr) {
            console.warn('[docxExport] Header failed, exporting without:', headerErr);
        }

        if (isTeacherVersion) {
            allChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: '\uD83D\uDCCB Lehrer-Version (mit Lösungen)',
                            font: fontFamily,
                            size: 9 * 2,
                            color: DOCX_THEME.teacherBanner,
                            italics: true,
                        }),
                    ],
                    spacing: { after: 200 },
                }),
            );
        }

        let taskNumber = 0;
        for (let i = 0; i < taskIds.length; i++) {
            const task = tasksById[taskIds[i]];
            if (!task) continue;

            if (task.type === 'page-break') {
                allChildren.push(
                    new Paragraph({ children: [new PageBreak()] }),
                );
                continue;
            }

            const isNumbered = task.showNumber !== false;
            let currentNumber: number | null = null;
            if (isNumbered) {
                taskNumber++;
                currentNumber = taskNumber;
            }

            if (i > 0 && tasksById[taskIds[i - 1]]?.type !== 'page-break') {
                allChildren.push(
                    new Paragraph({
                        spacing: { before: TASK_GAP_AFTER, after: 0 },
                        children: [],
                    }),
                );
            }

            let taskContent: (Paragraph | Table)[] = [];

            if (task.type === 'columns') {
                taskContent = [await renderColumnsTask(task as ColumnsTask, tasksById, isTeacherVersion, {
                    fontFamily,
                    fontSizePt: FONT_SIZE_PT,
                    taskGapAfter: TASK_GAP_AFTER,
                    taskTitleRowDxa: TASK_TITLE_ROW_DXA,
                    a4InnerWidthDxa: A4_INNER_WIDTH_DXA,
                    checkboxColDxa: CHECKBOX_COL_DXA,
                    mcOptionRowDxa: MC_OPTION_ROW_DXA,
                    noTableBorders: NO_TABLE_BORDERS,
                    docxTheme: DOCX_THEME,
                })];
            } else {
                taskContent = await renderTaskContent(task, isTeacherVersion, {
                    fontFamily,
                    fontSizePt: FONT_SIZE_PT,
                    taskGapAfter: TASK_GAP_AFTER,
                    taskTitleRowDxa: TASK_TITLE_ROW_DXA,
                    a4InnerWidthDxa: A4_INNER_WIDTH_DXA,
                    checkboxColDxa: CHECKBOX_COL_DXA,
                    mcOptionRowDxa: MC_OPTION_ROW_DXA,
                    noTableBorders: NO_TABLE_BORDERS,
                    docxTheme: DOCX_THEME,
                });
            }

            // Per-Task accentColor oder globale brandColor (wenn aktiviert)
            const taskAccentColor = task.accentColor || (applyColorToTasks ? brandColor : undefined);

            allChildren.push(wrapTaskInGrid(task, currentNumber, taskContent, {
                fontFamily,
                fontSizePt: FONT_SIZE_PT,
                taskGapAfter: TASK_GAP_AFTER,
                taskTitleRowDxa: TASK_TITLE_ROW_DXA,
                a4InnerWidthDxa: A4_INNER_WIDTH_DXA,
                checkboxColDxa: CHECKBOX_COL_DXA,
                mcOptionRowDxa: MC_OPTION_ROW_DXA,
                noTableBorders: NO_TABLE_BORDERS,
                docxTheme: DOCX_THEME,
            }, taskAccentColor));
        }

        const doc = createStyledDocument(fontFamily, FONT_SIZE_PT, allChildren);

        const blob = await Packer.toBlob(doc);
        const suffix = isTeacherVersion ? '_Lehrer' : '_Schueler';
        const filename = `${title.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '')}${suffix}.docx`;
        saveAs(blob, filename);
    } catch (error) {
        console.error('[docxExport] Export failed:', error);
        window.alert('Export fehlgeschlagen. Bitte versuche es erneut.\n\n' + String(error));
    }
}
