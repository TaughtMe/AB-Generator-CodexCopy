import {
    AlignmentType,
    Paragraph,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    ShadingType,
    WidthType,
} from 'docx';

/* ══════════════════════════════════════════════════
   renderers/shared.ts – Gemeinsame Typen, Konstanten und Bausteine
   der DOCX-Tasktyp-Renderer.

   Jeder Tasktyp-Renderer (multipleChoice, cloze, table, …) importiert
   von hier — nie voneinander. So bleiben die Module unabhängig und
   neue Tasktypen brauchen nur eine neue Datei + einen Dispatcher-Case.
   ══════════════════════════════════════════════════ */

export type DocxAlignment = (typeof AlignmentType)[keyof typeof AlignmentType];
export type BorderStyleValue = 'none' | 'single';

export interface DocxTheme {
    taskTitle: string;
    text: string;
    correctAnswer: string;
    teacherBanner: string;
    placeholder: string;
    muted: string;
    fieldLabel: string;
    error: string;
}

export interface TaskRendererConfig {
    fontFamily: string;
    fontSizePt: number;
    taskGapAfter: number;
    taskTitleRowDxa: number;
    a4InnerWidthDxa: number;
    checkboxColDxa: number;
    mcOptionRowDxa: number;
    noTableBorders: {
        top: { style: BorderStyleValue; size: number; color: string };
        bottom: { style: BorderStyleValue; size: number; color: string };
        left: { style: BorderStyleValue; size: number; color: string };
        right: { style: BorderStyleValue; size: number; color: string };
        insideHorizontal: { style: BorderStyleValue; size: number; color: string };
        insideVertical: { style: BorderStyleValue; size: number; color: string };
    };
    docxTheme: DocxTheme;
}

/* ── Editor-Farbpalette (entspricht Tailwind worksheet.* Tokens) ── */
export const EDITOR_CARD_BG = 'F8FAFC';
export const EDITOR_BORDER = 'E2E8F0';
export const EDITOR_MUTED = '475569';
export const EDITOR_OPTION_CORRECT_BG = 'F0FDF4';

export function editorBorder(color = EDITOR_BORDER, size = 6) {
    return {
        style: 'single' as const,
        size,
        color,
    };
}

export function editorBoxBorders(color = EDITOR_BORDER, size = 6) {
    const border = editorBorder(color, size);
    return {
        top: border,
        right: border,
        bottom: border,
        left: border,
        insideHorizontal: border,
        insideVertical: border,
    };
}

export function htmlToPlainText(value: string | undefined): string {
    if (!value) return '';
    return value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** Innere Inhaltsbox im Editor-Card-Look (heller Hintergrund, feiner Rahmen). */
export function createEditorContentBox(
    children: (Paragraph | Table)[],
    config: TaskRendererConfig,
    options: { shading?: string; borderColor?: string } = {},
): Table {
    return new Table({
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        children: children.length > 0
                            ? children
                            : [new Paragraph({ children: [], spacing: { before: 0, after: 0 } })],
                        margins: {
                            top: 120,
                            right: 160,
                            bottom: 120,
                            left: 160,
                        },
                        shading: { fill: options.shading ?? EDITOR_CARD_BG, type: ShadingType.CLEAR },
                        borders: {
                            top: editorBorder(options.borderColor),
                            right: editorBorder(options.borderColor),
                            bottom: editorBorder(options.borderColor),
                            left: editorBorder(options.borderColor),
                        },
                    }),
                ],
            }),
        ],
        width: { size: config.a4InnerWidthDxa - 360, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        borders: editorBoxBorders(options.borderColor),
    });
}
