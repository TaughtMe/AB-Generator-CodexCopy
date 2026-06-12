import {
    AlignmentType,
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
import DOMPurify from 'dompurify';
import type { TableTask } from '../../../types/worksheet';
import { htmlToDocxParagraphs } from '../htmlToDocx';
import type { BorderStyleValue, DocxAlignment, TaskRendererConfig } from './shared';

/* ── CSS-Helper für Tabellen-Zellen ── */

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

/* ── HTML-Tabellen-Layout (colspan/rowspan-fähig) ── */

interface HtmlTableCellLayout {
    element: Element;
    colIndex: number;
    colSpan: number;
    rowSpan: number;
}

interface HtmlTableLayout {
    rows: HtmlTableCellLayout[][];
    colCount: number;
    colPixelWidths: number[];
}

function readPositiveSpan(cell: Element, attribute: 'colspan' | 'rowspan'): number {
    const parsed = parseInt(cell.getAttribute(attribute) ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function readPositiveColWidth(cell: Element): number {
    const colwidth = cell.getAttribute('colwidth');
    if (colwidth) {
        const firstWidth = colwidth
            .split(',')
            .map((part) => parseInt(part.trim(), 10))
            .find((width) => Number.isFinite(width) && width > 0);
        if (firstWidth) return firstWidth;
    }

    const styleWidth = readCellStyleValue(cell, 'width');
    const widthMatch = styleWidth ? /(\d+(?:\.\d+)?)\s*px/i.exec(styleWidth) : null;
    return widthMatch ? parseFloat(widthMatch[1]) : 0;
}

function buildHtmlTableLayout(tableRows: Element[]): HtmlTableLayout {
    const occupied = new Map<number, number>();
    const rows: HtmlTableCellLayout[][] = [];
    const colPixelWidths: number[] = [];
    let colCount = 0;

    tableRows.forEach((rowElement, rowIndex) => {
        const rowCells: HtmlTableCellLayout[] = [];
        let colIndex = 0;

        const cells = Array.from(rowElement.querySelectorAll('th,td'));
        cells.forEach((cell) => {
            while ((occupied.get(colIndex) ?? 0) > rowIndex) {
                colIndex += 1;
            }

            const colSpan = readPositiveSpan(cell, 'colspan');
            const rowSpan = readPositiveSpan(cell, 'rowspan');
            rowCells.push({ element: cell, colIndex, colSpan, rowSpan });

            const rawWidth = readPositiveColWidth(cell);
            if (rawWidth > 0) {
                const distributedWidth = rawWidth / colSpan;
                for (let spanIndex = 0; spanIndex < colSpan; spanIndex += 1) {
                    colPixelWidths[colIndex + spanIndex] = Math.max(
                        colPixelWidths[colIndex + spanIndex] ?? 0,
                        distributedWidth,
                    );
                }
            }

            if (rowSpan > 1) {
                for (let spanIndex = 0; spanIndex < colSpan; spanIndex += 1) {
                    occupied.set(colIndex + spanIndex, rowIndex + rowSpan);
                }
            }

            colIndex += colSpan;
        });

        colCount = Math.max(colCount, colIndex);
        rows.push(rowCells);
    });

    return {
        rows,
        colCount: Math.max(1, colCount),
        colPixelWidths,
    };
}

export function renderTableTask(
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
                                : [new Paragraph({ children: [], spacing: { before: 0, after: 0 } })],
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
    const tableLayout = buildHtmlTableLayout(tableRows);
    const colCount = tableLayout.colCount;
    const columnBaseWidth = Math.floor(config.a4InnerWidthDxa / colCount);

    // ── Spaltenbreiten aus colwidth/style-width lesen ──
    const cellPixelWidths = tableLayout.colPixelWidths;
    const hasCustomWidths = cellPixelWidths.some((w) => w > 0);
    const totalPixelWidth = cellPixelWidths.reduce((s, w) => s + (w || 0), 0) || 1;
    const resolveColumnWidth = (colIndex: number): number => {
        if (hasCustomWidths && cellPixelWidths[colIndex] > 0) {
            return Math.round((cellPixelWidths[colIndex] / totalPixelWidth) * config.a4InnerWidthDxa);
        }

        return colIndex === colCount - 1
            ? config.a4InnerWidthDxa - columnBaseWidth * (colCount - 1)
            : columnBaseWidth;
    };

    const docxRows = tableLayout.rows.map((layoutRow) => {
        const rowCells = layoutRow.map((layoutCell) => {
            const cell = layoutCell.element;
            const isHeaderCell = cell.tagName.toLowerCase() === 'th';
            const cellHtml = DOMPurify.sanitize(cell.innerHTML?.trim() ?? '');
            const cellAlignment = parseCellAlignment(cell);
            const cellParagraphs = cellHtml
                ? htmlToDocxParagraphs(cellHtml, {
                    fontFamily: config.fontFamily,
                    fontSizePt: config.fontSizePt,
                    color: config.docxTheme.text,
                    bold: isHeaderCell || undefined,
                }, 40, { defaultAlignment: cellAlignment })
                : [];

            const colWidth = Array.from({ length: layoutCell.colSpan }, (_, spanIndex) => (
                resolveColumnWidth(layoutCell.colIndex + spanIndex)
            )).reduce((sum, width) => sum + width, 0);

            // Tiptap background-color und border-top/right/bottom/left auslesen
            const cellDocxStyle = parseCellStyle(cell);

            // Standard-Hintergrund für Header-Zellen anwenden (wie im Editor-CSS)
            if (isHeaderCell && !cellDocxStyle.shading) {
                cellDocxStyle.shading = { fill: DEFAULT_HEADER_BG, type: ShadingType.CLEAR };
            }

            return new TableCell({
                children: cellParagraphs.length > 0
                    ? cellParagraphs
                    : [new Paragraph({ children: [], spacing: { before: 0, after: 0 } })],
                width: { size: colWidth, type: WidthType.DXA },
                columnSpan: layoutCell.colSpan > 1 ? layoutCell.colSpan : undefined,
                rowSpan: layoutCell.rowSpan > 1 ? layoutCell.rowSpan : undefined,
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
