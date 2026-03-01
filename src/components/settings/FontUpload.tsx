import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Loader2, Trash2, Type, Upload } from 'lucide-react';
import { useFontStore } from '../../store/fontStore';
import { IconButton } from '../ui/IconButton';
import { ICON_SIZES } from '../ui/iconSizes';

export function FontUpload() {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const customFonts = useFontStore((state) => state.customFonts);
    const isLoading = useFontStore((state) => state.isLoading);
    const error = useFontStore((state) => state.error);
    const loadCustomFonts = useFontStore((state) => state.loadCustomFonts);
    const addCustomFontFromFile = useFontStore((state) => state.addCustomFontFromFile);
    const removeCustomFont = useFontStore((state) => state.removeCustomFont);
    const clearError = useFontStore((state) => state.clearError);

    useEffect(() => {
        void loadCustomFonts();
    }, [loadCustomFonts]);

    async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setIsUploading(true);
        try {
            await addCustomFontFromFile(file);
        } finally {
            setIsUploading(false);
        }
    }

    return (
        <div className="max-w-2xl space-y-4">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Schriftarten</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Lade eigene Fonts hoch. Dateien werden lokal in IndexedDB gespeichert und im Editor direkt nutzbar.
            </p>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ttf,.otf,.woff,.woff2"
                    onChange={handleFileChange}
                    className="hidden"
                />

                <button
                    type="button"
                    onClick={() => {
                        clearError();
                        fileInputRef.current?.click();
                    }}
                    disabled={isUploading}
                    className="inline-flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    {isUploading ? <Loader2 className={`${ICON_SIZES[14]} animate-spin`} /> : <Upload className={ICON_SIZES[14]} />}
                    Schriftart hochladen
                </button>

                {error && (
                    <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
                )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/70 dark:bg-slate-900/40">
                <div className="flex items-center gap-2 mb-3">
                    <Type className={`${ICON_SIZES[14]} text-slate-500 dark:text-slate-300`} />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Hochgeladene Schriftarten</p>
                </div>

                {isLoading && (
                    <div className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Loader2 className={`${ICON_SIZES[12]} animate-spin`} />
                        Lade Schriftarten...
                    </div>
                )}

                {!isLoading && customFonts.length === 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Noch keine eigenen Schriftarten hochgeladen.</p>
                )}

                {!isLoading && customFonts.length > 0 && (
                    <ul className="space-y-2">
                        {customFonts.map((font) => (
                            <li
                                key={font.id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-700 dark:text-slate-200 truncate" style={{ fontFamily: `"${font.name}", sans-serif` }}>
                                        {font.name}
                                    </p>
                                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">.{font.format}</p>
                                </div>

                                <IconButton
                                    onClick={() => {
                                        void removeCustomFont(font.id);
                                    }}
                                    size="sm"
                                    className="rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-slate-300 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                                    title="Schriftart löschen"
                                >
                                    <Trash2 className={ICON_SIZES[14]} />
                                </IconButton>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
