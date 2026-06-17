import {
    HeightRule,
    Paragraph,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
} from 'docx';
import type { MatchingTask, MatchingPair } from '../../../types/worksheet';
import { type TaskRendererConfig } from './shared';

/* ══════════════════════════════════════════════════
   DOCX-Renderer für matching (Zuordnungsaufgabe).

   Tabelle ohne sichtbare Rahmen: Label | linker Begriff | Abstand |
   rechter Begriff. Keine Eingabefelder/Kästchen – die Lernenden ziehen
   Verbindungslinien selbst. Linke Spalte in Reihenfolge (a, b, c …),
   rechte Spalte gemischt (rightOrder). Lehrerfassung: Lösungsbuchstabe
   vor dem rechten Begriff.
   ══════════════════════════════════════════════════ */

const letter = (index: number) => String.fromCharCode(97 + index);

function noBorders() {
    const none = { style: 'none' as const, size: 0, color: 'FFFFFF' };
    return { top: none, bottom: none, left: none, right: none };
}

export function renderMatching(
    task: MatchingTask,
    isTeacherVersion: boolean,
    config: TaskRendererConfig,
): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];

    if (task.prompt && task.prompt.trim()) {
        elements.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: task.prompt,
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.text,
                        bold: true,
                    }),
                ],
                spacing: { before: 0, after: 160 },
            }),
        );
    }

    if (task.pairs.length === 0) {
        elements.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: '(Keine Paare)',
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.muted,
                        italics: true,
                    }),
                ],
            }),
        );
        return elements;
    }

    // rechte Spalte in rightOrder-Reihenfolge auflösen
    const rightColumn = task.rightOrder
        .map((id) => task.pairs.find((pair) => pair.id === id))
        .filter((pair): pair is MatchingPair => Boolean(pair));

    const tableWidth = config.a4InnerWidthDxa - 360;
    const labelW = 520;
    const gapW = 900;
    const remaining = tableWidth - labelW - gapW;
    const leftW = Math.floor(remaining / 2);
    const rightW = remaining - leftW;
    const ROW_HEIGHT = 460; // großzügiger Zeilenraum für Verbindungslinien

    const cell = (children: Paragraph[], width: number) =>
        new TableCell({
            children,
            width: { size: width, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 40, bottom: 40, left: 40, right: 40 },
            borders: noBorders(),
        });

    const textParagraph = (runs: TextRun[]) =>
        new Paragraph({ children: runs, spacing: { before: 0, after: 0 } });

    const rows = task.pairs.map((pair, index) => {
        const rightPair = rightColumn[index] ?? pair;
        const solutionLetter = letter(task.pairs.findIndex((candidate) => candidate.id === rightPair.id));

        const leftRuns = [
            new TextRun({
                text: pair.left || '—',
                font: config.fontFamily,
                size: config.fontSizePt * 2,
                color: config.docxTheme.text,
            }),
        ];

        const rightRuns: TextRun[] = [];
        if (isTeacherVersion) {
            rightRuns.push(
                new TextRun({
                    text: `(${solutionLetter}) `,
                    font: config.fontFamily,
                    size: config.fontSizePt * 2,
                    color: config.docxTheme.correctAnswer,
                    bold: true,
                }),
            );
        }
        rightRuns.push(
            new TextRun({
                text: rightPair.right || '—',
                font: config.fontFamily,
                size: config.fontSizePt * 2,
                color: config.docxTheme.text,
            }),
        );

        return new TableRow({
            cantSplit: true, // Paar-Zeile bleibt zusammen (break-inside: avoid)
            height: { value: ROW_HEIGHT, rule: HeightRule.ATLEAST },
            children: [
                cell([textParagraph([
                    new TextRun({
                        text: `${letter(index)})`,
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.text,
                        bold: true,
                    }),
                ])], labelW),
                cell([textParagraph(leftRuns)], leftW),
                cell([textParagraph([])], gapW),
                cell([textParagraph(rightRuns)], rightW),
            ],
        });
    });

    elements.push(
        new Table({
            rows,
            width: { size: tableWidth, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            borders: {
                ...noBorders(),
                insideHorizontal: { style: 'none', size: 0, color: 'FFFFFF' },
                insideVertical: { style: 'none', size: 0, color: 'FFFFFF' },
            },
        }),
    );

    return elements;
}
