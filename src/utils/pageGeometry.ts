/* ══════════════════════════════════════════════════
   pageGeometry – Zentrale A4-Seitengeometrie.

   Bündelt die bisher in MultiPageContainer hartcodierten Maße
   (MM→PX, A4-Höhe/-Breite, Ränder, nutzbare Content-Höhe) an EINER
   Stelle. Reiner Refactor – die Zahlenwerte sind identisch zu vorher.

   Grundlage für spätere echte Seitenboxen und (noch später) ein
   PageFormat-Datenmodell (A5, Querformat, Spalten). Bewusst noch OHNE
   Format-Parameter: aktuell nur A4 Hochformat mit 20-mm-Rändern.
   ══════════════════════════════════════════════════ */

/** Umrechnung mm → px bei 96 DPI (~3.7795). */
export const MM_TO_PX = 96 / 25.4;

/** A4 Hochformat in mm. */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/** Symmetrischer Seitenrand in mm (entspricht @page margin im Druck). */
export const PAGE_MARGIN_MM = 20;

export interface PageGeometry {
    /** Seitenmaße inkl. Rand. */
    pageWidthMm: number;
    pageHeightMm: number;
    /** Seitenrand (alle Seiten gleich). */
    marginMm: number;
    /** Nutzbare Inhaltsfläche (Seite minus 2× Rand). */
    contentWidthMm: number;
    contentHeightMm: number;
    /** Nutzbare Inhaltshöhe in px – Schwelle für die Seitenumbruch-Berechnung. */
    contentHeightPx: number;
    /** Seitenmaße in px. */
    pageWidthPx: number;
    pageHeightPx: number;
}

/**
 * Liefert die aktuelle Seitengeometrie (derzeit fix A4 Hochformat).
 * Spätere Erweiterung: optionaler PageFormat-Parameter (A5/landscape).
 */
export function getPageGeometry(): PageGeometry {
    const marginMm = PAGE_MARGIN_MM;
    const pageWidthMm = A4_WIDTH_MM;
    const pageHeightMm = A4_HEIGHT_MM;
    const contentWidthMm = pageWidthMm - marginMm * 2;
    const contentHeightMm = pageHeightMm - marginMm * 2;

    return {
        pageWidthMm,
        pageHeightMm,
        marginMm,
        contentWidthMm,
        contentHeightMm,
        contentHeightPx: contentHeightMm * MM_TO_PX,
        pageWidthPx: pageWidthMm * MM_TO_PX,
        pageHeightPx: pageHeightMm * MM_TO_PX,
    };
}
