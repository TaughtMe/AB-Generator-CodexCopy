import React from 'react';
import type { Task, TaskType } from '../../types/worksheet';
import { MultipleChoiceEditor } from './MultipleChoiceEditor';
import { LineaturEditor } from './LineaturEditor';
import { ClozeEditor } from './ClozeEditor';
import { ImagePlaceholderEditor } from './ImagePlaceholderEditor';
import { MathTaskEditor } from './MathTaskEditor';
import { ColumnsEditor } from './ColumnsEditor';
import { InstructionTaskEditor } from './InstructionTaskEditor';
import { HeadingEditor } from './HeadingEditor';
import { UnknownTaskFallback } from './UnknownTaskFallback';

/**
 * Task Component Registry
 * Maps task types to their editor components.
 * In the A4 live editor, there is no separate preview –
 * the editor IS the preview (WYSIWYG).
 */

interface TaskComponentRegistry {
    editor: React.ComponentType<{ task: Task }>;
}

/**
 * Zentraler Contract für Task-Editoren.
 *
 * Für neue Tasktypen (z. B. `table`) gilt zwingend:
 * 1) Typ in `TaskType` und Union `Task` ergänzen.
 * 2) Editor-Komponente mit Prop `{ task: Task }` bereitstellen.
 * 3) Mapping in `TASK_REGISTRY` hinterlegen.
 * 4) DOCX-Exportpfad (`taskRenderer` + Validator) für den Typ ergänzen,
 *    sonst fällt der Typ im Export auf Unknown-Fallback zurück.
 *
 * Warum dieser Registry-Ansatz:
 * - Der Editor bleibt offen für Erweiterungen, ohne zentrale Switch-Blöcke in
 *   mehreren UI-Dateien zu duplizieren.
 */
export const TASK_REGISTRY: Record<TaskType, TaskComponentRegistry> = {
    'multiple-choice': {
        editor: MultipleChoiceEditor as React.ComponentType<{ task: Task }>,
    },
    'lineatur': {
        editor: LineaturEditor as React.ComponentType<{ task: Task }>,
    },
    'cloze': {
        editor: ClozeEditor as React.ComponentType<{ task: Task }>,
    },
    'image-placeholder': {
        editor: ImagePlaceholderEditor as React.ComponentType<{ task: Task }>,
    },
    'math': {
        editor: MathTaskEditor as React.ComponentType<{ task: Task }>,
    },
    'page-break': {
        editor: (() => null) as React.ComponentType<{ task: Task }>, // Rendered separately – never shown in TaskCard
    },
    'columns': {
        editor: ColumnsEditor as React.ComponentType<{ task: Task }>,
    },
    'instruction': {
        editor: InstructionTaskEditor as React.ComponentType<{ task: Task }>,
    },
    'heading': {
        editor: HeadingEditor as React.ComponentType<{ task: Task }>,
    },
};

/**
 * Schlanker Resolver zwischen Taskdaten und passendem Editor.
 * Unknown-Fallback schützt UI und KI-Flows gegen unvollständige Migrationsstände.
 */
export const TaskEditorRenderer: React.FC<{ task: Task }> = ({ task }) => {
    const entry = TASK_REGISTRY[task.type];
    if (!entry) {
        return <UnknownTaskFallback type={task.type} />;
    }
    const Component = entry.editor;
    return <Component task={task} />;
};
