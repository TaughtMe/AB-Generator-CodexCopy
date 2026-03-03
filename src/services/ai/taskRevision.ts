import type { ChatMessage } from '../../types/ai';
import type { Task, WorksheetSource } from '../../types/worksheet';

export const AI_JSON_TRUNCATED_USER_MESSAGE =
    'Die KI-Antwort für Aufgabenänderungen wurde abgeschnitten. Bitte formuliere die Anfrage kürzer oder versuche es erneut.';

export interface AIClassContext {
    className?: string;
    subjectName?: string;
    curriculumContext?: string;
    studentProfile?: string;
}

export type TaskRevisionOperation =
    | {
        action: 'update_task';
        taskId: string;
        updates: Partial<Task>;
    }
    | {
        action: 'add_task';
        type: Task['type'];
        payload?: Omit<Task, 'id'>;
    };

export interface TaskRevisionResult {
    operations: TaskRevisionOperation[];
}

const REVISION_SUPPORTED_ADD_PAYLOAD_TYPES = new Set<Task['type']>([
    'multiple-choice',
    'cloze',
    'math',
]);

const ALL_TASK_TYPES = new Set<Task['type']>([
    'multiple-choice',
    'lineatur',
    'cloze',
    'image-placeholder',
    'math',
    'page-break',
    'columns',
    'instruction',
    'heading',
]);

export const TASK_REVISION_SYSTEM_PROMPT = `Du bist ein präziser Editor für Arbeitsblatt-Aufgaben.
Deine Aufgabe ist es, aus einer Lehreranweisung konkrete Änderungsoperationen für bestehende Aufgaben abzuleiten.

WICHTIG:
- Antworte NUR mit einem validen JSON-Objekt (kein Markdown, keine Erklärungen).
- Erfinde keine Aufgabenreferenzen.
- Wenn keine sichere Änderung ableitbar ist, gib "operations": [] zurück.
- Nutze für bestehende Aufgaben bevorzugt "taskNumber" (sichtbare Nummer im Arbeitsblatt).
- Nutze "add_task" nur, wenn ausdrücklich neue Aufgaben gewünscht sind.
- NIEMALS eigenständige Lineatur-Blöcke ("type": "lineatur") als add_task erzeugen.
  Wenn eine Aufgabe Schreibzeilen benötigt, setze stattdessen "linesAfter" (Zeilenanzahl 1-10) und optional "linesAfterStyle" ("lines-8mm"|"primary-4-lines"|"grid-5mm"|"grid-10mm") als Feld im jeweiligen Aufgaben-Update/-Payload.

Erwartetes Ausgabeformat:
{
  "operations": [
    {
      "action": "update_task",
      "taskNumber": 2,
      "updates": {
        "title": "Aufgabe: ...",
        "question": "...",
        "options": [
          { "text": "A", "isCorrect": false },
          { "text": "B", "isCorrect": true },
          { "text": "C", "isCorrect": false },
          { "text": "D", "isCorrect": false }
        ]
      }
    },
    {
      "action": "add_task",
      "payload": {
        "type": "cloze",
        "title": "Aufgabe: ...",
        "content": "..."
      }
    }
  ]
}`;

type VisibleTaskEntry = {
    taskId: string;
    task: Task;
    taskNumber: number | null;
};

function getVisibleTaskEntries(tasksById: Record<string, Task>, taskIds: string[]): VisibleTaskEntry[] {
    let counter = 0;
    const entries: VisibleTaskEntry[] = [];

    for (const taskId of taskIds) {
        const task = tasksById[taskId];
        if (!task) continue;

        if (task.type === 'page-break' || task.showNumber === false) {
            entries.push({ taskId, task, taskNumber: null });
            continue;
        }

        counter += 1;
        entries.push({ taskId, task, taskNumber: counter });
    }

    return entries;
}

function summarizeTaskForRevision(entry: VisibleTaskEntry): Record<string, unknown> {
    const base: Record<string, unknown> = {
        taskId: entry.taskId,
        taskNumber: entry.taskNumber,
        type: entry.task.type,
        title: entry.task.title,
    };

    switch (entry.task.type) {
        case 'multiple-choice':
            base.question = entry.task.question;
            base.options = entry.task.options.map((option) => ({
                text: option.text,
                isCorrect: option.isCorrect,
            }));
            break;
        case 'cloze':
            base.content = entry.task.content;
            break;
        case 'lineatur':
            base.lineStyle = entry.task.lineStyle;
            base.gridColumns = entry.task.gridColumns;
            base.lineRows = entry.task.lineRows;
            base.promptHtml = entry.task.promptHtml;
            break;
        case 'math':
            base.content = entry.task.content;
            break;
        case 'instruction':
        case 'heading':
            base.text = entry.task.text;
            break;
        case 'image-placeholder':
            base.caption = entry.task.caption;
            base.widthMm = entry.task.widthMm;
            base.heightMm = entry.task.heightMm;
            break;
        case 'columns':
            base.layout = entry.task.layout;
            base.gapMm = entry.task.gapMm;
            base.children = entry.task.children;
            break;
        case 'page-break':
            break;
        default:
            break;
    }

    if (entry.task.showNumber === false) {
        base.showNumber = false;
    }

    return base;
}

export function buildTaskRevisionUserPrompt(params: {
    messages: ChatMessage[];
    tasksById: Record<string, Task>;
    taskIds: string[];
    sources: WorksheetSource[];
    aiClassContext?: AIClassContext;
}): string {
    const entries = getVisibleTaskEntries(params.tasksById, params.taskIds);
    const taskSnapshot = entries.map(summarizeTaskForRevision);
    const transcript = params.messages
        .filter((message) => message.content.trim())
        .map((message) => `${message.role === 'user' ? 'Lehrkraft' : 'Assistent'}: ${message.content.trim()}`)
        .join('\n\n');

    const classContextLines: string[] = [];
    if (params.aiClassContext?.className) classContextLines.push(`- Klasse: ${params.aiClassContext.className}`);
    if (params.aiClassContext?.subjectName) classContextLines.push(`- Fach: ${params.aiClassContext.subjectName}`);
    if (params.aiClassContext?.studentProfile) classContextLines.push(`- Lernprofil: ${params.aiClassContext.studentProfile}`);
    if (params.aiClassContext?.curriculumContext) {
        classContextLines.push(`- Lehrplan-Kontext: ${params.aiClassContext.curriculumContext}`);
    }

    const sourceLines = params.sources.slice(0, 8).map((source) => `- ${source.title || source.url} (${source.url})`);

    return `Leite aus dem folgenden Kontext nur konkrete Aufgabenänderungen ab.

${classContextLines.length > 0 ? `KLASSENKONTEXT:\n${classContextLines.join('\n')}\n\n` : ''}${sourceLines.length > 0 ? `QUELLEN:\n${sourceLines.join('\n')}\n\n` : ''}AKTUELLER AUFGABENSTAND (JSON):
${JSON.stringify(taskSnapshot, null, 2)}

CHATVERLAUF / ANWEISUNG:
${transcript}

Hinweise:
- Beziehe dich bei "Aufgabe 1/2/3" auf "taskNumber".
- Für "add_task" verwende nach Möglichkeit ein vollständiges "payload" mit type/title/content etc.
- Für "update_task" ändere nur die Felder, die angepasst werden sollen.
- Wenn die Anweisung eher Gespräch ist (keine konkrete Änderung), gib "operations": [] zurück.`;
}

export function looksLikeTruncatedJson(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (/[}\]]\s*$/.test(trimmed)) return false;

    let balance = 0;
    for (const ch of trimmed) {
        if (ch === '{' || ch === '[') balance += 1;
        if (ch === '}' || ch === ']') balance -= 1;
    }

    return balance > 0;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
}

function parseNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function normalizeClozePlaceholders(content: string): string {
    return content.replace(/\{\{(.*?)\}\}/g, '[$1]');
}

function normalizeRevisionAddTaskPayload(raw: Record<string, unknown>): Omit<Task, 'id'> | null {
    const type = parseString(raw.type);
    if (!type || !REVISION_SUPPORTED_ADD_PAYLOAD_TYPES.has(type as Task['type'])) {
        return null;
    }

    if (type === 'multiple-choice') {
        return {
            type: 'multiple-choice',
            title: String(raw.title || 'Multiple-Choice'),
            question: String(raw.question || ''),
            options: Array.isArray(raw.options)
                ? raw.options
                    .filter(isObjectRecord)
                    .map((option) => ({
                        id: crypto.randomUUID(),
                        text: String(option.text || ''),
                        isCorrect: Boolean(option.isCorrect),
                    }))
                : [],
        } as Omit<Task, 'id'>;
    }

    if (type === 'cloze') {
        const content = normalizeClozePlaceholders(String(raw.content || ''));
        const mathMatch = content.match(/^\$\$(.+)\$\$$/s);
        if (mathMatch) {
            return {
                type: 'math',
                title: String(raw.title || 'Lückentext'),
                content: mathMatch[1].trim(),
            } as Omit<Task, 'id'>;
        }

        return {
            type: 'cloze',
            title: String(raw.title || 'Lückentext'),
            content,
        } as Omit<Task, 'id'>;
    }

    if (type === 'lineatur') {
        // Standalone lineatur blocks are no longer supported via AI revision.
        // Return null so they are silently dropped.
        return null;
    }

    return {
        type: 'math',
        title: String(raw.title || 'Mathematik'),
        content: String(raw.content || ''),
    } as Omit<Task, 'id'>;
}

function sanitizeCommonTaskUpdate(rawUpdates: Record<string, unknown>): Partial<Task> {
    const common: Partial<Task> = {};
    const title = parseString(rawUpdates.title);
    const showNumber = parseBoolean(rawUpdates.showNumber);
    const accentColor = parseString(rawUpdates.accentColor);

    if (title !== undefined) common.title = title;
    if (showNumber !== undefined) common.showNumber = showNumber;
    if (accentColor !== undefined) common.accentColor = accentColor;

    return common;
}

function sanitizeRevisionUpdatesForTask(task: Task, rawUpdates: Record<string, unknown>): Partial<Task> | null {
    const updates: Partial<Task> = sanitizeCommonTaskUpdate(rawUpdates);

    switch (task.type) {
        case 'multiple-choice': {
            const question = parseString(rawUpdates.question);
            if (question !== undefined) {
                (updates as Partial<Extract<Task, { type: 'multiple-choice' }>>).question = question;
            }

            if (Array.isArray(rawUpdates.options)) {
                const options = rawUpdates.options
                    .filter(isObjectRecord)
                    .map((option) => ({
                        id: crypto.randomUUID(),
                        text: String(option.text ?? ''),
                        isCorrect: Boolean(option.isCorrect),
                    }));
                if (options.length > 0) {
                    if (!options.some((opt) => opt.isCorrect)) {
                        options[0].isCorrect = true;
                    }
                    (updates as Partial<Extract<Task, { type: 'multiple-choice' }>>).options = options;
                }
            }
            break;
        }
        case 'cloze': {
            const content = parseString(rawUpdates.content);
            if (content !== undefined) {
                (updates as Partial<Extract<Task, { type: 'cloze' }>>).content = normalizeClozePlaceholders(content);
            }
            const gapStyle = parseString(rawUpdates.gapStyle);
            if (gapStyle === 'continuous' || gapStyle === 'per-letter') {
                (updates as Partial<Extract<Task, { type: 'cloze' }>>).gapStyle = gapStyle;
            }
            const gapMultiplier = parseNumber(rawUpdates.gapMultiplier);
            if (gapMultiplier !== undefined) {
                (updates as Partial<Extract<Task, { type: 'cloze' }>>).gapMultiplier = gapMultiplier;
            }
            break;
        }
        case 'lineatur': {
            const promptHtml = parseString(rawUpdates.promptHtml);
            const lineStyle = parseString(rawUpdates.lineStyle);
            const gridColumns = parseNumber(rawUpdates.gridColumns);
            const lineRows = parseNumber(rawUpdates.lineRows);

            if (promptHtml !== undefined) {
                (updates as Partial<Extract<Task, { type: 'lineatur' }>>).promptHtml = promptHtml;
            }
            if (lineStyle && ['grid-5mm', 'grid-10mm', 'lines-8mm', 'primary-4-lines'].includes(lineStyle)) {
                (updates as Partial<Extract<Task, { type: 'lineatur' }>>).lineStyle = lineStyle as Extract<
                    Task,
                    { type: 'lineatur' }
                >['lineStyle'];
            }
            if (gridColumns !== undefined) {
                (updates as Partial<Extract<Task, { type: 'lineatur' }>>).gridColumns = gridColumns;
            }
            if (lineRows !== undefined) {
                (updates as Partial<Extract<Task, { type: 'lineatur' }>>).lineRows = lineRows;
            }
            break;
        }
        case 'math': {
            const content = parseString(rawUpdates.content);
            if (content !== undefined) {
                (updates as Partial<Extract<Task, { type: 'math' }>>).content = content;
            }
            break;
        }
        case 'instruction':
        case 'heading': {
            const text = parseString(rawUpdates.text);
            if (text !== undefined) {
                (updates as Partial<typeof task>).text = text;
            }
            break;
        }
        case 'image-placeholder': {
            const caption = parseString(rawUpdates.caption);
            const widthMm = parseNumber(rawUpdates.widthMm);
            const heightMm = parseNumber(rawUpdates.heightMm);
            const imageAlign = parseString(rawUpdates.imageAlign);

            if (caption !== undefined) {
                (updates as Partial<Extract<Task, { type: 'image-placeholder' }>>).caption = caption;
            }
            if (widthMm !== undefined) {
                (updates as Partial<Extract<Task, { type: 'image-placeholder' }>>).widthMm = widthMm;
            }
            if (heightMm !== undefined) {
                (updates as Partial<Extract<Task, { type: 'image-placeholder' }>>).heightMm = heightMm;
            }
            if (imageAlign && ['left', 'center', 'right'].includes(imageAlign)) {
                (updates as Partial<Extract<Task, { type: 'image-placeholder' }>>).imageAlign = imageAlign as Extract<
                    Task,
                    { type: 'image-placeholder' }
                >['imageAlign'];
            }
            break;
        }
        case 'columns': {
            const layout = parseString(rawUpdates.layout);
            const gapMm = parseNumber(rawUpdates.gapMm);
            if (layout && ['50-50', '60-40', '40-60'].includes(layout)) {
                (updates as Partial<Extract<Task, { type: 'columns' }>>).layout = layout as Extract<
                    Task,
                    { type: 'columns' }
                >['layout'];
            }
            if (gapMm !== undefined) {
                (updates as Partial<Extract<Task, { type: 'columns' }>>).gapMm = gapMm;
            }
            break;
        }
        case 'page-break':
            break;
        default:
            break;
    }

    return Object.keys(updates).length > 0 ? updates : null;
}

function parseTaskNumberReference(rawOperation: Record<string, unknown>): number | undefined {
    const taskNumber = parseNumber(rawOperation.taskNumber);
    if (taskNumber !== undefined) return Math.trunc(taskNumber);

    const target = rawOperation.target;
    if (isObjectRecord(target)) {
        const nested = parseNumber(target.taskNumber);
        if (nested !== undefined) return Math.trunc(nested);
    }
    return undefined;
}

function parseTaskIdReference(rawOperation: Record<string, unknown>): string | undefined {
    const direct = parseString(rawOperation.taskId);
    if (direct) return direct;

    const target = rawOperation.target;
    if (isObjectRecord(target)) {
        const nested = parseString(target.taskId);
        if (nested) return nested;
    }
    return undefined;
}

export function parseTaskRevisionOperations(
    rawOperations: unknown,
    tasksById: Record<string, Task>,
    taskIds: string[],
): TaskRevisionOperation[] {
    if (!Array.isArray(rawOperations)) return [];

    const visibleTaskEntries = getVisibleTaskEntries(tasksById, taskIds);
    const taskIdByVisibleNumber = new Map<number, string>();
    for (const entry of visibleTaskEntries) {
        if (typeof entry.taskNumber === 'number') {
            taskIdByVisibleNumber.set(entry.taskNumber, entry.taskId);
        }
    }

    const operations: TaskRevisionOperation[] = [];

    for (const rawOperation of rawOperations) {
        if (!isObjectRecord(rawOperation)) continue;
        const action = parseString(rawOperation.action);

        if (action === 'update_task') {
            const taskIdRef = parseTaskIdReference(rawOperation);
            const taskNumberRef = parseTaskNumberReference(rawOperation);
            const taskId = taskIdRef || (typeof taskNumberRef === 'number' ? taskIdByVisibleNumber.get(taskNumberRef) : undefined);
            if (!taskId) continue;

            const currentTask = tasksById[taskId];
            if (!currentTask) continue;

            const rawUpdates = isObjectRecord(rawOperation.updates) ? rawOperation.updates : undefined;
            if (!rawUpdates) continue;

            const updates = sanitizeRevisionUpdatesForTask(currentTask, rawUpdates);
            if (!updates) continue;

            operations.push({
                action: 'update_task',
                taskId,
                updates,
            });
            continue;
        }

        if (action !== 'add_task') continue;

        const payloadCandidate = isObjectRecord(rawOperation.payload) ? rawOperation.payload : undefined;
        if (payloadCandidate) {
            const normalized = normalizeRevisionAddTaskPayload(payloadCandidate);
            if (normalized) {
                operations.push({
                    action: 'add_task',
                    type: normalized.type,
                    payload: normalized,
                });
                continue;
            }
        }

        const type = parseString(rawOperation.type) || (payloadCandidate ? parseString(payloadCandidate.type) : undefined);
        if (type && ALL_TASK_TYPES.has(type as Task['type'])) {
            operations.push({
                action: 'add_task',
                type: type as Task['type'],
            });
        }
    }

    return operations;
}
