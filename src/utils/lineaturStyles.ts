import type { CSSProperties } from 'react';
import type { LineStyle } from '../types/worksheet';

/** A4 inner width with 20mm margins on each side */
export const A4_INNER_WIDTH_MM = 170;

/**
 * Generates CSS background properties for lineatur rendering.
 * All sizes are in mm for true physical accuracy.
 */
/**
 * Encodes a minimal SVG as a CSS background data URI.
 * SVGs are vector-based and scale reliably at any DPI/zoom (screen + print),
 * unlike CSS gradients with sub-mm measurements which can disappear in print.
 */
function svgUri(svg: string): string {
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function getLineaturBackground(lineStyle: LineStyle): CSSProperties {
    switch (lineStyle) {
        case 'grid-5mm': {
            // SVG tile: 1×1 user units mapped to 5mm×5mm.
            // Lines on top and left edges → tiled into a full grid.
            // stroke-width 0.06 user units = 0.06×5mm = 0.3mm per line.
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="5mm" height="5mm" viewBox="0 0 1 1"><path d="M1 0 L0 0 0 1" fill="none" stroke="rgba(0,0,0,0.22)" stroke-width="0.06"/></svg>`;
            return {
                backgroundImage: svgUri(svg),
                backgroundSize: '5mm 5mm',
                backgroundRepeat: 'repeat',
            };
        }

        case 'grid-10mm': {
            // stroke-width 0.03 user units = 0.03×10mm = 0.3mm per line.
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 1 1"><path d="M1 0 L0 0 0 1" fill="none" stroke="rgba(0,0,0,0.22)" stroke-width="0.03"/></svg>`;
            return {
                backgroundImage: svgUri(svg),
                backgroundSize: '10mm 10mm',
                backgroundRepeat: 'repeat',
            };
        }

        case 'lines-8mm': {
            // Horizontal line at the bottom of each 8mm tile.
            // The SVG is 1×1 user units, stretched to 100%×8mm.
            // A line at y=0.97 with stroke-width=0.04 → 0.04×8mm≈0.32mm line.
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="8mm" viewBox="0 0 1 1" preserveAspectRatio="none"><line x1="0" y1="1" x2="1" y2="1" stroke="rgba(0,0,0,0.38)" stroke-width="0.04"/></svg>`;
            return {
                backgroundImage: svgUri(svg),
                backgroundSize: '100% 8mm',
                backgroundRepeat: 'repeat-y',
            };
        }

        case 'primary-4-lines': {
            // Grundschul-Lineatur: Haus-Metapher mit 4mm/4mm/4mm + 8mm Zeilenabstand
            // 4 Linien bei 0mm, 4mm, 8mm, 12mm; Wiederholung alle 20mm
            // Line thickness 0.3mm for reliable print rendering at any DPI
            const repeatHeight = '20mm';
            const lineThickness = '0.3mm';
            const lineColor = '#94a3b8'; // Slate-400, dezent für Schreibunterlage
            const midbandColor = '#f1f5f9'; // Slate-100

            return {
                backgroundImage: `
                    repeating-linear-gradient(to bottom,
                        ${lineColor} 0,
                        ${lineColor} ${lineThickness},

                        transparent ${lineThickness},
                        transparent 4mm,

                        ${lineColor} 4mm,
                        ${lineColor} calc(4mm + ${lineThickness}),

                        ${midbandColor} calc(4mm + ${lineThickness}),
                        ${midbandColor} 8mm,

                        ${lineColor} 8mm,
                        ${lineColor} calc(8mm + ${lineThickness}),

                        transparent calc(8mm + ${lineThickness}),
                        transparent 12mm,

                        ${lineColor} 12mm,
                        ${lineColor} calc(12mm + ${lineThickness}),

                        transparent calc(12mm + ${lineThickness}),
                        transparent 20mm
                    )
                `,
                backgroundSize: `100% ${repeatHeight}`,
            };
        }

        default:
            return {};
    }
}

/** Returns the height of one row/group in mm for a given line style */
export function getRowHeightMM(lineStyle: LineStyle): number {
    switch (lineStyle) {
        case 'grid-5mm':
            return 5;
        case 'grid-10mm':
            return 10;
        case 'lines-8mm':
            return 8;
        case 'primary-4-lines':
            return 20; // 12mm Schreibblock + 8mm Abstand
        default:
            return 8;
    }
}

/** Calculates grid columns for a given line style based on A4 inner width */
export function getGridColumns(lineStyle: LineStyle): number {
    switch (lineStyle) {
        case 'grid-5mm':
            return Math.floor(A4_INNER_WIDTH_MM / 5);   // 34
        case 'grid-10mm':
            return Math.floor(A4_INNER_WIDTH_MM / 10);  // 17
        case 'lines-8mm':
        case 'primary-4-lines':
            return 1; // Full-width lines, no column concept
        default:
            return 1;
    }
}

/** Human-readable labels for lineStyle options */
export const LINE_STYLE_LABELS: Record<LineStyle, string> = {
    'grid-5mm': 'Kästchen 5mm',
    'grid-10mm': 'Kästchen 10mm',
    'lines-8mm': 'Linien 8mm',
    'primary-4-lines': 'Grundschul-Lineatur',
};
