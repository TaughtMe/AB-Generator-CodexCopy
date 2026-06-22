import { useLayoutEffect, useRef } from 'react';

/* ══════════════════════════════════════════════════
   useAutoResizeTextarea – wachsende Chat-Eingabe (GPT-Stil)

   Passt die Höhe eines <textarea> an seinen Inhalt an: wächst
   zeilenweise mit, bis maxHeight erreicht ist, danach erscheint
   eine Scrollbar. Schrumpft beim Löschen wieder zurück.

   Verwendung:
     const ref = useAutoResizeTextarea(value, { maxHeight: 200 });
     <textarea ref={ref} value={value} ... />
   ══════════════════════════════════════════════════ */

interface AutoResizeOptions {
    /** Maximale Höhe in px, ab der gescrollt wird (Default 200). */
    maxHeight?: number;
}

export function useAutoResizeTextarea(value: string, options: AutoResizeOptions = {}) {
    const { maxHeight = 200 } = options;
    const ref = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        // Erst zurücksetzen, damit scrollHeight die echte Inhaltshöhe liefert.
        el.style.height = 'auto';
        const next = Math.min(el.scrollHeight, maxHeight);
        el.style.height = `${next}px`;
        el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [value, maxHeight]);

    return ref;
}
