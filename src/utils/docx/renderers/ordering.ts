import { Paragraph, Table, TextRun } from 'docx';
import type { OrderingTask } from '../../../types/worksheet';
import { createEditorContentBox, type TaskRendererConfig } from './shared';

/* ══════════════════════════════════════════════════
   DOCX-Renderer für ordering (Nummerierungs-/Reihenfolgeaufgabe).

   - Schülerfassung: leeres Nummernfeld "[    ]" vor jedem Element.
   - Lehrerfassung: korrekte Position "[ 2 ]" (hervorgehoben) vor jedem
     Element. Die Anzeigereihenfolge entspricht der items-Reihenfolge.
   ══════════════════════════════════════════════════ */
export function renderOrdering(
    task: OrderingTask,
    isTeacherVersion: boolean,
    config: TaskRendererConfig,
): (Paragraph | Table)[] {
    const children: Paragraph[] = [];

    if (task.prompt && task.prompt.trim()) {
        children.push(
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
                spacing: { before: 0, after: 120 },
            }),
        );
    }

    if (task.items.length === 0) {
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: '(Keine Elemente)',
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.muted,
                        italics: true,
                    }),
                ],
            }),
        );
        return [createEditorContentBox(children, config)];
    }

    for (const item of task.items) {
        const boxText = isTeacherVersion ? `[ ${item.correctPosition} ]  ` : '[      ]  ';
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: boxText,
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: isTeacherVersion ? config.docxTheme.correctAnswer : config.docxTheme.text,
                        bold: isTeacherVersion,
                    }),
                    new TextRun({
                        text: item.text || '—',
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.text,
                    }),
                ],
                spacing: { before: 0, after: 80 },
            }),
        );
    }

    return [createEditorContentBox(children, config)];
}
