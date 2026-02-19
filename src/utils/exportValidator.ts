/**
 * exportValidator.ts – Pre-export validation
 *
 * Checks all tasks for potential issues before generating a Word/PDF export.
 * Returns an array of warnings (empty array = everything OK).
 */

import type { Task, ColumnsTask } from '../types/worksheet';

// ── Types ────────────────────────────────────────────────────

export interface ValidationWarning {
    taskId: string;
    taskTitle: string;
    message: string;
}

// ── Validation Logic ─────────────────────────────────────────

/**
 * Validates all tasks for export readiness.
 *
 * @param tasksById – flat map of all tasks
 * @param taskIds   – ordered list of task IDs
 * @returns Array of warnings. Empty = all tasks valid.
 */
export function validateForExport(
    tasksById: Record<string, Task>,
    taskIds: string[],
): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    for (const id of taskIds) {
        const task = tasksById[id];
        if (!task) continue;

        switch (task.type) {
            case 'lineatur':
                if (!task.gridColumns || task.gridColumns < 1) {
                    warnings.push({
                        taskId: id,
                        taskTitle: task.title,
                        message: 'Lineatur hat keine gültigen Spalten (gridColumns fehlt oder ist 0).',
                    });
                }
                break;

            case 'multiple-choice':
                if (!task.question || task.question.trim() === '') {
                    warnings.push({
                        taskId: id,
                        taskTitle: task.title,
                        message: 'Multiple-Choice-Aufgabe hat keine Frage.',
                    });
                }
                if (!task.options || task.options.length < 2) {
                    warnings.push({
                        taskId: id,
                        taskTitle: task.title,
                        message: 'Multiple-Choice-Aufgabe hat weniger als 2 Antwortmöglichkeiten.',
                    });
                }
                // Check if all options are empty
                if (task.options?.every((opt) => !opt.text || opt.text.trim() === '')) {
                    warnings.push({
                        taskId: id,
                        taskTitle: task.title,
                        message: 'Alle Antwortmöglichkeiten sind leer.',
                    });
                }
                break;

            case 'cloze':
                if (!task.content || task.content.trim() === '') {
                    warnings.push({
                        taskId: id,
                        taskTitle: task.title,
                        message: 'Lückentext hat keinen Inhalt.',
                    });
                }
                break;

            case 'math':
                if (!task.content || task.content.trim() === '') {
                    warnings.push({
                        taskId: id,
                        taskTitle: task.title,
                        message: 'Mathematik-Aufgabe enthält keine Formel.',
                    });
                }
                break;

            case 'image-placeholder':
                // No specific validation needed
                break;

            case 'page-break':
                // No specific validation needed
                break;

            case 'columns': {
                const cols = task as ColumnsTask;
                // Both slots empty
                if (!cols.children[0] && !cols.children[1]) {
                    warnings.push({
                        taskId: id,
                        taskTitle: task.title,
                        message: 'Spalten-Container hat keine Aufgaben zugewiesen.',
                    });
                }
                // Check referential integrity
                for (let s = 0; s < 2; s++) {
                    const childId = cols.children[s as 0 | 1];
                    if (childId && !tasksById[childId]) {
                        warnings.push({
                            taskId: id,
                            taskTitle: task.title,
                            message: `Spalte ${s + 1} referenziert eine nicht existierende Aufgabe.`,
                        });
                    }
                    // Forbidden child type
                    if (childId && tasksById[childId]) {
                        const childType = tasksById[childId].type;
                        if (childType === 'page-break') {
                            warnings.push({
                                taskId: id,
                                taskTitle: task.title,
                                message: `Spalte ${s + 1} enthält einen Seitenumbruch – das ist nicht erlaubt.`,
                            });
                        }
                        if (childType === 'columns') {
                            warnings.push({
                                taskId: id,
                                taskTitle: task.title,
                                message: `Spalte ${s + 1} enthält einen verschachtelten Spalten-Container – das ist nicht erlaubt.`,
                            });
                        }
                    }
                }
                break;
            }

            default: {
                const unknownTask = task as unknown as { title: string; type: string };
                warnings.push({
                    taskId: id,
                    taskTitle: unknownTask.title,
                    message: `Unbekannter Aufgabentyp: ${unknownTask.type}`,
                });
            }
        }
    }

    return warnings;
}

/**
 * Formats validation warnings into a human-readable string
 * for display in an alert / toast.
 */
export function formatWarnings(warnings: ValidationWarning[]): string {
    if (warnings.length === 0) return '';

    const lines = warnings.map(
        (w, i) => `${i + 1}. „${w.taskTitle}": ${w.message}`
    );

    return `Export-Warnung:\n\n${lines.join('\n')}`;
}
