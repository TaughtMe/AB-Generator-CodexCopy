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
    updateSubject: (id: string, updates: Partial<Omit<Subject, 'id'>>) => void;
    removeSubject: (id: string) => void;
    addClassProfile: (name: string, characteristic?: string) => void;
    updateClassProfile: (id: string, updates: Partial<Omit<ClassProfile, 'id'>>) => void;
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

            updateSubject: (id, updates) =>
                set((s) => ({
                    subjects: s.subjects.map((sub) =>
                        sub.id === id ? { ...sub, ...updates } : sub
                    ),
                })),

            removeSubject: (id) =>
                set((s) => ({
                    subjects: s.subjects.filter((sub) => sub.id !== id),
                })),

            addClassProfile: (name, characteristic = '') =>
                set((s) => ({
                    classes: [...s.classes, { id: crypto.randomUUID(), name, characteristic }],
                })),

            updateClassProfile: (id, updates) =>
                set((s) => ({
                    classes: s.classes.map((cls) =>
                        cls.id === id ? { ...cls, ...updates } : cls
                    ),
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
