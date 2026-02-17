import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Copy, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import type { Task } from '../../types/worksheet';
import { TaskAIChat } from '../ai/TaskAIChat';

interface TaskCardProps {
    id: string;
    task: Task;
    index: number;
    children: React.ReactNode;
    onRemove: (id: string) => void;
    onDuplicate: (id: string) => void;
}

/**
 * TaskCard – Slim version for A4 page rendering.
 * Minimal chrome so the printed page looks clean.
 * Header and action buttons are hidden in @media print via .task-card-header
 */
export const TaskCard: React.FC<TaskCardProps> = ({ id, task, index, children, onRemove, onDuplicate }) => {
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
                "task-card group border border-slate-200/60 dark:border-slate-700/40 rounded-lg transition-all overflow-hidden",
                isDragging ? "opacity-50 z-50 ring-2 ring-blue-500 scale-[1.01]" : "hover:border-slate-300 dark:hover:border-slate-600"
            )}
        >
            {/* Print-only task index – visible ONLY in @media print.
                Lives outside .task-card-header so it survives the print hide. */}
            <div className="print-task-index" aria-hidden="true">
                Aufgabe {index + 1}
            </div>

            {/* Header – hidden in print */}
            <div className="task-card-header flex items-center gap-1.5 px-2 py-1 border-b border-slate-100/80 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-800/30">
                {/* Drag Handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-400"
                >
                    <GripVertical size={14} />
                </div>

                {/* Task number + type */}
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider">
                    <span className="text-blue-500/80 font-bold mr-1">{index + 1}.</span>
                    <span className="uppercase text-[10px]">{task.type.replace('-', ' ')}</span>
                </span>

                {/* Action buttons – always visible in editor, hidden by PrintStyles */}
                <div className="ml-auto flex items-center gap-0.5">
                    <button
                        onClick={() => setShowAIChat(!showAIChat)}
                        className={clsx(
                            "p-1 rounded transition-colors cursor-pointer",
                            showAIChat
                                ? "text-purple-500 bg-purple-50 dark:bg-purple-900/30"
                                : "text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        )}
                        title="KI-Assistent"
                    >
                        <Sparkles size={12} />
                    </button>

                    <button
                        onClick={() => onDuplicate(id)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title="Duplizieren"
                    >
                        <Copy size={12} />
                    </button>

                    <button
                        onClick={() => onRemove(id)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                        title="Löschen"
                    >
                        <Trash2 size={12} />
                    </button>

                    <button
                        onClick={() => setIsCollapsed((c) => !c)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title={isCollapsed ? 'Ausklappen' : 'Einklappen'}
                    >
                        {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                    </button>
                </div>
            </div>

            {/* Body – collapsible */}
            <div
                className={clsx(
                    "transition-all duration-200 ease-in-out overflow-hidden",
                    isCollapsed ? "max-h-0" : "max-h-[2000px]"
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

