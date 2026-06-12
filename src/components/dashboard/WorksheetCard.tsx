import React from 'react';
import i18n from '../../i18n/config';
import {
    Trash2,
    CheckSquare,
    Type,
    Grid3X3,
    Image as ImageIcon,
    Columns,
    Calculator,
    Scissors,
    Copy,
    MoreVertical,
    FileDown,
    Share2,
    Heading,
    Table,
    Menu,
    Edit2,
    FolderPlus,
    Download,
    ChevronLeft,
    FileText,
    Star,
    Folder,
    Tag,
} from 'lucide-react';
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

interface LegacyWorksheetCardProps {
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

interface WorksheetCardProps {
    title: string;
    subject: string;
    date: string;
    taskCount: number;
    tasks?: any[];
    thumbnailUrl?: string;
    onOpen?: () => void;
    onRenameAction?: () => Promise<void> | void;
    onAssignAction?: () => Promise<void> | void;
    onDuplicateAction?: () => Promise<void> | void;
    onDeleteAction?: () => Promise<void> | void;
    onDownloadStudentAction?: () => Promise<void> | void;
    onDownloadTeacherAction?: () => Promise<void> | void;
    onDownloadAbgenAction?: () => Promise<void> | void;
    /* ── Bibliothek (Phase 7) ── */
    favorite?: boolean;
    tags?: string[];
    /** Verfügbare Ordner für das "Verschieben"-Untermenü. */
    folders?: { id: string; name: string; parentId: string | null }[];
    onToggleFavoriteAction?: () => Promise<void> | void;
    onMoveToFolderAction?: (folderId: string | undefined) => Promise<void> | void;
    onUpdateTagsAction?: (tags: string[]) => Promise<void> | void;
}

type WorksheetCardComponentProps = LegacyWorksheetCardProps | WorksheetCardProps;

function isLegacyWorksheetCardProps(props: WorksheetCardComponentProps): props is LegacyWorksheetCardProps {
    return 'meta' in props;
}

/** Relative Zeitangabe */
function timeAgo(date: Date): string {
    const t = i18n.t.bind(i18n);
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('common.justNow');
    if (minutes < 60) return t('common.minutesAgo', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('common.hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    if (days === 1) return t('common.yesterday');
    return t('common.daysAgo', { count: days });
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
        case 'image-placeholder': return <ImageIcon className={`${ICON_SIZES[7]} shrink-0`} />;
        case 'columns': return <Columns className={`${ICON_SIZES[7]} shrink-0`} />;
        case 'table': return <Table className={`${ICON_SIZES[7]} shrink-0`} />;
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

const recentMenuButtonClassName =
    'flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors';

const LegacyWorksheetCard: React.FC<LegacyWorksheetCardProps> = ({
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
                                    {i18n.t('common.empty')}
                                </div>
                            )}
                            {meta.taskCount > (meta.taskPreview?.length ?? 0) && (
                                <div className="text-[3.5px] text-slate-300 dark:text-slate-500 text-center pt-0.5">
                                    {i18n.t('common.moreItems', { count: meta.taskCount - meta.taskPreview.length })}
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
                                {i18n.t('common.levels', { count: meta.variantCount })}
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
                    title={i18n.t('common.actions')}
                    aria-label={i18n.t('common.actions')}
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
                            <span>{isDuplicating ? i18n.t('common.duplicating') : i18n.t('common.duplicate')}</span>
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
                            <span>{isExporting ? i18n.t('common.exporting') : i18n.t('worksheetCard.exportAbgen')}</span>
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
                                <span>{isSharing ? i18n.t('common.sharing') : i18n.t('common.share')}</span>
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
                            <span>{i18n.t('common.delete')}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const RecentWorksheetCard: React.FC<WorksheetCardProps> = ({
    title,
    subject,
    date,
    taskCount,
    tasks,
    onOpen,
    onRenameAction,
    onAssignAction,
    onDuplicateAction,
    onDeleteAction,
    onDownloadStudentAction,
    onDownloadTeacherAction,
    onDownloadAbgenAction,
    favorite = false,
    tags = [],
    folders = [],
    onToggleFavoriteAction,
    onMoveToFolderAction,
    onUpdateTagsAction,
}) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [showDownloadMenu, setShowDownloadMenu] = React.useState(false);
    const [showMoveMenu, setShowMoveMenu] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement | null>(null);
    const previewTasks = (tasks || []).slice(0, 3);

    React.useEffect(() => {
        if (!isMenuOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!menuRef.current) return;
            if (menuRef.current.contains(event.target as Node)) return;
            setIsMenuOpen(false);
            setShowDownloadMenu(false);
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsMenuOpen(false);
            setShowDownloadMenu(false);
            setShowMoveMenu(false);
        };

        window.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('keydown', handleEscape);
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isMenuOpen]);

    const runAction = async (action?: () => Promise<void> | void) => {
        try {
            await action?.();
        } catch (error) {
            console.error('Worksheet action failed:', error);
        } finally {
            setIsMenuOpen(false);
            setShowDownloadMenu(false);
            setShowMoveMenu(false);
        }
    };

    return (
        <article
            role="button"
            tabIndex={0}
            onClick={() => {
                if (isMenuOpen) {
                    setIsMenuOpen(false);
                    setShowDownloadMenu(false);
                    return;
                }
                onOpen?.();
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpen?.();
                }
            }}
            className="relative rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700/60 transition hover:-translate-y-0.5 hover:ring-slate-300 dark:hover:ring-slate-500/80"
        >
            <div className="relative aspect-video bg-white dark:bg-slate-900 p-3 overflow-hidden border-b border-slate-200 dark:border-slate-800">
                <div className="transform scale-[0.6] origin-top-left w-[166%] h-[166%] pointer-events-none flex flex-col gap-4">
                    {previewTasks.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
                                <FileText size={16} />
                                <span className="text-[10px]">Leeres Arbeitsblatt</span>
                            </div>
                        </div>
                    ) : (
                        previewTasks.map((task, index) => {
                            const taskType = typeof task?.type === 'string' ? task.type : 'text';

                            if (taskType === 'lines' || taskType === 'lineatur') {
                                return (
                                    <div key={index} className="flex flex-col gap-1 w-full">
                                        <div className="border-b border-slate-300 dark:border-slate-600 w-full h-2" />
                                        <div className="border-b border-slate-300 dark:border-slate-600 w-full h-2" />
                                        <div className="border-b border-slate-300 dark:border-slate-600 w-full h-2" />
                                    </div>
                                );
                            }

                            if (taskType === 'image' || taskType === 'image-placeholder') {
                                return (
                                    <div
                                        key={index}
                                        className="w-full h-16 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                                    >
                                        <ImageIcon size={16} className="text-slate-400" />
                                    </div>
                                );
                            }

                            const rawContent = typeof task?.content === 'string' ? task.content : '';

                            return (
                                <div
                                    key={index}
                                    className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed"
                                >
                                    {rawContent ? rawContent.replace(/<[^>]+>/g, '') : 'Textblock...'}
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white dark:from-slate-900 to-transparent z-10" />
            </div>

            <div ref={menuRef} className="absolute top-2 right-2 z-50">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsMenuOpen(!isMenuOpen);
                        if (isMenuOpen) {
                            setShowDownloadMenu(false);
                        }
                    }}
                    className="absolute top-0 right-0 z-20 p-1.5 rounded-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all"
                >
                    <Menu size={18} />
                </button>

                {isMenuOpen && (
                    <div
                        className="absolute top-10 right-0 w-56 bg-white border border-slate-200 shadow-xl dark:bg-slate-800 dark:border-slate-700 rounded-md z-50 overflow-hidden flex flex-col"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {!showDownloadMenu && !showMoveMenu ? (
                            <>
                                <button
                                    onClick={() => {
                                        void runAction(onRenameAction);
                                    }}
                                    className={recentMenuButtonClassName}
                                >
                                    <Edit2 size={16} />
                                    Umbenennen
                                </button>
                                <button
                                    onClick={() => {
                                        void runAction(onToggleFavoriteAction);
                                    }}
                                    className={recentMenuButtonClassName}
                                >
                                    <Star size={16} className={favorite ? 'fill-amber-400 text-amber-400' : ''} />
                                    {favorite ? 'Favorit entfernen' : 'Als Favorit markieren'}
                                </button>
                                <button
                                    onClick={() => setShowMoveMenu(true)}
                                    className={recentMenuButtonClassName}
                                >
                                    <Folder size={16} />
                                    In Ordner verschieben
                                </button>
                                <button
                                    onClick={() => {
                                        const input = window.prompt(
                                            'Tags (kommagetrennt):',
                                            tags.join(', '),
                                        );
                                        if (input === null) return;
                                        void runAction(() => onUpdateTagsAction?.(
                                            input.split(',').map((t) => t.trim()).filter(Boolean),
                                        ));
                                    }}
                                    className={recentMenuButtonClassName}
                                >
                                    <Tag size={16} />
                                    Tags bearbeiten…
                                </button>
                                <hr className="border-slate-200 dark:border-slate-700" />
                                <button
                                    onClick={() => {
                                        void runAction(onAssignAction);
                                    }}
                                    className={recentMenuButtonClassName}
                                >
                                    <FolderPlus size={16} />
                                    Klasse/Fach zuordnen
                                </button>
                                <button
                                    onClick={() => {
                                        void runAction(onDuplicateAction);
                                    }}
                                    className={recentMenuButtonClassName}
                                >
                                    <Copy size={16} />
                                    Duplizieren
                                </button>
                                <button
                                    onClick={() => setShowDownloadMenu(true)}
                                    className={recentMenuButtonClassName}
                                >
                                    <Download size={16} />
                                    Herunterladen
                                </button>
                                <hr className="border-slate-200 dark:border-slate-700" />
                                <button
                                    onClick={() => {
                                        void runAction(onDeleteAction);
                                    }}
                                    className={`${recentMenuButtonClassName} text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-slate-700/50`}
                                >
                                    <Trash2 size={16} />
                                    Löschen
                                </button>
                            </>
                        ) : showMoveMenu ? (
                            <>
                                <button
                                    onClick={() => setShowMoveMenu(false)}
                                    className={recentMenuButtonClassName}
                                >
                                    <ChevronLeft size={16} />
                                    Zurück
                                </button>
                                <hr className="border-slate-200 dark:border-slate-700" />
                                <button
                                    onClick={() => {
                                        void runAction(() => onMoveToFolderAction?.(undefined));
                                    }}
                                    className={recentMenuButtonClassName}
                                >
                                    <Folder size={16} className="opacity-40" />
                                    Unsortiert
                                </button>
                                {folders.map((folder) => (
                                    <button
                                        key={folder.id}
                                        onClick={() => {
                                            void runAction(() => onMoveToFolderAction?.(folder.id));
                                        }}
                                        className={recentMenuButtonClassName}
                                    >
                                        <Folder size={16} className={folder.parentId ? 'ml-3' : ''} />
                                        {folder.name}
                                    </button>
                                ))}
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setShowDownloadMenu(false)}
                                    className={recentMenuButtonClassName}
                                >
                                    <ChevronLeft size={16} />
                                    Zurück
                                </button>
                                <hr className="border-slate-200 dark:border-slate-700" />
                                <button
                                    onClick={() => {
                                        void runAction(onDownloadStudentAction);
                                    }}
                                    className={recentMenuButtonClassName}
                                >
                                    <FileText size={16} />
                                    Schülerversion
                                </button>
                                <button
                                    onClick={() => {
                                        void runAction(onDownloadTeacherAction);
                                    }}
                                    className={recentMenuButtonClassName}
                                >
                                    <FileText size={16} />
                                    Lehrerversion (mit Lösung)
                                </button>
                                <hr className="border-slate-200 dark:border-slate-700" />
                                <button
                                    onClick={() => {
                                        void runAction(onDownloadAbgenAction);
                                    }}
                                    className={recentMenuButtonClassName}
                                >
                                    <FileDown size={16} />
                                    .abgen (Teilen / Editor)
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="p-4 flex flex-col gap-2">
                <h3 className="flex items-center gap-1.5 text-base font-semibold text-slate-900 dark:text-white">
                    {favorite && <Star size={15} className="shrink-0 fill-amber-400 text-amber-400" />}
                    <span className="truncate">{title}</span>
                </h3>
                <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>{date}</span>
                    <span>{taskCount} {taskCount === 1 ? 'Aufgabe' : 'Aufgaben'}</span>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                    {subject || 'Ohne Fach'}
                </div>
                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </article>
    );
};

export const WorksheetCard: React.FC<WorksheetCardComponentProps> = (props) => {
    if (isLegacyWorksheetCardProps(props)) {
        return <LegacyWorksheetCard {...props} />;
    }

    return <RecentWorksheetCard {...props} />;
};
