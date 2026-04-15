import React from 'react';
import { useWorksheetStore } from '../../store/worksheetStore';
import type { HeadingTask } from '../../types/worksheet';

interface HeadingEditorProps {
    task: HeadingTask;
    isActive?: boolean;
}

export const HeadingEditor: React.FC<HeadingEditorProps> = ({ task, isActive = true }) => {
    const updateTask = useWorksheetStore((s) => s.updateTask);
    const text = task.text?.trim() ? task.text : 'Zwischenüberschrift';
    const handleChange = (value: string) => {
        updateTask(task.id, {
            text: value,
            title: value.trim() || 'Zwischenüberschrift',
        } as Partial<HeadingTask>);
    };

    return (
        <div className="space-y-2">
            {isActive && (
                <div className="no-print">
                    <label className="block text-xs font-medium text-worksheet-inkLight mb-1 uppercase tracking-wider">
                        Zwischenüberschrift
                    </label>
                    <input
                        type="text"
                        value={task.text}
                        onChange={(e) => handleChange(e.target.value)}
                        placeholder="Titel eingeben…"
                        className="w-full px-2.5 py-2 rounded-md border border-worksheet-border bg-worksheet-field text-worksheet-ink text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>
            )}

            <div className={`mt-2 mb-2 pt-4 border-b border-worksheet-border pb-1 print:mt-0 print:mb-2 print:pt-0${!task.text?.trim() ? ' print:hidden' : ''}`}>
                <h3 className="text-xl font-bold leading-tight text-worksheet-ink">
                    {text}
                </h3>
            </div>
        </div>
    );
};
