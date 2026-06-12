import { Paragraph, TextRun, UnderlineType } from 'docx';
import type { ClozeTask } from '../../../types/worksheet';
import {
    DEFAULT_CLOZE_GAP_MULTIPLIER,
    DEFAULT_CLOZE_GAP_STYLE,
    tokenizeClozeContent,
} from '../../clozeParser';
import type { TaskRendererConfig } from './shared';

function normalizeGapMultiplier(gapMultiplier: number): number {
    return Number.isFinite(gapMultiplier)
        ? Math.max(1, gapMultiplier)
        : DEFAULT_CLOZE_GAP_MULTIPLIER;
}

function createStudentGapBlankRun(blankUnits: number, config: TaskRendererConfig): TextRun {
    return new TextRun({
        text: ' '.repeat(Math.max(1, blankUnits)),
        font: config.fontFamily,
        size: config.fontSizePt * 2,
        color: config.docxTheme.muted,
        underline: { type: UnderlineType.SINGLE },
    });
}

function createStudentGapRuns(
    answer: string,
    gapStyle: ClozeTask['gapStyle'],
    gapMultiplier: number,
    config: TaskRendererConfig,
): TextRun[] {
    const safeMultiplier = normalizeGapMultiplier(gapMultiplier);
    const normalizedAnswer = (answer ?? '').trim();

    if (gapStyle === 'per-letter') {
        const letterCount = normalizedAnswer
            .split('')
            .filter((char) => char !== ' ').length || 1;
        const unitsPerLetter = Math.max(1, Math.round(safeMultiplier));
        const runs: TextRun[] = [];

        for (let i = 0; i < letterCount; i++) {
            runs.push(createStudentGapBlankRun(unitsPerLetter, config));
            if (i < letterCount - 1) {
                runs.push(
                    new TextRun({
                        text: ' ',
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.muted,
                    }),
                );
            }
        }

        return runs;
    }

    const baseLength = Math.max(1, normalizedAnswer.length);
    const continuousUnits = Math.max(6, Math.round(baseLength * 2 * safeMultiplier));
    return [createStudentGapBlankRun(continuousUnits, config)];
}

export function renderCloze(task: ClozeTask, isTeacherVersion: boolean, config: TaskRendererConfig): Paragraph[] {
    if (!task.content || !task.content.trim()) {
        return [
            new Paragraph({
                children: [
                    new TextRun({
                        text: '(Leerer Lückentext)',
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.placeholder,
                        italics: true,
                    }),
                ],
            }),
        ];
    }

    const gapStyle = task.gapStyle ?? DEFAULT_CLOZE_GAP_STYLE;
    const gapMultiplier = task.gapMultiplier ?? DEFAULT_CLOZE_GAP_MULTIPLIER;
    const parts = tokenizeClozeContent(task.content);
    const runs: TextRun[] = [];

    for (const part of parts) {
        if (part.type === 'gap') {
            const word = part.answer;
            if (isTeacherVersion) {
                runs.push(
                    new TextRun({
                        text: word.trim() || ' ',
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.correctAnswer,
                        bold: true,
                        underline: { type: UnderlineType.SINGLE },
                    }),
                );
            } else {
                runs.push(...createStudentGapRuns(word, gapStyle, gapMultiplier, config));
            }
        } else if (part.value) {
            // Strip HTML tags from non-gap segments — cloze content is stored as
            // Tiptap HTML so plain text parts may contain <p>, </p>, <br> etc.
            const plainText = part.value
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>');
            if (plainText) {
                runs.push(
                    new TextRun({
                        text: plainText,
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                    }),
                );
            }
        }
    }

    return [
        new Paragraph({
            children: runs,
            spacing: { after: config.taskGapAfter },
        }),
    ];
}
