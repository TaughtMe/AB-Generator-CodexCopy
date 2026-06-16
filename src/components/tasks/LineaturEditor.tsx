import React from 'react';
import { CornerLeftUp } from 'lucide-react';
import type { LineaturTask } from '../../types/worksheet';
import type { LineStyle } from '../../types/worksheet';
import { useWorksheetStore } from '../../store/worksheetStore';
import { LineaturLines } from './LineaturLines';

interface LineaturEditorProps {
    task: LineaturTask;
    isActive?: boolean;
}

export const LineaturEditor: React.FC<LineaturEditorProps> = ({ task, isActive = true }) => {
    const updateTask = useWorksheetStore((s) => s.updateTask);
    const attachLineaturToPrevious = useWorksheetStore((s) => s.attachLineaturToPrevious);
    const canAttachToPrevious = useWorksheetStore((s) => s.canAttachLineaturToPrevious(task.id));

    const rowCount = Math.max(1, Math.min(20, Math.round(task.rowCount ?? task.lineRows ?? 5)));
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
        <div className="space-y-3 print:break-after-auto">
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

                    {canAttachToPrevious && (
                        <button
                            type="button"
                            onClick={() => attachLineaturToPrevious(task.id)}
                            className="ml-auto inline-flex items-center gap-1.5 shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                            title="Diese Schreiblinien als Antwortbereich an die vorherige Aufgabe anhängen"
                        >
                            <CornerLeftUp className="h-3.5 w-3.5" />
                            An vorherige Aufgabe anhängen
                        </button>
                    )}
                </div>
            )}

            <LineaturLines lineStyle={task.lineStyle} rowCount={rowCount} gapColor={task.gapColor} />
        </div>
    );
};
