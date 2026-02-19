import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Optionen für den zentralen Bild-Upload-Hook.
 */
interface UseImageUploadOptions {
    initialUrl?: string | null;
    onUpload?: (file: File) => Promise<void> | void;
}

/**
 * Öffentlicher Hook-Vertrag für UI-Komponenten.
 */
interface UseImageUploadResult {
    previewUrl: string | null;
    handleImageUpload: (input: File | React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    setPreviewUrl: (url: string | null) => void;
    clearImage: () => void;
}

function extractFile(input: File | React.ChangeEvent<HTMLInputElement>): File | null {
    if (input instanceof File) return input;
    return input.target.files?.[0] ?? null;
}

/**
 * Zentralisiert Bild-Upload + Preview-URL-Lifecycle.
 *
 * Memory-Safety-Vertrag:
 * - Jede ersetzte Preview-URL wird via `URL.revokeObjectURL` freigegeben.
 * - `clearImage()` gibt aktiv die aktuelle URL frei.
 * - Beim Unmount wird ebenfalls freigegeben.
 *
 * Dieser Cleanup darf bei zukünftigen Refactorings nicht entfernt werden,
 * da sonst bei häufigem Bildwechsel ein Browser-Memory-Leak entsteht.
 */
export function useImageUpload(options: UseImageUploadOptions = {}): UseImageUploadResult {
    const { initialUrl = null, onUpload } = options;
    const [previewUrl, setPreviewUrlState] = useState<string | null>(initialUrl);
    const currentUrlRef = useRef<string | null>(initialUrl);

    const revokeCurrentUrl = useCallback(() => {
        if (currentUrlRef.current) {
            URL.revokeObjectURL(currentUrlRef.current);
            currentUrlRef.current = null;
        }
    }, []);

    const setPreviewUrl = useCallback((url: string | null) => {
        if (currentUrlRef.current && currentUrlRef.current !== url) {
            URL.revokeObjectURL(currentUrlRef.current);
        }
        currentUrlRef.current = url;
        setPreviewUrlState(url);
    }, []);

    const clearImage = useCallback(() => {
        revokeCurrentUrl();
        setPreviewUrlState(null);
    }, [revokeCurrentUrl]);

    const handleImageUpload = useCallback(async (input: File | React.ChangeEvent<HTMLInputElement>) => {
        const file = extractFile(input);
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            console.warn('[useImageUpload] Ignored non-image file:', file.type || file.name);
            return;
        }

        try {
            if (onUpload) {
                await onUpload(file);
            }
            const newUrl = URL.createObjectURL(file);
            setPreviewUrl(newUrl);
        } catch (error) {
            console.error('[useImageUpload] Upload failed:', error);
        }
    }, [onUpload, setPreviewUrl]);

    useEffect(() => {
        return () => {
            revokeCurrentUrl();
        };
    }, [revokeCurrentUrl]);

    return {
        previewUrl,
        handleImageUpload,
        setPreviewUrl,
        clearImage,
    };
}
