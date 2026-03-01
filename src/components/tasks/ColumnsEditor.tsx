import React, { useState, useRef, useEffect } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Columns, Plus, X, ArrowLeftRight, GripVertical } from 'lucide-react';
import type { ColumnsTask, ColumnsLayout, TaskType, Task } from '../../types/worksheet';
import { useWorksheetStore } from '../../store/worksheetStore';
import { TaskEditorRenderer } from './TaskRegistry';
import { ICON_SIZES } from '../ui/iconSizes';

/* ──────────────────────────────────────────────────
   ColumnsEditor – Zweispaltiges Layout (MVP)
   Statisches Slotting: Jeder Slot kann eine neue
   Aufgabe halten oder eine bestehende aufnehmen.
   ────────────────────────────────────────────────── */

/** Task type options for creating a new child inside a slot */
const SLOT_TASK_OPTIONS: { type: TaskType; label: string }[] = [
    { type: 'heading', label: 'Zwischenüberschrift' },
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
        case '50-50': return 'minmax(0, 1fr) minmax(0, 1fr)';
        case '60-40': return 'minmax(0, 3fr) minmax(0, 2fr)';
        case '40-60': return 'minmax(0, 2fr) minmax(0, 3fr)';
    }
}

function ColumnSlotDropZone({
    columnsId,
    slotIndex,
    hasChild,
    children,
}: {
    columnsId: string;
    slotIndex: 0 | 1;
    hasChild: boolean;
    children: React.ReactNode;
}) {
    const { isOver, setNodeRef } = useDroppable({
        id: `column-slot:${columnsId}:${slotIndex}`,
        data: {
            kind: 'column-slot',
            columnsId,
            slotIndex,
            hasChild,
        },
    });

    return (
        <div
            ref={setNodeRef}
            className={isOver ? 'min-w-0 rounded-lg ring-2 ring-blue-400 ring-offset-1' : 'min-w-0'}
            data-column-slot={slotIndex}
        >
            {children}
        </div>
    );
}

function ColumnChildDragHandle({
    childTask,
    columnsId,
    slotIndex,
    isActive,
}: {
    childTask: Task;
    columnsId: string;
    slotIndex: 0 | 1;
    isActive: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging,
    } = useDraggable({
        id: childTask.id,
        data: {
            kind: 'task',
            taskId: childTask.id,
            sourceContainerId: columnsId,
            sourceSlotIndex: slotIndex,
        },
    });

    return (
        <button
            ref={setNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            style={{
                transform: CSS.Translate.toString(transform),
            }}
            className={`no-print absolute top-1 left-1 z-10 p-0.5 rounded bg-white/90 dark:bg-slate-800/90 text-worksheet-inkLight hover:text-worksheet-ink hover:bg-white dark:hover:bg-slate-700 cursor-grab active:cursor-grabbing shadow-sm border border-slate-200 dark:border-slate-700 transition-opacity ${isActive ? 'opacity-0 group-hover/slot:opacity-100' : 'opacity-0 pointer-events-none'} ${isDragging ? 'opacity-30' : ''}`}
            title="Aufgabe ziehen"
        >
            <GripVertical className={ICON_SIZES[12]} />
        </button>
    );
}

interface ColumnsEditorProps {
    task: ColumnsTask;
    isActive?: boolean;
}

export const ColumnsEditor: React.FC<ColumnsEditorProps> = ({ task, isActive = true }) => {
    const tasksById = useWorksheetStore((state) => state.tasksById);
    const activeTaskId = useWorksheetStore((state) => state.activeTaskId);
    const setActiveTask = useWorksheetStore((state) => state.setActiveTask);
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

    useEffect(() => {
        if (isActive) return;
        setOpenSlot(null);
    }, [isActive]);

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
            const childIsActive = activeTaskId === childTask.id;
            return (
                <ColumnSlotDropZone columnsId={task.id} slotIndex={slotIndex} hasChild>
                    <div
                        className="columns-task__col relative group/slot"
                        onClick={(event) => {
                            event.stopPropagation();
                            setActiveTask(childTask.id);
                        }}
                    >
                        <ColumnChildDragHandle childTask={childTask} columnsId={task.id} slotIndex={slotIndex} isActive={childIsActive} />
                        {/* Detach button */}
                        {childIsActive && (
                            <button
                                onClick={() => detachFromColumn(task.id, slotIndex)}
                                className="no-print absolute top-1 right-1 z-10 p-0.5 rounded bg-red-50 text-red-400 hover:text-red-600 opacity-0 group-hover/slot:opacity-100 transition-opacity cursor-pointer"
                                title="Aus Spalte entfernen"
                            >
                                <X className={ICON_SIZES[12]} />
                            </button>
                        )}
                        <TaskEditorRenderer task={childTask} isActive={childIsActive} />
                    </div>
                </ColumnSlotDropZone>
            );
        }

        // Empty slot
        return (
            <ColumnSlotDropZone columnsId={task.id} slotIndex={slotIndex} hasChild={false}>
                <div className="columns-task__col columns-task__col--empty relative">
                    <div className="flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-worksheet-border rounded-lg min-h-[80px] bg-worksheet-field print:bg-transparent print:border-none">
                        <p className="text-[10px] text-worksheet-inkLight">
                            Spalte {slotIndex + 1} – leer
                        </p>
                        {isActive && (
                            <div className="no-print relative" ref={openSlot === slotIndex ? menuRef : undefined}>
                                <button
                                    onClick={() => setOpenSlot(openSlot === slotIndex ? null : slotIndex)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
                                >
                                    <Plus className={ICON_SIZES[12]} />
                                    Aufgabe einfügen
                                </button>
                                {openSlot === slotIndex && (
                                    <div className="absolute top-full left-1/2 z-50 mt-2 w-48 -translate-x-1/2 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 py-1 text-slate-800 dark:text-slate-100">
                                        {SLOT_TASK_OPTIONS.map(({ type, label }) => (
                                            <button
                                                key={type}
                                                onClick={() => handleCreateInSlot(slotIndex, type)}
                                                className="w-full cursor-pointer px-3 py-2 text-left text-[12px] text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/70"
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </ColumnSlotDropZone>
        );
    };

    return (
        <div className="columns-task">
            {/* Controls (hidden in print) */}
            {isActive && (
                <div className="no-print flex items-center gap-2 mb-2">
                    <Columns className={`${ICON_SIZES[14]} text-worksheet-inkLight`} />
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
                        <ArrowLeftRight className={ICON_SIZES[12]} />
                    </button>
                </div>
            )}

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
