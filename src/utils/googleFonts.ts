/**
 * Google Fonts Loader – Lädt ausgewählte Google-Schriftarten per CDN-Link.
 *
 * Architektur:
 * - Es wird ein <link> Element in den <head> eingefügt.
 * - Bereits geladene Fonts werden übersprungen (Set-basiertes Tracking).
 * - Die Font-Liste ist kuratiert auf Schulkontext-taugliche Schriftarten.
 */

/** Set aller bereits geladenen Font-Familien (verhindert doppelte <link>-Tags). */
const loadedFonts = new Set<string>();

/**
 * Lädt eine Google-Schriftart per CSS-Link-Tag.
 * Idempotent – mehrfache Aufrufe für denselben Font sind ein No-Op.
 */
export function loadGoogleFont(fontFamily: string): void {
    // Strip CSS fallbacks: "Roboto, sans-serif" → "Roboto"
    const primary = fontFamily.split(',')[0].replace(/["']/g, '').trim();

    if (loadedFonts.has(primary)) return;
    loadedFonts.add(primary);

    // System / lokale Fonts brauchen kein CDN
    const SYSTEM_FONTS = ['Inter', 'Georgia', 'Comic Sans MS', 'Courier New', 'system-ui', 'Arial', 'Times New Roman', 'Verdana'];
    if (SYSTEM_FONTS.some((sf) => primary.toLowerCase() === sf.toLowerCase())) return;

    const familyParam = primary.replace(/\s+/g, '+');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@400;700&display=swap`;
    link.dataset.googleFont = primary;
    document.head.appendChild(link);
}

/** Vorgeladene Font-Auswahl für den DesignEditor. */
export interface FontOption {
    /** CSS font-family Wert (inkl. Fallback) */
    value: string;
    /** Anzeige-Name */
    label: string;
    /** Kategorie für Gruppierung */
    category: 'system' | 'serif' | 'sans-serif' | 'handwriting' | 'monospace';
}

/**
 * Kuratierte Font-Liste für den AB-Generator.
 * Mischung aus System-Fonts und beliebten Google Fonts,
 * speziell für den Schulkontext ausgewählt.
 */
export const CURATED_FONTS: FontOption[] = [
    // ── System-Fonts ──
    { value: 'Inter, sans-serif', label: 'Inter', category: 'sans-serif' },
    { value: 'system-ui, sans-serif', label: 'System UI', category: 'sans-serif' },
    { value: 'Georgia, serif', label: 'Georgia', category: 'serif' },
    { value: '"Comic Sans MS", cursive', label: 'Comic Sans', category: 'handwriting' },
    { value: '"Courier New", monospace', label: 'Courier New', category: 'monospace' },
    { value: '"Times New Roman", serif', label: 'Times New Roman', category: 'serif' },
    { value: 'Arial, sans-serif', label: 'Arial', category: 'sans-serif' },
    { value: 'Verdana, sans-serif', label: 'Verdana', category: 'sans-serif' },

    // ── Google Fonts – Sans-Serif ──
    { value: '"Open Sans", sans-serif', label: 'Open Sans', category: 'sans-serif' },
    { value: 'Roboto, sans-serif', label: 'Roboto', category: 'sans-serif' },
    { value: 'Lato, sans-serif', label: 'Lato', category: 'sans-serif' },
    { value: 'Poppins, sans-serif', label: 'Poppins', category: 'sans-serif' },
    { value: 'Nunito, sans-serif', label: 'Nunito', category: 'sans-serif' },
    { value: '"Source Sans 3", sans-serif', label: 'Source Sans', category: 'sans-serif' },
    { value: 'Montserrat, sans-serif', label: 'Montserrat', category: 'sans-serif' },
    { value: 'Raleway, sans-serif', label: 'Raleway', category: 'sans-serif' },

    // ── Google Fonts – Serif ──
    { value: '"Playfair Display", serif', label: 'Playfair Display', category: 'serif' },
    { value: 'Merriweather, serif', label: 'Merriweather', category: 'serif' },
    { value: '"EB Garamond", serif', label: 'EB Garamond', category: 'serif' },
    { value: 'Lora, serif', label: 'Lora', category: 'serif' },

    // ── Google Fonts – Handwriting (Schulkontext) ──
    { value: '"Architects Daughter", cursive', label: 'Architects Daughter', category: 'handwriting' },
    { value: '"Patrick Hand", cursive', label: 'Patrick Hand', category: 'handwriting' },
    { value: '"Caveat", cursive', label: 'Caveat', category: 'handwriting' },
    { value: '"Indie Flower", cursive', label: 'Indie Flower', category: 'handwriting' },

    // ── Google Fonts – Monospace ──
    { value: '"Fira Code", monospace', label: 'Fira Code', category: 'monospace' },
    { value: '"JetBrains Mono", monospace', label: 'JetBrains Mono', category: 'monospace' },
];

/**
 * Vorladen aller Google Fonts aus der kuratierten Liste.
 * Sollte einmalig beim Start der App aufgerufen werden,
 * damit Font-Previews im Picker sofort sichtbar sind.
 */
export function preloadCuratedFonts(): void {
    for (const font of CURATED_FONTS) {
        loadGoogleFont(font.value);
    }
}
