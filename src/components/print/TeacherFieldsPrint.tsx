import type { Task, TaskDifficulty } from '../../types/worksheet';

/* ══════════════════════════════════════════════════
   TeacherFieldsPrint – Lehrerinfo-Block pro Aufgabe (Phase 8).

   Rendert die gepflegten Lehrer-/Differenzierungsfelder (Lösung, Hinweise,
   Punkte, Schwierigkeit, Zeit, Kompetenz, Notizen) unter der Aufgabe.
   Standardmäßig per CSS ausgeblendet; nur in der Lehrerversion sichtbar
   (html[data-export-variant="teacher"] .print-teacher-block — analog zu den
   bestehenden MC-/Lückentext-Lösungen). Auf der Schülerfassung erscheint
   nichts davon.
   ══════════════════════════════════════════════════ */

const DIFFICULTY_LABELS: Record<TaskDifficulty, string> = {
    easy: 'Leicht',
    medium: 'Mittel',
    hard: 'Schwer',
};

export function TeacherFieldsPrint({ task }: { task: Task }) {
    const hasMeta =
        task.points != null
        || Boolean(task.difficulty)
        || task.estimatedTime != null
        || Boolean(task.competence?.trim());
    const hasSolution = Boolean(task.solution?.trim());
    const hasHints = Array.isArray(task.hints) && task.hints.length > 0;
    const hasNotes = Boolean(task.teacherNotes?.trim());

    if (!hasMeta && !hasSolution && !hasHints && !hasNotes) return null;

    return (
        <div className="print-teacher-block" data-teacher-block>
            <div className="print-teacher-block__label">Lehrerinfo</div>

            {hasMeta && (
                <div className="print-teacher-block__meta">
                    {task.points != null && <span>Punkte: {task.points}</span>}
                    {task.difficulty && <span>Schwierigkeit: {DIFFICULTY_LABELS[task.difficulty]}</span>}
                    {task.estimatedTime != null && <span>Zeit: {task.estimatedTime} Min.</span>}
                    {task.competence?.trim() && <span>Kompetenz: {task.competence}</span>}
                </div>
            )}

            {hasSolution && (
                <div className="print-teacher-block__section">
                    <span className="print-teacher-block__heading">Lösung</span>
                    <div
                        className="print-teacher-block__solution"
                        dangerouslySetInnerHTML={{ __html: task.solution as string }}
                    />
                </div>
            )}

            {hasHints && (
                <div className="print-teacher-block__section">
                    <span className="print-teacher-block__heading">Hinweise</span>
                    <ul className="print-teacher-block__hints">
                        {task.hints!.map((hint, index) => (
                            <li key={index}>{hint}</li>
                        ))}
                    </ul>
                </div>
            )}

            {hasNotes && (
                <div className="print-teacher-block__section">
                    <span className="print-teacher-block__heading">Notiz</span>
                    <div className="print-teacher-block__notes">{task.teacherNotes}</div>
                </div>
            )}
        </div>
    );
}
