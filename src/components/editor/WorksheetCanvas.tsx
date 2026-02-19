import { useState } from 'react';
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
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { Scissors, Trash2 } from 'lucide-react';
import type { Task } from '../../types/worksheet';
import { MultiPageContainer } from '../layout/MultiPageContainer';
import { WorksheetHeader } from '../layout/WorksheetHeader';
import { TaskEditorRenderer } from '../tasks/TaskRegistry';
import { TaskCard } from '../tasks/TaskCard';

interface WorksheetCanvasProps {
    taskIds: string[];
    tasksById: Record<string, Task>;
    fontFamily: string;
    brandColor: string;
    zoomLevel: number;
    onReorderTasks: (taskIds: string[]) => void;
    onRemoveTask: (id: string) => void;
    onDuplicateTask: (id: string) => void;
    onToggleTaskNumber: (id: string) => void;
}

export function WorksheetCanvas({
    taskIds,
    tasksById,
    fontFamily,
    brandColor,
    zoomLevel,
    onReorderTasks,
    onRemoveTask,
    onDuplicateTask,
    onToggleTaskNumber,
}: WorksheetCanvasProps) {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id.toString());
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const oldIndex = taskIds.indexOf(active.id.toString());
            const newIndex = taskIds.indexOf(over.id.toString());
            const newOrder = arrayMove(taskIds, oldIndex, newIndex);
            onReorderTasks(newOrder);
        }
    };

    const handleDragCancel = () => {
        setActiveId(null);
    };

    const activeTask = activeId ? tasksById[activeId] : null;

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

    return (
        <div
            className="overflow-x-auto"
            style={{
                paddingBottom: zoomLevel > 1 ? `${(zoomLevel - 1) * 100}vh` : undefined,
            }}
        >
            <div
                className="zoom-container"
                style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'top center',
                }}
            >
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                    modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
                >
                    <SortableContext
                        items={taskIds}
                        strategy={verticalListSortingStrategy}
                    >
                        <MultiPageContainer fontFamily={fontFamily} brandColor={brandColor}>
                            <WorksheetHeader />
                            {taskIds.map((id) => {
                                const task = tasksById[id];
                                if (!task) return null;

                                if (task.type === 'page-break') {
                                    return (
                                        <div
                                            key={id}
                                            className="page-break-task relative my-2"
                                            style={{ breakAfter: 'page' }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-600" />
                                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-2 whitespace-nowrap flex items-center gap-1">
                                                    <Scissors size={10} />
                                                    Seitenumbruch
                                                </span>
                                                <div className="flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-600" />
                                                <button
                                                    onClick={() => onRemoveTask(id)}
                                                    className="p-0.5 text-slate-300 hover:text-red-500 transition-colors cursor-pointer no-print"
                                                    title="Seitenumbruch entfernen"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <TaskCard
                                        key={id}
                                        id={id}
                                        task={task}
                                        taskNumber={taskNumberMap[id] ?? null}
                                        onRemove={onRemoveTask}
                                        onDuplicate={onDuplicateTask}
                                        onToggleNumber={onToggleTaskNumber}
                                    >
                                        <TaskEditorRenderer task={task} />
                                    </TaskCard>
                                );
                            })}
                        </MultiPageContainer>
                    </SortableContext>

                    <DragOverlay>
                        {activeTask ? (
                            <div className="bg-white border-2 border-blue-500 rounded-lg shadow-2xl p-3 opacity-90 rotate-1">
                                <span className="text-xs font-medium text-blue-500">
                                    {activeTask.type.replace('-', ' ')}
                                </span>
                                <p className="text-slate-700 text-xs mt-0.5 truncate">
                                    {activeTask.title}
                                </p>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </div>
    );
}
