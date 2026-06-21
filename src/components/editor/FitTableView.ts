import { TableView } from '@tiptap/extension-table';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/* ══════════════════════════════════════════════════
   FitTableView – Tabellen-NodeView, der Spaltenbreiten als PROZENT rendert.

   Problem: ProseMirror setzt Spaltenbreiten in px. Bei table-layout:fixed
   wächst die Tabelle dadurch über den Container/die Seite hinaus (im Druck
   abgeschnitten, im Editor Scrollbalken).

   Lösung: Nach jedem Update werden die px-Breiten der <col>-Elemente in
   prozentuale Anteile (Summe = 100 %) umgerechnet. Mit width:100% bleibt
   die Tabelle damit IMMER exakt auf Container-/Seitenbreite; beim Ziehen
   eines Trenners geben die übrigen Spalten proportional mit (Word-Stil).

   Die gespeicherten colwidth-Attribute bleiben px (Verhältnisse bleiben
   erhalten) – nur die Darstellung ist prozentual.
   ══════════════════════════════════════════════════ */

function colgroupToPercent(colgroup: HTMLTableColElement, table: HTMLTableElement): void {
    const cols = Array.from(colgroup.children) as HTMLElement[];
    if (cols.length === 0) return;

    const widths = cols.map((col) => Number.parseFloat(col.style.width) || 0);
    const total = widths.reduce((sum, w) => sum + w, 0);
    // Frische Tabelle ohne gesetzte Breiten → gleichmäßige Auto-Spalten belassen.
    if (total <= 0) return;

    cols.forEach((col, index) => {
        col.style.width = widths[index] > 0
            ? `${((widths[index] / total) * 100).toFixed(4)}%`
            : '';
    });
    table.style.width = '100%';
}

export class FitTableView extends TableView {
    constructor(node: ProseMirrorNode, cellMinWidth: number) {
        super(node, cellMinWidth);
        colgroupToPercent(this.colgroup, this.table);
    }

    update(node: ProseMirrorNode): boolean {
        const updated = super.update(node);
        if (updated) {
            colgroupToPercent(this.colgroup, this.table);
        }
        return updated;
    }
}
