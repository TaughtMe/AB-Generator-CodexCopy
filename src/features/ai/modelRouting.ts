import type { AIProvider } from '../../store/settingsStore';
import { getActiveModelInfo } from '../../services/aiService';
import type { ModelRole, ModelSource } from './aiRoutes';

/* ══════════════════════════════════════════════════
   modelRouting.ts – Rollen→Modell-Auflösung (§5).

   Zentraler Hook, der entscheidet, welches konkrete Modell eine KI-Route
   nutzt. Reihenfolge:
     1. expliziter Modell-Override (preferences.model)  → source 'override'
     2. registriertes Modell für die Rolle              → source 'role'
     3. aktives Chat-Modell (Fallback)                  → source 'active'

   Aktuell ist die Rollen-Registry leer, sodass jede Rolle auf das aktive
   Modell zurückfällt – die Mechanik existiert aber bereits. Die spätere
   Modellbibliothek befüllt die Registry (und entscheidet dann über
   Persistenz, vermutlich im settingsStore); runAI bleibt unverändert,
   weil es ausschließlich resolveModelForRole konsultiert.

   Der Provider bleibt vorerst der aktive Provider – providerübergreifendes
   Routing ist Sache der Modellbibliothek.
   ══════════════════════════════════════════════════ */

export interface ResolvedModel {
    provider: AIProvider;
    model: string;
    source: ModelSource;
}

/** In-Memory-Registry Rolle → konkretes Modell (wird später von der Bibliothek befüllt). */
const roleModelRegistry: Partial<Record<ModelRole, string>> = {};

/** Setzt (oder löscht bei leerem Wert) das Modell für eine Rolle. */
export function setRoleModel(role: ModelRole, model: string | null): void {
    const trimmed = model?.trim();
    if (trimmed) {
        roleModelRegistry[role] = trimmed;
    } else {
        delete roleModelRegistry[role];
    }
}

export function getRoleModel(role: ModelRole): string | undefined {
    return roleModelRegistry[role];
}

/** Vollständige Registry (Kopie) – z. B. für die spätere Bibliothek-UI. */
export function getRoleModelMap(): Partial<Record<ModelRole, string>> {
    return { ...roleModelRegistry };
}

/**
 * Löst die Rolle (+ optionalen Override) zum konkret zu nutzenden Modell auf.
 * Einziger Einstiegspunkt für die Modellwahl in runAI.
 */
export function resolveModelForRole(role: ModelRole, modelOverride?: string): ResolvedModel {
    const { provider, model: activeModel } = getActiveModelInfo();

    const override = modelOverride?.trim();
    if (override) {
        return { provider, model: override, source: 'override' };
    }

    const roleModel = roleModelRegistry[role];
    if (roleModel) {
        return { provider, model: roleModel, source: 'role' };
    }

    return { provider, model: activeModel, source: 'active' };
}
