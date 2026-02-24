import React from 'react';
import { Trash2, CheckSquare, Type, Grid3X3, Image, Columns, Calculator, Scissors, Copy, MoreVertical, FileDown, Share2, Heading } from 'lucide-react';
import { useProfileStore } from '../../store/profileStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useSettingsStore } from '../../store/settingsStore';
import type { WorksheetMeta, TaskPreviewItem } from '../../store/dexieStore';
import { ICON_SIZES } from '../ui/iconSizes';

/* ══════════════════════════════════════════════════
   WorksheetCard.tsx – Einzelne Dokumentenkarte
   Zeigt eine Mini-Vorschau des echten Worksheet-Inhalts
   (Header + erste Tasks) im Thumbnail-Bereich.
   ══════════════════════════════════════════════════ */

interface WorksheetCardProps {
    meta: WorksheetMeta;
    isDeleting: boolean;
    isDuplicating: boolean;
    isExporting: boolean;
    isSharing: boolean;
    canShare: boolean;
    onOpen: (id: string) => void;
    onDuplicate: (e: React.MouseEvent, meta: WorksheetMeta) => void;
    onExport: (e: React.MouseEvent, meta: WorksheetMeta) => void;
    onShare: (e: React.MouseEvent, meta: WorksheetMeta) => void;
    onDelete: (e: React.MouseEvent, meta: WorksheetMeta) => void;
}

/** Relative Zeitangabe */
function timeAgo(date: Date): string {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Gerade eben';
    if (minutes < 60) return `vor ${minutes} Min.`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours} Std.`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Gestern';
    return `vor ${days} Tagen`;
}

/** Farbpalette je Fach-Index */
const subjectColors: { bg: string; text: string; border: string }[] = [
    { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-700/40' },
    { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-700/40' },
    { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-700/40' },
    { bg: 'bg-rose-100 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-700/40' },
    { bg: 'bg-violet-100 dark:bg-violet-500/20', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-700/40' },
];

function getColorForSubject(subjectId?: string): typeof subjectColors[0] {
    if (!subjectId) return subjectColors[2];
    let hash = 0;
    for (let i = 0; i < subjectId.length; i++) hash = (hash * 31 + subjectId.charCodeAt(i)) | 0;
    return subjectColors[Math.abs(hash) % subjectColors.length];
}

/** Icon per Task-Typ */
function taskIcon(type: string) {
    switch (type) {
        case 'multiple-choice': return <CheckSquare className={`${ICON_SIZES[7]} shrink-0`} />;
        case 'cloze': return <Type className={`${ICON_SIZES[7]} shrink-0`} />;
        case 'heading': return <Heading className={`${ICON_SIZES[7]} shrink-0`} />;
        case 'lineatur': return <Grid3X3 className={`${ICON_SIZES[7]} shrink-0`} />;
        case 'image-placeholder': return <Image className={`${ICON_SIZES[7]} shrink-0`} />;
        case 'columns': return <Columns className={`${ICON_SIZES[7]} shrink-0`} />;
        case 'math': return <Calculator className={`${ICON_SIZES[7]} shrink-0`} />;
        case 'page-break': return <Scissors className={`${ICON_SIZES[7]} shrink-0`} />;
        default: return <Type className={`${ICON_SIZES[7]} shrink-0`} />;
    }
}

/** Mini-Header – spiegelt den echten WorksheetHeader wider */
const MiniHeader: React.FC<{ title: string; brandColor: string; schoolName: string }> = ({ title, brandColor, schoolName }) => (
    <div className="mb-1">
        <div className="flex items-center gap-1 pb-0.5 mb-0.5" style={{ borderBottom: `1px solid ${brandColor}` }}>
            {schoolName && (
                <div
                    className="w-3 h-3 rounded-[2px] flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: brandColor, fontSize: '4px', fontWeight: 700 }}
                >
                    {schoolName.charAt(0)}
                </div>
            )}
            <span className="text-[5px] font-bold truncate" style={{ color: brandColor }}>
                {schoolName || title}
            </span>
        </div>
        {/* Name / Datum / Klasse Felder */}
        <div className="flex gap-1">
            <div className="flex-1">
                <div className="text-[3px] text-slate-400">Name:</div>
                <div className="h-[2px] border-b border-slate-300 dark:border-slate-500" />
            </div>
            <div className="w-4">
                <div className="text-[3px] text-slate-400">Datum:</div>
                <div className="h-[2px] border-b border-slate-300 dark:border-slate-500" />
            </div>
        </div>
    </div>
);

/** Mini-Task-Zeile */
const MiniTaskLine: React.FC<{ item: TaskPreviewItem; index: number }> = ({ item, index }) => {
    if (item.type === 'page-break') {
        return <div className="border-t border-dashed border-slate-300 dark:border-slate-500 my-0.5" />;
    }
    return (
        <div className="flex items-start gap-0.5 text-slate-600 dark:text-slate-400">
            <span className="text-[4px] font-bold shrink-0 mt-px">{index}.</span>
            <span className="text-[4px] text-slate-500 dark:text-slate-400 mt-px">{taskIcon(item.type)}</span>
            <span className="text-[4px] leading-tight truncate">{item.label}</span>
        </div>
    );
};

export const WorksheetCard: React.FC<WorksheetCardProps> = ({
    meta,
    isDeleting,
    isDuplicating,
    isExporting,
    isSharing,
    canShare,
    onOpen,
    onDuplicate,
    onExport,
    onShare,
    onDelete,
}) => {
    const subjects = useProfileStore((s) => s.subjects);
    const classes = useWorkspaceStore((s) => s.classProfiles);
    const brandColor = useSettingsStore((s) => s.brandColor);
    const schoolName = useSettingsStore((s) => s.schoolName);

    const subject = meta.subjectId ? subjects.find((s) => s.id === meta.subjectId) : null;
    const classProfile = meta.classId ? classes.find((c) => c.id === meta.classId) : null;
    const colors = getColorForSubject(meta.subjectId);
    const badgeLabel = [subject?.name, classProfile?.name].filter(Boolean).join(' · ');
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement | null>(null);
    const isBusy = isDeleting || isDuplicating || isExporting || isSharing;

    let taskNum = 0;

    React.useEffect(() => {
        if (!isMenuOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!menuRef.current) return;
            if (menuRef.current.contains(event.target as Node)) return;
            setIsMenuOpen(false);
        };

        window.addEventListener('pointerdown', handlePointerDown);
        return () => window.removeEventListener('pointerdown', handlePointerDown);
    }, [isMenuOpen]);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => !isBusy && onOpen(meta.id)}
            onKeyDown={(e) => { if (!isBusy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(meta.id); } }}
            aria-disabled={isBusy || undefined}
            className={`group relative flex flex-col w-44 shrink-0 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/40 rounded-xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-blue-400/60 dark:hover:border-blue-500/40 transition-all duration-200 cursor-pointer text-left snap-start ${isBusy ? 'opacity-60' : ''}`}
        >
            {/* ── Thumbnail: Screenshot oder Fallback ── */}
            <div className="relative w-full h-28 bg-slate-50 dark:bg-slate-900 overflow-hidden">
                {meta.thumbnailUrl ? (
                    /* Real screenshot captured on save */
                    <img
                        src={meta.thumbnailUrl}
                        alt={meta.title}
                        className="absolute inset-0 w-full h-full object-contain object-top"
                        draggable={false}
                    />
                ) : (
                    /* Fallback: Mini A4 Blatt aus Task-Daten */
                    <div className="absolute inset-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600/40 shadow-sm p-1.5 overflow-hidden">
                        <MiniHeader title={meta.title} brandColor={brandColor} schoolName={schoolName} />
                        <div className="space-y-0.5">
                            {meta.taskPreview.length > 0 ? (
                                meta.taskPreview.map((item, i) => {
                                    if (item.type !== 'page-break') taskNum++;
                                    return <MiniTaskLine key={i} item={item} index={taskNum} />;
                                })
                            ) : (
                                <div className="text-[4px] text-slate-300 dark:text-slate-600 italic text-center pt-2">
                                    Leer
                                </div>
                            )}
                            {meta.taskCount > (meta.taskPreview?.length ?? 0) && (
                                <div className="text-[3.5px] text-slate-300 dark:text-slate-500 text-center pt-0.5">
                                    + {meta.taskCount - meta.taskPreview.length} weitere …
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* Subtle gradient fade at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white dark:from-slate-800 to-transparent pointer-events-none" />
            </div>

            {/* ── Info-Bereich ── */}
            <div className="flex flex-col gap-1.5 px-3 py-2.5 flex-1 border-t border-slate-100 dark:border-slate-700/40">
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug">
                    {meta.title}
                </h4>

                <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center gap-1 min-w-0">
                        {badgeLabel && (
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full ${colors.bg} ${colors.text}`}>
                                {badgeLabel}
                            </span>
                        )}
                        {meta.variantCount > 1 && (
                            <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                                {meta.variantCount} Niveaus
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">
                        {timeAgo(meta.updatedAt)}
                    </span>
                </div>
            </div>

            {/* ── Aktionen (Dropdown) ── */}
            <div ref={menuRef} className="absolute top-2 right-2 z-20">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isBusy) return;
                        setIsMenuOpen((open) => !open);
                    }}
                    className="p-1 rounded-md bg-black/30 hover:bg-black/45 text-white transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Aktionen"
                    aria-label="Aktionen öffnen"
                    aria-expanded={isMenuOpen}
                    disabled={isBusy}
                >
                    <MoreVertical className={ICON_SIZES[12]} />
                </button>

                {isMenuOpen && (
                    <div
                        className="mt-1 w-40 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={(e) => {
                                setIsMenuOpen(false);
                                onDuplicate(e, meta);
                            }}
                            disabled={isBusy}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/70 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <Copy className={ICON_SIZES[12]} />
                            <span>{isDuplicating ? 'Dupliziere...' : 'Duplizieren'}</span>
                        </button>

                        <button
                            onClick={(e) => {
                                setIsMenuOpen(false);
                                onExport(e, meta);
                            }}
                            disabled={isBusy}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/70 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <FileDown className={ICON_SIZES[12]} />
                            <span>{isExporting ? 'Exportiere...' : 'Exportieren (.abgen)'}</span>
                        </button>

                        {canShare && (
                            <button
                                onClick={(e) => {
                                    setIsMenuOpen(false);
                                    onShare(e, meta);
                                }}
                                disabled={isBusy}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/70 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <Share2 className={ICON_SIZES[12]} />
                                <span>{isSharing ? 'Teile...' : 'Teilen'}</span>
                            </button>
                        )}

                        <button
                            onClick={(e) => {
                                setIsMenuOpen(false);
                                onDelete(e, meta);
                            }}
                            disabled={isBusy}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <Trash2 className={ICON_SIZES[12]} />
                            <span>Löschen</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
