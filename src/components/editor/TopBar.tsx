import { useState, useRef, useEffect } from 'react';
import {
    Moon,
    Sun,
    ArrowLeft,
    Save,
    List,
    FileText,
    Cloud,
    Check,
    Loader2,
    AlertCircle,
    Share2,
    ExternalLink,
    Undo2,
    Redo2,
    ChevronDown,
    Plus,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useWorksheetStore } from '../../store/worksheetStore';
import { useProfileStore } from '../../store/profileStore';
import { IconButton } from '../ui/IconButton';
import { ICON_SIZES } from '../ui/iconSizes';
import { ExportMenu, type ExportVariant } from './ExportMenu';

export interface TopBarProps {
    title: string;
    onTitleChange: (title: string) => void;
    classId?: string;
    classOptions: Array<{ id: string; name: string }>;
    onClassChange: (classId: string | undefined) => void;
    onBackToDashboard: () => void;
    onSave: () => Promise<void> | void;
    isSaving: boolean;
    hasTasks: boolean;
    onExportAbgen: () => Promise<void> | void;
    onExportPdf: (variants: ExportVariant[]) => Promise<void> | void;
    onExportDocx: (variants: ExportVariant[]) => Promise<void> | void;
    onShareAbgen?: () => Promise<void> | void;
    canShareAbgen?: boolean;
    isAbgenExporting?: boolean;
    isAbgenSharing?: boolean;
    isDarkMode: boolean;
    onToggleThemeMode: () => void;
    isOutlineOpen: boolean;
    onToggleOutline: () => void;
    onOpenSources: () => void;
}

export function TopBar({
    title,
    onTitleChange,
    classId,
    classOptions,
    onClassChange,
    onBackToDashboard,
    onSave,
    isSaving,
    hasTasks,
    onExportAbgen,
    onExportPdf,
    onExportDocx,
    onShareAbgen,
    canShareAbgen = false,
    isAbgenExporting = false,
    isAbgenSharing = false,
    isDarkMode,
    onToggleThemeMode,
    isOutlineOpen,
    onToggleOutline,
    onOpenSources,
}: TopBarProps) {
    const hasMissingClassSelection = Boolean(classId) && !classOptions.some((entry) => entry.id === classId);
    const autoSaveStatus = useWorkspaceStore((state) => state.autoSaveStatus);
    const worksheetSaveStatus = useWorksheetStore((state) => state.saveStatus);
    const effectiveSaveStatus = autoSaveStatus === 'error'
        ? 'error'
        : (isSaving ? 'saving' : worksheetSaveStatus);
    const isAnySaveInProgress = isSaving || effectiveSaveStatus === 'saving';

    // Undo / Redo
    const undo = useWorksheetStore((s) => s.undo);
    const redo = useWorksheetStore((s) => s.redo);
    const canUndo = useWorksheetStore((s) => s._undoStack.length > 0);
    const canRedo = useWorksheetStore((s) => s._redoStack.length > 0);

    // Resolve curriculum URL for current class's subject
    const subjects = useProfileStore((s) => s.subjects);
    const addSubject = useProfileStore((s) => s.addSubject);
    const classProfiles = useWorkspaceStore((s) => s.classProfiles);
    const createClassProfile = useWorkspaceStore((s) => s.createClassProfile);
    const activeClassProfile = classId ? classProfiles.find((c) => c.id === classId) : undefined;
    const activeSubject = activeClassProfile?.subjectId
        ? subjects.find((s) => s.id === activeClassProfile.subjectId)
        : undefined;
    const curriculumUrl = activeSubject?.curriculumUrl;

    // Save-As popover state
    const [showSaveAs, setShowSaveAs] = useState(false);
    const [saveAsClassId, setSaveAsClassId] = useState<string>(classId ?? '');
    const [saveAsSubjectId, setSaveAsSubjectId] = useState<string>(activeClassProfile?.subjectId ?? '');
    const [newClassName, setNewClassName] = useState('');
    const [newSubjectName, setNewSubjectName] = useState('');
    const [showNewClass, setShowNewClass] = useState(false);
    const [showNewSubject, setShowNewSubject] = useState(false);
    const saveAsRef = useRef<HTMLDivElement>(null);

    // Close save-as on outside click
    useEffect(() => {
        if (!showSaveAs) return;
        const handler = (e: MouseEvent) => {
            if (saveAsRef.current && !saveAsRef.current.contains(e.target as Node)) {
                setShowSaveAs(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showSaveAs]);

    const handleSaveAs = async () => {
        // Create new class/subject if needed
        let finalClassId = saveAsClassId;

        if (showNewSubject && newSubjectName.trim()) {
            addSubject(newSubjectName.trim());
            const updatedSubjects = useProfileStore.getState().subjects;
            const newSub = updatedSubjects[updatedSubjects.length - 1];
            if (newSub) {
                setSaveAsSubjectId(newSub.id);
            }
            setNewSubjectName('');
            setShowNewSubject(false);
        }

        if (showNewClass && newClassName.trim()) {
            const effectiveSubjectId = useProfileStore.getState().subjects.find((s) => s.id === saveAsSubjectId)?.id
                ?? (useProfileStore.getState().subjects[useProfileStore.getState().subjects.length - 1]?.id);
            await createClassProfile({
                name: newClassName.trim(),
                subjectId: effectiveSubjectId,
                curriculumContext: '',
                studentProfile: '',
            });
            const updatedProfiles = useWorkspaceStore.getState().classProfiles;
            const newProf = updatedProfiles[updatedProfiles.length - 1];
            if (newProf) {
                finalClassId = newProf.id;
            }
            setNewClassName('');
            setShowNewClass(false);
        }

        if (finalClassId) {
            onClassChange(finalClassId);
        }
        setShowSaveAs(false);
        await onSave();
    };

    return (
        <header className="no-print sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b-0 shadow-none">
            <div className="max-w-[260mm] mx-auto px-5 py-2.5 flex items-center gap-2">
                {/* Left: Back + Title */}
                <div className="mr-auto flex items-center gap-2.5">
                    <button
                        onClick={onBackToDashboard}
                        className="flex items-center gap-1 px-2 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                        title="Zurück zum Dashboard"
                    >
                        <ArrowLeft className={ICON_SIZES[14]} />
                        <span className="hidden sm:inline">Dashboard</span>
                    </button>

                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/60" />

                    {/* Outline-Navigator Toggle */}
                    <button
                        onClick={onToggleOutline}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            isOutlineOpen
                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title={isOutlineOpen ? 'Gliederung ausblenden' : 'Gliederung einblenden'}
                    >
                        <List className={ICON_SIZES[15]} />
                    </button>

                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/60" />

                    <input
                        type="text"
                        value={title}
                        onChange={(event) => onTitleChange(event.target.value)}
                        placeholder="Arbeitsblatt-Name..."
                        className="text-[13px] font-bold tracking-tight text-slate-800 dark:text-slate-100 bg-transparent border-0 border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none px-1 py-0.5 transition-colors min-w-0 w-40 sm:w-52"
                    />

                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/60" />

                    {/* Undo / Redo */}
                    <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Rückgängig (Ctrl+Z)"
                    >
                        <Undo2 className={ICON_SIZES[15]} />
                    </button>
                    <button
                        onClick={redo}
                        disabled={!canRedo}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Wiederholen (Ctrl+Y)"
                    >
                        <Redo2 className={ICON_SIZES[15]} />
                    </button>

                    {curriculumUrl && (
                        <>
                            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/60" />
                            <a
                                href={curriculumUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                                title={`Lehrplan: ${activeSubject?.name ?? ''}`}
                            >
                                <ExternalLink className={ICON_SIZES[14]} />
                            </a>
                        </>
                    )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1">
                    <div
                        className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium ${
                            effectiveSaveStatus === 'error'
                                ? 'border-red-200 text-red-600 dark:border-red-900/50 dark:text-red-300 bg-red-50/70 dark:bg-red-900/20'
                                : effectiveSaveStatus === 'unsaved'
                                    ? 'border-red-200 text-red-600 dark:border-red-900/50 dark:text-red-300 bg-red-50/70 dark:bg-red-900/20'
                                    : effectiveSaveStatus === 'saved'
                                        ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-900/20'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 bg-white/70 dark:bg-slate-800/70'
                        }`}
                        title={
                            effectiveSaveStatus === 'saving'
                                ? 'Speichert...'
                                : effectiveSaveStatus === 'unsaved'
                                    ? 'Ungespeicherte Änderungen'
                                    : effectiveSaveStatus === 'error'
                                        ? 'Speicherfehler'
                                        : 'Gespeichert'
                        }
                    >
                        {effectiveSaveStatus === 'saving' ? (
                            <Loader2 className={`${ICON_SIZES[12]} animate-spin`} />
                        ) : effectiveSaveStatus === 'error' ? (
                            <AlertCircle className={ICON_SIZES[12]} />
                        ) : effectiveSaveStatus === 'unsaved' ? (
                            <span
                                aria-hidden="true"
                                className="inline-block h-2 w-2 rounded-full bg-red-500 dark:bg-red-400"
                            />
                        ) : (
                            <>
                                <Cloud className={ICON_SIZES[12]} />
                                <Check className={`${ICON_SIZES[10]} -ml-1`} />
                            </>
                        )}
                        <span>
                            {effectiveSaveStatus === 'saving'
                                ? 'Speichert...'
                                : effectiveSaveStatus === 'unsaved'
                                    ? 'Ungespeichert'
                                    : effectiveSaveStatus === 'error'
                                        ? 'Speicherfehler'
                                        : 'Gespeichert'}
                        </span>
                    </div>

                    <button
                        onClick={onSave}
                        disabled={!hasTasks || isAnySaveInProgress}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-l-lg transition-all text-xs font-medium cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
                        title="Arbeitsblatt speichern"
                    >
                        <Save className={ICON_SIZES[14]} />
                        <span>{isAnySaveInProgress ? '...' : 'Speichern'}</span>
                    </button>

                    {/* Save-As Dropdown */}
                    <div className="relative" ref={saveAsRef}>
                        <button
                            onClick={() => setShowSaveAs((v) => !v)}
                            disabled={!hasTasks || isAnySaveInProgress}
                            className="flex items-center px-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-r-lg border-l border-slate-200 dark:border-slate-700 transition-all text-xs cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
                            title="Speichern unter…"
                        >
                            <ChevronDown className={ICON_SIZES[12]} />
                        </button>

                        {showSaveAs && (
                            <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 p-4 space-y-3">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Speichern unter</p>

                                {/* Class selector */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Klasse</label>
                                    {!showNewClass ? (
                                        <div className="flex items-center gap-1.5">
                                            <select
                                                value={saveAsClassId}
                                                onChange={(e) => setSaveAsClassId(e.target.value)}
                                                className="flex-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                            >
                                                <option value="">Keine Klasse</option>
                                                {hasMissingClassSelection && classId && (
                                                    <option value={classId}>Gelöschtes Profil</option>
                                                )}
                                                {classOptions.map((entry) => (
                                                    <option key={entry.id} value={entry.id}>{entry.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => setShowNewClass(true)}
                                                className="shrink-0 p-1.5 rounded-md text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
                                                title="Neue Klasse anlegen"
                                            >
                                                <Plus className={ICON_SIZES[14]} />
                                            </button>
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            value={newClassName}
                                            onChange={(e) => setNewClassName(e.target.value)}
                                            placeholder="Neue Klasse (z.B. 4a)"
                                            className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder:text-slate-400"
                                            autoFocus
                                        />
                                    )}
                                </div>

                                {/* Subject selector */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Fach</label>
                                    {!showNewSubject ? (
                                        <div className="flex items-center gap-1.5">
                                            <select
                                                value={saveAsSubjectId}
                                                onChange={(e) => setSaveAsSubjectId(e.target.value)}
                                                className="flex-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                            >
                                                <option value="">Kein Fach</option>
                                                {subjects.map((sub) => (
                                                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => setShowNewSubject(true)}
                                                className="shrink-0 p-1.5 rounded-md text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
                                                title="Neues Fach anlegen"
                                            >
                                                <Plus className={ICON_SIZES[14]} />
                                            </button>
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            value={newSubjectName}
                                            onChange={(e) => setNewSubjectName(e.target.value)}
                                            placeholder="Neues Fach (z.B. Mathematik)"
                                            className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder:text-slate-400"
                                            autoFocus
                                        />
                                    )}
                                </div>

                                <button
                                    onClick={() => void handleSaveAs()}
                                    disabled={isAnySaveInProgress}
                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Save className={ICON_SIZES[14]} />
                                    Speichern unter
                                </button>
                            </div>
                        )}
                    </div>

                    <ExportMenu
                        hasTasks={hasTasks}
                        onExportAbgen={onExportAbgen}
                        onExportPdf={onExportPdf}
                        onExportDocx={onExportDocx}
                        isAbgenExporting={isAbgenExporting}
                        isAbgenSharing={isAbgenSharing}
                    />

                    {canShareAbgen && onShareAbgen && (
                        <button
                            onClick={onShareAbgen}
                            disabled={!hasTasks || isAbgenExporting || isAbgenSharing}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all text-xs font-medium cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
                            title="Als .abgen-Datei teilen"
                        >
                            <Share2 className={ICON_SIZES[14]} />
                            <span>{isAbgenSharing ? '...' : 'Teilen'}</span>
                        </button>
                    )}

                    <button
                        onClick={onOpenSources}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all text-xs font-medium cursor-pointer active:scale-95"
                        title="Quellen verwalten"
                    >
                        <FileText className={ICON_SIZES[14]} />
                        <span>Quellen</span>
                    </button>

                    <IconButton
                        onClick={onToggleThemeMode}
                        size="md"
                        className="rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
                    >
                        {isDarkMode ? <Sun className={ICON_SIZES[15]} /> : <Moon className={ICON_SIZES[15]} />}
                    </IconButton>
                </div>
            </div>
        </header>
    );
}
