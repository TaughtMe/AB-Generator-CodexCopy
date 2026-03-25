import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    MeasuringStrategy,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    Scissors, Trash2,
    ListChecks, TextCursorInput, Sigma, FileText,
    Type, Columns, Image as ImageIcon, Heading, Table, BookOpen,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { Task, TaskType } from '../../types/worksheet';
import { MultiPageContainer } from '../layout/MultiPageContainer';
import { WorksheetHeader } from '../layout/WorksheetHeader';
import { TaskEditorRenderer } from '../tasks/TaskRegistry';
import { TaskCard } from '../tasks/TaskCard';
import { ICON_SIZES } from '../ui/iconSizes';
import { useWorksheetStore } from '../../store/worksheetStore';

/* ══════════════════════════════════════════════════
   WorksheetCanvas – Editor-Fläche mit DnD + Placement-Modus.

   Placement-Modus:
   1. Nutzer klickt "+" in der FloatingToolbar → isPlacingNewTask = true.
   2. Maus bewegt sich über den Canvas → blaue Linie zeigt Einfüge-Position.
   3. Klick → Typ-Menü öffnet sich an exakter Position.
   4. Typ gewählt → insertTaskAt(type, index) → Modus endet.
   ══════════════════════════════════════════════════ */

/* ── Task-Typ-Optionen für das Auswahl-Menü ── */
interface TaskOption {
    type: TaskType;
    label: string;
    icon: React.ElementType;
    group: 'task' | 'layout';
}

const TASK_TYPE_OPTIONS: TaskOption[] = [
    { type: 'instruction',       label: 'Aufgabe',           icon: FileText,        group: 'task' },
    { type: 'heading',           label: 'Zwischenüberschrift', icon: Heading,       group: 'layout' },
    { type: 'multiple-choice',   label: 'Multiple Choice',   icon: ListChecks,      group: 'task' },
    { type: 'cloze',             label: 'Lückentext',        icon: TextCursorInput, group: 'task' },
    { type: 'math',              label: 'Mathematik',        icon: Sigma,           group: 'task' },
    { type: 'table',             label: 'Tabelle',           icon: Table,           group: 'task' },
    { type: 'lineatur',          label: 'Lineatur / Raster', icon: Type,            group: 'layout' },
    { type: 'columns',           label: 'Zweispaltig',       icon: Columns,         group: 'layout' },
    { type: 'page-break',        label: 'Seitenumbruch',     icon: Scissors,        group: 'layout' },
    { type: 'image-placeholder', label: 'Bild-Platzhalter',  icon: ImageIcon,       group: 'layout' },
    { type: 'information',       label: 'Informationstext',  icon: BookOpen,        group: 'task' },
];

interface WorksheetCanvasProps {
    taskIds: string[];
    tasksById: Record<string, Task>;
    fontFamily: string;
    brandColor: string;
    zoomLevel: number;
    onReorderTasks: (taskIds: string[]) => void;
    onMoveTask: (taskId: string, sourceContainerId: string, targetContainerId: string, newIndex: number) => void;
    onRemoveTask: (id: string) => void;
    onDuplicateTask: (id: string) => void;
    onToggleTaskNumber: (id: string) => void;
    /** Task-Update (z.B. accentColor) */
    onUpdateTask: (id: string, updates: Partial<Task>) => void;
    /** Task an bestimmter Position einfügen */
    onInsertTaskAt: (type: TaskType, index: number) => void;
    /** Placement-Modus aktiv? */
    isPlacingNewTask: boolean;
    /** Beendet den Placement-Modus */
    onCancelPlacing: () => void;
}

export const WorksheetCanvas = React.memo(function WorksheetCanvas({
    taskIds,
    tasksById,
    fontFamily,
    brandColor,
    zoomLevel,
    onReorderTasks,
    onMoveTask,
    onRemoveTask,
    onDuplicateTask,
    onToggleTaskNumber,
    onUpdateTask,
    onInsertTaskAt,
    isPlacingNewTask,
    onCancelPlacing,
}: WorksheetCanvasProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const activeTaskId = useWorksheetStore((state) => state.activeTaskId);
    const setActiveTask = useWorksheetStore((state) => state.setActiveTask);

    /* ── Placement-Modus State ── */
    /** Index, an dem die Indikator-Linie angezeigt wird (0 = ganz oben) */
    const [hoverIndex, setHoverIndex] = useState<number>(0);
    /** Wenn gesetzt: Typ-Menü ist offen an dieser Position */
    const [menuAtIndex, setMenuAtIndex] = useState<number | null>(null);

    const canvasRef = useRef<HTMLDivElement>(null);
    const taskCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    /* ── ESC beendet Placement-Modus ── */
    useEffect(() => {
        if (!isPlacingNewTask) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setMenuAtIndex(null);
                onCancelPlacing();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isPlacingNewTask, onCancelPlacing]);

    /* ── Wenn Placement-Modus endet, State aufräumen ── */
    useEffect(() => {
        if (!isPlacingNewTask) {
            setMenuAtIndex(null);
            setHoverIndex(0);
        }
    }, [isPlacingNewTask]);

    /* ── Mouse-Tracking: Berechne hoverIndex anhand der Y-Position ── */
    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (!isPlacingNewTask || menuAtIndex !== null) return;

            const mouseY = e.clientY;
            let bestIndex = taskIds.length; // Default: ganz unten

            for (let i = 0; i < taskIds.length; i++) {
                const el = taskCardRefs.current.get(taskIds[i]);
                if (!el) continue;
                const rect = el.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (mouseY < midY) {
                    bestIndex = i;
                    break;
                }
            }

            setHoverIndex(bestIndex);
        },
        [isPlacingNewTask, menuAtIndex, taskIds],
    );

    /* ── Klick im Canvas: Typ-Menü öffnen ── */
    const handleCanvasClick = useCallback(
        (e: React.MouseEvent) => {
            if (!isPlacingNewTask || menuAtIndex !== null) return;
            // Nicht auslösen wenn auf einen interaktiven Button geklickt
            const target = e.target as HTMLElement;
            if (target.closest('button, input, textarea, select, [contenteditable]')) return;

            setMenuAtIndex(hoverIndex);
        },
        [isPlacingNewTask, menuAtIndex, hoverIndex],
    );

    /* ── Typ gewählt → Task einfügen ── */
    const handleSelectType = useCallback(
        (type: TaskType) => {
            if (menuAtIndex === null) return;
            onInsertTaskAt(type, menuAtIndex);
            setMenuAtIndex(null);
            onCancelPlacing();
        },
        [menuAtIndex, onInsertTaskAt, onCancelPlacing],
    );

    /* ── DnD Sensoren (unverändert) ── */
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { delay: 150, tolerance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const measuringConfig = {
        droppable: { strategy: MeasuringStrategy.Always },
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id.toString());
    };

    const findColumnContainingTask = useCallback((taskId: string) => {
        for (const task of Object.values(tasksById)) {
            if (task.type !== 'columns') continue;
            if (task.children.includes(taskId)) return task.id;
        }
        return null;
    }, [tasksById]);

    const findColumnSlotOfTask = useCallback((taskId: string): { columnsId: string; slotIndex: 0 | 1 } | null => {
        for (const task of Object.values(tasksById)) {
            if (task.type !== 'columns') continue;
            const slotIndex = task.children.findIndex((childId) => childId === taskId);
            if (slotIndex === 0 || slotIndex === 1) {
                return { columnsId: task.id, slotIndex };
            }
        }
        return null;
    }, [tasksById]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeTaskId = active.id.toString();
        const overId = over.id.toString();
        const overData = over.data.current as
            | { kind?: string; columnsId?: string; slotIndex?: 0 | 1; hasChild?: boolean }
            | undefined;
        const activeData = active.data.current as
            | { sourceContainerId?: string }
            | undefined;

        const activeIsRootTask = taskIds.includes(activeTaskId);
        const sourceContainerId =
            activeIsRootTask
                ? 'root'
                : (activeData?.sourceContainerId ?? findColumnContainingTask(activeTaskId));

        if (!sourceContainerId) return;

        if (overData?.kind === 'column-slot' && overData.columnsId && typeof overData.slotIndex === 'number') {
            if (overData.hasChild && activeTaskId !== overId) return;
            if (sourceContainerId === overData.columnsId && active.id === over.id) return;
            onMoveTask(activeTaskId, sourceContainerId, overData.columnsId, overData.slotIndex);
            return;
        }

        const overColumnLocation = findColumnSlotOfTask(overId);
        if (overColumnLocation) {
            // Target slot is already occupied (overId is the occupant) -> reject drop.
            if (overId !== activeTaskId) return;
            onMoveTask(activeTaskId, sourceContainerId, overColumnLocation.columnsId, overColumnLocation.slotIndex);
            return;
        }

        if (!taskIds.includes(overId)) return;

        if (sourceContainerId === 'root') {
            if (active.id === over.id) return;
            const oldIndex = taskIds.indexOf(activeTaskId);
            const newIndex = taskIds.indexOf(overId);
            if (oldIndex < 0 || newIndex < 0) return;
            onReorderTasks(arrayMove(taskIds, oldIndex, newIndex));
            return;
        }

        const targetIndex = taskIds.indexOf(overId);
        if (targetIndex < 0) return;
        onMoveTask(activeTaskId, sourceContainerId, 'root', targetIndex);
    };

    const handleDragCancel = () => {
        setActiveId(null);
    };

    const activeTask = activeId ? tasksById[activeId] : null;

    /* ── Task-Nummerierung ── */
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

    /* ── Ref-Callback für TaskCard-DOM-Elemente ── */
    const setTaskRef = useCallback((id: string, el: HTMLDivElement | null) => {
        if (el) {
            taskCardRefs.current.set(id, el);
        } else {
            taskCardRefs.current.delete(id);
        }
    }, []);

    const handleCanvasPointerDownCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (isPlacingNewTask) return;
        const target = event.target as HTMLElement;
        if (target.closest('.a4-page')) return;
        setActiveTask(null);
    }, [isPlacingNewTask, setActiveTask]);

    return (
        <div
            ref={canvasRef}
            className={clsx(
                'overflow-x-auto overflow-y-auto relative',
                isPlacingNewTask && menuAtIndex === null && 'cursor-crosshair',
            )}
            style={{
                paddingBottom: zoomLevel > 1 ? `${(zoomLevel - 1) * 100}vh` : undefined,
            }}
            onMouseMove={isPlacingNewTask ? handleMouseMove : undefined}
            onClick={isPlacingNewTask ? handleCanvasClick : undefined}
            onPointerDownCapture={handleCanvasPointerDownCapture}
        >
            {/* DndContext AUSSERHALB des zoom-container, damit DragOverlay
                korrekt am Viewport positioniert wird (CSS transform erzeugt
                einen neuen Containing-Block und bricht fixed-Positionierung). */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
                measuring={measuringConfig}
            >
                <div
                    className="zoom-container"
                    style={{
                        transform: `scale(${zoomLevel})`,
                        transformOrigin: 'top center',
                    }}
                >
                    <SortableContext
                        items={taskIds}
                        strategy={verticalListSortingStrategy}
                    >
                        <MultiPageContainer fontFamily={fontFamily} brandColor={brandColor}>
                            <WorksheetHeader />

                            {taskIds.map((id, idx) => {
                                const task = tasksById[id];
                                if (!task) return null;
                                const isTaskActive = activeTaskId === id;

                                /* Platzierungs-Indikator VOR diesem Task */
                                const showIndicator = isPlacingNewTask && menuAtIndex === null && hoverIndex === idx;
                                const isTaskNumberHidden = task.showNumber === false;
                                const taskWrapperClassName = clsx(
                                    'task-block print:break-inside-avoid print:break-after-auto print:mb-0',
                                    isTaskNumberHidden ? 'mt-2 print:mt-2' : 'mt-8 print:mt-8',
                                );

                                if (task.type === 'page-break') {
                                    return (
                                        <div
                                            key={id}
                                            ref={(el) => setTaskRef(id, el)}
                                            onClick={() => setActiveTask(id)}
                                        >
                                            {showIndicator && <PlacementIndicator />}
                                            <div
                                                className={clsx(
                                                    "page-break-task relative my-2",
                                                    isTaskActive ? "ring-1 ring-blue-500/40 rounded" : undefined,
                                                )}
                                                style={{ breakAfter: 'page' }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 border-t-2 border-dashed border-worksheet-border" />
                                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap bg-worksheet-field text-worksheet-inkLight border border-worksheet-border print:bg-transparent print:border-none">
                                                        <Scissors className={ICON_SIZES[10]} />
                                                        Seitenumbruch
                                                    </span>
                                                    <div className="flex-1 border-t-2 border-dashed border-worksheet-border" />
                                                    {isTaskActive && (
                                                        <button
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                onRemoveTask(id);
                                                            }}
                                                            className="p-0.5 text-worksheet-inkLight hover:text-red-500 transition-colors cursor-pointer no-print"
                                                            title="Seitenumbruch entfernen"
                                                        >
                                                            <Trash2 className={ICON_SIZES[12]} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={id}
                                        ref={(el) => setTaskRef(id, el)}
                                        className={taskWrapperClassName}
                                        onClick={() => setActiveTask(task.id)}
                                    >
                                        {showIndicator && <PlacementIndicator />}
                                        <TaskCard
                                            id={id}
                                            task={task}
                                            isActive={isTaskActive}
                                            taskNumber={taskNumberMap[id] ?? null}
                                            onRemove={onRemoveTask}
                                            onDuplicate={onDuplicateTask}
                                            onToggleNumber={onToggleTaskNumber}
                                            onUpdateTask={onUpdateTask}
                                        >
                                            <TaskEditorRenderer task={task} isActive={isTaskActive} />
                                        </TaskCard>
                                    </div>
                                );
                            })}

                            {/* Indikator NACH dem letzten Task */}
                            {isPlacingNewTask && menuAtIndex === null && hoverIndex >= taskIds.length && (
                                <PlacementIndicator />
                            )}
                        </MultiPageContainer>
                    </SortableContext>
                </div>

                {/* DragOverlay AUSSERHALB des zoom-container → korrekte Viewport-Position */}
                <DragOverlay dropAnimation={{ duration: 200, easing: 'ease-out' }}>
                    {activeTask ? (
                        <div className="bg-worksheet-paper border-2 border-blue-500 rounded-lg shadow-2xl p-3 opacity-90 rotate-1 max-w-xs">
                            <span className="text-xs font-medium text-blue-500">
                                {activeTask.type.replace('-', ' ')}
                            </span>
                            <p className="text-worksheet-ink text-xs mt-0.5 truncate">
                                {activeTask.title}
                            </p>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* ── Placement-Modus: Typ-Auswahlmenü ── */}
            <PlacementTypeMenu
                isOpen={menuAtIndex !== null}
                editorRef={canvasRef}
                options={TASK_TYPE_OPTIONS}
                onSelect={handleSelectType}
                onClose={() => { setMenuAtIndex(null); onCancelPlacing(); }}
            />

            {/* ── Placement-Modus: Hinweis-Banner oben ── */}
            {isPlacingNewTask && menuAtIndex === null && (
                <div className="no-print fixed top-[52px] left-0 right-0 z-50 flex items-center justify-center">
                    <div className="flex items-center gap-3 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-b-xl shadow-lg">
                        <span>Klicke an die Stelle, wo die Aufgabe eingefügt werden soll</span>
                        <button
                            onClick={onCancelPlacing}
                            className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] font-bold cursor-pointer transition-colors"
                        >
                            ESC Abbrechen
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

/* ══════════════════════════════════════════════════
   PlacementIndicator – Blaue Einfüge-Linie
   ══════════════════════════════════════════════════ */
function PlacementIndicator() {
    return (
        <div className="relative my-1 mx-2 no-print animate-pulse">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-500 rounded-full" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full -ml-1.5 shadow-sm" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full -mr-1.5 shadow-sm" />
            <div className="h-3" />
        </div>
    );
}

/* ══════════════════════════════════════════════════
   PlacementTypeMenu – Typ-Auswahl nach Klick im Placement-Modus.
   Wird als fixed-positioniertes Overlay knapp über der Floating-Bar gerendert.
   ══════════════════════════════════════════════════ */
interface PlacementTypeMenuProps {
    isOpen: boolean;
    editorRef: React.RefObject<HTMLDivElement>;
    options: TaskOption[];
    onSelect: (type: TaskType) => void;
    onClose: () => void;
}

function PlacementTypeMenu({ isOpen, editorRef, options, onSelect, onClose }: PlacementTypeMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [anchorPosition, setAnchorPosition] = useState({ left: 0, bottom: 120 });

    const updateAnchorPosition = useCallback(() => {
        const toolbarAnchor = document.querySelector('[data-floating-toolbar-anchor="true"]');
        if (toolbarAnchor instanceof HTMLElement) {
            const rect = toolbarAnchor.getBoundingClientRect();
            setAnchorPosition({
                left: rect.left + rect.width / 2,
                bottom: window.innerHeight - rect.top,
            });
            return;
        }

        const rect = editorRef.current?.getBoundingClientRect();
        if (!rect) {
            setAnchorPosition({
                left: window.innerWidth / 2,
                bottom: 120,
            });
            return;
        }

        setAnchorPosition({
            left: rect.left + rect.width / 2,
            bottom: Math.max(96, window.innerHeight - rect.bottom + 96),
        });
    }, [editorRef]);

    useEffect(() => {
        updateAnchorPosition();
    }, [isOpen, updateAnchorPosition]);

    useEffect(() => {
        if (!isOpen) return;

        const handleViewportChange = () => updateAnchorPosition();
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);

        return () => {
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
        };
    }, [isOpen, updateAnchorPosition]);

    /* Klick außerhalb → schließen */
    useEffect(() => {
        if (!isOpen) return;

        const handle = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        // Timeout, damit der auslösende Klick nicht sofort das Menü schließt
        const timer = setTimeout(() => document.addEventListener('mousedown', handle), 50);
        return () => { clearTimeout(timer); document.removeEventListener('mousedown', handle); };
    }, [isOpen, onClose]);

    const taskTypes = options.filter((o) => o.group === 'task');
    const layoutTypes = options.filter((o) => o.group === 'layout');

    return (
        <div
            className="no-print fixed z-[60] pointer-events-none"
            style={{ left: `${anchorPosition.left}px`, bottom: `${anchorPosition.bottom}px` }}
        >
            <div className="relative h-0 w-0">
                <div
                    ref={menuRef}
                    className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[480px] max-w-[calc(100vw-2rem)] bg-slate-800 dark:bg-slate-900 border border-slate-700 shadow-2xl rounded-xl p-5 origin-bottom transition-all duration-300 ease-out ${
                        isOpen
                            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                            : 'opacity-0 scale-75 translate-y-4 pointer-events-none'
                    }`}
                >
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-2">
                                Aufgaben
                            </h3>
                            <div className="flex flex-col gap-1">
                                {taskTypes.map(({ type, label, icon: Icon }) => (
                                    <button
                                        key={type}
                                        onClick={() => onSelect(type)}
                                        className="w-full text-sm text-left px-3 py-2 rounded-lg hover:bg-slate-700/50 text-slate-200 transition-colors flex items-center gap-3 cursor-pointer"
                                    >
                                        <Icon className={`${ICON_SIZES[14]} text-slate-400`} />
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-2">
                                Layout
                            </h3>
                            <div className="flex flex-col gap-1">
                                {layoutTypes.map(({ type, label, icon: Icon }) => (
                                    <button
                                        key={type}
                                        onClick={() => onSelect(type)}
                                        className="w-full text-sm text-left px-3 py-2 rounded-lg hover:bg-slate-700/50 text-slate-200 transition-colors flex items-center gap-3 cursor-pointer"
                                    >
                                        <Icon className={`${ICON_SIZES[14]} text-slate-400`} />
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
