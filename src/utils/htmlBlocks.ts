/* ══════════════════════════════════════════════════
   htmlBlocks – Zerlegt Rich-Text-HTML in Block-Elemente.

   Grundlage für den echten Textfluss über Seiten: Ein langer
   Informationstext wird an seinen Block-Grenzen (Absatz, Liste,
   Überschrift …) in einzelne HTML-Blöcke zerlegt. Diese Blöcke sind die
   kleinsten Fluss-Einheiten, die der MultiPageContainer über Seiten
   verteilen kann.

   Bewusst KEINE Teilung innerhalb eines Absatzes (kein Schnitt mitten im
   Satz) – das bleibt die robuste, fehlerarme Granularität.
   ══════════════════════════════════════════════════ */

/** Liefert true, wenn der HTML-Schnipsel sichtbaren Text/Inhalt enthält. */
function isNonEmptyHtml(html: string): boolean {
    const text = html
        .replace(/<br\s*\/?>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();
    // Auch „leere" Blöcke mit Bild zählen als Inhalt.
    return text.length > 0 || /<img[\s>]/i.test(html);
}

/**
 * Zerlegt HTML in seine obersten Block-Elemente (als HTML-Strings).
 * - Mehrere Top-Level-Elemente → je ein Block.
 * - Kein Block-Markup (reiner Text/Inline) → ein einzelner Block.
 * - Leerer Input → [].
 */
export function splitHtmlIntoBlocks(html: string): string[] {
    if (!html || !html.trim()) return [];

    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const topLevel = Array.from(doc.body.children);

        if (topLevel.length === 0) {
            const inner = doc.body.innerHTML.trim();
            return isNonEmptyHtml(inner) ? [inner] : [];
        }

        const blocks = topLevel
            .map((el) => el.outerHTML.trim())
            .filter((h) => h.length > 0 && isNonEmptyHtml(h));

        // Falls alle Top-Level-Elemente „leer" waren, dennoch den Originaltext behalten.
        return blocks.length > 0 ? blocks : (isNonEmptyHtml(html) ? [html] : []);
    } catch {
        return isNonEmptyHtml(html) ? [html] : [];
    }
}
