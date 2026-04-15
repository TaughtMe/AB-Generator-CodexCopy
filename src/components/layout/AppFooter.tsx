import { useTranslation } from 'react-i18next';
import type { LegalModalType } from './LegalModals';
import packageJsonRaw from '../../../package.json?raw';

interface AppFooterProps {
  onOpenLegalModal: (modal: LegalModalType) => void;
}

const LEGAL_LINKS: Array<{ id: LegalModalType; labelKey: string }> = [
  { id: 'impressum', labelKey: 'footer.impressum' },
  { id: 'datenschutz', labelKey: 'footer.datenschutz' },
  { id: 'lizenzen', labelKey: 'footer.licenses' },
];

function readPackageVersion(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { version?: unknown };
    const version = typeof parsed.version === 'string' ? parsed.version.trim() : '';
    return version.length > 0 ? version : null;
  } catch {
    return null;
  }
}

const packageVersion = readPackageVersion(packageJsonRaw);

export function AppFooter({ onOpenLegalModal }: AppFooterProps) {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const appVersion =
    packageVersion
    ?? (
      typeof __APP_VERSION__ === 'string' && __APP_VERSION__.trim().length > 0
      ? __APP_VERSION__
      : 'dev'
    );

  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 text-slate-300">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-slate-200">{t('footer.copyright', { year: currentYear })}</span>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span className="text-slate-400">{t('footer.version', { version: appVersion })}</span>
        </div>

        <nav aria-label={t('footer.legalLinks')} className="flex flex-wrap items-center gap-1.5">
          {LEGAL_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => onOpenLegalModal(link.id)}
              className="rounded-md px-2 py-1 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 transition-colors cursor-pointer"
            >
              {t(link.labelKey)}
            </button>
          ))}
        </nav>
      </div>
    </footer>
  );
}
