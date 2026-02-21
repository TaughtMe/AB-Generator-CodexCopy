import { useWorksheetStore } from '../../store/worksheetStore';
import type { InstructionTask } from '../../types/worksheet';

interface Props {
    task: InstructionTask;
}

/**
 * Editor für "Reine Aufgabe" (type: 'instruction').
 * Zeigt einen frei-editierbaren Aufgabentext an – kein interaktives Element,
 * kein Lösungsfeld. Ideal für Arbeitsaufträge, Erklärungen, Überschriften.
 */
export function InstructionTaskEditor({ task }: Props) {
    const updateTask = useWorksheetStore((s) => s.updateTask);

    return (
        <div className="w-full">
            <textarea
                value={task.text}
                onChange={(e) => updateTask(task.id, { text: e.target.value } as Partial<InstructionTask>)}
                placeholder="Aufgabentext eingeben…"
                rows={4}
                className="w-full resize-y rounded-lg border border-worksheet-border bg-worksheet-field px-3 py-2 text-sm text-worksheet-ink placeholder:text-worksheet-inkLight focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors print:bg-transparent print:border-none"
            />
            <p className="mt-1 text-[10px] text-worksheet-inkLight">
                Freier Aufgabentext ohne Interaktion – erscheint direkt auf dem Arbeitsblatt.
            </p>
        </div>
    );
}
