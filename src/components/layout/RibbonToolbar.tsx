import { useState, useRef, useEffect, type ReactNode } from 'react';
import {
    Home,
    Save,
    Undo2,
    Redo2,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Heading,
    AArrowUp,
    AArrowDown,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    List,
    ListOrdered,
    Indent,
    Outdent,
    Sparkles,
    Download,
    Moon,
    Sun,
    BookOpen,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useWorksheetStore } from '../../store/worksheetStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useFontStore } from '../../store/fontStore';
import { ColorPickerDropdown } from '../editor/ColorPickerDropdown';
import { FONT_SIZE_OPTIONS } from '../editor/tiptapFontSize';
import { ICON_SIZES } from '../ui/iconSizes';

/* ══════════════════════════════════════════════════
   RibbonToolbar – Zentrale Ribbon-Toolbar (MS-Word-Stil)
   Kombination aus App-Steuerung und kontextsensitiven
   Text-Werkzeugen, gesteuert über den globalen
   activeEditor-State.
   ══════════════════════════════════════════════════ */

type RibbonTab = 'allgemein' | 'tabellen' | 'sonderzeichen';

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

export interface RibbonToolbarProps {
    onBackToDashboard: () => void;
    onSave: () => Promise<void> | void;
    isSaving: boolean;
    hasTasks: boolean;
    onExportPdf: () => void;
    onExportDocx: () => void;
    onOpenSources: () => void;
}

export function RibbonToolbar({
    onBackToDashboard,
    onSave,
    isSaving,
    hasTasks,
    onExportPdf,
    onExportDocx,
    onOpenSources,
}: RibbonToolbarProps) {
    const [activeTab, setActiveTab] = useState<RibbonTab>('allgemein');
    const [showAiDropdown, setShowAiDropdown] = useState(false);
    const [showExportDropdown, setShowExportDropdown] = useState(false);
    const aiDropdownRef = useRef<HTMLDivElement>(null);
    const exportDropdownRef = useRef<HTMLDivElement>(null);

    const activeEditor = useWorkspaceStore((s) => s.activeEditor);
    const saveStatus = useWorksheetStore((s) => s.saveStatus);
    const themeMode = useSettingsStore((s) => s.themeMode);
    const toggleThemeMode = useSettingsStore((s) => s.toggleThemeMode);
    const customFonts = useFontStore((s) => s.customFonts);

    const hasUnsavedChanges = saveStatus === 'unsaved';
    const editorDisabled = !activeEditor;

    // Close dropdowns on outside click
    useEffect(() => {
        if (!showAiDropdown && !showExportDropdown) return;
        const handler = (e: MouseEvent) => {
            if (showAiDropdown && aiDropdownRef.current && !aiDropdownRef.current.contains(e.target as Node)) {
                setShowAiDropdown(false);
            }
            if (showExportDropdown && exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
                setShowExportDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showAiDropdown, showExportDropdown]);

    // Force re-render on editor transaction to update active states
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!activeEditor) return;
        const onTransaction = () => setTick((t) => t + 1);
        activeEditor.on('transaction', onTransaction);
        return () => { activeEditor.off('transaction', onTransaction); };
    }, [activeEditor]);

    /* ── Helper: Textfarbwert lesen ── */
    const textColor = activeEditor
        ? normalizeColorForInput(
            (activeEditor.getAttributes('textStyle') as { color?: string }).color,
          )
        : '#000000';

    const selectedFontSize = activeEditor
        ? ((activeEditor.getAttributes('textStyle') as { fontSize?: string }).fontSize ?? '')
        : '';

    const selectedFontFamily = activeEditor
        ? ((activeEditor.getAttributes('textStyle') as { fontFamily?: string }).fontFamily ?? '')
        : '';

    return (
        <div className="no-print sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm select-none">
            {/* ── Tab-Header ── */}
            <div className="flex items-center gap-0 border-b border-slate-200 dark:border-slate-700 px-2">
                {(['allgemein', 'tabellen', 'sonderzeichen'] as RibbonTab[]).map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={clsx(
                            'px-4 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer min-h-[44px] min-w-[44px]',
                            activeTab === tab
                                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
                        )}
                    >
                        {tab === 'sonderzeichen' ? 'Sonderzeich.' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* ── Ribbon Body (Allgemein tab) ── */}
            {activeTab === 'allgemein' && (
                <div className="flex flex-wrap items-center justify-start gap-0 px-1 py-0.5">
                    {/* ─── Block 1: Home + Speichern ─── */}
                    <RibbonGroup>
                        <RibbonBtn
                            title="Dashboard"
                            onClick={onBackToDashboard}
                        >
                            <Home className={ICON_SIZES[18]} />
                        </RibbonBtn>
                        <RibbonBtn
                            title={isSaving ? 'Speichert…' : 'Speichern'}
                            onClick={onSave}
                            disabled={isSaving}
                        >
                            <Save className={clsx(
                                ICON_SIZES[18],
                                hasUnsavedChanges ? 'text-red-500' : 'text-green-500',
                            )} />
                        </RibbonBtn>
                    </RibbonGroup>

                    <RibbonDivider />

                    {/* ─── Block 2: Undo / Redo ─── */}
                    <RibbonGroup disabled={editorDisabled}>
                        <RibbonBtn
                            title="Rückgängig (Ctrl+Z)"
                            onClick={() => activeEditor?.chain().focus().undo().run()}
                            disabled={editorDisabled || !activeEditor?.can().undo()}
                        >
                            <Undo2 className={ICON_SIZES[16]} />
                        </RibbonBtn>
                        <RibbonBtn
                            title="Wiederholen (Ctrl+Y)"
                            onClick={() => activeEditor?.chain().focus().redo().run()}
                            disabled={editorDisabled || !activeEditor?.can().redo()}
                        >
                            <Redo2 className={ICON_SIZES[16]} />
                        </RibbonBtn>
                    </RibbonGroup>

                    <RibbonDivider />

                    {/* ─── Block 3 (2-zeilig): Textstile ─── */}
                    <RibbonGroup disabled={editorDisabled}>
                        <div className="flex flex-col gap-0.5">
                            {/* Reihe 1: B I U S */}
                            <div className="flex items-center gap-0.5">
                                <RibbonBtn
                                    title="Fett (Ctrl+B)"
                                    active={activeEditor?.isActive('bold')}
                                    onClick={() => activeEditor?.chain().focus().toggleBold().run()}
                                    disabled={editorDisabled}
                                >
                                    <Bold className={ICON_SIZES[14]} />
                                </RibbonBtn>
                                <RibbonBtn
                                    title="Kursiv (Ctrl+I)"
                                    active={activeEditor?.isActive('italic')}
                                    onClick={() => activeEditor?.chain().focus().toggleItalic().run()}
                                    disabled={editorDisabled}
                                >
                                    <Italic className={ICON_SIZES[14]} />
                                </RibbonBtn>
                                <RibbonBtn
                                    title="Unterstrichen (Ctrl+U)"
                                    active={activeEditor?.isActive('underline')}
                                    onClick={() => activeEditor?.chain().focus().toggleUnderline().run()}
                                    disabled={editorDisabled}
                                >
                                    <Underline className={ICON_SIZES[14]} />
                                </RibbonBtn>
                                <RibbonBtn
                                    title="Durchgestrichen"
                                    active={activeEditor?.isActive('strike')}
                                    onClick={() => activeEditor?.chain().focus().toggleStrike().run()}
                                    disabled={editorDisabled}
                                >
                                    <Strikethrough className={ICON_SIZES[14]} />
                                </RibbonBtn>
                            </div>
                            {/* Reihe 2: H, A+, A-, Farbe, Schriftart, Schriftgröße */}
                            <div className="flex items-center gap-0.5">
                                <RibbonBtn
                                    title="Überschrift"
                                    active={activeEditor?.isActive('heading')}
                                    onClick={() => activeEditor?.chain().focus().toggleHeading({ level: 2 }).run()}
                                    disabled={editorDisabled}
                                >
                                    <Heading className={ICON_SIZES[14]} />
                                </RibbonBtn>
                                <RibbonBtn
                                    title="Größer"
                                    onClick={() => {
                                        if (!activeEditor) return;
                                        const current = (activeEditor.getAttributes('textStyle') as { fontSize?: string }).fontSize ?? '12pt';
                                        const idx = FONT_SIZE_OPTIONS.indexOf(current as typeof FONT_SIZE_OPTIONS[number]);
                                        const next = FONT_SIZE_OPTIONS[Math.min((idx < 0 ? 2 : idx) + 1, FONT_SIZE_OPTIONS.length - 1)];
                                        activeEditor.chain().focus().setFontSize(next).run();
                                    }}
                                    disabled={editorDisabled}
                                >
                                    <AArrowUp className={ICON_SIZES[14]} />
                                </RibbonBtn>
                                <RibbonBtn
                                    title="Kleiner"
                                    onClick={() => {
                                        if (!activeEditor) return;
                                        const current = (activeEditor.getAttributes('textStyle') as { fontSize?: string }).fontSize ?? '12pt';
                                        const idx = FONT_SIZE_OPTIONS.indexOf(current as typeof FONT_SIZE_OPTIONS[number]);
                                        const next = FONT_SIZE_OPTIONS[Math.max((idx < 0 ? 2 : idx) - 1, 0)];
                                        activeEditor.chain().focus().setFontSize(next).run();
                                    }}
                                    disabled={editorDisabled}
                                >
                                    <AArrowDown className={ICON_SIZES[14]} />
                                </RibbonBtn>
                                <ColorPickerDropdown
                                    value={textColor}
                                    onChange={(color) => activeEditor?.chain().focus().setColor(color).run()}
                                    title="Textfarbe"
                                />
                                {/* Schriftgröße Dropdown */}
                                <select
                                    value={selectedFontSize}
                                    onChange={(e) => {
                                        const size = e.target.value;
                                        if (!activeEditor) return;
                                        const chain = activeEditor.chain().focus();
                                        if (!size) { chain.unsetFontSize().run(); return; }
                                        chain.setFontSize(size).run();
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    disabled={editorDisabled}
                                    className="h-7 min-w-[68px] rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-1 text-[11px] text-slate-600 dark:text-slate-300 disabled:opacity-50"
                                    aria-label="Schriftgröße"
                                >
                                    <option value="">Std.</option>
                                    {FONT_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                                {/* Schriftart Dropdown */}
                                <select
                                    value={selectedFontFamily}
                                    onChange={(e) => {
                                        const font = e.target.value;
                                        if (!activeEditor) return;
                                        const chain = activeEditor.chain().focus();
                                        if (!font) { chain.unsetFontFamily().run(); return; }
                                        chain.setFontFamily(font).run();
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    disabled={editorDisabled}
                                    className="h-7 min-w-[90px] max-w-[130px] rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-1 text-[11px] text-slate-600 dark:text-slate-300 disabled:opacity-50"
                                    aria-label="Schriftart"
                                >
                                    <optgroup label="Standard">
                                        {FONT_FAMILY_OPTIONS.map((o) => <option key={o.label} value={o.value}>{o.label}</option>)}
                                    </optgroup>
                                    {customFonts.length > 0 && (
                                        <optgroup label="Eigene">
                                            {customFonts.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                        </div>
                    </RibbonGroup>

                    <RibbonDivider />

                    {/* ─── Block 4 (2-zeilig): Ausrichtung + Listen ─── */}
                    <RibbonGroup disabled={editorDisabled}>
                        <div className="flex flex-col gap-0.5">
                            {/* Reihe 1: Ausrichtung */}
                            <div className="flex items-center gap-0.5">
                                <RibbonBtn
                                    title="Linksbündig"
                                    active={activeEditor?.isActive({ textAlign: 'left' })}
                                    onClick={() => activeEditor?.chain().focus().setTextAlign('left').run()}
                                    disabled={editorDisabled}
                                >
                                    <AlignLeft className={ICON_SIZES[14]} />
                                </RibbonBtn>
                                <RibbonBtn
                                    title="Zentriert"
                                    active={activeEditor?.isActive({ textAlign: 'center' })}
                                    onClick={() => activeEditor?.chain().focus().setTextAlign('center').run()}
                                    disabled={editorDisabled}
                                >
                                    <AlignCenter className={ICON_SIZES[14]} />
                                </RibbonBtn>
                                <RibbonBtn
                                    title="Rechtsbündig"
                                    active={activeEditor?.isActive({ textAlign: 'right' })}
                                    onClick={() => activeEditor?.chain().focus().setTextAlign('right').run()}
                                    disabled={editorDisabled}
                                >
                                    <AlignRight className={ICON_SIZES[14]} />
                                </RibbonBtn>
                                <RibbonBtn
                                    title="Blocksatz"
                                    active={activeEditor?.isActive({ textAlign: 'justify' })}
                                    onClick={() => activeEditor?.chain().focus().setTextAlign('justify').run()}
                                    disabled={editorDisabled}
                                >
                                    <AlignJustify className={ICON_SIZES[14]} />
                                </RibbonBtn>
                            </div>
                            {/* Reihe 2: Listen + Einrückung */}
                            <div className="flex items-center gap-0.5">
                                <RibbonBtn
                                    title="Aufzählung"
                                    active={activeEditor?.isActive('bulletList')}
                                    onClick={() => activeEditor?.chain().focus().toggleBulletList().run()}
                                    disabled={editorDisabled}
                                >
                                    <List className={ICON_SIZES[14]} />
                                </RibbonBtn>
                                <RibbonBtn
                                    title="Nummerierte Liste"
                                    active={activeEditor?.isActive('orderedList')}
                                    onClick={() => activeEditor?.chain().focus().toggleOrderedList().run()}
                                    disabled={editorDisabled}
                                >
                                    <ListOrdered className={ICON_SIZES[14]} />
                                </RibbonBtn>
                                <RibbonBtn
                                    title="Einrücken"
                                    onClick={() => activeEditor?.chain().focus().sinkListItem('listItem').run()}
                                    disabled={editorDisabled}
                                >
                                    <Indent className={ICON_SIZES[14]} />
                                </RibbonBtn>
                                <RibbonBtn
                                    title="Ausrücken"
                                    onClick={() => activeEditor?.chain().focus().liftListItem('listItem').run()}
                                    disabled={editorDisabled}
                                >
                                    <Outdent className={ICON_SIZES[14]} />
                                </RibbonBtn>
                            </div>
                        </div>
                    </RibbonGroup>

                    <RibbonDivider />

                    {/* ─── Block 5: KI-Button ─── */}
                    <RibbonGroup>
                        <div className="relative" ref={aiDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setShowAiDropdown(!showAiDropdown)}
                                onMouseDown={(e) => e.preventDefault()}
                                className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg min-h-[56px] min-w-[56px] transition-colors cursor-pointer bg-gradient-to-b from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white shadow"
                                title="KI-Assistent"
                            >
                                <Sparkles className={ICON_SIZES[20]} />
                                <span className="text-[10px] font-medium leading-none">KI</span>
                            </button>
                            {showAiDropdown && (
                                <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1">
                                    <DropdownItem onClick={() => { setShowAiDropdown(false); }}>
                                        Text vereinfachen
                                    </DropdownItem>
                                    <DropdownItem onClick={() => { setShowAiDropdown(false); }}>
                                        Korrigieren
                                    </DropdownItem>
                                </div>
                            )}
                        </div>
                    </RibbonGroup>

                    <RibbonDivider />

                    {/* ─── Block 6: Export-Dropdown + Quellen ─── */}
                    <RibbonGroup>
                        <div className="relative" ref={exportDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setShowExportDropdown(!showExportDropdown)}
                                onMouseDown={(e) => e.preventDefault()}
                                disabled={!hasTasks}
                                className={clsx(
                                    'inline-flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg min-h-[56px] min-w-[56px] transition-colors cursor-pointer',
                                    'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
                                    !hasTasks && 'opacity-30 cursor-not-allowed',
                                )}
                                title="Exportieren"
                            >
                                <Download className={ICON_SIZES[18]} />
                                <span className="text-[10px] font-medium leading-none">Export</span>
                            </button>
                            {showExportDropdown && (
                                <div className="absolute top-full left-0 mt-1 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1">
                                    <DropdownItem onClick={() => { setShowExportDropdown(false); onExportPdf(); }}>
                                        Als PDF herunterladen
                                    </DropdownItem>
                                    <DropdownItem onClick={() => { setShowExportDropdown(false); onExportDocx(); }}>
                                        Als Word (DOCX) herunterladen
                                    </DropdownItem>
                                </div>
                            )}
                        </div>
                        <RibbonBtn
                            title="Quellen verwalten"
                            onClick={onOpenSources}
                        >
                            <BookOpen className={ICON_SIZES[14]} />
                        </RibbonBtn>
                    </RibbonGroup>

                    <RibbonDivider />

                    {/* ─── Block 7: Dark/Light Mode ─── */}
                    <RibbonGroup>
                        <RibbonBtn
                            title={themeMode === 'dark' ? 'Helles Design' : 'Dunkles Design'}
                            onClick={toggleThemeMode}
                        >
                            {themeMode === 'dark'
                                ? <Sun className={ICON_SIZES[18]} />
                                : <Moon className={ICON_SIZES[18]} />
                            }
                        </RibbonBtn>
                    </RibbonGroup>
                </div>
            )}

            {/* ── Tabellen Tab (Platzhalter) ── */}
            {activeTab === 'tabellen' && (
                <div className="flex items-center px-4 py-3 text-xs text-slate-400 dark:text-slate-500 min-h-[60px]">
                    Tabellen-Werkzeuge – demnächst verfügbar
                </div>
            )}

            {/* ── Sonderzeichen Tab (Platzhalter) ── */}
            {activeTab === 'sonderzeichen' && (
                <div className="flex items-center px-4 py-3 text-xs text-slate-400 dark:text-slate-500 min-h-[60px]">
                    Sonderzeichen – demnächst verfügbar
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════
   Primitive Sub-Components
   ═══════════════════════════════════════════════ */

/** Vertikale Trennlinie zwischen Blöcken */
function RibbonDivider() {
    return <div className="w-px self-stretch bg-slate-200 dark:bg-slate-700 mx-0.5" />;
}

/** Wrapper für einen logischen Block, optional mit Opacity-Deaktivierung */
function RibbonGroup({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
    return (
        <div
            className={clsx(
                'flex items-center gap-px px-1 py-0.5',
                disabled && 'opacity-50 pointer-events-none',
            )}
        >
            {children}
        </div>
    );
}

/** Einzelner Ribbon-Button mit Apple-HIG Touch-Targets und Fokus-Schutz */
interface RibbonBtnProps {
    children: ReactNode;
    title: string;
    onClick?: () => void;
    active?: boolean;
    disabled?: boolean;
}

function RibbonBtn({ children, title, onClick, active, disabled }: RibbonBtnProps) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            onMouseDown={(e) => e.preventDefault()}
            disabled={disabled}
            className={clsx(
                'inline-flex items-center justify-center rounded transition-colors cursor-pointer',
                'min-h-[44px] min-w-[44px] p-1.5',
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

/** Dropdown-Item für KI-Menü */
function DropdownItem({ children, onClick }: { children: ReactNode; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            onMouseDown={(e) => e.preventDefault()}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer min-h-[44px]"
        >
            {children}
        </button>
    );
}
