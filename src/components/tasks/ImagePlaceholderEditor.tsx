import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { addImage, getImageUrl } from '../../store/dexieStore';
import { useWorksheetStore } from '../../store/worksheetStore';
import type { ImagePlaceholderTask } from '../../types/worksheet';
import { useImageUpload } from '../../hooks/useImageUpload';

/* ══════════════════════════════════════════════════
   ImagePlaceholderEditor – Bild-Platzhalter Task
   Upload und Anzeige von Bildern via IndexedDB.
   ══════════════════════════════════════════════════ */

interface ImagePlaceholderEditorProps {
    task: ImagePlaceholderTask;
}

export const ImagePlaceholderEditor: React.FC<ImagePlaceholderEditorProps> = ({ task }) => {
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

    return (
        <div className="space-y-2">
            {/* Upload Zone / Bild-Vorschau */}
            {imageUrl ? (
                <div className="relative group">
                    <img
                        src={imageUrl}
                        alt={task.caption || 'Bild'}
                        className="max-w-full rounded-lg border border-slate-200 dark:border-slate-700"
                        style={{
                            maxWidth: `${task.widthMm}mm`,
                            maxHeight: `${task.heightMm}mm`,
                            objectFit: 'contain',
                        }}
                    />
                    <button
                        onClick={removeImage}
                        className="no-print absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg"
                        title="Bild entfernen"
                    >
                        <X size={14} />
                    </button>
                </div>
            ) : (
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
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.01]'
                            : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }
                    `}
                >
                    {isUploading ? (
                        <>
                            <Loader2 size={32} className="text-blue-500 animate-spin" />
                            <span className="text-sm text-slate-500">Wird hochgeladen...</span>
                        </>
                    ) : (
                        <>
                            <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full">
                                {isDragOver ? (
                                    <Upload size={24} className="text-blue-500" />
                                ) : (
                                    <ImageIcon size={24} className="text-slate-400" />
                                )}
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                    Bild hierher ziehen
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    oder klicken zum Auswählen
                                </p>
                            </div>
                        </>
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
            {!imageUrl && (
                <div
                    className="hidden print:block border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center"
                    style={{
                        width: `${task.widthMm}mm`,
                        height: `${task.heightMm}mm`,
                    }}
                >
                    <span className="text-slate-400 text-sm">[Bild-Platzhalter]</span>
                </div>
            )}

            {/* Caption Input */}
            <input
                type="text"
                value={task.caption}
                onChange={(e) => updateTask(task.id, { caption: e.target.value } as Partial<ImagePlaceholderTask>)}
                placeholder="Bildunterschrift (optional)"
                className="w-full px-2 py-1 text-xs bg-transparent border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
            />

            {/* Size Controls */}
            <div className="no-print flex items-center gap-3 text-xs text-slate-500">
                <label className="flex items-center gap-1.5">
                    Breite:
                    <input
                        type="range"
                        min={20}
                        max={170}
                        value={task.widthMm}
                        onChange={(e) => updateTask(task.id, { widthMm: Number(e.target.value) } as Partial<ImagePlaceholderTask>)}
                        className="w-20 accent-blue-500"
                    />
                    <span className="w-10 text-right">{task.widthMm}mm</span>
                </label>
                <label className="flex items-center gap-1.5">
                    Höhe:
                    <input
                        type="range"
                        min={20}
                        max={250}
                        value={task.heightMm}
                        onChange={(e) => updateTask(task.id, { heightMm: Number(e.target.value) } as Partial<ImagePlaceholderTask>)}
                        className="w-20 accent-blue-500"
                    />
                    <span className="w-10 text-right">{task.heightMm}mm</span>
                </label>
            </div>
        </div>
    );
};
