import {
    Moon,
    Sun,
    FileDown,
    ArrowLeft,
    Printer,
    Save,
    Sparkles,
    List,
} from 'lucide-react';

export interface TopBarProps {
    title: string;
    onTitleChange: (title: string) => void;
    onBackToDashboard: () => void;
    onSave: () => Promise<void> | void;
    isSaving: boolean;
    hasTasks: boolean;
    onExportDocx: () => void;
    onExportPDF: () => void;
    isDarkMode: boolean;
    onToggleThemeMode: () => void;
    isAiSidebarOpen: boolean;
    onToggleAiSidebar: () => void;
    isOutlineOpen: boolean;
    onToggleOutline: () => void;
}

export function TopBar({
    title,
    onTitleChange,
    onBackToDashboard,
    onSave,
    isSaving,
    hasTasks,
    onExportDocx,
    onExportPDF,
    isDarkMode,
    onToggleThemeMode,
    isAiSidebarOpen,
    onToggleAiSidebar,
    isOutlineOpen,
    onToggleOutline,
}: TopBarProps) {
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
                        <ArrowLeft size={14} />
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
                        <List size={15} />
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

                {/* Right: Actions */}
                <div className="flex items-center gap-1">
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
                        onClick={onToggleAiSidebar}
                        className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-xs font-medium cursor-pointer active:scale-95 ${
                            isAiSidebarOpen
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30'
                                : 'bg-transparent text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                        }`}
                        title={isAiSidebarOpen ? 'KI-Chat ausblenden' : 'KI-Chat einblenden'}
                    >
                        <Sparkles size={14} />
                        <span className="hidden xl:inline">KI-Chat</span>
                    </button>

                    <button
                        onClick={onToggleThemeMode}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
                    >
                        {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
                    </button>
                </div>
            </div>
        </header>
    );
}
