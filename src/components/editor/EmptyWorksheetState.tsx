import { Plus, Sparkles, LayoutTemplate } from 'lucide-react';

/* ══════════════════════════════════════════════════
   EmptyWorksheetState – Startpunkt für ein leeres Arbeitsblatt.

   Statt eines reinen Hinweistexts bietet der Empty State drei klare
   Einstiege: erste Aufgabe platzieren, KI-Chat öffnen oder eine
   Design-Vorlage wählen. Wird nur gerendert, wenn taskIds leer ist.

   Wichtig: Dieser Block sitzt AUF der weißen A4-Seite (das Arbeitsblatt
   folgt nie dem Dark-Mode). Daher bewusst KEINE dark:-Varianten – immer
   das Light-Design, damit es nicht als dunkle Karten auf weißem Blatt
   erscheint.
   ══════════════════════════════════════════════════ */

interface EmptyWorksheetStateProps {
    /** Startet den Placement-Modus (Klick im Canvas öffnet das Typ-Menü). */
    onAddFirstTask: () => void;
    /** Öffnet den KI-Chat im Editor (idempotent — nie schließen). */
    onOpenAiChat: () => void;
    /** Öffnet die Vorlagen-Galerie. */
    onOpenTemplates: () => void;
}

const ACTIONS = [
    {
        key: 'add',
        icon: Plus,
        title: 'Erste Aufgabe hinzufügen',
        description: 'Wähle aus Aufgabe, Lückentext, Tabelle u. v. m.',
        accent: 'text-blue-600 bg-blue-50 group-hover:bg-blue-100',
    },
    {
        key: 'ai',
        icon: Sparkles,
        title: 'Mit KI erstellen',
        description: 'Beschreibe dein Thema — die KI schlägt Aufgaben vor.',
        accent: 'text-purple-600 bg-purple-50 group-hover:bg-purple-100',
    },
    {
        key: 'template',
        icon: LayoutTemplate,
        title: 'Vorlage auswählen',
        description: 'Starte mit einem gespeicherten Design.',
        accent: 'text-teal-600 bg-teal-50 group-hover:bg-teal-100',
    },
] as const;

export function EmptyWorksheetState({
    onAddFirstTask,
    onOpenAiChat,
    onOpenTemplates,
}: EmptyWorksheetStateProps) {
    const handlers: Record<(typeof ACTIONS)[number]['key'], () => void> = {
        add: onAddFirstTask,
        ai: onOpenAiChat,
        template: onOpenTemplates,
    };

    return (
        <div className="no-print mx-auto max-w-[210mm] mt-8 rounded-xl border-2 border-dashed border-slate-200 px-6 py-12">
            <div className="text-center mb-8">
                <h3 className="text-base font-semibold text-slate-700">
                    Dein Arbeitsblatt ist noch leer
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                    Wie möchtest du starten?
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                {ACTIONS.map(({ key, icon: Icon, title, description, accent }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={handlers[key]}
                        className="group flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 cursor-pointer"
                    >
                        <span className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${accent}`}>
                            <Icon className="h-5 w-5" />
                        </span>
                        <span className="text-sm font-medium text-slate-800">
                            {title}
                        </span>
                        <span className="text-xs leading-relaxed text-slate-400">
                            {description}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
