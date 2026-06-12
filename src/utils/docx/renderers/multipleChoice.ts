import {
    AlignmentType,
    HeightRule,
    LineRuleType,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
} from 'docx';
import type { MultipleChoiceTask } from '../../../types/worksheet';
import { htmlToDocxParagraphs } from '../htmlToDocx';
import {
    EDITOR_BORDER,
    EDITOR_CARD_BG,
    EDITOR_OPTION_CORRECT_BG,
    editorBorder,
    type TaskRendererConfig,
} from './shared';

export function renderMultipleChoice(
    task: MultipleChoiceTask,
    isTeacherVersion: boolean,
    config: TaskRendererConfig,
): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];

    if (task.question && task.question.trim()) {
        // Question as direct paragraphs — NOT wrapped in createEditorContentBox,
        // which would triple-nest tables and cause character-by-character wrapping.
        const questionParagraphs = htmlToDocxParagraphs(task.question, {
            fontFamily: config.fontFamily,
            fontSizePt: config.fontSizePt,
            color: config.docxTheme.text,
            bold: true,
        }, 30);
        elements.push(...questionParagraphs);
    }

    const answerColDXA = config.a4InnerWidthDxa - config.checkboxColDxa - 360;
    const MC_CHECKBOX_SIZE_PT = Math.max(config.fontSizePt + 5, 16);
    const MC_CHECKBOX_FONT = 'Arial';
    const MC_CHECKBOX_LINE_TWIP = 260;

    for (const [index, option] of task.options.entries()) {
        const isCorrectTeacher = isTeacherVersion && option.isCorrect;
        const checkChar = isCorrectTeacher ? '☑' : '☐';
        const textColor = isCorrectTeacher ? config.docxTheme.correctAnswer : config.docxTheme.text;
        const isBold = isCorrectTeacher;
        const optionParagraphs = htmlToDocxParagraphs(option.text || `Option ${index + 1}`, {
            fontFamily: config.fontFamily,
            fontSizePt: config.fontSizePt,
            color: textColor,
            bold: isBold,
        }, 20);

        elements.push(
            new Table({
                rows: [
                    new TableRow({
                        height: { value: config.mcOptionRowDxa, rule: HeightRule.ATLEAST },
                        children: [
                            new TableCell({
                                children: [
                                    new Paragraph({
                                        children: [
                                            new TextRun({
                                                text: checkChar,
                                                font: MC_CHECKBOX_FONT,
                                                size: MC_CHECKBOX_SIZE_PT * 2,
                                                color: textColor,
                                                bold: true,
                                            }),
                                        ],
                                        alignment: AlignmentType.CENTER,
                                        spacing: {
                                            before: 0,
                                            after: 0,
                                            line: MC_CHECKBOX_LINE_TWIP,
                                            lineRule: LineRuleType.EXACT,
                                        },
                                    }),
                                ],
                                width: { size: config.checkboxColDxa, type: WidthType.DXA },
                                verticalAlign: VerticalAlign.CENTER,
                                shading: { fill: isCorrectTeacher ? EDITOR_OPTION_CORRECT_BG : EDITOR_CARD_BG, type: ShadingType.CLEAR },
                                borders: {
                                    top: editorBorder(isCorrectTeacher ? config.docxTheme.correctAnswer : EDITOR_BORDER),
                                    bottom: editorBorder(isCorrectTeacher ? config.docxTheme.correctAnswer : EDITOR_BORDER),
                                    left: editorBorder(isCorrectTeacher ? config.docxTheme.correctAnswer : EDITOR_BORDER),
                                    right: { style: 'none', size: 0, color: 'FFFFFF' },
                                },
                            }),
                            new TableCell({
                                children: optionParagraphs.length > 0
                                    ? optionParagraphs
                                    : [new Paragraph({ children: [], spacing: { before: 0, after: 0 } })],
                                width: { size: answerColDXA, type: WidthType.DXA },
                                verticalAlign: VerticalAlign.CENTER,
                                margins: {
                                    top: 90,
                                    right: 140,
                                    bottom: 90,
                                    left: 80,
                                },
                                shading: { fill: isCorrectTeacher ? EDITOR_OPTION_CORRECT_BG : EDITOR_CARD_BG, type: ShadingType.CLEAR },
                                borders: {
                                    top: editorBorder(isCorrectTeacher ? config.docxTheme.correctAnswer : EDITOR_BORDER),
                                    bottom: editorBorder(isCorrectTeacher ? config.docxTheme.correctAnswer : EDITOR_BORDER),
                                    left: { style: 'none', size: 0, color: 'FFFFFF' },
                                    right: editorBorder(isCorrectTeacher ? config.docxTheme.correctAnswer : EDITOR_BORDER),
                                },
                            }),
                        ],
                    }),
                ],
                width: { size: config.a4InnerWidthDxa - 360, type: WidthType.DXA },
                layout: TableLayoutType.FIXED,
                borders: config.noTableBorders,
            }),
        );
    }

    return elements;
}
