import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Copy, ChevronDown, ChevronUp, Sparkles, Hash, EyeOff } from 'lucide-react';
import { clsx } from 'clsx';
import type { Task } from '../../types/worksheet';
import { TaskAIChat } from '../ai/TaskAIChat';

interface TaskCardProps {
    id: string;
    task: Task;
    /** Running task number (1-based) or null when unnumbered */
    taskNumber: number | null;
    children: React.ReactNode;
    onRemove: (id: string) => void;
    onDuplicate: (id: string) => void;
    onToggleNumber: (id: string) => void;
}

/**
 * TaskCard – Slim version for A4 page rendering.
 * Minimal chrome so the printed page looks clean.
 * Header and action buttons are hidden in @media print via .task-card-header
 */
export const TaskCard: React.FC<TaskCardProps> = ({ id, task, taskNumber, children, onRemove, onDuplicate, onToggleNumber }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showAIChat, setShowAIChat] = useState(false);

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

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={clsx(
                "task-card group rounded-lg transition-all bg-worksheet-field text-worksheet-ink border border-worksheet-border print:bg-transparent print:border-none",
                isDragging ? "opacity-50 z-50 ring-2 ring-blue-500 scale-[1.01]" : "hover:border-worksheet-border"
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
                    <GripVertical size={14} />
                </div>

                {/* Task number + type */}
                <span className="text-[11px] font-medium text-worksheet-inkLight tracking-wider">
                    {taskNumber !== null && (
                        <span className="text-blue-500/80 font-bold mr-1">{taskNumber}.</span>
                    )}
                    <span className="uppercase text-[10px]">{task.type.replace('-', ' ')}</span>
                </span>

                {/* Action buttons – always visible in editor, hidden by PrintStyles */}
                <div className="ml-auto flex items-center gap-0.5">
                    {/* Toggle task numbering */}
                    <button
                        onClick={() => onToggleNumber(id)}
                        className={clsx(
                            "p-1 rounded transition-colors cursor-pointer",
                            taskNumber !== null
                                ? "text-blue-500/70 hover:text-blue-600 hover:bg-blue-50"
                                : "text-worksheet-inkLight/60 hover:text-worksheet-inkLight hover:bg-worksheet-field"
                        )}
                        title={taskNumber !== null ? 'Nummerierung entfernen' : 'Nummerierung hinzufügen'}
                    >
                        {taskNumber !== null ? <Hash size={12} /> : <EyeOff size={12} />}
                    </button>

                    <button
                        onClick={() => setShowAIChat(!showAIChat)}
                        className={clsx(
                            "p-1 rounded transition-colors cursor-pointer",
                            showAIChat
                                ? "text-purple-500 bg-purple-50"
                                : "text-worksheet-inkLight hover:text-purple-500 hover:bg-purple-50"
                        )}
                        title="KI-Assistent"
                    >
                        <Sparkles size={12} />
                    </button>

                    <button
                        onClick={() => onDuplicate(id)}
                        className="p-1 text-worksheet-inkLight hover:text-worksheet-ink rounded hover:bg-worksheet-field transition-colors cursor-pointer"
                        title="Duplizieren"
                    >
                        <Copy size={12} />
                    </button>

                    <button
                        onClick={() => onRemove(id)}
                        className="p-1 text-worksheet-inkLight hover:text-red-500 rounded hover:bg-red-50 transition-colors cursor-pointer"
                        title="Löschen"
                    >
                        <Trash2 size={12} />
                    </button>

                    <button
                        onClick={() => setIsCollapsed((c) => !c)}
                        className="p-1 text-worksheet-inkLight hover:text-worksheet-ink rounded hover:bg-worksheet-field transition-colors cursor-pointer"
                        title={isCollapsed ? 'Ausklappen' : 'Einklappen'}
                    >
                        {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                    </button>
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
                    {/* AI Chat Panel */}
                    {showAIChat && (
                        <TaskAIChat
                            task={task}
                            onClose={() => setShowAIChat(false)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

