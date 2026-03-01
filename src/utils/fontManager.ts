import type { CustomFontFormat } from '../store/dexieStore';

const CUSTOM_FONT_STYLE_ID = 'custom-fonts';

export interface CustomFont {
    id: number;
    name: string;
    data: string;
    format: CustomFontFormat;
}

function escapeFontFamilyName(name: string): string {
    return name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function injectCustomFonts(fonts: CustomFont[]): void {
    if (typeof document === 'undefined') return;

    let styleTag = document.getElementById(CUSTOM_FONT_STYLE_ID) as HTMLStyleElement | null;
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = CUSTOM_FONT_STYLE_ID;
        document.head.appendChild(styleTag);
    }

    if (fonts.length === 0) {
        styleTag.textContent = '';
        return;
    }

    styleTag.textContent = fonts.map((font) => {
        const family = escapeFontFamilyName(font.name);
        return `@font-face { font-family: "${family}"; src: url(data:font/${font.format};base64,${font.data}); font-style: normal; font-weight: 400; font-display: swap; }`;
    }).join('\n');
}
