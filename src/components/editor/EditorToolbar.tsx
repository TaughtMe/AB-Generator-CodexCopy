import { useState, useRef, useEffect } from 'react';
import {
    Moon,
    Sun,
    Plus,
    FileDown,
    GraduationCap,
    BookOpen,
    Sparkles,
    Image as ImageIcon,
    ChevronDown,
    Type,
    ListChecks,
    TextCursorInput,
    ArrowLeft,
    Printer,
    Save,
    Sigma,
    Palette,
    Settings,
    ZoomIn,
    ZoomOut,
    Scissors,
    Columns,
} from 'lucide-react';
import type { TaskType } from '../../types/worksheet';

interface EditorToolbarProps {
    title: string;
    onTitleChange: (title: string) => void;
    onBackToDashboard: () => void;
    onAddTask: (type: TaskType) => void;
    onOpenAIImport: () => void;
    showHeader: boolean;
    onToggleHeaderDesign: () => void;
    isTeacherMode: boolean;
    onToggleTeacherMode: () => void;
    onSave: () => Promise<void> | void;
    isSaving: boolean;
    hasTasks: boolean;
    onExportDocx: () => void;
    onExportPDF: () => void;
    isDark: boolean;
    onToggleDark: () => void;
    onOpenSettings: () => void;
    zoomLevel: number;
    onZoomLevelChange: (zoomLevel: number) => void;
}

const TASK_OPTIONS = [
    { type: 'lineatur' as const, label: 'Lineatur', desc: 'Schreiblinien & Kästchen', icon: Type },
    { type: 'multiple-choice' as const, label: 'Multiple Choice', desc: 'Antworten ankreuzen', icon: ListChecks },
    { type: 'cloze' as const, label: 'Lückentext', desc: 'Wörter ergänzen', icon: TextCursorInput },
    { type: 'image-placeholder' as const, label: 'Bild-Platzhalter', desc: 'Bild einfügen', icon: ImageIcon },
    { type: 'math' as const, label: 'Mathematik', desc: 'LaTeX-Formeln einfügen', icon: Sigma },
    { type: 'columns' as const, label: 'Zweispaltig', desc: 'Zwei Elemente nebeneinander', icon: Columns },
    { type: 'page-break' as const, label: 'Seitenumbruch', desc: 'Neue Seite in Word & PDF', icon: Scissors },
];

export function EditorToolbar({
    title,
    onTitleChange,
    onBackToDashboard,
    onAddTask,
    onOpenAIImport,
    showHeader,
    onToggleHeaderDesign,
    isTeacherMode,
    onToggleTeacherMode,
    onSave,
    isSaving,
    hasTasks,
    onExportDocx,
    onExportPDF,
    isDark,
    onToggleDark,
    onOpenSettings,
    zoomLevel,
    onZoomLevelChange,
}: EditorToolbarProps) {
    const [showAddMenu, setShowAddMenu] = useState(false);
    const addMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
                setShowAddMenu(false);
            }
        };

        if (showAddMenu) {
            document.addEventListener('mousedown', handleClick);
        }

        return () => document.removeEventListener('mousedown', handleClick);
    }, [showAddMenu]);

    return (
        <>
            <header className="no-print sticky top-0 z-30 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                <div className="max-w-[260mm] mx-auto px-5 py-2.5 flex items-center gap-2">
                    <div className="mr-auto flex items-center gap-2.5">
                        <button
                            onClick={onBackToDashboard}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                            title="Zurück zum Dashboard"
                        >
                            <ArrowLeft size={14} />
                            <span className="hidden sm:inline">Dashboard</span>
                        </button>

                        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/60" />

                        <input
                            type="text"
                            value={title}
                            onChange={(event) => onTitleChange(event.target.value)}
                            placeholder="Arbeitsblatt-Name..."
                            className="text-[13px] font-bold tracking-tight text-slate-800 dark:text-slate-100 bg-transparent border-0 border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none px-1 py-0.5 transition-colors min-w-0 w-40 sm:w-52"
                        />
                    </div>

                    <div className="flex items-center gap-1.5">
                        <div className="relative" ref={addMenuRef}>
                            <button
                                onClick={() => setShowAddMenu(!showAddMenu)}
                                className={`flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95 ${showAddMenu
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow'
                                    }`}
                            >
                                <Plus size={14} strokeWidth={2.5} />
                                <span>Aufgabe</span>
                                <ChevronDown size={12} className={`transition-transform duration-200 ${showAddMenu ? 'rotate-180' : ''}`} />
                            </button>

                            {showAddMenu && (
                                <div className="absolute top-full left-0 mt-1.5 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                    {TASK_OPTIONS.map(({ type, label, desc, icon: Icon }) => (
                                        <button
                                            key={type}
                                            onClick={() => {
                                                onAddTask(type);
                                                setShowAddMenu(false);
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer text-left group"
                                        >
                                            <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                                                <Icon size={14} className="text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</p>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500">{desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={onOpenAIImport}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all text-xs font-semibold cursor-pointer shadow-sm hover:shadow-md active:scale-95"
                        >
                            <Sparkles size={13} />
                            <span>KI-Import</span>
                        </button>

                        <button
                            onClick={onToggleHeaderDesign}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${showHeader
                                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 ring-1 ring-violet-200 dark:ring-violet-800'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            title={showHeader ? 'Design-Header aktiv' : 'Design-Header aktivieren'}
                        >
                            <Palette size={13} />
                            <span>Design</span>
                        </button>
                    </div>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700/60 mx-1" />

                    <div className="flex items-center gap-1">
                        <button
                            onClick={onToggleTeacherMode}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${isTeacherMode
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            title={isTeacherMode ? 'Lehrer-Modus (Lösungen sichtbar)' : 'Schüler-Modus (Lösungen ausgeblendet)'}
                        >
                            {isTeacherMode ? <GraduationCap size={14} /> : <BookOpen size={14} />}
                            {isTeacherMode ? 'Lehrer' : 'Schüler'}
                        </button>

                        <button
                            onClick={onSave}
                            disabled={!hasTasks || isSaving}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all text-xs font-medium cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
                            title="Arbeitsblatt speichern"
                        >
                            <Save size={14} />
                            <span>{isSaving ? '...' : 'Speichern'}</span>
                        </button>

                        <button
                            onClick={onExportDocx}
                            disabled={!hasTasks}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all text-xs font-medium cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
                            title="Als Word-Datei exportieren"
                        >
                            <FileDown size={14} />
                            <span>.docx</span>
                        </button>

                        <button
                            onClick={onExportPDF}
                            disabled={!hasTasks}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all text-xs font-medium cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
                            title="Als PDF exportieren (Druckdialog)"
                        >
                            <Printer size={14} />
                            <span>PDF</span>
                        </button>

                        <button
                            onClick={onToggleDark}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title={isDark ? 'Light Mode' : 'Dark Mode'}
                        >
                            {isDark ? <Sun size={15} /> : <Moon size={15} />}
                        </button>

                        <button
                            onClick={onOpenSettings}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Einstellungen"
                        >
                            <Settings size={15} />
                        </button>
                    </div>
                </div>
            </header>

            <div className="no-print sticky top-[49px] z-20 flex items-center justify-center gap-2 py-1.5 px-4 bg-slate-50/80 dark:bg-slate-900/60 backdrop-blur border-b border-slate-200/50 dark:border-slate-800/50">
                <ZoomOut size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <input
                    type="range"
                    min={50}
                    max={200}
                    step={5}
                    value={Math.round(zoomLevel * 100)}
                    onChange={(event) => onZoomLevelChange(Number(event.target.value) / 100)}
                    className="w-32 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <ZoomIn size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <button
                    onClick={() => onZoomLevelChange(1)}
                    className="px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer tabular-nums min-w-[3rem] text-center"
                    title="Zoom zurücksetzen"
                >
                    {Math.round(zoomLevel * 100)}%
                </button>
            </div>
        </>
    );
}
