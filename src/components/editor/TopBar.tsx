import {
    Moon,
    Sun,
    FileDown,
    ArrowLeft,
    Printer,
    Save,
    Sparkles,
    List,
    Link,
    Cloud,
    Check,
    Loader2,
    AlertCircle,
    Share2,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { IconButton } from '../ui/IconButton';
import { ICON_SIZES } from '../ui/iconSizes';

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
    onExportDocx: () => void;
    onExportPDF: () => void;
    onExportAbgen: () => Promise<void> | void;
    onShareAbgen?: () => Promise<void> | void;
    canShareAbgen?: boolean;
    isAbgenExporting?: boolean;
    isAbgenSharing?: boolean;
    isDarkMode: boolean;
    onToggleThemeMode: () => void;
    isAiSidebarOpen: boolean;
    onToggleAiSidebar: () => void;
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
    onExportDocx,
    onExportPDF,
    onExportAbgen,
    onShareAbgen,
    canShareAbgen = false,
    isAbgenExporting = false,
    isAbgenSharing = false,
    isDarkMode,
    onToggleThemeMode,
    isAiSidebarOpen,
    onToggleAiSidebar,
    isOutlineOpen,
    onToggleOutline,
    onOpenSources,
}: TopBarProps) {
    const hasMissingClassSelection = Boolean(classId) && !classOptions.some((entry) => entry.id === classId);
    const autoSaveStatus = useWorkspaceStore((state) => state.autoSaveStatus);
    const effectiveSaveStatus = isSaving ? 'saving' : autoSaveStatus;
    const showSaveIndicator = effectiveSaveStatus !== 'idle';

    return (
        <header className="no-print sticky top-0 z-30 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm">
            <div className="max-w-[260mm] mx-auto px-5 py-2.5 flex items-center gap-2">
                {/* Left: Back + Title */}
                <div className="mr-auto flex items-center gap-2.5">
                    <button
                        onClick={onBackToDashboard}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
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

                    <label className="sr-only" htmlFor="topbar-class-select">Klasse zuweisen</label>
                    <select
                        id="topbar-class-select"
                        value={classId ?? ''}
                        onChange={(event) => onClassChange(event.target.value || undefined)}
                        className="max-w-36 sm:max-w-44 text-[12px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                        title="Klassenprofil dem Arbeitsblatt zuweisen"
                    >
                        <option value="">Keine Klasse</option>
                        {hasMissingClassSelection && (
                            <option value={classId}>Gelöschtes Profil</option>
                        )}
                        {classOptions.map((entry) => (
                            <option key={entry.id} value={entry.id}>{entry.name}</option>
                        ))}
                    </select>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1">
                    {showSaveIndicator && (
                        <div
                            className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium ${
                                effectiveSaveStatus === 'error'
                                    ? 'border-red-200 text-red-600 dark:border-red-900/50 dark:text-red-300 bg-red-50/70 dark:bg-red-900/20'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 bg-white/70 dark:bg-slate-800/70'
                            }`}
                            title={effectiveSaveStatus === 'saving' ? 'Automatisches Speichern läuft' : 'Speicherstatus'}
                        >
                            {effectiveSaveStatus === 'saving' ? (
                                <Loader2 className={`${ICON_SIZES[12]} animate-spin`} />
                            ) : effectiveSaveStatus === 'error' ? (
                                <AlertCircle className={ICON_SIZES[12]} />
                            ) : (
                                <>
                                    <Cloud className={ICON_SIZES[12]} />
                                    <Check className={`${ICON_SIZES[10]} -ml-1`} />
                                </>
                            )}
                            <span>
                                {effectiveSaveStatus === 'saving'
                                    ? 'Speichert...'
                                    : effectiveSaveStatus === 'error'
                                        ? 'Speicherfehler'
                                        : 'Gespeichert'}
                            </span>
                        </div>
                    )}

                    <button
                        onClick={onSave}
                        disabled={!hasTasks || isSaving}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all text-xs font-medium cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
                        title="Arbeitsblatt speichern"
                    >
                        <Save className={ICON_SIZES[14]} />
                        <span>{isSaving ? '...' : 'Speichern'}</span>
                    </button>

                    <button
                        onClick={onExportAbgen}
                        disabled={!hasTasks || isAbgenExporting || isAbgenSharing}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all text-xs font-medium cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
                        title="Als .abgen-Datei exportieren"
                    >
                        <FileDown className={ICON_SIZES[14]} />
                        <span>{isAbgenExporting ? '...' : '.abgen'}</span>
                    </button>

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
                        onClick={onExportDocx}
                        disabled={!hasTasks}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all text-xs font-medium cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
                        title="Als Word-Datei exportieren"
                    >
                        <FileDown className={ICON_SIZES[14]} />
                        <span>.docx</span>
                    </button>

                    <button
                        onClick={onExportPDF}
                        disabled={!hasTasks}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all text-xs font-medium cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
                        title="Als PDF exportieren (Druckdialog)"
                    >
                        <Printer className={ICON_SIZES[14]} />
                        <span>PDF</span>
                    </button>

                    <button
                        onClick={onOpenSources}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all text-xs font-medium cursor-pointer active:scale-95"
                        title="Quellen verwalten"
                    >
                        <Link className={ICON_SIZES[14]} />
                        <span>Quellen</span>
                    </button>

                    <button
                        onClick={onToggleAiSidebar}
                        className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-xs font-medium cursor-pointer active:scale-95 ${
                            isAiSidebarOpen
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30'
                                : 'bg-transparent text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                        }`}
                        title={isAiSidebarOpen ? 'KI-Chat ausblenden' : 'KI-Chat einblenden'}
                    >
                        <Sparkles className={ICON_SIZES[14]} />
                        <span className="hidden xl:inline">KI-Chat</span>
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
