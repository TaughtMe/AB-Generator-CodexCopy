import React from 'react';
import type { LineaturTask } from '../../types/worksheet';
import type { LineStyle } from '../../types/worksheet';
import { useWorksheetStore } from '../../store/worksheetStore';
import { getLineaturBackground, getRowHeightMM } from '../../utils/lineaturStyles';

interface LineaturEditorProps {
    task: LineaturTask;
    isActive?: boolean;
}

export const LineaturEditor: React.FC<LineaturEditorProps> = ({ task, isActive = true }) => {
    const updateTask = useWorksheetStore((s) => s.updateTask);

    const rowCount = Math.max(1, Math.min(20, Math.round(task.rowCount ?? task.lineRows ?? 5)));
    const bandHeightMM = 5;
    const gapColor = task.gapColor && task.gapColor.trim().length > 0
        ? task.gapColor
        : '#eaf4e8';
    const lineStyleOptions: Array<{ value: LineStyle; label: string }> = [
        { value: 'primary-4-lines', label: 'Grundschul-Lineatur' },
        { value: 'lines-8mm', label: 'Einfach liniert' },
        { value: 'grid-5mm', label: 'Kästchen 5mm' },
        { value: 'grid-10mm', label: 'Kästchen 10mm' },
    ];

    const handleRowCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rows = Math.max(1, Math.min(20, Number(e.target.value)));
        updateTask(task.id, { rowCount: rows, lineRows: rows });
    };

    const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateTask(task.id, { lineStyle: e.target.value as LineStyle });
    };

    const handleGapColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateTask(task.id, { gapColor: e.target.value });
    };

    return (
        <div className="space-y-3 print:break-inside-avoid print:break-after-auto">
            {isActive && (
                <div className="flex items-center gap-4 no-print flex-wrap">
                    <div className="flex items-center gap-2 shrink-0">
                        <label className="text-xs text-worksheet-inkLight uppercase tracking-wider">
                            Linienart
                        </label>
                        <select
                            value={task.lineStyle}
                            onChange={handleStyleChange}
                            className="min-w-[190px] px-2 py-1 rounded-md border border-worksheet-border bg-worksheet-field text-worksheet-ink text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow cursor-pointer"
                        >
                            {lineStyleOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <label className="text-xs text-worksheet-inkLight uppercase tracking-wider">
                            Zeilen
                        </label>
                        <input
                            type="range"
                            min={1}
                            max={20}
                            value={rowCount}
                            onChange={handleRowCountChange}
                            className="w-20 cursor-pointer accent-blue-500"
                        />
                        <span className="text-xs font-bold text-blue-600 tabular-nums w-5 text-right">
                            {rowCount}
                        </span>
                    </div>

                    {task.lineStyle === 'primary-4-lines' && (
                        <div className="flex items-center gap-2 shrink-0">
                            <label className="text-xs text-worksheet-inkLight uppercase tracking-wider">
                                Abstandsfarbe
                            </label>
                            <input
                                type="color"
                                value={gapColor}
                                onChange={handleGapColorChange}
                                className="h-8 w-10 cursor-pointer rounded border border-worksheet-border bg-white p-1"
                                aria-label="Abstandsfarbe"
                            />
                        </div>
                    )}
                </div>
            )}

            {task.lineStyle === 'primary-4-lines' ? (
                <div
                    className="rounded border border-worksheet-border overflow-hidden print:border-none print:rounded-none"
                >
                    <div
                        className="pt-8 pb-4 px-4 flex flex-col gap-y-6"
                        style={{ backgroundColor: task.gapColor || 'var(--theme-color-light, #eaf4e8)' }}
                    >
                        {Array.from({ length: rowCount }).map((_, blockIndex) => (
                            <div
                                key={`${task.id}-row-${blockIndex}`}
                                className="bg-white border border-slate-500 w-full flex flex-col"
                            >
                                {Array.from({ length: 3 }).map((__, bandIndex) => (
                                    <div
                                        key={`${task.id}-row-${blockIndex}-band-${bandIndex}`}
                                        className={bandIndex < 2 ? 'w-full border-b border-slate-400' : 'w-full'}
                                        style={{ height: `${bandHeightMM}mm` }}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div
                    className="rounded border border-worksheet-border overflow-hidden print:border-none print:rounded-none"
                    style={{
                        ...getLineaturBackground(task.lineStyle),
                        height: `${rowCount * getRowHeightMM(task.lineStyle)}mm`,
                    }}
                />
            )}
        </div>
    );
};
