import { Paragraph, Table, TextRun } from 'docx';
import type { Task, TaskDifficulty } from '../../../types/worksheet';
import { createEditorContentBox, htmlToPlainText, type TaskRendererConfig } from './shared';

/* ══════════════════════════════════════════════════
   renderers/teacherFields.ts – Lehrerinfo-Block für die DOCX-Lehrerversion.

   Pendant zum PDF-TeacherFieldsPrint: rendert die Phase-8-Felder (Lösung,
   Hinweise, Punkte, Schwierigkeit, Zeit, Kompetenz, Notiz) als editierbaren,
   grün getönten Kasten unter der Aufgabe. Wird vom Orchestrator nur in der
   Lehrerversion und nur bei gesetzten Feldern angehängt.
   ══════════════════════════════════════════════════ */

const DIFFICULTY_LABELS: Record<TaskDifficulty, string> = {
    easy: 'Leicht',
    medium: 'Mittel',
    hard: 'Schwer',
};

const TEACHER_BG = 'F0FDF4';
const TEACHER_BORDER = '16A34A';

export function taskHasTeacherFields(task: Task): boolean {
    return (
        task.points != null
        || Boolean(task.difficulty)
        || task.estimatedTime != null
        || Boolean(task.competence?.trim())
        || Boolean(task.solution?.trim())
        || (Array.isArray(task.hints) && task.hints.length > 0)
        || Boolean(task.teacherNotes?.trim())
    );
}

export function renderTeacherFieldsBlock(task: Task, config: TaskRendererConfig): (Paragraph | Table)[] {
    if (!taskHasTeacherFields(task)) return [];

    const { fontFamily, fontSizePt, docxTheme } = config;
    const bodySize = Math.round(fontSizePt * 2);
    const smallSize = 9 * 2;
    const labelSize = 8 * 2;

    const heading = (text: string) =>
        new Paragraph({
            spacing: { before: 60, after: 20 },
            children: [new TextRun({ text, bold: true, font: fontFamily, size: smallSize, color: docxTheme.taskTitle })],
        });
    const line = (text: string) =>
        new Paragraph({
            spacing: { before: 0, after: 20 },
            children: [new TextRun({ text, font: fontFamily, size: bodySize, color: docxTheme.text })],
        });

    const paras: Paragraph[] = [
        new Paragraph({
            spacing: { before: 0, after: 40 },
            children: [new TextRun({ text: 'LEHRERINFO', bold: true, font: fontFamily, size: labelSize, color: docxTheme.teacherBanner })],
        }),
    ];

    const metaParts: string[] = [];
    if (task.points != null) metaParts.push(`Punkte: ${task.points}`);
    if (task.difficulty) metaParts.push(`Schwierigkeit: ${DIFFICULTY_LABELS[task.difficulty]}`);
    if (task.estimatedTime != null) metaParts.push(`Zeit: ${task.estimatedTime} Min.`);
    if (task.competence?.trim()) metaParts.push(`Kompetenz: ${task.competence.trim()}`);
    if (metaParts.length > 0) paras.push(line(metaParts.join('   ·   ')));

    if (task.solution?.trim()) {
        paras.push(heading('Lösung'));
        const lines = htmlToPlainText(task.solution).split('\n').map((l) => l.trim()).filter(Boolean);
        for (const l of (lines.length > 0 ? lines : [htmlToPlainText(task.solution)])) paras.push(line(l));
    }

    if (Array.isArray(task.hints) && task.hints.length > 0) {
        paras.push(heading('Hinweise'));
        for (const hint of task.hints) paras.push(line(`•   ${hint}`));
    }

    if (task.teacherNotes?.trim()) {
        paras.push(heading('Notiz'));
        paras.push(line(task.teacherNotes.trim()));
    }

    return [createEditorContentBox(paras, config, { shading: TEACHER_BG, borderColor: TEACHER_BORDER })];
}
