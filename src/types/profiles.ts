/* ══════════════════════════════════════════════════
   profiles.ts – Typen für Fächer & Klassen-Profile
   ══════════════════════════════════════════════════ */

export interface Subject {
    id: string;
    name: string;
    /** Lehrplan-Text / Kompetenzerwartungen */
    curriculumText: string;
}

export interface ClassProfile {
    id: string;
    name: string;
    /** Optionales zugeordnetes Fach (Subject-ID) */
    subjectId?: string;
    /** Klassenbezogener Lehrplan-Kontext (Text/Links) */
    curriculumContext: string;
    /** KI-Profil der Lerngruppe (Leistungsniveau, Förderbedarf, etc.) */
    studentProfile: string;
    /** Legacy-Alias (wird bei Migration auf studentProfile gemappt) */
    characteristic?: string;
    createdAt?: Date;
    updatedAt?: Date;
}
