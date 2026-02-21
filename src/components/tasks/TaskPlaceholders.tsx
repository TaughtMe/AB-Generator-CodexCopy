import React from 'react';
import type { Task } from '../../types/worksheet';

export const ClozeEditor: React.FC<{ task: Task }> = ({ task }) => (
    <div className="p-4 border border-dashed border-worksheet-border rounded-lg bg-worksheet-field print:bg-transparent print:border-none">
        <span className="text-sm text-worksheet-inkLight">Lückentext-Editor: {task.title}</span>
        <p className="text-xs text-worksheet-inkLight mt-1">Wird in einer späteren Phase implementiert.</p>
    </div>
);
