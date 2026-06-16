import React from 'react';
import type { LineStyle } from '../../types/worksheet';
import { getLineaturBackground, getRowHeightMM } from '../../utils/lineaturStyles';

/* ══════════════════════════════════════════════════
   LineaturLines – reine Darstellung der Schreiblinien/Raster.

   Aus LineaturEditor extrahiert, damit dieselben Linien sowohl als
   eigenständiger Lineatur-Block als auch als „linesAfter"-Schreibbereich
   direkt unter einer Aufgabe (TaskLinesAfter) gerendert werden – eine
   Render-Quelle, kein Drift zwischen Editor und Export.
   ══════════════════════════════════════════════════ */

interface LineaturLinesProps {
    lineStyle: LineStyle;
    /** Anzahl Zeilen/Blöcke (1–20). */
    rowCount: number;
    /** Abstandsfarbe nur für 'primary-4-lines'. */
    gapColor?: string;
}

const BAND_HEIGHT_MM = 5;

export const LineaturLines: React.FC<LineaturLinesProps> = ({ lineStyle, rowCount, gapColor }) => {
    const rows = Math.max(1, Math.min(20, Math.round(rowCount)));

    if (lineStyle === 'primary-4-lines') {
        return (
            <div className="rounded border border-worksheet-border overflow-hidden print:border-none print:rounded-none">
                <div
                    className="pt-8 pb-4 px-4 flex flex-col gap-y-6"
                    style={{ backgroundColor: gapColor || 'var(--theme-color-light, #eaf4e8)' }}
                >
                    {Array.from({ length: rows }).map((_, blockIndex) => (
                        <div
                            key={`row-${blockIndex}`}
                            className="bg-white border border-slate-500 w-full flex flex-col"
                        >
                            {Array.from({ length: 3 }).map((__, bandIndex) => (
                                <div
                                    key={`row-${blockIndex}-band-${bandIndex}`}
                                    className={bandIndex < 2 ? 'w-full border-b border-slate-400' : 'w-full'}
                                    style={{ height: `${BAND_HEIGHT_MM}mm` }}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div
            className="rounded border border-worksheet-border overflow-hidden print:border-none print:rounded-none"
            style={{
                ...getLineaturBackground(lineStyle),
                height: `${rows * getRowHeightMM(lineStyle)}mm`,
            }}
        />
    );
};
