import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import type { Task } from '../types/worksheet';
import { useSettingsStore } from '../store/settingsStore';

/* ══════════════════════════════════════════════════
   geminiService.ts – Google Gemini API Integration
   Provides generateTasks() and modifyTask() for
   the AI Import Wizard and per-task AI chat.
   API-Key + Curriculum-Kontext kommen aus settingsStore.
   ══════════════════════════════════════════════════ */

const MODEL_MAP = {
    flash: 'gemini-2.0-flash',
    pro: 'gemini-1.5-pro',
} as const;

/** ── API Key Management (delegates to SettingsStore) ── */
export function getApiKey(): string | null {
    const key = useSettingsStore.getState().apiKey;
    return key || null;
}

export function setApiKey(key: string): void {
    useSettingsStore.getState().setApiKey(key);
}

function getModel(): GenerativeModel {
    const { apiKey, geminiModel } = useSettingsStore.getState();
    if (!apiKey) throw new Error('Kein Gemini API-Key gesetzt. Bitte zuerst in den Einstellungen hinterlegen.');
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = MODEL_MAP[geminiModel] || MODEL_MAP.flash;
    return genAI.getGenerativeModel({ model: modelName });
}

/** ── System Prompt für Task-Generierung ── */
const BASE_SYSTEM_PROMPT = `Du bist ein erfahrener Lehrer und Aufgaben-Ersteller für Arbeitsblätter.
Erstelle Aufgaben nach dieser didaktischen Gewichtung:
- 40% Reproduktion (Wissen abrufen, einfache Fakten)
- 30% Reorganisation (Zusammenhänge erkennen, Ordnen)
- 20% Transfer (Wissen in neuen Kontexten anwenden)
- 10% Problemlösendes Denken (Kreative Lösungen, Analyse)

WICHTIG: Die Antwort muss ein valides JSON-Array sein, OHNE Markdown-Codeblöcke.
Jedes Element muss einem dieser Typen entsprechen:

1. Multiple-Choice:
{
  "type": "multiple-choice",
  "title": "Aufgabe: ...",
  "question": "Fragetext",
  "options": [
    { "text": "Option A", "isCorrect": true },
    { "text": "Option B", "isCorrect": false },
    { "text": "Option C", "isCorrect": false },
    { "text": "Option D", "isCorrect": false }
  ]
}

2. Lückentext:
{
  "type": "cloze",
  "title": "Aufgabe: ...",
  "content": "Der {{Hund}} ist ein {{Säugetier}}."
}

3. Lineatur (Schreiblinien):
{
  "type": "lineatur",
  "title": "Aufgabe: ...",
  "lineStyle": "lines-8mm",
  "gridColumns": 32
}

4. Mathematik-Formel:
{
  "type": "math",
  "title": "Aufgabe: ...",
  "content": "a^2 + b^2 = c^2"
}

Regeln:
- Erstelle GENAU die Anzahl an Aufgaben, die der Benutzer angibt (Standard: 4-6 gemischte Aufgaben)
- Aufgaben müssen altersgerecht für die angegebene Klassenstufe sein
- Formuliere klar und eindeutig auf Deutsch
- Multiple-Choice: immer genau 4 Optionen, genau 1 richtig
- Lückentext: markiere Lücken mit {{Wort}}
- Bei Lineatur: nutze "lines-8mm" für ältere Schüler, "primary-4-lines" für Klasse 1-2
- Wenn das Fach Mathematik, Physik oder Chemie ist: Verwende den Typ "math" für Aufgaben mit Formeln. Schreibe den LaTeX-Code OHNE Dollarzeichen direkt in das "content"-Feld.
`;

const MODIFY_SYSTEM_PROMPT = `Du bist ein erfahrener Lehrer-Assistent.
Du erhältst eine einzelne Aufgabe als JSON und eine Anweisung des Lehrers.
Modifiziere die Aufgabe GENAU nach der Anweisung.

WICHTIG: Die Antwort muss ein valides JSON-Objekt sein, OHNE Markdown-Codeblöcke.
Das Format muss exakt dem Eingabe-Format entsprechen (gleicher "type").
Behalte den ursprünglichen "type" bei, ändere ihn NICHT.
`;

/** Baut den System-Prompt mit optionalem Lehrplan-Kontext + Profildaten */
function buildSystemPrompt(options?: {
    subjectName?: string;
    curriculumText?: string;
    className?: string;
    classCharacteristic?: string;
}): string {
    const { curriculumContext } = useSettingsStore.getState();
    const parts: string[] = [];

    // Profile-based context injection
    if (options?.subjectName || options?.className) {
        let profilePrompt = 'Erstelle Aufgaben';
        if (options.subjectName) {
            profilePrompt += ` für ${options.subjectName}`;
        }
        if (options.curriculumText) {
            profilePrompt += ` unter Berücksichtigung von: ${options.curriculumText}`;
        }
        if (options.className) {
            profilePrompt += ` für die Klasse ${options.className}`;
            if (options.classCharacteristic) {
                profilePrompt += `, die ${options.classCharacteristic} ist`;
            }
        }
        profilePrompt += '.';
        parts.push(profilePrompt);
    }

    // Legacy curriculum context from settings
    if (curriculumContext.trim()) {
        parts.push(`Berücksichtige bei der Aufgabenerstellung zwingend diesen Lehrplan-Kontext:\n${curriculumContext.trim()}`);
    }

    if (parts.length === 0) return BASE_SYSTEM_PROMPT;

    return `${parts.join('\n\n')}\n\n${BASE_SYSTEM_PROMPT}`;
}

/* ── Hilfsfunktion: JSON aus Gemini-Antwort extrahieren ── */
function extractJSON(text: string): string {
    // Versuche Markdown-Codeblöcke zu entfernen
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) return codeBlockMatch[1].trim();

    // Versuche direktes JSON zu finden
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) return arrayMatch[0];

    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) return objMatch[0];

    return text.trim();
}

/** Validiert und normalisiert Tasks aus der KI-Antwort */
function validateAndNormalizeTasks(raw: unknown[]): Omit<Task, 'id'>[] {
    return raw
        .filter((item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null && 'type' in item
        )
        .map((item) => {
            const type = item.type as string;

            switch (type) {
                case 'multiple-choice':
                    return {
                        type: 'multiple-choice' as const,
                        title: String(item.title || 'Multiple-Choice'),
                        question: String(item.question || ''),
                        options: Array.isArray(item.options)
                            ? item.options.map((opt: Record<string, unknown>) => ({
                                id: crypto.randomUUID(),
                                text: String(opt.text || ''),
                                isCorrect: Boolean(opt.isCorrect),
                            }))
                            : [],
                    };

                case 'cloze':
                    return {
                        type: 'cloze' as const,
                        title: String(item.title || 'Lückentext'),
                        content: String(item.content || ''),
                    };

                case 'lineatur':
                    return {
                        type: 'lineatur' as const,
                        title: String(item.title || 'Lineatur'),
                        lineStyle: (['grid-5mm', 'grid-10mm', 'lines-8mm', 'primary-4-lines'].includes(String(item.lineStyle))
                            ? String(item.lineStyle)
                            : 'lines-8mm') as Task extends { lineStyle: infer L } ? L : never,
                        gridColumns: typeof item.gridColumns === 'number' ? item.gridColumns : 32,
                    };

                case 'math':
                    return {
                        type: 'math' as const,
                        title: String(item.title || 'Mathematik'),
                        content: String(item.content || ''),
                    };

                default:
                    return null;
            }
        })
        .map((item) => {
            // Auto-detect: if a cloze task contains $$...$$ blocks, convert to math
            if (item && item.type === 'cloze' && 'content' in item) {
                const content = (item as { content: string }).content;
                const mathMatch = content.match(/^\$\$(.+)\$\$$/s);
                if (mathMatch) {
                    return {
                        type: 'math' as const,
                        title: item.title,
                        content: mathMatch[1].trim(),
                    };
                }
            }
            return item;
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);
}

/** Validiert eine einzelne modifizierte Task */
function validateSingleTask(raw: Record<string, unknown>, originalType: string): Omit<Task, 'id'> | null {
    const tasks = validateAndNormalizeTasks([{ ...raw, type: originalType }]);
    return tasks.length > 0 ? tasks[0] : null;
}

/* ══════════════════════════════════════════════════
   Public API
   ══════════════════════════════════════════════════ */

export interface GenerateTasksOptions {
    topic: string;
    classLevel: string;
    schoolType?: string;
    difficultyLevel?: string;
    screenshotBase64?: string;
    taskCount?: number;
    // Profile context injection
    subjectName?: string;
    curriculumText?: string;
    className?: string;
    classCharacteristic?: string;
}

/**
 * Generiert Aufgaben zu einem Thema via Gemini.
 * Gibt ein Array von Tasks zurück (ohne IDs – die werden beim Import gesetzt).
 */
export async function generateTasks(options: GenerateTasksOptions): Promise<Omit<Task, 'id'>[]> {
    const model = getModel();

    const taskCountStr = options.taskCount
        ? `- Anzahl Aufgaben: GENAU ${options.taskCount} Aufgaben erstellen`
        : '- Anzahl Aufgaben: 4-6 gemischte Aufgaben';

    const userPrompt = `Erstelle Aufgaben für ein Arbeitsblatt:
- Thema: ${options.topic}
- Klassenstufe: ${options.classLevel}
${taskCountStr}
${options.schoolType ? `- Schulform: ${options.schoolType}` : ''}
${options.difficultyLevel ? `- Anforderungsniveau: ${options.difficultyLevel}` : ''}
${options.screenshotBase64 ? '\nDas angehängte Bild zeigt Kontext-Material, das als Grundlage dienen soll.' : ''}

Antworte NUR mit dem JSON-Array.`;

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: userPrompt },
    ];

    if (options.screenshotBase64) {
        parts.push({
            inlineData: {
                mimeType: 'image/png',
                data: options.screenshotBase64,
            },
        });
    }

    const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        systemInstruction: buildSystemPrompt({
            subjectName: options.subjectName,
            curriculumText: options.curriculumText,
            className: options.className,
            classCharacteristic: options.classCharacteristic,
        }),
    });

    const responseText = result.response.text();
    const jsonStr = extractJSON(responseText);

    let parsed: unknown[];
    try {
        parsed = JSON.parse(jsonStr);
    } catch {
        throw new Error(`Gemini hat kein valides JSON zurückgegeben:\n${responseText.substring(0, 500)}`);
    }

    if (!Array.isArray(parsed)) {
        throw new Error('Gemini-Antwort ist kein Array.');
    }

    const tasks = validateAndNormalizeTasks(parsed);
    if (tasks.length === 0) {
        throw new Error('Keine gültigen Aufgaben in der Gemini-Antwort gefunden.');
    }

    return tasks;
}

/**
 * Modifiziert eine einzelne Aufgabe via KI.
 * Sendet nur die Daten dieser spezifischen Aufgabe.
 */
export async function modifyTask(task: Task, instruction: string): Promise<Omit<Task, 'id'>> {
    const model = getModel();

    // ID entfernen – KI braucht sie nicht
    const { id: _, ...taskData } = task;

    const userPrompt = `Aktuelle Aufgabe:
${JSON.stringify(taskData, null, 2)}

Anweisung: ${instruction}

Antworte NUR mit dem modifizierten JSON-Objekt.`;

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: MODIFY_SYSTEM_PROMPT,
    });

    const responseText = result.response.text();
    const jsonStr = extractJSON(responseText);

    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(jsonStr);
    } catch {
        throw new Error(`Gemini hat kein valides JSON zurückgegeben:\n${responseText.substring(0, 500)}`);
    }

    const modified = validateSingleTask(parsed, task.type);
    if (!modified) {
        throw new Error('Die modifizierte Aufgabe konnte nicht validiert werden.');
    }

    return modified;
}
