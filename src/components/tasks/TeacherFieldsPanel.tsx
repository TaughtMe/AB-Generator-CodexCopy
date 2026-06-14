import { useEffect, useState } from 'react';
import { GraduationCap, X } from 'lucide-react';
import type { Task, TaskDifficulty } from '../../types/worksheet';
import { ICON_SIZES } from '../ui/iconSizes';

/* ══════════════════════════════════════════════════
   TeacherFieldsPanel – manuelle Bearbeitung der Phase-8-Lehrerfelder.

   Bewusst rein manuell (keine KI-Aktionen, kein Export-Umbau). Editiert die
   optionalen BaseTask-Felder solution, hints, points, difficulty, competence,
   estimatedTime, teacherNotes und committet über onChange → worksheetStore.
   Nur im Editor sichtbar (Mount in TaskCard ist auf isActive gegated +
   print:hidden), erscheint also nicht auf der Schüler-/Druckfassung.
   ══════════════════════════════════════════════════ */

interface TeacherFieldsPanelProps {
    task: Task;
    onChange: (updates: Partial<Task>) => void;
    onClose: () => void;
}

const DIFFICULTY_OPTIONS: { value: TaskDifficulty; label: string }[] = [
    { value: 'easy', label: 'Leicht' },
    { value: 'medium', label: 'Mittel' },
    { value: 'hard', label: 'Schwer' },
];

const fieldClass =
    'w-full rounded-md border border-worksheet-border bg-white px-2 py-1.5 text-xs text-worksheet-ink outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/40';
const labelClass = 'block text-[10px] font-semibold uppercase tracking-wide text-worksheet-inkLight mb-1';

export function TeacherFieldsPanel({ task, onChange, onClose }: TeacherFieldsPanelProps) {
    // Lokaler Entwurf für Freitextfelder; Commit on blur (wie der Titel in TaskCard).
    const [solution, setSolution] = useState(task.solution ?? '');
    const [hintsText, setHintsText] = useState((task.hints ?? []).join('\n'));
    const [competence, setCompetence] = useState(task.competence ?? '');
    const [teacherNotes, setTeacherNotes] = useState(task.teacherNotes ?? '');

    // Bei externer Änderung (z. B. KI-Update) den Entwurf nachziehen.
    useEffect(() => setSolution(task.solution ?? ''), [task.solution]);
    useEffect(() => setHintsText((task.hints ?? []).join('\n')), [task.hints]);
    useEffect(() => setCompetence(task.competence ?? ''), [task.competence]);
    useEffect(() => setTeacherNotes(task.teacherNotes ?? ''), [task.teacherNotes]);

    const commitNumber = (key: 'points' | 'estimatedTime', raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return onChange({ [key]: undefined } as Partial<Task>);
        const value = Number(trimmed);
        if (Number.isFinite(value) && value >= 0) onChange({ [key]: value } as Partial<Task>);
    };

    return (
        <div className="teacher-fields-panel print:hidden mt-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    <GraduationCap className={ICON_SIZES[14]} />
                    Lehrer / Differenzierung
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-0.5 text-blue-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/40"
                    title="Schließen"
                    aria-label="Schließen"
                >
                    <X className={ICON_SIZES[14]} />
                </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <div>
                    <label className={labelClass}>Punkte</label>
                    <input
                        type="number"
                        min={0}
                        data-teacher-field="points"
                        defaultValue={task.points ?? ''}
                        key={`points-${task.points ?? ''}`}
                        onBlur={(e) => commitNumber('points', e.target.value)}
                        className={fieldClass}
                    />
                </div>
                <div>
                    <label className={labelClass}>Schwierigkeit</label>
                    <select
                        data-teacher-field="difficulty"
                        value={task.difficulty ?? ''}
                        onChange={(e) => onChange({ difficulty: (e.target.value || undefined) as TaskDifficulty | undefined })}
                        className={`${fieldClass} cursor-pointer`}
                    >
                        <option value="">—</option>
                        {DIFFICULTY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Zeit (Min.)</label>
                    <input
                        type="number"
                        min={0}
                        data-teacher-field="estimatedTime"
                        defaultValue={task.estimatedTime ?? ''}
                        key={`time-${task.estimatedTime ?? ''}`}
                        onBlur={(e) => commitNumber('estimatedTime', e.target.value)}
                        className={fieldClass}
                    />
                </div>
            </div>

            <div className="mt-2">
                <label className={labelClass}>Kompetenz / Lernziel</label>
                <input
                    type="text"
                    data-teacher-field="competence"
                    value={competence}
                    onChange={(e) => setCompetence(e.target.value)}
                    onBlur={() => onChange({ competence: competence.trim() || undefined })}
                    placeholder="z. B. K2 Problemlösen"
                    className={fieldClass}
                />
            </div>

            <div className="mt-2">
                <label className={labelClass}>Lösung / Erwartungshorizont</label>
                <textarea
                    rows={2}
                    data-teacher-field="solution"
                    value={solution}
                    onChange={(e) => setSolution(e.target.value)}
                    onBlur={() => onChange({ solution: solution.trim() || undefined })}
                    placeholder="Musterlösung…"
                    className={`${fieldClass} resize-y`}
                />
            </div>

            <div className="mt-2">
                <label className={labelClass}>Hinweise (eine Zeile pro Tipp)</label>
                <textarea
                    rows={2}
                    data-teacher-field="hints"
                    value={hintsText}
                    onChange={(e) => setHintsText(e.target.value)}
                    onBlur={() => {
                        const hints = hintsText.split('\n').map((h) => h.trim()).filter(Boolean);
                        onChange({ hints: hints.length > 0 ? hints : undefined });
                    }}
                    placeholder={'Tipp 1\nTipp 2'}
                    className={`${fieldClass} resize-y`}
                />
            </div>

            <div className="mt-2">
                <label className={labelClass}>Lehrernotizen (nur intern)</label>
                <textarea
                    rows={2}
                    data-teacher-field="teacherNotes"
                    value={teacherNotes}
                    onChange={(e) => setTeacherNotes(e.target.value)}
                    onBlur={() => onChange({ teacherNotes: teacherNotes.trim() || undefined })}
                    placeholder="Interne Notizen…"
                    className={`${fieldClass} resize-y`}
                />
            </div>
        </div>
    );
}
