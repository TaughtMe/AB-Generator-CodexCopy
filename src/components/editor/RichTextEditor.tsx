import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import { CellSelection, deleteColumn, deleteRow } from '@tiptap/pm/tables';
import { clsx } from 'clsx';
import { useFontStore } from '../../store/fontStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { StyledTableCell, StyledTableHeader } from './tiptapTableStyling';
import { FontSize } from './tiptapFontSize';
import { TextAlign } from './tiptapTextAlign';
import { EditorErrorBoundary } from './EditorErrorBoundary';

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
    /** Variante für reguläre oder kompakte Felder */
    variant?: 'default' | 'minimal';
    /** Optionaler Hook für Zugriff auf die Editor-Instanz (z.B. Table-Actions). */
    onEditorReady?: (editor: Editor | null) => void;
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

export function RichTextEditor(props: RichTextEditorProps) {
    return (
        <EditorErrorBoundary fallbackContent={props.value}>
            <RichTextEditorInner {...props} />
        </EditorErrorBoundary>
    );
}

function RichTextEditorInner({
    value,
    onChange,
    placeholder = 'Text eingeben…',
    minRows = 3,
    className,
    hideToolbar = false,
    variant = 'default',
    onEditorReady,
}: RichTextEditorProps) {
    const setActiveEditor = useWorkspaceStore((s) => s.setActiveEditor);
    const isMinimal = variant === 'minimal';
    const [isFocused, setIsFocused] = useState(false);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false,     // Kein Heading – wir nutzen nur Fließtext
                codeBlock: false,
                blockquote: false,
                horizontalRule: false,
            }),
            TextStyle,
            Color.configure({
                types: ['textStyle'],
            }),
            FontFamily.configure({
                types: ['textStyle'],
            }),
            FontSize,
            TextAlign.configure({
                types: ['heading', 'paragraph', 'tableCell', 'tableHeader'],
            }),
            Underline,
            Placeholder.configure({ placeholder }),
            // Default table keymaps bleiben aktiv (Tab = nächste Zelle, Ende = neue Zeile, Enter = Zeilenumbruch in Zelle).
            Table.configure({ resizable: true }),
            TableRow,
            StyledTableHeader,
            StyledTableCell,
        ],
        content: plainTextToHtml(value),
        onUpdate: ({ editor: ed }: { editor: Editor }) => {
            onChange(ed.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'rich-text-content outline-none',
                style: isMinimal ? undefined : `min-height: ${minRows * 1.6}em`,
            },
            handleKeyDown: (view, event) => {
                if (event.key !== 'Backspace' && event.key !== 'Delete') {
                    return false;
                }

                const { selection } = view.state;
                if (!(selection instanceof CellSelection)) {
                    return false;
                }

                if (selection.isRowSelection()) {
                    return deleteRow(view.state, view.dispatch);
                }

                if (selection.isColSelection()) {
                    return deleteColumn(view.state, view.dispatch);
                }

                return false;
            },
        },
    });

    useEffect(() => {
        if (!editor) return;

        const handleFocus = () => {
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
                blurTimeoutRef.current = null;
            }
            if (isMinimal) setIsFocused(true);
            setActiveEditor(editor);
        };

        const handleBlur = () => {
            if (!isMinimal) return;
            blurTimeoutRef.current = setTimeout(() => {
                setIsFocused(false);
                blurTimeoutRef.current = null;
            }, 150);
        };

        if (editor.isFocused) {
            if (isMinimal) setIsFocused(true);
            setActiveEditor(editor);
        }

        editor.on('focus', handleFocus);
        editor.on('blur', handleBlur);

        return () => {
            editor.off('focus', handleFocus);
            editor.off('blur', handleBlur);
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
                blurTimeoutRef.current = null;
            }
        };
    }, [editor, isMinimal, setActiveEditor]);

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

    useEffect(() => {
        if (!onEditorReady) return;
        onEditorReady(editor ?? null);
        return () => onEditorReady(null);
    }, [editor, onEditorReady]);

    if (!editor) return null;

    return (
        <div className={clsx('rounded-lg border border-worksheet-border bg-worksheet-field overflow-visible transition-colors focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:border-blue-500 print:bg-transparent print:border-none', className)}>
            {/* ── Editor-Content ── */}
            <EditorContent
                editor={editor}
                className={clsx(
                    'overflow-hidden text-sm text-worksheet-ink prose prose-sm max-w-none rounded-lg',
                    isMinimal ? 'min-h-[40px] p-2' : 'px-3 py-2',
                    isMinimal ? 'prose-p:my-0 prose-ul:my-0 prose-ol:my-0' : 'prose-p:my-1 prose-ul:my-1 prose-ol:my-1',
                    'prose-li:my-0 prose-li:marker:text-worksheet-inkLight',
                    '[&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
                    '[&_.tiptap_p.is-editor-empty:first-child::before]:text-worksheet-inkLight',
                    '[&_.tiptap_p.is-editor-empty:first-child::before]:float-left',
                    '[&_.tiptap_p.is-editor-empty:first-child::before]:h-0',
                    '[&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none',
                )}
            />
        </div>
    );
}
