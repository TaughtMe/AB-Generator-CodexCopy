import React, { useRef, useState } from 'react';
import { useSortable, defaultAnimateLayoutChanges, type AnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Copy, ChevronDown, ChevronUp, Sparkles, Hash, EyeOff, Palette } from 'lucide-react';
import { clsx } from 'clsx';
import type { Task } from '../../types/worksheet';
import { useSettingsStore } from '../../store/settingsStore';
import { IconButton } from '../ui/IconButton';
import { ICON_SIZES } from '../ui/iconSizes';
import { InlineAIPanel } from './InlineAIPanel';

/** Voreingestellte Akzentfarben für den per-Task Farbpicker */
const TASK_COLOR_PRESETS = [
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#14b8a6', '#06b6d4', '#1e293b', '#64748b',
];

interface TaskCardProps {
    id: string;
    task: Task;
    /** Running task number (1-based) or null when unnumbered */
    taskNumber: number | null;
    children: React.ReactNode;
    onRemove: (id: string) => void;
    onDuplicate: (id: string) => void;
    onToggleNumber: (id: string) => void;
    onUpdateTask?: (id: string, updates: Partial<Task>) => void;
}

/**
 * TaskCard – Slim version for A4 page rendering.
 * Minimal chrome so the printed page looks clean.
 * Header and action buttons are hidden in @media print via .task-card-header
 */
/* Während des Sortierens oder nach dem Drag keine Layout-Animation abspielen.
   Verhindert den Sprung-nach-oben-Bug beim Drag-Start. */
const noAnimationWhileSorting: AnimateLayoutChanges = (args) => {
    const { isSorting, wasDragging } = args;
    if (isSorting || wasDragging) return false;
    return defaultAnimateLayoutChanges(args);
};

export const TaskCard: React.FC<TaskCardProps> = ({
    id,
    task,
    taskNumber,
    children,
    onRemove,
    onDuplicate,
    onToggleNumber,
    onUpdateTask,
}) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showInlineAIPanel, setShowInlineAIPanel] = useState(false);
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const brandColor = useSettingsStore((s) => s.brandColor);
    const applyColorToTasks = useSettingsStore((s) => s.applyColorToTasks);

    // Per-Task Farbe hat Vorrang vor globaler brandColor
    const effectiveColor = task.accentColor || (applyColorToTasks ? brandColor : undefined);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id, animateLayoutChanges: noAnimationWhileSorting });

    const style = {
        /* CSS.Translate statt CSS.Transform – verhindert Scale-Sprünge */
        transform: CSS.Translate.toString(transform),
        transition,
        borderColor: effectiveColor ? `${effectiveColor}4D` : undefined,
        ['--task-accent-color' as string]: effectiveColor || '#000000',
    };

    const handleSetColor = (color: string | undefined) => {
        onUpdateTask?.(id, { accentColor: color } as Partial<Task>);
        setShowColorPicker(false);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            data-task-id={id}
            className={clsx(
                "task-card group rounded-lg transition-all bg-worksheet-field text-worksheet-ink border border-worksheet-border print:bg-transparent print:border-none",
                isDragging ? "opacity-30 z-50 ring-2 ring-blue-500" : "hover:border-worksheet-border"
            )}
        >
            {/* Print-only task index – visible ONLY in @media print.
                Lives outside .task-card-header so it survives the print hide. */}
            {taskNumber !== null && (
                <div className="print-task-index" aria-hidden="true">
                    Aufgabe {taskNumber}
                </div>
            )}

            {/* Header – hidden in print */}
            <div className="task-card-header flex items-center gap-1.5 px-2 py-1 border-b border-worksheet-border bg-worksheet-field print:bg-transparent print:border-none">
                {/* Drag Handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-slate-200 rounded transition-colors text-worksheet-inkLight"
                >
                    <GripVertical className={ICON_SIZES[14]} />
                </div>

                {/* Task number + type */}
                <span className="text-[11px] font-medium text-worksheet-inkLight tracking-wider">
                    {taskNumber !== null && (
                        <span
                            className="font-bold mr-1"
                            style={{ color: effectiveColor || undefined }}
                        >
                            {taskNumber}.
                        </span>
                    )}
                    <span className="uppercase text-[10px]">{task.type.replace('-', ' ')}</span>
                </span>

                {/* Action buttons – always visible in editor, hidden by PrintStyles */}
                <div className="ml-auto flex items-center gap-0.5">
                    {/* Per-Task Farbpicker */}
                    <div className="relative" ref={colorPickerRef}>
                        <IconButton
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            size="sm"
                            className={clsx(
                                "transition-colors",
                                task.accentColor
                                    ? "hover:bg-slate-100"
                                    : "text-worksheet-inkLight/60 hover:text-worksheet-inkLight hover:bg-worksheet-field"
                            )}
                            title="Aufgabenfarbe"
                        >
                            {task.accentColor ? (
                                <div className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: task.accentColor }} />
                            ) : (
                                <Palette className={ICON_SIZES[12]} />
                            )}
                        </IconButton>

                        {/* Farbpicker-Dropdown */}
                        {showColorPicker && (
                            <div className="absolute top-full right-0 mt-1 z-50 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl min-w-[160px]">
                                <p className="text-[10px] font-semibold text-slate-400 mb-1.5">Aufgabenfarbe</p>
                                <div className="grid grid-cols-6 gap-1">
                                    {TASK_COLOR_PRESETS.map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => handleSetColor(color)}
                                            className={clsx(
                                                "w-5 h-5 rounded cursor-pointer transition-all",
                                                task.accentColor === color ? "ring-2 ring-offset-1 ring-violet-500 scale-110" : "hover:scale-110"
                                            )}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                                <div className="mt-1.5 flex items-center gap-1.5">
                                    <input
                                        type="color"
                                        value={task.accentColor || brandColor}
                                        onChange={(e) => handleSetColor(e.target.value)}
                                        className="w-5 h-5 border-0 cursor-pointer rounded"
                                    />
                                    <span className="text-[9px] text-slate-400 font-mono">{task.accentColor || 'global'}</span>
                                </div>
                                {task.accentColor && (
                                    <button
                                        onClick={() => handleSetColor(undefined)}
                                        className="mt-1.5 w-full text-[10px] text-slate-500 hover:text-red-500 transition-colors cursor-pointer py-0.5"
                                    >
                                        Zurücksetzen (global)
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Toggle task numbering */}
                    <IconButton
                        onClick={() => onToggleNumber(id)}
                        size="sm"
                        className={clsx(
                            "transition-colors",
                            taskNumber !== null
                                ? "text-blue-500/70 hover:text-blue-600 hover:bg-blue-50"
                                : "text-worksheet-inkLight/60 hover:text-worksheet-inkLight hover:bg-worksheet-field"
                        )}
                        title={taskNumber !== null ? 'Nummerierung entfernen' : 'Nummerierung hinzufügen'}
                    >
                        {taskNumber !== null ? <Hash className={ICON_SIZES[12]} /> : <EyeOff className={ICON_SIZES[12]} />}
                    </IconButton>

                    <IconButton
                        onClick={() => setShowInlineAIPanel((current) => !current)}
                        size="sm"
                        className="text-worksheet-inkLight hover:text-purple-500 hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Per KI überarbeiten"
                        disabled={!onUpdateTask}
                    >
                        <Sparkles className={ICON_SIZES[12]} />
                    </IconButton>

                    <IconButton
                        onClick={() => onDuplicate(id)}
                        size="sm"
                        className="text-worksheet-inkLight hover:text-worksheet-ink hover:bg-worksheet-field"
                        title="Duplizieren"
                    >
                        <Copy className={ICON_SIZES[12]} />
                    </IconButton>

                    <IconButton
                        onClick={() => onRemove(id)}
                        size="sm"
                        className="text-worksheet-inkLight hover:text-red-500 hover:bg-red-50"
                        title="Löschen"
                    >
                        <Trash2 className={ICON_SIZES[12]} />
                    </IconButton>

                    <IconButton
                        onClick={() => setIsCollapsed((c) => !c)}
                        size="sm"
                        className="text-worksheet-inkLight hover:text-worksheet-ink hover:bg-worksheet-field"
                        title={isCollapsed ? 'Ausklappen' : 'Einklappen'}
                    >
                        {isCollapsed ? <ChevronDown className={ICON_SIZES[12]} /> : <ChevronUp className={ICON_SIZES[12]} />}
                    </IconButton>
                </div>
            </div>

            {/* Body – collapsible */}
            <div
                className={clsx(
                    "transition-all duration-200 ease-in-out",
                    isCollapsed ? "max-h-0 overflow-hidden" : "max-h-[2000px] overflow-visible"
                )}
            >
                <div className="p-2">
                    {children}
                    {showInlineAIPanel && onUpdateTask && (
                        <InlineAIPanel
                            task={task}
                            onApply={(updates) => onUpdateTask(id, updates)}
                            onClose={() => setShowInlineAIPanel(false)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
