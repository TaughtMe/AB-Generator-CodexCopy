import type { Task, WorksheetSource } from '../../types/worksheet';
import type { ChatMessage } from '../../types/ai';
import {
    generateChatAssistantReply,
    generateTaskRevisionResult,
    generateTasks,
    generateTasksFromCompiledPrompt,
    getActiveModelInfo,
    type AIClassContext,
    type GenerateTasksOptions,
    type TaskRevisionResult,
} from '../../services/aiService';
import { estimateTokensForText } from './tokenEstimate';
import { recordAIRun } from './aiTelemetry';
import { AI_ROUTES, type AIRoute, type AIRunMeta, type ModelRole } from './aiRoutes';

/* ══════════════════════════════════════════════════
   runAI.ts – Zentrale Routen-Fassade der KI-Schicht (§5).

   Ein einziger, typisierter Einstiegspunkt für alle KI-Aufrufe:

       const { output, meta } = await runAI({ route: 'editorChat', input });

   Aufgabe dieser Schicht (nicht mehr, nicht weniger):
   1. Route → konkrete aiService-Funktion (kein Provider-Umbau – die
      bestehende Provider-Logik in aiService bleibt unangetastet).
   2. Metadaten erfassen (route/provider/model/role + geschätzte Tokens +
      Dauer/Status) und an die Telemetrie übergeben.

   Routen, die noch nicht angeschlossen sind (planning, differentiation,
   chatCompression, jsonRepair, exportAnalysis), sind im Registry deklariert
   und werfen hier RouteNotImplementedError. So existiert die Schnittstelle
   bereits, bevor das jeweilige Feature gebaut wird.
   ══════════════════════════════════════════════════ */

/** Eingabe-Vertrag je Route. */
export interface RouteInputMap {
    editorChat: { messages: ChatMessage[]; aiClassContext?: AIClassContext };
    planning: { messages: ChatMessage[]; aiClassContext?: AIClassContext };
    /** Zwei reale Eingabeformen: kompilierter Prompt (Vorab-Chat) oder strukturierte Optionen (Import-Wizard). */
    worksheetGeneration:
        | { mode: 'compiledPrompt'; compiledPrompt: string }
        | { mode: 'options'; options: GenerateTasksOptions };
    taskRevision: {
        messages: ChatMessage[];
        tasksById: Record<string, Task>;
        taskIds: string[];
        sources: WorksheetSource[];
        aiClassContext?: AIClassContext;
    };
    differentiation: {
        instruction: string;
        tasksById: Record<string, Task>;
        taskIds: string[];
        sources: WorksheetSource[];
        aiClassContext?: AIClassContext;
    };
    chatCompression: { messages: ChatMessage[] };
    jsonRepair: { brokenJson: string; schemaHint?: string };
    exportAnalysis: { worksheetJson: string };
}

/** Ausgabe-Vertrag je Route. */
export interface RouteOutputMap {
    editorChat: string;
    planning: string;
    worksheetGeneration: Omit<Task, 'id'>[];
    taskRevision: TaskRevisionResult;
    differentiation: TaskRevisionResult;
    chatCompression: string;
    jsonRepair: string;
    exportAnalysis: string;
}

/** Präferenzen für die Modellauswahl (greifen erst mit der Modellbibliothek). */
export interface AIPreferences {
    /** Überschreibt die Default-Rolle der Route. */
    role?: ModelRole;
    /** Erzwingt ein konkretes Modell (für spätere Route→Modell-Zuordnung). */
    model?: string;
}

export interface AIRequest<R extends AIRoute> {
    route: R;
    input: RouteInputMap[R];
    preferences?: AIPreferences;
    signal?: AbortSignal;
}

export interface AIResult<R extends AIRoute> {
    output: RouteOutputMap[R];
    meta: AIRunMeta;
}

/** Wird geworfen, wenn eine deklarierte, aber noch nicht angeschlossene Route aufgerufen wird. */
export class RouteNotImplementedError extends Error {
    constructor(public readonly route: AIRoute) {
        super(`KI-Route „${route}" ist noch nicht über runAI verfügbar.`);
        this.name = 'RouteNotImplementedError';
    }
}

/** Serialisiert beliebige Route-Ein-/Ausgaben grob für die Token-Schätzung. */
function serializeForEstimate(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value) ?? '';
    } catch {
        return '';
    }
}

/** Dispatch Route → bestehende aiService-Funktion. */
async function dispatchRoute(
    route: AIRoute,
    input: RouteInputMap[AIRoute],
    signal?: AbortSignal,
): Promise<unknown> {
    switch (route) {
        case 'editorChat': {
            const i = input as RouteInputMap['editorChat'];
            return generateChatAssistantReply(i.messages, i.aiClassContext, signal);
        }
        case 'taskRevision': {
            const i = input as RouteInputMap['taskRevision'];
            return generateTaskRevisionResult(
                i.messages,
                i.tasksById,
                i.taskIds,
                i.sources,
                i.aiClassContext,
                signal,
            );
        }
        case 'worksheetGeneration': {
            const i = input as RouteInputMap['worksheetGeneration'];
            return i.mode === 'options'
                ? generateTasks(i.options)
                : generateTasksFromCompiledPrompt(i.compiledPrompt);
        }
        // Deklariert, aber noch nicht angeschlossen – siehe AI_ROUTES[*].implemented.
        case 'planning':
        case 'differentiation':
        case 'chatCompression':
        case 'jsonRepair':
        case 'exportAnalysis':
            throw new RouteNotImplementedError(route);
        default: {
            // Exhaustiveness-Check: neue Routen müssen hier behandelt werden.
            const _exhaustive: never = route;
            throw new RouteNotImplementedError(_exhaustive);
        }
    }
}

/**
 * Führt einen KI-Aufruf für die gegebene Route aus und liefert Ergebnis +
 * Metadaten. Fehler werden vor dem Re-Throw als Telemetrie-Eintrag erfasst.
 */
export async function runAI<R extends AIRoute>(request: AIRequest<R>): Promise<AIResult<R>> {
    const { route, input, preferences, signal } = request;
    const config = AI_ROUTES[route];
    const role = preferences?.role ?? config.preferredRole;
    const { provider, model } = getActiveModelInfo();
    const startedAt = Date.now();
    const estimatedInputTokens = estimateTokensForText(serializeForEstimate(input));

    try {
        const output = (await dispatchRoute(route, input, signal)) as RouteOutputMap[R];
        const estimatedOutputTokens = estimateTokensForText(serializeForEstimate(output));
        const meta: AIRunMeta = {
            route,
            provider,
            model: preferences?.model ?? model,
            role,
            estimatedInputTokens,
            estimatedOutputTokens,
            startedAt,
            durationMs: Date.now() - startedAt,
            status: 'ok',
        };
        recordAIRun(meta);
        return { output, meta };
    } catch (error) {
        recordAIRun({
            route,
            provider,
            model: preferences?.model ?? model,
            role,
            estimatedInputTokens,
            estimatedOutputTokens: 0,
            startedAt,
            durationMs: Date.now() - startedAt,
            status: 'error',
            errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}
