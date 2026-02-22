import { useState, useRef, useCallback, useEffect } from 'react';
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
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
    Scissors, Trash2,
    ListChecks, TextCursorInput, Sigma, FileText,
    Type, Columns, Image as ImageIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { Task, TaskType } from '../../types/worksheet';
import { MultiPageContainer } from '../layout/MultiPageContainer';
import { WorksheetHeader } from '../layout/WorksheetHeader';
import { TaskEditorRenderer } from '../tasks/TaskRegistry';
import { TaskCard } from '../tasks/TaskCard';

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
    { type: 'multiple-choice',   label: 'Multiple Choice',   icon: ListChecks,      group: 'task' },
    { type: 'cloze',             label: 'Lückentext',        icon: TextCursorInput, group: 'task' },
    { type: 'math',              label: 'Mathematik',        icon: Sigma,           group: 'task' },
    { type: 'lineatur',          label: 'Lineatur / Raster', icon: Type,            group: 'layout' },
    { type: 'columns',           label: 'Zweispaltig',       icon: Columns,         group: 'layout' },
    { type: 'page-break',        label: 'Seitenumbruch',     icon: Scissors,        group: 'layout' },
    { type: 'image-placeholder', label: 'Bild-Platzhalter',  icon: ImageIcon,       group: 'layout' },
];

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
    /** Task-Update (z.B. accentColor) */
    onUpdateTask: (id: string, updates: Partial<Task>) => void;
    /** Task an bestimmter Position einfügen */
    onInsertTaskAt: (type: TaskType, index: number) => void;
    /** Placement-Modus aktiv? */
    isPlacingNewTask: boolean;
    /** Beendet den Placement-Modus */
    onCancelPlacing: () => void;
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
    onUpdateTask,
    onInsertTaskAt,
    isPlacingNewTask,
    onCancelPlacing,
}: WorksheetCanvasProps) {
    const [activeId, setActiveId] = useState<string | null>(null);

    /* ── Placement-Modus State ── */
    /** Index, an dem die Indikator-Linie angezeigt wird (0 = ganz oben) */
    const [hoverIndex, setHoverIndex] = useState<number>(0);
    /** Wenn gesetzt: Typ-Menü ist offen an dieser Position */
    const [menuAtIndex, setMenuAtIndex] = useState<number | null>(null);
    /** Y-Position des Menüs (viewport-relativ) */
    const [menuY, setMenuY] = useState(0);

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
            setMenuY(e.clientY);
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

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const oldIndex = taskIds.indexOf(active.id.toString());
            const newIndex = taskIds.indexOf(over.id.toString());
            onReorderTasks(arrayMove(taskIds, oldIndex, newIndex));
        }
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

    return (
        <div
            ref={canvasRef}
            className={clsx(
                'overflow-x-auto relative',
                isPlacingNewTask && menuAtIndex === null && 'cursor-crosshair',
            )}
            style={{
                paddingBottom: zoomLevel > 1 ? `${(zoomLevel - 1) * 100}vh` : undefined,
            }}
            onMouseMove={isPlacingNewTask ? handleMouseMove : undefined}
            onClick={isPlacingNewTask ? handleCanvasClick : undefined}
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
                modifiers={[restrictToVerticalAxis]}
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

                                /* Platzierungs-Indikator VOR diesem Task */
                                const showIndicator = isPlacingNewTask && menuAtIndex === null && hoverIndex === idx;

                                if (task.type === 'page-break') {
                                    return (
                                        <div
                                            key={id}
                                            ref={(el) => setTaskRef(id, el)}
                                        >
                                            {showIndicator && <PlacementIndicator />}
                                            <div
                                                className="page-break-task relative my-2"
                                                style={{ breakAfter: 'page' }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 border-t-2 border-dashed border-worksheet-border" />
                                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap bg-worksheet-field text-worksheet-inkLight border border-worksheet-border print:bg-transparent print:border-none">
                                                        <Scissors size={10} />
                                                        Seitenumbruch
                                                    </span>
                                                    <div className="flex-1 border-t-2 border-dashed border-worksheet-border" />
                                                    <button
                                                        onClick={() => onRemoveTask(id)}
                                                        className="p-0.5 text-worksheet-inkLight hover:text-red-500 transition-colors cursor-pointer no-print"
                                                        title="Seitenumbruch entfernen"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={id}
                                        ref={(el) => setTaskRef(id, el)}
                                    >
                                        {showIndicator && <PlacementIndicator />}
                                        <TaskCard
                                            id={id}
                                            task={task}
                                            taskNumber={taskNumberMap[id] ?? null}
                                            onRemove={onRemoveTask}
                                            onDuplicate={onDuplicateTask}
                                            onToggleNumber={onToggleTaskNumber}
                                            onUpdateTask={onUpdateTask}
                                        >
                                            <TaskEditorRenderer task={task} />
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
            {menuAtIndex !== null && (
                <PlacementTypeMenu
                    y={menuY}
                    options={TASK_TYPE_OPTIONS}
                    onSelect={handleSelectType}
                    onClose={() => { setMenuAtIndex(null); onCancelPlacing(); }}
                />
            )}

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
}

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
   Wird als fixed-positioniertes Overlay direkt an der Klick-Position gerendert.
   ══════════════════════════════════════════════════ */
interface PlacementTypeMenuProps {
    y: number;
    options: TaskOption[];
    onSelect: (type: TaskType) => void;
    onClose: () => void;
}

function PlacementTypeMenu({ y, options, onSelect, onClose }: PlacementTypeMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    /* Klick außerhalb → schließen */
    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        // Timeout, damit der auslösende Klick nicht sofort das Menü schließt
        const timer = setTimeout(() => document.addEventListener('mousedown', handle), 50);
        return () => { clearTimeout(timer); document.removeEventListener('mousedown', handle); };
    }, [onClose]);

    const taskGroup = options.filter((o) => o.group === 'task');
    const layoutGroup = options.filter((o) => o.group === 'layout');

    /* Menü nach oben oder unten öffnen, je nach Viewport-Position */
    const spaceBelow = window.innerHeight - y;
    const openUpward = spaceBelow < 300;

    return (
        <div
            ref={menuRef}
            className="fixed z-[60] w-56 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-150"
            style={{
                left: '50%',
                transform: 'translateX(-50%)',
                ...(openUpward
                    ? { bottom: `${window.innerHeight - y + 8}px` }
                    : { top: `${y + 8}px` }),
            }}
        >
            {/* Aufgaben */}
            <div className="px-2 py-1">
                <p className="px-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Aufgaben</p>
                {taskGroup.map(({ type, label, icon: Icon }) => (
                    <button
                        key={type}
                        onClick={() => onSelect(type)}
                        className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer text-left group"
                    >
                        <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors shrink-0">
                            <Icon size={13} className="text-slate-500 group-hover:text-blue-600 transition-colors" />
                        </div>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
                    </button>
                ))}
            </div>

            <div className="mx-3 my-1 border-t border-slate-100 dark:border-slate-700" />

            {/* Layout */}
            <div className="px-2 py-1">
                <p className="px-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Layout</p>
                {layoutGroup.map(({ type, label, icon: Icon }) => (
                    <button
                        key={type}
                        onClick={() => onSelect(type)}
                        className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-violet-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer text-left group"
                    >
                        <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/30 transition-colors shrink-0">
                            <Icon size={13} className="text-slate-500 group-hover:text-violet-600 transition-colors" />
                        </div>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
