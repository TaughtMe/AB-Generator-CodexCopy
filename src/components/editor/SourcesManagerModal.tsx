import React, { useMemo, useState } from 'react';
import { ExternalLink, Plus, Trash2, X } from 'lucide-react';
import { useWorksheetStore } from '../../store/worksheetStore';
import { useWorkspaceStore } from '../../store/workspaceStore';

interface SourcesManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function normalizeUrl(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '';

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return withProtocol;
}

function isValidHttpUrl(input: string): boolean {
    try {
        const parsed = new URL(input);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

export const SourcesManagerModal: React.FC<SourcesManagerModalProps> = ({ isOpen, onClose }) => {
    const sources = useWorksheetStore((s) => s.sources);
    const upsertWorksheetSource = useWorkspaceStore((s) => s.upsertWorksheetSource);
    const removeWorksheetSource = useWorkspaceStore((s) => s.removeWorksheetSource);

    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const [error, setError] = useState<string | null>(null);

    const normalizedInputUrl = useMemo(() => normalizeUrl(url), [url]);

    if (!isOpen) return null;

    const handleAddSource = async () => {
        setError(null);

        const normalizedUrl = normalizeUrl(url);
        if (!normalizedUrl) {
            setError('Bitte eine URL eingeben.');
            return;
        }

        if (!isValidHttpUrl(normalizedUrl)) {
            setError('Bitte eine gültige http/https-URL eingeben.');
            return;
        }

        const alreadyExists = sources.some((source) => source.url.toLowerCase() === normalizedUrl.toLowerCase());
        if (alreadyExists) {
            setError('Diese Quelle ist bereits vorhanden.');
            return;
        }

        await upsertWorksheetSource({
            id: crypto.randomUUID(),
            url: normalizedUrl,
            title: title.trim(),
        });

        setUrl('');
        setTitle('');
    };

    const handleDeleteSource = async (sourceId: string) => {
        await removeWorksheetSource(sourceId);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Quellen zum Arbeitsblatt</h2>
                        <p className="text-[11px] text-slate-500">Links für Recherche und Urheberrecht dokumentieren.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Schließen"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://beispiel.de/artikel"
                            className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-200"
                        />
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Optionaler Titel"
                            className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-200"
                        />
                        <button
                            onClick={handleAddSource}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                            <Plus size={14} /> Hinzufügen
                        </button>
                    </div>

                    {normalizedInputUrl && (
                        <p className="text-[11px] text-slate-500">
                            Wird gespeichert als: {normalizedInputUrl}
                        </p>
                    )}

                    {error && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            {error}
                        </div>
                    )}

                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        {sources.length === 0 ? (
                            <p className="px-3 py-5 text-sm text-slate-500 text-center">Noch keine Quellen hinterlegt.</p>
                        ) : (
                            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                                {sources.map((source) => (
                                    <li key={source.id} className="px-3 py-2.5 flex items-center gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                                {source.title.trim() || source.url}
                                            </p>
                                            <a
                                                href={source.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 truncate"
                                            >
                                                <ExternalLink size={12} />
                                                <span className="truncate">{source.url}</span>
                                            </a>
                                        </div>

                                        <button
                                            onClick={() => handleDeleteSource(source.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                            title="Quelle löschen"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
