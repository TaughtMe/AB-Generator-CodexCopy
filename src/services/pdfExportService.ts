import fontkit from '@pdf-lib/fontkit';
import {
    PDFDocument,
    PageSizes,
    StandardFonts,
    rgb,
    type PDFForm,
    type PDFFont,
    type PDFPage,
} from 'pdf-lib';
import type { ExportVariant } from '../components/editor/ExportMenu';
import type { DesignSnapshot } from '../types/designTemplate';
import type {
    ClozeTask,
    ColumnsTask,
    InformationTask,
    LineaturTask,
    MultipleChoiceTask,
    TableTask,
    Task,
} from '../types/worksheet';
import { tokenizeClozeContent } from '../utils/clozeParser';
import { getRowHeightMM } from '../utils/lineaturStyles';
import { fetchFontFromCDN } from '../utils/googleFonts';

const [A4_WIDTH_PT, A4_HEIGHT_PT] = PageSizes.A4;
const PAGE_MARGIN_LEFT = 20 * 2.8346456693;
const PAGE_MARGIN_RIGHT = 20 * 2.8346456693;
const PAGE_MARGIN_TOP = 20 * 2.8346456693;
const PAGE_MARGIN_BOTTOM = 20 * 2.8346456693;

const TITLE_SIZE = 10.5;
const SECTION_TITLE_SIZE = 8.25;
const BODY_SIZE = 10.5;
const SMALL_SIZE = 8;

const CONTENT_WIDTH = A4_WIDTH_PT - PAGE_MARGIN_LEFT - PAGE_MARGIN_RIGHT;
const TEXT_COLOR = rgb(0.07, 0.1, 0.16);
const MUTED_TEXT_COLOR = rgb(0.39, 0.45, 0.56);
const BORDER_COLOR = rgb(0.77, 0.81, 0.87);
const SOFT_BACKGROUND = rgb(0.97, 0.98, 1);
const TEACHER_HINT_COLOR = rgb(0.09, 0.64, 0.29);

const DEFAULT_FIELD_HEIGHT = 18;

const INDENT_PER_LEVEL = 14;
const MAX_INDENT = 28;

const MIN_TABLE_ROWS = 1;
const MIN_TABLE_COLS = 1;

interface RenderContext {
    pdfDoc: PDFDocument;
    form: PDFForm;
    font: PDFFont;
    boldFont: PDFFont;
    taskHeadingColor: ReturnType<typeof rgb>;
    accentColor: ReturnType<typeof rgb>;
    accentHex: string;
    page: PDFPage;
    y: number;
    taskCounter: number;
    variant: ExportVariant;
    contentInset: number;
}

type PdfDesignSnapshot = DesignSnapshot & {
    accentColor?: string;
    primaryColorForTasks?: boolean;
};

function hexToPdfRgb(hex: string) {
    if (!hex) return rgb(0, 0, 0);
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;
    return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
}

function getAccentHex(designSnapshot: PdfDesignSnapshot): string {
    const accentColor = typeof designSnapshot.accentColor === 'string' ? designSnapshot.accentColor.trim() : '';
    if (accentColor) return accentColor;
    return (designSnapshot.brandColor || '#3b82f6').trim();
}

function shouldApplyPrimaryColorToTasks(designSnapshot: PdfDesignSnapshot): boolean {
    if (typeof designSnapshot.primaryColorForTasks === 'boolean') {
        return designSnapshot.primaryColorForTasks;
    }
    return designSnapshot.applyColorToTasks;
}

function mmToPt(mm: number): number {
    return mm * 2.8346456693;
}

function clampIndent(depth: number): number {
    return Math.min(depth * INDENT_PER_LEVEL, MAX_INDENT);
}

function contentX(ctx: RenderContext, depth: number): number {
    return PAGE_MARGIN_LEFT + clampIndent(depth) + ctx.contentInset;
}

function contentWidth(ctx: RenderContext, depth: number): number {
    return CONTENT_WIDTH - clampIndent(depth) - ctx.contentInset * 2;
}

function ensurePageSpace(ctx: RenderContext, requiredHeight: number): void {
    if (ctx.y - requiredHeight < PAGE_MARGIN_BOTTOM) {
        ctx.page = ctx.pdfDoc.addPage(PageSizes.A4);
        ctx.y = A4_HEIGHT_PT - PAGE_MARGIN_TOP;
    }
}

function moveCursor(ctx: RenderContext, delta: number): void {
    ensurePageSpace(ctx, delta);
    ctx.y -= delta;
}

function decodeHtmlEntities(value: string): string {
    if (typeof DOMParser === 'undefined') return value;
    const doc = new DOMParser().parseFromString(value, 'text/html');
    return doc.documentElement.textContent ?? value;
}

function normalizeWhitespace(value: string): string {
    return value
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function htmlToPlainText(value: string | undefined): string {
    if (!value) return '';
    if (!/[<>]/.test(value)) return normalizeWhitespace(value);

    const withBlockBreaks = value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|table|ul|ol)>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<[^>]+>/g, '');

    return normalizeWhitespace(decodeHtmlEntities(withBlockBreaks));
}

// ── Rich-Text rendering ────────────────────────────────────────────────────

function parseCssColor(css: string): ReturnType<typeof rgb> | undefined {
    const s = css.trim();
    const m = s.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (m) return rgb(parseInt(m[1], 10) / 255, parseInt(m[2], 10) / 255, parseInt(m[3], 10) / 255);
    if (/^#[0-9a-fA-F]{3,6}$/.test(s)) return hexToPdfRgb(s);
    return undefined;
}

/** Map gängiger Tailwind text-{color}-{shade} Klassen → Hex */
const TAILWIND_TEXT_COLORS: Record<string, string> = {
    'text-red-400': '#f87171', 'text-red-500': '#ef4444', 'text-red-600': '#dc2626', 'text-red-700': '#b91c1c',
    'text-orange-400': '#fb923c', 'text-orange-500': '#f97316', 'text-orange-600': '#ea580c',
    'text-yellow-400': '#facc15', 'text-yellow-500': '#eab308', 'text-yellow-600': '#ca8a04',
    'text-green-400': '#4ade80', 'text-green-500': '#22c55e', 'text-green-600': '#16a34a', 'text-green-700': '#15803d',
    'text-teal-500': '#14b8a6', 'text-teal-600': '#0d9488',
    'text-cyan-500': '#06b6d4', 'text-cyan-600': '#0891b2',
    'text-blue-400': '#60a5fa', 'text-blue-500': '#3b82f6', 'text-blue-600': '#2563eb', 'text-blue-700': '#1d4ed8',
    'text-indigo-500': '#6366f1', 'text-indigo-600': '#4f46e5',
    'text-violet-500': '#8b5cf6', 'text-violet-600': '#7c3aed',
    'text-purple-500': '#a855f7', 'text-purple-600': '#9333ea',
    'text-pink-500': '#ec4899', 'text-pink-600': '#db2777',
    'text-slate-400': '#94a3b8', 'text-slate-500': '#64748b', 'text-slate-600': '#475569', 'text-slate-700': '#334155',
    'text-gray-400': '#9ca3af', 'text-gray-500': '#6b7280', 'text-gray-600': '#4b5563', 'text-gray-700': '#374151',
    'text-black': '#000000', 'text-white': '#ffffff',
};

function colorFromClassList(className: string): ReturnType<typeof rgb> | undefined {
    // Arbitrary value: text-[#rrggbb] or text-[rgb(...)]
    const arbitrary = className.match(/text-\[([^\]]+)\]/);
    if (arbitrary) return parseCssColor(arbitrary[1]);
    // Named Tailwind classes
    for (const cls of className.split(/\s+/)) {
        if (TAILWIND_TEXT_COLORS[cls]) return hexToPdfRgb(TAILWIND_TEXT_COLORS[cls]);
    }
    return undefined;
}

interface StyledRun {
    text: string;
    bold: boolean;
    underline?: boolean;
    color?: ReturnType<typeof rgb>;
}

function htmlToStyledParagraphs(
    html: string,
    linkColor?: ReturnType<typeof rgb>,
): StyledRun[][] {
    if (!html) return [];
    if (typeof DOMParser === 'undefined' || !/<[a-z]/i.test(html)) {
        const text = normalizeWhitespace(html.replace(/\n{3,}/g, '\n\n'));
        return text ? text.split('\n').map((line) => [{ text: line, bold: false }]) : [];
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const result: StyledRun[][] = [];
    let current: StyledRun[] = [];
    const BLOCK = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'tr']);
    const BOLD_TAGS = new Set(['strong', 'b', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

    function flush() {
        const trimmed = current.filter((r) => r.text.length > 0);
        if (trimmed.length > 0) result.push(trimmed);
        current = [];
    }

    function pushText(text: string, bold: boolean, color: ReturnType<typeof rgb> | undefined, underline?: boolean) {
        const t = text.replace(/[\r\n\t]/g, ' ').replace(/ {2,}/g, ' ');
        if (!t || (t === ' ' && current.length === 0)) return;
        const last = current[current.length - 1];
        if (last && last.bold === bold && last.color === color && !!last.underline === !!underline) {
            last.text += t;
        } else {
            current.push({ text: t, bold, color, underline });
        }
    }

    function walk(node: Node, bold: boolean, color: ReturnType<typeof rgb> | undefined, underline: boolean): void {
        if (node.nodeType === Node.TEXT_NODE) {
            pushText(node.textContent ?? '', bold, color, underline);
            return;
        }
        if (!(node instanceof Element)) return;
        const tag = node.tagName.toLowerCase();
        if (tag === 'br') { flush(); return; }
        if (BLOCK.has(tag)) {
            flush();
            if (tag === 'li') pushText('• ', false, undefined);
        }
        const isBold = bold || BOLD_TAGS.has(tag);
        const isUnderline = underline || tag === 'u' || tag === 'a';
        let childColor = color;
        const style = node.getAttribute('style') ?? '';
        const cm = style.match(/(?:^|;)\s*color:\s*([^;]+)/);
        if (cm) childColor = parseCssColor(cm[1]) ?? color;
        // Tailwind class-based colors
        const className = node.getAttribute('class') ?? '';
        if (className && !childColor) childColor = colorFromClassList(className) ?? color;
        if (tag === 'a' && linkColor && !childColor) childColor = linkColor;
        for (const child of Array.from(node.childNodes)) walk(child, isBold, childColor, isUnderline);
        if (BLOCK.has(tag)) flush();
    }

    walk(doc.body, false, undefined, false);
    flush();
    return result.filter((p) => p.some((r) => r.text.trim()));
}

function drawRichText(
    ctx: RenderContext,
    html: string,
    options: {
        x: number;
        width: number;
        size?: number;
        lineHeight?: number;
        defaultColor?: ReturnType<typeof rgb>;
    },
): void {
    if (!html) return;
    const size = options.size ?? BODY_SIZE;
    const lh = options.lineHeight ?? size * 1.42;
    const defaultColor = options.defaultColor ?? TEXT_COLOR;
    const paragraphs = htmlToStyledParagraphs(html, ctx.accentColor);
    if (paragraphs.length === 0) return;

    for (let pi = 0; pi < paragraphs.length; pi += 1) {
        if (pi > 0) ctx.y -= Math.round(lh * 0.45);
        const para = paragraphs[pi];

        type RichToken = { text: string; font: PDFFont; color: ReturnType<typeof rgb>; underline: boolean; isSpace: boolean };
        const tokens: RichToken[] = [];
        for (const run of para) {
            const font = run.bold ? ctx.boldFont : ctx.font;
            const color = run.color ?? defaultColor;
            const underline = !!run.underline;
            for (const part of run.text.split(/(\s+)/)) {
                if (!part) continue;
                if (/^\s+$/.test(part)) {
                    tokens.push({ text: ' ', font: ctx.font, color: defaultColor, underline: false, isSpace: true });
                } else {
                    tokens.push({ text: part, font, color, underline, isSpace: false });
                }
            }
        }

        type RichLine = RichToken[];
        const lines: RichLine[] = [];
        let curLine: RichLine = [];
        let curWidth = 0;

        for (const tok of tokens) {
            if (tok.isSpace) {
                if (curLine.length > 0) { curLine.push(tok); curWidth += tok.font.widthOfTextAtSize(' ', size); }
                continue;
            }
            const w = tok.font.widthOfTextAtSize(tok.text, size);
            if (curLine.length === 0) {
                curLine.push(tok); curWidth = w;
            } else if (curWidth + w <= options.width) {
                curLine.push(tok); curWidth += w;
            } else {
                while (curLine.length > 0 && curLine[curLine.length - 1].isSpace) curLine.pop();
                lines.push(curLine);
                curLine = [tok]; curWidth = w;
            }
        }
        while (curLine.length > 0 && curLine[curLine.length - 1].isSpace) curLine.pop();
        if (curLine.length > 0) lines.push(curLine);

        for (const line of lines) {
            ensurePageSpace(ctx, lh);
            const lineY = ctx.y - lh + 2;
            let curX = options.x;
            for (const tok of line) {
                ctx.page.drawText(tok.text, { x: curX, y: lineY, size, font: tok.font, color: tok.color });
                const w = tok.font.widthOfTextAtSize(tok.text, size);
                if (tok.underline && !tok.isSpace) {
                    ctx.page.drawLine({
                        start: { x: curX, y: lineY - 1.5 },
                        end: { x: curX + w, y: lineY - 1.5 },
                        thickness: 0.6,
                        color: tok.color,
                    });
                }
                curX += w;
            }
            ctx.y -= lh;
        }
    }
}

function sanitizeFilename(value: string): string {
    const safe = value
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return safe || 'Arbeitsblatt';
}

function splitLongToken(token: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
    if (!token) return [''];
    const chunks: string[] = [];
    let current = '';

    for (const char of token) {
        const candidate = current + char;
        if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth || current.length === 0) {
            current = candidate;
            continue;
        }
        chunks.push(current);
        current = char;
    }

    if (current) chunks.push(current);
    return chunks.length > 0 ? chunks : [''];
}

function wrapLine(line: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
    if (!line.trim()) return [''];

    const words = line.trim().split(/\s+/g);
    const wrapped: string[] = [];
    let current = '';

    for (const word of words) {
        if (!current) {
            if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
                current = word;
            } else {
                const chunks = splitLongToken(word, maxWidth, font, fontSize);
                if (chunks.length > 1) {
                    wrapped.push(...chunks.slice(0, -1));
                }
                current = chunks[chunks.length - 1] ?? '';
            }
            continue;
        }

        const candidate = `${current} ${word}`;
        if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
            current = candidate;
            continue;
        }

        wrapped.push(current);
        if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
            current = word;
        } else {
            const chunks = splitLongToken(word, maxWidth, font, fontSize);
            if (chunks.length > 1) {
                wrapped.push(...chunks.slice(0, -1));
            }
            current = chunks[chunks.length - 1] ?? '';
        }
    }

    if (current) wrapped.push(current);
    return wrapped.length > 0 ? wrapped : [''];
}

function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
    const sourceLines = text.split('\n');
    const result: string[] = [];
    for (const sourceLine of sourceLines) {
        const wrapped = wrapLine(sourceLine, maxWidth, font, fontSize);
        result.push(...wrapped);
    }
    return result.length > 0 ? result : [''];
}

function drawWrappedText(
    ctx: RenderContext,
    text: string,
    options: {
        x: number;
        width: number;
        font?: PDFFont;
        size?: number;
        color?: ReturnType<typeof rgb>;
        lineHeight?: number;
    },
): number {
    const drawFont = options.font ?? ctx.font;
    const drawSize = options.size ?? BODY_SIZE;
    const lineHeight = options.lineHeight ?? drawSize * 1.35;
    const color = options.color ?? TEXT_COLOR;
    const wrapped = wrapText(text, options.width, drawFont, drawSize);

    for (const line of wrapped) {
        ensurePageSpace(ctx, lineHeight);
        ctx.page.drawText(line, {
            x: options.x,
            y: ctx.y - lineHeight + 2,
            size: drawSize,
            font: drawFont,
            color,
        });
        ctx.y -= lineHeight;
    }

    return wrapped.length * lineHeight;
}

const TASK_TYPE_LABELS_PDF: Record<string, string> = {
    'instruction': 'AUFGABE',
    'heading': 'ÜBERSCHRIFT',
    'multiple-choice': 'MULTIPLE CHOICE',
    'cloze': 'LÜCKENTEXT',
    'math': 'MATHEMATIK',
    'table': 'TABELLE',
    'lineatur': 'LINEATUR',
    'columns': 'ZWEISPALTIG',
    'page-break': 'SEITENUMBRUCH',
    'image-placeholder': 'BILD',
    'information': 'INFORMATION',
};

function drawTaskHeader(ctx: RenderContext, task: Task, depth: number): void {
    const indent = clampIndent(depth);
    const x = PAGE_MARGIN_LEFT + indent;
    const width = CONTENT_WIDTH - indent;
    const headerHeight = 18;
    const shouldNumber = task.showNumber !== false;
    const typeLabel = TASK_TYPE_LABELS_PDF[task.type] ?? task.type.toUpperCase();
    const taskTitle = htmlToPlainText(task.title || '');

    // Smart-fix: wenn der Titel bereits mit einem Aufgaben-Prefix beginnt
    // (z.B. "Aufgabe 3", "3.", "1)"), die Zahl nicht doppelt voranstellen
    const STARTS_WITH_TASK_NUMBER = /^(aufgabe|übung|\d+[.)\s])/i;
    let heading: string;
    if (shouldNumber) {
        ctx.taskCounter += 1;
        if (taskTitle && STARTS_WITH_TASK_NUMBER.test(taskTitle)) {
            heading = `${typeLabel} — ${taskTitle}`;
        } else if (taskTitle) {
            heading = `${ctx.taskCounter}. ${typeLabel} — ${taskTitle}`;
        } else {
            heading = `${ctx.taskCounter}. ${typeLabel}`;
        }
    } else {
        heading = taskTitle || typeLabel;
    }

    ensurePageSpace(ctx, headerHeight + 6);

    ctx.page.drawRectangle({
        x,
        y: ctx.y - headerHeight,
        width,
        height: headerHeight,
        color: SOFT_BACKGROUND,
        borderColor: BORDER_COLOR,
        borderWidth: 0.6,
    });

    drawWrappedText(ctx, heading, {
        x: x + 6,
        width: width - 10,
        font: ctx.boldFont,
        size: SECTION_TITLE_SIZE,
        color: task.showNumber !== false ? ctx.taskHeadingColor : TEXT_COLOR,
        lineHeight: SECTION_TITLE_SIZE * 1.2,
    });

    moveCursor(ctx, 4);
}

function drawTeacherHint(ctx: RenderContext, text: string, depth: number): void {
    drawWrappedText(ctx, text, {
        x: contentX(ctx, depth),
        width: contentWidth(ctx, depth),
        size: SMALL_SIZE,
        font: ctx.boldFont,
        color: TEACHER_HINT_COLOR,
        lineHeight: SMALL_SIZE * 1.3,
    });
    moveCursor(ctx, 4);
}

function extractDistractors(value: string | undefined): string[] {
    if (!value) return [];
    return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

function renderMultipleChoiceTask(ctx: RenderContext, task: MultipleChoiceTask, depth: number): void {
    const x = contentX(ctx, depth);
    const width = contentWidth(ctx, depth);

    if (task.question) {
        drawRichText(ctx, task.question, {
            x,
            width,
            size: BODY_SIZE,
            lineHeight: BODY_SIZE * 1.35,
        });
        moveCursor(ctx, 4);
    }

    const checkboxSize = 11;
    const cardPadX = 8;
    const cardPadY = 5;
    const checkboxGap = 7;
    const textX = x + cardPadX + checkboxSize + checkboxGap;
    const textWidth = Math.max(80, width - cardPadX * 2 - checkboxSize - checkboxGap);

    for (let index = 0; index < task.options.length; index += 1) {
        const option = task.options[index];
        const isCorrect = ctx.variant === 'teacher' && option.isCorrect;
        const optionText = htmlToPlainText(option.text) || `Option ${index + 1}`;
        const optionLines = wrapText(optionText, textWidth, isCorrect ? ctx.boldFont : ctx.font, BODY_SIZE);
        const textBlockH = optionLines.length * BODY_SIZE * 1.35;
        const cardH = Math.max(checkboxSize + cardPadY * 2, textBlockH + cardPadY * 2);

        ensurePageSpace(ctx, cardH + 4);
        const cardTop = ctx.y;
        const cardY = cardTop - cardH;

        /* Card outline */
        ctx.page.drawRectangle({
            x,
            y: cardY,
            width,
            height: cardH,
            borderColor: isCorrect ? ctx.accentColor : BORDER_COLOR,
            borderWidth: isCorrect ? 1.2 : 0.7,
            color: isCorrect ? rgb(0.94, 0.99, 0.96) : rgb(1, 1, 1),
        });

        /* Checkbox square */
        const squareCenterY = cardY + cardH / 2;
        const squareY = squareCenterY - checkboxSize / 2;
        ctx.page.drawRectangle({
            x: x + cardPadX,
            y: squareY,
            width: checkboxSize,
            height: checkboxSize,
            borderColor: isCorrect ? ctx.accentColor : BORDER_COLOR,
            borderWidth: isCorrect ? 1.2 : 0.7,
            color: rgb(1, 1, 1),
        });
        if (isCorrect) {
            ctx.page.drawLine({
                start: { x: x + cardPadX + 2, y: squareY + 2 },
                end: { x: x + cardPadX + checkboxSize - 2, y: squareY + checkboxSize - 2 },
                thickness: 1.2,
                color: TEACHER_HINT_COLOR,
            });
            ctx.page.drawLine({
                start: { x: x + cardPadX + checkboxSize - 2, y: squareY + 2 },
                end: { x: x + cardPadX + 2, y: squareY + checkboxSize - 2 },
                thickness: 1.2,
                color: TEACHER_HINT_COLOR,
            });
        }

        /* Option text */
        const savedY = ctx.y;
        ctx.y = cardTop - cardPadY;
        if (isCorrect) {
            drawWrappedText(ctx, optionText, {
                x: textX,
                width: textWidth,
                size: BODY_SIZE,
                lineHeight: BODY_SIZE * 1.35,
                color: TEACHER_HINT_COLOR,
                font: ctx.boldFont,
            });
        } else {
            drawRichText(ctx, option.text || `Option ${index + 1}`, {
                x: textX,
                width: textWidth,
                size: BODY_SIZE,
                lineHeight: BODY_SIZE * 1.35,
            });
        }
        ctx.y = savedY - cardH;
        moveCursor(ctx, 4);
    }
}

function renderClozeTask(ctx: RenderContext, task: ClozeTask, depth: number): void {
    const x = contentX(ctx, depth);
    const width = contentWidth(ctx, depth);

    // Build inline HTML: student → underscores, teacher → colored+underlined answer
    const plain = htmlToPlainText(task.content);
    const tokens = tokenizeClozeContent(plain);
    const gaps: string[] = [];
    let inlineHtml = '';

    for (const token of tokens) {
        if (token.type === 'text') {
            // Escape any HTML special chars in plain text
            inlineHtml += token.value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        } else {
            const answer = normalizeWhitespace(token.answer);
            gaps.push(answer);
            if (ctx.variant === 'teacher') {
                inlineHtml += `<u><span style="color:${ctx.accentHex}">${answer || '…'}</span></u>`;
            } else {
                // Underscores roughly matching answer length
                const len = Math.max(6, answer.length);
                inlineHtml += '_'.repeat(len);
            }
        }
    }

    if (!inlineHtml.trim()) inlineHtml = 'Lückentext';

    drawRichText(ctx, inlineHtml, {
        x,
        width,
        size: BODY_SIZE,
        lineHeight: BODY_SIZE * 1.5,
    });
    moveCursor(ctx, 6);

    // Word bank: centered, with bullet separators
    if ((task.wordBankMode ?? 'hidden') !== 'hidden') {
        const distractors = extractDistractors(task.distractors);
        const bankEntries = [...gaps, ...distractors].filter((e) => e.length > 0);
        if (bankEntries.length > 0) {
            moveCursor(ctx, 2);
            const bankText = bankEntries.join('  •  ');
            const bankLines = wrapText(bankText, width, ctx.font, SMALL_SIZE);
            for (const line of bankLines) {
                ensurePageSpace(ctx, SMALL_SIZE * 1.4);
                const lineW = ctx.font.widthOfTextAtSize(line, SMALL_SIZE);
                const centeredX = x + Math.max(0, (width - lineW) / 2);
                ctx.page.drawText(line, {
                    x: centeredX,
                    y: ctx.y - SMALL_SIZE * 1.4 + 2,
                    size: SMALL_SIZE,
                    font: ctx.font,
                    color: MUTED_TEXT_COLOR,
                });
                ctx.y -= SMALL_SIZE * 1.4;
            }
            moveCursor(ctx, 4);
        }
    }
}

function renderLineaturTask(ctx: RenderContext, task: LineaturTask, depth: number): void {
    const x = contentX(ctx, depth);
    const width = contentWidth(ctx, depth);
    const rows = Math.max(1, Math.min(20, Math.round(task.rowCount ?? task.lineRows ?? 5)));
    const rowHeightPt = Math.max(16, Math.round(mmToPt(getRowHeightMM(task.lineStyle)) * 0.65));

    for (let row = 0; row < rows; row += 1) {
        ensurePageSpace(ctx, rowHeightPt + 4);
        const lineY = ctx.y - rowHeightPt + 4;
        ctx.page.drawLine({
            start: { x, y: lineY },
            end: { x: x + width, y: lineY },
            thickness: 0.8,
            color: BORDER_COLOR,
        });
        ctx.y -= rowHeightPt;
        moveCursor(ctx, 4);
    }
}

interface ParsedTable {
    rows: string[][];
    rowCount: number;
    colCount: number;
}

function parseTableContent(task: TableTask): ParsedTable {
    const fallbackRows = Math.max(MIN_TABLE_ROWS, Math.round(task.rows || 0) || 3);
    const fallbackCols = Math.max(MIN_TABLE_COLS, Math.round(task.cols || 0) || 3);

    if (typeof DOMParser === 'undefined' || !task.content || !/<table[\s>]/i.test(task.content)) {
        return {
            rows: Array.from({ length: fallbackRows }, () => Array.from({ length: fallbackCols }, () => '')),
            rowCount: fallbackRows,
            colCount: fallbackCols,
        };
    }

    const doc = new DOMParser().parseFromString(task.content, 'text/html');
    const table = doc.querySelector('table');
    if (!table) {
        return {
            rows: Array.from({ length: fallbackRows }, () => Array.from({ length: fallbackCols }, () => '')),
            rowCount: fallbackRows,
            colCount: fallbackCols,
        };
    }

    const extractedRows: string[][] = [];
    const trElements = Array.from(table.querySelectorAll('tr'));
    for (const tr of trElements) {
        const rowCells = Array.from(tr.querySelectorAll('th,td'))
            .map((cell) => normalizeWhitespace(cell.textContent ?? ''));
        if (rowCells.length > 0) {
            extractedRows.push(rowCells);
        }
    }

    const resolvedRows = extractedRows.length > 0
        ? extractedRows
        : Array.from({ length: fallbackRows }, () => Array.from({ length: fallbackCols }, () => ''));
    const colCount = Math.max(fallbackCols, ...resolvedRows.map((row) => row.length), MIN_TABLE_COLS);
    const normalizedRows = resolvedRows.map((row) => [
        ...row,
        ...Array.from({ length: Math.max(0, colCount - row.length) }, () => ''),
    ]);

    return {
        rows: normalizedRows,
        rowCount: normalizedRows.length,
        colCount,
    };
}

function renderTableTask(ctx: RenderContext, task: TableTask, depth: number): void {
    const x = contentX(ctx, depth);
    const width = contentWidth(ctx, depth);
    const parsed = parseTableContent(task);
    const colWidth = width / parsed.colCount;
    const cellHeight = 26;

    for (let rowIndex = 0; rowIndex < parsed.rowCount; rowIndex += 1) {
        ensurePageSpace(ctx, cellHeight + 2);
        const rowTop = ctx.y;
        const rowCells = parsed.rows[rowIndex] ?? [];

        for (let colIndex = 0; colIndex < parsed.colCount; colIndex += 1) {
            const cellX = x + colWidth * colIndex;
            const isHeaderRow = rowIndex === 0 && rowCells.some((cell) => cell.trim().length > 0);
            const cellText = rowCells[colIndex] ?? '';

            ctx.page.drawRectangle({
                x: cellX,
                y: rowTop - cellHeight,
                width: colWidth,
                height: cellHeight,
                borderColor: BORDER_COLOR,
                borderWidth: 0.8,
                color: isHeaderRow ? SOFT_BACKGROUND : rgb(1, 1, 1),
            });

            if (isHeaderRow && cellText.trim()) {
                drawWrappedText(ctx, cellText, {
                    x: cellX + 3,
                    width: colWidth - 6,
                    font: ctx.boldFont,
                    size: SMALL_SIZE,
                    lineHeight: SMALL_SIZE * 1.2,
                });
                ctx.y = rowTop;
                continue;
            }

            if (ctx.variant === 'teacher' && cellText.trim()) {
                const wrapped = wrapLine(cellText, colWidth - 6, ctx.font, SMALL_SIZE);
                ctx.page.drawText(wrapped[0] ?? '', {
                    x: cellX + 3,
                    y: rowTop - cellHeight + (cellHeight - SMALL_SIZE) / 2,
                    size: SMALL_SIZE,
                    font: ctx.font,
                    color: TEXT_COLOR,
                });
            }
        }

        ctx.y = rowTop - cellHeight;
        moveCursor(ctx, 2);
    }
}

function renderInformationTask(ctx: RenderContext, task: InformationTask, depth: number): void {
    const x = contentX(ctx, depth);
    const width = contentWidth(ctx, depth);
    const hasNotesColumn = task.hasNotesColumn === true;
    const textWidthRatio = Math.max(30, Math.min(80, Math.round(task.textWidthRatio || 60)));

    const textColumnWidth = hasNotesColumn ? (width * textWidthRatio) / 100 : width;

    if (task.isChunked && Array.isArray(task.chunks) && task.chunks.length > 0) {
        for (let ci = 0; ci < task.chunks.length; ci += 1) {
            const chunk = task.chunks[ci];
            if (ci > 0) moveCursor(ctx, 4);
            if (chunk.heading) {
                drawRichText(ctx, chunk.heading, { x, width: textColumnWidth, size: BODY_SIZE, lineHeight: BODY_SIZE * 1.42 });
            }
            if (chunk.content) {
                drawRichText(ctx, chunk.content, { x, width: textColumnWidth, size: BODY_SIZE, lineHeight: BODY_SIZE * 1.42 });
            }
            if (chunk.notesHeading) {
                const noteLabel = htmlToPlainText(chunk.notesHeading);
                if (noteLabel) {
                    drawWrappedText(ctx, `Notiz: ${noteLabel}`, {
                        x,
                        width: textColumnWidth,
                        size: SMALL_SIZE,
                        color: MUTED_TEXT_COLOR,
                        lineHeight: SMALL_SIZE * 1.35,
                    });
                }
            }
        }
    } else if (task.content) {
        drawRichText(ctx, task.content, { x, width: textColumnWidth, size: BODY_SIZE, lineHeight: BODY_SIZE * 1.42 });
    }

    if (hasNotesColumn) {
        moveCursor(ctx, 4);
        const notesX = x + (width * textWidthRatio) / 100 + 6;
        const notesWidth = Math.max(90, width - (width * textWidthRatio) / 100 - 6);
        const lineCount = task.isChunked && Array.isArray(task.chunks) ? Math.max(task.chunks.length * 3, 5) : 8;
        for (let i = 0; i < lineCount; i += 1) {
            ensurePageSpace(ctx, DEFAULT_FIELD_HEIGHT + 3);
            const lineY = ctx.y - DEFAULT_FIELD_HEIGHT + 4;
            ctx.page.drawLine({
                start: { x: notesX, y: lineY },
                end: { x: notesX + notesWidth, y: lineY },
                thickness: 0.8,
                color: BORDER_COLOR,
            });
            ctx.y -= DEFAULT_FIELD_HEIGHT;
            moveCursor(ctx, 3);
        }
    }
}

function renderGenericTextTask(ctx: RenderContext, task: Task, depth: number): void {
    const x = contentX(ctx, depth);
    const width = contentWidth(ctx, depth);

    let hasContent = false;
    if ('text' in task && typeof task.text === 'string' && task.text.trim()) {
        drawRichText(ctx, task.text, { x, width, size: BODY_SIZE, lineHeight: BODY_SIZE * 1.42 });
        hasContent = true;
    }
    if ('content' in task && typeof task.content === 'string' && task.content.trim()) {
        if (hasContent) moveCursor(ctx, 4);
        drawRichText(ctx, task.content, { x, width, size: BODY_SIZE, lineHeight: BODY_SIZE * 1.42 });
        hasContent = true;
    }
    if ('caption' in task && typeof task.caption === 'string' && task.caption.trim()) {
        const captionText = `Bildbeschreibung: ${htmlToPlainText(task.caption)}`;
        if (hasContent) moveCursor(ctx, 4);
        drawWrappedText(ctx, captionText, { x, width, size: BODY_SIZE, lineHeight: BODY_SIZE * 1.42 });
        hasContent = true;
    }
    if (!hasContent) {
        drawWrappedText(ctx, task.title || task.type, { x, width, size: BODY_SIZE, lineHeight: BODY_SIZE * 1.42 });
    }

}

function renderColumnsTask(
    ctx: RenderContext,
    task: ColumnsTask,
    tasksById: Record<string, Task>,
    depth: number,
    ancestry: Set<string>,
): void {
    const x = contentX(ctx, depth);
    const width = contentWidth(ctx, depth);

    drawWrappedText(ctx, 'Zweispaltiger Aufgabenblock', {
        x,
        width,
        size: SMALL_SIZE,
        font: ctx.boldFont,
        color: MUTED_TEXT_COLOR,
        lineHeight: SMALL_SIZE * 1.35,
    });
    moveCursor(ctx, 4);

    for (let slotIndex = 0; slotIndex < task.children.length; slotIndex += 1) {
        const childId = task.children[slotIndex];
        drawWrappedText(ctx, `Spalte ${slotIndex + 1}`, {
            x,
            width,
            size: SMALL_SIZE,
            color: MUTED_TEXT_COLOR,
            lineHeight: SMALL_SIZE * 1.3,
            font: ctx.boldFont,
        });
        moveCursor(ctx, 2);

        if (!childId) {
            drawWrappedText(ctx, '(leer)', {
                x,
                width,
                size: SMALL_SIZE,
                color: MUTED_TEXT_COLOR,
                lineHeight: SMALL_SIZE * 1.25,
            });
            moveCursor(ctx, 4);
            continue;
        }

        const childTask = tasksById[childId];
        if (!childTask) {
            drawWrappedText(ctx, `(fehlende Referenz: ${childId})`, {
                x,
                width,
                size: SMALL_SIZE,
                color: rgb(0.84, 0.2, 0.2),
                lineHeight: SMALL_SIZE * 1.3,
            });
            moveCursor(ctx, 4);
            continue;
        }

        renderTask(ctx, childTask, tasksById, depth + 1, ancestry);
    }
}

/** Quick height estimator — used to draw card backgrounds before content renders. */
function estimateContentHeight(ctx: RenderContext, task: Task, depth: number, extraInset = 0): number {
    const indent = clampIndent(depth);
    const width = CONTENT_WIDTH - indent - (ctx.contentInset + extraInset) * 2;
    let h = 0;

    switch (task.type) {
        case 'multiple-choice': {
            const mc = task as MultipleChoiceTask;
            if (mc.question) {
                const lines = wrapText(htmlToPlainText(mc.question), width, ctx.font, BODY_SIZE);
                h += lines.length * BODY_SIZE * 1.35 + 6;
            }
            const textW = Math.max(80, width - 8 * 2 - 11 - 7);
            for (const opt of mc.options) {
                const lines = wrapText(htmlToPlainText(opt.text) || 'Option', textW, ctx.font, BODY_SIZE);
                h += Math.max(11 + 5 * 2, lines.length * BODY_SIZE * 1.35 + 5 * 2) + 4;
            }
            break;
        }
        case 'cloze': {
            const cloze = task as ClozeTask;
            const plain = htmlToPlainText(cloze.content);
            const lines = wrapText(plain, width, ctx.font, BODY_SIZE);
            h += lines.length * BODY_SIZE * 1.5 + 6;
            if ((cloze.wordBankMode ?? 'hidden') !== 'hidden') h += SMALL_SIZE * 1.4 + 6;
            break;
        }
        case 'lineatur': {
            const lin = task as LineaturTask;
            const rows = Math.max(1, Math.min(20, Math.round(lin.rowCount ?? lin.lineRows ?? 5)));
            const rowH = Math.max(16, Math.round(mmToPt(getRowHeightMM(lin.lineStyle)) * 0.65));
            h += rows * (rowH + 4);
            break;
        }
        case 'table': {
            const tbl = task as TableTask;
            const rows = Math.max(MIN_TABLE_ROWS, Math.round(tbl.rows || 0) || 3);
            h += rows * 28;
            break;
        }
        case 'information': {
            const info = task as InformationTask;
            const plain = htmlToPlainText(info.content);
            const lines = wrapText(plain, width, ctx.font, BODY_SIZE);
            h += lines.length * BODY_SIZE * 1.42 + 8;
            break;
        }
        default: {
            const textParts: string[] = [];
            if ('text' in task && typeof task.text === 'string') textParts.push(htmlToPlainText(task.text));
            if ('content' in task && typeof task.content === 'string') textParts.push(htmlToPlainText(task.content));
            if ('caption' in task && typeof task.caption === 'string') textParts.push(htmlToPlainText(task.caption));
            const plain = textParts.filter(Boolean).join('\n') || task.title || task.type;
            const lines = wrapText(plain, width, ctx.font, BODY_SIZE);
            h += lines.length * BODY_SIZE * 1.42 + 8;
            break;
        }
    }
    if (typeof task.linesAfter === 'number' && task.linesAfter > 0) {
        h += Math.max(1, Math.min(20, Math.round(task.linesAfter))) * (DEFAULT_FIELD_HEIGHT + 3);
    }
    return Math.max(h, 20);
}

function renderTask(
    ctx: RenderContext,
    task: Task,
    tasksById: Record<string, Task>,
    depth: number,
    ancestry: Set<string>,
): void {
    if (ancestry.has(task.id)) {
        drawWrappedText(ctx, `Übersprungene zyklische Referenz (${task.id})`, {
            x: PAGE_MARGIN_LEFT + clampIndent(depth),
            width: CONTENT_WIDTH - clampIndent(depth),
            size: SMALL_SIZE,
            color: rgb(0.84, 0.2, 0.2),
            lineHeight: SMALL_SIZE * 1.35,
        });
        moveCursor(ctx, 6);
        return;
    }

    if (task.type === 'page-break') {
        ctx.page = ctx.pdfDoc.addPage(PageSizes.A4);
        ctx.y = A4_HEIGHT_PT - PAGE_MARGIN_TOP;
        return;
    }

    // ── Card-in-Card Layout ──────────────────────────────────────────────
    const CARD_PAD = 8;        // inner horizontal padding
    const CARD_PAD_V = 6;      // vertical padding inside content card
    const CONTENT_TEXT_PAD = 7;
    const HEADER_H = 22;       // compact editor-like title row
    const HEADER_GAP = 4;      // space between header bottom and content card top

    const indent = clampIndent(depth);
    const cardX = PAGE_MARGIN_LEFT + indent;
    const cardW = CONTENT_WIDTH - indent;

    const contentH = estimateContentHeight(ctx, task, depth, CARD_PAD + CONTENT_TEXT_PAD);
    const totalH = HEADER_H + HEADER_GAP + CARD_PAD_V * 2 + contentH;

    // Ensure we have enough room; if not, start a new page
    ensurePageSpace(ctx, Math.min(totalH + 10, A4_HEIGHT_PT - PAGE_MARGIN_TOP - PAGE_MARGIN_BOTTOM));

    const outerTopY = ctx.y;
    // Clamp card height to remaining page space so it never spills off-page
    const availableH = ctx.y - PAGE_MARGIN_BOTTOM;
    const outerH = Math.min(totalH, availableH);

    // Outer gray card
    ctx.page.drawRectangle({
        x: cardX,
        y: outerTopY - outerH,
        width: cardW,
        height: outerH,
        color: rgb(0.97, 0.98, 0.99),
        borderColor: rgb(0.88, 0.91, 0.94),
        borderWidth: 0.7,
    });

    // Draw task header (this advances ctx.y by HEADER_H + HEADER_GAP internally)
    drawTaskHeader(ctx, task, depth);

    // Inner white content card
    const contentCardTopY = ctx.y - CARD_PAD_V;
    const contentCardH = Math.max(contentH + CARD_PAD_V * 2, 20);
    ctx.page.drawRectangle({
        x: cardX + CARD_PAD,
        y: contentCardTopY - contentCardH,
        width: cardW - CARD_PAD * 2,
        height: contentCardH,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.82, 0.86, 0.90),
        borderWidth: 0.5,
    });

    // Adjust x/width for inner card padding when sub-tasks read depth-based indent
    // (they call PAGE_MARGIN_LEFT + clampIndent(depth) so at depth=0 they start at
    //  cardX; we nudge ctx.y to be inside the white card)
    ctx.y = contentCardTopY - CARD_PAD_V;
    const previousContentInset = ctx.contentInset;
    ctx.contentInset = previousContentInset + CARD_PAD + CONTENT_TEXT_PAD;

    const nextAncestry = new Set(ancestry);
    nextAncestry.add(task.id);

    switch (task.type) {
        case 'multiple-choice':
            renderMultipleChoiceTask(ctx, task, depth);
            break;
        case 'cloze':
            renderClozeTask(ctx, task, depth);
            break;
        case 'lineatur':
            renderLineaturTask(ctx, task, depth);
            break;
        case 'table':
            renderTableTask(ctx, task, depth);
            break;
        case 'information':
            renderInformationTask(ctx, task, depth);
            break;
        case 'columns':
            renderColumnsTask(ctx, task, tasksById, depth, nextAncestry);
            break;
        case 'heading': {
            const text = htmlToPlainText(task.text) || 'Zwischenüberschrift';
            drawWrappedText(ctx, text, {
                x: contentX(ctx, depth),
                width: contentWidth(ctx, depth),
                font: ctx.boldFont,
                size: 15,
                color: ctx.taskHeadingColor,
                lineHeight: 18,
            });
            break;
        }
        default:
            renderGenericTextTask(ctx, task, depth);
            break;
    }

    if (ctx.variant === 'teacher') {
        if (task.type === 'cloze') {
            drawTeacherHint(ctx, 'Lehrerhinweis: Lösungen sind inline eingeblendet.', depth);
        }
    }

    if (typeof task.linesAfter === 'number' && task.linesAfter > 0) {
        const lX = contentX(ctx, depth);
        const lW = contentWidth(ctx, depth);
        const rows = Math.max(1, Math.min(20, Math.round(task.linesAfter)));
        for (let index = 0; index < rows; index += 1) {
            ensurePageSpace(ctx, DEFAULT_FIELD_HEIGHT + 3);
            const lineY = ctx.y - DEFAULT_FIELD_HEIGHT + 4;
            ctx.page.drawLine({
                start: { x: lX, y: lineY },
                end: { x: lX + lW, y: lineY },
                thickness: 0.8,
                color: BORDER_COLOR,
            });
            ctx.y -= DEFAULT_FIELD_HEIGHT;
            moveCursor(ctx, 3);
        }
    }

    ctx.contentInset = previousContentInset;

    // Snap y to the card bottom so the next card starts cleanly below
    const cardBottomY = outerTopY - outerH;
    if (ctx.y > cardBottomY) ctx.y = cardBottomY;

    moveCursor(ctx, 10);
}

function drawDocumentHeader(ctx: RenderContext, title: string, designSnapshot: PdfDesignSnapshot): void {
    const safeTitle = title.trim() || 'Arbeitsblatt';
    const accentHex = getAccentHex(designSnapshot);
    const accentColor = hexToPdfRgb(accentHex);

    const headerTopY = ctx.y;
    const logoSize = 30;
    const logoX = PAGE_MARGIN_LEFT;
    const logoY = headerTopY - logoSize;

    const logoText = (designSnapshot.logoText || '').trim().slice(0, 3)
        || (designSnapshot.schoolName || '').trim().charAt(0).toUpperCase()
        || safeTitle.charAt(0).toUpperCase()
        || 'A';

    ctx.page.drawRectangle({
        x: logoX,
        y: logoY,
        width: logoSize,
        height: logoSize,
        color: accentColor,
    });

    const logoFontSize = logoText.length <= 1 ? 14 : 10.5;
    const logoTextWidth = ctx.boldFont.widthOfTextAtSize(logoText, logoFontSize);
    ctx.page.drawText(logoText, {
        x: logoX + (logoSize - logoTextWidth) / 2,
        y: logoY + (logoSize - logoFontSize) / 2 + 3,
        size: logoFontSize,
        font: ctx.boldFont,
        color: rgb(1, 1, 1),
    });

    const titleX = logoX + logoSize + 9;
    const titleWidth = Math.max(120, A4_WIDTH_PT - PAGE_MARGIN_RIGHT - titleX);

    ctx.y = headerTopY - 7;
    if (designSnapshot.showHeaderTitle) {
        const headerTitle = (designSnapshot.schoolName || '').trim() || 'Kopfzeile AB';
        drawWrappedText(ctx, headerTitle, {
            x: titleX,
            width: titleWidth,
            font: ctx.boldFont,
            size: 10.5,
            color: accentColor,
            lineHeight: 12,
        });
    }
    if (designSnapshot.showWorksheetTitle) {
        drawWrappedText(ctx, safeTitle, {
            x: titleX,
            width: titleWidth,
            font: ctx.font,
            size: TITLE_SIZE,
            color: MUTED_TEXT_COLOR,
            lineHeight: TITLE_SIZE * 1.25,
        });
    }

    const textBottomY = ctx.y;
    const headerBottomY = Math.min(logoY, textBottomY);
    ctx.y = headerBottomY;

    moveCursor(ctx, 7);
    ensurePageSpace(ctx, 1);
    ctx.page.drawLine({
        start: { x: PAGE_MARGIN_LEFT, y: ctx.y },
        end: { x: A4_WIDTH_PT - PAGE_MARGIN_RIGHT, y: ctx.y },
        thickness: 1,
        color: accentColor,
    });
    moveCursor(ctx, 10);

    if (ctx.variant === 'student') {
        const activeFields: Array<{ label: string; width: number }> = [];
        if (designSnapshot.headerFields.showName) activeFields.push({ label: 'Name:', width: 195 });
        if (designSnapshot.headerFields.showDate) activeFields.push({ label: 'Datum:', width: 120 });
        if (designSnapshot.headerFields.showClass) activeFields.push({ label: 'Klasse:', width: 110 });

        if (activeFields.length > 0) {
            ensurePageSpace(ctx, 18);

            const gap = 12;
            const totalWidth = activeFields.reduce((sum, field) => sum + field.width, 0) + gap * (activeFields.length - 1);
            let fieldX = A4_WIDTH_PT - PAGE_MARGIN_RIGHT - totalWidth;
            const baselineY = ctx.y - 8;

            for (const field of activeFields) {
                ctx.page.drawText(field.label, {
                    x: fieldX,
                    y: baselineY,
                    size: SMALL_SIZE,
                    font: ctx.boldFont,
                    color: MUTED_TEXT_COLOR,
                });

                const labelWidth = ctx.boldFont.widthOfTextAtSize(field.label, SMALL_SIZE);
                const lineStartX = Math.min(fieldX + field.width - 10, fieldX + labelWidth + 4);
                const lineY = baselineY + 1;

                ctx.page.drawLine({
                    start: { x: lineStartX, y: lineY },
                    end: { x: fieldX + field.width, y: lineY },
                    thickness: 0.9,
                    color: BORDER_COLOR,
                });

                fieldX += field.width + gap;
            }

            moveCursor(ctx, 20);
        }
    }
}

export function buildPdfFilename(title: string, variant: ExportVariant): string {
    const suffix = variant === 'teacher' ? '_Lehrer' : '_Schueler';
    return `${sanitizeFilename(title)}${suffix}.pdf`;
}

export async function generateInteractivePdf(
    tasksById: Record<string, Task>,
    taskIds: string[],
    variant: ExportVariant,
    title: string,
    designSnapshot: PdfDesignSnapshot,
    primaryFont?: string,
    customFontBase64?: string,
    customBoldFontBase64?: string,
): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // ── Regular Font – 3-stufige Fallback-Kette ──────────────────────────
    let defaultFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    if (customFontBase64) {
        try {
            const fontBytes = Uint8Array.from(atob(customFontBase64), c => c.charCodeAt(0));
            defaultFont = await pdfDoc.embedFont(fontBytes);
            boldFont = defaultFont; // temp: Regular als Bold-Fallback
        } catch {
            console.warn('[pdf] Custom regular font embedding failed, falling back to Helvetica');
            defaultFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
            boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        }
    } else if (primaryFont) {
        const cdnBytes = await fetchFontFromCDN(primaryFont, false);
        if (cdnBytes) {
            try {
                defaultFont = await pdfDoc.embedFont(cdnBytes);
                boldFont = defaultFont; // temp: Regular als Bold-Fallback
            } catch {
                console.warn('[pdf] CDN regular font embedding failed, falling back to Helvetica');
                defaultFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
                boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            }
        }
    }

    // ── Bold Font – 3-stufige Fallback-Kette ─────────────────────────────
    if (customBoldFontBase64) {
        try {
            const boldBytes = Uint8Array.from(atob(customBoldFontBase64), c => c.charCodeAt(0));
            boldFont = await pdfDoc.embedFont(boldBytes);
        } catch {
            console.warn('[pdf] Custom bold font embedding failed, using regular as bold');
            // boldFont bleibt bei defaultFont (oben gesetzt)
        }
    } else if (primaryFont) {
        const cdnBoldBytes = await fetchFontFromCDN(primaryFont, true);
        if (cdnBoldBytes) {
            try {
                boldFont = await pdfDoc.embedFont(cdnBoldBytes);
            } catch {
                console.warn('[pdf] CDN bold font embedding failed, using regular as bold');
                // boldFont bleibt bei bisherigem Wert
            }
        }
    }

    const form = pdfDoc.getForm();

    const page = pdfDoc.addPage(PageSizes.A4);
    const resolvedAccentHex = getAccentHex(designSnapshot);
    const accentColor = hexToPdfRgb(resolvedAccentHex);
    const taskHeadingColor = shouldApplyPrimaryColorToTasks(designSnapshot)
        ? accentColor
        : TEXT_COLOR;

    const ctx: RenderContext = {
        pdfDoc,
        form,
        font: defaultFont,
        boldFont,
        taskHeadingColor,
        accentColor,
        accentHex: resolvedAccentHex,
        page,
        y: A4_HEIGHT_PT - PAGE_MARGIN_TOP,
        taskCounter: 0,
        variant,
        contentInset: 0,
    };

    drawDocumentHeader(ctx, title, designSnapshot);

    for (const taskId of taskIds) {
        const task = tasksById[taskId];
        if (!task) continue;
        renderTask(ctx, task, tasksById, 0, new Set<string>());
    }

    form.updateFieldAppearances(defaultFont);
    return pdfDoc.save();
}
