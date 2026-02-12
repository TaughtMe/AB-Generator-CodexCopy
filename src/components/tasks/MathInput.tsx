import React, { useRef, useState, useMemo, useCallback } from 'react';
import katex from 'katex';
import {
    Divide, Radical, Superscript, Subscript, X, ChevronDown,
    Sigma, Pencil, Eye,
} from 'lucide-react';
import { clsx } from 'clsx';

/* ══════════════════════════════════════════════════
   MathInput – LaTeX Editor with Toolbar & Live Preview
   ══════════════════════════════════════════════════ */

interface MathInputProps {
    value: string;
    onChange: (value: string) => void;
}

/** Toolbar snippet definition */
interface Snippet {
    label: string;
    icon?: React.ReactNode;
    latex: string;
    /** Cursor offset from the start of the inserted snippet */
    cursorOffset?: number;
}

/* ── Toolbar Snippets ── */

const SNIPPETS: Snippet[] = [
    { label: 'Bruch', icon: <Divide size={14} />, latex: '\\frac{}{}', cursorOffset: 6 },
    { label: 'Wurzel', icon: <Radical size={14} />, latex: '\\sqrt{}', cursorOffset: 6 },
    { label: 'Potenz', icon: <Superscript size={14} />, latex: '^{}', cursorOffset: 2 },
    { label: 'Index', icon: <Subscript size={14} />, latex: '_{}', cursorOffset: 2 },
    { label: 'Mal', icon: <X size={14} />, latex: '\\cdot ', cursorOffset: 6 },
    { label: 'Summe', icon: <Sigma size={14} />, latex: '\\sum_{i=1}^{n}', cursorOffset: 6 },
    { label: 'Integral', latex: '\\int_{}^{}', cursorOffset: 6 },
];

const GREEK_LETTERS = [
    { label: 'α', latex: '\\alpha ' },
    { label: 'β', latex: '\\beta ' },
    { label: 'γ', latex: '\\gamma ' },
    { label: 'δ', latex: '\\delta ' },
    { label: 'ε', latex: '\\epsilon ' },
    { label: 'θ', latex: '\\theta ' },
    { label: 'λ', latex: '\\lambda ' },
    { label: 'μ', latex: '\\mu ' },
    { label: 'π', latex: '\\pi ' },
    { label: 'σ', latex: '\\sigma ' },
    { label: 'ω', latex: '\\omega ' },
    { label: 'Δ', latex: '\\Delta ' },
    { label: 'Σ', latex: '\\Sigma ' },
    { label: 'Ω', latex: '\\Omega ' },
];

export const MathInput: React.FC<MathInputProps> = ({ value, onChange }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [mode, setMode] = useState<'edit' | 'preview'>('edit');
    const [showGreek, setShowGreek] = useState(false);

    /* ── Insert snippet at cursor position ── */
    const insertSnippet = useCallback((latex: string, cursorOffset?: number) => {
        const ta = textareaRef.current;
        if (!ta) return;

        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const before = value.slice(0, start);
        const after = value.slice(end);
        const newValue = before + latex + after;

        onChange(newValue);

        // Restore cursor position after React re-render
        const newPos = start + (cursorOffset ?? latex.length);
        requestAnimationFrame(() => {
            ta.focus();
            ta.setSelectionRange(newPos, newPos);
        });
    }, [value, onChange]);

    /* ── KaTeX Rendering ── */
    const renderedHtml = useMemo(() => {
        if (!value.trim()) return '';
        try {
            return katex.renderToString(value, {
                throwOnError: false,
                displayMode: true,
                output: 'html',
            });
        } catch {
            return '<span style="color:#ef4444">Ungültiger LaTeX-Code</span>';
        }
    }, [value]);

    return (
        <div className="space-y-2">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-1 flex-wrap no-print">
                {/* Mode Toggle */}
                <div className="flex items-center rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden mr-1">
                    <button
                        type="button"
                        onClick={() => setMode('edit')}
                        className={clsx(
                            'flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                            mode === 'edit'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        )}
                    >
                        <Pencil size={11} /> Edit
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('preview')}
                        className={clsx(
                            'flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                            mode === 'preview'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        )}
                    >
                        <Eye size={11} /> Preview
                    </button>
                </div>

                {/* Snippet Buttons */}
                {SNIPPETS.map((s) => (
                    <button
                        key={s.label}
                        type="button"
                        title={s.label}
                        onClick={() => insertSnippet(s.latex, s.cursorOffset)}
                        className="flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    >
                        {s.icon ?? null}
                        <span>{s.label}</span>
                    </button>
                ))}

                {/* Greek Dropdown */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowGreek(!showGreek)}
                        className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    >
                        <span>αβγ</span>
                        <ChevronDown size={10} />
                    </button>
                    {showGreek && (
                        <div className="absolute top-full left-0 mt-1 z-50 grid grid-cols-7 gap-0.5 p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl">
                            {GREEK_LETTERS.map((g) => (
                                <button
                                    key={g.label}
                                    type="button"
                                    onClick={() => {
                                        insertSnippet(g.latex);
                                        setShowGreek(false);
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded text-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                    {g.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Editor / Preview ── */}
            {mode === 'edit' ? (
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="LaTeX eingeben, z.B. \frac{a}{b} + \sqrt{c}"
                    spellCheck={false}
                    className="w-full min-h-[60px] px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none resize-y transition-shadow"
                    rows={3}
                />
            ) : (
                <div className="min-h-[60px] px-3 py-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center">
                    {value.trim() ? (
                        <span
                            className="math-preview text-lg"
                            dangerouslySetInnerHTML={{ __html: renderedHtml }}
                        />
                    ) : (
                        <span className="text-sm text-slate-400 italic">
                            Noch keine Formel eingegeben…
                        </span>
                    )}
                </div>
            )}

            {/* ── Inline live preview (in edit mode) ── */}
            {mode === 'edit' && value.trim() && (
                <div className="px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700">
                    <span
                        className="math-preview"
                        dangerouslySetInnerHTML={{ __html: renderedHtml }}
                    />
                </div>
            )}
        </div>
    );
};
