import type { Editor } from '@tiptap/react';
import { getCurrentLineHeight } from '../tiptapLineHeight';

/* ══════════════════════════════════════════════════
   LineSpacingControl – Zeilenabstand (Standard / 1,5).
   Wird sowohl im Allgemein- als auch im Tabellen-Reiter
   verwendet; arbeitet auf dem übergebenen Editor.
   ══════════════════════════════════════════════════ */

interface LineSpacingControlProps {
    editor: Editor | null;
    disabled?: boolean;
    /** Optionaler expliziter Wert (für memoisierte Toolbars, die nicht je Transaktion neu rendern). */
    value?: string;
}

export function LineSpacingControl({ editor, disabled, value: valueProp }: LineSpacingControlProps) {
    // Nicht jeder Editor lädt die LineHeight-Extension → defensiv prüfen,
    // sonst wirft `chain().setLineHeight` (kein Befehl) und das Modul stürzt ab.
    const supported = Boolean(editor && typeof editor.commands.setLineHeight === 'function');
    const value = valueProp ?? getCurrentLineHeight(editor);
    return (
        <select
            value={value}
            disabled={disabled || !supported}
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) => {
                if (!editor || !supported) return;
                const next = event.target.value;
                const chain = editor.chain().focus();
                if (!next) {
                    chain.unsetLineHeight().run();
                } else {
                    chain.setLineHeight(next).run();
                }
            }}
            title="Zeilenabstand"
            aria-label="Zeilenabstand"
            className="h-8 min-w-[120px] rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 text-xs text-slate-600 dark:text-slate-300 disabled:opacity-50"
        >
            {/* "1,5" entspricht Word's "1,5 Zeilen": der Blatt-Standard ist bereits
                ~1,43, daher mappt 1,5 auf line-height 1,8 für einen klar sichtbaren,
                gleichmäßigen Effekt in Editor, PDF und Word. */}
            <option value="">Zeilen: Standard</option>
            <option value="1.8">Zeilen: 1,5</option>
        </select>
    );
}
