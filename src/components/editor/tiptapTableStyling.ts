import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

type StyleAttrValue = string | null | undefined;

function getInlineStyleValue(element: HTMLElement, key: 'backgroundColor' | 'borderWidth'): string | null {
    const value = element.style[key];
    return value && value.trim().length > 0 ? value : null;
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
            borderWidth: {
                default: null,
                parseHTML: (element: HTMLElement) => getInlineStyleValue(element, 'borderWidth'),
                renderHTML: (attributes: { borderWidth?: StyleAttrValue }) =>
                    renderInlineStyle('border-width', attributes.borderWidth),
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
            borderWidth: {
                default: null,
                parseHTML: (element: HTMLElement) => getInlineStyleValue(element, 'borderWidth'),
                renderHTML: (attributes: { borderWidth?: StyleAttrValue }) =>
                    renderInlineStyle('border-width', attributes.borderWidth),
            },
        };
    },
});
