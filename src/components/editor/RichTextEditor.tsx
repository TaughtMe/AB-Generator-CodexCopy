import { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
    Bold, Italic, Underline as UnderlineIcon,
    List, ListOrdered, Undo2, Redo2,
} from 'lucide-react';
import { clsx } from 'clsx';

/* ══════════════════════════════════════════════════
   RichTextEditor – Wiederverwendbarer Tiptap-Editor
   mit Mini-Toolbar für Fließtext-Formatierung.

   - Speichert HTML (<p>, <strong>, <em>, <u>, <ul>, <ol>)
   - Plain-Text-Migration: Wenn value kein HTML enthält,
     wird es automatisch in <p>-Tags gewrapped.
   ══════════════════════════════════════════════════ */

export interface RichTextEditorProps {
    /** HTML-Content. Plain-Text wird automatisch migriert. */
    value: string;
    /** Wird bei jeder Änderung mit dem aktuellen HTML aufgerufen. */
    onChange: (html: string) => void;
    /** Placeholder-Text wenn der Editor leer ist. */
    placeholder?: string;
    /** Minimale Zeilen-Höhe (default: 3) */
    minRows?: number;
    /** Editor-Klassen (zusätzlich) */
    className?: string;
    /** Toolbar ausblenden (z.B. für kompakte Felder) */
    hideToolbar?: boolean;
}

/** Prüft ob ein String HTML-Tags enthält */
function isHtml(text: string): boolean {
    return /<[a-z][\s\S]*>/i.test(text);
}

/** Konvertiert Plain-Text → HTML (Zeilenumbrüche → <p>-Tags) */
function plainTextToHtml(text: string): string {
    if (!text || !text.trim()) return '';
    if (isHtml(text)) return text;
    return text
        .split('\n')
        .map((line) => `<p>${line || '<br>'}</p>`)
        .join('');
}

export function RichTextEditor({
    value,
    onChange,
    placeholder = 'Text eingeben…',
    minRows = 3,
    className,
    hideToolbar = false,
}: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false,     // Kein Heading – wir nutzen nur Fließtext
                codeBlock: false,
                blockquote: false,
                horizontalRule: false,
            }),
            Underline,
            Placeholder.configure({ placeholder }),
        ],
        content: plainTextToHtml(value),
        onUpdate: ({ editor: ed }: { editor: any }) => {
            onChange(ed.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'rich-text-content outline-none',
                style: `min-height: ${minRows * 1.6}em`,
            },
        },
    });

    /* Externe Value-Änderungen synchronisieren (z.B. KI-Import) */
    useEffect(() => {
        if (!editor) return;
        const currentHtml = editor.getHTML();
        const incomingHtml = plainTextToHtml(value);
        // Nur setzen wenn sich der Content wirklich unterscheidet
        if (currentHtml !== incomingHtml && incomingHtml !== currentHtml) {
            editor.commands.setContent(incomingHtml, false);
        }
    }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
    const toggleItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
    const toggleUnderline = useCallback(() => editor?.chain().focus().toggleUnderline().run(), [editor]);
    const toggleBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
    const toggleOrderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor]);
    const undo = useCallback(() => editor?.chain().focus().undo().run(), [editor]);
    const redo = useCallback(() => editor?.chain().focus().redo().run(), [editor]);

    if (!editor) return null;

    return (
        <div className={clsx('rounded-lg border border-worksheet-border bg-worksheet-field overflow-hidden transition-colors focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:border-blue-500 print:bg-transparent print:border-none', className)}>
            {/* ── Mini-Toolbar ── */}
            {!hideToolbar && (
                <div className="no-print flex items-center gap-0.5 px-1.5 py-1 border-b border-worksheet-border bg-slate-50/80">
                    <ToolbarButton
                        icon={Bold}
                        isActive={editor.isActive('bold')}
                        onClick={toggleBold}
                        title="Fett (Ctrl+B)"
                    />
                    <ToolbarButton
                        icon={Italic}
                        isActive={editor.isActive('italic')}
                        onClick={toggleItalic}
                        title="Kursiv (Ctrl+I)"
                    />
                    <ToolbarButton
                        icon={UnderlineIcon}
                        isActive={editor.isActive('underline')}
                        onClick={toggleUnderline}
                        title="Unterstrichen (Ctrl+U)"
                    />

                    <div className="w-px h-4 bg-slate-200 mx-0.5" />

                    <ToolbarButton
                        icon={List}
                        isActive={editor.isActive('bulletList')}
                        onClick={toggleBulletList}
                        title="Aufzählung"
                    />
                    <ToolbarButton
                        icon={ListOrdered}
                        isActive={editor.isActive('orderedList')}
                        onClick={toggleOrderedList}
                        title="Nummerierte Liste"
                    />

                    <div className="w-px h-4 bg-slate-200 mx-0.5" />

                    <ToolbarButton
                        icon={Undo2}
                        isActive={false}
                        onClick={undo}
                        title="Rückgängig (Ctrl+Z)"
                        disabled={!editor.can().undo()}
                    />
                    <ToolbarButton
                        icon={Redo2}
                        isActive={false}
                        onClick={redo}
                        title="Wiederholen (Ctrl+Y)"
                        disabled={!editor.can().redo()}
                    />
                </div>
            )}

            {/* ── Editor-Content ── */}
            <EditorContent
                editor={editor}
                className="px-3 py-2 text-sm text-worksheet-ink prose prose-sm max-w-none
                    prose-p:my-1 prose-ul:my-1 prose-ol:my-1
                    prose-li:my-0 prose-li:marker:text-worksheet-inkLight
                    [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
                    [&_.tiptap_p.is-editor-empty:first-child::before]:text-worksheet-inkLight
                    [&_.tiptap_p.is-editor-empty:first-child::before]:float-left
                    [&_.tiptap_p.is-editor-empty:first-child::before]:h-0
                    [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none
                "
            />
        </div>
    );
}

/* ── Toolbar-Button ── */
interface ToolbarButtonProps {
    icon: React.ElementType;
    isActive: boolean;
    onClick: () => void;
    title: string;
    disabled?: boolean;
}

function ToolbarButton({ icon: Icon, isActive, onClick, title, disabled }: ToolbarButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={clsx(
                'p-1 rounded transition-colors cursor-pointer',
                isActive
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-slate-500 hover:bg-slate-100',
                disabled && 'opacity-30 cursor-not-allowed',
            )}
            title={title}
        >
            <Icon size={14} />
        </button>
    );
}
