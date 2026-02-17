import React from 'react';
import type { Task, TaskType } from '../../types/worksheet';
import { MultipleChoiceEditor } from './MultipleChoiceEditor';
import { LineaturEditor } from './LineaturEditor';
import { ClozeEditor } from './TaskPlaceholders';
import { ImagePlaceholderEditor } from './ImagePlaceholderEditor';
import { MathTaskEditor } from './MathTaskEditor';
import { UnknownTaskFallback } from './UnknownTaskFallback';

/**
 * Task Component Registry
 * Maps task types to their editor components.
 * In the A4 live editor, there is no separate preview –
 * the editor IS the preview (WYSIWYG).
 */

interface TaskComponentRegistry {
    editor: React.ComponentType<{ task: any }>;
}

export const TASK_REGISTRY: Record<TaskType, TaskComponentRegistry> = {
    'multiple-choice': {
        editor: MultipleChoiceEditor,
    },
    'lineatur': {
        editor: LineaturEditor,
    },
    'cloze': {
        editor: ClozeEditor,
    },
    'image-placeholder': {
        editor: ImagePlaceholderEditor,
    },
    'math': {
        editor: MathTaskEditor,
    },
    'page-break': {
        editor: () => null, // Rendered separately – never shown in TaskCard
    },
};

export const TaskEditorRenderer: React.FC<{ task: Task }> = ({ task }) => {
    const entry = TASK_REGISTRY[task.type];
    if (!entry) {
        return <UnknownTaskFallback type={task.type} />;
    }
    const Component = entry.editor;
    return <Component task={task} />;
};
