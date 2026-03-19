import { useWorksheetStore } from '../../store/worksheetStore';
import type { InformationTask } from '../../types/worksheet';
import { RichTextEditor } from '../editor/RichTextEditor';

interface Props {
    task: InformationTask;
    isActive?: boolean;
}

/**
 * Editor für "Information / Sachtext" (type: 'information').
 * Reiner Info-Block ohne Punktevergabe oder Antwortfelder.
 */
export function InformationTaskEditor({ task, isActive = true }: Props) {
    const updateTask = useWorksheetStore((s) => s.updateTask);

    return (
        <div className="w-full">
            <RichTextEditor
                value={task.text}
                onChange={(html) => updateTask(task.id, { text: html } as Partial<InformationTask>)}
                placeholder="Informationstext eingeben…"
                minRows={4}
                hideToolbar={!isActive}
            />
            {isActive && (
                <p className="mt-1 text-[10px] text-worksheet-inkLight no-print">
                    Informationsblock – wird als Sachtext ohne Aufgabennummer angezeigt.
                </p>
            )}
        </div>
    );
}
