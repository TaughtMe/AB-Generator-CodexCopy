import { useWorksheetStore } from '../../store/worksheetStore';
import type { InstructionTask } from '../../types/worksheet';
import { RichTextEditor } from '../editor/RichTextEditor';
import { VocabularyList } from '../editor/shared/VocabularyList';

interface Props {
    task: InstructionTask;
    isActive?: boolean;
}

/**
 * Editor für "Reine Aufgabe" (type: 'instruction').
 * Nutzt Tiptap-Rich-Text für Fett, Kursiv, Unterstrichen, Listen.
 * Abwärtskompatibel: Plain-Text wird automatisch in HTML migriert.
 */
export function InstructionTaskEditor({ task, isActive = true }: Props) {
    const updateTask = useWorksheetStore((s) => s.updateTask);

    return (
        <div className="w-full">
            <RichTextEditor
                value={task.text}
                onChange={(html) => updateTask(task.id, { text: html } as Partial<InstructionTask>)}
                placeholder="Aufgabentext eingeben…"
                minRows={3}
                hideToolbar={!isActive}
                taskId={task.id}
            />
            {isActive && (
                <p className="mt-1 text-[10px] text-worksheet-inkLight no-print">
                    Freier Aufgabentext – formatiere mit der Toolbar (Fett, Kursiv, Listen).
                </p>
            )}
            <VocabularyList vocabulary={task.vocabulary} taskId={task.id} />
        </div>
    );
}
