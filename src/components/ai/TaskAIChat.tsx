import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Check, X, Sparkles } from 'lucide-react';
import { modifyTask } from '../../services/geminiService';
import { useWorksheetStore } from '../../store/worksheetStore';
import type { Task } from '../../types/worksheet';

/* ══════════════════════════════════════════════════
   TaskAIChat – Per-Task KI-Assistent
   Sendet nur die Daten dieser Aufgabe an Gemini
   für kontextbezogene Modifikationen.
   ══════════════════════════════════════════════════ */

interface TaskAIChatProps {
    task: Task;
    onClose: () => void;
}

/** Skeleton-Loader für KI-Antwort */
const AISkeletonLoader: React.FC = () => (
    <div className="space-y-2 animate-pulse">
        <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" />
            <span className="text-xs text-purple-400 font-medium">KI denkt nach...</span>
        </div>
        <div className="space-y-1.5">
            <div className="h-2.5 bg-purple-100 rounded-full w-full" />
            <div className="h-2.5 bg-purple-100 rounded-full w-4/5" />
            <div className="h-2.5 bg-purple-100 rounded-full w-3/5" />
        </div>
    </div>
);

export const TaskAIChat: React.FC<TaskAIChatProps> = ({ task, onClose }) => {
    const updateTask = useWorksheetStore((s) => s.updateTask);
    const [instruction, setInstruction] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<Omit<Task, 'id'> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!instruction.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);
        setPreview(null);

        try {
            const modified = await modifyTask(task, instruction.trim());
            setPreview(modified);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
        } finally {
            setIsLoading(false);
        }
    };

    const applyChanges = () => {
        if (!preview) return;
        updateTask(task.id, preview as Partial<Task>);
        setPreview(null);
        setInstruction('');
        onClose();
    };

    const discardChanges = () => {
        setPreview(null);
    };

    /** Quick-Action Vorschläge */
    const suggestions = [
        'Vereinfache die Sprache',
        'Mache es schwieriger',
        'Füge einen Hinweis hinzu',
        'Übersetze ins Englische',
    ];

    return (
        <div className="no-print mt-2 border border-purple-200 rounded-lg bg-purple-50/50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-purple-100/60 border-b border-purple-200/60">
                <div className="flex items-center gap-1.5">
                    <Sparkles size={12} className="text-purple-500" />
                    <span className="text-[11px] font-semibold text-purple-700">
                        KI-Assistent
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="p-0.5 hover:bg-purple-200 rounded transition-colors cursor-pointer text-purple-400 hover:text-purple-600"
                >
                    <X size={12} />
                </button>
            </div>

            <div className="p-3 space-y-2.5">
                {/* Quick Suggestions */}
                {!isLoading && !preview && (
                    <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((s) => (
                            <button
                                key={s}
                                onClick={() => setInstruction(s)}
                                className="px-2 py-0.5 text-[10px] bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition-colors cursor-pointer"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                {/* Loading State */}
                {isLoading && <AISkeletonLoader />}

                {/* Error */}
                {error && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-xs text-red-600">{error}</p>
                    </div>
                )}

                {/* Preview */}
                {preview && (
                    <div className="space-y-2">
                        <div className="p-2 bg-white border border-purple-200 rounded-md">
                            <p className="text-[11px] font-medium text-purple-600 mb-1">
                                Vorschau der Änderungen:
                            </p>
                            <pre className="text-[10px] text-slate-700 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                                {JSON.stringify(preview, null, 2)}
                            </pre>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={applyChanges}
                                className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md transition-colors cursor-pointer"
                            >
                                <Check size={12} /> Übernehmen
                            </button>
                            <button
                                onClick={discardChanges}
                                className="flex items-center gap-1 px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded-md transition-colors cursor-pointer"
                            >
                                <X size={12} /> Verwerfen
                            </button>
                        </div>
                    </div>
                )}

                {/* Input */}
                {!preview && (
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            placeholder='z.B. "Vereinfache die Sprache" oder "Fuege eine 5. Option hinzu"'
                            className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-purple-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-700 placeholder:text-slate-400"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={!instruction.trim() || isLoading}
                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
