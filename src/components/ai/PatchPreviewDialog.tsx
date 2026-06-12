import { AlertTriangle, ArrowRight, Check, Sparkles, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useWorksheetStore } from '../../store/worksheetStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { usePatchStore, formatApplyCounts } from '../../features/ai/patchStore';
import { summarizeOperation } from '../../features/ai/operations';
import { ICON_SIZES } from '../ui/iconSizes';

/* ══════════════════════════════════════════════════
   PatchPreviewDialog – Vorschau für KI-Änderungsvorschläge.

   Zeigt jede vorgeschlagene Operation mit Badge (Hinzufügen/Ändern/
   Löschen/…), betroffener Aufgabe und Vorher/Nachher-Auszug. Der
   Nutzer kann einzelne Vorschläge abwählen. Erst "Übernehmen" wendet
   die Auswahl an — die KI ändert nie unbestätigt das Arbeitsblatt.
   ══════════════════════════════════════════════════ */

const BADGE_STYLES: Record<string, string> = {
    add: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    change: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    remove: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export function PatchPreviewDialog() {
    const pendingPatch = usePatchStore((s) => s.pendingPatch);
    const toggleAccepted = usePatchStore((s) => s.toggleAccepted);
    const clearPatch = usePatchStore((s) => s.clearPatch);
    const applyAccepted = usePatchStore((s) => s.applyAccepted);
    const tasksById = useWorksheetStore((s) => s.tasksById);
    const taskIds = useWorksheetStore((s) => s.taskIds);

    if (!pendingPatch) return null;

    const acceptedCount = pendingPatch.accepted.filter(Boolean).length;

    const handleApply = () => {
        const source = pendingPatch.source;
        const counts = applyAccepted();
        // Bestätigung in den Chatverlauf schreiben, wenn der Patch dort entstand.
        if (source === 'chat') {
            useWorkspaceStore.getState().addChatMessage({
                role: 'assistant',
                content: formatApplyCounts(counts),
            });
        }
    };

    return (
        <Modal isOpen onClose={clearPatch} ariaLabel="KI-Änderungsvorschläge" className="w-full max-w-2xl">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-purple-50 dark:bg-purple-950/30">
                    <div className="shrink-0 mt-0.5 p-2 rounded-full bg-purple-100 dark:bg-purple-900/50">
                        <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                            KI-Änderungsvorschläge
                        </h2>
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                            Prüfe die Vorschläge — nichts wird ohne deine Bestätigung geändert.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={clearPatch}
                        className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Schließen"
                    >
                        <X className={ICON_SIZES[16]} />
                    </button>
                </div>

                {/* Verworfene Operationen (Validierungsfehler) */}
                {pendingPatch.errors.length > 0 && (
                    <div className="px-5 py-3 border-b border-amber-200/60 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20">
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">
                            <AlertTriangle className={ICON_SIZES[12]} />
                            Nicht anwendbar (von der KI fehlerhaft referenziert):
                        </div>
                        <ul className="text-xs text-amber-700/90 dark:text-amber-300/90 space-y-0.5 pl-5 list-disc">
                            {pendingPatch.errors.map((error, i) => <li key={i}>{error}</li>)}
                        </ul>
                    </div>
                )}

                {/* Vorschlagsliste */}
                <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {pendingPatch.operations.map((op, index) => {
                        const summary = summarizeOperation(op, tasksById, taskIds);
                        const isAccepted = pendingPatch.accepted[index];
                        return (
                            <li key={index} className={`px-5 py-3 ${isAccepted ? '' : 'opacity-45'}`}>
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isAccepted}
                                        onChange={() => toggleAccepted(index)}
                                        className="mt-1 accent-purple-600"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${BADGE_STYLES[summary.badgeTone]}`}>
                                                {summary.badge}
                                            </span>
                                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                                {summary.target}
                                            </span>
                                        </div>
                                        {(summary.before || summary.after) && (
                                            <div className="mt-1.5 text-xs leading-relaxed">
                                                {summary.before && (
                                                    <p className="text-slate-400 dark:text-slate-500 line-through decoration-slate-300 dark:decoration-slate-600">
                                                        {summary.before}
                                                    </p>
                                                )}
                                                {summary.after && (
                                                    <p className="flex items-start gap-1 text-slate-700 dark:text-slate-300">
                                                        <ArrowRight className={`${ICON_SIZES[12]} mt-0.5 shrink-0 text-slate-400`} />
                                                        <span>{summary.after}</span>
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </label>
                            </li>
                        );
                    })}
                </ul>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                        Übernommene Änderungen sind mit Strg+Z rückgängig machbar.
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={clearPatch}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Verwerfen
                        </button>
                        <button
                            type="button"
                            onClick={handleApply}
                            disabled={acceptedCount === 0}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Check className={ICON_SIZES[14]} />
                            Übernehmen ({acceptedCount})
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
