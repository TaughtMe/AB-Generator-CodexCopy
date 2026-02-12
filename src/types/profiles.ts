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
    /** Pädagogische Charakteristik der Klasse */
    characteristic: string;
}
