import { AlignmentType, Paragraph, TextRun } from 'docx';
import { toDocxFontFamily } from './fontFamily';

type DocxAlignment = (typeof AlignmentType)[keyof typeof AlignmentType];

/* ══════════════════════════════════════════════════
   htmlToDocxParagraphs – Konvertiert HTML-Content aus dem
   Tiptap-Editor in docx.js-Paragraphen.

   Unterstützte Tags:
   - <p>, <br>
   - <strong>, <b>       → bold
   - <em>, <i>           → italics
   - <u>                 → underline
   - <ul>/<ol> + <li>    → Aufzählung / Nummerierung
   - Plaintext-Fallback  → wird als einzelner Paragraph behandelt
   ══════════════════════════════════════════════════ */

interface DocxTextStyle {
    fontFamily: string;
    fontSizePt: number;
    color: string;
    bold?: boolean;
    italics?: boolean;
    underline?: boolean;
}

interface InlineStyle {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    /** Hex-Farbe ohne '#', z. B. 'FF0000'. Überschreibt den Style-Default. */
    color?: string;
    /** Font-Name aus inline-style (z. B. 'Roboto'). Überschreibt den Style-Default. */
    fontFamily?: string;
    /** Schriftgröße in Half-Points aus inline-style. Überschreibt den Style-Default. */
    fontSizeHalfPt?: number;
}

interface HtmlToDocxParagraphOptions {
    defaultAlignment?: DocxAlignment;
}

/**
 * Konvertiert HTML-String aus Tiptap in docx.js Paragraph-Array.
 * Verwendet einen einfachen Regex-basierten Parser (kein DOM nötig).
 */
export function htmlToDocxParagraphs(
    html: string,
    style: DocxTextStyle,
    spacingAfter = 80,
    options: HtmlToDocxParagraphOptions = {},
): Paragraph[] {
    if (!html || !html.trim()) return [];

    // Wenn kein HTML → Plain-Text-Fallback
    if (!/<[a-z][\s\S]*>/i.test(html)) {
        return plainTextToParagraphs(html, style, spacingAfter, options.defaultAlignment);
    }

    const paragraphs: Paragraph[] = [];

    // Listen extrahieren und separat behandeln
    const blocks = splitIntoBlocks(html);

    for (const block of blocks) {
        if (block.type === 'list') {
            const items = extractListItems(block.html);
            const isOrdered = block.html.trimStart().startsWith('<ol');
            items.forEach((itemHtml, idx) => {
                const runs = parseInlineRuns(itemHtml, style);
                const prefix = isOrdered ? `${idx + 1}. ` : '• ';
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: prefix,
                                font: style.fontFamily,
                                size: style.fontSizePt * 2,
                                color: style.color,
                            }),
                            ...runs,
                        ],
                        spacing: { after: 40 },
                        indent: { left: 360 }, // ~0.25 inch indent
                        alignment: options.defaultAlignment,
                    }),
                );
            });
        } else {
            // Normaler Absatz (<p>...</p> oder loser Text)
            const innerHtml = stripTag(block.html, 'p');
            const runs = parseInlineRuns(innerHtml, style);
            if (runs.length > 0) {
                paragraphs.push(
                    new Paragraph({
                        children: runs,
                        spacing: { after: spacingAfter },
                        alignment: block.align ?? options.defaultAlignment,
                    }),
                );
            }
        }
    }

    return paragraphs.length > 0
        ? paragraphs
        : plainTextToParagraphs(stripAllTags(html), style, spacingAfter, options.defaultAlignment);
}

/* ── CSS-Style-Parser ── */

/**
 * Parst einen CSS-inline-style-String (z. B. "color: #ff0000; font-weight: bold")
 * und gibt ein Record<property, value> zurück – alles lower-cased, getrimmt.
 */
function extractStyleProps(tag: string): Record<string, string> {
    const styleMatch = /style="([^"]*)"/i.exec(tag);
    if (!styleMatch) return {};
    const result: Record<string, string> = {};
    styleMatch[1].split(';').forEach((decl) => {
        const colon = decl.indexOf(':');
        if (colon === -1) return;
        const prop = decl.slice(0, colon).trim().toLowerCase();
        const val = decl.slice(colon + 1).trim();
        if (prop && val) result[prop] = val;
    });
    return result;
}

/**
 * Konvertiert einen CSS-Farbwert (#abc, #aabbcc, rgb(r,g,b)) in ein
 * 6-stelliges HEX-String ohne '#' für docx.js.
 * Gibt undefined zurück, wenn kein gültiger Wert erkannt wird.
 */
function cssColorToDocxHex(color: string): string | undefined {
    const c = color.trim();
    const hex6 = /^#([0-9A-Fa-f]{6})$/.exec(c);
    if (hex6) return hex6[1].toUpperCase();
    const hex3 = /^#([0-9A-Fa-f]{3})$/.exec(c);
    if (hex3) {
        const [r, g, b] = hex3[1].split('');
        return `${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(c);
    if (rgb) {
        return [rgb[1], rgb[2], rgb[3]]
            .map((n) => parseInt(n, 10).toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
    }
    return undefined;
}

/**
 * Mapt einen CSS text-align-Wert auf AlignmentType.
 */
function cssAlignToDocx(align: string): DocxAlignment | undefined {
    switch (align.trim().toLowerCase()) {
        case 'center': return AlignmentType.CENTER;
        case 'right': return AlignmentType.RIGHT;
        case 'justify': return AlignmentType.JUSTIFIED;
        case 'left': return AlignmentType.LEFT;
        default: return undefined;
    }
}

function parseCssFontSizeToHalfPoints(value: string): number | undefined {
    const sizeMatch = /(\d+(?:\.\d+)?)\s*(px|pt|em|rem)/i.exec(value);
    if (!sizeMatch) return undefined;

    const numeric = parseFloat(sizeMatch[1]);
    const unit = sizeMatch[2].toLowerCase();

    if (unit === 'pt') return Math.max(2, Math.round(numeric * 2));
    if (unit === 'px') return Math.max(2, Math.round(numeric * 1.5));
    if (unit === 'em' || unit === 'rem') return Math.max(2, Math.round(numeric * 24));

    return undefined;
}

/* ── Block-Splitter ── */

interface Block {
    type: 'paragraph' | 'list';
    html: string;
    /** text-align aus dem <p>-Tag, falls vorhanden */
    align?: DocxAlignment;
}

function splitIntoBlocks(html: string): Block[] {
    const blocks: Block[] = [];
    // Regex: Finde <ul>...</ul> und <ol>...</ol> als List-Blöcke, alles andere als Paragraphen
    const listPattern = /<(ul|ol)[\s>][\s\S]*?<\/\1>/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = listPattern.exec(html)) !== null) {
        // Text vor der Liste
        if (match.index > lastIndex) {
            const before = html.slice(lastIndex, match.index).trim();
            if (before) {
                pushParagraphBlocks(blocks, before);
            }
        }
        blocks.push({ type: 'list', html: match[0] });
        lastIndex = match.index + match[0].length;
    }

    // Rest nach der letzten Liste
    if (lastIndex < html.length) {
        const rest = html.slice(lastIndex).trim();
        if (rest) {
            pushParagraphBlocks(blocks, rest);
        }
    }

    return blocks;
}

function pushParagraphBlocks(blocks: Block[], html: string): void {
    // Teile an <p>...<p> Grenzen
    const pPattern = /<p[\s>][\s\S]*?<\/p>/gi;
    let lastIdx = 0;
    let m: RegExpExecArray | null;

    while ((m = pPattern.exec(html)) !== null) {
        if (m.index > lastIdx) {
            const loose = html.slice(lastIdx, m.index).trim();
            if (loose) blocks.push({ type: 'paragraph', html: loose });
        }
        // Alignment aus dem öffnenden <p>-Tag extrahieren
        const align = (() => {
            const openTag = /^<p(\s[^>]*)?>/.exec(m[0]);
            if (!openTag) return undefined;
            const props = extractStyleProps(openTag[0]);
            return props['text-align'] ? cssAlignToDocx(props['text-align']) : undefined;
        })();
        blocks.push({ type: 'paragraph', html: m[0], align });
        lastIdx = m.index + m[0].length;
    }

    if (lastIdx < html.length) {
        const rest = html.slice(lastIdx).trim();
        if (rest) blocks.push({ type: 'paragraph', html: rest });
    }

    if (lastIdx === 0 && html.trim()) {
        blocks.push({ type: 'paragraph', html });
    }
}

/* ── List-Item-Extraktor ── */

function extractListItems(listHtml: string): string[] {
    const items: string[] = [];
    const liPattern = /<li[\s>][\s\S]*?<\/li>/gi;
    let m: RegExpExecArray | null;
    while ((m = liPattern.exec(listHtml)) !== null) {
        items.push(stripTag(m[0], 'li'));
    }
    return items;
}

/* ── Inline-Run-Parser ── */

function parseInlineRuns(html: string, style: DocxTextStyle): TextRun[] {
    const runs: TextRun[] = [];
    const fragments = tokenizeInline(html);

    for (const frag of fragments) {
        const text = stripAllTags(frag.text).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        if (!text) continue;

        // Per-Fragment-Farbe (aus span style) hat Vorrang vor der globalen Style-Farbe
        const resolvedColor = frag.style.color ?? style.color;
        const resolvedFont = toDocxFontFamily(frag.style.fontFamily ?? style.fontFamily);
        const resolvedSizeHalfPt = frag.style.fontSizeHalfPt ?? style.fontSizePt * 2;

        runs.push(
            new TextRun({
                text,
                font: resolvedFont,
                size: resolvedSizeHalfPt,
                color: resolvedColor,
                bold: style.bold || frag.style.bold || undefined,
                italics: style.italics || frag.style.italic || undefined,
                underline: (style.underline || frag.style.underline) ? {} : undefined,
            }),
        );
    }

    return runs;
}

interface InlineFragment {
    text: string;
    style: InlineStyle;
}

function tokenizeInline(html: string): InlineFragment[] {
    const fragments: InlineFragment[] = [];

    // Einfacher Stack-basierter Parser für verschachtelte Inline-Tags
    const tagPattern = /<\/?(?:strong|b|em|i|u|br|p|span)[\s>/][^>]*>|<\/?(?:strong|b|em|i|u|br|p|span)>/gi;
    const styleStack: InlineStyle[] = [{ bold: false, italic: false, underline: false }];

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tagPattern.exec(html)) !== null) {
        // Text vor dem Tag
        if (match.index > lastIndex) {
            const text = html.slice(lastIndex, match.index);
            if (text.trim() || text.includes(' ')) {
                fragments.push({
                    text,
                    style: { ...styleStack[styleStack.length - 1] },
                });
            }
        }

        const tag = match[0].toLowerCase();
        const isClosing = tag.startsWith('</');

        if (isClosing) {
            // Pop style
            if (styleStack.length > 1) {
                styleStack.pop();
            }
        } else if (tag.startsWith('<br')) {
            fragments.push({ text: '\n', style: { ...styleStack[styleStack.length - 1] } });
        } else {
            // Push new style based on tag
            const current = styleStack[styleStack.length - 1];
            const newStyle: InlineStyle = { ...current };

            if (tag.startsWith('<strong') || tag.startsWith('<b>') || tag.startsWith('<b ')) {
                newStyle.bold = true;
            }
            if (tag.startsWith('<em') || tag.startsWith('<i>') || tag.startsWith('<i ')) {
                newStyle.italic = true;
            }
            if (tag.startsWith('<u')) {
                newStyle.underline = true;
            }

            // Slice 1: CSS-inline-style-Attribute auf span-Tags auswerten
            if (tag.startsWith('<span')) {
                const props = extractStyleProps(match[0]);
                if (props['color']) {
                    const hex = cssColorToDocxHex(props['color']);
                    if (hex) newStyle.color = hex;
                }
                if (props['font-weight'] === 'bold' || props['font-weight'] === '700') {
                    newStyle.bold = true;
                }
                if (props['font-style'] === 'italic') {
                    newStyle.italic = true;
                }
                if (props['text-decoration']?.includes('underline')) {
                    newStyle.underline = true;
                }
                // Font-Family aus inline-style (z. B. Tiptap FontFamily-Extension)
                if (props['font-family']) {
                    const inlineFontFamily = props['font-family']
                        .split(',')[0]
                        .replace(/["']/g, '')
                        .trim();
                    newStyle.fontFamily = toDocxFontFamily(inlineFontFamily);
                }
                // Font-Size aus inline-style
                if (props['font-size']) {
                    const halfPoints = parseCssFontSizeToHalfPoints(props['font-size']);
                    if (halfPoints) newStyle.fontSizeHalfPt = halfPoints;
                }
            }

            styleStack.push(newStyle);
        }

        lastIndex = match.index + match[0].length;
    }

    // Rest nach dem letzten Tag
    if (lastIndex < html.length) {
        const text = html.slice(lastIndex);
        if (text.trim() || text.includes(' ')) {
            fragments.push({
                text,
                style: { ...styleStack[styleStack.length - 1] },
            });
        }
    }

    return fragments;
}

/* ── Hilfsfunktionen ── */

function stripTag(html: string, tagName: string): string {
    const openPattern = new RegExp(`^\\s*<${tagName}[\\s>][^>]*>`, 'i');
    const closePattern = new RegExp(`</${tagName}>\\s*$`, 'i');
    return html.replace(openPattern, '').replace(closePattern, '');
}

function stripAllTags(html: string): string {
    return html.replace(/<[^>]*>/g, '');
}

function plainTextToParagraphs(
    text: string,
    style: DocxTextStyle,
    spacingAfter: number,
    alignment?: DocxAlignment,
): Paragraph[] {
    return text.split('\n').map(
        (line) =>
            new Paragraph({
                children: [
                    new TextRun({
                        text: line || ' ',
                        font: style.fontFamily,
                        size: style.fontSizePt * 2,
                        color: style.color,
                        bold: style.bold,
                        italics: style.italics,
                    }),
                ],
                spacing: { after: spacingAfter },
                alignment,
            }),
    );
}
