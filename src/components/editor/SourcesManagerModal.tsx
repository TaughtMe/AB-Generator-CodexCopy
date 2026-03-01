import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FileText, Link as LinkIcon, Loader2, Trash2, Upload, X } from 'lucide-react';
import { useSourceStore } from '../../store/sourceStore';
import { IconButton } from '../ui/IconButton';
import { ICON_SIZES } from '../ui/iconSizes';
import { extractTextFromFile, extractTextFromUrl } from '../../utils/documentParser';

interface SourcesManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function normalizeUrlForDisplay(url: string): string {
    return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url) ? url : `https://${url}`;
}

function getUrlSourceName(url: string): string {
    try {
        return new URL(url).hostname || url;
    } catch {
        return url;
    }
}

export const SourcesManagerModal: React.FC<SourcesManagerModalProps> = ({ isOpen, onClose }) => {
    const sources = useSourceStore((s) => s.sources);
    const addSource = useSourceStore((s) => s.addSource);
    const removeSource = useSourceStore((s) => s.removeSource);
    const toggleSourceActive = useSourceStore((s) => s.toggleSourceActive);
    const clearSources = useSourceStore((s) => s.clearSources);

    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isUrlProcessing, setIsUrlProcessing] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isBusy = isProcessing || isUrlProcessing;

    const activeCount = useMemo(
        () => sources.filter((source) => source.isActive).length,
        [sources],
    );

    const handleFiles = useCallback(async (incomingFiles: File[]) => {
        setError(null);
        setStatus(null);
        if (incomingFiles.length === 0) return;

        setIsProcessing(true);
        let importedCount = 0;
        const failures: string[] = [];

        for (const file of incomingFiles) {
            try {
                const extractedText = await extractTextFromFile(file);
                if (!extractedText.trim()) {
                    failures.push(`${file.name}: Kein lesbarer Text gefunden.`);
                    continue;
                }

                addSource({
                    name: file.name,
                    extractedText,
                    isActive: true,
                });
                importedCount += 1;
            } catch (reason) {
                const message = reason instanceof Error ? reason.message : 'Unbekannter Parse-Fehler.';
                failures.push(`${file.name}: ${message}`);
            }
        }

        if (importedCount > 0) {
            setStatus(`${importedCount} Datei(en) erfolgreich importiert.`);
        }
        if (failures.length > 0) {
            setError(failures.join('\n'));
        }
        setIsProcessing(false);
    }, [addSource]);

    const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        await handleFiles(files);
        event.target.value = '';
    };

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
        if (isBusy) return;
        const files = Array.from(event.dataTransfer.files ?? []);
        await handleFiles(files);
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!isBusy) setIsDragging(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
    };

    const handleDeleteSource = (sourceId: string) => {
        removeSource(sourceId);
    };

    const handleClear = () => {
        clearSources();
        setStatus('Alle Quellen entfernt.');
        setError(null);
    };

    const openFileDialog = () => {
        if (isBusy) {
            return;
        }
        fileInputRef.current?.click();
    };

    const handleAddUrl = async () => {
        if (isBusy) return;

        setError(null);
        setStatus(null);

        const rawUrl = urlInput.trim();
        if (!rawUrl) {
            setError('Bitte eine URL eingeben.');
            return;
        }

        setIsUrlProcessing(true);
        try {
            const extractedText = await extractTextFromUrl(rawUrl);
            const normalizedUrl = normalizeUrlForDisplay(rawUrl);
            addSource({
                name: getUrlSourceName(normalizedUrl),
                extractedText,
                isActive: true,
            });
            setStatus('Link erfolgreich importiert.');
            setUrlInput('');
        } catch {
            setError('Website blockiert Zugriff oder URL ungültig.');
        } finally {
            setIsUrlProcessing(false);
        }
    };

    const handleUrlInputKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        await handleAddUrl();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Quellen verwalten</h2>
                        <p className="text-[11px] text-slate-500">
                            Dokumente und Links hinzufügen. Aktiv: {activeCount}/{sources.length}
                        </p>
                    </div>
                    <IconButton
                        onClick={onClose}
                        size="md"
                        className="rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Schließen"
                    >
                        <X className={ICON_SIZES[18]} />
                    </IconButton>
                </div>

                <div className="p-5 space-y-4">
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".txt,.md,.markdown,.pdf,.docx,text/plain,text/markdown,text/x-markdown,application/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={handleFileInputChange}
                    />

                    <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                            isDragging
                                ? 'border-blue-400 bg-blue-50/70 dark:bg-blue-950/20'
                                : 'border-slate-300 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-800/50'
                        }`}
                    >
                        <FileText className={`${ICON_SIZES[18]} mx-auto mb-2 text-slate-500`} />
                        <p className="text-sm text-slate-700 dark:text-slate-200">
                            Dateien hier ablegen oder auswählen
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                            Unterstützt: TXT, MD, PDF, DOCX
                        </p>
                        <button
                            onClick={openFileDialog}
                            disabled={isBusy}
                            className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Upload className={ICON_SIZES[14]} />
                            Dateien auswählen
                        </button>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200 mb-2">
                            Website als Quelle hinzufügen
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="url"
                                value={urlInput}
                                onChange={(event) => setUrlInput(event.target.value)}
                                onKeyDown={handleUrlInputKeyDown}
                                placeholder="https://example.com/artikel"
                                disabled={isBusy}
                                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                            />
                            <button
                                type="button"
                                onClick={handleAddUrl}
                                disabled={isBusy || !urlInput.trim()}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUrlProcessing ? (
                                    <Loader2 className={`${ICON_SIZES[14]} animate-spin`} />
                                ) : (
                                    <LinkIcon className={ICON_SIZES[14]} />
                                )}
                                Link hinzufügen
                            </button>
                        </div>
                    </div>

                    {isProcessing && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                            Dateien werden verarbeitet...
                        </div>
                    )}

                    {isUrlProcessing && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                            Link wird verarbeitet...
                        </div>
                    )}

                    {error && (
                        <div className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            {error}
                        </div>
                    )}

                    {status && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                            {status}
                        </div>
                    )}

                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        {sources.length === 0 ? (
                            <p className="px-3 py-5 text-sm text-slate-500 text-center">Noch keine Quellen hochgeladen.</p>
                        ) : (
                            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                                {sources.map((source) => (
                                    <li key={source.id} className="px-3 py-2.5 flex items-center gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                                {source.name}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {source.extractedText.length.toLocaleString('de-DE')} Zeichen extrahiert
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={source.isActive}
                                            onClick={() => toggleSourceActive(source.id)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                source.isActive
                                                    ? 'bg-emerald-500'
                                                    : 'bg-slate-300 dark:bg-slate-600'
                                            }`}
                                            title={source.isActive ? 'Quelle deaktivieren' : 'Quelle aktivieren'}
                                        >
                                            <span
                                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                                    source.isActive ? 'translate-x-5' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>

                                        <IconButton
                                            onClick={() => handleDeleteSource(source.id)}
                                            size="md"
                                            className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                                            title="Quelle löschen"
                                        >
                                            <Trash2 className={ICON_SIZES[14]} />
                                        </IconButton>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {sources.length > 0 && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handleClear}
                                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                Alle Quellen entfernen
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
