import {
    Palette,
    ZoomIn,
    ZoomOut,
    Plus,
} from 'lucide-react';
import { ICON_SIZES } from '../ui/iconSizes';

export interface FloatingToolbarProps {
    showHeader: boolean;
    onToggleHeaderDesign: () => void;
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
    showHeader,
    onToggleHeaderDesign,
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
                className={`tour-add-task flex items-center justify-center w-9 h-9 rounded-full transition-all cursor-pointer active:scale-95 shadow-sm ${
                    isPlacingNewTask
                        ? 'bg-blue-700 text-white ring-2 ring-blue-300 ring-offset-1 animate-pulse'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title={isPlacingNewTask ? 'Platzierung abbrechen' : 'Aufgabe hinzufügen – klicke dann in den Editor'}
            >
                <Plus strokeWidth={2.2} className={isPlacingNewTask ? `${ICON_SIZES[16]} rotate-45 transition-transform` : `${ICON_SIZES[16]} transition-transform`} />
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />

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
                <Palette className={ICON_SIZES[13]} />
                <span>Design</span>
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />

            {/* ── Zoom ── */}
            <div className="flex items-center gap-2">
                <ZoomOut className={`${ICON_SIZES[13]} text-slate-400 dark:text-slate-500 shrink-0`} />
                <input
                    type="range"
                    min={50}
                    max={200}
                    step={5}
                    value={Math.round(zoomLevel * 100)}
                    onChange={(event) => onZoomLevelChange(Number(event.target.value) / 100)}
                    className="w-28 h-1 bg-slate-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <ZoomIn className={`${ICON_SIZES[13]} text-slate-400 dark:text-slate-500 shrink-0`} />
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
