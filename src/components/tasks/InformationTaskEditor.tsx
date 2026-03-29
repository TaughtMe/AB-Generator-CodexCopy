import { useEffect, useRef, useState } from 'react';
import { BubbleMenu } from '@tiptap/react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Bold, Gem, Italic, Loader2, Plus, Sparkles, Trash2, Underline as UnderlineIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useWorksheetStore } from '../../store/worksheetStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { generateVocabularyDefinitions, isActiveProviderConfigured } from '../../services/aiService';
import type { InformationTextTask, VocabularyItem } from '../../types/worksheet';

interface Props {
    task: InformationTextTask;
    isActive?: boolean;
}

const MIN_TEXT_WIDTH_RATIO = 30;
const MAX_TEXT_WIDTH_RATIO = 80;
const DEFAULT_TEXT_WIDTH_RATIO = 60;

function isHtml(text: string): boolean {
    return /<[a-z][\s\S]*>/i.test(text);
}

function plainTextToHtml(text: string): string {
    if (!text || !text.trim()) return '';
    if (isHtml(text)) return text;
    return text
        .split('\n')
        .map((line) => `<p>${line || '<br>'}</p>`)
        .join('');
}

function clampTextWidthRatio(value: number): number {
    if (!Number.isFinite(value)) {
        return DEFAULT_TEXT_WIDTH_RATIO;
    }
    return Math.max(
        MIN_TEXT_WIDTH_RATIO,
        Math.min(MAX_TEXT_WIDTH_RATIO, Math.round(value)),
    );
}

function createVocabularyItem(word = ''): VocabularyItem {
    return {
        id: crypto.randomUUID(),
        word: word.trim(),
        pos: '',
        definition: '',
    };
}

export function InformationTaskEditor({ task, isActive = true }: Props) {
    const updateTask = useWorksheetStore((s) => s.updateTask);
    const setActiveTask = useWorksheetStore((s) => s.setActiveTask);
    const { setActiveEditor } = useWorkspaceStore(
        useShallow((state) => ({
            setActiveEditor: state.setActiveEditor,
        })),
    );

    const isActiveRef = useRef(isActive);
    isActiveRef.current = isActive;
    const vocabulary = Array.isArray(task.vocabulary) ? task.vocabulary : [];
    const safeTextWidthRatio = clampTextWidthRatio(task.textWidthRatio);

    const patchTask = (updates: Partial<InformationTextTask>) => {
        updateTask(task.id, updates as Partial<InformationTextTask>);
    };

    const editor = useEditor(
        {
            extensions: [
                StarterKit.configure({
                    heading: false,
                    codeBlock: false,
                    blockquote: false,
                    horizontalRule: false,
                }),
                Underline,
                Placeholder.configure({ placeholder: 'Informationstext eingeben…' }),
            ],
            content: plainTextToHtml(task.content),
            onUpdate: ({ editor: currentEditor }) => {
                patchTask({ content: currentEditor.getHTML() });
            },
            onFocus: ({ editor: currentEditor }) => {
                setActiveEditor(currentEditor);
                setActiveTask(task.id);
            },
            onBlur: () => {
                setActiveEditor(null);
            },
            editorProps: {
                attributes: {
                    class: 'tiptap rich-text-content outline-none min-h-[10rem]',
                },
            },
        },
        [task.id],
    );

    useEffect(() => {
        if (!editor) return;
        const incomingHtml = plainTextToHtml(task.content);
        const currentHtml = editor.getHTML();
        if (currentHtml !== incomingHtml) {
            editor.commands.setContent(incomingHtml, false);
        }
    }, [editor, task.content]);

    useEffect(() => () => setActiveEditor(null), [setActiveEditor]);

    const addVocabulary = () => {
        if (!editor) return;
        const selectedText = editor.state.doc.textBetween(
            editor.state.selection.from,
            editor.state.selection.to,
            ' ',
        );
        if (selectedText.trim()) {
            patchTask({
                vocabulary: [
                    ...vocabulary,
                    createVocabularyItem(selectedText.trim()),
                ],
            });
        }
    };

    const updateVocabularyItem = (
        itemId: string,
        updates: Partial<Omit<VocabularyItem, 'id'>>,
    ) => {
        patchTask({
            vocabulary: vocabulary.map((item) => (
                item.id === itemId ? { ...item, ...updates } : item
            )),
        });
    };

    const [aiLoading, setAiLoading] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelected = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === vocabulary.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(vocabulary.map((v) => v.id)));
        }
    };

    const deleteSelected = () => {
        patchTask({ vocabulary: vocabulary.filter((v) => !selectedIds.has(v.id)) });
        setSelectedIds(new Set());
    };

    const generateDefinitions = async (items: VocabularyItem[]) => {
        if (!isActiveProviderConfigured() || items.length === 0) return;
        const key = items.map((i) => i.id).join(',');
        setAiLoading(key);
        try {
            const results = await generateVocabularyDefinitions(
                items.map((i) => ({ id: i.id, word: i.word })),
            );
            const updated = vocabulary.map((v) => {
                const r = results.find((res) => res.id === v.id);
                return r ? { ...v, pos: r.pos || v.pos, definition: r.definition || v.definition } : v;
            });
            patchTask({ vocabulary: updated });
        } catch {
            // silently fail
        } finally {
            setAiLoading(null);
        }
    };

    const generateForSelected = () => {
        const items = vocabulary.filter((v) => selectedIds.has(v.id) && v.word.trim());
        if (items.length > 0) generateDefinitions(items);
    };

    return (
        <div className="w-full flex flex-col">
            {isActive && (
                <div className="mb-4 flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700 no-print">
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={task.hasNotesColumn}
                            onChange={(event) => patchTask({ hasNotesColumn: event.target.checked })}
                            className="rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                        />
                        Notizenspalte aktivieren
                    </label>
                    {task.hasNotesColumn && (
                        <input
                            type="range"
                            min="30"
                            max="80"
                            step="10"
                            value={safeTextWidthRatio}
                            onChange={(event) => patchTask({
                                textWidthRatio: clampTextWidthRatio(Number.parseInt(event.target.value, 10)),
                            })}
                            className="w-32 accent-blue-500"
                            title="Textbreite einstellen"
                        />
                    )}
                </div>
            )}

            <div className="relative overflow-visible rounded-lg border border-worksheet-border bg-worksheet-field p-3">
                {editor && (
                    <BubbleMenu
                        editor={editor}
                        shouldShow={({ editor: currentEditor, from, to }) => {
                            return isActiveRef.current && from !== to && currentEditor.isFocused;
                        }}
                        tippyOptions={{ duration: 100, zIndex: 99999, appendTo: () => document.getElementById('root') || document.body, interactive: true }}
                        className="no-print flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 z-[99999]"
                    >
                        <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${editor.isActive('bold') ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-600 dark:text-slate-300'}`}
                        >
                            <Bold size={16} />
                        </button>
                        <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${editor.isActive('italic') ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-600 dark:text-slate-300'}`}
                        >
                            <Italic size={16} />
                        </button>
                        <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => editor.chain().focus().toggleUnderline().run()}
                            className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${editor.isActive('underline') ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-600 dark:text-slate-300'}`}
                        >
                            <UnderlineIcon size={16} />
                        </button>
                        <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />
                        <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={addVocabulary}
                            title="Als Vokabel markieren"
                            className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 transition-colors"
                        >
                            <Gem size={18} />
                        </button>
                    </BubbleMenu>
                )}

                <div className="flex gap-6 w-full">
                    <div
                        style={{ width: task.hasNotesColumn ? `${safeTextWidthRatio}%` : '100%' }}
                        className="min-w-0"
                    >
                        {editor ? (
                            <EditorContent
                                editor={editor}
                                className={`prose dark:prose-invert max-w-none text-sm ${task.highlightVocabulary ? 'vocab-highlight-active' : ''} [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:text-worksheet-inkLight [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none`}
                            />
                        ) : (
                            <div className="h-24 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        )}
                    </div>
                    {task.hasNotesColumn && (
                        <div
                            style={{ width: `${100 - safeTextWidthRatio}%` }}
                            className="flex flex-col gap-2 pt-2 border-l border-dashed border-slate-300 dark:border-slate-600 pl-6"
                        >
                            {Array.from({ length: 10 }).map((_, i) => (
                                <div key={i} className="border-b border-slate-300 dark:border-slate-600 h-6 w-full" />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {vocabulary.length > 0 && (
                <div className="mt-8 p-4 bg-white rounded-lg border border-slate-200 print:border-none print:p-0">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
                            <Gem size={16} className="text-amber-500" /> Wortschatz
                        </h4>
                        <label className="no-print flex items-center gap-2 text-xs text-slate-500">
                            <input
                                type="checkbox"
                                checked={task.highlightVocabulary}
                                onChange={(event) => patchTask({ highlightVocabulary: event.target.checked })}
                            />
                            Im Text hervorheben
                        </label>
                    </div>

                    {/* Aktionsleiste */}
                    <div className="no-print flex items-center gap-3 mb-3 pb-3 border-b border-slate-100">
                        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={vocabulary.length > 0 && selectedIds.size === vocabulary.length}
                                ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < vocabulary.length; }}
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
                                    className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                                >
                                    <Trash2 size={13} /> Löschen
                                </button>
                                {isActiveProviderConfigured() && (
                                    <button
                                        type="button"
                                        disabled={aiLoading !== null}
                                        onClick={generateForSelected}
                                        className="inline-flex items-center gap-1 text-xs text-purple-500 hover:text-purple-600 font-medium disabled:opacity-50 transition-colors"
                                        title="KI: Definitionen & Wortarten für ausgewählte Wörter generieren"
                                    >
                                        {aiLoading !== null ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                        KI-Erklärung
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        {vocabulary.map((v) => (
                            <div key={v.id} className={`flex items-start gap-3 group rounded-md px-1 py-0.5 transition-colors ${selectedIds.has(v.id) ? 'bg-blue-50 print:bg-transparent' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(v.id)}
                                    onChange={() => toggleSelected(v.id)}
                                    className="no-print mt-1 rounded border-slate-300 text-blue-500 focus:ring-blue-500 shrink-0"
                                />
                                <input
                                    value={v.word}
                                    onChange={(event) => updateVocabularyItem(v.id, { word: event.target.value })}
                                    placeholder="Wort"
                                    className="w-1/4 text-sm font-semibold border-b border-transparent focus:border-blue-500 bg-transparent px-1 py-0.5 outline-none"
                                />
                                <input
                                    value={v.pos}
                                    onChange={(event) => updateVocabularyItem(v.id, { pos: event.target.value })}
                                    placeholder="Wortart (z.B. Nomen)"
                                    className="w-1/4 text-xs italic text-slate-500 border-b border-transparent focus:border-blue-500 bg-transparent px-1 py-0.5 outline-none"
                                />
                                <textarea
                                    value={v.definition}
                                    onChange={(event) => updateVocabularyItem(v.id, { definition: event.target.value })}
                                    placeholder="Definition / Erklärung eingeben..."
                                    rows={1}
                                    className="flex-1 text-sm border-b border-transparent focus:border-blue-500 bg-transparent px-1 py-0.5 outline-none resize-none overflow-hidden"
                                    onInput={(event) => { const el = event.currentTarget; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }}
                                    ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        patchTask({ vocabulary: vocabulary.filter((item) => item.id !== v.id) });
                                        setSelectedIds((prev) => { const next = new Set(prev); next.delete(v.id); return next; });
                                    }}
                                    className="no-print opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity p-1"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={() => patchTask({ vocabulary: [...vocabulary, createVocabularyItem()] })}
                        className="no-print mt-4 text-xs flex items-center gap-1 text-blue-500 hover:text-blue-600 font-medium"
                    >
                        <Plus size={14} /> Weiteres Wort manuell hinzufügen
                    </button>
                </div>
            )}
        </div>
    );
}
