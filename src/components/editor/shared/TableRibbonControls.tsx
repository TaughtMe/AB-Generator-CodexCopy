import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
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
    Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { ICON_SIZES } from '../../ui/iconSizes';
import { LineSpacingControl } from './LineSpacingControl';

/* ══════════════════════════════════════════════════
   TableRibbonControls – Tabellen-Werkzeuge im Ribbon
   („Tabellen"-Reiter). Ersetzt das frühere BubbleMenu,
   das mit dem Text-/Wortschatz-BubbleMenu kollidierte.

   Arbeitet auf dem global aktiven Editor (activeEditor).
   Die Steuerelemente sind nur aktiv, wenn der Cursor in
   einer Tabelle steht.
   ══════════════════════════════════════════════════ */

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

interface TableRibbonControlsProps {
    editor: Editor | null;
    /** Kompakt (ohne Gruppen-Beschriftungen, engere Abstände) für schmale Bildschirme. */
    compact?: boolean;
}

export function TableRibbonControls({ editor, compact = false }: TableRibbonControlsProps) {
    const [openMenu, setOpenMenu] = useState<'color' | 'border' | null>(null);
    const [selectedBorderWidth, setSelectedBorderWidth] = useState<string>('2px');
    const [selectedBorderColor, setSelectedBorderColor] = useState<string>('#000000');
    const containerRef = useRef<HTMLDivElement>(null);

    // Bei Cursor-/Selektionswechsel neu rendern, damit aktiv/verfügbar stimmt.
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!editor) return;
        const onUpdate = () => setTick((value) => value + 1);
        editor.on('transaction', onUpdate);
        editor.on('selectionUpdate', onUpdate);
        return () => {
            editor.off('transaction', onUpdate);
            editor.off('selectionUpdate', onUpdate);
        };
    }, [editor]);

    // Dropdowns bei Klick nach außen schließen.
    useEffect(() => {
        if (!openMenu) return;
        const handler = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpenMenu(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [openMenu]);

    const inTable = Boolean(editor && editor.isActive('table'));

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
            patch = { borderTop: borderValue, borderRight: borderValue, borderBottom: borderValue, borderLeft: borderValue };
        } else if (mode === 'none') {
            patch = { borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderLeft: 'none' };
        } else {
            patch = { [mode]: borderValue };
        }
        applyTableCellAttributes(patch);
        setOpenMenu(null);
    };

    const run = (fn: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => {
        if (!editor) return;
        fn(editor.chain().focus()).run();
    };

    if (!editor || !inTable) {
        return (
            <div className="flex items-center px-4 py-3 text-xs text-slate-400 dark:text-slate-500 min-h-[60px]">
                Klicke in eine Tabelle, um die Tabellen-Werkzeuge zu nutzen.
            </div>
        );
    }

    // Erst hier sicher: editor ist in einer Tabelle, also existieren die Tabellenbefehle.
    // (Vorher berechnet, warf z. B. auf dem Informationstext-Editor ohne Table-Extension
    // "mergeCells is not a function".)
    const canMerge = Boolean(editor.can().chain().focus().mergeCells().run());
    const canSplit = Boolean(editor.can().chain().focus().splitCell().run());
    const canHeaderRow = Boolean(editor.can().chain().focus().toggleHeaderRow().run());
    const canHeaderColumn = Boolean(editor.can().chain().focus().toggleHeaderColumn().run());

    return (
        <div
            ref={containerRef}
            className={clsx(
                'flex flex-wrap items-stretch justify-start px-1',
                compact
                    ? 'gap-y-1 pt-1 pb-1 [&_.ribbon-group-label]:hidden [&_.ribbon-group]:pr-2 [&_.ribbon-group]:mr-1'
                    : 'gap-y-2 pt-2 pb-1',
            )}
        >
            {/* ── Zellen: Farbe & Rahmen ── */}
            <RibbonGroup label="Zellen">
                <div className="relative">
                    <TBtn title="Zellfarbe" active={openMenu === 'color'} onClick={() => setOpenMenu((m) => (m === 'color' ? null : 'color'))}>
                        <Paintbrush className={ICON_SIZES[16]} />
                    </TBtn>
                    {openMenu === 'color' && (
                        <div
                            className="absolute top-full left-0 mt-1 z-50 min-w-[160px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 shadow-xl"
                            onMouseDown={(event) => event.preventDefault()}
                        >
                            {TABLE_COLOR_PRESETS.map((preset) => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => handleApplyColor(preset.value)}
                                    className="w-full px-2 py-1.5 rounded text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-2 text-left"
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
                    <TBtn title="Tabellenrahmen" active={openMenu === 'border'} onClick={() => setOpenMenu((m) => (m === 'border' ? null : 'border'))}>
                        <TableProperties className={ICON_SIZES[16]} />
                    </TBtn>
                    {openMenu === 'border' && (
                        <div
                            className="absolute top-full left-0 mt-1 z-50 w-[240px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-xl"
                            onMouseDown={(event) => event.preventDefault()}
                        >
                            <div className="space-y-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                                <div className="flex flex-wrap gap-1">
                                    {BORDER_WIDTH_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setSelectedBorderWidth(option.value)}
                                            className={clsx(
                                                'rounded border px-2 py-1 text-[11px] cursor-pointer',
                                                selectedBorderWidth === option.value
                                                    ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                                    : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700',
                                            )}
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
                                            className={clsx(
                                                'h-6 w-6 rounded border cursor-pointer',
                                                selectedBorderColor === option.value ? 'border-blue-500 ring-1 ring-blue-300' : 'border-slate-200 dark:border-slate-600',
                                            )}
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
                                            className="rounded border border-slate-200 dark:border-slate-600 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-1.5"
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
            </RibbonGroup>

            {/* ── Verbinden / Teilen ── */}
            <RibbonGroup label="Verbinden">
                <TBtn title="Zellen verbinden" disabled={!canMerge} onClick={() => run((c) => c.mergeCells())}>
                    <Combine className={ICON_SIZES[16]} />
                </TBtn>
                <TBtn title="Zelle teilen" disabled={!canSplit} onClick={() => run((c) => c.splitCell())}>
                    <Split className={ICON_SIZES[16]} />
                </TBtn>
            </RibbonGroup>

            {/* ── Kopfzeile / Kopfspalte ── */}
            <RibbonGroup label="Kopf">
                <TBtn title="Kopfzeile an/aus" disabled={!canHeaderRow} onClick={() => run((c) => c.toggleHeaderRow())}>
                    <PanelTop className={ICON_SIZES[16]} />
                </TBtn>
                <TBtn title="Kopfspalte an/aus" disabled={!canHeaderColumn} onClick={() => run((c) => c.toggleHeaderColumn())}>
                    <PanelLeft className={ICON_SIZES[16]} />
                </TBtn>
            </RibbonGroup>

            {/* ── Zeilenabstand ── */}
            <RibbonGroup label="Abstand">
                <LineSpacingControl editor={editor} />
            </RibbonGroup>

            {/* ── Zeilen ── */}
            <RibbonGroup label="Zeilen">
                <TBtn title="Zeile darunter einfügen" onClick={() => run((c) => c.addRowAfter())}>
                    <Plus className={ICON_SIZES[14]} />
                    <span className="ml-1 text-[11px]">Zeile</span>
                </TBtn>
                <TBtn title="Zeile löschen" onClick={() => run((c) => c.deleteRow())}>
                    <Trash2 className={ICON_SIZES[14]} />
                    <span className="ml-1 text-[11px]">Zeile</span>
                </TBtn>
            </RibbonGroup>

            {/* ── Spalten ── */}
            <RibbonGroup label="Spalten">
                <TBtn title="Spalte rechts einfügen" onClick={() => run((c) => c.addColumnAfter())}>
                    <Plus className={ICON_SIZES[14]} />
                    <span className="ml-1 text-[11px]">Spalte</span>
                </TBtn>
                <TBtn title="Spalte löschen" onClick={() => run((c) => c.deleteColumn())}>
                    <Trash2 className={ICON_SIZES[14]} />
                    <span className="ml-1 text-[11px]">Spalte</span>
                </TBtn>
            </RibbonGroup>

            {/* ── Tabelle ── */}
            <RibbonGroup label="Tabelle">
                <TBtn title="Tabelle löschen" onClick={() => run((c) => c.deleteTable())}>
                    <Trash2 className={ICON_SIZES[16]} />
                </TBtn>
            </RibbonGroup>
        </div>
    );
}

/* ─────────── Sub-Komponenten (Ribbon-Stil) ─────────── */

function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="ribbon-group flex shrink-0 flex-col items-center justify-start gap-y-1 self-stretch pr-4 mr-2 border-r border-slate-300 dark:border-slate-700 last:border-r-0 last:pr-0 last:mr-0">
            <div className="flex items-center gap-1">{children}</div>
            <span className="ribbon-group-label text-[10px] text-slate-400 text-center uppercase tracking-wider mt-auto pt-1">{label}</span>
        </div>
    );
}

function TBtn({
    children,
    title,
    onClick,
    active,
    disabled,
}: {
    children: ReactNode;
    title: string;
    onClick?: () => void;
    active?: boolean;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            onMouseDown={(event) => event.preventDefault()}
            disabled={disabled}
            className={clsx(
                'inline-flex items-center justify-center rounded transition-colors cursor-pointer h-8 min-w-8 px-1.5',
                active
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
                disabled && 'opacity-30 cursor-not-allowed',
            )}
        >
            {children}
        </button>
    );
}
