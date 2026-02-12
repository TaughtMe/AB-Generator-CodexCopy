/**
 * mmToEmu.ts – Millimeter → English Metric Units (EMU) conversion
 *
 * The docx library requires EMUs for all physical dimensions.
 * 1 inch = 25.4 mm = 914400 EMUs
 */

/** Converts millimeters to EMUs */
export const mmToEmu = (mm: number): number => Math.round(mm * (914400 / 25.4));

// ── A4 Page Constants in EMUs ──────────────────────────────

/** Full A4 width (210 mm) */
export const A4_WIDTH_EMU = mmToEmu(210);

/** Full A4 height (297 mm) */
export const A4_HEIGHT_EMU = mmToEmu(297);

/** Page margin (20 mm each side) */
export const PAGE_MARGIN_EMU = mmToEmu(20);

/** Printable inner width (210 - 2×20 = 170 mm) */
export const A4_INNER_WIDTH_EMU = mmToEmu(170);

/** Printable inner width in mm (reexported from lineaturStyles constant) */
export const A4_INNER_WIDTH_MM = 170;
