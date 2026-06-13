import { useSettingsStore } from '../../store/settingsStore';
import { AI_ROUTES, type AIRoute, type ModelRole } from '../../features/ai/aiRoutes';

/* ══════════════════════════════════════════════════
   ModelLibrarySettings – Rollen→Modell-Zuordnung (§5).

   Pro KI-Rolle (fast/balanced/strong/cheap) lässt sich ein Modell des
   aktiven Anbieters wählen; „Auto" nutzt das Standard-Chatmodell. Die
   Auswahl schreibt in settingsStore.roleModelPreferences und wird von
   runAI über resolveModelForRole konsultiert.

   Bewusst pro Rolle EIN Modell (Option 1). Das Datenmodell (role→string)
   bleibt so offen, dass später je Rolle zusätzlich ein Anbieter wählbar
   ist (Option 2), ohne diese UI grundlegend umzubauen – dann käme pro
   Zeile lediglich ein zweites Auswahlfeld hinzu.
   ══════════════════════════════════════════════════ */

const ROLE_ORDER: ModelRole[] = ['balanced', 'strong', 'cheap', 'fast'];

const ROLE_META: Record<ModelRole, { label: string; hint: string }> = {
    balanced: { label: 'Ausgewogen', hint: 'Standard für allgemeine Anfragen.' },
    strong: { label: 'Stark', hint: 'Komplexe Aufgaben mit strukturiertem Ergebnis.' },
    cheap: { label: 'Günstig', hint: 'Sparsame Aufgaben, wo Tempo/Kosten zählen.' },
    fast: { label: 'Schnell', hint: 'Leichte Aufgaben mit schneller Antwort.' },
};

const formatModelName = (rawId: string) => rawId.split('/').pop() || rawId;

/** Routen, die je Rolle laufen – für erklärende Chips unter jeder Zeile. */
function routesForRole(role: ModelRole): string[] {
    return (Object.keys(AI_ROUTES) as AIRoute[])
        .filter((route) => AI_ROUTES[route].preferredRole === role)
        .map((route) => AI_ROUTES[route].label);
}

interface ModelLibrarySettingsProps {
    /** Modelle des aktiven Anbieters (IDs) für die Auswahl. */
    modelOptions: string[];
    /** Anzeigename des aktiven Anbieters. */
    providerLabel: string;
}

export function ModelLibrarySettings({ modelOptions, providerLabel }: ModelLibrarySettingsProps) {
    const roleModelPreferences = useSettingsStore((state) => state.roleModelPreferences);
    const setRoleModelPreference = useSettingsStore((state) => state.setRoleModelPreference);

    return (
        <div className="rounded-xl border border-slate-700 p-4 bg-slate-800/40">
            <div className="mb-3">
                <p className="text-sm font-semibold text-slate-200">Modellbibliothek – Rollen-Zuordnung</p>
                <p className="text-xs text-slate-400">
                    Lege fest, welches Modell des aktiven Anbieters
                    (<span className="font-semibold text-slate-200"> {providerLabel}</span>) eine KI-Rolle nutzt.
                    „Auto" verwendet das Standard-Chatmodell.
                </p>
            </div>

            <div className="space-y-3">
                {ROLE_ORDER.map((role) => {
                    const current = roleModelPreferences[role] ?? 'auto';
                    // Aktuell gewähltes Modell sichtbar halten, auch wenn es nicht (mehr)
                    // in der Anbieterliste steht (z. B. nach Anbieterwechsel).
                    const options = current !== 'auto' && !modelOptions.includes(current)
                        ? [current, ...modelOptions]
                        : modelOptions;
                    const routeLabels = routesForRole(role);

                    return (
                        <div key={role} className="rounded-lg border border-slate-700/70 bg-slate-800/40 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-200">{ROLE_META[role].label}</p>
                                    <p className="text-xs text-slate-400">{ROLE_META[role].hint}</p>
                                </div>
                                <select
                                    data-role-model={role}
                                    value={current}
                                    onChange={(event) => setRoleModelPreference(role, event.target.value)}
                                    className="w-48 shrink-0 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-200 cursor-pointer"
                                >
                                    <option value="auto">Auto (Standard-Chatmodell)</option>
                                    {options.map((modelId) => (
                                        <option key={modelId} value={modelId}>{formatModelName(modelId)}</option>
                                    ))}
                                </select>
                            </div>
                            {routeLabels.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {routeLabels.map((label) => (
                                        <span
                                            key={label}
                                            className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-300"
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
