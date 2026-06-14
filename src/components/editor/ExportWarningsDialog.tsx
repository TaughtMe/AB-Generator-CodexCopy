import { useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2, Sparkles, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import type { ValidationWarning } from '../../utils/exportValidator';
import { ICON_SIZES } from '../ui/iconSizes';
import { useWorksheetStore } from '../../store/worksheetStore';
import { runAI } from '../../features/ai/runAI';
import { isActiveProviderConfigured, type ExportAnalysisHint } from '../../services/aiService';

/* ══════════════════════════════════════════════════
   ExportWarningsDialog – Ersetzt window.confirm vor dem Export.

   Zeigt alle Validierungswarnungen als Liste. Pro Warnung kann der
   Nutzer direkt zur betroffenen Aufgabe springen (Dialog schließt,
   Aufgabe wird aktiviert und ins Sichtfeld gescrollt). Alternativ
   kann trotzdem exportiert oder abgebrochen werden.
   ══════════════════════════════════════════════════ */

interface ExportWarningsDialogProps {
    warnings: ValidationWarning[];
    /** Label des ausstehenden Exports, z. B. "PDF (Schülerversion)" */
    exportLabel: string;
    onJumpToTask: (taskId: string) => void;
    onExportAnyway: () => void;
    onCancel: () => void;
}

const HINT_DOT_CLASS: Record<ExportAnalysisHint['severity'], string> = {
    warning: 'bg-amber-400',
    suggestion: 'bg-blue-400',
    info: 'bg-slate-400',
};

export function ExportWarningsDialog({
    warnings,
    exportLabel,
    onJumpToTask,
    onExportAnyway,
    onCancel,
}: ExportWarningsDialogProps) {
    const [aiHints, setAiHints] = useState<ExportAnalysisHint[] | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState<string | null>(null);
    const providerReady = isActiveProviderConfigured();

    const handleAnalyze = async () => {
        if (isAnalyzing) return;
        setIsAnalyzing(true);
        setAnalyzeError(null);
        try {
            const { tasksById, taskIds } = useWorksheetStore.getState();
            const { output } = await runAI({
                route: 'exportAnalysis',
                input: { tasksById, taskIds },
            });
            setAiHints(output.hints);
        } catch (error) {
            setAnalyzeError(error instanceof Error ? error.message : 'KI-Analyse fehlgeschlagen.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <Modal
            isOpen={warnings.length > 0}
            onClose={onCancel}
            ariaLabel="Export-Warnungen"
            className="w-full max-w-lg"
        >
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-950/30">
                    <div className="shrink-0 mt-0.5 p-2 rounded-full bg-amber-100 dark:bg-amber-900/50">
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                            Mögliche Exportprobleme
                        </h2>
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                            {warnings.length === 1
                                ? 'Eine Aufgabe könnte im Export fehlerhaft erscheinen.'
                                : `${warnings.length} Stellen könnten im Export fehlerhaft erscheinen.`}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Schließen"
                    >
                        <X className={ICON_SIZES[16]} />
                    </button>
                </div>

                {/* Warnungsliste */}
                <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {warnings.map((warning, index) => (
                        <li key={`${warning.taskId}-${index}`} className="flex items-center gap-3 px-5 py-3">
                            <span
                                className={`shrink-0 h-2 w-2 rounded-full ${
                                    warning.severity === 'info' ? 'bg-blue-400' : 'bg-amber-400'
                                }`}
                                title={warning.severity === 'info' ? 'Hinweis' : 'Warnung'}
                            />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                    {warning.taskTitle || 'Unbenannte Aufgabe'}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {warning.message}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onJumpToTask(warning.taskId)}
                                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                            >
                                Zur Aufgabe
                                <ArrowRight className={ICON_SIZES[12]} />
                            </button>
                        </li>
                    ))}
                </ul>

                {/* KI-Analyse (nur auf Knopfdruck) */}
                <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">KI-Analyse</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Inhaltliche/didaktische Hinweise vor dem Export – ergänzend zur Prüfung oben.
                            </p>
                        </div>
                        <button
                            type="button"
                            data-ai-analyze-btn
                            onClick={handleAnalyze}
                            disabled={!providerReady || isAnalyzing}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                        >
                            {isAnalyzing
                                ? <Loader2 className={`${ICON_SIZES[14]} animate-spin`} />
                                : <Sparkles className={ICON_SIZES[14]} />}
                            {aiHints !== null ? 'Erneut prüfen' : 'Arbeitsblatt prüfen'}
                        </button>
                    </div>

                    {!providerReady && (
                        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                            KI nicht konfiguriert – bitte zuerst in den Einstellungen einen Anbieter hinterlegen.
                        </p>
                    )}
                    {analyzeError && (
                        <p className="mt-2 text-xs text-rose-500 dark:text-rose-400">{analyzeError}</p>
                    )}
                    {aiHints !== null && aiHints.length === 0 && !analyzeError && (
                        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                            Keine KI-Hinweise – das Arbeitsblatt wirkt stimmig.
                        </p>
                    )}
                    {aiHints !== null && aiHints.length > 0 && (
                        <ul data-ai-hints className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                            {aiHints.map((hint, index) => (
                                <li key={index} className="flex items-start gap-2.5">
                                    <span className={`mt-1.5 shrink-0 h-2 w-2 rounded-full ${HINT_DOT_CLASS[hint.severity]}`} />
                                    <p className="text-xs text-slate-600 dark:text-slate-300">
                                        {hint.taskRef && (
                                            <span className="font-medium text-slate-700 dark:text-slate-200">{hint.taskRef}: </span>
                                        )}
                                        {hint.message}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Abbrechen
                    </button>
                    <button
                        type="button"
                        onClick={onExportAnyway}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                    >
                        Trotzdem exportieren ({exportLabel})
                    </button>
                </div>
            </div>
        </Modal>
    );
}
