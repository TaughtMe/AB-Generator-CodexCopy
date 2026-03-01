import { Extension } from '@tiptap/core';

export const FONT_SIZE_OPTIONS = ['10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt'] as const;

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        fontSize: {
            setFontSize: (fontSize: string) => ReturnType;
            unsetFontSize: () => ReturnType;
        };
    }
}

interface FontSizeOptions {
    types: string[];
}

export const FontSize = Extension.create<FontSizeOptions>({
    name: 'fontSize',

    addOptions() {
        return {
            types: ['textStyle'],
        };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
                        renderHTML: (attributes: { fontSize?: string | null }) => {
                            if (!attributes.fontSize) return {};
                            return { style: `font-size: ${attributes.fontSize};` };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setFontSize:
                (fontSize: string) =>
                    ({ chain }) =>
                        chain()
                            .setMark('textStyle', { fontSize })
                            .run(),
            unsetFontSize:
                () =>
                    ({ chain }) =>
                        chain()
                            .setMark('textStyle', { fontSize: null })
                            .run(),
        };
    },
});
