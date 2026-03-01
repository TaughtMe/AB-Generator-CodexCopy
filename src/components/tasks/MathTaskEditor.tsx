import React from 'react';
import type { MathTask } from '../../types/worksheet';
import { useWorksheetStore } from '../../store/worksheetStore';
import { MathInput } from './MathInput';

/* ══════════════════════════════════════════════════
   MathTaskEditor – Connects MathInput to the Task System
   ══════════════════════════════════════════════════ */

interface MathTaskEditorProps {
    task: MathTask;
    isActive?: boolean;
}

export const MathTaskEditor: React.FC<MathTaskEditorProps> = ({ task, isActive = true }) => {
    const updateTask = useWorksheetStore((s) => s.updateTask);

    const handleChange = (content: string) => {
        updateTask(task.id, { content });
    };

    return <MathInput value={task.content} onChange={handleChange} isActive={isActive} />;
};
