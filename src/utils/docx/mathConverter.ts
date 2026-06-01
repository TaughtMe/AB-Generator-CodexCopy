/**
 * mathConverter.ts
 *
 * Converts LaTeX → MathML (via KaTeX) → docx.js OMML Math objects so that
 * formulas are fully editable in Microsoft Word.
 */

import {
    Math as DocxMath,
    MathFraction,
    MathNumerator,
    MathDenominator,
    MathRadical,
    MathRadicalProperties,
    MathDegree,
    MathSuperScript,
    MathSubScript,
    MathSubSuperScript,
    MathRun,
    Paragraph,
    TextRun,
    type MathComponent,
    type IParagraphOptions,
} from 'docx';

// ── Helpers ──────────────────────────────────────────────────────────────────

function textOf(el: Element): string {
    return (el.textContent ?? '').replace(/\s+/g, '').trim();
}

function run(text: string): MathRun {
    return new MathRun(text);
}

function convertChildren(el: Element): MathComponent[] {
    const out: MathComponent[] = [];
    for (const child of el.children) {
        out.push(...convertNode(child));
    }
    return out;
}

// ── Core converter ────────────────────────────────────────────────────────────

function convertNode(el: Element): MathComponent[] {
    const tag = el.localName?.toLowerCase() ?? '';

    switch (tag) {
        case 'math':
        case 'mrow':
        case 'mstyle':
        case 'mpadded':
        case 'mphantom':
        case 'merror':
            return convertChildren(el);

        case 'semantics':
            return el.children.length > 0 ? convertNode(el.children[0]) : [];

        case 'annotation':
        case 'annotation-xml':
            return [];

        case 'mi':
        case 'mn':
        case 'mo':
        case 'mtext': {
            const t = textOf(el);
            return t ? [run(t)] : [];
        }

        case 'mspace':
            return [run(' ')];

        case 'mfrac': {
            const num = el.children[0];
            const den = el.children[1];
            if (!num || !den) return [run(textOf(el))];
            return [
                new MathFraction({
                    numerator: convertNode(num),
                    denominator: convertNode(den),
                }),
            ];
        }

        case 'msqrt': {
            const inner = convertChildren(el);
            return [
                new MathRadical({
                    children: inner,
                    // no degree → hideDegree automatically
                }),
            ];
        }

        case 'mroot': {
            const radicand = el.children[0];
            const degree = el.children[1];
            if (!radicand) return [run(textOf(el))];
            const degChildren = degree ? convertNode(degree) : [];
            return [
                new MathRadical({
                    children: convertNode(radicand),
                    degree: degChildren,
                }),
            ];
        }

        case 'msup': {
            const base = el.children[0];
            const sup = el.children[1];
            if (!base || !sup) return [run(textOf(el))];
            return [
                new MathSuperScript({
                    children: convertNode(base),
                    superScript: convertNode(sup),
                }),
            ];
        }

        case 'msub': {
            const base = el.children[0];
            const sub = el.children[1];
            if (!base || !sub) return [run(textOf(el))];
            return [
                new MathSubScript({
                    children: convertNode(base),
                    subScript: convertNode(sub),
                }),
            ];
        }

        case 'msubsup': {
            const base = el.children[0];
            const sub = el.children[1];
            const sup = el.children[2];
            if (!base || !sub || !sup) return [run(textOf(el))];
            return [
                new MathSubSuperScript({
                    children: convertNode(base),
                    subScript: convertNode(sub),
                    superScript: convertNode(sup),
                }),
            ];
        }

        case 'mover':
        case 'munder':
        case 'munderover':
        case 'mtable':
        case 'mtr':
        case 'mtd':
        case 'mlabeledtr':
            return convertChildren(el);

        default: {
            const t = textOf(el);
            return t ? [run(t)] : [];
        }
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function latexToDocxMathParagraph(
    latex: string,
    paragraphOptions: Omit<IParagraphOptions, 'children'> = {},
): Paragraph | null {
    if (!latex?.trim()) return null;

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const katexModule = require('katex') as { default?: typeof import('katex'); renderToString?: (l:string,o:object)=>string };
        const katex = (katexModule.default ?? katexModule) as typeof import('katex');
        const mathmlHtml = katex.renderToString(latex.trim(), {
            throwOnError: false,
            output: 'mathml',
        });

        const parser = new DOMParser();
        const doc = parser.parseFromString(`<root>${mathmlHtml}</root>`, 'application/xml');
        const mathEl = doc.querySelector('math');
        if (!mathEl) return null;

        const children = convertChildren(mathEl);
        if (children.length === 0) return null;

        return new Paragraph({
            ...paragraphOptions,
            children: [new DocxMath({ children })],
        });
    } catch {
        return null;
    }
}

export function latexFallbackParagraph(
    latex: string,
    fontFamily: string,
    fontSizePt: number,
    paragraphOptions: Omit<IParagraphOptions, 'children'> = {},
): Paragraph {
    return new Paragraph({
        ...paragraphOptions,
        children: [
            new TextRun({
                text: latex.trim(),
                font: fontFamily,
                size: fontSizePt * 2,
                italics: true,
                color: '334155',
            }),
        ],
    });
}

// Re-export so taskRenderer.ts doesn't need to import docx directly for these.
export { MathRadicalProperties, MathNumerator, MathDenominator, MathDegree };
