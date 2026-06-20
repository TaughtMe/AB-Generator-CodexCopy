import { useEffect, useRef, useState, type ElementType } from 'react';
import { BubbleMenu, type Editor } from '@tiptap/react';
import {
    Combine,
    Eraser,
    Paintbrush,
    PanelBottom,
    PanelLeft,
    PanelRight,
    PanelTop,
    Plus,
    Split,
    TableProperties,
} from 'lucide-react';
import { useWorksheetStore } from '../../store/worksheetStore';
import type { TableTask } from '../../types/worksheet';
import { RichTextEditor } from '../editor/RichTextEditor';
import { VocabularyList } from '../editor/shared/VocabularyList';
import { ICON_SIZES } from '../ui/iconSizes';

function containsTableMarkup(html: string): boolean {
    return /<table[\s>]/i.test(html);
}

interface TableEditorProps {
    task: TableTask;
    isActive?: boolean;
}

const TABLE_COLOR_PRESETS: Array<{ label: string; value: string | null; swatchClass: string }> = [
    { label: 'Ohne Farbe', value: null, swatchClass: 'bg-white' },
    { label: 'Blau Pastell', value: '#dbeafe', swatchClass: 'bg-blue-100' },
    { label: 'Grün Pastell', value: '#dcfce7', swatchClass: 'bg-green-100' },
    { label: 'Gelb Pastell', value: '#fef9c3', swatchClass: 'bg-yellow-100' },
    { label: 'Rosé Pastell', value: '#fce7f3', swatchClass: 'bg-pink-100' },
];

const BORDER_WIDTH_OPTIONS: Array<{ label: string; value: string }> = [
    { label: 'Fein (1px)', value: '1px' },
    { label: 'Mittel (2px)', value: '2px' },
    { label: 'Dick (3px)', value: '3px' },
];
const BORDER_COLOR_OPTIONS: Array<{ label: string; value: string }> = [
    { label: 'Schwarz', value: '#000000' },
    { label: 'Grau', value: '#64748b' },
    { label: 'Blau', value: '#2563eb' },
    { label: 'Grün', value: '#15803d' },
    { label: 'Rot', value: '#b91c1c' },
];

type BorderSideKey = 'borderTop' | 'borderRight' | 'borderBottom' | 'borderLeft';
type BorderApplyMode = 'all' | 'none' | BorderSideKey;

const BORDER_ACTIONS: Array<{ mode: BorderApplyMode; label: string; icon: ElementType }> = [
    { mode: 'all', label: 'Alle Rahmenlinien', icon: TableProperties },
    { mode: 'none', label: 'Keine Rahmenlinie', icon: Eraser },
    { mode: 'borderTop', label: 'Nur Oben', icon: PanelTop },
    { mode: 'borderBottom', label: 'Nur Unten', icon: PanelBottom },
    { mode: 'borderLeft', label: 'Nur Links', icon: PanelLeft },
    { mode: 'borderRight', label: 'Nur Rechts', icon: PanelRight },
];

type CellStylePatch = {
    backgroundColor?: string | null;
    borderTop?: string | null;
    borderRight?: string | null;
    borderBottom?: string | null;
    borderLeft?: string | null;
};

export function TableEditor({ task, isActive = true }: TableEditorProps) {
    const updateTask = useWorksheetStore((state) => state.updateTask);
    const [editor, setEditor] = useState<Editor | null>(null);
    const didAutoInitRef = useRef(false);
    const [openMenu, setOpenMenu] = useState<'color' | 'border' | null>(null);
    const [selectedBorderWidth, setSelectedBorderWidth] = useState<string>('2px');
    const [selectedBorderColor, setSelectedBorderColor] = useState<string>('#000000');

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

    useEffect(() => {
        if (isActive) return;
        setOpenMenu(null);
    }, [isActive]);

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

    const applyBorderMode = (mode: BorderApplyMode) => {
        const borderValue = `${selectedBorderWidth} solid ${selectedBorderColor}`;
        let patch: CellStylePatch;

        if (mode === 'all') {
            patch = {
                borderTop: borderValue,
                borderRight: borderValue,
                borderBottom: borderValue,
                borderLeft: borderValue,
            };
        } else if (mode === 'none') {
            patch = {
                borderTop: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                borderLeft: 'none',
            };
        } else {
            patch = { [mode]: borderValue };
        }

        applyTableCellAttributes(patch);
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
                    shouldShow={({ editor: currentEditor }) => isActive && currentEditor.isActive('table')}
                    tippyOptions={{
                        duration: 120,
                        placement: 'top',
                        offset: [0, 8],
                        interactive: true,
                        zIndex: 99999,
                        appendTo: () => document.getElementById('root') || document.body,
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
                                title="Tabellenrahmen"
                                aria-label="Tabellenrahmen"
                            >
                                <TableProperties className={ICON_SIZES[14]} />
                            </button>

                            {openMenu === 'border' && (
                                <div
                                    className="absolute top-8 left-0 z-20 w-[230px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
                                    onMouseDown={(event) => event.preventDefault()}
                                >
                                    <div className="space-y-2 border-b border-slate-100 pb-2">
                                        <div className="flex flex-wrap gap-1">
                                            {BORDER_WIDTH_OPTIONS.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setSelectedBorderWidth(option.value)}
                                                    className={`rounded border px-2 py-1 text-[11px] cursor-pointer ${
                                                        selectedBorderWidth === option.value
                                                            ? 'border-blue-400 bg-blue-50 text-blue-700'
                                                            : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                                                    }`}
                                                    title={option.label}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1">
                                            {BORDER_COLOR_OPTIONS.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setSelectedBorderColor(option.value)}
                                                    className={`h-6 w-6 rounded border cursor-pointer ${
                                                        selectedBorderColor === option.value ? 'border-blue-500 ring-1 ring-blue-300' : 'border-slate-200'
                                                    }`}
                                                    style={{ backgroundColor: option.value }}
                                                    title={option.label}
                                                    aria-label={option.label}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-2 grid grid-cols-2 gap-1">
                                        {BORDER_ACTIONS.map((action) => {
                                            const ActionIcon = action.icon;
                                            return (
                                                <button
                                                    key={action.mode}
                                                    type="button"
                                                    onClick={() => applyBorderMode(action.mode)}
                                                    className="rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
                                                    title={action.label}
                                                >
                                                    <ActionIcon className={ICON_SIZES[14]} />
                                                    <span className="truncate">{action.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
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
                    // min-w-0: ohne dies überläuft das Flex-Item bei breiter Tabelle seinen
                    // Container (Tabelle verlässt das Modul). Mit min-w-0 wird der .tableWrapper
                    // zur Scroll-Grenze → die Tabelle bleibt im Editorbereich.
                    className="flex-1 min-w-0"
                    hideToolbar={!isActive}
                    taskId={task.id}
                />

                {isActive && (
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
                )}
            </div>

            {isActive && (
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
            )}

            <VocabularyList vocabulary={task.vocabulary} taskId={task.id} />
        </div>
    );
}
