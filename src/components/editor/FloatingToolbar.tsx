import { useState, useRef, useEffect, useCallback } from 'react';
import {
    GraduationCap,
    BookOpen,
    Sparkles,
    Image as ImageIcon,
    Type,
    ListChecks,
    TextCursorInput,
    Sigma,
    Palette,
    ZoomIn,
    ZoomOut,
    Scissors,
    Columns,
    Plus,
    LayoutTemplate,
    FileText,
} from 'lucide-react';
import type { TaskType } from '../../types/worksheet';

export interface FloatingToolbarProps {
    onAddTask: (type: TaskType) => void;
    onOpenAIImport: () => void;
    showHeader: boolean;
    onToggleHeaderDesign: () => void;
    isTeacherMode: boolean;
    onToggleTeacherMode: () => void;
    zoomLevel: number;
    onZoomLevelChange: (zoomLevel: number) => void;
}

const TASK_OPTIONS: { type: TaskType; label: string; desc: string; icon: React.ElementType }[] = [
    { type: 'multiple-choice', label: 'Multiple Choice', desc: 'Antworten ankreuzen', icon: ListChecks },
    { type: 'cloze', label: 'Lückentext', desc: 'Wörter ergänzen', icon: TextCursorInput },
    { type: 'math', label: 'Mathematik', desc: 'LaTeX-Formeln einfügen', icon: Sigma },
    { type: 'instruction', label: 'Aufgabe', desc: 'Freier Aufgabentext', icon: FileText },
];

const LAYOUT_OPTIONS: { type: TaskType; label: string; desc: string; icon: React.ElementType }[] = [
    { type: 'lineatur', label: 'Lineatur / Raster', desc: 'Schreiblinien & Kästchen', icon: Type },
    { type: 'columns', label: 'Zweispaltig', desc: 'Zwei Elemente nebeneinander', icon: Columns },
    { type: 'page-break', label: 'Seitenumbruch', desc: 'Neue Seite in Word & PDF', icon: Scissors },
    { type: 'image-placeholder', label: 'Bild-Platzhalter', desc: 'Bild einfügen', icon: ImageIcon },
];

// ── Reusable Dropdown-Button ──────────────────────────────────────────
interface DropdownButtonProps {
    icon: React.ElementType;
    isOpen: boolean;
    onToggle: () => void;
    options: { type: TaskType; label: string; desc: string; icon: React.ElementType }[];
    onSelect: (type: TaskType) => void;
    containerRef: React.RefObject<HTMLDivElement>;
    circleClass: string;
    title: string;
}

function DropdownButton({
    icon: Icon,
    isOpen,
    onToggle,
    options,
    onSelect,
    containerRef,
    circleClass,
    title,
}: DropdownButtonProps) {
    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={onToggle}
                className={`flex items-center justify-center w-9 h-9 rounded-full transition-all cursor-pointer active:scale-95 shadow-sm ${circleClass}`}
                title={title}
            >
                <Icon size={16} strokeWidth={2.2} />
            </button>

            {isOpen && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-bottom-1 duration-150">
                    {options.map(({ type, label: optLabel, desc, icon: OptionIcon }) => (
                        <button
                            key={type}
                            onClick={() => onSelect(type)}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer text-left group"
                        >
                            <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors shrink-0">
                                <OptionIcon size={13} className="text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{optLabel}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">{desc}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── FloatingToolbar ───────────────────────────────────────────────────
export function FloatingToolbar({
    onAddTask,
    onOpenAIImport,
    showHeader,
    onToggleHeaderDesign,
    isTeacherMode,
    onToggleTeacherMode,
    zoomLevel,
    onZoomLevelChange,
}: FloatingToolbarProps) {
    const [openMenu, setOpenMenu] = useState<'task' | 'layout' | null>(null);
    const taskMenuRef = useRef<HTMLDivElement>(null);
    const layoutMenuRef = useRef<HTMLDivElement>(null);

    const closeMenus = useCallback(() => setOpenMenu(null), []);

    useEffect(() => {
        if (!openMenu) return;

        const handleClick = (event: MouseEvent) => {
            const target = event.target as Node;
            const inTask = taskMenuRef.current?.contains(target);
            const inLayout = layoutMenuRef.current?.contains(target);
            if (!inTask && !inLayout) closeMenus();
        };

        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [openMenu, closeMenus]);

    const handleSelect = (type: TaskType) => {
        onAddTask(type);
        closeMenus();
    };

    return (
        <div className="no-print flex items-center gap-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-full shadow-xl px-5 py-2.5 border border-gray-200 dark:border-gray-700">

            {/* ── Aufgabe Dropdown ── */}
            <DropdownButton
                icon={Plus}
                isOpen={openMenu === 'task'}
                onToggle={() => setOpenMenu((prev) => (prev === 'task' ? null : 'task'))}
                options={TASK_OPTIONS}
                onSelect={handleSelect}
                containerRef={taskMenuRef}
                circleClass={openMenu === 'task' ? 'bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}
                title="Aufgabe hinzufügen"
            />

            {/* ── Layout Dropdown ── */}
            <DropdownButton
                icon={LayoutTemplate}
                isOpen={openMenu === 'layout'}
                onToggle={() => setOpenMenu((prev) => (prev === 'layout' ? null : 'layout'))}
                options={LAYOUT_OPTIONS}
                onSelect={handleSelect}
                containerRef={layoutMenuRef}
                circleClass={openMenu === 'layout' ? 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-100' : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200'}
                title="Layout-Element hinzufügen"
            />

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

