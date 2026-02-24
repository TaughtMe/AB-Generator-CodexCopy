import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Sparkles, X } from 'lucide-react';
import { modifyTask } from '../../services/aiService';
import type { Task } from '../../types/worksheet';
import { ICON_SIZES } from '../ui/iconSizes';

interface InlineAIPanelProps {
    task: Task;
    onApply: (updates: Partial<Task>) => void;
    onClose: () => void;
}

type QuickActionKey = 'lighter' | 'harder' | 'shorter' | 'longer';

const QUICK_ACTIONS: Array<{ key: QuickActionKey; label: string; instruction: string }> = [
    { key: 'lighter', label: 'Leichter', instruction: 'Überarbeite genau diese Aufgabe und mache sie leichter, einfacher formuliert und weniger komplex. Behalte den Aufgabentyp bei.' },
    { key: 'harder', label: 'Schwerer', instruction: 'Überarbeite genau diese Aufgabe und mache sie schwerer bzw. anspruchsvoller. Behalte den Aufgabentyp bei.' },
    { key: 'shorter', label: 'Kürzer', instruction: 'Überarbeite genau diese Aufgabe und mache sie kürzer/kompakter. Behalte den Aufgabentyp bei.' },
    { key: 'longer', label: 'Länger', instruction: 'Überarbeite genau diese Aufgabe und mache sie ausführlicher/länger. Behalte den Aufgabentyp bei.' },
];

export const InlineAIPanel: React.FC<InlineAIPanelProps> = ({ task, onApply, onClose }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [instruction, setInstruction] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const runInstruction = async (rawInstruction: string) => {
        const trimmed = rawInstruction.trim();
        if (!trimmed || isLoading) return;

        setIsLoading(true);
        setError(null);

        try {
            const modified = await modifyTask(task, trimmed);
            onApply(modified as Partial<Task>);
            setInstruction('');
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unbekannter KI-Fehler');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runInstruction(instruction);
    };

    return (
        <div className="no-print mt-2 rounded-lg border border-slate-200 bg-slate-50/90">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                    <Sparkles className={ICON_SIZES[12]} />
                    <span>KI-Aktion für diese Aufgabe</span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-50 cursor-pointer"
                    aria-label="KI-Panel schließen"
                >
                    <X className={ICON_SIZES[12]} />
                </button>
            </div>

            <div className="space-y-2 p-3">
                <div className="flex flex-wrap gap-1.5">
                    {QUICK_ACTIONS.map((action) => (
                        <button
                            key={action.key}
                            type="button"
                            onClick={() => void runInstruction(action.instruction)}
                            disabled={isLoading}
                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {action.label}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        disabled={isLoading}
                        placeholder='Direkte Anweisung, z. B. "vereinfache die Sprache"'
                        className="h-8 flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !instruction.trim()}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        aria-label="KI-Anweisung ausführen"
                    >
                        {isLoading ? <Loader2 className={`${ICON_SIZES[12]} animate-spin`} /> : <Send className={ICON_SIZES[12]} />}
                    </button>
                </form>
            </div>
        </div>
    );
};
