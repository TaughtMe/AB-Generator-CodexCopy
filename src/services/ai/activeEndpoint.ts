/* ══════════════════════════════════════════════════
   activeEndpoint.ts – Brücke vom KI-Tab (Custom-Provider) zur Ausführung.

   Hält einen registrierbaren Resolver für den aktuell aktiven, OpenAI-
   kompatiblen Custom-Provider-Endpoint. Bewusst ein eigenständiges Mini-
   Modul ohne Store-Import: aiService darf workspaceStore NICHT importieren
   (workspaceStore importiert aiService → Zyklus). Stattdessen registriert
   workspaceStore beim Laden seinen Resolver, und aiService liest ihn hier.

   Ist kein Custom-Endpoint aktiv (Resolver liefert null), gilt unverändert
   die eingebaute settingsStore-Providerlogik.
   ══════════════════════════════════════════════════ */

export interface ActiveAiEndpoint {
    baseUrl: string;
    apiKey: string;
    /** API-Modell-Identifier, der an den Provider gesendet wird. */
    model: string;
    providerId: string;
    providerName: string;
}

type EndpointResolver = () => ActiveAiEndpoint | null;

let resolver: EndpointResolver = () => null;

/** Wird vom workspaceStore registriert (siehe getActiveAiEndpoint-Action). */
export function setActiveEndpointResolver(fn: EndpointResolver): void {
    resolver = fn;
}

/** Aktiver Custom-Endpoint oder null (dann gilt die eingebaute Providerlogik). */
export function getActiveAiEndpoint(): ActiveAiEndpoint | null {
    return resolver();
}
