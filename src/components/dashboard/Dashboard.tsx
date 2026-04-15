import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useShallow } from 'zustand/react/shallow';
import { ActionHub } from './ActionHub';
import { FilterBar } from './FilterBar';
import { WorksheetGrid } from './WorksheetGrid';
import type { WorksheetMeta, WorksheetFilter } from '../../store/dexieStore';

/* ══════════════════════════════════════════════════
   Dashboard.tsx – Startseite / "Lehrer-Schreibtisch"
   Orchestriert ActionHub (oben) + FilterBar + Grid (unten).
   Die Sidebar wird von AppShell bereitgestellt.
   ══════════════════════════════════════════════════ */

interface DashboardProps {
    onOpenEditor: () => void;
    onOpenAIChat: () => void;
    onOpenDesignEditor: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenEditor, onOpenAIChat, onOpenDesignEditor }) => {
    const { t } = useTranslation();
    const {
        recentWorksheets,
        loadRecent,
        openWorksheet,
        createNewWorksheet,
        removeWorksheet,
        duplicateWorksheet,
        exportWorksheet,
        shareWorksheet,
        canShareWorksheetFiles,
        filter,
        setFilter,
        openTemplateGallery,
    } = useWorkspaceStore(useShallow((s) => ({
        recentWorksheets: s.recentWorksheets,
        loadRecent: s.loadRecent,
        openWorksheet: s.openWorksheet,
        createNewWorksheet: s.createNewWorksheet,
        removeWorksheet: s.removeWorksheet,
        duplicateWorksheet: s.duplicateWorksheet,
        exportWorksheet: s.exportWorksheet,
        shareWorksheet: s.shareWorksheet,
        canShareWorksheetFiles: s.canShareWorksheetFiles,
        filter: s.filter,
        setFilter: s.setFilter,
        openTemplateGallery: s.openTemplateGallery,
    })));

    const GREETINGS = [
        t('dashboard.greetings.hello'),
        t('dashboard.greetings.welcomeBack'),
        t('dashboard.greetings.readyForClass'),
        t('dashboard.greetings.niceToSeeYou'),
    ];
    const greeting = useMemo(
        () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
    const [exportingId, setExportingId] = useState<string | null>(null);
    const [sharingId, setSharingId] = useState<string | null>(null);

    useEffect(() => {
        loadRecent();
    }, [loadRecent]);

    const handleNewWorksheet = () => {
        createNewWorksheet();
        onOpenEditor();
    };

    const handleOpenWorksheet = async (id: string) => {
        const ok = await openWorksheet(id);
        if (ok) onOpenEditor();
    };

    const handleResumeLastWorksheet = async () => {
        if (recentWorksheets.length > 0) {
            await handleOpenWorksheet(recentWorksheets[0].id);
        }
    };

    const handleDelete = async (e: React.MouseEvent, meta: WorksheetMeta) => {
        e.stopPropagation();
        setDeletingId(meta.id);
        await removeWorksheet(meta.id);
        setDeletingId(null);
    };

    const handleDuplicate = async (e: React.MouseEvent, meta: WorksheetMeta) => {
        e.stopPropagation();
        setDuplicatingId(meta.id);
        try {
            await duplicateWorksheet(meta.id);
        } finally {
            setDuplicatingId(null);
        }
    };

    const handleExport = async (e: React.MouseEvent, meta: WorksheetMeta) => {
        e.stopPropagation();
        setExportingId(meta.id);
        try {
            await exportWorksheet(meta.id);
        } finally {
            setExportingId(null);
        }
    };

    const handleShare = async (e: React.MouseEvent, meta: WorksheetMeta) => {
        e.stopPropagation();
        setSharingId(meta.id);
        try {
            await shareWorksheet(meta.id);
        } finally {
            setSharingId(null);
        }
    };

    const handleFilterChange = (newFilter: WorksheetFilter) => {
        setFilter(newFilter);
    };

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 md:py-10">
            <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">{greeting}</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{t('dashboard.subtitle')}</p>
            </div>

            {/* ── Aktions-Hub (oben) ── */}
            <ActionHub
                onNewWorksheet={handleNewWorksheet}
                onOpenAIChat={onOpenAIChat}
                onOpenDesignEditor={onOpenDesignEditor}
                onBrowseTemplates={openTemplateGallery}
                onResumeLastWorksheet={handleResumeLastWorksheet}
                hasRecentWorksheet={recentWorksheets.length > 0}
            />

            {/* ── Materialien (unten) ── */}
            <section>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">
                        {t('dashboard.recentlyEdited')}
                    </h3>

                    <FilterBar
                        filter={filter}
                        onFilterChange={handleFilterChange}
                        resultCount={recentWorksheets.length}
                    />
                </div>

                <WorksheetGrid
                    worksheets={recentWorksheets}
                    deletingId={deletingId}
                    duplicatingId={duplicatingId}
                    exportingId={exportingId}
                    sharingId={sharingId}
                    canShareWorksheetFiles={canShareWorksheetFiles()}
                    onOpen={handleOpenWorksheet}
                    onDuplicate={handleDuplicate}
                    onExport={handleExport}
                    onShare={handleShare}
                    onDelete={handleDelete}
                />
            </section>
        </div>
    );
};
