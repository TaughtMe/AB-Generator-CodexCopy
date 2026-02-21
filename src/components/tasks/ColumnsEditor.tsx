import React, { useState, useRef, useEffect } from 'react';
import { Columns, Plus, X, ArrowLeftRight } from 'lucide-react';
import type { ColumnsTask, ColumnsLayout, TaskType } from '../../types/worksheet';
import { useWorksheetStore } from '../../store/worksheetStore';
import { TaskEditorRenderer } from './TaskRegistry';

/* ──────────────────────────────────────────────────
   ColumnsEditor – Zweispaltiges Layout (MVP)
   Statisches Slotting: Jeder Slot kann eine neue
   Aufgabe halten oder eine bestehende aufnehmen.
   ────────────────────────────────────────────────── */

/** Task type options for creating a new child inside a slot */
const SLOT_TASK_OPTIONS: { type: TaskType; label: string }[] = [
    { type: 'lineatur', label: 'Lineatur' },
    { type: 'multiple-choice', label: 'Multiple Choice' },
    { type: 'cloze', label: 'Lückentext' },
    { type: 'image-placeholder', label: 'Bild-Platzhalter' },
    { type: 'math', label: 'Mathematik' },
];

const LAYOUT_OPTIONS: { value: ColumnsLayout; label: string }[] = [
    { value: '50-50', label: '50 / 50' },
    { value: '60-40', label: '60 / 40' },
    { value: '40-60', label: '40 / 60' },
];

function layoutToGridCols(layout: ColumnsLayout): string {
    switch (layout) {
        case '50-50': return '1fr 1fr';
        case '60-40': return '3fr 2fr';
        case '40-60': return '2fr 3fr';
    }
}

interface ColumnsEditorProps {
    task: ColumnsTask;
}

export const ColumnsEditor: React.FC<ColumnsEditorProps> = ({ task }) => {
    const tasksById = useWorksheetStore((state) => state.tasksById);
    const updateTask = useWorksheetStore((state) => state.updateTask);
    const assignToColumn = useWorksheetStore((state) => state.assignToColumn);
    const detachFromColumn = useWorksheetStore((state) => state.detachFromColumn);
    const addTask = useWorksheetStore((state) => state.addTask);
    const [openSlot, setOpenSlot] = useState<0 | 1 | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenSlot(null);
            }
        };
        if (openSlot !== null) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [openSlot]);

    const handleLayoutChange = (layout: ColumnsLayout) => {
        updateTask(task.id, { layout } as Partial<ColumnsTask>);
    };

    const handleSwapColumns = () => {
        const swapped: [string | null, string | null] = [task.children[1], task.children[0]];
        updateTask(task.id, { children: swapped } as Partial<ColumnsTask>);
    };

    /** Creates a new task and assigns it directly to the given slot */
    const handleCreateInSlot = (slotIndex: 0 | 1, type: TaskType) => {
        // Create the task first (added at end of root list)
        const store = useWorksheetStore.getState();
        const prevIds = store.taskIds;
        addTask(type);
        const newStore = useWorksheetStore.getState();
        const newId = newStore.taskIds.find((id) => !prevIds.includes(id));
        if (newId) {
            assignToColumn(task.id, slotIndex, newId);
        }
        setOpenSlot(null);
    };

    const renderSlot = (slotIndex: 0 | 1) => {
        const childId = task.children[slotIndex];
        const childTask = childId ? tasksById[childId] : null;

        if (childTask) {
            return (
                <div className="columns-task__col relative group/slot">
                    {/* Detach button */}
                    <button
                        onClick={() => detachFromColumn(task.id, slotIndex)}
                        className="no-print absolute top-1 right-1 z-10 p-0.5 rounded bg-red-50 text-red-400 hover:text-red-600 opacity-0 group-hover/slot:opacity-100 transition-opacity cursor-pointer"
                        title="Aus Spalte entfernen"
                    >
                        <X size={12} />
                    </button>
                    <TaskEditorRenderer task={childTask} />
                </div>
            );
        }

        // Empty slot
        return (
            <div className="columns-task__col columns-task__col--empty relative">
                <div className="flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-worksheet-border rounded-lg min-h-[80px] bg-worksheet-field print:bg-transparent print:border-none">
                    <p className="text-[10px] text-worksheet-inkLight">
                        Spalte {slotIndex + 1} – leer
                    </p>
                    <div className="no-print relative" ref={openSlot === slotIndex ? menuRef : undefined}>
                        <button
                            onClick={() => setOpenSlot(openSlot === slotIndex ? null : slotIndex)}
                            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
                        >
                            <Plus size={12} />
                            Aufgabe einfügen
                        </button>
                        {openSlot === slotIndex && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-worksheet-paper text-worksheet-ink border border-worksheet-border rounded-md shadow-xl py-1 z-50">
                                {SLOT_TASK_OPTIONS.map(({ type, label }) => (
                                    <button
                                        key={type}
                                        onClick={() => handleCreateInSlot(slotIndex, type)}
                                        className="w-full text-left px-3 py-2 text-[12px] text-worksheet-ink hover:bg-slate-100 cursor-pointer transition-colors"
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="columns-task">
            {/* Controls (hidden in print) */}
            <div className="no-print flex items-center gap-2 mb-2">
                <Columns size={14} className="text-worksheet-inkLight" />
                <span className="text-[10px] font-medium text-worksheet-inkLight uppercase tracking-wider">
                    Zweispaltig
                </span>

                {/* Layout selector */}
                <select
                    value={task.layout}
                    onChange={(e) => handleLayoutChange(e.target.value as ColumnsLayout)}
                    className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-worksheet-border bg-worksheet-field text-worksheet-ink cursor-pointer"
                >
                    {LAYOUT_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value} className="bg-worksheet-paper text-worksheet-ink">{label}</option>
                    ))}
                </select>

                {/* Swap button */}
                <button
                    onClick={handleSwapColumns}
                    className="p-1 rounded text-worksheet-inkLight hover:text-worksheet-ink hover:bg-worksheet-field transition-colors cursor-pointer"
                    title="Spalten tauschen"
                >
                    <ArrowLeftRight size={12} />
                </button>
            </div>

            {/* Two-column grid */}
            <div
                className="columns-task__grid"
                style={{ gridTemplateColumns: layoutToGridCols(task.layout), columnGap: `${task.gapMm}mm` }}
            >
                {renderSlot(0)}
                {renderSlot(1)}
            </div>
        </div>
    );
};
