import { useCallback, useEffect } from 'react';
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
import {
    Bold, Italic, Underline as UnderlineIcon,
    List, ListOrdered, Undo2, Redo2,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
} from 'lucide-react';
import { clsx } from 'clsx';
import { ICON_SIZES } from '../ui/iconSizes';
import { ColorPickerDropdown } from './ColorPickerDropdown';
import { useFontStore } from '../../store/fontStore';
import { StyledTableCell, StyledTableHeader } from './tiptapTableStyling';
import { FontSize, FONT_SIZE_OPTIONS } from './tiptapFontSize';
import { TextAlign } from './tiptapTextAlign';

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

const FONT_FAMILY_OPTIONS = [
    { label: 'Standard', value: '' },
    { label: 'Arial', value: 'Arial' },
    { label: 'Times New Roman', value: 'Times New Roman' },
    { label: 'Comic Sans MS', value: 'Comic Sans MS' },
];

function normalizeColorForInput(color?: string): string {
    if (!color) return '#000000';

    const trimmed = color.trim();
    if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
    if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
        const [, r, g, b] = trimmed;
        return `#${r}${r}${g}${g}${b}${b}`;
    }

    return '#000000';
}

export function RichTextEditor({
    value,
    onChange,
    placeholder = 'Text eingeben…',
    minRows = 3,
    className,
    hideToolbar = false,
    onEditorReady,
}: RichTextEditorProps) {
    const customFonts = useFontStore((state) => state.customFonts);

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
                style: `min-height: ${minRows * 1.6}em`,
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

    const toggleBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
    const toggleItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
    const toggleUnderline = useCallback(() => editor?.chain().focus().toggleUnderline().run(), [editor]);
    const toggleBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
    const toggleOrderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor]);
    const undo = useCallback(() => editor?.chain().focus().undo().run(), [editor]);
    const redo = useCallback(() => editor?.chain().focus().redo().run(), [editor]);

    if (!editor) return null;

    const textStyleAttrs = editor.getAttributes('textStyle') as { color?: string; fontFamily?: string; fontSize?: string };
    const selectedColor = normalizeColorForInput(textStyleAttrs.color);
    const selectedFontFamily = typeof textStyleAttrs.fontFamily === 'string' ? textStyleAttrs.fontFamily : '';
    const selectedFontSize = typeof textStyleAttrs.fontSize === 'string' ? textStyleAttrs.fontSize : '';

    return (
        <div className={clsx('rounded-lg border border-worksheet-border bg-worksheet-field overflow-visible transition-colors focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:border-blue-500 print:bg-transparent print:border-none', className)}>
            {/* ── Mini-Toolbar ── */}
            {!hideToolbar && (
                <div className="rich-text-toolbar no-print flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-worksheet-border bg-slate-50/80 min-w-0">
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

                    <div className="hidden sm:block w-px h-4 bg-slate-200 mx-0.5" />

                    <ToolbarButton
                        icon={AlignLeft}
                        isActive={editor.isActive({ textAlign: 'left' })}
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                        title="Linksbündig"
                    />
                    <ToolbarButton
                        icon={AlignCenter}
                        isActive={editor.isActive({ textAlign: 'center' })}
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                        title="Zentriert"
                    />
                    <ToolbarButton
                        icon={AlignRight}
                        isActive={editor.isActive({ textAlign: 'right' })}
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                        title="Rechtsbündig"
                    />
                    <ToolbarButton
                        icon={AlignJustify}
                        isActive={editor.isActive({ textAlign: 'justify' })}
                        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                        title="Blocksatz"
                    />

                    <div className="hidden sm:block w-px h-4 bg-slate-200 mx-0.5" />

                    <ColorPickerDropdown
                        value={selectedColor}
                        onChange={(color) => editor.chain().focus().setColor(color).run()}
                        title="Textfarbe wählen"
                    />

                    <select
                        value={selectedFontSize}
                        onChange={(event) => {
                            const size = event.target.value;
                            const chain = editor.chain().focus();
                            if (!size) {
                                chain.unsetFontSize().run();
                                return;
                            }
                            chain.setFontSize(size).run();
                        }}
                        className="h-7 min-w-[78px] rounded border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        title="Schriftgröße"
                        aria-label="Schriftgröße wählen"
                    >
                        <option value="">Standard</option>
                        {FONT_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>

                    <select
                        value={selectedFontFamily}
                        onChange={(event) => {
                            const font = event.target.value;
                            const chain = editor.chain().focus();
                            if (!font) {
                                chain.unsetFontFamily().run();
                                return;
                            }
                            chain.setFontFamily(font).run();
                        }}
                        className="h-7 min-w-0 flex-1 sm:flex-none sm:min-w-[120px] max-w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        title="Schriftart"
                        aria-label="Schriftart wählen"
                    >
                        <optgroup label="Standard">
                            {FONT_FAMILY_OPTIONS.map((option) => (
                                <option key={option.label} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </optgroup>
                        {customFonts.length > 0 && (
                            <optgroup label="Eigene Schriftarten">
                                {customFonts.map((font) => (
                                    <option key={font.id} value={font.name}>
                                        {font.name}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                    </select>

                    <div className="hidden sm:block w-px h-4 bg-slate-200 mx-0.5" />

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

                    <div className="hidden sm:block w-px h-4 bg-slate-200 mx-0.5" />

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
                className="overflow-hidden rounded-b-lg px-3 py-2 text-sm text-worksheet-ink prose prose-sm max-w-none
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
            <Icon className={ICON_SIZES[14]} />
        </button>
    );
}
