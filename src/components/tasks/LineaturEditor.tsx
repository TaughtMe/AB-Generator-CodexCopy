import React from 'react';
import type { LineaturTask } from '../../types/worksheet';
import type { LineStyle } from '../../types/worksheet';
import { useWorksheetStore } from '../../store/worksheetStore';
import { getLineaturBackground, getRowHeightMM, LINE_STYLE_LABELS } from '../../utils/lineaturStyles';

interface LineaturEditorProps {
    task: LineaturTask;
}

export const LineaturEditor: React.FC<LineaturEditorProps> = ({ task }) => {
    const updateTask = useWorksheetStore((s) => s.updateTask);

    // Fallback for legacy tasks without lineRows
    const lineRows = task.lineRows ?? 4;

    const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateTask(task.id, { lineStyle: e.target.value as LineStyle });
    };

    const handleRowsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rows = Math.max(1, Math.min(20, Number(e.target.value)));
        updateTask(task.id, { lineRows: rows });
    };

    // Calculate preview height based on rows × row height
    const rowHeightMM = getRowHeightMM(task.lineStyle);
    // Convert mm to approximate px for preview (96 DPI screen: 1mm ≈ 3.78px)
    const previewHeightPx = Math.max(20, lineRows * rowHeightMM * 3.78);

    return (
        <div className="space-y-3">
            {/* Compact Controls – no-print so they don't show on paper */}
            <div className="flex items-center gap-3 no-print flex-wrap">
                {/* Style Selector */}
                <label className="text-xs text-worksheet-inkLight uppercase tracking-wider shrink-0">
                    Linienart
                </label>
                <select
                    value={task.lineStyle}
                    onChange={handleStyleChange}
                    className="flex-1 min-w-0 px-2 py-1 rounded-md border border-worksheet-border bg-worksheet-field text-worksheet-ink text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow cursor-pointer"
                >
                    {(Object.entries(LINE_STYLE_LABELS) as [LineStyle, string][]).map(
                        ([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        )
                    )}
                </select>

                {/* Row Count Slider */}
                <div className="flex items-center gap-2 shrink-0">
                    <label className="text-xs text-worksheet-inkLight uppercase tracking-wider">
                        Zeilen
                    </label>
                    <input
                        type="range"
                        min={1}
                        max={20}
                        value={lineRows}
                        onChange={handleRowsChange}
                        className="w-20 h-1 bg-worksheet-border rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-xs font-bold text-blue-600 tabular-nums w-5 text-right">
                        {lineRows}
                    </span>
                </div>

                {/* Read-only info */}
                <span className="text-[10px] text-worksheet-inkLight tabular-nums shrink-0">
                    {task.gridColumns > 1 ? `${task.gridColumns} Sp.` : 'Vollbreite'}
                </span>
            </div>

            {/* Live Lineatur Preview – this IS the content that prints */}
            <div
                className="rounded border border-worksheet-border overflow-hidden print:border-none"
                style={{
                    ...getLineaturBackground(task.lineStyle),
                    height: `${previewHeightPx}px`,
                }}
            />
        </div>
    );
};
