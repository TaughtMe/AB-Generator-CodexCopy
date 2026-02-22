import {
    GraduationCap,
    BookOpen,
    Sparkles,
    Palette,
    ZoomIn,
    ZoomOut,
    Plus,
} from 'lucide-react';

export interface FloatingToolbarProps {
    onOpenAIImport: () => void;
    showHeader: boolean;
    onToggleHeaderDesign: () => void;
    isTeacherMode: boolean;
    onToggleTeacherMode: () => void;
    zoomLevel: number;
    onZoomLevelChange: (zoomLevel: number) => void;
    /** Placement-Modus aktiv? */
    isPlacingNewTask: boolean;
    /** Startet den Placement-Modus */
    onStartPlacing: () => void;
    /** Bricht den Placement-Modus ab */
    onCancelPlacing: () => void;
}

// ── FloatingToolbar ───────────────────────────────────────────────────
export function FloatingToolbar({
    onOpenAIImport,
    showHeader,
    onToggleHeaderDesign,
    isTeacherMode,
    onToggleTeacherMode,
    zoomLevel,
    onZoomLevelChange,
    isPlacingNewTask,
    onStartPlacing,
    onCancelPlacing,
}: FloatingToolbarProps) {
    return (
        <div className="no-print flex items-center gap-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-full shadow-xl px-5 py-2.5 border border-gray-200 dark:border-gray-700">

            {/* ── Aufgabe hinzufügen (Placement-Modus) ── */}
            <button
                onClick={isPlacingNewTask ? onCancelPlacing : onStartPlacing}
                className={`flex items-center justify-center w-9 h-9 rounded-full transition-all cursor-pointer active:scale-95 shadow-sm ${
                    isPlacingNewTask
                        ? 'bg-blue-700 text-white ring-2 ring-blue-300 ring-offset-1 animate-pulse'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title={isPlacingNewTask ? 'Platzierung abbrechen' : 'Aufgabe hinzufügen – klicke dann in den Editor'}
            >
                <Plus size={16} strokeWidth={2.2} className={isPlacingNewTask ? 'rotate-45 transition-transform' : 'transition-transform'} />
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />

            {/* ── KI-Import ── */}
            <button
                onClick={onOpenAIImport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full transition-all text-xs font-semibold cursor-pointer shadow-sm hover:shadow-md active:scale-95"
                title="Aufgaben via KI importieren"
            >
                <Sparkles size={13} />
                <span>KI-Import</span>
            </button>

            {/* ── Design ── */}
            <button
                onClick={onToggleHeaderDesign}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    showHeader
                        ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 ring-1 ring-violet-200 dark:ring-violet-800'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title={showHeader ? 'Design-Header aktiv' : 'Design-Header aktivieren'}
            >
                <Palette size={13} />
                <span>Design</span>
            </button>

            {/* ── Schüler / Lehrer ── */}
            <button
                onClick={onToggleTeacherMode}
                className={`flex items-center justify-center gap-1.5 w-[83px] py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    isTeacherMode
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800'
                }`}
                title={isTeacherMode ? 'Lehrer-Modus (Lösungen sichtbar)' : 'Schüler-Modus (Lösungen ausgeblendet)'}
            >
                {isTeacherMode ? <GraduationCap size={14} className="w-[14px] h-[14px] shrink-0" /> : <BookOpen size={14} className="w-[14px] h-[14px] shrink-0" />}
                <span>{isTeacherMode ? 'Lehrer' : 'Schüler'}</span>
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />

            {/* ── Zoom ── */}
            <div className="flex items-center gap-2">
                <ZoomOut size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <input
                    type="range"
                    min={50}
                    max={200}
                    step={5}
                    value={Math.round(zoomLevel * 100)}
                    onChange={(event) => onZoomLevelChange(Number(event.target.value) / 100)}
                    className="w-28 h-1 bg-slate-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <ZoomIn size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <button
                    onClick={() => onZoomLevelChange(1)}
                    className="px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer tabular-nums min-w-[3rem] text-center"
                    title="Zoom zurücksetzen"
                >
                    {Math.round(zoomLevel * 100)}%
                </button>
            </div>
        </div>
    );
}

