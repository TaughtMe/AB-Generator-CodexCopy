import { create } from 'zustand';

export interface UploadedSource {
    id: string;
    name: string;
    extractedText: string;
    isActive: boolean;
}

interface SourceStore {
    sources: UploadedSource[];
    addSource: (payload: { name: string; extractedText: string; isActive?: boolean }) => string;
    removeSource: (id: string) => void;
    toggleSourceActive: (id: string) => void;
    clearSources: () => void;
}

export const useSourceStore = create<SourceStore>((set) => ({
    sources: [],

    addSource: ({ name, extractedText, isActive = true }) => {
        const id = crypto.randomUUID();
        set((state) => ({
            sources: [
                ...state.sources,
                {
                    id,
                    name: name.trim() || 'Unbenannte Quelle',
                    extractedText,
                    isActive,
                },
            ],
        }));
        return id;
    },

    removeSource: (id) => {
        set((state) => ({
            sources: state.sources.filter((source) => source.id !== id),
        }));
    },

    toggleSourceActive: (id) => {
        set((state) => ({
            sources: state.sources.map((source) => (
                source.id === id
                    ? { ...source, isActive: !source.isActive }
                    : source
            )),
        }));
    },

    clearSources: () => {
        set({ sources: [] });
    },
}));
