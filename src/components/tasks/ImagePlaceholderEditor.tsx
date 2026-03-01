import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon, X, Loader2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { addImage, getImageUrl } from '../../store/dexieStore';
import { useWorksheetStore } from '../../store/worksheetStore';
import type { ImagePlaceholderTask, ImageAlignment } from '../../types/worksheet';
import { useImageUpload } from '../../hooks/useImageUpload';
import { ICON_SIZES } from '../ui/iconSizes';

/* ══════════════════════════════════════════════════
   ImagePlaceholderEditor – Bild-Platzhalter Task
   Upload und Anzeige von Bildern via IndexedDB.
   ══════════════════════════════════════════════════ */

interface ImagePlaceholderEditorProps {
    task: ImagePlaceholderTask;
    isActive?: boolean;
}

const ALIGNMENT_OPTIONS: Array<{ value: ImageAlignment; label: string; Icon: React.ElementType }> = [
    { value: 'left', label: 'Links', Icon: AlignLeft },
    { value: 'center', label: 'Zentriert', Icon: AlignCenter },
    { value: 'right', label: 'Rechts', Icon: AlignRight },
];

export const ImagePlaceholderEditor: React.FC<ImagePlaceholderEditorProps> = ({ task, isActive = true }) => {
    const PX_PER_MM = 96 / 25.4;
    const updateTask = useWorksheetStore((s) => s.updateTask);
    const {
        previewUrl: imageUrl,
        handleImageUpload,
        setPreviewUrl,
        clearImage,
    } = useImageUpload({
        onUpload: async (file) => {
            const id = await addImage(file.name, file);
            updateTask(task.id, { imageId: id } as Partial<ImagePlaceholderTask>);
        },
    });
    const [isUploading, setIsUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [availableWidthMm, setAvailableWidthMm] = useState<number | null>(null);

    // Bestehende Bild-URL laden
    useEffect(() => {
        if (task.imageId) {
            getImageUrl(task.imageId).then((url) => {
                setPreviewUrl(url);
            });
        } else {
            clearImage();
        }
    }, [task.imageId, setPreviewUrl, clearImage]);

    const handleFile = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            console.warn('[ImagePlaceholderEditor] Ignored non-image file:', file.type || file.name);
            return;
        }

        setIsUploading(true);
        try {
            await handleImageUpload(file);
        } catch (err) {
            console.error('Image upload failed:', err);
        } finally {
            setIsUploading(false);
        }
    }, [handleImageUpload]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const removeImage = useCallback(() => {
        updateTask(task.id, { imageId: undefined } as Partial<ImagePlaceholderTask>);
        clearImage();
    }, [task.id, updateTask, clearImage]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;

        const updateAvailableWidth = () => {
            const widthPx = Math.max(0, el.clientWidth - 8);
            const widthMm = Math.floor(widthPx / PX_PER_MM);
            setAvailableWidthMm(widthMm > 0 ? widthMm : null);
        };

        updateAvailableWidth();
        const observer = new ResizeObserver(updateAvailableWidth);
        observer.observe(el);
        return () => observer.disconnect();
    }, [PX_PER_MM]);

    const widthSliderMaxMm = Math.max(
        20,
        Math.min(170, availableWidthMm ?? 170),
    );
    const effectivePreviewWidthMm = Math.min(task.widthMm, widthSliderMaxMm);
    const effectiveSliderWidthValue = Math.min(task.widthMm, widthSliderMaxMm);
    const imageAlign: ImageAlignment = task.imageAlign ?? 'left';
    const previewAlignmentClass = imageAlign === 'center'
        ? 'justify-center'
        : imageAlign === 'right'
            ? 'justify-end'
            : 'justify-start';
    const captionAlignmentClass = imageAlign === 'center'
        ? 'text-center'
        : imageAlign === 'right'
            ? 'text-right'
            : 'text-left';

    return (
        <div ref={containerRef} className="space-y-2 min-w-0">
            {/* Upload Zone / Bild-Vorschau */}
            {imageUrl ? (
                <div className={`flex w-full ${previewAlignmentClass}`}>
                    <div className="relative group">
                        <img
                            src={imageUrl}
                            alt={task.caption || 'Bild'}
                            className="max-w-full rounded-lg border border-worksheet-border"
                            style={{
                                maxWidth: `${effectivePreviewWidthMm}mm`,
                                maxHeight: `${task.heightMm}mm`,
                                objectFit: 'contain',
                            }}
                        />
                        {isActive && (
                            <button
                                onClick={removeImage}
                                className="no-print absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg"
                                title="Bild entfernen"
                            >
                                <X className={ICON_SIZES[14]} />
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className={`flex w-full ${previewAlignmentClass}`}>
                    {isActive ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            className={`
                                no-print flex flex-col items-center justify-center gap-3 p-8
                                border-2 border-dashed rounded-xl cursor-pointer
                                transition-all duration-200
                                ${isDragOver
                                    ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                                    : 'border-worksheet-border bg-worksheet-field hover:border-blue-400 hover:bg-slate-50'
                                }
                            `}
                            style={{
                                width: `${effectivePreviewWidthMm}mm`,
                                maxWidth: '100%',
                            }}
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className={`${ICON_SIZES[32]} text-blue-500 animate-spin`} />
                                    <span className="text-sm text-worksheet-inkLight">Wird hochgeladen...</span>
                                </>
                            ) : (
                                <>
                                    <div className="p-3 bg-worksheet-field border border-worksheet-border rounded-full print:bg-transparent print:border-none">
                                        {isDragOver ? (
                                            <Upload className={`${ICON_SIZES[24]} text-blue-500`} />
                                        ) : (
                                            <ImageIcon className={`${ICON_SIZES[24]} text-worksheet-inkLight`} />
                                        )}
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-worksheet-ink">
                                            Bild hierher ziehen
                                        </p>
                                        <p className="text-xs text-worksheet-inkLight mt-0.5">
                                            oder klicken zum Auswählen
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div
                            className="flex items-center justify-center border-2 border-dashed border-worksheet-border rounded-lg"
                            style={{
                                width: `${task.widthMm}mm`,
                                height: `${task.heightMm}mm`,
                                maxWidth: '100%',
                            }}
                        >
                            <span className="text-worksheet-inkLight text-sm">[Bild-Platzhalter]</span>
                        </div>
                    )}
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
            />

            {/* Print-Platzhalter wenn kein Bild */}
            {!imageUrl && isActive && (
                <div className={`hidden print:flex w-full ${previewAlignmentClass}`}>
                    <div
                        className="border-2 border-dashed border-worksheet-border rounded-lg flex items-center justify-center"
                        style={{
                            width: `${task.widthMm}mm`,
                            height: `${task.heightMm}mm`,
                        }}
                    >
                        <span className="text-worksheet-inkLight text-sm">[Bild-Platzhalter]</span>
                    </div>
                </div>
            )}

            {/* Caption Input (nur Editor) */}
            {isActive && (
                <input
                    type="text"
                    value={task.caption}
                    onChange={(e) => updateTask(task.id, { caption: e.target.value } as Partial<ImagePlaceholderTask>)}
                    placeholder="Bildunterschrift (optional)"
                    className="no-print w-full min-w-0 px-2 py-1 text-xs bg-transparent border border-worksheet-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-worksheet-ink placeholder:text-worksheet-inkLight"
                />
            )}

            {/* Print-Caption (read-only) */}
            {task.caption.trim().length > 0 && (
                <p className={`${isActive ? 'hidden print:block' : 'block'} text-xs italic text-worksheet-inkLight ${captionAlignmentClass}`}>
                    {task.caption}
                </p>
            )}

            {/* Size + Alignment Controls */}
            {isActive && (
                <div className="no-print flex flex-wrap items-center gap-3 text-xs text-worksheet-inkLight min-w-0">
                    <label className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        Ausrichtung:
                        <span className="inline-flex items-center rounded-md border border-worksheet-border overflow-hidden bg-white/70">
                            {ALIGNMENT_OPTIONS.map(({ value, label, Icon }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => updateTask(task.id, { imageAlign: value } as Partial<ImagePlaceholderTask>)}
                                    className={`px-2 py-1 inline-flex items-center gap-1 transition-colors cursor-pointer ${imageAlign === value ? 'bg-blue-50 text-blue-700' : 'text-worksheet-inkLight hover:bg-slate-50'}`}
                                    title={label}
                                    aria-label={`Bild ${label.toLowerCase()} ausrichten`}
                                >
                                    <Icon className={ICON_SIZES[12]} />
                                </button>
                            ))}
                        </span>
                    </label>
                    <label className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        Breite:
                        <input
                            type="range"
                            min={20}
                            max={widthSliderMaxMm}
                            value={effectiveSliderWidthValue}
                            onChange={(e) => updateTask(task.id, { widthMm: Number(e.target.value) } as Partial<ImagePlaceholderTask>)}
                            className="w-20 min-w-0 accent-blue-500"
                        />
                        <span className="w-10 text-right" title={task.widthMm !== effectivePreviewWidthMm ? `Gespeichert: ${task.widthMm}mm` : undefined}>
                            {effectivePreviewWidthMm}mm
                        </span>
                    </label>
                    <label className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        Höhe:
                        <input
                            type="range"
                            min={20}
                            max={250}
                            value={task.heightMm}
                            onChange={(e) => updateTask(task.id, { heightMm: Number(e.target.value) } as Partial<ImagePlaceholderTask>)}
                            className="w-20 min-w-0 accent-blue-500"
                        />
                        <span className="w-10 text-right">{task.heightMm}mm</span>
                    </label>
                </div>
            )}
        </div>
    );
};
