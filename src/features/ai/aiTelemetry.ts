import { create } from 'zustand';
import type { AIRunMeta, AIRunRecord } from './aiRoutes';

/* ══════════════════════════════════════════════════
   aiTelemetry.ts – Leichtgewichtige KI-Laufzeit-Telemetrie (§5/§7).

   Sammelt die Metadaten jedes runAI-Aufrufs (Route, Provider, Modell,
   geschätzte Tokens, Dauer, Status) in einem begrenzten Ringpuffer.
   Damit kann später eine Kosten-/Token-UX „pro Route/Funktion" anzeigen,
   ohne dass die Schätzung in einzelnen Komponenten festwächst.

   Bewusst ein eigener, winziger Store statt Erweiterung des
   workspaceStore: Telemetrie ist Querschnitt und soll nicht persistiert
   werden (nur In-Memory der laufenden Session).
   ══════════════════════════════════════════════════ */

/** Maximale Anzahl gespeicherter Läufe (älteste werden verworfen). */
const MAX_RUNS = 50;

let runCounter = 0;

interface AITelemetryState {
    runs: AIRunRecord[];
    /** Letzten Lauf protokollieren. Gibt den erzeugten Record zurück. */
    record: (meta: AIRunMeta) => AIRunRecord;
    clear: () => void;
}

export const useAITelemetryStore = create<AITelemetryState>((set) => ({
    runs: [],
    record: (meta) => {
        runCounter += 1;
        const entry: AIRunRecord = { id: `airun-${Date.now()}-${runCounter}`, ...meta };
        set((state) => ({
            runs: [entry, ...state.runs].slice(0, MAX_RUNS),
        }));
        return entry;
    },
    clear: () => set({ runs: [] }),
}));

/**
 * Imperative Aufnahme aus Nicht-React-Code (runAI). Schreibt in den Store
 * und gibt in DEV eine kompakte Debug-Zeile aus.
 */
export function recordAIRun(meta: AIRunMeta): AIRunRecord {
    const entry = useAITelemetryStore.getState().record(meta);
    if (import.meta.env.DEV) {
        const usage = `~${meta.estimatedInputTokens}→${meta.estimatedOutputTokens} Tok`;
        // eslint-disable-next-line no-console
        console.debug(
            `[runAI] ${meta.route} · ${meta.provider}/${meta.model} · ${meta.role} · ${usage} · ${meta.durationMs}ms · ${meta.status}`,
            meta.errorMessage ? `· ${meta.errorMessage}` : '',
        );
    }
    return entry;
}
