import DOMPurify from 'dompurify';

/* ══════════════════════════════════════════════════
   markdown.ts – Sicheres, leichtgewichtiges Markdown→HTML für den KI-Chat.

   Bewusst keine schwere Dependency: ein fokussierter Parser für die im Chat
   üblichen Elemente (Absätze, Fett/Kursiv, Inline-Code, Codeblöcke, Listen,
   Überschriften, Links). Sicherheit dreifach:
   1. Roher Text wird zuerst HTML-escaped (keine Injektion),
   2. nur kontrollierte Markdown-Transforms erzeugen Tags,
   3. DOMPurify mit Tag-Whitelist als finale Absicherung.
   ══════════════════════════════════════════════════ */

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** Inline-Formatierung auf bereits HTML-escaptem Text. */
function applyInline(text: string): string {
    let t = text;
    // Inline-Code `...`
    t = t.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
    // Links [text](http-url)
    t = t.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        (_m, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`,
    );
    // Fett **...** / __...__
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // Kursiv *...* / _..._ (nicht in bereits gesetzten Marks)
    t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    t = t.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
    return t;
}

export function markdownToSafeHtml(markdown: string): string {
    const lines = (markdown ?? '').replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    let i = 0;

    const isFence = (l: string) => /^```/.test(l.trim());
    const isHeading = (l: string) => /^(#{1,3})\s+/.test(l);
    const isUl = (l: string) => /^\s*[-*]\s+/.test(l);
    const isOl = (l: string) => /^\s*\d+\.\s+/.test(l);

    while (i < lines.length) {
        const line = lines[i];

        if (isFence(line)) {
            const buf: string[] = [];
            i++;
            while (i < lines.length && !isFence(lines[i])) { buf.push(escapeHtml(lines[i])); i++; }
            i++; // schließende Fence überspringen
            out.push(`<pre><code>${buf.join('\n')}</code></pre>`);
            continue;
        }

        const heading = line.match(/^(#{1,3})\s+(.*)$/);
        if (heading) {
            const level = heading[1].length + 2; // # → h3, ## → h4, ### → h5
            out.push(`<h${level}>${applyInline(escapeHtml(heading[2]))}</h${level}>`);
            i++;
            continue;
        }

        if (isUl(line)) {
            const items: string[] = [];
            while (i < lines.length && isUl(lines[i])) {
                items.push(`<li>${applyInline(escapeHtml(lines[i].replace(/^\s*[-*]\s+/, '')))}</li>`);
                i++;
            }
            out.push(`<ul>${items.join('')}</ul>`);
            continue;
        }

        if (isOl(line)) {
            const items: string[] = [];
            while (i < lines.length && isOl(lines[i])) {
                items.push(`<li>${applyInline(escapeHtml(lines[i].replace(/^\s*\d+\.\s+/, '')))}</li>`);
                i++;
            }
            out.push(`<ol>${items.join('')}</ol>`);
            continue;
        }

        if (line.trim() === '') { i++; continue; }

        const para: string[] = [];
        while (
            i < lines.length
            && lines[i].trim() !== ''
            && !isFence(lines[i]) && !isHeading(lines[i]) && !isUl(lines[i]) && !isOl(lines[i])
        ) {
            para.push(applyInline(escapeHtml(lines[i])));
            i++;
        }
        out.push(`<p>${para.join('<br>')}</p>`);
    }

    return DOMPurify.sanitize(out.join(''), {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'h3', 'h4', 'h5', 'a'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
}
