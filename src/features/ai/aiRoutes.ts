import type { AIProvider } from '../../store/settingsStore';

/* ══════════════════════════════════════════════════
   aiRoutes.ts – Rollen-/Routenmodell der KI-Schicht (§5).

   Die Routen sind die *Funktionen*, für die KI eingesetzt wird – nicht
   die Provider/Modelle. Jede Route hat eine bevorzugte Modellrolle
   (fast/balanced/strong/cheap); die spätere Modellbibliothek bildet
   diese Rollen auf konkrete Modelle ab. So kennt die App künftig nicht
   mehr nur „ein aktives Modell", sondern „welches Modell für welche
   Aufgabe".

   Dieses Modul enthält nur Typen + statische Registry (keine Logik,
   keine Provider-Calls) – damit UI und Telemetrie es zyklusfrei
   importieren können. Die Ausführung lebt in runAI.ts.
   ══════════════════════════════════════════════════ */

export type AIRoute =
    | 'editorChat'
    | 'planning'
    | 'worksheetGeneration'
    | 'taskRevision'
    | 'differentiation'
    | 'chatCompression'
    | 'jsonRepair'
    | 'exportAnalysis';

/** Modellrolle – abstrakte Anforderung, die später auf ein Modell gemappt wird. */
export type ModelRole = 'fast' | 'balanced' | 'strong' | 'cheap';

export interface AIRouteConfig {
    route: AIRoute;
    /** Anzeigename (de) für UI/Telemetrie. */
    label: string;
    /** Kurzbeschreibung, wofür die Route genutzt wird. */
    description: string;
    /** Bevorzugte Modellrolle, solange keine explizite Modellbibliothek greift. */
    preferredRole: ModelRole;
    /** Erwartet die Route strukturierten (JSON-)Output? Steuert später Parsing/Repair. */
    structuredOutput: boolean;
    /** Ist die Route bereits über runAI ausführbar (an aiService angeschlossen)? */
    implemented: boolean;
}

export const AI_ROUTES: Record<AIRoute, AIRouteConfig> = {
    editorChat: {
        route: 'editorChat',
        label: 'Editor-Chat',
        description: 'Antwort des KI-Assistenten im Arbeitsblatt-Editor.',
        preferredRole: 'balanced',
        structuredOutput: false,
        implemented: true,
    },
    planning: {
        route: 'planning',
        label: 'Planung',
        description: 'Vorab-Planung eines Arbeitsblatts aus dem Chatverlauf.',
        preferredRole: 'balanced',
        structuredOutput: false,
        implemented: false,
    },
    worksheetGeneration: {
        route: 'worksheetGeneration',
        label: 'Arbeitsblatt-Generierung',
        description: 'Erzeugung von Aufgaben aus einem kompilierten Prompt.',
        preferredRole: 'strong',
        structuredOutput: true,
        implemented: true,
    },
    taskRevision: {
        route: 'taskRevision',
        label: 'Aufgaben-Überarbeitung',
        description: 'Änderungsoperationen am bestehenden Arbeitsblatt (Patch-Preview).',
        preferredRole: 'strong',
        structuredOutput: true,
        implemented: true,
    },
    differentiation: {
        route: 'differentiation',
        label: 'Differenzierung',
        description: 'Erstellung einer differenzierten Variante (eigene Route, stärkeres Modell).',
        preferredRole: 'strong',
        structuredOutput: true,
        implemented: false,
    },
    chatCompression: {
        route: 'chatCompression',
        label: 'Chat-Komprimierung',
        description: 'Zusammenfassung langer Chatverläufe (günstige/schnelle Route).',
        preferredRole: 'cheap',
        structuredOutput: false,
        implemented: true,
    },
    jsonRepair: {
        route: 'jsonRepair',
        label: 'JSON-Reparatur',
        description: 'Reparatur abgeschnittener/fehlerhafter KI-JSON-Antworten.',
        preferredRole: 'cheap',
        structuredOutput: true,
        implemented: false,
    },
    exportAnalysis: {
        route: 'exportAnalysis',
        label: 'Export-Analyse',
        description: 'Analyse eines Arbeitsblatts vor dem Export (Hinweise/Warnungen).',
        preferredRole: 'fast',
        structuredOutput: true,
        implemented: false,
    },
};

export type AIRunStatus = 'ok' | 'error';

/** Woher das tatsächlich genutzte Modell stammt (siehe modelRouting.resolveModelForRole). */
export type ModelSource = 'override' | 'role' | 'active';

/** Echte Provider-usage (falls vom Provider geliefert – aktuell optional). */
export interface AIActualUsage {
    inputTokens?: number;
    outputTokens?: number;
}

/**
 * Metadaten eines einzelnen runAI-Aufrufs. Bewusst flach + serialisierbar,
 * damit Telemetrie/UI sie ohne weitere Abhängigkeiten anzeigen können.
 */
export interface AIRunMeta {
    route: AIRoute;
    provider: AIProvider;
    model: string;
    /** Effektiv genutzte Rolle (Override aus preferences oder Route-Default). */
    role: ModelRole;
    /** Woher das genutzte Modell aufgelöst wurde (Override / Rolle / aktives Modell). */
    modelSource: ModelSource;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    /** Vom Provider gemeldeter Verbrauch – derzeit i.d.R. undefined. */
    actualUsage?: AIActualUsage;
    startedAt: number;
    durationMs: number;
    status: AIRunStatus;
    errorMessage?: string;
}

/** Telemetrie-Eintrag = Meta + stabile ID für Listen-Keys. */
export interface AIRunRecord extends AIRunMeta {
    id: string;
}
