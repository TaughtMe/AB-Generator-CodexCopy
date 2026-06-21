import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/react';

const LINE_HEIGHT_TYPES = ['paragraph', 'heading', 'tableCell', 'tableHeader'];

/** Aktueller Zeilenabstand des Cursor-Blocks ('' = Standard). */
export function getCurrentLineHeight(editor: Editor | null): string {
    if (!editor) return '';
    for (const type of LINE_HEIGHT_TYPES) {
        const value = (editor.getAttributes(type) as { lineHeight?: string | null }).lineHeight;
        if (value) return value;
    }
    return '';
}

/* ══════════════════════════════════════════════════
   LineHeight – Zeilenabstand als globales Attribut auf
   Absätzen/Überschriften/Tabellenzellen. Wird als inline
   style `line-height` gerendert (überträgt sich damit in
   den HTML-/PDF-Export).
   ══════════════════════════════════════════════════ */

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        lineHeight: {
            setLineHeight: (lineHeight: string) => ReturnType;
            unsetLineHeight: () => ReturnType;
        };
    }
}

interface LineHeightOptions {
    types: string[];
}

export const LineHeight = Extension.create<LineHeightOptions>({
    name: 'lineHeight',

    addOptions() {
        return { types: [] };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    lineHeight: {
                        default: null,
                        parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
                        renderHTML: (attributes: { lineHeight?: string | null }) => {
                            if (!attributes.lineHeight) return {};
                            return { style: `line-height: ${attributes.lineHeight};` };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setLineHeight:
                (lineHeight: string) =>
                    ({ commands }) =>
                        this.options.types
                            .map((type) => commands.updateAttributes(type, { lineHeight }))
                            .some(Boolean),
            unsetLineHeight:
                () =>
                    ({ commands }) =>
                        this.options.types
                            .map((type) => commands.resetAttributes(type, 'lineHeight'))
                            .some(Boolean),
        };
    },
});
