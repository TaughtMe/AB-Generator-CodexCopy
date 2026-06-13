import { useAITelemetryStore } from '../../features/ai/aiTelemetry';
import { AI_ROUTES } from '../../features/ai/aiRoutes';
import { formatTokenCount } from '../../features/ai/tokenEstimate';

/* ══════════════════════════════════════════════════
   LastAIRunInfo – zeigt die Metadaten des letzten KI-Aufrufs (§5/§7).

   Speist sich aus der zentralen runAI-Telemetrie (nicht aus lokaler
   Komponenten-Logik): Route, effektiv genutztes Modell, geschätzte
   In-/Output-Tokens und Dauer der zuletzt ausgeführten KI-Anfrage.
   Bei Fehlern wird die Zeile rot dargestellt und die Fehlermeldung als
   Tooltip angeboten.

   Bewusst rein darstellend + ohne Props, damit die KI-Anzeige nicht in
   EditorChatSidebar „festwächst".
   ══════════════════════════════════════════════════ */

export function LastAIRunInfo() {
    const lastRun = useAITelemetryStore((state) => state.runs[0]);
    if (!lastRun) return null;

    const label = AI_ROUTES[lastRun.route]?.label ?? lastRun.route;
    const isError = lastRun.status === 'error';
    const tokens = `≈ ${formatTokenCount(lastRun.estimatedInputTokens)} → ${formatTokenCount(lastRun.estimatedOutputTokens)} Tokens`;

    return (
        <p
            data-last-airun
            className={`px-1 text-[10px] tabular-nums ${
                isError
                    ? 'text-rose-500 dark:text-rose-400'
                    : 'text-slate-400 dark:text-slate-500'
            }`}
            title={isError && lastRun.errorMessage ? lastRun.errorMessage : undefined}
        >
            Letzte KI-Anfrage: {label} · {lastRun.model} · {tokens} · {lastRun.durationMs} ms
            {isError ? ' · Fehler' : ''}
        </p>
    );
}
