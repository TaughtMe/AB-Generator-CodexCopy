import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
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
    const { recentWorksheets, loadRecent, openWorksheet, createNewWorksheet, removeWorksheet, filter, setFilter } =
        useWorkspaceStore();

    const [deletingId, setDeletingId] = useState<string | null>(null);

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

    const handleFilterChange = (newFilter: WorksheetFilter) => {
        setFilter(newFilter);
    };

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 md:py-10">
            {/* ── Aktions-Hub (oben) ── */}
            <ActionHub
                onNewWorksheet={handleNewWorksheet}
                onOpenAIChat={onOpenAIChat}
                onOpenDesignEditor={onOpenDesignEditor}
                onResumeLastWorksheet={handleResumeLastWorksheet}
                hasRecentWorksheet={recentWorksheets.length > 0}
            />

            {/* ── Materialien (unten) ── */}
            <section>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">
                        Zuletzt bearbeitet
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
                    onOpen={handleOpenWorksheet}
                    onDelete={handleDelete}
                />
            </section>
        </div>
    );
};
