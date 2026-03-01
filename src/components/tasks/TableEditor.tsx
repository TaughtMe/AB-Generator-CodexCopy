import { useEffect, useRef, useState } from 'react';
import { BubbleMenu, type Editor } from '@tiptap/react';
import { Combine, Paintbrush, PanelLeft, PanelTop, Plus, Split, TableProperties } from 'lucide-react';
import { useWorksheetStore } from '../../store/worksheetStore';
import type { TableTask } from '../../types/worksheet';
import { RichTextEditor } from '../editor/RichTextEditor';
import { ICON_SIZES } from '../ui/iconSizes';

function containsTableMarkup(html: string): boolean {
    return /<table[\s>]/i.test(html);
}

interface TableEditorProps {
    task: TableTask;
}

const TABLE_COLOR_PRESETS: Array<{ label: string; value: string | null; swatchClass: string }> = [
    { label: 'Ohne Farbe', value: null, swatchClass: 'bg-white' },
    { label: 'Blau Pastell', value: '#dbeafe', swatchClass: 'bg-blue-100' },
    { label: 'Grün Pastell', value: '#dcfce7', swatchClass: 'bg-green-100' },
    { label: 'Gelb Pastell', value: '#fef9c3', swatchClass: 'bg-yellow-100' },
    { label: 'Rosé Pastell', value: '#fce7f3', swatchClass: 'bg-pink-100' },
];

const BORDER_WIDTH_OPTIONS: Array<{ label: string; value: string | null }> = [
    { label: 'Standard', value: null },
    { label: 'Mittel (2px)', value: '2px' },
    { label: 'Dick (3px)', value: '3px' },
];

type CellStylePatch = {
    backgroundColor?: string | null;
    borderWidth?: string | null;
};

export function TableEditor({ task }: TableEditorProps) {
    const updateTask = useWorksheetStore((state) => state.updateTask);
    const [editor, setEditor] = useState<Editor | null>(null);
    const didAutoInitRef = useRef(false);
    const [openMenu, setOpenMenu] = useState<'color' | 'border' | null>(null);

    useEffect(() => {
        if (!editor) return;
        if (didAutoInitRef.current) return;

        const hasTableInDom = editor.view.dom.querySelector('table') !== null;
        const hasTableInContent = containsTableMarkup(task.content);
        const hasExistingTable = hasTableInDom || hasTableInContent || editor.isActive('table');
        const isEditorEmpty = editor.getText().trim().length === 0;

        if (!hasExistingTable && isEditorEmpty) {
            editor.chain().focus().insertTable({
                rows: 3,
                cols: 3,
                withHeaderRow: true,
            }).run();
        }

        didAutoInitRef.current = true;
    }, [editor, task.content]);

    useEffect(() => {
        if (!editor) return;

        const closeMenuWhenSelectionChanges = () => {
            if (!editor.isActive('table')) {
                setOpenMenu(null);
            }
        };
        const closeMenuOnBlur = () => {
            setOpenMenu(null);
        };

        editor.on('selectionUpdate', closeMenuWhenSelectionChanges);
        editor.on('blur', closeMenuOnBlur);

        return () => {
            editor.off('selectionUpdate', closeMenuWhenSelectionChanges);
            editor.off('blur', closeMenuOnBlur);
        };
    }, [editor]);

    const applyTableCellAttributes = (patch: CellStylePatch) => {
        if (!editor) return;
        editor
            .chain()
            .focus()
            .updateAttributes('tableCell', patch)
            .updateAttributes('tableHeader', patch)
            .run();
    };

    const handleApplyColor = (color: string | null) => {
        applyTableCellAttributes({ backgroundColor: color });
        setOpenMenu(null);
    };

    const handleApplyBorderWidth = (width: string | null) => {
        applyTableCellAttributes({ borderWidth: width });
        setOpenMenu(null);
    };

    const handleMergeCells = () => {
        if (!editor) return;
        setOpenMenu(null);
        editor.chain().focus().mergeCells().run();
    };

    const handleSplitCell = () => {
        if (!editor) return;
        setOpenMenu(null);
        editor.chain().focus().splitCell().run();
    };

    const handleToggleHeaderRow = () => {
        if (!editor) return;
        setOpenMenu(null);
        editor.chain().focus().toggleHeaderRow().run();
    };

    const handleToggleHeaderColumn = () => {
        if (!editor) return;
        setOpenMenu(null);
        editor.chain().focus().toggleHeaderColumn().run();
    };

    const handleAddRowAfter = () => {
        if (!editor) return;
        editor.chain().focus().addRowAfter().run();
    };

    const handleAddColumnAfter = () => {
        if (!editor) return;
        editor.chain().focus().addColumnAfter().run();
    };

    const canMutateTable = Boolean(editor && editor.isActive('table'));
    const canMergeCells = Boolean(editor?.can().chain().focus().mergeCells().run());
    const canSplitCell = Boolean(editor?.can().chain().focus().splitCell().run());
    const canToggleHeaderRow = Boolean(editor?.can().chain().focus().toggleHeaderRow().run());
    const canToggleHeaderColumn = Boolean(editor?.can().chain().focus().toggleHeaderColumn().run());

    return (
        <div className="w-full flex flex-col gap-2">
            {editor && (
                <BubbleMenu
                    editor={editor}
                    shouldShow={({ editor: currentEditor }) => currentEditor.isActive('table')}
                    tippyOptions={{
                        duration: 120,
                        placement: 'top',
                        offset: [0, 8],
                        interactive: true,
                    }}
                >
                    <div className="no-print flex items-center gap-1 rounded-xl border border-slate-200/70 bg-white/80 px-1.5 py-1 shadow-md backdrop-blur-md">
                        {/* Farbe & Rahmen */}
                        <div className="relative">
                            <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => setOpenMenu((current) => (current === 'color' ? null : 'color'))}
                                className="h-7 w-7 rounded-md text-slate-600 hover:bg-slate-200/80 flex items-center justify-center transition-colors cursor-pointer"
                                title="Zellfarbe"
                                aria-label="Zellfarbe"
                            >
                                <Paintbrush className={ICON_SIZES[14]} />
                            </button>

                            {openMenu === 'color' && (
                                <div
                                    className="absolute top-8 left-0 z-20 min-w-[160px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
                                    onMouseDown={(event) => event.preventDefault()}
                                >
                                    {TABLE_COLOR_PRESETS.map((preset) => (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => handleApplyColor(preset.value)}
                                            className="w-full px-2 py-1.5 rounded text-xs text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-2 text-left"
                                            title={preset.label}
                                        >
                                            <span className={`h-3 w-3 rounded-full border border-slate-300 ${preset.swatchClass}`} />
                                            <span>{preset.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => setOpenMenu((current) => (current === 'border' ? null : 'border'))}
                                className="h-7 w-7 rounded-md text-slate-600 hover:bg-slate-200/80 flex items-center justify-center transition-colors cursor-pointer"
                                title="Rahmenstärke"
                                aria-label="Rahmenstärke"
                            >
                                <TableProperties className={ICON_SIZES[14]} />
                            </button>

                            {openMenu === 'border' && (
                                <div
                                    className="absolute top-8 left-0 z-20 min-w-[170px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
                                    onMouseDown={(event) => event.preventDefault()}
                                >
                                    {BORDER_WIDTH_OPTIONS.map((option) => (
                                        <button
                                            key={option.label}
                                            type="button"
                                            onClick={() => handleApplyBorderWidth(option.value)}
                                            className="w-full px-2 py-1.5 rounded text-xs text-slate-700 hover:bg-slate-100 cursor-pointer text-left"
                                            title={option.label}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="w-px h-4 bg-slate-300 mx-1" />

                        {/* Merge & Split */}
                        <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={handleMergeCells}
                            disabled={!canMergeCells}
                            className="h-7 w-7 rounded-md text-slate-600 hover:bg-slate-200/80 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Zellen verbinden"
                            aria-label="Zellen verbinden"
                        >
                            <Combine className={ICON_SIZES[14]} />
                        </button>

                        <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={handleSplitCell}
                            disabled={!canSplitCell}
                            className="h-7 w-7 rounded-md text-slate-600 hover:bg-slate-200/80 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Zelle teilen"
                            aria-label="Zelle teilen"
                        >
                            <Split className={ICON_SIZES[14]} />
                        </button>

                        <div className="w-px h-4 bg-slate-300 mx-1" />

                        {/* Headers */}
                        <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={handleToggleHeaderRow}
                            disabled={!canToggleHeaderRow}
                            className="h-7 w-7 rounded-md text-slate-600 hover:bg-slate-200/80 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Kopfzeile an/aus"
                            aria-label="Kopfzeile an/aus"
                        >
                            <PanelTop className={ICON_SIZES[14]} />
                        </button>

                        <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={handleToggleHeaderColumn}
                            disabled={!canToggleHeaderColumn}
                            className="h-7 w-7 rounded-md text-slate-600 hover:bg-slate-200/80 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Kopfspalte an/aus"
                            aria-label="Kopfspalte an/aus"
                        >
                            <PanelLeft className={ICON_SIZES[14]} />
                        </button>
                    </div>
                </BubbleMenu>
            )}

            <div className="flex flex-row items-center gap-2">
                <RichTextEditor
                    value={task.content}
                    onChange={(html) => updateTask(task.id, { content: html })}
                    onEditorReady={setEditor}
                    placeholder="Tabelleninhalt eingeben…"
                    minRows={4}
                    className="flex-1"
                />

                <button
                    type="button"
                    onClick={handleAddColumnAfter}
                    title="Spalte hinzufügen"
                    aria-label="Spalte hinzufügen"
                    disabled={!canMutateTable}
                    className="no-print flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Plus className={ICON_SIZES[14]} />
                </button>
            </div>

            <div className="no-print flex justify-center">
                <button
                    type="button"
                    onClick={handleAddRowAfter}
                    title="Zeile hinzufügen"
                    aria-label="Zeile hinzufügen"
                    disabled={!canMutateTable}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Plus className={ICON_SIZES[14]} />
                </button>
            </div>
        </div>
    );
}
