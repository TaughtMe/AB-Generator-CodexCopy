import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ICON_SIZES } from '../ui/iconSizes';

export type LegalModalType = 'impressum' | 'datenschutz' | 'lizenzen';

type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

type LegalContent = {
  title: string;
  intro?: string;
  sections: LegalSection[];
  footerNote?: string;
};

interface LegalModalsProps {
  activeModal: LegalModalType | null;
  onClose: () => void;
}

const CONTACT_NAME = 'Toby Bryson';
const CONTACT_EMAIL = 'Toby.Bryson@schule.bayern.de';
const CONTACT_ADDRESS_LINE_1 = 'Behringerstraße 5';
const CONTACT_ADDRESS_LINE_2 = '87700 Memmingen';

const LEGAL_CONTENT: Record<LegalModalType, LegalContent> = {
  impressum: {
    title: 'Impressum',
    intro: 'Angaben gemäß § 5 DDG und § 18 Abs. 2 MStV.',
    sections: [
      {
        heading: 'Diensteanbieter',
        paragraphs: [
          CONTACT_NAME,
          CONTACT_ADDRESS_LINE_1,
          CONTACT_ADDRESS_LINE_2,
          'Deutschland',
        ],
      },
      {
        heading: 'Kontakt',
        bullets: [
          `E-Mail: ${CONTACT_EMAIL}`,
        ],
      },
      {
        heading: 'Inhaltlich verantwortlich',
        paragraphs: [
          `Verantwortlich für journalistisch-redaktionelle Inhalte nach § 18 Abs. 2 MStV: ${CONTACT_NAME}, ${CONTACT_ADDRESS_LINE_1}, ${CONTACT_ADDRESS_LINE_2}.`,
        ],
      },
      {
        heading: 'Hinweis zur Verbraucherstreitbeilegung',
        paragraphs: [
          'Diese Anwendung wird unentgeltlich für Lehrkräfte bereitgestellt. Eine Teilnahme an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle erfolgt nicht.',
          'Wir sind weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
        ],
      },
    ],
    footerNote: 'Stand: 1. März 2026',
  },
  datenschutz: {
    title: 'Datenschutz',
    intro: 'Hinweise zur Verarbeitung personenbezogener Daten in der Web-App AB Generator.',
    sections: [
      {
        heading: '1) Verantwortlicher',
        paragraphs: [
          CONTACT_NAME,
          CONTACT_ADDRESS_LINE_1,
          CONTACT_ADDRESS_LINE_2,
          `E-Mail: ${CONTACT_EMAIL}`,
        ],
      },
      {
        heading: '2) Grundprinzip dieser App',
        paragraphs: [
          'Die Anwendung ist als browserbasierte PWA ausgelegt. Daten werden grundsätzlich lokal im Browser der nutzenden Person verarbeitet und gespeichert.',
          'Eine serverseitige Nutzerkontoverwaltung durch den Betreiber ist derzeit nicht vorgesehen.',
        ],
      },
      {
        heading: '3) Lokal gespeicherte Daten (Endgerät)',
        bullets: [
          'Einstellungen und Konfigurationen (z. B. Theme, Modelleinstellungen, optional hinterlegte API-Keys) im localStorage.',
          'Arbeitsblätter, Chatverläufe, Quellen, Klassenprofile, Bilder und Schriftdateien in IndexedDB (ABGeneratorDB).',
          'Temporäre Daten für Export-, Import- und Druckfunktionen.',
        ],
      },
      {
        heading: '4) Externe Datenübermittlungen nur bei aktiver Nutzung',
        bullets: [
          'KI-Funktionen: Bei aktiver KI-Nutzung werden Inhalte (Prompts, ggf. Screenshots, ausgewählte Quelleninhalte) an den jeweils ausgewählten Anbieter übermittelt (z. B. OpenAI, Google Gemini oder lokaler OpenAI-kompatibler Server).',
          'Modellerkennung: Bei aktiver Provider-Konfiguration können Modelllisten von den jeweiligen API-Endpunkten geladen werden.',
          'URL-Import: Beim Import einer Webseite wird die angegebene URL über den Dienst r.jina.ai abgerufen, um Text zu extrahieren.',
          'Schriftarten: Bei Auswahl bestimmter Fonts kann eine Verbindung zu fonts.googleapis.com hergestellt werden.',
        ],
      },
      {
        heading: '5) Rechtsgrundlagen (soweit anwendbar)',
        bullets: [
          'Art. 6 Abs. 1 lit. b DSGVO für die Bereitstellung angeforderter App-Funktionen.',
          'Art. 6 Abs. 1 lit. f DSGVO für den stabilen und sicheren Betrieb der Anwendung.',
          'Art. 6 Abs. 1 lit. a DSGVO für freiwillig aktivierte optionale Funktionen mit externer Übermittlung (insbesondere KI/URL-Import).',
          '§ 25 Abs. 2 TDDDG für technisch erforderliche Speicherung/Zugriffe auf Endgerätedaten (z. B. localStorage, IndexedDB).',
        ],
      },
      {
        heading: '6) Speicherdauer und Löschung',
        paragraphs: [
          'Die lokal gespeicherten Daten bleiben auf dem Endgerät, bis sie im Browser oder in der App gelöscht werden.',
          'Bei Deinstallation der PWA oder Löschung der Browserdaten werden die gespeicherten Inhalte in der Regel entfernt.',
        ],
      },
      {
        heading: '7) Betroffenenrechte',
        paragraphs: [
          'Betroffene haben insbesondere das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit sowie Widerspruch nach den gesetzlichen Vorgaben der DSGVO.',
          `Anfragen können an ${CONTACT_EMAIL} gerichtet werden.`,
        ],
      },
      {
        heading: '8) Beschwerderecht',
        paragraphs: [
          'Es besteht ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde, insbesondere im Mitgliedstaat des gewöhnlichen Aufenthaltsorts, des Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes.',
        ],
      },
    ],
    footerNote: 'Stand: 1. März 2026',
  },
  lizenzen: {
    title: 'Lizenzen',
    intro: 'Direkt verwendete Open-Source-Pakete (Stand package-lock.json vom 1. März 2026).',
    sections: [
      {
        heading: 'Kurzfazit',
        bullets: [
          'Die direkt eingebundenen Bibliotheken stehen überwiegend unter MIT sowie teilweise Apache-2.0, BSD-2-Clause oder ISC.',
          'Für die aufgeführten Open-Source-Lizenzen ist in der Regel keine Lizenzgebühr erforderlich.',
          'Kosten können bei optional genutzten Drittanbieter-APIs entstehen (z. B. OpenAI, Google Gemini), je nach gebuchtem Tarif der jeweiligen Anbieter.',
        ],
      },
      {
        heading: 'Direkte Laufzeit-Abhängigkeiten (Auszug)',
        bullets: [
          '@dnd-kit/core (MIT)',
          '@dnd-kit/modifiers (MIT)',
          '@dnd-kit/sortable (MIT)',
          '@dnd-kit/utilities (MIT)',
          '@google/generative-ai (Apache-2.0)',
          '@tiptap/* (MIT)',
          'clsx (MIT)',
          'dexie (Apache-2.0)',
          'docx (MIT)',
          'file-saver (MIT)',
          'html-to-image (MIT)',
          'katex (MIT)',
          'lucide-react (ISC)',
          'mammoth (BSD-2-Clause)',
          'pdfjs-dist (Apache-2.0)',
          'react / react-dom (MIT)',
          'react-joyride (MIT)',
          'tailwind-merge (MIT)',
          'zustand (MIT)',
        ],
      },
      {
        heading: 'Build-/Tooling-Abhängigkeiten (Auszug)',
        bullets: [
          'vite (MIT)',
          'vite-plugin-pwa (MIT)',
          'typescript (Apache-2.0)',
          'eslint (MIT)',
          '@vitejs/plugin-react (MIT)',
          'tailwindcss (MIT)',
        ],
      },
      {
        heading: 'Lizenztexte',
        paragraphs: [
          'Die vollständigen Lizenztexte der verwendeten Pakete liegen in der jeweiligen Installation unter node_modules/<paket>/LICENSE (oder vergleichbarem Dateinamen).',
        ],
      },
    ],
    footerNote: 'Hinweis: Diese Übersicht ersetzt keine individuelle Rechtsberatung.',
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
            {content.intro && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {content.intro}
              </p>
            )}
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

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
          {content.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{section.heading}</h3>

              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {paragraph}
                </p>
              ))}

              {section.bullets && section.bullets.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {content.footerNote && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {content.footerNote}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
