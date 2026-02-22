import React, { useState } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
    GripVertical,
    ListChecks,
    TextCursorInput,
    Sigma,
    FileText,
    Type,
    Columns,
    Scissors,
    Image as ImageIcon,
    X,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { Task, TaskType } from '../../types/worksheet';

/* ══════════════════════════════════════════════════
   OutlineNavigator – Linke Seitenleiste im Editor.
   Zeigt alle Aufgaben als kompakte Liste.
   Per Drag & Drop lassen sich die Aufgaben umsortieren –
   die Sortierung synchronisiert sich live mit dem Canvas.
   ══════════════════════════════════════════════════ */

/** Icon-Map für jeden Task-Typ */
const TASK_ICON: Record<TaskType, React.ElementType> = {
    'multiple-choice': ListChecks,
    'cloze': TextCursorInput,
    'math': Sigma,
    'instruction': FileText,
    'lineatur': Type,
    'columns': Columns,
    'page-break': Scissors,
    'image-placeholder': ImageIcon,
};

/** Lesbare Kurzbezeichnungen */
const TASK_LABEL: Record<TaskType, string> = {
    'multiple-choice': 'Multiple Choice',
    'cloze': 'Lückentext',
    'math': 'Mathematik',
    'instruction': 'Aufgabe',
    'lineatur': 'Lineatur',
    'columns': 'Zweispaltig',
    'page-break': 'Seitenumbruch',
    'image-placeholder': 'Bild',
};

// ── Einzelner Eintrag (sortierbar) ────────────────────────────────────

interface OutlineItemProps {
    id: string;
    task: Task;
    taskNumber: number | null;
    isActive: boolean;
    onScrollTo: (id: string) => void;
}

const OutlineItem: React.FC<OutlineItemProps> = ({ id, task, taskNumber, isActive, onScrollTo }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const Icon = TASK_ICON[task.type] ?? FileText;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={clsx(
                'group flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer select-none',
                isDragging && 'opacity-50 ring-2 ring-blue-400 z-50',
                isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400',
            )}
            onClick={() => onScrollTo(id)}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0"
            >
                <GripVertical size={12} />
            </div>

            {/* Nummer */}
            {taskNumber !== null && (
                <span className="font-bold text-[10px] min-w-[16px] text-center text-slate-500 dark:text-slate-400">
                    {taskNumber}.
                </span>
            )}

            {/* Icon */}
            <Icon size={13} className="shrink-0" />

            {/* Titel (abgeschnitten wenn zu lang) */}
            <span className="truncate flex-1 font-medium">
                {task.title || TASK_LABEL[task.type]}
            </span>
        </div>
    );
};

// ── OutlineNavigator (Hauptkomponente) ────────────────────────────────

interface OutlineNavigatorProps {
    taskIds: string[];
    tasksById: Record<string, Task>;
    onReorderTasks: (taskIds: string[]) => void;
    onClose: () => void;
}

export const OutlineNavigator: React.FC<OutlineNavigatorProps> = ({
    taskIds,
    tasksById,
    onReorderTasks,
    onClose,
}) => {
    const [activeId, setActiveId] = useState<string | null>(null);

    /* Eigene Sensoren – getrennt vom Canvas-DnD */
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { delay: 120, tolerance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const handleDragStart = (e: DragStartEvent) => {
        setActiveId(e.active.id.toString());
    };

    const handleDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        setActiveId(null);
        if (over && active.id !== over.id) {
            const oldIdx = taskIds.indexOf(active.id.toString());
            const newIdx = taskIds.indexOf(over.id.toString());
            onReorderTasks(arrayMove(taskIds, oldIdx, newIdx));
        }
    };

    const handleDragCancel = () => setActiveId(null);

    /** Scrollt die TaskCard im Canvas in den sichtbaren Bereich */
    const handleScrollTo = (id: string) => {
        const card = document.querySelector(`[data-task-id="${id}"]`);
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    /* Aufgaben-Nummerierung (identisch zur Canvas-Logik) */
    const taskNumberMap: Record<string, number | null> = {};
    {
        let counter = 0;
        for (const id of taskIds) {
            const task = tasksById[id];
            if (!task || task.type === 'page-break') continue;
            if (task.showNumber === false) {
                taskNumberMap[id] = null;
            } else {
                counter++;
                taskNumberMap[id] = counter;
            }
        }
    }

    const activeTask = activeId ? tasksById[activeId] : null;

    return (
        <aside className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800/80">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200/80 dark:border-slate-800/80">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide uppercase">
                    Gliederung
                </h3>
                <button
                    onClick={onClose}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Gliederung schließen"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Scrollbare Task-Liste */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
                {taskIds.length === 0 ? (
                    <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 py-6">
                        Noch keine Aufgaben.
                    </p>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragCancel={handleDragCancel}
                        modifiers={[restrictToVerticalAxis]}
                    >
                        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                            {taskIds.map((id) => {
                                const task = tasksById[id];
                                if (!task) return null;
                                return (
                                    <OutlineItem
                                        key={id}
                                        id={id}
                                        task={task}
                                        taskNumber={taskNumberMap[id] ?? null}
                                        isActive={false}
                                        onScrollTo={handleScrollTo}
                                    />
                                );
                            })}
                        </SortableContext>

                        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
                            {activeTask ? (
                                <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium shadow-lg border border-blue-200 dark:border-blue-700">
                                    {React.createElement(TASK_ICON[activeTask.type] ?? FileText, { size: 13 })}
                                    <span className="truncate">
                                        {activeTask.title || TASK_LABEL[activeTask.type]}
                                    </span>
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </div>

            {/* Footer mit Aufgaben-Zähler */}
            <div className="px-3 py-2 border-t border-slate-200/80 dark:border-slate-800/80">
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {taskIds.length} {taskIds.length === 1 ? 'Aufgabe' : 'Aufgaben'}
                </p>
            </div>
        </aside>
    );
};
