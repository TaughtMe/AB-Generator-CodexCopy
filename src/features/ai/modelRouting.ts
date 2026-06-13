import type { AIProvider } from '../../store/settingsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getActiveModelInfo } from '../../services/aiService';
import type { ModelRole, ModelSource } from './aiRoutes';

/* ══════════════════════════════════════════════════
   modelRouting.ts – Rollen→Modell-Auflösung (§5).

   Zentraler Hook, der entscheidet, welches konkrete Modell eine KI-Route
   nutzt. Reihenfolge:
     1. expliziter Modell-Override (preferences.model)  → source 'override'
     2. registriertes Modell für die Rolle              → source 'role'
     3. aktives Chat-Modell (Fallback)                  → source 'active'

   Die Rollen→Modell-Zuordnung lebt persistiert im settingsStore
   (roleModelPreferences, 'auto' = aktives Modell). Die spätere
   Modellbibliothek-UI schreibt dorthin über setRoleModelPreference;
   runAI bleibt unverändert, weil es ausschließlich resolveModelForRole
   konsultiert.

   Der Provider bleibt vorerst der aktive Provider – providerübergreifendes
   Routing ist Sache der Modellbibliothek.
   ══════════════════════════════════════════════════ */

export interface ResolvedModel {
    provider: AIProvider;
    model: string;
    source: ModelSource;
}

/** Konkretes (Nicht-'auto'-) Modell für eine Rolle, sonst undefined. */
export function getRoleModel(role: ModelRole): string | undefined {
    const pref = useSettingsStore.getState().roleModelPreferences[role];
    return pref && pref !== 'auto' ? pref : undefined;
}

/** Alle Rollen mit konkret zugeordnetem Modell (ohne 'auto') – z. B. für die Bibliothek-UI. */
export function getRoleModelMap(): Partial<Record<ModelRole, string>> {
    const prefs = useSettingsStore.getState().roleModelPreferences;
    const result: Partial<Record<ModelRole, string>> = {};
    for (const [role, model] of Object.entries(prefs)) {
        if (model && model !== 'auto') {
            result[role as ModelRole] = model;
        }
    }
    return result;
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

    const roleModel = getRoleModel(role);
    if (roleModel) {
        return { provider, model: roleModel, source: 'role' };
    }

    return { provider, model: activeModel, source: 'active' };
}
