import React from 'react';
import type { Task } from '../../types/worksheet';

export const ClozeEditor: React.FC<{ task: Task }> = ({ task }) => (
    <div className="p-4 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/50">
        <span className="text-sm text-slate-400 dark:text-slate-500">Lückentext-Editor: {task.title}</span>
        <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Wird in einer späteren Phase implementiert.</p>
    </div>
);

export const ClozePreview: React.FC<{ task: Task }> = ({ task }) => (
    <div className="p-4 bg-white dark:bg-slate-800 shadow-sm rounded">
        <span className="text-sm text-slate-400">Cloze Preview: {task.title}</span>
    </div>
);

export const MultipleChoicePreview: React.FC<{ task: Task }> = ({ task }) => (
    <div className="p-4 bg-white dark:bg-slate-800 shadow-sm rounded">
        <span className="text-sm text-slate-400">MC Preview: {task.title}</span>
    </div>
);
