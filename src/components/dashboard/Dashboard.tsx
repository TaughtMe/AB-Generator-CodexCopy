import React, { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { ActionHub } from './ActionHub';
import { FilterBar } from './FilterBar';
import { WorksheetGrid } from './WorksheetGrid';
import { PreCreationChatModal } from './PreCreationChatModal';
import type { WorksheetMeta, WorksheetFilter } from '../../store/dexieStore';
import { ICON_SIZES } from '../ui/iconSizes';

/* ══════════════════════════════════════════════════
   Dashboard.tsx – Startseite / "Lehrer-Schreibtisch"
   Orchestriert ActionHub (oben) + FilterBar + Grid (unten).
   Die Sidebar wird von AppShell bereitgestellt.
   ══════════════════════════════════════════════════ */

interface DashboardProps {
    onOpenEditor: () => void;
    onOpenAIChat: () => void;
    onOpenDesignEditor: () => void;
    onOpenSettings: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenEditor, onOpenDesignEditor, onOpenSettings }) => {
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
        importWorksheet,
        filter,
        setFilter,
        openTemplateGallery,
    } = useWorkspaceStore();

    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
    const [exportingId, setExportingId] = useState<string | null>(null);
    const [sharingId, setSharingId] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isPreCreationChatOpen, setIsPreCreationChatOpen] = useState(false);
    const [fileInputKey, setFileInputKey] = useState(0);
    const importInputRef = React.useRef<HTMLInputElement | null>(null);

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
        if (deletingId === meta.id || duplicatingId === meta.id) return;
        setDeletingId(meta.id);
        await removeWorksheet(meta.id);
        setDeletingId(null);
    };

    const handleDuplicate = async (e: React.MouseEvent, meta: WorksheetMeta) => {
        e.stopPropagation();
        if (deletingId === meta.id || duplicatingId === meta.id) return;
        setDuplicatingId(meta.id);
        try {
            await duplicateWorksheet(meta.id);
        } finally {
            setDuplicatingId(null);
        }
    };

    const handleExport = async (e: React.MouseEvent, meta: WorksheetMeta) => {
        e.stopPropagation();
        if ([deletingId, duplicatingId, exportingId, sharingId].includes(meta.id)) return;
        setExportingId(meta.id);
        try {
            await exportWorksheet(meta.id);
        } catch (error) {
            window.alert('Export fehlgeschlagen.\n\n' + String(error));
        } finally {
            setExportingId(null);
        }
    };

    const handleShare = async (e: React.MouseEvent, meta: WorksheetMeta) => {
        e.stopPropagation();
        if ([deletingId, duplicatingId, exportingId, sharingId].includes(meta.id)) return;
        setSharingId(meta.id);
        try {
            await shareWorksheet(meta.id);
        } catch (error) {
            window.alert('Teilen fehlgeschlagen.\n\n' + String(error));
        } finally {
            setSharingId(null);
        }
    };

    const handleFilterChange = (newFilter: WorksheetFilter) => {
        setFilter(newFilter);
    };

    const handleOpenImportPicker = () => {
        if (isImporting) return;
        importInputRef.current?.click();
    };

    const handleOpenPreCreationChat = () => {
        setIsPreCreationChatOpen(true);
    };

    const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const importedId = await importWorksheet(file);
            if (importedId) {
                const ok = await openWorksheet(importedId);
                if (ok) onOpenEditor();
            }
        } catch (error) {
            window.alert('Import fehlgeschlagen.\n\n' + String(error));
        } finally {
            setIsImporting(false);
            e.target.value = '';
            setFileInputKey((prev) => prev + 1);
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 md:py-10">
            <input
                key={fileInputKey}
                ref={importInputRef}
                type="file"
                accept=".abgen,application/json"
                className="hidden"
                onChange={handleImportFileChange}
            />

            <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Dashboard</h2>
                <button
                    onClick={onOpenSettings}
                    data-tour="dashboard-settings"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
                    title="Globale Einstellungen öffnen"
                >
                    <Settings className={ICON_SIZES[16]} />
                    Einstellungen
                </button>
            </div>

            {/* ── Aktions-Hub (oben) ── */}
            <ActionHub
                onNewWorksheet={handleNewWorksheet}
                onOpenAIChat={handleOpenPreCreationChat}
                onOpenDesignEditor={onOpenDesignEditor}
                onBrowseTemplates={openTemplateGallery}
                onImportWorksheet={handleOpenImportPicker}
                onResumeLastWorksheet={handleResumeLastWorksheet}
                hasRecentWorksheet={recentWorksheets.length > 0}
                isImportingWorksheet={isImporting}
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

            <PreCreationChatModal
                isOpen={isPreCreationChatOpen}
                onClose={() => setIsPreCreationChatOpen(false)}
                onOpenEditor={onOpenEditor}
            />
        </div>
    );
};
