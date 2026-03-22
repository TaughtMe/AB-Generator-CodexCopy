import type { CSSProperties } from 'react';
import type { LineStyle } from '../types/worksheet';

/** A4 inner width with 20mm margins on each side */
export const A4_INNER_WIDTH_MM = 170;

/**
 * Generates CSS background properties for lineatur rendering.
 * All sizes are in mm for true physical accuracy.
 */
export function getLineaturBackground(lineStyle: LineStyle): CSSProperties {
    const lineColor = 'rgba(0, 0, 0, 0.18)';
    const primaryLineColor = 'rgba(0, 0, 0, 0.35)';

    switch (lineStyle) {
        case 'grid-5mm':
            return {
                backgroundImage: `
                    linear-gradient(to right, ${lineColor} 0.3mm, transparent 0.3mm),
                    linear-gradient(to bottom, ${lineColor} 0.3mm, transparent 0.3mm)
                `,
                backgroundSize: '5mm 5mm',
            };

        case 'grid-10mm':
            return {
                backgroundImage: `
                    linear-gradient(to right, ${lineColor} 0.3mm, transparent 0.3mm),
                    linear-gradient(to bottom, ${lineColor} 0.3mm, transparent 0.3mm)
                `,
                backgroundSize: '10mm 10mm',
            };

        case 'lines-8mm':
            return {
                backgroundImage: `
                    linear-gradient(to bottom, transparent calc(8mm - 0.3mm), ${primaryLineColor} 0.3mm)
                `,
                backgroundSize: '100% 8mm',
            };

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
