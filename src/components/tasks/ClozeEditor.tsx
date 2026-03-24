import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import type { ClozeTask, ClozeGapStyle, ClozeWordBankMode } from '../../types/worksheet';
import { useWorksheetStore } from '../../store/worksheetStore';
import { Info } from 'lucide-react';
import { clsx } from 'clsx';
import { ICON_SIZES } from '../ui/iconSizes';
import { RichTextEditor } from '../editor/RichTextEditor';
import {
    DEFAULT_CLOZE_GAP_MULTIPLIER,
    DEFAULT_CLOZE_GAP_STYLE,
    getClozeGapText,
    tokenizeClozeContent,
} from '../../utils/clozeParser';

/** Strip HTML tags to get plain text for gap detection */
function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
}

const WORD_BANK_MODE_OPTIONS: { value: ClozeWordBankMode; label: string }[] = [
    { value: 'hidden', label: 'Lösungen verbergen' },
    { value: 'mixed', label: 'Als Wortspeicher gemischt' },
    { value: 'upside-down', label: 'Gemischt & Kopfstehend' },
];

function extractGapWordsFromHtml(html: string): string[] {
    const words: string[] = [];
    const pattern = /\[([^\]]*)\]/g;

    let match: RegExpExecArray | null = pattern.exec(html);
    while (match) {
        const word = stripHtml(match[1]).replace(/&nbsp;/g, ' ').trim();
        if (word) {
            words.push(word);
        }
        match = pattern.exec(html);
    }

    return words;
}

function parseDistractors(raw: string): string[] {
    return raw
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

function shuffleWords(words: string[]): string[] {
    const shuffled = [...words];

    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

/** Replace [Word] with underscores for print (plain text gaps) */
function htmlToClozePrintHtml(
    html: string,
    gapStyle: ClozeGapStyle,
    gapMultiplier: number,
): string {
    return html.replace(/\[([^\]]*)\]/g, (_, word: string) => {
        if (gapStyle === 'per-letter') {
            const chars = word.split('').filter((c: string) => c !== ' ');
            const charWidth = Math.max(0.35, 0.25 * gapMultiplier);
            if (chars.length === 0) {
                return `<span class="cloze-gap-print" style="width:${Math.max(1.5, 3 * 0.55 * gapMultiplier)}em">\u00A0</span>`;
            }
            return (
                `<span class="cloze-gap-per-letter">` +
                chars
                    .map(
                        () =>
                            `<span class="cloze-gap-letter" style="width:${charWidth}em"></span>`,
                    )
                    .join('') +
                '</span>'
            );
        }
        const gapText = getClozeGapText(word, gapStyle, gapMultiplier);
        return `<span class="cloze-gap-print">${gapText}</span>`;
    });
}

/** Replace [Word] with the answer for teacher print */
function htmlToTeacherPrintHtml(html: string): string {
    return html.replace(
        /\[([^\]]*)\]/g,
        (_, word: string) => `<span class="cloze-teacher-answer">${word}</span>`,
    );
}

/* ══════════════════════════════════════════════════
   ClozeEditor – Lückentext-Editor
   Syntax: [Wort] → wird auf dem Arbeitsblatt zur Lücke
   ══════════════════════════════════════════════════ */

interface ClozeEditorProps {
    task: ClozeTask;
    isActive?: boolean;
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

export const ClozeEditor: React.FC<ClozeEditorProps> = ({ task, isActive = true }) => {
    const updateTask = useWorksheetStore((s) => s.updateTask);

    const wordBankModeValue = (task.wordBankMode ?? 'hidden') as string;
    const gapStyle: ClozeGapStyle = task.gapStyle ?? DEFAULT_CLOZE_GAP_STYLE;
    const gapMultiplier: number = task.gapMultiplier ?? DEFAULT_CLOZE_GAP_MULTIPLIER;
    const wordBankMode: ClozeWordBankMode =
        WORD_BANK_MODE_OPTIONS.some((option) => option.value === wordBankModeValue)
            ? (wordBankModeValue as ClozeWordBankMode)
            : 'hidden';
    const distractors = task.distractors ?? '';
    const showDistractors = wordBankMode !== 'hidden' && wordBankModeValue !== 'none';

    const handleContent = (html: string) =>
        updateTask(task.id, { content: html });

    const handleGapStyle = (v: ClozeGapStyle) =>
        updateTask(task.id, { gapStyle: v });

    const handleMultiplier = (e: React.ChangeEvent<HTMLInputElement>) =>
        updateTask(task.id, { gapMultiplier: parseFloat(e.target.value) });

    const handleWordBankMode = (e: React.ChangeEvent<HTMLSelectElement>) =>
        updateTask(task.id, { wordBankMode: e.target.value as ClozeWordBankMode });

    const handleDistractors = (e: React.ChangeEvent<HTMLInputElement>) =>
        updateTask(task.id, { distractors: e.target.value });

    const plainText = useMemo(() => stripHtml(task.content ?? ''), [task.content]);

    const printStudentHtml = useMemo(
        () => htmlToClozePrintHtml(task.content ?? '', gapStyle, gapMultiplier),
        [task.content, gapStyle, gapMultiplier],
    );

    const printTeacherHtml = useMemo(
        () => htmlToTeacherPrintHtml(task.content ?? ''),
        [task.content],
    );

    const gapCount = useMemo(
        () => tokenizeClozeContent(plainText).filter((t) => t.type === 'gap').length,
        [plainText],
    );

    const wordBankWords = useMemo(() => {
        if (wordBankMode === 'hidden') {
            return [];
        }

        const realGapWords = extractGapWordsFromHtml(task.content ?? '');
        const extraWords = parseDistractors(distractors);
        return shuffleWords([...realGapWords, ...extraWords]);
    }, [task.content, distractors, wordBankMode]);

    return (
        <div className="space-y-3">
            {/* ── Hinweis ── */}
            {isActive && (
                <div className="no-print flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 print:bg-transparent print:border-none">
                    <Info className={`${ICON_SIZES[14]} mt-0.5 flex-shrink-0 text-blue-500`} />
                    <p className="text-xs text-blue-700 leading-relaxed">
                        <strong>Tipp:</strong> Setze Wörter in eckige Klammern (z.&nbsp;B.{' '}
                        <code className="bg-blue-100 rounded px-1">[Haus]</code>
                        ), um sie auf dem Arbeitsblatt als Lücke darzustellen.
                        Die Toolbar erlaubt Formatierung (Fett, Kursiv, Farbe, Ausrichtung).
                    </p>
                </div>
            )}

            {/* ── Rich-Text Eingabefeld ── */}
            {isActive && (
                <RichTextEditor
                    value={task.content ?? ''}
                    onChange={handleContent}
                    placeholder="Text eingeben … z.B.: Die [Sonne] scheint jeden [Tag]."
                    minRows={5}
                    className="no-print"
                />
            )}

            {/* ── Einstellungs-Toolbar ── */}
            {isActive && (
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
            )}

            {isActive && (
                <div className="no-print flex flex-col gap-2 bg-worksheet-field border border-worksheet-border rounded-md px-3 py-2 print:bg-transparent print:border-none">
                    <label className="flex flex-col gap-1 w-full">
                        <span className="text-[11px] font-medium text-worksheet-inkLight whitespace-nowrap">
                            Anzeige Lösung
                        </span>
                        <select
                            value={wordBankMode}
                            onChange={handleWordBankMode}
                            className="w-full px-2 py-1 rounded-md border border-worksheet-border bg-white text-xs text-worksheet-ink focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                        >
                            {WORD_BANK_MODE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    {showDistractors && (
                        <label className="flex flex-col gap-1 w-full">
                            <span className="text-[11px] font-medium text-worksheet-inkLight whitespace-nowrap">
                                Störwörter
                            </span>
                            <input
                                type="text"
                                value={distractors}
                                onChange={handleDistractors}
                                placeholder="Störwörter, kommagetrennt (z.B. Wolke, Regen, Wind)"
                                className="w-full min-w-0 px-2 py-1 rounded-md border border-worksheet-border bg-white text-xs text-worksheet-ink placeholder:text-worksheet-inkLight focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </label>
                    )}
                </div>
            )}

            {/* ── Live-Vorschau ── */}
            {plainText.trim() && (
                <div className="rounded-md border border-dashed border-worksheet-border bg-worksheet-field px-3 py-2 print:bg-transparent print:border-none">
                    <p className="no-print text-[10px] font-semibold uppercase tracking-wide text-worksheet-inkLight mb-1.5">
                        Vorschau Schüler*in
                    </p>
                    {isActive && (
                        <div
                            className="no-print text-sm text-worksheet-ink leading-loose break-words prose prose-sm max-w-none"
                            style={{ overflowWrap: 'anywhere' }}
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(printStudentHtml) }}
                        />
                    )}
                    <div className={clsx(
                        'text-sm text-worksheet-ink leading-loose whitespace-pre-wrap break-words',
                        isActive ? 'hidden print:block' : 'block',
                    )} style={{ overflowWrap: 'anywhere' }}>
                        <span className="cloze-print-student" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(printStudentHtml) }} />
                        <span className="cloze-print-teacher" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(printTeacherHtml) }} />
                    </div>
                    {wordBankMode !== 'hidden' && wordBankWords.length > 0 && (
                        <div className="text-center">
                            <div
                                className={clsx(
                                    'italic text-center mt-6',
                                    wordBankMode === 'upside-down' && 'rotate-180 inline-block',
                                )}
                            >
                                {wordBankWords.join(' • ')}
                            </div>
                        </div>
                    )}
                    {isActive && gapCount > 0 && (
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
