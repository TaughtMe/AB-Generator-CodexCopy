import {
    Paragraph,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
    convertMillimetersToTwip,
} from 'docx';
import type { ColumnsTask, Task } from '../../../types/worksheet';
import type { TaskRendererConfig } from './shared';

/**
 * Dispatcher-Signatur, per Dependency-Injection hereingereicht.
 * Vermeidet den Zirkular-Import columns ↔ taskRenderer: der Dispatcher
 * kennt alle Renderer, die Spalten brauchen ihn nur zum Rendern der Kinder.
 */
export type RenderTaskContentFn = (
    task: Task,
    isTeacherVersion: boolean,
    config: TaskRendererConfig,
) => Promise<(Paragraph | Table)[]>;

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
    renderTaskContent: RenderTaskContentFn,
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

    // Explizite Gap-Zelle zwischen den Spalten statt "virtuell abgezogener" Breite.
    // Word versteht Layout-Tabellen mit festen Spaltenbreiten zuverlässig; der Abstand
    // wird als leere Zelle ohne Rahmen und Inhalt abgebildet.
    const gapCell = new TableCell({
        children: [new Paragraph({ children: [], spacing: { before: 0, after: 0 } })],
        width: { size: COLUMN_GAP_DXA, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
    });

    const leftCell = new TableCell({
        children: leftContent.length > 0
            ? leftContent
            : [new Paragraph({ children: [], spacing: { before: 0, after: 0 } })],
        width: { size: leftWidth, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    const rightCell = new TableCell({
        children: rightContent.length > 0
            ? rightContent
            : [new Paragraph({ children: [], spacing: { before: 0, after: 0 } })],
        width: { size: rightWidth, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
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
