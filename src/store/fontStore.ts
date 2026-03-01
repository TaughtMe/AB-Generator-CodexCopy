import { create } from 'zustand';
import {
    addCustomFont,
    deleteCustomFont,
    listCustomFontRecords,
    type CustomFontFormat,
    type CustomFontRecord,
} from './dexieStore';
import { fileToBase64 } from '../utils/fileToBase64';
import { injectCustomFonts } from '../utils/fontManager';

export interface CustomFont extends Omit<CustomFontRecord, 'id'> {
    id: number;
}

interface FontStoreState {
    customFonts: CustomFont[];
    isLoading: boolean;
    error: string | null;
}

interface FontStoreActions {
    loadCustomFonts: () => Promise<void>;
    addCustomFontFromFile: (file: File) => Promise<number | null>;
    removeCustomFont: (id: number) => Promise<void>;
    clearError: () => void;
}

type FontStore = FontStoreState & FontStoreActions;

const ALLOWED_FONT_EXTENSIONS: Record<string, CustomFontFormat> = {
    ttf: 'ttf',
    otf: 'otf',
    woff: 'woff',
    woff2: 'woff2',
};

const MIME_TO_FORMAT: Record<string, CustomFontFormat> = {
    'font/ttf': 'ttf',
    'font/otf': 'otf',
    'font/woff': 'woff',
    'font/woff2': 'woff2',
    'application/x-font-ttf': 'ttf',
    'application/x-font-otf': 'otf',
    'application/font-woff': 'woff',
    'application/font-woff2': 'woff2',
    'application/octet-stream': 'ttf',
};

function toCustomFonts(records: CustomFontRecord[]): CustomFont[] {
    return records
        .filter((record): record is CustomFont => typeof record.id === 'number')
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function getExtension(fileName: string): string {
    const index = fileName.lastIndexOf('.');
    if (index < 0) return '';
    return fileName.slice(index + 1).toLowerCase();
}

function inferFontFormat(file: File): CustomFontFormat | null {
    const extension = getExtension(file.name);
    if (extension && ALLOWED_FONT_EXTENSIONS[extension]) {
        return ALLOWED_FONT_EXTENSIONS[extension];
    }

    const mimeType = file.type.trim().toLowerCase();
    if (mimeType && MIME_TO_FORMAT[mimeType]) {
        return MIME_TO_FORMAT[mimeType];
    }

    return null;
}

function normalizeFontName(fileName: string): string {
    const baseName = fileName.replace(/\.[^/.]+$/, '').trim();
    if (!baseName) return 'Eigene Schrift';
    return baseName.replace(/\s+/g, ' ');
}

function toUniqueFontName(baseName: string, existingFonts: CustomFont[]): string {
    const existingNames = new Set(existingFonts.map((font) => font.name.toLowerCase()));
    if (!existingNames.has(baseName.toLowerCase())) return baseName;

    let suffix = 2;
    while (existingNames.has(`${baseName} (${suffix})`.toLowerCase())) {
        suffix += 1;
    }
    return `${baseName} (${suffix})`;
}

export const useFontStore = create<FontStore>((set, get) => ({
    customFonts: [],
    isLoading: false,
    error: null,

    loadCustomFonts: async () => {
        set({ isLoading: true, error: null });
        try {
            const records = await listCustomFontRecords();
            const customFonts = toCustomFonts(records);
            set({ customFonts, isLoading: false, error: null });
            injectCustomFonts(customFonts);
        } catch {
            set({ isLoading: false, error: 'Schriftarten konnten nicht geladen werden.' });
        }
    },

    addCustomFontFromFile: async (file) => {
        const format = inferFontFormat(file);
        if (!format) {
            set({ error: 'Dateiformat nicht unterstützt. Erlaubt: .ttf, .otf, .woff, .woff2' });
            return null;
        }

        try {
            const data = await fileToBase64(file);
            const currentFonts = get().customFonts;
            const proposedName = normalizeFontName(file.name);
            const uniqueName = toUniqueFontName(proposedName, currentFonts);
            const id = await addCustomFont(uniqueName, data, format);

            const createdAt = new Date();
            const nextFonts = [
                ...currentFonts,
                {
                    id,
                    name: uniqueName,
                    data,
                    format,
                    createdAt,
                },
            ];

            set({ customFonts: nextFonts, error: null });
            injectCustomFonts(nextFonts);
            return id;
        } catch {
            set({ error: 'Schriftart konnte nicht gespeichert werden.' });
            return null;
        }
    },

    removeCustomFont: async (id) => {
        try {
            await deleteCustomFont(id);
            const nextFonts = get().customFonts.filter((font) => font.id !== id);
            set({ customFonts: nextFonts, error: null });
            injectCustomFonts(nextFonts);
        } catch {
            set({ error: 'Schriftart konnte nicht gelöscht werden.' });
        }
    },

    clearError: () => {
        set({ error: null });
    },
}));
