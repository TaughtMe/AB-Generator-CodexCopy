import { Extension } from '@tiptap/core';

type TextAlignValue = 'left' | 'center' | 'right' | 'justify';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        textAlign: {
            setTextAlign: (alignment: TextAlignValue) => ReturnType;
            unsetTextAlign: () => ReturnType;
        };
    }
}

interface TextAlignOptions {
    types: string[];
    alignments: TextAlignValue[];
}

function isSupportedAlignment(value: string, alignments: TextAlignValue[]): value is TextAlignValue {
    return alignments.includes(value as TextAlignValue);
}

export const TextAlign = Extension.create<TextAlignOptions>({
    name: 'textAlign',

    addOptions() {
        return {
            types: [],
            alignments: ['left', 'center', 'right', 'justify'],
        };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    textAlign: {
                        default: null,
                        parseHTML: (element: HTMLElement) => {
                            const textAlign = element.style.textAlign;
                            if (!textAlign) return null;
                            return isSupportedAlignment(textAlign, this.options.alignments) ? textAlign : null;
                        },
                        renderHTML: (attributes: { textAlign?: TextAlignValue | null }) => {
                            if (!attributes.textAlign) return {};
                            return { style: `text-align: ${attributes.textAlign};` };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setTextAlign:
                (alignment: TextAlignValue) =>
                    ({ commands }) => {
                        if (!this.options.alignments.includes(alignment)) return false;
                        return this.options.types
                            .map((type) => commands.updateAttributes(type, { textAlign: alignment }))
                            .some(Boolean);
                    },
            unsetTextAlign:
                () =>
                    ({ commands }) =>
                        this.options.types
                            .map((type) => commands.resetAttributes(type, 'textAlign'))
                            .some(Boolean),
        };
    },
});
