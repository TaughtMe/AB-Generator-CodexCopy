import React, { useMemo } from 'react';
import type { ClozeTask, ClozeGapStyle } from '../../types/worksheet';
import { useWorksheetStore } from '../../store/worksheetStore';
import { Info } from 'lucide-react';
import { clsx } from 'clsx';
import { ICON_SIZES } from '../ui/iconSizes';
import {
    DEFAULT_CLOZE_GAP_MULTIPLIER,
    DEFAULT_CLOZE_GAP_STYLE,
    getClozeGapText,
    tokenizeClozeContent,
} from '../../utils/clozeParser';

/* ══════════════════════════════════════════════════
   ClozeEditor – Lückentext-Editor
   Syntax: [Wort] → wird auf dem Arbeitsblatt zur Lücke
   ══════════════════════════════════════════════════ */

interface ClozeEditorProps {
    task: ClozeTask;
}

/* ── Preview-Renderer ────────────────────────────────────────────────── */

function GapSpan({
    word,
    gapStyle,
    gapMultiplier,
}: {
    word: string;
    gapStyle: ClozeGapStyle;
    gapMultiplier: number;
}) {
    if (!word) {
        return (
            <span className="inline-block border-b-2 border-worksheet-inkLight min-w-[3rem] mx-0.5" />
        );
    }

    if (gapStyle === 'per-letter') {
        const chars = word.split('').filter((c) => c !== ' ');
        const charWidth = Math.max(0.35, 0.25 * gapMultiplier);
        return (
            <span className="inline-flex items-end mx-0.5" style={{ gap: `${charWidth * 0.5}em` }}>
                {chars.map((_, idx) => (
                    <span
                        key={idx}
                        className="inline-block border-b-2 border-worksheet-inkLight"
                        style={{ width: `${charWidth}em` }}
                    />
                ))}
            </span>
        );
    }

    // continuous: eine durchgehende Linie, Breite ∝ Wortlänge × Multiplikator
    const widthEm = Math.max(1.5, word.length * 0.55 * gapMultiplier);
    return (
        <span
            className="inline-block border-b-2 border-worksheet-inkLight mx-0.5"
            style={{ width: `${widthEm}em` }}
        />
    );
}

function renderPreview(
    text: string,
    gapStyle: ClozeGapStyle,
    gapMultiplier: number,
): React.ReactElement[] {
    const tokens = tokenizeClozeContent(text);
    return tokens.map((token, i) => {
        if (token.type === 'gap') {
            return (
                <GapSpan
                    key={i}
                    word={token.answer}
                    gapStyle={gapStyle}
                    gapMultiplier={gapMultiplier}
                />
            );
        }
        return <span key={i}>{token.value}</span>;
    });
}

function renderPrintOutput(
    text: string,
    gapStyle: ClozeGapStyle,
    gapMultiplier: number,
): React.ReactElement[] {
    const tokens = tokenizeClozeContent(text);
    return tokens.map((token, i) => {
        if (token.type === 'gap') {
            return <span key={i}>{getClozeGapText(token.answer, gapStyle, gapMultiplier)}</span>;
        }
        return <span key={i}>{token.value}</span>;
    });
}

function renderTeacherPrintOutput(text: string): React.ReactElement[] {
    const tokens = tokenizeClozeContent(text);
    return tokens.map((token, i) => {
        if (token.type === 'gap') {
            return (
                <span key={i} className="cloze-teacher-answer">
                    {token.answer}
                </span>
            );
        }
        return <span key={i}>{token.value}</span>;
    });
}

/* ── GapStyle Toggle ─────────────────────────────────────────────────── */

function StyleToggle({
    value,
    onChange,
}: {
    value: ClozeGapStyle;
    onChange: (v: ClozeGapStyle) => void;
}) {
    const options: { v: ClozeGapStyle; label: string; title: string }[] = [
        { v: 'continuous', label: '—— Linie', title: 'Durchgehende Linie' },
        { v: 'per-letter', label: '_ _ _ Buchstaben', title: 'Linie pro Buchstabe' },
    ];
    return (
        <div className="flex rounded-md border border-worksheet-border overflow-hidden print:bg-transparent print:border-none">
            {options.map((opt) => (
                <button
                    key={opt.v}
                    type="button"
                    title={opt.title}
                    onClick={() => onChange(opt.v)}
                    className={clsx(
                        'px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                        value === opt.v
                            ? 'bg-blue-500 text-white'
                            : 'bg-worksheet-field text-worksheet-ink hover:bg-slate-100',
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

/* ── Main Component ──────────────────────────────────────────────────── */

export const ClozeEditor: React.FC<ClozeEditorProps> = ({ task }) => {
    const updateTask = useWorksheetStore((s) => s.updateTask);

    const gapStyle: ClozeGapStyle = task.gapStyle ?? DEFAULT_CLOZE_GAP_STYLE;
    const gapMultiplier: number = task.gapMultiplier ?? DEFAULT_CLOZE_GAP_MULTIPLIER;

    const handleContent = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
        updateTask(task.id, { content: e.target.value });

    const handleGapStyle = (v: ClozeGapStyle) =>
        updateTask(task.id, { gapStyle: v });

    const handleMultiplier = (e: React.ChangeEvent<HTMLInputElement>) =>
        updateTask(task.id, { gapMultiplier: parseFloat(e.target.value) });

    const previewElements = useMemo(
        () => renderPreview(task.content ?? '', gapStyle, gapMultiplier),
        [task.content, gapStyle, gapMultiplier],
    );

    const printElements = useMemo(
        () => renderPrintOutput(task.content ?? '', gapStyle, gapMultiplier),
        [task.content, gapStyle, gapMultiplier],
    );

    const teacherPrintElements = useMemo(
        () => renderTeacherPrintOutput(task.content ?? ''),
        [task.content],
    );

    const gapCount = useMemo(
        () => tokenizeClozeContent(task.content ?? '').filter((t) => t.type === 'gap').length,
        [task.content],
    );

    return (
        <div className="space-y-3">
            {/* ── Hinweis ── */}
            <div className="no-print flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 print:bg-transparent print:border-none">
                <Info className={`${ICON_SIZES[14]} mt-0.5 flex-shrink-0 text-blue-500`} />
                <p className="text-xs text-blue-700 leading-relaxed">
                    <strong>Tipp:</strong> Setze Wörter in eckige Klammern (z.&nbsp;B.{' '}
                    <code className="bg-blue-100 rounded px-1">[Haus]</code>
                    ), um sie auf dem Arbeitsblatt als Lücke darzustellen.
                </p>
            </div>

            {/* ── Eingabefeld ── */}
            <textarea
                value={task.content ?? ''}
                onChange={handleContent}
                placeholder="Text eingeben … z.B.: Die [Sonne] scheint jeden [Tag]."
                spellCheck
                rows={5}
                className="no-print w-full px-3 py-2 rounded-md border border-worksheet-border bg-worksheet-field text-sm text-worksheet-ink placeholder:text-worksheet-inkLight focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none resize-y transition-shadow print:bg-transparent print:border-none"
            />

            {/* ── Einstellungs-Toolbar ── */}
            <div className="no-print flex flex-wrap items-center gap-4 bg-worksheet-field border border-worksheet-border rounded-md px-3 py-2 print:bg-transparent print:border-none">
                {/* Linienstil */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-worksheet-inkLight whitespace-nowrap">
                        Linienstil
                    </span>
                    <StyleToggle value={gapStyle} onChange={handleGapStyle} />
                </div>

                {/* Platzfaktor */}
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                    <span className="text-[11px] font-medium text-worksheet-inkLight whitespace-nowrap">
                        Platz für Schüler
                    </span>
                    <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.5"
                        value={gapMultiplier}
                        onChange={handleMultiplier}
                        className="flex-1 accent-blue-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-worksheet-ink w-8 text-right tabular-nums">
                        {gapMultiplier.toFixed(1)}x
                    </span>
                </div>
            </div>

            {/* ── Live-Vorschau ── */}
            {(task.content ?? '').trim() && (
                <div className="rounded-md border border-dashed border-worksheet-border bg-worksheet-field px-3 py-2 print:bg-transparent print:border-none">
                    <p className="no-print text-[10px] font-semibold uppercase tracking-wide text-worksheet-inkLight mb-1.5">
                        Vorschau Schüler*in
                    </p>
                    <p className="no-print text-sm text-worksheet-ink leading-loose">
                        {previewElements}
                    </p>
                    <p className="hidden print:block text-sm text-worksheet-ink leading-loose whitespace-pre-wrap">
                        <span className="cloze-print-student">{printElements}</span>
                        <span className="cloze-print-teacher">{teacherPrintElements}</span>
                    </p>
                    {gapCount > 0 && (
                        <p className="no-print mt-1.5 text-[10px] text-worksheet-inkLight">
                            {gapCount} {gapCount === 1 ? 'Lücke' : 'Lücken'} erkannt &middot;{' '}
                            {gapStyle === 'continuous' ? 'Durchgehende Linie' : 'Linie pro Buchstabe'} &middot;{' '}
                            Faktor {gapMultiplier.toFixed(1)}x
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};
