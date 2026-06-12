import { Paragraph } from 'docx';
import type { LineaturTask } from '../../../types/worksheet';
import { getRowHeightMM } from '../../lineaturStyles';
import { htmlToDocxParagraphs } from '../htmlToDocx';
import type { TaskRendererConfig } from './shared';

export function renderLineatur(task: LineaturTask, config: TaskRendererConfig): Paragraph[] {
    /**
     * Renders lineatur as native Word paragraphs with bottom borders so the
     * result is truly editable (no image). Each "row" becomes one empty
     * paragraph with a ruled bottom border and fixed minimum height.
     *
     * For primary-4-lines (Grundschul): alternates two border weights to
     * approximate the 4-line pattern. All other styles use a single line.
     */
    const elements: Paragraph[] = [];

    if (task.promptHtml && task.promptHtml.trim()) {
        const promptParagraphs = htmlToDocxParagraphs(task.promptHtml, {
            fontFamily: config.fontFamily,
            fontSizePt: config.fontSizePt,
            color: config.docxTheme.text,
        }, 80);
        elements.push(...promptParagraphs);
    }

    const rowCount = Math.max(1, Math.min(20, task.lineRows ?? task.rowCount ?? 4));
    const rowHeightMM = getRowHeightMM(task.lineStyle);
    // Convert mm → twips for spacing (1mm ≈ 56.7 twips).
    const rowHeightTwip = Math.round(rowHeightMM * 56.7);
    const isGrundschul = task.lineStyle === 'primary-4-lines';

    for (let i = 0; i < rowCount; i++) {
        // Grundschul: 4 visible sub-lines per block, so expand each row.
        const linesPerRow = isGrundschul ? 4 : 1;
        for (let l = 0; l < linesPerRow; l++) {
            const isAuxLine = isGrundschul && (l === 1 || l === 2); // middle dashed lines
            elements.push(
                new Paragraph({
                    children: [],
                    spacing: {
                        before: 0,
                        after: 0,
                        line: isGrundschul ? Math.round(rowHeightTwip / linesPerRow) : rowHeightTwip,
                        lineRule: 'exact' as never,
                    },
                    border: {
                        bottom: {
                            style: isAuxLine ? 'dashed' : 'single',
                            size: isAuxLine ? 4 : 6,
                            color: isAuxLine ? 'CBD5E1' : '94A3B8',
                            space: 0,
                        },
                    },
                }),
            );
        }
    }

    return elements;
}
