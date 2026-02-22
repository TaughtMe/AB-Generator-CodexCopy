import { Paragraph, TextRun } from 'docx';

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
}

/**
 * Konvertiert HTML-String aus Tiptap in docx.js Paragraph-Array.
 * Verwendet einen einfachen Regex-basierten Parser (kein DOM nötig).
 */
export function htmlToDocxParagraphs(
    html: string,
    style: DocxTextStyle,
    spacingAfter = 80,
): Paragraph[] {
    if (!html || !html.trim()) return [];

    // Wenn kein HTML → Plain-Text-Fallback
    if (!/<[a-z][\s\S]*>/i.test(html)) {
        return plainTextToParagraphs(html, style, spacingAfter);
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
                    }),
                );
            }
        }
    }

    return paragraphs.length > 0 ? paragraphs : plainTextToParagraphs(stripAllTags(html), style, spacingAfter);
}

/* ── Block-Splitter ── */

interface Block {
    type: 'paragraph' | 'list';
    html: string;
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
        blocks.push({ type: 'paragraph', html: m[0] });
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

        runs.push(
            new TextRun({
                text,
                font: style.fontFamily,
                size: style.fontSizePt * 2,
                color: style.color,
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
    const tagPattern = /<\/?(?:strong|b|em|i|u|br|p|span)[\s>\/][^>]*>|<\/?(?:strong|b|em|i|u|br|p|span)>/gi;
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

function plainTextToParagraphs(text: string, style: DocxTextStyle, spacingAfter: number): Paragraph[] {
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
            }),
    );
}
