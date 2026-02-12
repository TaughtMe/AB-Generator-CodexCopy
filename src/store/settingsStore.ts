import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ══════════════════════════════════════════════════
   settingsStore.ts – Globale Einstellungen
   API-Key, Schulform, Fach, Lehrplan-Kontext,
   Design-Einstellungen (Schule, Logo, Header, Farben).
   Persistiert via Zustand persist → localStorage.
   ══════════════════════════════════════════════════ */

interface HeaderFields {
    showName: boolean;
    showDate: boolean;
    showClass: boolean;
}

type GeminiModel = 'flash' | 'pro';

interface SettingsState {
    apiKey: string;
    geminiModel: GeminiModel;
    schoolType: string;
    subject: string;
    curriculumContext: string;
    // Design Settings
    schoolName: string;
    logoImageId: number | null;
    headerFields: HeaderFields;
    brandColor: string;
    fontFamily: string;
}

interface SettingsActions {
    setApiKey: (key: string) => void;
    clearApiKey: () => void;
    setGeminiModel: (model: GeminiModel) => void;
    setSchoolType: (type: string) => void;
    setSubject: (subject: string) => void;
    setCurriculumContext: (context: string) => void;
    // Design Actions
    setSchoolName: (name: string) => void;
    setLogoImageId: (id: number | null) => void;
    setHeaderFields: (fields: Partial<HeaderFields>) => void;
    setBrandColor: (color: string) => void;
    setFontFamily: (font: string) => void;
}

type SettingsStore = SettingsState & SettingsActions;

/** Migrate legacy API key from old localStorage entry */
function migrateLegacyApiKey(): string {
    const legacy = localStorage.getItem('gemini-api-key');
    if (legacy) {
        localStorage.removeItem('gemini-api-key');
        return legacy;
    }
    return '';
}

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => ({
            // State – legacy key gets migrated on first load
            apiKey: migrateLegacyApiKey(),
            geminiModel: 'flash' as GeminiModel,
            schoolType: '',
            subject: '',
            curriculumContext: '',
            // Design defaults
            schoolName: '',
            logoImageId: null,
            headerFields: { showName: true, showDate: true, showClass: true },
            brandColor: '#3b82f6',
            fontFamily: 'Inter',

            // Actions
            setApiKey: (key) => set({ apiKey: key }),
            clearApiKey: () => set({ apiKey: '' }),
            setGeminiModel: (model) => set({ geminiModel: model }),
            setSchoolType: (type) => set({ schoolType: type }),
            setSubject: (subject) => set({ subject }),
            setCurriculumContext: (context) => set({ curriculumContext: context }),
            // Design Actions
            setSchoolName: (name) => set({ schoolName: name }),
            setLogoImageId: (id) => set({ logoImageId: id }),
            setHeaderFields: (fields) =>
                set((s) => ({ headerFields: { ...s.headerFields, ...fields } })),
            setBrandColor: (color) => set({ brandColor: color }),
            setFontFamily: (font) => set({ fontFamily: font }),
        }),
        {
            name: 'ab-generator-settings',
        }
    )
);
