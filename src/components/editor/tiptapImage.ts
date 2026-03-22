import { Node, mergeAttributes } from '@tiptap/core';

type ImageAlign = 'left' | 'center' | 'right';

interface TiptapImageAttributes {
    src?: string;
    alt?: string;
    title?: string;
    opacity?: number;
    align?: ImageAlign;
    style?: string;
}

function clampOpacity(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(1, Math.max(0, parsed));
}

function parseAlignFromStyle(style: string | null): ImageAlign {
    const normalized = (style ?? '').replace(/\s+/g, '').toLowerCase();
    if (normalized.includes('margin-left:auto') && normalized.includes('margin-right:auto')) return 'center';
    if (normalized.includes('margin-left:auto') && normalized.includes('margin-right:0')) return 'right';
    return 'left';
}

function toAlign(value: unknown): ImageAlign {
    return value === 'center' || value === 'right' ? value : 'left';
}

export const TiptapImage = Node.create({
    name: 'image',
    group: 'block',
    inline: false,
    atom: true,
    draggable: true,
    selectable: true,

    addAttributes() {
        return {
            src: { default: null },
            alt: { default: null },
            title: { default: null },
            opacity: {
                default: 1,
                parseHTML: (element: HTMLElement) => {
                    const dataOpacity = element.getAttribute('data-opacity');
                    const styleOpacity = element.style.opacity;
                    return clampOpacity(dataOpacity ?? styleOpacity ?? 1);
                },
                renderHTML: (attributes: TiptapImageAttributes) => ({
                    'data-opacity': String(clampOpacity(attributes.opacity)),
                }),
            },
            align: {
                default: 'left',
                parseHTML: (element: HTMLElement) => {
                    const dataAlign = element.getAttribute('data-align');
                    if (dataAlign === 'center' || dataAlign === 'right') return dataAlign;
                    return parseAlignFromStyle(element.getAttribute('style'));
                },
                renderHTML: (attributes: TiptapImageAttributes) => ({
                    'data-align': toAlign(attributes.align),
                }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'img[src]' }];
    },

    renderHTML({ HTMLAttributes }) {
        const {
            opacity,
            align,
            style,
            ...rest
        } = HTMLAttributes as TiptapImageAttributes;

        const normalizedOpacity = clampOpacity(opacity);
        const normalizedAlign = toAlign(align);
        const alignStyle = normalizedAlign === 'center'
            ? 'display:block;margin-left:auto;margin-right:auto;'
            : normalizedAlign === 'right'
                ? 'display:block;margin-left:auto;margin-right:0;'
                : 'display:block;margin-left:0;margin-right:auto;';

        const mergedStyle = `${style ?? ''}${style ? ';' : ''}max-width:100%;height:auto;opacity:${normalizedOpacity};${alignStyle}`;

        return [
            'img',
            mergeAttributes(rest, {
                style: mergedStyle,
                'data-opacity': String(normalizedOpacity),
                'data-align': normalizedAlign,
            }),
        ];
    },
});
