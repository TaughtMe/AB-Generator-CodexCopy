const DOCX_DEFAULT_FONT = 'Arial';

const GENERIC_OR_UNSAFE_DOCX_FONTS = new Set([
    'inter',
    'inter var',
    'system-ui',
    '-apple-system',
    'blinkmacsystemfont',
    'ui-sans-serif',
    'sans-serif',
    'inherit',
    'initial',
    'unset',
]);

function extractPrimaryFontFamily(rawFont: string | undefined | null): string {
    if (!rawFont) return '';
    return rawFont.split(',')[0].replace(/["']/g, '').trim();
}

/**
 * Word kann Webfonts wie "Inter" häufig nicht zuverlässig auflösen.
 * Für den DOCX-Export mappen wir solche Fonts auf eine sichere Sans-Serif.
 */
export function toDocxFontFamily(rawFont: string | undefined | null): string {
    const primary = extractPrimaryFontFamily(rawFont);
    if (!primary) return DOCX_DEFAULT_FONT;

    const normalized = primary.toLowerCase();
    if (GENERIC_OR_UNSAFE_DOCX_FONTS.has(normalized)) {
        return DOCX_DEFAULT_FONT;
    }

    if (normalized === 'helvetica neue') {
        return 'Helvetica';
    }

    return primary;
}
