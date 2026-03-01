import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

type StyleAttrValue = string | null | undefined;
type BorderSideStyleKey = 'borderTop' | 'borderRight' | 'borderBottom' | 'borderLeft';

function getInlineStyleValue(element: HTMLElement, key: 'backgroundColor' | BorderSideStyleKey): string | null {
    const value = element.style[key];
    return value && value.trim().length > 0 ? value : null;
}

function getLegacyBorderValue(element: HTMLElement): string | null {
    const width = element.style.borderWidth?.trim();
    if (!width) return null;

    const style = element.style.borderStyle?.trim() || 'solid';
    const color = element.style.borderColor?.trim() || '#cbd5e1';
    return `${width} ${style} ${color}`;
}

function getBorderSideValue(element: HTMLElement, side: BorderSideStyleKey): string | null {
    const sideValue = getInlineStyleValue(element, side);
    if (sideValue) return sideValue;
    return getLegacyBorderValue(element);
}

function renderInlineStyle(property: string, value: StyleAttrValue): Record<string, string> {
    if (!value) return {};
    return { style: `${property}: ${value};` };
}

export const StyledTableCell = TableCell.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            backgroundColor: {
                default: null,
                parseHTML: (element: HTMLElement) => getInlineStyleValue(element, 'backgroundColor'),
                renderHTML: (attributes: { backgroundColor?: StyleAttrValue }) =>
                    renderInlineStyle('background-color', attributes.backgroundColor),
            },
            borderTop: {
                default: null,
                parseHTML: (element: HTMLElement) => getBorderSideValue(element, 'borderTop'),
                renderHTML: (attributes: { borderTop?: StyleAttrValue }) =>
                    renderInlineStyle('border-top', attributes.borderTop),
            },
            borderRight: {
                default: null,
                parseHTML: (element: HTMLElement) => getBorderSideValue(element, 'borderRight'),
                renderHTML: (attributes: { borderRight?: StyleAttrValue }) =>
                    renderInlineStyle('border-right', attributes.borderRight),
            },
            borderBottom: {
                default: null,
                parseHTML: (element: HTMLElement) => getBorderSideValue(element, 'borderBottom'),
                renderHTML: (attributes: { borderBottom?: StyleAttrValue }) =>
                    renderInlineStyle('border-bottom', attributes.borderBottom),
            },
            borderLeft: {
                default: null,
                parseHTML: (element: HTMLElement) => getBorderSideValue(element, 'borderLeft'),
                renderHTML: (attributes: { borderLeft?: StyleAttrValue }) =>
                    renderInlineStyle('border-left', attributes.borderLeft),
            },
        };
    },
});

export const StyledTableHeader = TableHeader.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            backgroundColor: {
                default: null,
                parseHTML: (element: HTMLElement) => getInlineStyleValue(element, 'backgroundColor'),
                renderHTML: (attributes: { backgroundColor?: StyleAttrValue }) =>
                    renderInlineStyle('background-color', attributes.backgroundColor),
            },
            borderTop: {
                default: null,
                parseHTML: (element: HTMLElement) => getBorderSideValue(element, 'borderTop'),
                renderHTML: (attributes: { borderTop?: StyleAttrValue }) =>
                    renderInlineStyle('border-top', attributes.borderTop),
            },
            borderRight: {
                default: null,
                parseHTML: (element: HTMLElement) => getBorderSideValue(element, 'borderRight'),
                renderHTML: (attributes: { borderRight?: StyleAttrValue }) =>
                    renderInlineStyle('border-right', attributes.borderRight),
            },
            borderBottom: {
                default: null,
                parseHTML: (element: HTMLElement) => getBorderSideValue(element, 'borderBottom'),
                renderHTML: (attributes: { borderBottom?: StyleAttrValue }) =>
                    renderInlineStyle('border-bottom', attributes.borderBottom),
            },
            borderLeft: {
                default: null,
                parseHTML: (element: HTMLElement) => getBorderSideValue(element, 'borderLeft'),
                renderHTML: (attributes: { borderLeft?: StyleAttrValue }) =>
                    renderInlineStyle('border-left', attributes.borderLeft),
            },
        };
    },
});
