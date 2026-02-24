import React from 'react';
import { FileText } from 'lucide-react';
import { WorksheetCard } from './WorksheetCard';
import type { WorksheetMeta } from '../../store/dexieStore';
import { ICON_SIZES } from '../ui/iconSizes';

/* ══════════════════════════════════════════════════
   WorksheetGrid.tsx – Horizontal-Scroll-Container
   Zeigt Karten in einer scrollbaren Reihe.
   ══════════════════════════════════════════════════ */

interface WorksheetGridProps {
    worksheets: WorksheetMeta[];
    deletingId: string | null;
    duplicatingId: string | null;
    exportingId: string | null;
    sharingId: string | null;
    canShareWorksheetFiles: boolean;
    onOpen: (id: string) => void;
    onDuplicate: (e: React.MouseEvent, meta: WorksheetMeta) => void;
    onExport: (e: React.MouseEvent, meta: WorksheetMeta) => void;
    onShare: (e: React.MouseEvent, meta: WorksheetMeta) => void;
    onDelete: (e: React.MouseEvent, meta: WorksheetMeta) => void;
}

export const WorksheetGrid: React.FC<WorksheetGridProps> = ({
    worksheets,
    deletingId,
    duplicatingId,
    exportingId,
    sharingId,
    canShareWorksheetFiles,
    onOpen,
    onDuplicate,
    onExport,
    onShare,
    onDelete,
}) => {
    if (worksheets.length === 0) {
        return (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700/40 rounded-2xl bg-white/50 dark:bg-slate-800/20">
                <FileText className={`${ICON_SIZES[36]} mx-auto text-slate-300 dark:text-slate-600 mb-3 opacity-60`} />
                <p className="text-sm text-slate-400 dark:text-slate-500">
                    Keine Arbeitsblätter gefunden.
                </p>
                <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">
                    Erstelle dein erstes Arbeitsblatt über die Buttons oben.
                </p>
            </div>
        );
    }

    return (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
            {worksheets.map((meta) => (
                <WorksheetCard
                    key={meta.id}
                    meta={meta}
                    isDeleting={deletingId === meta.id}
                    isDuplicating={duplicatingId === meta.id}
                    isExporting={exportingId === meta.id}
                    isSharing={sharingId === meta.id}
                    canShare={canShareWorksheetFiles}
                    onOpen={onOpen}
                    onDuplicate={onDuplicate}
                    onExport={onExport}
                    onShare={onShare}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
};
