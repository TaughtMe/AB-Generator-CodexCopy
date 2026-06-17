import {
    HeightRule,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
} from 'docx';
import type {
    ColumnsTask,
    HeadingTask,
    InformationTextTask,
    InstructionTask,
    LineaturTask,
    MathTask,
    Task,
    TableTask,
} from '../../types/worksheet';
import {
    EDITOR_BORDER,
    EDITOR_CARD_BG,
    EDITOR_MUTED,
    editorBorder,
    htmlToPlainText,
    type TaskRendererConfig,
} from './renderers/shared';
import { renderMultipleChoice } from './renderers/multipleChoice';
import { renderCloze } from './renderers/cloze';
import { renderLineatur } from './renderers/lineatur';
import { renderMath } from './renderers/math';
import { renderImagePlaceholder } from './renderers/image';
import { renderInstruction, renderInformation, renderHeading } from './renderers/textBlocks';
import { renderTableTask } from './renderers/table';
import { renderOrdering } from './renderers/ordering';
import { renderMatching } from './renderers/matching';
import { renderColumnsTask as renderColumnsTaskImpl } from './renderers/columns';

/* ══════════════════════════════════════════════════
   taskRenderer.ts – Dispatcher der modularen DOCX-Renderer.

   Architektur:
   - Pro Tasktyp ein Modul unter ./renderers/ (shared.ts hält Config,
     Konstanten und gemeinsame Bausteine).
   - Diese Datei enthält nur noch: den Dispatcher (renderTaskContent),
     den Card-Wrapper (wrapTaskInGrid) und die columns-Bindung.
   - Neuer Tasktyp = neue Renderer-Datei + ein case hier.
   ══════════════════════════════════════════════════ */

export type { TaskRendererConfig, DocxTheme } from './renderers/shared';

export async function renderTaskContent(
    task: Task,
    isTeacherVersion: boolean,
    config: TaskRendererConfig,
): Promise<(Paragraph | Table)[]> {
    switch (task.type) {
        case 'multiple-choice':
            return renderMultipleChoice(task, isTeacherVersion, config);
        case 'lineatur':
            return renderLineatur(task as LineaturTask, config);
        case 'cloze':
            return renderCloze(task, isTeacherVersion, config);
        case 'math':
            return renderMath(task as MathTask, config);
        case 'image-placeholder':
            return await renderImagePlaceholder(task, config);
        case 'instruction':
            return renderInstruction(task as InstructionTask, config);
        case 'information':
            return renderInformation(task as InformationTextTask, config);
        case 'heading':
            return renderHeading(task as HeadingTask, config);
        case 'table':
            return renderTableTask(task as TableTask, config);
        case 'ordering':
            return renderOrdering(task, isTeacherVersion, config);
        case 'matching':
            return renderMatching(task, isTeacherVersion, config);
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

/**
 * Spalten-Renderer mit injiziertem Dispatcher — Signatur bleibt für
 * index.ts unverändert (kein Zirkular-Import nötig).
 */
export async function renderColumnsTask(
    task: ColumnsTask,
    tasksById: Record<string, Task>,
    isTeacherVersion: boolean,
    config: TaskRendererConfig,
): Promise<Table> {
    return renderColumnsTaskImpl(task, tasksById, isTeacherVersion, config, renderTaskContent);
}

export function wrapTaskInGrid(
    task: Task,
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
    // Match PDF export: show number + user title only, no internal type labels.
    // heading tasks render without a card border (just the h3 content directly).
    const isHeading = task.type === 'heading';
    const taskTitle = htmlToPlainText(task.title);
    const titleColor = accentColor
        ? accentColor.replace('#', '')
        : config.docxTheme.taskTitle;
    const outerBorder = isHeading
        ? { style: 'none' as const, size: 0, color: 'FFFFFF' }
        : editorBorder(EDITOR_BORDER, 6);
    const titleCellBorders = {
        top: outerBorder,
        right: outerBorder,
        bottom: isHeading ? outerBorder : editorBorder(EDITOR_BORDER, 6),
        left: outerBorder,
    };

    // Build header text: "1. Neue Aufgabe" (no type label, like PDF/editor)
    const hasHeader = (taskIndex !== null || (Boolean(taskTitle) && !isHeading));
    const titleRuns: TextRun[] = [];
    if (taskIndex !== null) {
        titleRuns.push(new TextRun({
            text: `${taskIndex}. `,
            font: config.fontFamily,
            size: 16,
            bold: true,
            color: titleColor,
        }));
    }
    if (taskTitle && !isHeading) {
        titleRuns.push(new TextRun({
            text: taskTitle,
            font: config.fontFamily,
            size: 16,
            bold: false,
            color: EDITOR_MUTED,
        }));
    }

    const titleRow = new TableRow({
        height: { value: hasHeader ? config.taskTitleRowDxa : 0, rule: hasHeader ? HeightRule.ATLEAST : HeightRule.AUTO },
        children: [
            new TableCell({
                children: [
                    new Paragraph({
                        children: hasHeader ? titleRuns : [],
                        spacing: { before: 0, after: 0 },
                    }),
                ],
                width: { size: config.a4InnerWidthDxa, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                shading: isHeading
                    ? undefined
                    : { fill: EDITOR_CARD_BG, type: ShadingType.CLEAR },
                margins: isHeading
                    ? { top: 0, bottom: 0, left: 0, right: 0 }
                    : { top: 60, right: 120, bottom: 60, left: 120 },
                borders: titleCellBorders,
            }),
        ],
    });

    const contentRow = new TableRow({
        children: [
            new TableCell({
                children: contentElements.length > 0
                    ? contentElements
                    : [new Paragraph({ children: [], spacing: { before: 0, after: 0 } })],
                width: { size: config.a4InnerWidthDxa, type: WidthType.DXA },
                shading: isHeading
                    ? undefined
                    : { fill: EDITOR_CARD_BG, type: ShadingType.CLEAR },
                margins: isHeading
                    ? { top: 0, bottom: 0, left: 0, right: 0 }
                    : { top: 120, right: 120, bottom: 120, left: 120 },
                borders: isHeading
                    ? { top: outerBorder, right: outerBorder, bottom: outerBorder, left: outerBorder }
                    : { top: { style: 'none', size: 0, color: 'FFFFFF' }, right: outerBorder, bottom: outerBorder, left: outerBorder },
            }),
        ],
    });

    return new Table({
        rows: [titleRow, contentRow],
        width: { size: config.a4InnerWidthDxa, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        borders: {
            top: outerBorder,
            right: outerBorder,
            bottom: outerBorder,
            left: outerBorder,
            insideHorizontal: outerBorder,
            insideVertical: outerBorder,
        },
    });
}
