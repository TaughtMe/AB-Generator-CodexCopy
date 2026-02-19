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
}

interface ProfileActions {
    addSubject: (name: string, curriculumText?: string) => void;
    removeSubject: (id: string) => void;
    addClassProfile: (name: string, characteristic?: string) => void;
    removeClassProfile: (id: string) => void;
}

type ProfileStore = ProfileState & ProfileActions;

export const useProfileStore = create<ProfileStore>()(
    persist(
        (set) => ({
            subjects: [],
            classes: [],

            addSubject: (name, curriculumText = '') =>
                set((s) => ({
                    subjects: [...s.subjects, { id: crypto.randomUUID(), name, curriculumText }],
                })),

            removeSubject: (id) =>
                set((s) => ({
                    subjects: s.subjects.filter((sub) => sub.id !== id),
                })),

            addClassProfile: (name, characteristic = '') =>
                set((s) => ({
                    classes: [...s.classes, { id: crypto.randomUUID(), name, characteristic }],
                })),

            removeClassProfile: (id) =>
                set((s) => ({
                    classes: s.classes.filter((cls) => cls.id !== id),
                })),
        }),
        {
            name: 'ab-generator-profiles',
        }
    )
);
