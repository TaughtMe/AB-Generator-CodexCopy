import { Paragraph, Table, TextRun } from 'docx';
import type { HeadingTask, InformationTextTask, InstructionTask } from '../../../types/worksheet';
import { htmlToDocxParagraphs } from '../htmlToDocx';
import { createEditorContentBox, type TaskRendererConfig } from './shared';

export function renderInstruction(
    task: InstructionTask,
    config: TaskRendererConfig,
): (Paragraph | Table)[] {
    if (!task.text || !task.text.trim()) {
        return [createEditorContentBox([
            new Paragraph({
                children: [
                    new TextRun({
                        text: '(Kein Aufgabentext)',
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.muted,
                        italics: true,
                    }),
                ],
            }),
        ], config)];
    }

    const paragraphs = htmlToDocxParagraphs(task.text, {
        fontFamily: config.fontFamily,
        fontSizePt: config.fontSizePt,
        color: config.docxTheme.text,
    }, 30);
    return [createEditorContentBox(paragraphs, config)];
}

export function renderInformation(
    task: InformationTextTask,
    config: TaskRendererConfig,
): (Paragraph | Table)[] {
    if (!task.content || !task.content.trim()) {
        return [createEditorContentBox([
            new Paragraph({
                children: [
                    new TextRun({
                        text: '(Kein Informationstext)',
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.muted,
                        italics: true,
                    }),
                ],
            }),
        ], config)];
    }

    const paragraphs = htmlToDocxParagraphs(task.content, {
        fontFamily: config.fontFamily,
        fontSizePt: config.fontSizePt,
        color: config.docxTheme.text,
    }, 30);
    return [createEditorContentBox(paragraphs, config)];
}

export function renderHeading(
    task: HeadingTask,
    config: TaskRendererConfig,
): Paragraph[] {
    const text = task.text?.trim() || 'Zwischenüberschrift';

    return [
        new Paragraph({
            children: [
                new TextRun({
                    text,
                    font: config.fontFamily,
                    size: (config.fontSizePt + 4) * 2,
                    color: config.docxTheme.text,
                    bold: true,
                }),
            ],
            spacing: { before: 200, after: 120 },
        }),
    ];
}
