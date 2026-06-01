import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { addImage, getImageUrl } from '../../store/dexieStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { ImagePlaceholderTask, ImageAlignment } from '../../types/worksheet';
import { useImageUpload } from '../../hooks/useImageUpload';
import { ICON_SIZES } from '../ui/iconSizes';

type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

interface ImageTaskEditorProps {
    task: ImagePlaceholderTask;
    isActive?: boolean;
}

type ResizeState = {
    direction: ResizeDirection;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    aspectRatio: number;
};

function clamp(value: number, min: number): number {
    return Math.max(min, Math.round(value));
}

export const ImageTaskEditor: React.FC<ImageTaskEditorProps> = ({ task, isActive = true }) => {
    const updateTask = useWorkspaceStore((s) => s.updateTask);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const cropImageRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

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
    const [liveSize, setLiveSize] = useState<{ width: number; height: number } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageWrapperRef = useRef<HTMLDivElement>(null);
    const resizeStateRef = useRef<ResizeState | null>(null);
    const liveSizeRef = useRef<{ width: number; height: number } | null>(null);

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
            console.warn('[ImageTaskEditor] Ignored non-image file:', file.type || file.name);
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
        updateTask(
            task.id,
            { imageId: undefined, src: undefined, isCropping: false } as unknown as Partial<ImagePlaceholderTask>,
        );
        clearImage();
    }, [task.id, updateTask, clearImage]);

    const handleSaveCrop = useCallback(() => {
        const image = cropImageRef.current;
        const canvas = canvasRef.current;
        if (!image || !canvas || !completedCrop) return;
        if (completedCrop.width <= 0 || completedCrop.height <= 0) return;

        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        const cropWidth = Math.max(1, Math.round(completedCrop.width * scaleX));
        const cropHeight = Math.max(1, Math.round(completedCrop.height * scaleY));

        canvas.width = cropWidth;
        canvas.height = cropHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
            image,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY,
            0,
            0,
            cropWidth,
            cropHeight,
        );

        const base64Image = canvas.toDataURL('image/jpeg', 0.9);
        updateTask(
            task.id,
            {
                src: base64Image,
                width: `${completedCrop.width}px`,
                height: `${completedCrop.height}px`,
                isCropping: false,
            } as unknown as Partial<ImagePlaceholderTask>,
        );
        setCrop(undefined);
        setCompletedCrop(undefined);
    }, [completedCrop, task.id, updateTask]);

    const onResizeHandleMouseDown = useCallback((direction: ResizeDirection, e: React.MouseEvent<HTMLButtonElement>) => {
        if (!isActive) return;
        e.preventDefault();
        e.stopPropagation();

        const wrapper = imageWrapperRef.current;
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        resizeStateRef.current = {
            direction,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: rect.width,
            startHeight: rect.height,
            aspectRatio: rect.width / rect.height,
        };

        const onMouseMove = (moveEvent: MouseEvent) => {
            const state = resizeStateRef.current;
            if (!state) return;

            const deltaX = moveEvent.clientX - state.startX;
            const deltaY = moveEvent.clientY - state.startY;

            const hasEast = state.direction.includes('e');
            const hasWest = state.direction.includes('w');
            const hasNorth = state.direction.includes('n');
            const hasSouth = state.direction.includes('s');

            let nextWidth = state.startWidth;
            let nextHeight = state.startHeight;

            const isCorner = (hasEast || hasWest) && (hasNorth || hasSouth);

            if (isCorner) {
                const widthByX = hasEast ? state.startWidth + deltaX : state.startWidth - deltaX;
                const heightByY = hasSouth ? state.startHeight + deltaY : state.startHeight - deltaY;

                if (Math.abs(deltaX) >= Math.abs(deltaY)) {
                    nextWidth = clamp(widthByX, 48);
                    nextHeight = clamp(nextWidth / state.aspectRatio, 48);
                } else {
                    nextHeight = clamp(heightByY, 48);
                    nextWidth = clamp(nextHeight * state.aspectRatio, 48);
                }
            } else {
                if (hasEast) nextWidth = clamp(state.startWidth + deltaX, 48);
                if (hasWest) nextWidth = clamp(state.startWidth - deltaX, 48);
                if (hasSouth) nextHeight = clamp(state.startHeight + deltaY, 48);
                if (hasNorth) nextHeight = clamp(state.startHeight - deltaY, 48);
            }

            const next = { width: nextWidth, height: nextHeight };
            liveSizeRef.current = next;
            setLiveSize(next);
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            const next = liveSizeRef.current;
            if (next) {
                updateTask(task.id, { width: `${next.width}px`, height: `${next.height}px` } as Partial<ImagePlaceholderTask>);
            }

            resizeStateRef.current = null;
            liveSizeRef.current = null;
            setLiveSize(null);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [isActive, task.id, updateTask]);

    const currentAlign: ImageAlignment = task.align ?? task.imageAlign ?? 'left';
    const previewAlignmentClass = currentAlign === 'center'
        ? 'justify-center'
        : currentAlign === 'right'
            ? 'justify-end'
            : 'justify-start';
    const captionAlignmentClass = currentAlign === 'center'
        ? 'text-center'
        : currentAlign === 'right'
            ? 'text-right'
            : 'text-left';

    const imageStyle = {
        width: liveSize ? `${liveSize.width}px` : (task.width || '100%'),
        height: liveSize ? `${liveSize.height}px` : (task.height || 'auto'),
        opacity: task.opacity ?? 1,
        objectFit: 'fill' as const,
    };
    const taskSrc = (task as ImagePlaceholderTask & { src?: string }).src;
    const isCropping = Boolean((task as ImagePlaceholderTask & { isCropping?: boolean }).isCropping);
    const displaySrc = taskSrc || imageUrl;

    useEffect(() => {
        if (!isCropping) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Enter') return;
            if (event.repeat) return;

            const target = event.target as HTMLElement | null;
            const tagName = target?.tagName?.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable) {
                return;
            }

            event.preventDefault();
            handleSaveCrop();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isCropping, handleSaveCrop]);

    const handles: Array<{ direction: ResizeDirection; className: string }> = [
        { direction: 'nw', className: '-top-1.5 -left-1.5 cursor-nwse-resize' },
        { direction: 'n', className: '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
        { direction: 'ne', className: '-top-1.5 -right-1.5 cursor-nesw-resize' },
        { direction: 'e', className: 'top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize' },
        { direction: 'se', className: '-bottom-1.5 -right-1.5 cursor-nwse-resize' },
        { direction: 's', className: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
        { direction: 'sw', className: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
        { direction: 'w', className: 'top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize' },
    ];

    return (
        <div className="space-y-2">
            {displaySrc ? (
                <div className={`flex w-full ${previewAlignmentClass}`}>
                    {isCropping ? (
                        <div className="relative inline-block">
                            <ReactCrop
                                className="inline-block max-w-full"
                                crop={crop}
                                onChange={(nextCrop) => setCrop(nextCrop)}
                                onComplete={(nextCrop) => {
                                    if (nextCrop.width <= 0 || nextCrop.height <= 0) {
                                        setCompletedCrop(undefined);
                                        return;
                                    }
                                    setCompletedCrop(nextCrop);
                                }}
                            >
                                <img
                                    ref={cropImageRef}
                                    src={displaySrc}
                                    alt={task.caption || 'Bild'}
                                    className="block max-w-full rounded-lg border border-worksheet-border"
                                    style={{
                                        width: task.width || '100%',
                                        height: task.height || 'auto',
                                        objectFit: 'fill',
                                        opacity: task.opacity ?? 1,
                                    }}
                                    onLoad={() => {
                                        setCrop({ unit: '%', x: 10, y: 10, width: 80, height: 80 });
                                    }}
                                />
                            </ReactCrop>
                            <div className="no-print mt-2 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleSaveCrop}
                                    className="h-8 px-3 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-colors cursor-pointer"
                                >
                                    Speichern
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        updateTask(
                                            task.id,
                                            { isCropping: false } as unknown as Partial<ImagePlaceholderTask>,
                                        );
                                        setCrop(undefined);
                                        setCompletedCrop(undefined);
                                    }}
                                    className="h-8 px-3 rounded-md bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300 transition-colors cursor-pointer"
                                >
                                    Abbrechen
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div ref={imageWrapperRef} className="relative inline-block group">
                            <img
                                src={displaySrc}
                                alt={task.caption || 'Bild'}
                                className="block rounded-lg border border-worksheet-border"
                                style={imageStyle}
                            />

                            {isActive && (
                            <>
                                <button
                                    onClick={removeImage}
                                    className="no-print absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg z-20"
                                    title="Bild entfernen"
                                >
                                    <X className={ICON_SIZES[14]} />
                                </button>

                                <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-500 group-focus-within:border-blue-500 pointer-events-none">
                                    {handles.map((handle) => (
                                        <button
                                            key={handle.direction}
                                            type="button"
                                            onMouseDown={(e) => onResizeHandleMouseDown(handle.direction, e)}
                                            className={`
                                                absolute w-3 h-3 bg-white border border-blue-500 rounded-full
                                                pointer-events-auto z-30 ${handle.className}
                                            `}
                                            aria-label={`Resize ${handle.direction}`}
                                        />
                                    ))}
                                </div>
                            </>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className={`flex w-full ${previewAlignmentClass}`}>
                    {isActive ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            className={clsx(
                                'no-print flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200',
                                isDragOver
                                    ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                                    : 'border-worksheet-border bg-worksheet-field hover:border-blue-400 hover:bg-slate-50',
                            )}
                            style={{
                                width: task.width || '100%',
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
                                        <p className="text-sm font-medium text-worksheet-ink">Bild hierher ziehen</p>
                                        <p className="text-xs text-worksheet-inkLight mt-0.5">oder klicken zum Auswählen</p>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        /* Read-only / print: use physical mm dimensions so the placeholder
                           has a proper printable size instead of collapsing to text height. */
                        <div
                            className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded-lg"
                            style={{
                                width: `${task.widthMm || 80}mm`,
                                height: `${task.heightMm || 60}mm`,
                            }}
                        >
                            <ImageIcon className="text-slate-300" style={{ width: '10mm', height: '10mm' }} />
                        </div>
                    )}
                </div>
            )}

            <canvas ref={canvasRef} className="hidden" />

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
            />

            {!displaySrc && isActive && (
                <div className={`hidden print:flex w-full ${previewAlignmentClass}`}>
                    <div
                        className="border-2 border-dashed border-worksheet-border rounded-lg flex items-center justify-center"
                        style={{
                            width: task.width || '100%',
                            height: task.height || 'auto',
                        }}
                    >
                        <span className="text-worksheet-inkLight text-sm">[Bild-Platzhalter]</span>
                    </div>
                </div>
            )}

            {isActive && (
                <input
                    type="text"
                    value={task.caption}
                    onChange={(e) => updateTask(task.id, { caption: e.target.value } as Partial<ImagePlaceholderTask>)}
                    placeholder="Bildunterschrift (optional)"
                    className="no-print w-full px-2 py-1 text-xs bg-transparent border border-worksheet-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-worksheet-ink placeholder:text-worksheet-inkLight"
                />
            )}

            {task.caption.trim().length > 0 && (
                <p className={`${isActive ? 'hidden print:block' : 'block'} text-xs italic text-worksheet-inkLight ${captionAlignmentClass}`}>
                    {task.caption}
                </p>
            )}
        </div>
    );
};
