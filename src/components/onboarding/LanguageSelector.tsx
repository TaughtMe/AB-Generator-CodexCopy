import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

/* ══════════════════════════════════════════════════
   LanguageSelector.tsx – Sprachauswahl als erster
   Onboarding-Schritt. Overlay mit vier Optionen.
   ══════════════════════════════════════════════════ */

const LANGUAGES = [
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
] as const;

interface LanguageSelectorProps {
    onSelect: (lang: string) => void;
}

export function LanguageSelector({ onSelect }: LanguageSelectorProps) {
    const { i18n } = useTranslation();
    const [selected, setSelected] = useState(i18n.language?.slice(0, 2) || 'de');

    const handleConfirm = () => {
        void i18n.changeLanguage(selected);
        onSelect(selected);
    };

    return (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-8 mx-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                        <Globe className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                            Sprache wählen / Choose Language
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Select your preferred language for the tour.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            type="button"
                            onClick={() => setSelected(lang.code)}
                            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                selected === lang.code
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                            <span className="text-2xl">{lang.flag}</span>
                            <span className={`text-sm font-semibold ${
                                selected === lang.code
                                    ? 'text-blue-700 dark:text-blue-300'
                                    : 'text-slate-700 dark:text-slate-200'
                            }`}>
                                {lang.label}
                            </span>
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={handleConfirm}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                    {selected === 'de' ? 'Weiter' : selected === 'en' ? 'Continue' : selected === 'es' ? 'Continuar' : 'Continuer'}
                </button>
            </div>
        </div>
    );
}
