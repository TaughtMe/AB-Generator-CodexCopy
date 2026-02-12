/**
 * lineBlockToImage.ts – High-resolution Canvas rendering of lineatur blocks.
 *
 * Draws lineatur patterns (grids, lines, primary-4-lines) onto an
 * HTML5 Canvas at 300 DPI so that 170 mm on-screen = 170 mm on paper.
 *
 * Returns the image as a Uint8Array (PNG) for embedding in Word documents.
 */

import type { LineaturTask, LineStyle } from '../types/worksheet';

// ── Constants ────────────────────────────────────────────────

/** Dots per inch for print-quality rendering */
const DPI = 300;

/** Pixels per millimeter at 300 DPI:  300 / 25.4 ≈ 11.811 */
const PX_PER_MM = DPI / 25.4;

/** A4 inner width (210 mm − 2 × 20 mm margins) */
const INNER_WIDTH_MM = 170;

/** Default lineatur height in mm (≈ 8 rows of 10mm) */
const DEFAULT_HEIGHT_MM = 80;

/** Row height per style in mm (must match lineaturStyles.ts) */
function getRowHeightMM(style: LineStyle): number {
    switch (style) {
        case 'grid-5mm': return 5;
        case 'grid-10mm': return 10;
        case 'lines-8mm': return 8;
        case 'primary-4-lines': return 10;
        default: return 8;
    }
}

// ── Color Palette (matches lineaturStyles.ts CSS) ──────────

const LINE_COLOR = 'rgba(0, 0, 0, 0.18)';
const PRIMARY_LINE_COLOR = 'rgba(0, 0, 0, 0.35)';
const HELP_LINE_COLOR = 'rgba(0, 0, 0, 0.12)';

/** Line thickness in mm */
const LINE_THICKNESS_MM = 0.3;
const HELP_LINE_THICKNESS_MM = 0.2;

// ── Cell sizes per style (in mm) ────────────────────────────

function getCellSizeMM(style: LineStyle): { w: number; h: number } {
    switch (style) {
        case 'grid-5mm':
            return { w: 5, h: 5 };
        case 'grid-10mm':
            return { w: 10, h: 10 };
        case 'lines-8mm':
            return { w: INNER_WIDTH_MM, h: 8 };
        case 'primary-4-lines':
            return { w: INNER_WIDTH_MM, h: 10 };
        default:
            return { w: 5, h: 5 };
    }
}

// ── Drawing helpers ─────────────────────────────────────────

function mmToPx(mm: number): number {
    return Math.round(mm * PX_PER_MM);
}

function drawGrid(
    ctx: CanvasRenderingContext2D,
    widthPx: number,
    heightPx: number,
    cellMM: { w: number; h: number },
) {
    const cellW = mmToPx(cellMM.w);
    const cellH = mmToPx(cellMM.h);
    const lineW = mmToPx(LINE_THICKNESS_MM);

    ctx.fillStyle = LINE_COLOR;

    // Vertical lines
    for (let x = 0; x <= widthPx; x += cellW) {
        ctx.fillRect(x, 0, lineW, heightPx);
    }

    // Horizontal lines
    for (let y = 0; y <= heightPx; y += cellH) {
        ctx.fillRect(0, y, widthPx, lineW);
    }
}

function drawLines8mm(
    ctx: CanvasRenderingContext2D,
    widthPx: number,
    heightPx: number,
) {
    const spacingPx = mmToPx(8);
    const lineW = mmToPx(LINE_THICKNESS_MM);

    ctx.fillStyle = PRIMARY_LINE_COLOR;

    for (let y = spacingPx; y <= heightPx; y += spacingPx) {
        ctx.fillRect(0, y - lineW, widthPx, lineW);
    }
}

function drawPrimary4Lines(
    ctx: CanvasRenderingContext2D,
    widthPx: number,
    heightPx: number,
) {
    const groupH = mmToPx(10); // 10mm total per group
    const primaryW = mmToPx(LINE_THICKNESS_MM);
    const helpW = mmToPx(HELP_LINE_THICKNESS_MM);

    // ── Draw light gray midband rectangles first (behind lines) ──
    const midbandTop = mmToPx(2.5);
    const midbandBottom = mmToPx(5);
    const midbandHeight = midbandBottom - midbandTop;
    ctx.fillStyle = '#f1f5f9'; // Light gray – printer-friendly

    for (let groupY = 0; groupY < heightPx; groupY += groupH) {
        const y = groupY + midbandTop;
        if (y > heightPx) break;
        ctx.fillRect(0, y, widthPx, midbandHeight);
    }

    // ── Draw lines on top of midband ──
    const offsets = [
        { mm: 0, color: PRIMARY_LINE_COLOR, w: primaryW },     // Dachzeile
        { mm: 2.5, color: HELP_LINE_COLOR, w: helpW },         // Mittelband
        { mm: 5, color: PRIMARY_LINE_COLOR, w: primaryW },     // Grundlinie
        { mm: 7.5, color: HELP_LINE_COLOR, w: helpW },         // Kellerband
    ];

    for (let groupY = 0; groupY < heightPx; groupY += groupH) {
        for (const line of offsets) {
            const y = groupY + mmToPx(line.mm);
            if (y > heightPx) break;
            ctx.fillStyle = line.color;
            ctx.fillRect(0, y, widthPx, line.w);
        }
    }
}

// ── Public API ──────────────────────────────────────────────

/**
 * Renders a LineaturTask onto a Canvas and returns a PNG as Uint8Array.
 *
 * @param task - The lineatur task to render
 * @param heightMM - Height in mm (default: 80mm)
 * @returns PNG image data as Uint8Array
 */
export async function renderLineBlockToImage(
    task: LineaturTask,
    heightMM?: number,
): Promise<Uint8Array> {
    try {
        // Calculate height from lineRows if available
        const rows = task.lineRows ?? Math.floor(DEFAULT_HEIGHT_MM / getRowHeightMM(task.lineStyle));
        const calculatedHeight = heightMM ?? (rows * getRowHeightMM(task.lineStyle));

        const widthPx = mmToPx(INNER_WIDTH_MM);
        const heightPx = mmToPx(calculatedHeight);

        // Create an offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = widthPx;
        canvas.height = heightPx;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Canvas 2D context not available');
        }

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, widthPx, heightPx);

        // Draw the appropriate pattern
        const cellSize = getCellSizeMM(task.lineStyle);

        switch (task.lineStyle) {
            case 'grid-5mm':
            case 'grid-10mm':
                drawGrid(ctx, widthPx, heightPx, cellSize);
                break;
            case 'lines-8mm':
                drawLines8mm(ctx, widthPx, heightPx);
                break;
            case 'primary-4-lines':
                drawPrimary4Lines(ctx, widthPx, heightPx);
                break;
            default:
                console.warn(`Unknown lineStyle: ${task.lineStyle}, falling back to grid-5mm`);
                drawGrid(ctx, widthPx, heightPx, { w: 5, h: 5 });
        }

        // Convert canvas to PNG blob → Uint8Array
        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (b) => (b ? resolve(b) : reject(new Error('Canvas.toBlob() returned null'))),
                'image/png',
            );
        });

        const arrayBuffer = await blob.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    } catch (error) {
        console.error('[lineBlockToImage] Rendering failed:', error);
        // Return a minimal 1×1 transparent PNG as fallback
        return new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
            0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
            0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
            0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62,
            0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
        ]);
    }
}

/** Re-export constants for external use */
export { INNER_WIDTH_MM, DPI, PX_PER_MM };
