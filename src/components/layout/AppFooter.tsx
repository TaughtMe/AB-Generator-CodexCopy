import type { LegalModalType } from './LegalModals';

interface AppFooterProps {
  onOpenLegalModal: (modal: LegalModalType) => void;
}

const LEGAL_LINKS: Array<{ id: LegalModalType; label: string }> = [
  { id: 'impressum', label: 'Impressum' },
  { id: 'datenschutz', label: 'Datenschutz' },
  { id: 'lizenzen', label: 'Lizenzen' },
];

export function AppFooter({ onOpenLegalModal }: AppFooterProps) {
  const currentYear = new Date().getFullYear();
  const appVersion =
    typeof __APP_VERSION__ === 'string' && __APP_VERSION__.trim().length > 0
      ? __APP_VERSION__
      : 'dev';

  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 text-slate-300">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-slate-200">© {currentYear} AB Generator</span>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span className="text-slate-400">Version {appVersion}</span>
        </div>

        <nav aria-label="Rechtliche Links" className="flex flex-wrap items-center gap-1.5">
          {LEGAL_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => onOpenLegalModal(link.id)}
              className="rounded-md px-2 py-1 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 transition-colors cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </nav>
      </div>
    </footer>
  );
}
