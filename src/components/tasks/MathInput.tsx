import React, { useRef, useState, useMemo, useCallback } from 'react';
import katex from 'katex';
import {
    Divide, Radical, Superscript, Subscript, X, ChevronDown,
    Sigma,
} from 'lucide-react';

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
                {/* Snippet Buttons */}
                {SNIPPETS.map((s) => (
                    <button
                        key={s.label}
                        type="button"
                        title={s.label}
                        onClick={() => insertSnippet(s.latex, s.cursorOffset)}
                        className="flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-medium bg-worksheet-field text-worksheet-ink hover:bg-slate-100 border border-worksheet-border transition-colors cursor-pointer"
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
                        className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[11px] font-medium bg-worksheet-field text-worksheet-ink hover:bg-slate-100 border border-worksheet-border transition-colors cursor-pointer"
                    >
                        <span>αβγ</span>
                        <ChevronDown size={10} />
                    </button>
                    {showGreek && (
                        <div className="absolute top-full left-0 mt-1 z-50 grid grid-cols-7 gap-0.5 p-1.5 rounded-lg bg-worksheet-paper border border-worksheet-border shadow-xl">
                            {GREEK_LETTERS.map((g) => (
                                <button
                                    key={g.label}
                                    type="button"
                                    onClick={() => {
                                        insertSnippet(g.latex);
                                        setShowGreek(false);
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded text-sm text-worksheet-ink hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    {g.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Split-View: Editor + Live Preview nebeneinander ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* LaTeX-Editor */}
                <div>
                    <p className="text-[10px] font-medium text-worksheet-inkLight mb-1 no-print">LaTeX-Code</p>
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="LaTeX eingeben, z.B. \frac{a}{b} + \sqrt{c}"
                        spellCheck={false}
                        className="w-full min-h-[80px] px-3 py-2 rounded-md border border-worksheet-border bg-worksheet-field text-sm font-mono text-worksheet-ink placeholder:text-worksheet-inkLight focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none resize-y transition-shadow print:hidden"
                        rows={3}
                    />
                </div>

                {/* Live Preview */}
                <div>
                    <p className="text-[10px] font-medium text-worksheet-inkLight mb-1 no-print">Vorschau</p>
                    <div className="min-h-[80px] px-3 py-3 rounded-md border border-worksheet-border bg-worksheet-field flex items-center justify-center print:bg-transparent print:border-none print:p-0">
                        {value.trim() ? (
                            <span
                                className="math-preview text-lg"
                                dangerouslySetInnerHTML={{ __html: renderedHtml }}
                            />
                        ) : (
                            <span className="text-sm text-worksheet-inkLight italic no-print">
                                Noch keine Formel eingegeben…
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
