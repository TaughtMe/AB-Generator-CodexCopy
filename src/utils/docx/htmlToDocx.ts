import { AlignmentType, ExternalHyperlink, HighlightColor, Paragraph, TextRun, type ParagraphChild } from 'docx';
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
   - <s>, <strike>, <del> → strike-through
   - <mark>              → highlight
   - <a href="...">      → external hyperlink
   - <sub>/<sup>         → subscript/superscript
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
    strike?: boolean;
    highlight?: (typeof HighlightColor)[keyof typeof HighlightColor];
    subScript?: boolean;
    superScript?: boolean;
}

interface InlineStyle {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    highlight?: (typeof HighlightColor)[keyof typeof HighlightColor];
    subScript: boolean;
    superScript: boolean;
    link?: string;
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
 *
 * Block-Ebene: DOMParser (korrekt bei verschachtelten Listen, erhält
 * Leerabsätze). Inline-Ebene: bewährter tokenizeInline-Parser mit
 * vollem Feature-Set (s/mark/a/sub/sup/h1-6/span-Styles).
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

    const body = new DOMParser().parseFromString(html, 'text/html').body;
    const paragraphs: Paragraph[] = [];

    /** Lose Inline-Knoten auf Body-Ebene (Text, <strong>, …) sammeln. */
    let looseHtml = '';
    const flushLoose = () => {
        const chunk = looseHtml.trim();
        looseHtml = '';
        if (!chunk) return;
        const runs = parseInlineRuns(chunk, style);
        if (runs.length > 0) {
            paragraphs.push(new Paragraph({
                children: runs,
                spacing: { after: spacingAfter },
                alignment: options.defaultAlignment,
            }));
        }
    };

    const emitParagraphElement = (el: Element) => {
        const styleAttr = el.getAttribute('style') ?? '';
        const alignMatch = /text-align\s*:\s*(left|center|right|justify)/i.exec(styleAttr);
        const alignment = (alignMatch ? cssAlignToDocx(alignMatch[1]) : undefined) ?? options.defaultAlignment;
        const runs = parseInlineRuns(el.innerHTML, style);
        // Leere <p></p> (Tiptap-Leerzeilen) bewusst als Leerabsatz erhalten.
        paragraphs.push(new Paragraph({
            children: runs,
            spacing: { after: spacingAfter },
            alignment,
        }));
    };

    /** Verschachtelte Listen rekursiv, Einrückung pro Ebene. */
    const emitList = (listEl: Element, level: number) => {
        const isOrdered = listEl.tagName.toLowerCase() === 'ol';
        let index = 0;
        for (const li of listEl.children) {
            if (li.tagName.toLowerCase() !== 'li') continue;
            index += 1;

            // Inline-Inhalt des <li> OHNE die verschachtelten Listen
            const liClone = li.cloneNode(true) as Element;
            liClone.querySelectorAll('ul, ol').forEach((nested) => nested.remove());
            const runs = parseInlineRuns(liClone.innerHTML, style);
            const prefix = isOrdered ? `${index}. ` : '• ';

            paragraphs.push(new Paragraph({
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
                indent: { left: 360 * (level + 1) },
                alignment: options.defaultAlignment,
            }));

            // Direkt verschachtelte Listen dieses <li> eine Ebene tiefer
            for (const child of li.children) {
                const tag = child.tagName.toLowerCase();
                if (tag === 'ul' || tag === 'ol') emitList(child, level + 1);
            }
        }
    };

    for (const node of body.childNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const tag = el.tagName.toLowerCase();

            if (tag === 'ul' || tag === 'ol') {
                flushLoose();
                emitList(el, 0);
                continue;
            }
            if (tag === 'p' || tag === 'div') {
                flushLoose();
                emitParagraphElement(el);
                continue;
            }
            if (/^h[1-6]$/.test(tag)) {
                // outerHTML, damit tokenizeInline das h-Tag (bold + Größe) auswertet
                flushLoose();
                const runs = parseInlineRuns(el.outerHTML, style);
                if (runs.length > 0) {
                    paragraphs.push(new Paragraph({
                        children: runs,
                        spacing: { after: spacingAfter },
                        alignment: options.defaultAlignment,
                    }));
                }
                continue;
            }
            if (tag === 'table') {
                // Tabellen im Fließtext: zu Plaintext abflachen — echte
                // Tabellen laufen über den table-Task-Renderer.
                flushLoose();
                const text = (el.textContent ?? '').trim();
                if (text) {
                    paragraphs.push(...plainTextToParagraphs(text, style, spacingAfter, options.defaultAlignment));
                }
                continue;
            }

            // Sonstige Inline-Elemente auf Body-Ebene → in den Lose-Puffer
            looseHtml += el.outerHTML;
            continue;
        }

        if (node.nodeType === Node.TEXT_NODE) {
            looseHtml += node.textContent ?? '';
        }
    }
    flushLoose();

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

/* ── Inline-Run-Parser ── */

function parseInlineRuns(html: string, style: DocxTextStyle): ParagraphChild[] {
    const runs: ParagraphChild[] = [];
    const fragments = tokenizeInline(html);

    for (const frag of fragments) {
        const text = decodeHtmlText(stripAllTags(frag.text));
        if (!text) continue;

        // Per-Fragment-Farbe (aus span style) hat Vorrang vor der globalen Style-Farbe
        const resolvedColor = frag.style.color ?? style.color;
        const resolvedFont = toDocxFontFamily(frag.style.fontFamily ?? style.fontFamily);
        const resolvedSizeHalfPt = frag.style.fontSizeHalfPt ?? style.fontSizePt * 2;

        const textRun = new TextRun({
            text,
            font: resolvedFont,
            size: resolvedSizeHalfPt,
            color: resolvedColor,
            bold: style.bold || frag.style.bold || undefined,
            italics: style.italics || frag.style.italic || undefined,
            underline: (style.underline || frag.style.underline || frag.style.link) ? {} : undefined,
            strike: style.strike || frag.style.strike || undefined,
            highlight: style.highlight ?? frag.style.highlight,
            subScript: style.subScript || frag.style.subScript || undefined,
            superScript: style.superScript || frag.style.superScript || undefined,
        });

        if (frag.style.link) {
            runs.push(
                new ExternalHyperlink({
                    children: [textRun],
                    link: frag.style.link,
                }),
            );
        } else {
            runs.push(textRun);
        }
    }

    return runs;
}

interface InlineFragment {
    text: string;
    style: InlineStyle;
}

function tokenizeInline(html: string): InlineFragment[] {
    const fragments: InlineFragment[] = [];

    // Einfacher Stack-basierter Parser für verschachtelte Inline-Tags.
    // WICHTIG: Attribut-Teil nur nach Whitespace — die frühere Form
    // `[\s>/][^>]*>` hat bei attributlosen Tags (<strong>, <s>, <mark>)
    // das '>' konsumiert und dann Inhalt + Folge-Tag mitverschluckt,
    // wodurch fett/durchgestrichen/markierter Text im DOCX verloren ging.
    // Längere Tag-Namen stehen vor ihren Präfixen (strike vor s, br vor b).
    const tagPattern = /<\/?(?:strong|strike|span|sub|sup|mark|del|br|h[1-6]|em|b|i|u|s|a|p)(?:\s[^>]*)?\/?>/gi;
    const styleStack: InlineStyle[] = [{
        bold: false,
        italic: false,
        underline: false,
        strike: false,
        subScript: false,
        superScript: false,
    }];

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
            if (tag.startsWith('<s') || tag.startsWith('<strike') || tag.startsWith('<del')) {
                newStyle.strike = true;
            }
            if (tag.startsWith('<mark')) {
                newStyle.highlight = HighlightColor.YELLOW;
                const props = extractStyleProps(match[0]);
                const highlightColor = props['background-color'] || props['background'];
                if (highlightColor) {
                    newStyle.highlight = cssColorToHighlightColor(highlightColor) ?? HighlightColor.YELLOW;
                }
            }
            if (tag.startsWith('<a')) {
                newStyle.underline = true;
                newStyle.color = '2563EB';
                newStyle.link = extractAttribute(match[0], 'href');
            }
            if (tag.startsWith('<sub')) {
                newStyle.subScript = true;
                newStyle.superScript = false;
            }
            if (tag.startsWith('<sup')) {
                newStyle.superScript = true;
                newStyle.subScript = false;
            }
            if (/^<h[1-6]/.test(tag)) {
                newStyle.bold = true;
                newStyle.fontSizeHalfPt = headingTagToHalfPoints(tag);
            }

            // Slice 1: CSS-inline-style-Attribute auf span-Tags auswerten
            if (tag.startsWith('<span') || tag.startsWith('<a') || tag.startsWith('<mark') || /^<h[1-6]/.test(tag)) {
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
                if (props['text-decoration']?.includes('line-through')) {
                    newStyle.strike = true;
                }
                if (props['vertical-align'] === 'sub') {
                    newStyle.subScript = true;
                    newStyle.superScript = false;
                }
                if (props['vertical-align'] === 'super') {
                    newStyle.superScript = true;
                    newStyle.subScript = false;
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

function stripAllTags(html: string): string {
    return html.replace(/<[^>]*>/g, '');
}

function decodeHtmlText(text: string): string {
    return text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function extractAttribute(tag: string, attribute: string): string | undefined {
    const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`${escaped}\\s*=\\s*(['"])(.*?)\\1`, 'i').exec(tag);
    return match?.[2];
}

function headingTagToHalfPoints(tag: string): number {
    const match = /^<h([1-6])/i.exec(tag);
    const level = match ? parseInt(match[1], 10) : 3;
    const ptByLevel: Record<number, number> = {
        1: 18,
        2: 16,
        3: 14,
        4: 12,
        5: 11,
        6: 10,
    };
    return (ptByLevel[level] ?? 12) * 2;
}

function cssColorToHighlightColor(color: string): (typeof HighlightColor)[keyof typeof HighlightColor] | undefined {
    const hex = cssColorToDocxHex(color);
    if (!hex) return undefined;

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    if (r > 220 && g > 180 && b < 120) return HighlightColor.YELLOW;
    if (g > 150 && r < 160 && b < 160) return HighlightColor.GREEN;
    if (b > 160 && r < 170) return HighlightColor.CYAN;
    if (r > 190 && g < 150 && b < 150) return HighlightColor.RED;
    if (r > 180 && b > 180 && g < 150) return HighlightColor.MAGENTA;
    if (r > 200 && g > 200 && b > 200) return HighlightColor.LIGHT_GRAY;
    return HighlightColor.YELLOW;
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
                        underline: style.underline ? {} : undefined,
                        strike: style.strike,
                        highlight: style.highlight,
                        subScript: style.subScript,
                        superScript: style.superScript,
                    }),
                ],
                spacing: { after: spacingAfter },
                alignment,
            }),
    );
}
