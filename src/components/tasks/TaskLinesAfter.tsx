import type { Task } from '../../types/worksheet';
import { LineaturLines } from './LineaturLines';

/* ══════════════════════════════════════════════════
   TaskLinesAfter – Schreibzeilen direkt UNTER einer Aufgabe.

   Rendert das Feld BaseTask.linesAfter (+ linesAfterStyle) als
   Antwortbereich, der visuell zur Aufgabe gehört (kein eigener Block,
   keine eigene Nummer). Wird vom Editor und vom Druck/Export unter der
   jeweiligen Aufgabe gerendert. Ohne linesAfter (>0) wird nichts gerendert.
   ══════════════════════════════════════════════════ */

export function TaskLinesAfter({ task }: { task: Task }) {
    const count = task.linesAfter;
    if (typeof count !== 'number' || count < 1) return null;

    return (
        <div className="mt-2 print:mt-1" data-lines-after={count}>
            <LineaturLines
                lineStyle={task.linesAfterStyle ?? 'lines-8mm'}
                rowCount={Math.max(1, Math.min(20, Math.round(count)))}
            />
        </div>
    );
}
