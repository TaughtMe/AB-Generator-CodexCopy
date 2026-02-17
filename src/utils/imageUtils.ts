/**
 * imageUtils.ts – Central image processing pipeline for Word (.docx) export.
 *
 * Ensures every image embedded in a Word document is a valid PNG binary
 * (Uint8Array), regardless of the source format (WebP, JPEG, PNG, etc.).
 *
 * Word does not reliably support WebP and the docx library expects raw
 * binary data (Uint8Array) – never a Base64 data-URL string.
 */

// ── Helper: Load an image source into an HTMLImageElement ────

/**
 * Loads any image source (data-URL, object-URL, regular URL) into an
 * HTMLImageElement and waits for it to be fully decoded.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (_e) =>
            reject(new Error('[imageUtils] Failed to load image from source'));
        // Allow cross-origin so canvas isn't tainted
        img.crossOrigin = 'anonymous';
        img.src = src;
    });
}

// ── Core pipeline ────────────────────────────────────────────

/**
 * Converts **any** image source into a clean PNG `Uint8Array` suitable
 * for the docx `ImageRun.data` property.
 *
 * Accepted inputs:
 *  - `Blob`        – e.g. from Dexie / IndexedDB
 *  - `Uint8Array`  – raw binary bytes (any format)
 *  - `string`      – Base64 data-URL (`data:image/...;base64,...`) or plain URL
 *
 * Processing steps:
 *  1. Normalise the input into something the browser can display (`<img>`).
 *  2. Draw onto an offscreen `<canvas>`.
 *  3. Export as `image/png` data-URL.
 *  4. Strip the data-URL header → decode Base64 → return raw bytes.
 *
 * This guarantees that even WebP or exotic formats become a valid PNG
 * that Microsoft Word can open without "Datei beschädigt" errors.
 */
export interface ImageMeta {
    data: Uint8Array;
    width: number;
    height: number;
    ratio: number; // width / height
}

export async function processImageForDocx(
    source: Blob | Uint8Array | string,
): Promise<ImageMeta> {
    // ── 1. Normalise to an object-URL or data-URL ────────────
    let imgSrc: string;
    let revokeUrl: string | null = null;

    if (source instanceof Blob) {
        imgSrc = URL.createObjectURL(source);
        revokeUrl = imgSrc;
    } else if (source instanceof Uint8Array) {
        const blob = new Blob([source]);
        imgSrc = URL.createObjectURL(blob);
        revokeUrl = imgSrc;
    } else if (typeof source === 'string') {
        imgSrc = source;
    } else {
        throw new Error('[imageUtils] Unsupported image source type');
    }

    try {
        // ── 2. Load into an HTMLImageElement ─────────────────
        const img = await loadImage(imgSrc);

        // ── 3. Draw onto canvas & export as PNG ──────────────
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('[imageUtils] Could not get 2D canvas context');
        }

        // White background (avoids transparent areas becoming black in Word)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const pngDataUrl = canvas.toDataURL('image/png');

        // ── 4. Strip header & decode Base64 → Uint8Array ─────
        const rawBase64 = pngDataUrl.split(',')[1];
        if (!rawBase64) {
            throw new Error('[imageUtils] Canvas produced an empty data-URL');
        }

        const binaryString = window.atob(rawBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Sanity check: verify PNG magic bytes
        if (
            bytes.length < 8 ||
            bytes[0] !== 0x89 ||
            bytes[1] !== 0x50 ||
            bytes[2] !== 0x4e ||
            bytes[3] !== 0x47
        ) {
            throw new Error('[imageUtils] Converted data is not valid PNG');
        }

        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        return {
            data: bytes,
            width: w,
            height: h,
            ratio: h > 0 ? w / h : 1,
        };
    } finally {
        // Always revoke temporary object-URLs to avoid memory leaks
        if (revokeUrl) {
            URL.revokeObjectURL(revokeUrl);
        }
    }
}
