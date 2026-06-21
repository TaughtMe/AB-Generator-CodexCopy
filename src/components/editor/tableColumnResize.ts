import { TableMap } from '@tiptap/pm/tables';
import type { Editor } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/* ══════════════════════════════════════════════════
   tableColumnResize – prozentbasierte Spaltenbreiten.

   ProseMirrors eigenes (px-)Resizing ist über die nativen Handles weiterhin
   aktiv (resizable:true wird für den FitTableView-NodeView gebraucht), wird im
   Editor aber per CSS ausgeblendet. Stattdessen setzen eigene Griffe die
   Spaltenbreiten über das native colwidth-Attribut per ProseMirror-Transaktion
   (kein externer DOM-Eingriff → kein Kampf mit ProseMirrors DOM-Observer).
   FitTableView rendert die colwidth-Werte als Prozent → die Tabelle bleibt
   immer auf 100 % der Seitenbreite.

   Werte werden als Prozent geführt; im colwidth-Attribut als ganzzahlige
   Pseudo-Pixel (Prozent × 10) gespeichert – nur die Verhältnisse zählen,
   FitTableView normalisiert auf 100 %.
   ══════════════════════════════════════════════════ */

export const MIN_COL_PERCENT = 8;

function findTable(editor: Editor): { node: ProseMirrorNode; pos: number } | null {
    const { state } = editor;
    let result: { node: ProseMirrorNode; pos: number } | null = null;
    state.doc.descendants((node, pos) => {
        if (result) return false;
        if (node.type.name === 'table') {
            result = { node, pos };
            return false;
        }
        return true;
    });
    return result;
}

/** Aktuelle Spaltenbreiten in Prozent (Summe = 100). Gleichverteilt, falls keine gesetzt sind. */
export function getColumnPercents(editor: Editor): number[] {
    const table = findTable(editor);
    if (!table) return [];
    const map = TableMap.get(table.node);
    const cols = map.width;
    const widths = new Array(cols).fill(0) as number[];
    const firstRow = table.node.firstChild;
    if (firstRow) {
        let c = 0;
        firstRow.forEach((cell) => {
            const span = (cell.attrs.colspan as number) || 1;
            const colwidth = cell.attrs.colwidth as number[] | null;
            for (let i = 0; i < span && c < cols; i += 1, c += 1) {
                widths[c] = colwidth && colwidth[i] ? colwidth[i] : 0;
            }
        });
    }
    const total = widths.reduce((sum, w) => sum + w, 0);
    if (total <= 0) return new Array(cols).fill(100 / cols);
    return widths.map((w) => (w > 0 ? (w / total) * 100 : 0));
}

/** Setzt alle Spaltenbreiten (colwidth) gemäß der Prozentwerte per Transaktion. */
export function setColumnPercents(editor: Editor, percents: number[], addToHistory = true): void {
    const table = findTable(editor);
    if (!table) return;
    const map = TableMap.get(table.node);
    const cols = map.width;
    if (percents.length !== cols) return;
    const units = percents.map((p) => Math.max(1, Math.round(p * 10)));

    let tr = editor.state.tr;
    const tableStart = table.pos + 1;
    table.node.forEach((row, rowOffset) => {
        const rowStart = tableStart + rowOffset; // Position des row-Nodes
        let c = 0;
        row.forEach((cell, cellOffset) => {
            const span = (cell.attrs.colspan as number) || 1;
            const colwidth: number[] = [];
            for (let i = 0; i < span; i += 1) {
                colwidth.push(units[Math.min(c + i, cols - 1)]);
            }
            const cellPos = rowStart + 1 + cellOffset; // Position der Zelle
            tr = tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, colwidth });
            c += span;
        });
    });
    if (!addToHistory) tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
}

/** Verschiebt die Grenze zwischen Spalte index und index+1 (Word-Verhalten: nur die
 *  beiden Nachbarspalten ändern sich, die Summe bleibt konstant; min. MIN_COL_PERCENT). */
export function redistribute(percents: number[], index: number, deltaPercent: number): number[] {
    if (index < 0 || index >= percents.length - 1) return percents;
    const next = [...percents];
    const pair = next[index] + next[index + 1];
    let left = next[index] + deltaPercent;
    left = Math.max(MIN_COL_PERCENT, Math.min(pair - MIN_COL_PERCENT, left));
    next[index] = left;
    next[index + 1] = pair - left;
    return next;
}

/** Bringt ein Prozent-Array auf columnCount Spalten (fehlende gleichverteilt) und skaliert auf 100. */
export function normalizePercents(percents: number[], columnCount: number): number[] {
    if (columnCount <= 0) return [];
    const arr = percents.slice(0, columnCount);
    while (arr.length < columnCount) arr.push(0);
    const total = arr.reduce((sum, p) => sum + p, 0);
    if (total <= 0) return new Array(columnCount).fill(100 / columnCount);
    return arr.map((p) => (p / total) * 100);
}
