import {
    Moon,
    Sun,
    FileDown,
    ArrowLeft,
    Printer,
    Save,
    Settings,
    MessageSquare,
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
    onOpenSettings: () => void;
    isAiSidebarOpen: boolean;
    onToggleAiSidebar: () => void;
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
    onOpenSettings,
    isAiSidebarOpen,
    onToggleAiSidebar,
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
                        className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-xs font-medium cursor-pointer active:scale-95 ${
                            isAiSidebarOpen
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                        title={isAiSidebarOpen ? 'KI-Chat ausblenden' : 'KI-Chat einblenden'}
                    >
                        <MessageSquare size={14} />
                        <span>KI-Chat</span>
                    </button>

                    <button
                        onClick={onToggleThemeMode}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
                    >
                        {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
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
    );
}
