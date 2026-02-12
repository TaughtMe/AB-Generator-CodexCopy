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
    const helpLineColor = 'rgba(0, 0, 0, 0.12)';

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
            // Grundschul-Lineatur: 4 Linien pro Zeile
            // Dachzeile → Mittelband (2.5mm, grau hinterlegt) → Grundlinie → Kellerband (2.5mm) → Grundlinie
            // Total line height: 10mm (2.5mm + 2.5mm + 2.5mm + 2.5mm gap)
            const lineHeight = '10mm';
            const midbandColor = '#f1f5f9'; // Light gray for Mittelband (Wohnzimmer)
            return {
                backgroundImage: `
                    linear-gradient(to bottom,
                        ${primaryLineColor} 0.3mm,
                        transparent 0.3mm,
                        transparent 2.5mm,
                        ${helpLineColor} calc(2.5mm + 0.2mm),
                        ${midbandColor} calc(2.5mm + 0.2mm),
                        ${midbandColor} 5mm,
                        ${primaryLineColor} calc(5mm + 0.3mm),
                        transparent calc(5mm + 0.3mm),
                        transparent 7.5mm,
                        ${helpLineColor} calc(7.5mm + 0.2mm),
                        transparent calc(7.5mm + 0.2mm)
                    )
                `,
                backgroundSize: `100% ${lineHeight}`,
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
            return 10; // 4 lines at 2.5mm spacing
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
