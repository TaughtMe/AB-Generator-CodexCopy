import { z } from 'zod';
import type { Task, TaskType } from '../../types/worksheet';

/* ══════════════════════════════════════════════════
   operations.ts – Typisierte KI-Operationen auf dem Arbeitsblatt.

   Vertrag (Patch-Pipeline):
     KI-Ausgabe → parseOperations (Zod) → validateOperations (echte
     Task-IDs, Regeln) → Patch-Preview (Nutzer wählt) → Anwendung über
     worksheetStore-Mutationen (→ via zundo rückgängig machbar).

   Designentscheidungen:
   - Feldname `action` ist kompatibel zur bestehenden KI-Ausgabe von
     generateTaskRevisionResult (update_task/add_task) — bestehende
     Prompts funktionieren unverändert weiter.
   - Lehrer-/Differenzierungsfelder (solution, hints, difficulty, points,
     competence, estimatedTime, teacherNotes) laufen über das bestehende
     update_task – keine eigenen Operationstypen. Grund: die KI-Ausgabe
     durchläuft zuerst parseTaskRevisionOperations (Doppel-Parse); neue
     Aktionen müssten durch beide Parser. update_task trägt die validierten
     Felder bereits durch Validierung, Preview und Merge-Apply.
   - KI darf keine erfundenen Task-Referenzen verwenden: validate
     prüft jede taskId gegen den echten Bestand und liefert verständliche
     deutsche Fehlertexte für die UI.
   ══════════════════════════════════════════════════ */

const TASK_TYPES = [
    'multiple-choice', 'lineatur', 'cloze', 'image-placeholder', 'math',
    'page-break', 'columns', 'instruction', 'heading', 'table', 'information',
    'ordering',
] as const satisfies readonly TaskType[];

/* ── Schemas ── */

const updateTaskSchema = z.object({
    action: z.literal('update_task'),
    taskId: z.string().min(1),
    updates: z.record(z.string(), z.unknown()),
});

const addTaskSchema = z.object({
    action: z.literal('add_task'),
    type: z.enum(TASK_TYPES),
    /** Vollständige Task-Daten (ohne id). Fehlt payload, wird ein leerer Task des Typs erzeugt. */
    payload: z.record(z.string(), z.unknown()).optional(),
    /** Optional: hinter dieser Aufgabe einfügen (sonst am Ende). */
    afterTaskId: z.string().optional(),
});

const deleteTaskSchema = z.object({
    action: z.literal('delete_task'),
    taskId: z.string().min(1),
});

const moveTaskSchema = z.object({
    action: z.literal('move_task'),
    taskId: z.string().min(1),
    /** Zielindex in der Root-Reihenfolge (0-basiert, wird geklemmt). */
    toIndex: z.number().int().min(0),
});

const duplicateTaskSchema = z.object({
    action: z.literal('duplicate_task'),
    taskId: z.string().min(1),
});

const replaceTaskSchema = z.object({
    action: z.literal('replace_task'),
    taskId: z.string().min(1),
    /** Vollständiger Ersatz (Typwechsel erlaubt — updateTask im Store unterstützt das). */
    payload: z.record(z.string(), z.unknown()),
});

const noOpSchema = z.object({
    action: z.literal('no_op'),
    reason: z.string().optional(),
});

export const worksheetOperationSchema = z.discriminatedUnion('action', [
    updateTaskSchema,
    addTaskSchema,
    deleteTaskSchema,
    moveTaskSchema,
    duplicateTaskSchema,
    replaceTaskSchema,
    noOpSchema,
]);

export type WorksheetOperation = z.infer<typeof worksheetOperationSchema>;

/* ── Parsing ── */

export interface ParseResult {
    operations: WorksheetOperation[];
    /** Roh-Einträge, die kein gültiges Operations-Schema hatten. */
    rejected: { index: number; error: string }[];
}

/** Parst unbekannte KI-Ausgabe in typisierte Operationen (tolerant pro Eintrag). */
export function parseOperations(raw: unknown[]): ParseResult {
    const operations: WorksheetOperation[] = [];
    const rejected: ParseResult['rejected'] = [];

    raw.forEach((entry, index) => {
        const result = worksheetOperationSchema.safeParse(entry);
        if (result.success) {
            operations.push(result.data);
        } else {
            rejected.push({ index, error: result.error.issues[0]?.message ?? 'Ungültige Operation' });
        }
    });

    return { operations, rejected };
}

/* ── Validierung gegen den echten Bestand ── */

export interface ValidatedPatch {
    /** Anwendbare Operationen in Eingangsreihenfolge. */
    operations: WorksheetOperation[];
    /** Verständliche Fehlertexte für verworfene Operationen. */
    errors: string[];
}

/**
 * Prüft jede Operation gegen tasksById/taskIds:
 * - referenzierte Task-IDs müssen existieren (keine erfundenen Referenzen)
 * - delete/move nur für Root-Tasks (Spalten-Kinder laufen über den Container)
 * - no_op wird herausgefiltert
 */
export function validateOperations(
    operations: WorksheetOperation[],
    tasksById: Record<string, Task>,
    taskIds: string[],
): ValidatedPatch {
    const valid: WorksheetOperation[] = [];
    const errors: string[] = [];
    const rootIds = new Set(taskIds);
    /** delete-Ops im selben Patch — spätere Referenzen darauf sind ungültig. */
    const deleted = new Set<string>();

    const refError = (op: { taskId: string }, what: string) =>
        `${what}: Aufgabe "${op.taskId.slice(0, 8)}…" existiert nicht (KI-Referenzfehler).`;

    for (const op of operations) {
        switch (op.action) {
            case 'no_op':
                continue;

            case 'add_task':
                if (op.afterTaskId && !tasksById[op.afterTaskId]) {
                    // Ungültiger Anker ist kein Hard-Fail — wir hängen ans Ende.
                    valid.push({ ...op, afterTaskId: undefined });
                } else {
                    valid.push(op);
                }
                continue;

            case 'update_task':
            case 'replace_task':
                if (!tasksById[op.taskId] || deleted.has(op.taskId)) {
                    errors.push(refError(op, op.action === 'update_task' ? 'Ändern' : 'Ersetzen'));
                    continue;
                }
                valid.push(op);
                continue;

            case 'delete_task':
                if (!tasksById[op.taskId] || deleted.has(op.taskId)) {
                    errors.push(refError(op, 'Löschen'));
                    continue;
                }
                if (!rootIds.has(op.taskId)) {
                    errors.push(`Löschen: Aufgabe ist Teil eines Spalten-Layouts — bitte den Container bearbeiten.`);
                    continue;
                }
                deleted.add(op.taskId);
                valid.push(op);
                continue;

            case 'move_task':
                if (!tasksById[op.taskId] || deleted.has(op.taskId)) {
                    errors.push(refError(op, 'Verschieben'));
                    continue;
                }
                if (!rootIds.has(op.taskId)) {
                    errors.push(`Verschieben: Aufgabe ist Teil eines Spalten-Layouts.`);
                    continue;
                }
                valid.push(op);
                continue;

            case 'duplicate_task':
                if (!tasksById[op.taskId] || deleted.has(op.taskId)) {
                    errors.push(refError(op, 'Duplizieren'));
                    continue;
                }
                valid.push(op);
                continue;
        }
    }

    return { operations: valid, errors };
}

/* ── Zusammenfassung für die Preview-UI ── */

export interface OperationSummary {
    /** Kurzes Verb für das Badge, z. B. "Ändern". */
    badge: string;
    badgeTone: 'add' | 'change' | 'remove' | 'neutral';
    /** Betroffene Aufgabe (Nummer + Titel) oder Typname bei add. */
    target: string;
    /** Vorher-Auszug (Plaintext, gekürzt) — leer bei add. */
    before: string;
    /** Nachher-Auszug — leer bei delete/duplicate/move. */
    after: string;
}

function stripHtml(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function truncate(text: string, max = 90): string {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Bester Text-Auszug eines Tasks (typabhängiges Inhaltsfeld). */
function taskExcerpt(task: Partial<Task> | Record<string, unknown>): string {
    const t = task as Record<string, unknown>;
    const candidate = t.text ?? t.content ?? t.question ?? t.prompt ?? t.promptHtml ?? t.caption ?? '';
    return truncate(stripHtml(candidate));
}

const DIFFICULTY_LABELS_SHORT: Record<string, string> = { easy: 'leicht', medium: 'mittel', hard: 'schwer' };

/** Kurzbeschreibung geänderter Lehrer-/Differenzierungsfelder für die Preview. */
function describeTeacherFieldUpdates(updates: Record<string, unknown>): string {
    const parts: string[] = [];
    if (typeof updates.solution === 'string' && updates.solution.trim()) parts.push('Lösung');
    if (Array.isArray(updates.hints)) parts.push(`Hinweise (${updates.hints.length})`);
    if (typeof updates.points === 'number') parts.push(`Punkte: ${updates.points}`);
    if (typeof updates.difficulty === 'string' && DIFFICULTY_LABELS_SHORT[updates.difficulty]) {
        parts.push(`Schwierigkeit: ${DIFFICULTY_LABELS_SHORT[updates.difficulty]}`);
    }
    if (typeof updates.competence === 'string' && updates.competence.trim()) parts.push('Kompetenz');
    if (typeof updates.estimatedTime === 'number') parts.push(`Zeit: ${updates.estimatedTime} Min.`);
    if (typeof updates.teacherNotes === 'string' && updates.teacherNotes.trim()) parts.push('Notiz');
    return parts.join(' · ');
}

function visibleNumber(taskId: string, tasksById: Record<string, Task>, taskIds: string[]): string {
    let counter = 0;
    for (const id of taskIds) {
        const task = tasksById[id];
        if (!task || task.type === 'page-break') continue;
        if (task.showNumber !== false) counter += 1;
        if (id === taskId) return task.showNumber === false ? '' : `${counter}. `;
    }
    return '';
}

function targetLabel(taskId: string, tasksById: Record<string, Task>, taskIds: string[]): string {
    const task = tasksById[taskId];
    if (!task) return `Unbekannte Aufgabe (${taskId.slice(0, 8)}…)`;
    return `${visibleNumber(taskId, tasksById, taskIds)}${task.title || task.type}`;
}

export function summarizeOperation(
    op: WorksheetOperation,
    tasksById: Record<string, Task>,
    taskIds: string[],
): OperationSummary {
    switch (op.action) {
        case 'add_task': {
            const payload = (op.payload ?? {}) as Record<string, unknown>;
            const title = typeof payload.title === 'string' && payload.title.trim()
                ? payload.title
                : `Neue Aufgabe (${op.type})`;
            return {
                badge: 'Hinzufügen',
                badgeTone: 'add',
                target: title,
                before: '',
                after: taskExcerpt(payload),
            };
        }
        case 'update_task': {
            const contentAfter = taskExcerpt(op.updates);
            const teacherAfter = describeTeacherFieldUpdates(op.updates as Record<string, unknown>);
            return {
                badge: 'Ändern',
                badgeTone: 'change',
                target: targetLabel(op.taskId, tasksById, taskIds),
                before: taskExcerpt(tasksById[op.taskId] ?? {}),
                after: [contentAfter, teacherAfter].filter(Boolean).join(' · '),
            };
        }
        case 'replace_task':
            return {
                badge: 'Ersetzen',
                badgeTone: 'change',
                target: targetLabel(op.taskId, tasksById, taskIds),
                before: taskExcerpt(tasksById[op.taskId] ?? {}),
                after: taskExcerpt(op.payload),
            };
        case 'delete_task':
            return {
                badge: 'Löschen',
                badgeTone: 'remove',
                target: targetLabel(op.taskId, tasksById, taskIds),
                before: taskExcerpt(tasksById[op.taskId] ?? {}),
                after: '',
            };
        case 'move_task':
            return {
                badge: 'Verschieben',
                badgeTone: 'neutral',
                target: targetLabel(op.taskId, tasksById, taskIds),
                before: '',
                after: `Neue Position: ${op.toIndex + 1}`,
            };
        case 'duplicate_task':
            return {
                badge: 'Duplizieren',
                badgeTone: 'add',
                target: targetLabel(op.taskId, tasksById, taskIds),
                before: '',
                after: '',
            };
        case 'no_op':
            return { badge: 'Keine Änderung', badgeTone: 'neutral', target: op.reason ?? '', before: '', after: '' };
    }
}
