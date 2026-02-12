import React, { useState } from 'react';
import { Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { clsx } from 'clsx';

interface MainLayoutProps {
    editor: React.ReactNode;
    preview: React.ReactNode;
    header?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ editor, preview, header }) => {
    const [showPreview, setShowPreview] = useState(false);
    const [isDark, setIsDark] = useState(() =>
        document.documentElement.classList.contains('dark')
    );

    const toggleDark = () => {
        document.documentElement.classList.toggle('dark');
        setIsDark((prev) => !prev);
    };

    return (
        <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            {/* Editor Column (Left) */}
            <div
                className={clsx(
                    "h-full overflow-y-auto border-r border-slate-200 dark:border-slate-800 p-6 lg:p-8 shadow-sm relative z-10 custom-scrollbar transition-all",
                    showPreview ? "hidden lg:block" : "w-full",
                    "lg:w-1/2"
                )}
            >
                <div className="max-w-2xl mx-auto">
                    <header className="mb-8 flex items-start justify-between gap-4">
                        <div>
                            {header || (
                                <>
                                    <h1 className="text-3xl font-bold tracking-tight">
                                        AB-Generator{' '}
                                        <span className="text-blue-500 text-sm font-normal align-middle">V2.0</span>
                                    </h1>
                                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                                        Erstelle dein perfektes Arbeitsblatt.
                                    </p>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            {/* Dark Mode Toggle */}
                            <button
                                onClick={toggleDark}
                                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title={isDark ? 'Light Mode' : 'Dark Mode'}
                            >
                                {isDark ? <Sun size={18} /> : <Moon size={18} />}
                            </button>
                            {/* Preview Toggle (mobile only) */}
                            <button
                                onClick={() => setShowPreview((p) => !p)}
                                className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title={showPreview ? 'Editor anzeigen' : 'Vorschau anzeigen'}
                            >
                                {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </header>
                    {editor}
                </div>
            </div>

            {/* Preview Column (Right) */}
            <div
                className={clsx(
                    "h-full bg-slate-200/60 dark:bg-slate-900 overflow-auto flex items-start justify-center p-8 lg:p-12 custom-scrollbar transition-all",
                    showPreview ? "w-full lg:w-1/2" : "hidden lg:flex lg:w-1/2"
                )}
            >
                {/* Mobile back button */}
                <button
                    onClick={() => setShowPreview(false)}
                    className="lg:hidden fixed top-4 left-4 z-30 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-md text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                    ← Zurück zum Editor
                </button>
                <div className="sticky top-12">
                    {preview}
                </div>
            </div>
        </div>
    );
};
