import React from 'react';
import type { MultipleChoiceTask } from '../../types/worksheet';
import { useWorksheetStore } from '../../store/worksheetStore';
import { Plus, Trash2, Check } from 'lucide-react';

interface MultipleChoiceEditorProps {
    task: MultipleChoiceTask;
}

export const MultipleChoiceEditor: React.FC<MultipleChoiceEditorProps> = ({ task }) => {
    const updateTask = useWorksheetStore((s) => s.updateTask);
    const isTeacherMode = useWorksheetStore((s) => s.isTeacherMode);

    const updateQuestion = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateTask(task.id, { question: e.target.value });
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
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider no-print">
                    Frage
                </label>
                <textarea
                    value={task.question}
                    onChange={updateQuestion}
                    placeholder="Stelle hier deine Frage…"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow resize-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
            </div>

            {/* Options */}
            <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider no-print">
                    Antwortmöglichkeiten
                </label>
                <div className="space-y-2">
                    {task.options.map((option) => (
                        <div key={option.id} className="flex items-center gap-2 group/option">
                            {/* Correct toggle – mc-correct-marker controls print visibility */}
                            <button
                                onClick={() => toggleCorrect(option.id)}
                                className={`mc-correct-marker shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${option.isCorrect
                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-200 dark:shadow-emerald-900'
                                    : 'border-slate-300 dark:border-slate-600 text-transparent hover:border-emerald-400'
                                    }`}
                                title={option.isCorrect ? 'Als falsch markieren' : 'Als richtig markieren'}
                                data-correct={option.isCorrect}
                                data-teacher={isTeacherMode}
                            >
                                <Check size={14} strokeWidth={3} />
                            </button>

                            {/* Print-only checkbox indicator */}
                            <span
                                className="mc-print-checkbox hidden shrink-0 w-5 h-5 border-2 border-slate-400 rounded-sm"
                                data-correct={option.isCorrect}
                                data-teacher={isTeacherMode}
                            />

                            {/* Text input */}
                            <input
                                type="text"
                                value={option.text}
                                onChange={(e) => updateOptionText(option.id, e.target.value)}
                                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                            />

                            {/* Delete option */}
                            <button
                                onClick={() => removeOption(option.id)}
                                disabled={task.options.length <= 2}
                                className="shrink-0 p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover/option:opacity-100 no-print"
                                title="Option entfernen"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add option */}
            <button
                onClick={addOption}
                className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors cursor-pointer no-print"
            >
                <Plus size={16} /> Option hinzufügen
            </button>
        </div>
    );
};
