import { useEffect, useCallback, memo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import { Plus, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useWorksheetStore } from '../../store/worksheetStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { TextEditorBubbleMenu } from '../editor/shared/TextEditorBubbleMenu';
import { VocabularyList } from '../editor/shared/VocabularyList';
import type { InformationTextTask, TextChunk } from '../../types/worksheet';

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

function createChunk(content = ''): TextChunk {
    return {
        id: crypto.randomUUID(),
        heading: '',
        content,
        notesHeading: '',
    };
}

function createEmptyChunk(): TextChunk {
    return createChunk();
}

/**
 * Teilt den vorhandenen Informationstext (HTML aus Tiptap) beim Wechsel in den
 * Abschnitts-Modus in Chunks auf – pro Block-Element (Absatz/Überschrift/Liste)
 * ein Abschnitt. So geht der Text NICHT verloren. Leere Absätze werden
 * übersprungen; ohne Block-Markup entsteht ein einzelner Abschnitt.
 */
function splitHtmlIntoChunks(html: string): TextChunk[] {
    if (!html || !html.trim()) return [];

    const isNonEmpty = (h: string): boolean => {
        const text = h.replace(/<br\s*\/?>(?=)/gi, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
        return text.length > 0;
    };

    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const blocks = Array.from(doc.body.children);
        if (blocks.length === 0) {
            const inner = doc.body.innerHTML.trim();
            return isNonEmpty(inner) ? [createChunk(inner)] : [];
        }
        return blocks
            .map((el) => el.outerHTML.trim())
            .filter(isNonEmpty)
            .map((content) => createChunk(content));
    } catch {
        return isNonEmpty(html) ? [createChunk(html)] : [];
    }
}

/** Prüft, ob ein HTML-String visuell leer ist (leer, undefined, <p></p>, <p><br></p>, etc.). */
export function isEmptyHTML(html: string | undefined): boolean {
    if (!html) return true;
    const stripped = html
        .replace(/<br\s*\/?>/gi, '')
        .replace(/<[^>]+>/g, '')
        .trim();
    return stripped.length === 0;
}

/** Tiptap-Extension: Blockiert Enter/Shift-Enter, ideal für einzeilige Überschriften. */
const DisableEnter = Extension.create({
    name: 'disableEnter',
    addKeyboardShortcuts() {
        return {
            Enter: () => true,
            'Shift-Enter': () => true,
        };
    },
});

/* ------------------------------------------------------------------ */
/*  HeadingEditor – eigene Tiptap-Instanz für Chunk-Überschriften     */
/* ------------------------------------------------------------------ */

interface HeadingEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    /** Render as italic + normal weight instead of bold (e.g. notes headings). */
    variant?: 'bold' | 'italic';
    stableKey: string;
}

const HeadingEditor = memo(function HeadingEditor({
    value,
    onChange,
    placeholder = 'Optionale Überschrift...',
    variant = 'bold',
    stableKey,
}: HeadingEditorProps) {
    const { setActiveEditor } = useWorkspaceStore(
        useShallow((state) => ({ setActiveEditor: state.setActiveEditor })),
    );

    const isItalic = variant === 'italic';

    const editor = useEditor(
        {
            extensions: [
                StarterKit.configure({
                    heading: false,
                    codeBlock: false,
                    blockquote: false,
                    horizontalRule: false,
                    bulletList: false,
                    orderedList: false,
                }),
                Underline,
                TextStyle,
                Color,
                DisableEnter,
                Placeholder.configure({ placeholder }),
            ],
            content: value || '',
            onUpdate: ({ editor: e }) => onChange(e.getHTML()),
            onFocus: ({ editor: e }) => setActiveEditor(e),
            onBlur: () => setActiveEditor(null),
            editorProps: {
                attributes: {
                    class: `tiptap outline-none${isItalic ? ' italic' : ''}`,
                },
            },
        },
        [stableKey],
    );

    useEffect(() => {
        if (!editor) return;
        const incoming = value || '';
        if (editor.getHTML() !== incoming) {
            editor.commands.setContent(incoming, false);
        }
    }, [editor, value]);

    useEffect(() => () => setActiveEditor(null), [setActiveEditor]);

    return editor ? (
        <EditorContent
            editor={editor}
            className={`${isItalic ? 'font-normal' : 'font-bold'} text-worksheet-ink text-sm [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:text-slate-400 [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty]:print:hidden`}
        />
    ) : null;
});

/* ------------------------------------------------------------------ */
/*  ChunkEditor – gekapselte Tiptap-Instanz pro Textabschnitt        */
/* ------------------------------------------------------------------ */

interface ChunkEditorProps {
    chunk: TextChunk;
    task: InformationTextTask;
    onChange: (html: string) => void;
}

const ChunkEditor = memo(function ChunkEditor({ chunk, task, onChange }: ChunkEditorProps) {
    const { setActiveEditor } = useWorkspaceStore(
        useShallow((state) => ({ setActiveEditor: state.setActiveEditor })),
    );
    const setActiveTask = useWorksheetStore((s) => s.setActiveTask);

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
                TextStyle,
                Color,
                Placeholder.configure({ placeholder: 'Text eingeben…' }),
            ],
            content: plainTextToHtml(chunk.content),
            onUpdate: ({ editor: e }) => onChange(e.getHTML()),
            onFocus: ({ editor: e }) => {
                setActiveEditor(e);
                setActiveTask(task.id);
            },
            onBlur: () => setActiveEditor(null),
            editorProps: {
                attributes: {
                    class: 'tiptap rich-text-content outline-none min-h-[4rem] print:min-h-0 print:overflow-visible',
                },
            },
        },
        [chunk.id],
    );

    useEffect(() => {
        if (!editor) return;
        const incoming = plainTextToHtml(chunk.content);
        if (editor.getHTML() !== incoming) {
            editor.commands.setContent(incoming, false);
        }
    }, [editor, chunk.content]);

    useEffect(() => () => setActiveEditor(null), [setActiveEditor]);

    return (
        <>
            {editor && <TextEditorBubbleMenu editor={editor} taskId={task.id} />}
            {editor ? (
                <EditorContent
                    editor={editor}
                    className={`prose dark:prose-invert max-w-none text-sm ${task.highlightVocabulary ? 'vocab-highlight-active' : ''} [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:text-worksheet-inkLight [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none`}
                />
            ) : (
                <div className="h-16 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
            )}
        </>
    );
});

export function InformationTaskEditor({ task, isActive = true }: Props) {
    const updateTask = useWorksheetStore((s) => s.updateTask);
    const setActiveTask = useWorksheetStore((s) => s.setActiveTask);
    const { setActiveEditor } = useWorkspaceStore(
        useShallow((state) => ({
            setActiveEditor: state.setActiveEditor,
        })),
    );

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
                TextStyle,
                Color,
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
                    class: 'tiptap rich-text-content outline-none min-h-[10rem] print:min-h-0 print:overflow-visible',
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

    /* --- Chunk helpers (immutable) --- */
    const chunks = Array.isArray(task.chunks) ? task.chunks : [];
    const isChunked = task.isChunked === true;

    const handleToggleChunked = (checked: boolean) => {
        if (checked && chunks.length === 0) {
            // Vorhandenen Text in Abschnitte übernehmen statt zu verwerfen.
            const fromContent = splitHtmlIntoChunks(task.content);
            patchTask({
                isChunked: true,
                chunks: fromContent.length > 0 ? fromContent : [createEmptyChunk()],
            });
        } else {
            patchTask({ isChunked: checked });
        }
    };

    const updateChunk = useCallback(
        (chunkId: string, updates: Partial<TextChunk>) => {
            const currentChunks = Array.isArray(task.chunks) ? task.chunks : [];
            patchTask({
                chunks: currentChunks.map((c) =>
                    c.id === chunkId ? { ...c, ...updates } : c,
                ),
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [task.chunks, task.id],
    );

    const removeChunk = (chunkId: string) => {
        patchTask({ chunks: chunks.filter((c) => c.id !== chunkId) });
    };

    const addChunk = () => {
        patchTask({ chunks: [...chunks, createEmptyChunk()] });
    };

    return (
        <div className="w-full flex flex-col">
            {isActive && (
                <div className="mb-4 flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700 no-print print:hidden">
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
                    <div className="w-px h-5 bg-slate-300 dark:bg-slate-600" />
                    <label className="tour-chunked-reading flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={isChunked}
                            onChange={(event) => handleToggleChunked(event.target.checked)}
                            className="rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                        />
                        Abschnitts-Modus (Chunked Reading)
                    </label>
                </div>
            )}

            {/* ---- Standard View (single editor) ---- */}
            {!isChunked && (
                <div className="relative overflow-visible rounded-lg border border-worksheet-border bg-worksheet-field p-3">
                    {editor && <TextEditorBubbleMenu editor={editor} taskId={task.id} />}

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
                                    <div key={i} className="border-b border-slate-300 dark:border-slate-600 print:border-black print:opacity-100 h-6 w-full" />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ---- Chunked View ---- */}
            {isChunked && (
                <div className="flex flex-col gap-4">
                    {chunks.map((chunk, idx) => (
                        <div
                            key={chunk.id}
                            className="relative rounded-lg border border-worksheet-border bg-worksheet-field p-3 break-inside-avoid print:border-none print:shadow-none print:p-0 print:mb-6"
                        >
                            {/* Delete button */}
                            {chunks.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeChunk(chunk.id)}
                                    className="no-print print:hidden absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 transition-colors rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                    title="Absatz löschen"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}

                            <div className="flex gap-6 w-full">
                                {/* Left column: Heading + ChunkEditor */}
                                <div
                                    style={{ width: task.hasNotesColumn ? `${safeTextWidthRatio}%` : '100%' }}
                                    className="min-w-0 flex flex-col gap-1"
                                >
                                    <div className={isEmptyHTML(chunk.heading) ? 'print:hidden' : ''}>
                                        <HeadingEditor
                                            value={chunk.heading}
                                            onChange={(html) => updateChunk(chunk.id, { heading: html })}
                                            placeholder={`Optionale Überschrift (z.B. Absatz ${idx + 1})`}
                                            stableKey={`heading-${chunk.id}`}
                                        />
                                    </div>
                                    <ChunkEditor
                                        chunk={chunk}
                                        task={task}
                                        onChange={(html) => updateChunk(chunk.id, { content: html })}
                                    />
                                </div>

                                {/* Right column: Notes heading + lines */}
                                {task.hasNotesColumn && (
                                    <div
                                        style={{ width: `${100 - safeTextWidthRatio}%` }}
                                        className="flex flex-col gap-1 pt-0 border-l border-dashed border-slate-300 dark:border-slate-600 pl-6"
                                    >
                                        <div className={isEmptyHTML(chunk.notesHeading) ? 'print:hidden' : ''}>
                                            <HeadingEditor
                                                value={chunk.notesHeading}
                                                onChange={(html) => updateChunk(chunk.id, { notesHeading: html })}
                                                placeholder="Aufgabe (z.B. Fasse zusammen:)"
                                                variant="italic"
                                                stableKey={`notes-heading-${chunk.id}`}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2 pt-1">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <div key={i} className="border-b border-slate-300 dark:border-slate-600 print:border-black print:opacity-100 h-6 w-full" />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={addChunk}
                        className="no-print print:hidden self-center flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium text-sm transition-colors"
                    >
                        <Plus size={16} /> Neuen Absatz hinzufügen
                    </button>
                </div>
            )}

            <VocabularyList vocabulary={vocabulary} taskId={task.id} />
        </div>
    );
}
