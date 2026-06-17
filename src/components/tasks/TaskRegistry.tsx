import React, { Suspense } from 'react';
import type { Task, TaskType } from '../../types/worksheet';
import { MultipleChoiceEditor } from './MultipleChoiceEditor';
import { LineaturEditor } from './LineaturEditor';
import { ClozeEditor } from './ClozeEditor';
import { ImagePlaceholderEditor } from './ImagePlaceholderEditor';
import { ColumnsEditor } from './ColumnsEditor';
import { InstructionTaskEditor } from './InstructionTaskEditor';
import { InformationTaskEditor } from './InformationTaskEditor';
import { HeadingEditor } from './HeadingEditor';
import { TableEditor } from './TableEditor';
import { OrderingTaskEditor } from './OrderingTaskEditor';
import { UnknownTaskFallback } from './UnknownTaskFallback';

// MathTaskEditor (+ katex + dompurify) wird erst bei Bedarf geladen.
const LazyMathTaskEditor = React.lazy(() =>
    import('./MathTaskEditor').then((m) => ({ default: m.MathTaskEditor })),
);

/**
 * Task Component Registry
 * Maps task types to their editor components.
 * In the A4 live editor, there is no separate preview –
 * the editor IS the preview (WYSIWYG).
 */

interface TaskComponentRegistry {
    editor: React.ComponentType<{ task: Task; isActive?: boolean }>;
}

/** Übergangs-Platzhalter für matching, bis der echte Editor (Commit 2) existiert. */
function MatchingTaskPlaceholder({ task }: { task: Task }) {
    if (task.type !== 'matching') return null;
    return (
        <div className="text-sm text-slate-600">
            <p className="mb-2 font-medium">{task.prompt}</p>
            <ul className="space-y-1">
                {task.pairs.map((pair, index) => (
                    <li key={pair.id}>
                        {String.fromCharCode(97 + index)}) {pair.left || <span className="text-slate-400">(leer)</span>}
                        {' — '}
                        {pair.right || <span className="text-slate-400">(leer)</span>}
                    </li>
                ))}
            </ul>
        </div>
    );
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
const TASK_REGISTRY: Record<TaskType, TaskComponentRegistry> = {
    'multiple-choice': {
        editor: MultipleChoiceEditor as React.ComponentType<{ task: Task; isActive?: boolean }>,
    },
    'lineatur': {
        editor: LineaturEditor as React.ComponentType<{ task: Task; isActive?: boolean }>,
    },
    'cloze': {
        editor: ClozeEditor as React.ComponentType<{ task: Task; isActive?: boolean }>,
    },
    'image-placeholder': {
        editor: ImagePlaceholderEditor as React.ComponentType<{ task: Task; isActive?: boolean }>,
    },
    'math': {
        editor: LazyMathTaskEditor as React.ComponentType<{ task: Task; isActive?: boolean }>,
    },
    'page-break': {
        editor: (() => null) as React.ComponentType<{ task: Task; isActive?: boolean }>, // Rendered separately – never shown in TaskCard
    },
    'columns': {
        editor: ColumnsEditor as React.ComponentType<{ task: Task; isActive?: boolean }>,
    },
    'instruction': {
        editor: InstructionTaskEditor as React.ComponentType<{ task: Task; isActive?: boolean }>,
    },
    'heading': {
        editor: HeadingEditor as React.ComponentType<{ task: Task; isActive?: boolean }>,
    },
    'table': {
        editor: TableEditor as React.ComponentType<{ task: Task; isActive?: boolean }>,
    },
    'information': {
        editor: InformationTaskEditor as React.ComponentType<{ task: Task; isActive?: boolean }>,
    },
    'ordering': {
        editor: OrderingTaskEditor as React.ComponentType<{ task: Task; isActive?: boolean }>,
    },
    'matching': {
        // Platzhalter (Commit 1) – der vollständige MatchingTaskEditor folgt in Commit 2.
        editor: MatchingTaskPlaceholder as React.ComponentType<{ task: Task; isActive?: boolean }>,
    },
};

/**
 * Schlanker Resolver zwischen Taskdaten und passendem Editor.
 * Unknown-Fallback schützt UI und KI-Flows gegen unvollständige Migrationsstände.
 */
export const TaskEditorRenderer: React.FC<{ task: Task; isActive?: boolean }> = ({ task, isActive = true }) => {
    const entry = TASK_REGISTRY[task.type];
    if (!entry) {
        return <UnknownTaskFallback type={task.type} />;
    }
    const Component = entry.editor;
    return (
        <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />}>
            <div className="print:break-inside-avoid print:break-after-auto">
                <Component task={task} isActive={isActive} />
            </div>
        </Suspense>
    );
};
