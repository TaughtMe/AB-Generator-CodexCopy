import { Fragment, useEffect, useMemo, useState } from 'react';
import { Gem, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { generateVocabularyDefinitions, isActiveProviderConfigured } from '../../../services/aiService';
import { useWorksheetStore } from '../../../store/worksheetStore';
import type { Task, VocabularyItem } from '../../../types/worksheet';

interface VocabularyListProps {
    vocabulary?: VocabularyItem[];
    taskId: string;
}

function createVocabularyItem(word = ''): VocabularyItem {
    return {
        id: crypto.randomUUID(),
        word: word.trim(),
        pos: '',
        definition: '',
    };
}

export function VocabularyList({ vocabulary, taskId }: VocabularyListProps) {
    const updateTask = useWorksheetStore((state) => state.updateTask);
    const task = useWorksheetStore((state) => state.tasksById[taskId]);
    const [aiLoading, setAiLoading] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const vocabularyItems = useMemo(
        () => (Array.isArray(vocabulary) ? vocabulary : []),
        [vocabulary],
    );

    useEffect(() => {
        const existingIds = new Set(vocabularyItems.map((item) => item.id));
        setSelectedIds((prev) => {
            const next = new Set<string>();
            prev.forEach((id) => {
                if (existingIds.has(id)) {
                    next.add(id);
                }
            });
            return next;
        });
    }, [vocabularyItems]);

    if (vocabularyItems.length === 0) {
        return null;
    }

    const patchTask = (updates: Partial<Task>) => {
        updateTask(taskId, updates);
    };

    const updateVocabularyItem = (
        itemId: string,
        updates: Partial<Omit<VocabularyItem, 'id'>>,
    ) => {
        patchTask({
            vocabulary: vocabularyItems.map((item) => (
                item.id === itemId ? { ...item, ...updates } : item
            )),
        });
    };

    const toggleSelected = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === vocabularyItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(vocabularyItems.map((item) => item.id)));
        }
    };

    const deleteSelected = () => {
        patchTask({ vocabulary: vocabularyItems.filter((item) => !selectedIds.has(item.id)) });
        setSelectedIds(new Set());
    };

    const generateDefinitions = async (items: VocabularyItem[]) => {
        if (!isActiveProviderConfigured() || items.length === 0) return;
        const key = items.map((item) => item.id).join(',');
        setAiLoading(key);

        try {
            const results = await generateVocabularyDefinitions(
                items.map((item) => ({ id: item.id, word: item.word })),
            );

            patchTask({
                vocabulary: vocabularyItems.map((item) => {
                    const result = results.find((entry) => entry.id === item.id);
                    return result
                        ? {
                            ...item,
                            pos: result.pos || item.pos,
                            definition: result.definition || item.definition,
                        }
                        : item;
                }),
            });
        } catch {
            // silently fail
        } finally {
            setAiLoading(null);
        }
    };

    const generateForSelected = () => {
        const items = vocabularyItems.filter((item) => selectedIds.has(item.id) && item.word.trim());
        if (items.length > 0) {
            void generateDefinitions(items);
        }
    };

    const canHighlightVocabulary = task?.type === 'information';
    const highlightVocabulary = task?.type === 'information' ? task.highlightVocabulary : false;

    return (
        <div className="mt-8 p-4 bg-white rounded-lg border border-slate-200 print:border-none print:p-0">
            <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
                    <Gem size={16} className="text-amber-500" /> Wortschatz
                </h4>
                {canHighlightVocabulary && (
                    <label className="no-print flex items-center gap-2 text-xs text-slate-500">
                        <input
                            type="checkbox"
                            checked={highlightVocabulary}
                            onChange={(event) => patchTask({ highlightVocabulary: event.target.checked } as Partial<Task>)}
                        />
                        Im Text hervorheben
                    </label>
                )}
            </div>

            <div className="no-print flex items-center gap-3 mb-3 pb-3 border-b border-slate-100">
                <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={vocabularyItems.length > 0 && selectedIds.size === vocabularyItems.length}
                        ref={(element) => {
                            if (element) {
                                element.indeterminate = selectedIds.size > 0 && selectedIds.size < vocabularyItems.length;
                            }
                        }}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                    />
                    Alle
                </label>

                {selectedIds.size > 0 && (
                    <>
                        <span className="text-xs text-slate-400">{selectedIds.size} ausgewählt</span>
                        <div className="w-px h-4 bg-slate-200" />
                        <button
                            type="button"
                            onClick={deleteSelected}
                            className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium transition-colors print:hidden"
                        >
                            <Trash2 size={13} /> Löschen
                        </button>
                        {isActiveProviderConfigured() && (
                            <button
                                type="button"
                                disabled={aiLoading !== null}
                                onClick={generateForSelected}
                                className="inline-flex items-center gap-1 text-xs text-purple-500 hover:text-purple-600 font-medium disabled:opacity-50 transition-colors print:hidden"
                                title="KI: Definitionen & Wortarten für ausgewählte Wörter generieren"
                            >
                                {aiLoading !== null ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                KI-Erklärung
                            </button>
                        )}
                    </>
                )}
            </div>

            <div className="flex flex-col gap-3 print:break-before-auto print:mt-8 print:grid print:grid-cols-2 print:gap-x-12 print:gap-y-4">
                {vocabularyItems.map((item) => (
                    <Fragment key={item.id}>
                    {/* Druck: Vokabel als lesbarer Text statt editierbarer Unterstrich-Felder. */}
                    <div className="hidden print:block break-inside-avoid text-black leading-snug">
                        <span className="text-sm font-semibold">{item.word}</span>
                        {item.pos?.trim() && (
                            <span className="text-xs italic text-slate-600"> ({item.pos})</span>
                        )}
                        {item.definition?.trim() && (
                            <span className="text-sm"> — {item.definition}</span>
                        )}
                    </div>

                    <div
                        className={`flex items-start gap-3 group rounded-md px-1 py-0.5 transition-colors break-inside-avoid print:hidden ${
                            selectedIds.has(item.id) ? 'bg-blue-50' : ''
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelected(item.id)}
                            className="no-print mt-1 rounded border-slate-300 text-blue-500 focus:ring-blue-500 shrink-0"
                        />
                        <input
                            value={item.word}
                            onChange={(event) => updateVocabularyItem(item.id, { word: event.target.value })}
                            placeholder="Wort"
                            className="w-1/4 text-sm font-semibold border-b border-transparent focus:border-blue-500 bg-transparent px-1 py-0.5 outline-none print:border-none print:border-solid print:border-b print:border-black print:rounded-none print:text-black print:placeholder-transparent"
                        />
                        <input
                            value={item.pos}
                            onChange={(event) => updateVocabularyItem(item.id, { pos: event.target.value })}
                            placeholder="Wortart (z.B. Nomen)"
                            className="w-1/4 text-xs italic text-slate-500 border-b border-transparent focus:border-blue-500 bg-transparent px-1 py-0.5 outline-none print:border-none print:border-solid print:border-b print:border-black print:rounded-none print:text-black print:placeholder-transparent"
                        />
                        <textarea
                            value={item.definition}
                            onChange={(event) => updateVocabularyItem(item.id, { definition: event.target.value })}
                            placeholder="Definition / Erklärung eingeben..."
                            rows={1}
                            className="flex-1 text-sm border-b border-transparent focus:border-blue-500 bg-transparent px-1 py-0.5 outline-none resize-none overflow-hidden print:border-none print:border-solid print:border-b print:border-black print:rounded-none print:text-black print:placeholder-transparent"
                            onInput={(event) => {
                                const element = event.currentTarget;
                                element.style.height = 'auto';
                                element.style.height = `${element.scrollHeight}px`;
                            }}
                            ref={(element) => {
                                if (element) {
                                    element.style.height = 'auto';
                                    element.style.height = `${element.scrollHeight}px`;
                                }
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                patchTask({
                                    vocabulary: vocabularyItems.filter((entry) => entry.id !== item.id),
                                });
                                setSelectedIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(item.id);
                                    return next;
                                });
                            }}
                            className="no-print print:hidden opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity p-1"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                    </Fragment>
                ))}
            </div>

            <button
                type="button"
                onClick={() => patchTask({ vocabulary: [...vocabularyItems, createVocabularyItem()] })}
                className="no-print print:hidden mt-4 text-xs flex items-center gap-1 text-blue-500 hover:text-blue-600 font-medium"
            >
                <Plus size={14} /> Weiteres Wort manuell hinzufügen
            </button>
        </div>
    );
}
