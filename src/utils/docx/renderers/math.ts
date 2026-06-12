import { Paragraph, TextRun } from 'docx';
import type { MathTask } from '../../../types/worksheet';
import { latexToDocxMathParagraph, latexFallbackParagraph } from '../mathConverter';
import type { TaskRendererConfig } from './shared';

export function renderMath(task: MathTask, config: TaskRendererConfig): Paragraph[] {
    /**
     * Converts LaTeX to native Word OMML math (fully editable).
     * Falls back to styled source text when conversion fails so nothing is lost.
     */
    if (!task.content || !task.content.trim()) {
        return [
            new Paragraph({
                children: [
                    new TextRun({
                        text: '(Leere Formel)',
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.placeholder,
                        italics: true,
                    }),
                ],
            }),
        ];
    }

    const spacing = { before: 60, after: config.taskGapAfter };

    // Try native OMML conversion first.
    const ommlParagraph = latexToDocxMathParagraph(task.content, { spacing });
    if (ommlParagraph) {
        return [ommlParagraph];
    }

    // Fallback: render LaTeX source as italic styled text (editable).
    return [latexFallbackParagraph(task.content, config.fontFamily, config.fontSizePt, { spacing })];
}
