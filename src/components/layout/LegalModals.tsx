import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ICON_SIZES } from '../ui/iconSizes';

export type LegalModalType = 'impressum' | 'datenschutz' | 'lizenzen';

interface LegalModalsProps {
  activeModal: LegalModalType | null;
  onClose: () => void;
}

const LEGAL_CONTENT: Record<LegalModalType, { title: string; paragraphs: string[] }> = {
  impressum: {
    title: 'Impressum',
    paragraphs: [
      'Platzhalter: Bitte hier die Anbieterkennzeichnung mit Name, Anschrift und Kontaktinformationen eintragen.',
      'Ergänze bei Bedarf Verantwortliche Person, USt-IdNr. und weitere Pflichtangaben nach geltendem Recht.',
    ],
  },
  datenschutz: {
    title: 'Datenschutz',
    paragraphs: [
      'Platzhalter: Bitte hier die Datenschutzhinweise für die Web-App einfügen (Verarbeitung, Zwecke, Rechtsgrundlagen, Speicherdauer).',
      'Ergänze Informationen zu LocalStorage/IndexedDB, ggf. eingesetzten APIs und Kontakt zur Datenschutzanfrage.',
    ],
  },
  lizenzen: {
    title: 'Lizenzen',
    paragraphs: [
      'Platzhalter: Hier können verwendete Open-Source-Bibliotheken und deren Lizenztexte oder Verweise aufgelistet werden.',
      'Optional: Ein automatisiert erzeugter Lizenzreport kann später hier eingebunden oder verlinkt werden.',
    ],
  },
};

export function LegalModals({ activeModal, onClose }: LegalModalsProps) {
  useEffect(() => {
    if (!activeModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, onClose]);

  if (!activeModal) return null;

  const content = LEGAL_CONTENT[activeModal];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white/95 shadow-2xl dark:border-slate-700 dark:bg-slate-900/95 overflow-hidden"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <div>
            <h2 id="legal-modal-title" className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {content.title}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Vorläufiger Platzhaltertext zur späteren Befüllung.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Rechtstext schließen"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer"
          >
            <X className={ICON_SIZES[18]} />
          </button>
        </header>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          {content.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-6 text-slate-700 dark:text-slate-200">
              {paragraph}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
