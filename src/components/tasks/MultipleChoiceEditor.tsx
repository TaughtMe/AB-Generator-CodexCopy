import React from 'react';
import type { MultipleChoiceTask } from '../../types/worksheet';
import { useWorksheetStore } from '../../store/worksheetStore';
import { Plus, Trash2, Check } from 'lucide-react';
import { RichTextEditor } from '../editor/RichTextEditor';
import { ICON_SIZES } from '../ui/iconSizes';

interface MultipleChoiceEditorProps {
    task: MultipleChoiceTask;
    isActive?: boolean;
}

export const MultipleChoiceEditor: React.FC<MultipleChoiceEditorProps> = ({ task, isActive = true }) => {
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

    const toggleCorrect = (optionId: string) => {
        const newOptions = task.options.map((opt) =>
            opt.id === optionId ? { ...opt, isCorrect: !opt.isCorrect } : opt
        );
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
            {/* Question */}
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
                />
            </div>

            {/* Options */}
            <div>
                {isActive && (
                    <label className="block text-xs font-medium text-worksheet-inkLight mb-2 uppercase tracking-wider no-print">
                        Antwortmöglichkeiten
                    </label>
                )}
                <div className="space-y-2">
                    {task.options.map((option) => (
                        <div key={option.id} className="flex items-center gap-2 group/option">
                            {/* Correct toggle – mc-correct-marker controls print visibility */}
                            {isActive ? (
                                <button
                                    onClick={() => toggleCorrect(option.id)}
                                    className={`mc-correct-marker shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${option.isCorrect
                                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-200'
                                        : 'border-worksheet-border text-transparent hover:border-emerald-400'
                                        }`}
                                    title={option.isCorrect ? 'Als falsch markieren' : 'Als richtig markieren'}
                                    data-correct={option.isCorrect}
                                >
                                    <Check className={ICON_SIZES[14]} strokeWidth={3} />
                                </button>
                            ) : (
                                <span
                                    className="shrink-0 w-5 h-5 border-2 border-worksheet-border rounded-sm"
                                    data-correct={option.isCorrect}
                                />
                            )}

                            {/* Print-only checkbox indicator */}
                            <span
                                className="mc-print-checkbox hidden shrink-0 w-5 h-5 border-2 border-worksheet-border rounded-sm"
                                data-correct={option.isCorrect}
                            />

                            {/* Text input */}
                            <input
                                type="text"
                                value={option.text}
                                onChange={(e) => updateOptionText(option.id, e.target.value)}
                                className="flex-1 px-3 py-1.5 rounded-lg border border-worksheet-border bg-worksheet-field text-worksheet-ink text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow print:bg-transparent print:border-none"
                            />

                            {/* Delete option */}
                            {isActive && (
                                <button
                                    onClick={() => removeOption(option.id)}
                                    disabled={task.options.length <= 2}
                                    className="shrink-0 p-1.5 text-worksheet-inkLight/60 hover:text-red-500 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover/option:opacity-100 no-print"
                                    title="Option entfernen"
                                >
                                    <Trash2 className={ICON_SIZES[14]} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Add option */}
            {isActive && (
                <button
                    onClick={addOption}
                    className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors cursor-pointer no-print"
                >
                    <Plus className={ICON_SIZES[16]} /> Option hinzufügen
                </button>
            )}
        </div>
    );
};
