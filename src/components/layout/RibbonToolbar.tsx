import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Home,
    Save,
    ChevronDown,
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
    Loader2,
    Moon,
    Sun,
    BookOpen,
    Crop,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from 'zustand';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useWorksheetStore } from '../../store/worksheetStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useFontStore } from '../../store/fontStore';
import type { ImagePlaceholderTask } from '../../types/worksheet';
import { FONT_SIZE_OPTIONS } from '../editor/tiptapFontSize';
import type { ExportVariant } from '../editor/ExportMenu';
import { ICON_SIZES } from '../ui/iconSizes';
import { ColorPickerButton } from '../ui/ColorPickerButton';
import { SaveAsModal } from '../ui/SaveAsModal';

/* ══════════════════════════════════════════════════
   RibbonToolbar – Zentrale Ribbon-Toolbar (MS-Word-Stil)
   Kombination aus App-Steuerung und kontextsensitiven
   Text-Werkzeugen, gesteuert über den globalen
   activeEditor-State.
   ══════════════════════════════════════════════════ */

type RibbonTab = 'Allgemein' | 'Tabellen' | 'Sonderzeich.' | 'Bildformat';

interface ToolbarBlock {
    label: string;
    content: ReactNode;
    hideLabel?: boolean;
    disabled?: boolean;
    className?: string;
}

const FONT_FAMILY_OPTIONS = [
    { label: 'Standard', value: '' },
    { label: 'Arial', value: 'Arial' },
    { label: 'Times New Roman', value: 'Times New Roman' },
    { label: 'Comic Sans MS', value: 'Comic Sans MS' },
];

export interface RibbonToolbarProps {
    onBackToDashboard: () => void;
    onSave: () => Promise<void> | void;
    isSaving: boolean;
    hasTasks: boolean;
    isExporting?: boolean;
    onExportPdf: (variants: ExportVariant[]) => Promise<void> | void;
    onExportDocx: (variants: ExportVariant[]) => Promise<void> | void;
    onOpenSources: () => void;
}

export function RibbonToolbar({
    onBackToDashboard,
    onSave,
    isSaving,
    hasTasks,
    isExporting = false,
    onExportPdf,
    onExportDocx,
    onOpenSources,
}: RibbonToolbarProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<RibbonTab>('Allgemein');
    const [showAiDropdown, setShowAiDropdown] = useState(false);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const aiDropdownRef = useRef<HTMLDivElement>(null);
    const exportDropdownRef = useRef<HTMLDivElement>(null);
    const saveDropdownRef = useRef<HTMLDivElement>(null);

    const activeEditor = useWorkspaceStore((s) => s.activeEditor);
    const updateTask = useWorkspaceStore((s) => s.updateTask);
    const isFirstSave = useWorkspaceStore((s) => s.isFirstSave);
    const saveCurrentDocument = useWorkspaceStore((s) => s.saveCurrentDocument);
    const saveStatus = useWorksheetStore((s) => s.saveStatus);
    const activeTaskId = useWorksheetStore((s) => s.activeTaskId);
    const tasksById = useWorksheetStore((s) => s.tasksById);
    const themeMode = useSettingsStore((s) => s.themeMode);
    const toggleThemeMode = useSettingsStore((s) => s.toggleThemeMode);
    const customFonts = useFontStore((s) => s.customFonts);
    const canUndo = useStore(useWorksheetStore.temporal, (state) => state.pastStates.length > 0);
    const canRedo = useStore(useWorksheetStore.temporal, (state) => state.futureStates.length > 0);
    const activeTask = activeTaskId ? tasksById[activeTaskId] : undefined;
    const activeImageTask = activeTask
        && (((activeTask as { type?: string }).type === 'image-placeholder') || ((activeTask as { type?: string }).type === 'image'))
        ? activeTask as ImagePlaceholderTask
        : undefined;
    const isImageTaskSelected = Boolean(activeImageTask);
    const isInlineImageSelected = activeEditor?.isActive('image') ?? false;
    const isImageSelected = isInlineImageSelected || isImageTaskSelected;

    useEffect(() => {
        if (isImageSelected) {
            setActiveTab('Bildformat');
            return;
        }
        if (activeTab === 'Bildformat') {
            setActiveTab('Allgemein');
        }
    }, [isImageSelected, activeTab, activeEditor, activeTask]);

    const hasUnsavedChanges = saveStatus === 'unsaved';
    const editorDisabled = !activeEditor;

    // Close dropdowns on outside click
    useEffect(() => {
        if (!showAiDropdown && !isExportMenuOpen && !isSaveMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (showAiDropdown && aiDropdownRef.current && !aiDropdownRef.current.contains(e.target as Node)) {
                setShowAiDropdown(false);
            }
            if (isExportMenuOpen && exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
                setIsExportMenuOpen(false);
            }
            if (isSaveMenuOpen && saveDropdownRef.current && !saveDropdownRef.current.contains(e.target as Node)) {
                setIsSaveMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showAiDropdown, isExportMenuOpen, isSaveMenuOpen]);

    const handleExport = useCallback(async (target: 'pdf-student' | 'pdf-teacher' | 'docx') => {
        if (!hasTasks) return;
        setIsExportMenuOpen(false);
        if (target === 'pdf-student') {
            await onExportPdf(['student' as ExportVariant]);
            return;
        }
        if (target === 'pdf-teacher') {
            await onExportPdf(['teacher' as ExportVariant]);
            return;
        }
        await onExportDocx(['student' as ExportVariant]);
    }, [hasTasks, onExportDocx, onExportPdf]);

    const handlePrimarySave = useCallback(() => {
        if (isFirstSave) {
            setIsSaveModalOpen(true);
            setIsSaveMenuOpen(false);
            return;
        }

        saveCurrentDocument();
        void onSave();
        setIsSaveMenuOpen(false);
    }, [isFirstSave, onSave, saveCurrentDocument]);

    const handleSaveAsClick = useCallback(() => {
        setIsSaveModalOpen(true);
        setIsSaveMenuOpen(false);
    }, []);

    // Force re-render on editor transaction to update active states
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!activeEditor) return;
        const onTransaction = () => setTick((t) => t + 1);
        activeEditor.on('transaction', onTransaction);
        return () => { activeEditor.off('transaction', onTransaction); };
    }, [activeEditor]);

    const activeTextColor = activeEditor
        ? (((activeEditor.getAttributes('textStyle') as { color?: string }).color) ?? null)
        : null;

    const selectedFontSize = activeEditor
        ? ((activeEditor.getAttributes('textStyle') as { fontSize?: string }).fontSize ?? '')
        : '';

    const selectedFontFamily = activeEditor
        ? ((activeEditor.getAttributes('textStyle') as { fontFamily?: string }).fontFamily ?? '')
        : '';

    const imageAttributes = activeEditor
        ? (activeEditor.getAttributes('image') as { align?: 'left' | 'center' | 'right' })
        : undefined;

    const selectedImageAlign: 'left' | 'center' | 'right' =
        imageAttributes?.align === 'center' || imageAttributes?.align === 'right'
            ? imageAttributes.align
            : 'left';
    const selectedTaskAlign: 'left' | 'center' | 'right' =
        activeImageTask?.imageAlign === 'center' || activeImageTask?.imageAlign === 'right'
            ? activeImageTask.imageAlign
            : 'left';
    const selectedToolbarImageAlign = isImageTaskSelected ? selectedTaskAlign : selectedImageAlign;
    const systemBlock = useMemo<ToolbarBlock>(() => ({
        label: t('ribbon.system'),
        hideLabel: true,
        className: 'ml-auto',
        content: (
            <div className="flex items-center gap-1">
                <RibbonBtn
                    title={themeMode === 'dark' ? t('editor.lightTheme') : t('editor.darkTheme')}
                    onClick={toggleThemeMode}
                    compact
                >
                    {themeMode === 'dark'
                        ? <Sun className={ICON_SIZES[16]} />
                        : <Moon className={ICON_SIZES[16]} />
                    }
                </RibbonBtn>
            </div>
        ),
    }), [themeMode, toggleThemeMode, t]);

    const toolbarBlocks = useMemo<ToolbarBlock[]>(() => [
        {
            label: t('ribbon.file'),
            content: (
                <div className="flex items-center gap-2">
                    <RibbonBtn
                        title="Dashboard"
                        onClick={onBackToDashboard}
                        compact
                        className="tour-home-button !h-10 !w-10"
                    >
                        <Home className={ICON_SIZES[16]} />
                    </RibbonBtn>
                    <div className="relative" ref={saveDropdownRef}>
                        <div className="flex items-center bg-transparent hover:bg-slate-700 rounded">
                            <button
                                type="button"
                                title={isSaving ? t('editor.saving') : t('editor.save')}
                                onClick={handlePrimarySave}
                                onMouseDown={(e) => e.preventDefault()}
                                disabled={isSaving}
                                className="inline-flex h-10 w-10 items-center justify-center text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <Save className={clsx(
                                    ICON_SIZES[16],
                                    hasUnsavedChanges ? 'text-red-500' : 'text-green-500',
                                )} />
                            </button>
                            <div className="w-px h-4 bg-slate-600" />
                            <button
                                type="button"
                                title={t('editor.saveAs')}
                                onClick={() => setIsSaveMenuOpen((prev) => !prev)}
                                onMouseDown={(e) => e.preventDefault()}
                                className="inline-flex h-10 w-8 items-center justify-center text-slate-300"
                            >
                                <ChevronDown className={ICON_SIZES[14]} />
                            </button>
                        </div>
                        {isSaveMenuOpen && (
                            <div className="absolute top-full left-0 mt-2 w-44 bg-slate-800 border border-slate-700 shadow-xl rounded-md z-50 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={handleSaveAsClick}
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                                >
                                    {t('ribbon.saveAs')}
                                </button>
                            </div>
                        )}
                    </div>
                    <RibbonBtn
                        title={t('editor.undo')}
                        onClick={() => useWorksheetStore.temporal.getState().undo()}
                        disabled={!canUndo}
                        compact
                        className="!h-10 !w-10"
                    >
                        <Undo2 className={ICON_SIZES[14]} />
                    </RibbonBtn>
                    <RibbonBtn
                        title={t('editor.redo')}
                        onClick={() => useWorksheetStore.temporal.getState().redo()}
                        disabled={!canRedo}
                        compact
                        className="!h-10 !w-10"
                    >
                        <Redo2 className={ICON_SIZES[14]} />
                    </RibbonBtn>
                </div>
            ),
        },
        {
            label: t('ribbon.fontSection'),
            disabled: editorDisabled,
            content: (
                <div className="flex items-center gap-2">
                    <div className="flex rounded-md shadow-sm border border-slate-700">
                        <div className="px-1 py-1 border-r border-slate-700/60">
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
                                className="h-8 min-w-[130px] max-w-[170px] rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 text-xs text-slate-600 dark:text-slate-300 disabled:opacity-50"
                                aria-label={t('ribbon.fontFamily')}
                            >
                                <optgroup label={t('ribbon.standardGroup')}>
                                    {FONT_FAMILY_OPTIONS.map((o) => <option key={o.label} value={o.value}>{o.label}</option>)}
                                </optgroup>
                                {customFonts.length > 0 && (
                                    <optgroup label={t('ribbon.customGroup')}>
                                        {customFonts.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
                                    </optgroup>
                                )}
                            </select>
                        </div>
                        <div className="flex items-center">
                            <div className="flex border-r border-slate-700/60">
                                <RibbonBtn
                                    title={t('ribbon.bold')}
                                    active={activeEditor?.isActive('bold')}
                                    onClick={() => activeEditor?.chain().focus().toggleBold().run()}
                                    disabled={editorDisabled}
                                    compact
                                    className="rounded-none border-r border-slate-700/60"
                                >
                                    <Bold className={ICON_SIZES[14]} />
                                </RibbonBtn>
                                <RibbonBtn
                                    title={t('ribbon.italic')}
                                    active={activeEditor?.isActive('italic')}
                                    onClick={() => activeEditor?.chain().focus().toggleItalic().run()}
                                    disabled={editorDisabled}
                                    compact
                                    className="rounded-none border-r border-slate-700/60"
                                >
                                    <Italic className={ICON_SIZES[14]} />
                                </RibbonBtn>
                                <RibbonBtn
                                    title={t('ribbon.underline')}
                                    active={activeEditor?.isActive('underline')}
                                    onClick={() => activeEditor?.chain().focus().toggleUnderline().run()}
                                    disabled={editorDisabled}
                                    compact
                                    className="rounded-none border-r border-slate-700/60"
                                >
                                    <Underline className={ICON_SIZES[14]} />
                                </RibbonBtn>
                                <RibbonBtn
                                    title={t('ribbon.strikethrough')}
                                    active={activeEditor?.isActive('strike')}
                                    onClick={() => activeEditor?.chain().focus().toggleStrike().run()}
                                    disabled={editorDisabled}
                                    compact
                                    className="rounded-none"
                                >
                                    <Strikethrough className={ICON_SIZES[14]} />
                                </RibbonBtn>
                            </div>
                            <RibbonBtn
                                title={t('ribbon.heading')}
                                active={activeEditor?.isActive('heading')}
                                onClick={() => activeEditor?.chain().focus().toggleHeading({ level: 2 }).run()}
                                disabled={editorDisabled}
                                compact
                                className="rounded-none"
                            >
                                <Heading className={ICON_SIZES[14]} />
                            </RibbonBtn>
                        </div>
                    </div>

                    <div className="flex rounded-md shadow-sm border border-slate-700">
                        <div className="px-1 py-1 border-r border-slate-700/60">
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
                                className="h-8 min-w-[78px] rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 text-xs text-slate-600 dark:text-slate-300 disabled:opacity-50"
                                aria-label={t('ribbon.fontSize')}
                            >
                                <option value="">{t('ribbon.standardAbbrev')}</option>
                                {FONT_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex border-r border-slate-700/60">
                            <RibbonBtn
                                title={t('ribbon.increaseFontSize')}
                                onClick={() => {
                                    if (!activeEditor) return;
                                    const current = (activeEditor.getAttributes('textStyle') as { fontSize?: string }).fontSize ?? '12pt';
                                    const idx = FONT_SIZE_OPTIONS.indexOf(current as typeof FONT_SIZE_OPTIONS[number]);
                                    const next = FONT_SIZE_OPTIONS[Math.min((idx < 0 ? 2 : idx) + 1, FONT_SIZE_OPTIONS.length - 1)];
                                    activeEditor.chain().focus().setFontSize(next).run();
                                }}
                                disabled={editorDisabled}
                                compact
                                className="rounded-none border-r border-slate-700/60 !p-0 !items-center !justify-center"
                            >
                                <AArrowUp className="h-[18px] w-[18px]" />
                            </RibbonBtn>
                            <RibbonBtn
                                title={t('ribbon.decreaseFontSize')}
                                onClick={() => {
                                    if (!activeEditor) return;
                                    const current = (activeEditor.getAttributes('textStyle') as { fontSize?: string }).fontSize ?? '12pt';
                                    const idx = FONT_SIZE_OPTIONS.indexOf(current as typeof FONT_SIZE_OPTIONS[number]);
                                    const next = FONT_SIZE_OPTIONS[Math.max((idx < 0 ? 2 : idx) - 1, 0)];
                                    activeEditor.chain().focus().setFontSize(next).run();
                                }}
                                disabled={editorDisabled}
                                compact
                                className="rounded-none !p-0 !items-center !justify-center"
                            >
                                <AArrowDown className="h-[18px] w-[18px]" />
                            </RibbonBtn>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center border-l border-slate-700/60">
                            <ColorPickerButton
                                color={activeTextColor}
                                onChange={(newColor) => activeEditor?.chain().focus().setColor(newColor).run()}
                            />
                        </div>
                    </div>
                </div>
            ),
        },
        {
            label: t('ribbon.paragraph'),
            disabled: editorDisabled,
            content: (
                <div className="flex items-center gap-2">
                    <div className="flex rounded-md shadow-sm border border-slate-700 overflow-hidden p-1">
                        <RibbonBtn
                            title={t('ribbon.alignLeft')}
                            active={activeEditor?.isActive({ textAlign: 'left' })}
                            onClick={() => activeEditor?.chain().focus().setTextAlign('left').run()}
                            disabled={editorDisabled}
                            compact
                            className="rounded-none border-r border-slate-700/60"
                        >
                            <AlignLeft className={ICON_SIZES[14]} />
                        </RibbonBtn>
                        <RibbonBtn
                            title={t('ribbon.alignCenter')}
                            active={activeEditor?.isActive({ textAlign: 'center' })}
                            onClick={() => activeEditor?.chain().focus().setTextAlign('center').run()}
                            disabled={editorDisabled}
                            compact
                            className="rounded-none border-r border-slate-700/60"
                        >
                            <AlignCenter className={ICON_SIZES[14]} />
                        </RibbonBtn>
                        <RibbonBtn
                            title={t('ribbon.alignRight')}
                            active={activeEditor?.isActive({ textAlign: 'right' })}
                            onClick={() => activeEditor?.chain().focus().setTextAlign('right').run()}
                            disabled={editorDisabled}
                            compact
                            className="rounded-none border-r border-slate-700/60"
                        >
                            <AlignRight className={ICON_SIZES[14]} />
                        </RibbonBtn>
                        <RibbonBtn
                            title={t('ribbon.justify')}
                            active={activeEditor?.isActive({ textAlign: 'justify' })}
                            onClick={() => activeEditor?.chain().focus().setTextAlign('justify').run()}
                            disabled={editorDisabled}
                            compact
                            className="rounded-none"
                        >
                            <AlignJustify className={ICON_SIZES[14]} />
                        </RibbonBtn>
                    </div>

                    <div className="flex rounded-md shadow-sm border border-slate-700 overflow-hidden p-1">
                        <RibbonBtn
                            title={t('ribbon.bulletList')}
                            active={activeEditor?.isActive('bulletList')}
                            onClick={() => activeEditor?.chain().focus().toggleBulletList().run()}
                            disabled={editorDisabled}
                            compact
                            className="rounded-none border-r border-slate-700/60"
                        >
                            <List className={ICON_SIZES[14]} />
                        </RibbonBtn>
                        <RibbonBtn
                            title={t('ribbon.orderedList')}
                            active={activeEditor?.isActive('orderedList')}
                            onClick={() => activeEditor?.chain().focus().toggleOrderedList().run()}
                            disabled={editorDisabled}
                            compact
                            className="rounded-none border-r border-slate-700/60"
                        >
                            <ListOrdered className={ICON_SIZES[14]} />
                        </RibbonBtn>
                        <RibbonBtn
                            title={t('ribbon.indent')}
                            onClick={() => activeEditor?.chain().focus().sinkListItem('listItem').run()}
                            disabled={editorDisabled}
                            compact
                            className="rounded-none border-r border-slate-700/60"
                        >
                            <Indent className={ICON_SIZES[14]} />
                        </RibbonBtn>
                        <RibbonBtn
                            title={t('ribbon.outdent')}
                            onClick={() => activeEditor?.chain().focus().liftListItem('listItem').run()}
                            disabled={editorDisabled}
                            compact
                            className="rounded-none"
                        >
                            <Outdent className={ICON_SIZES[14]} />
                        </RibbonBtn>
                    </div>
                </div>
            ),
        },
        {
            label: t('ribbon.actions'),
            content: (
                <div className="flex items-center gap-2">
                    <div className="relative" ref={aiDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setShowAiDropdown(!showAiDropdown)}
                            onMouseDown={(e) => e.preventDefault()}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors cursor-pointer bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white shadow"
                            title={t('ribbon.aiAssistant')}
                        >
                            <Sparkles className={ICON_SIZES[14]} />
                        </button>
                        {showAiDropdown && (
                            <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1">
                                <DropdownItem onClick={() => { setShowAiDropdown(false); }}>
                                    {t('ribbon.simplifyText')}
                                </DropdownItem>
                                <DropdownItem onClick={() => { setShowAiDropdown(false); }}>
                                    {t('ribbon.correct')}
                                </DropdownItem>
                            </div>
                        )}
                    </div>
                    <div className="relative" ref={exportDropdownRef}>
                        <button
                            type="button"
                            onClick={() => !isExporting && setIsExportMenuOpen((prev) => !prev)}
                            onMouseDown={(e) => e.preventDefault()}
                            disabled={!hasTasks || isExporting}
                            className={clsx(
                                'tour-pdf-export inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors cursor-pointer',
                                'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
                                (!hasTasks || isExporting) && 'opacity-40 cursor-not-allowed',
                            )}
                            title={isExporting ? 'Exportiere…' : t('ribbon.export')}
                        >
                            {isExporting
                                ? <Loader2 className={clsx(ICON_SIZES[14], 'animate-spin')} />
                                : <Download className={ICON_SIZES[14]} />}
                        </button>
                        {isExportMenuOpen && !isExporting && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-slate-800 border border-slate-700 shadow-xl rounded-md z-50 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => { void handleExport('pdf-student'); }}
                                    onMouseDown={(e) => e.preventDefault()}
                                    disabled={isExporting}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {t('ribbon.pdfStudent')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { void handleExport('pdf-teacher'); }}
                                    onMouseDown={(e) => e.preventDefault()}
                                    disabled={isExporting}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {t('ribbon.pdfTeacher')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { void handleExport('docx'); }}
                                    onMouseDown={(e) => e.preventDefault()}
                                    disabled={isExporting}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {t('ribbon.wordDocx')}
                                </button>
                            </div>
                        )}
                    </div>
                    <RibbonBtn
                        title={t('ribbon.manageSources')}
                        onClick={onOpenSources}
                        compact
                        className="!h-10 !w-10"
                    >
                        <BookOpen className={ICON_SIZES[14]} />
                    </RibbonBtn>
                </div>
            ),
        },
        systemBlock,
    ], [
        activeEditor,
        activeTextColor,
        canRedo,
        canUndo,
        customFonts,
        editorDisabled,
        hasTasks,
        hasUnsavedChanges,
        isSaving,
        onBackToDashboard,
        onOpenSources,
        handlePrimarySave,
        handleSaveAsClick,
        selectedFontFamily,
        selectedFontSize,
        showAiDropdown,
        isExportMenuOpen,
        isSaveMenuOpen,
        handleExport,
        systemBlock,
    ]);

    const imageToolbarBlocks = useMemo<ToolbarBlock[]>(() => [
        {
            label: t('ribbon.adjustment'),
            disabled: !isImageTaskSelected,
            content: (
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex rounded-md shadow-sm border border-slate-700 overflow-hidden p-1">
                        <RibbonBtn
                            title={t('ribbon.crop')}
                            onClick={() => {
                                if (!activeTaskId) return;
                                updateTask(
                                    activeTaskId,
                                    { isCropping: true } as unknown as Partial<ImagePlaceholderTask>,
                                );
                            }}
                            disabled={!isImageTaskSelected}
                            compact
                            className="rounded-none"
                        >
                            <Crop className={ICON_SIZES[14]} />
                        </RibbonBtn>
                    </div>
                </div>
            ),
        },
        {
            label: t('ribbon.alignment'),
            disabled: (!isInlineImageSelected && !isImageTaskSelected) || (editorDisabled && !isImageTaskSelected),
            content: (
                <div className="flex items-center gap-2">
                    <div className="flex rounded-md shadow-sm border border-slate-700 overflow-hidden p-1">
                        <RibbonBtn
                            title={t('ribbon.imageAlignLeft')}
                            active={selectedToolbarImageAlign === 'left'}
                            onClick={() => {
                                if (isImageTaskSelected && activeImageTask) {
                                    updateTask(activeImageTask.id, { align: 'left', imageAlign: 'left' } as Partial<ImagePlaceholderTask>);
                                    return;
                                }
                                activeEditor?.chain().focus().updateAttributes('image', { align: 'left' }).run();
                            }}
                            disabled={(!isInlineImageSelected && !isImageTaskSelected) || (editorDisabled && !isImageTaskSelected)}
                            compact
                            className="rounded-none border-r border-slate-700/60"
                        >
                            <AlignLeft className={ICON_SIZES[14]} />
                        </RibbonBtn>
                        <RibbonBtn
                            title={t('ribbon.imageCenter')}
                            active={selectedToolbarImageAlign === 'center'}
                            onClick={() => {
                                if (isImageTaskSelected && activeImageTask) {
                                    updateTask(activeImageTask.id, { align: 'center', imageAlign: 'center' } as Partial<ImagePlaceholderTask>);
                                    return;
                                }
                                activeEditor?.chain().focus().updateAttributes('image', { align: 'center' }).run();
                            }}
                            disabled={(!isInlineImageSelected && !isImageTaskSelected) || (editorDisabled && !isImageTaskSelected)}
                            compact
                            className="rounded-none border-r border-slate-700/60"
                        >
                            <AlignCenter className={ICON_SIZES[14]} />
                        </RibbonBtn>
                        <RibbonBtn
                            title={t('ribbon.imageAlignRight')}
                            active={selectedToolbarImageAlign === 'right'}
                            onClick={() => {
                                if (isImageTaskSelected && activeImageTask) {
                                    updateTask(activeImageTask.id, { align: 'right', imageAlign: 'right' } as Partial<ImagePlaceholderTask>);
                                    return;
                                }
                                activeEditor?.chain().focus().updateAttributes('image', { align: 'right' }).run();
                            }}
                            disabled={(!isInlineImageSelected && !isImageTaskSelected) || (editorDisabled && !isImageTaskSelected)}
                            compact
                            className="rounded-none"
                        >
                            <AlignRight className={ICON_SIZES[14]} />
                        </RibbonBtn>
                    </div>
                </div>
            ),
        },
        systemBlock,
    ], [
        activeEditor,
        activeImageTask,
        editorDisabled,
        isImageTaskSelected,
        isInlineImageSelected,
        activeTaskId,
        updateTask,
        selectedToolbarImageAlign,
        systemBlock,
        t,
    ]);

    const tabs = useMemo<RibbonTab[]>(() => {
        const baseTabs: RibbonTab[] = ['Allgemein', 'Tabellen', 'Sonderzeich.'];
        if (isImageSelected) {
            baseTabs.push('Bildformat');
        }
        return baseTabs;
    }, [isImageSelected]);

    const tabLabelMap: Record<RibbonTab, string> = {
        'Allgemein': t('ribbon.tabGeneral'),
        'Tabellen': t('ribbon.tabTables'),
        'Sonderzeich.': t('ribbon.tabSpecialChars'),
        'Bildformat': t('ribbon.tabImageFormat'),
    };

    const activeBlocks = activeTab === 'Bildformat' ? imageToolbarBlocks : toolbarBlocks;

    return (
        <>
            <div className="no-print print:hidden sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm select-none">
            {/* ── Tab-Header ── */}
                <div className="flex items-center gap-0 border-b border-slate-200 dark:border-slate-700 px-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={clsx(
                                'py-1.5 text-xs transition-colors cursor-pointer min-h-[44px] min-w-[44px]',
                                tab === 'Bildformat'
                                    ? clsx(
                                        'ml-1 px-4 rounded-t-md font-semibold',
                                        activeTab === tab
                                            ? 'bg-purple-600 text-white shadow-sm'
                                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:hover:bg-purple-900/60',
                                    )
                                    : clsx(
                                        'px-4 font-medium',
                                        activeTab === tab
                                            ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
                                    ),
                            )}
                        >
                            {tabLabelMap[tab]}
                        </button>
                    ))}
                </div>

                {/* ── Ribbon Body (Allgemein / Bildformat) ── */}
                {(activeTab === 'Allgemein' || activeTab === 'Bildformat') && (
                    <div className="flex flex-wrap items-stretch justify-start px-1 pt-2 pb-1">
                        {activeBlocks.map(({ label, content, hideLabel, disabled, className }) => (
                            <div
                                key={label}
                                className={clsx(
                                    'flex flex-col items-center justify-start gap-y-1 self-stretch pr-4 mr-2 border-r border-slate-300 dark:border-slate-700 last:border-r-0 last:pr-0 last:mr-0',
                                    className,
                                    disabled && 'opacity-50 pointer-events-none',
                                )}
                            >
                                <div className="flex flex-col gap-y-2">
                                    {content}
                                </div>
                                {!hideLabel && (
                                    <span className="text-[10px] text-slate-400 text-center uppercase tracking-wider mt-auto pt-1">
                                        {label}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Tabellen Tab (Platzhalter) ── */}
                {activeTab === 'Tabellen' && (
                    <div className="flex items-center px-4 py-3 text-xs text-slate-400 dark:text-slate-500 min-h-[60px]">
                        {t('ribbon.tablesPlaceholder')}
                    </div>
                )}

                {/* ── Sonderzeichen Tab (Platzhalter) ── */}
                {activeTab === 'Sonderzeich.' && (
                    <div className="flex items-center px-4 py-3 text-xs text-slate-400 dark:text-slate-500 min-h-[60px]">
                        {t('ribbon.specialCharsPlaceholder')}
                    </div>
                )}
            </div>
            <SaveAsModal
                isOpen={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                onSave={onSave}
            />
        </>
    );
}

/* ═══════════════════════════════════════════════
   Primitive Sub-Components
   ═══════════════════════════════════════════════ */

/** Einzelner Ribbon-Button mit Apple-HIG Touch-Targets und Fokus-Schutz */
interface RibbonBtnProps {
    children: ReactNode;
    title: string;
    onClick?: () => void;
    active?: boolean;
    disabled?: boolean;
    compact?: boolean;
    className?: string;
}

function RibbonBtn({
    children,
    title,
    onClick,
    active,
    disabled,
    compact,
    className,
}: RibbonBtnProps) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            onMouseDown={(e) => e.preventDefault()}
            disabled={disabled}
            className={clsx(
                'inline-flex items-center justify-center rounded transition-colors cursor-pointer',
                compact ? 'h-8 w-8 p-1' : 'min-h-[44px] min-w-[44px] p-1.5',
                active
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
                disabled && 'opacity-30 cursor-not-allowed',
                className,
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
