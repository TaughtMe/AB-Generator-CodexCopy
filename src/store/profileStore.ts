import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Subject, ClassProfile } from '../types/profiles';

/* ══════════════════════════════════════════════════
   profileStore.ts – Fächer & Klassen verwalten
   Persistiert via Zustand persist → localStorage.
   ══════════════════════════════════════════════════ */

interface ProfileState {
    subjects: Subject[];
    classes: ClassProfile[];
    /** Aktuell ausgewähltes Fach (wird in Sidebar angezeigt) */
    activeSubjectId: string | null;
    /** Aktuell ausgewählte Klasse (wird in Sidebar angezeigt) */
    activeClassId: string | null;
}

interface ProfileActions {
    addSubject: (name: string, curriculumText?: string) => void;
    removeSubject: (id: string) => void;
    addClassProfile: (name: string, characteristic?: string) => void;
    removeClassProfile: (id: string) => void;
    setActiveSubject: (id: string | null) => void;
    setActiveClass: (id: string | null) => void;
}

type ProfileStore = ProfileState & ProfileActions;

export const useProfileStore = create<ProfileStore>()(
    persist(
        (set) => ({
            subjects: [],
            classes: [],
            activeSubjectId: null,
            activeClassId: null,

            addSubject: (name, curriculumText = '') =>
                set((s) => ({
                    subjects: [...s.subjects, { id: crypto.randomUUID(), name, curriculumText }],
                })),

            removeSubject: (id) =>
                set((s) => ({
                    subjects: s.subjects.filter((sub) => sub.id !== id),
                    // Wenn das aktive Fach gelöscht wird, zurücksetzen
                    activeSubjectId: s.activeSubjectId === id ? null : s.activeSubjectId,
                })),

            addClassProfile: (name, characteristic = '') =>
                set((s) => ({
                    classes: [...s.classes, {
                        id: crypto.randomUUID(),
                        name,
                        subjectId: undefined,
                        curriculumContext: '',
                        studentProfile: characteristic,
                        characteristic,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    }],
                })),

            removeClassProfile: (id) =>
                set((s) => ({
                    classes: s.classes.filter((cls) => cls.id !== id),
                    // Wenn die aktive Klasse gelöscht wird, zurücksetzen
                    activeClassId: s.activeClassId === id ? null : s.activeClassId,
                })),

            setActiveSubject: (id) => set({ activeSubjectId: id }),
            setActiveClass: (id) => set({ activeClassId: id }),
        }),
        {
            name: 'ab-generator-profiles',
        }
    )
);
