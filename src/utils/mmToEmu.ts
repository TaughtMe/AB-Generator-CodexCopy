/**
 * mmToEmu.ts – Millimeter conversion utilities for docx export
 *
 * IMPORTANT: The docx library's ImageRun expects dimensions in PIXELS,
 * not in EMUs. The library internally converts pixels → EMUs (×9525).
 * Use mmToPx() for ImageRun transformations.
 *
 * mmToEmu() is kept for legacy compatibility but should NOT be used
 * with ImageRun.transformation.
 *
 * 1 inch = 25.4 mm = 914400 EMUs = 96 pixels (at 96 DPI)
 */

/** Converts millimeters to EMUs (NOT for ImageRun – use mmToPx instead) */
export const mmToEmu = (mm: number): number => Math.round(mm * (914400 / 25.4));

/**
 * Converts millimeters to pixels at 96 DPI.
 * Use this for docx ImageRun transformation width/height.
 */
export const mmToPx = (mm: number): number => Math.round(mm * (96 / 25.4));

/** Printable inner width in mm (reexported from lineaturStyles constant) */
export const A4_INNER_WIDTH_MM = 170;
