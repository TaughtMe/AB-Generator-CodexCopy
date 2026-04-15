import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Trash, Trash2 } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useProfileStore } from '../../store/profileStore';
import { ICON_SIZES } from '../ui/iconSizes';

const DAY_MS = 86400000;
const RETENTION_DAYS = 30;

function getDaysUntilDeletion(deletedAt?: number): number {
    if (typeof deletedAt !== 'number' || !Number.isFinite(deletedAt)) return RETENTION_DAYS;
    const daysPassed = Math.floor((Date.now() - deletedAt) / DAY_MS);
    return Math.max(0, RETENTION_DAYS - daysPassed);
}

function formatDeletionHint(deletedAt?: number): string {
    const days = getDaysUntilDeletion(deletedAt);
    if (days === 0) return '@@today';
    if (days === 1) return '@@tomorrow';
    return `@@days:${days}`;
}

function formatDeletedDate(deletedAt?: number): string {
    if (typeof deletedAt !== 'number') return '@@unknown';
    try {
        return new Date(deletedAt).toLocaleDateString(undefined, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch {
        return '@@unknown';
    }
}

export const TrashView: React.FC = () => {
    const { t } = useTranslation();
    const trashedWorksheets = useWorkspaceStore((s) => s.trashedWorksheets);
    const loadTrash = useWorkspaceStore((s) => s.loadTrash);
    const restoreWorksheet = useWorkspaceStore((s) => s.restoreWorksheet);
    const hardDeleteWorksheet = useWorkspaceStore((s) => s.hardDeleteWorksheet);
    const emptyTrash = useWorkspaceStore((s) => s.emptyTrash);
    const subjects = useProfileStore((s) => s.subjects);
    const classes = useWorkspaceStore((s) => s.classProfiles);

    const [busyItemId, setBusyItemId] = useState<string | null>(null);
    const [isEmptying, setIsEmptying] = useState(false);

    useEffect(() => {
        void loadTrash();
    }, [loadTrash]);

    const handleRestore = async (id: string) => {
        if (busyItemId || isEmptying) return;
        setBusyItemId(id);
        try {
            await restoreWorksheet(id);
        } finally {
            setBusyItemId(null);
        }
    };

    const handleHardDelete = async (id: string, title: string) => {
        if (busyItemId || isEmptying) return;
        const confirmed = window.confirm(t('trash.confirmDelete', { title }));
        if (!confirmed) return;

        setBusyItemId(id);
        try {
            await hardDeleteWorksheet(id);
        } finally {
            setBusyItemId(null);
        }
    };

    const handleEmptyTrash = async () => {
        if (trashedWorksheets.length === 0 || busyItemId || isEmptying) return;
        const confirmed = window.confirm(t('trash.confirmEmptyTrash'));
        if (!confirmed) return;

        setIsEmptying(true);
        try {
            await emptyTrash();
        } finally {
            setIsEmptying(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 md:py-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">{t('trash.title')}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('trash.description')}
                    </p>
                </div>

                <button
                    onClick={handleEmptyTrash}
                    disabled={trashedWorksheets.length === 0 || !!busyItemId || isEmptying}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    <Trash2 className={ICON_SIZES[16]} />
                    {isEmptying ? t('trash.emptying') : t('trash.emptyTrash')}
                </button>
            </div>

            {trashedWorksheets.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700/40 rounded-2xl bg-white/50 dark:bg-slate-800/20">
                    <Trash2 className={`${ICON_SIZES[36]} mx-auto text-slate-300 dark:text-slate-600 mb-3 opacity-60`} />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t('trash.emptyState')}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        {t('trash.emptyStateDesc')}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {trashedWorksheets.map((meta) => {
                        const subject = meta.subjectId ? subjects.find((s) => s.id === meta.subjectId) : null;
                        const classProfile = meta.classId ? classes.find((c) => c.id === meta.classId) : null;
                        const contextLabel = [subject?.name, classProfile?.name].filter(Boolean).join(' · ');
                        const isBusy = busyItemId === meta.id || isEmptying;

                        return (
                            <article
                                key={meta.id}
                                className={`rounded-2xl border border-slate-200/80 dark:border-slate-700/50 bg-white dark:bg-slate-800 shadow-sm p-4 ${isBusy ? 'opacity-70' : ''}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                            {meta.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            {t('trash.deletedOn', { date: (() => { const raw = formatDeletedDate(meta.deletedAt); return raw === '@@unknown' ? t('common.unknown') : raw; })() })}
                                        </p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 px-2 py-1 text-[10px] font-semibold whitespace-nowrap">
                                        {(() => { const hint = formatDeletionHint(meta.deletedAt); if (hint === '@@today') return t('trash.deletedToday'); if (hint === '@@tomorrow') return t('trash.deletedTomorrow'); const days = hint.split(':')[1]; return t('trash.deletedInDays', { count: Number(days) }); })()}
                                    </span>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="rounded-full bg-slate-100 dark:bg-slate-700/60 px-2 py-1">
                                        {t('common.tasks', { count: meta.taskCount })}
                                    </span>
                                    {meta.variantCount > 1 && (
                                        <span className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 px-2 py-1">
                                            {t('common.levels', { count: meta.variantCount })}
                                        </span>
                                    )}
                                    {contextLabel && (
                                        <span className="rounded-full bg-slate-100 dark:bg-slate-700/60 px-2 py-1 truncate max-w-full">
                                            {contextLabel}
                                        </span>
                                    )}
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                        onClick={() => void handleRestore(meta.id)}
                                        disabled={isBusy}
                                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        <RotateCcw className={ICON_SIZES[14]} />
                                        {t('common.restore')}
                                    </button>
                                    <button
                                        onClick={() => void handleHardDelete(meta.id, meta.title)}
                                        disabled={isBusy}
                                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        <Trash className={ICON_SIZES[14]} />
                                        {t('trash.permanentDelete')}
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
