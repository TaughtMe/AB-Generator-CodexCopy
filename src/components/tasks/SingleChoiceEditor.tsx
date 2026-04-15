import React from 'react';
import type { MultipleChoiceTask } from '../../types/worksheet';
import { useWorksheetStore } from '../../store/worksheetStore';
import { Plus, Trash2, Check } from 'lucide-react';
import { RichTextEditor } from '../editor/RichTextEditor';
import { ICON_SIZES } from '../ui/iconSizes';
import { VocabularyList } from '../editor/shared/VocabularyList';

interface SingleChoiceEditorProps {
    task: MultipleChoiceTask;
    isActive?: boolean;
}

export const SingleChoiceEditor: React.FC<SingleChoiceEditorProps> = ({ task, isActive = true }) => {
    const updateTask = useWorksheetStore((s) => s.updateTask);

    const updateQuestion = (html: string) => {
        updateTask(task.id, { question: html });
    };

    const updateOptionText = (optionId: string, text: string) => {
        const newOptions = task.options.map((opt) =>
            opt.id === optionId ? { ...opt, text } : opt
        );
        updateTask(task.id, { options: newOptions });
    };

    const setCorrect = (optionId: string) => {
        const newOptions = task.options.map((opt) => ({
            ...opt,
            isCorrect: opt.id === optionId,
        }));
        updateTask(task.id, { options: newOptions });
    };

    const removeOption = (optionId: string) => {
        const newOptions = task.options.filter((opt) => opt.id !== optionId);
        updateTask(task.id, { options: newOptions });
    };

    const addOption = () => {
        const newOptions = [
            ...task.options,
            {
                id: crypto.randomUUID(),
                text: `Option ${task.options.length + 1}`,
                isCorrect: false,
            },
        ];
        updateTask(task.id, { options: newOptions });
    };

    return (
        <div className="space-y-4">
            <div>
                {isActive && (
                    <label className="block text-xs font-medium text-worksheet-inkLight mb-1.5 uppercase tracking-wider no-print">
                        Frage
                    </label>
                )}
                <RichTextEditor
                    value={task.question}
                    onChange={updateQuestion}
                    placeholder="Stelle hier deine Frage…"
                    minRows={2}
                    hideToolbar={!isActive}
                    taskId={task.id}
                />
            </div>

            <div>
                {isActive && (
                    <label className="block text-xs font-medium text-worksheet-inkLight mb-2 uppercase tracking-wider no-print">
                        Antwortmöglichkeiten
                    </label>
                )}
                <div className="space-y-2 sc-options-list">
                    {task.options.map((option) => (
                        <div
                            key={option.id}
                            className="sc-option-card flex items-start gap-2 group/option rounded-lg border border-worksheet-border bg-worksheet-field px-3 py-1.5 min-h-0 h-auto transition-colors focus-within:ring-2 focus-within:ring-blue-500/35 focus-within:border-blue-500"
                        >
                            {isActive ? (
                                <button
                                    onClick={() => setCorrect(option.id)}
                                    className={`sc-correct-marker shrink-0 w-7 h-7 mt-1.5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${option.isCorrect
                                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-200'
                                        : 'border-worksheet-border text-transparent hover:border-emerald-400'
                                        }`}
                                    title={option.isCorrect ? 'Als richtig markiert' : 'Als richtig markieren'}
                                    data-correct={option.isCorrect}
                                >
                                    <Check className={ICON_SIZES[14]} strokeWidth={3} />
                                </button>
                            ) : (
                                <span
                                    className="shrink-0 w-5 h-5 mt-1.5 border-2 border-worksheet-border rounded-full print:hidden"
                                    data-correct={option.isCorrect}
                                />
                            )}

                            <span
                                className="sc-print-radio hidden shrink-0 w-5 h-5 mt-1.5 border-2 border-worksheet-border rounded-full"
                                data-correct={option.isCorrect}
                            />

                            <div className="flex-1 min-w-0 break-words">
                                <RichTextEditor
                                    value={option.text}
                                    onChange={(html) => updateOptionText(option.id, html)}
                                    placeholder="Antwort eingeben…"
                                    minRows={1}
                                    hideToolbar={!isActive}
                                    variant="minimal"
                                    className="border-0 shadow-none ring-0 focus-within:ring-0"
                                    taskId={task.id}
                                />
                            </div>

                            {isActive && (
                                <button
                                    onClick={() => removeOption(option.id)}
                                    disabled={task.options.length <= 2}
                                    className="shrink-0 p-1.5 mt-1.5 text-worksheet-inkLight/60 hover:text-red-500 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover/option:opacity-100 no-print"
                                    title="Option entfernen"
                                >
                                    <Trash2 className={ICON_SIZES[14]} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {isActive && (
                <button
                    onClick={addOption}
                    className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors cursor-pointer no-print"
                >
                    <Plus className={ICON_SIZES[16]} /> Option hinzufügen
                </button>
            )}

            <VocabularyList vocabulary={task.vocabulary} taskId={task.id} />
        </div>
    );
};
