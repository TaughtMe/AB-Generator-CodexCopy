import { toJpeg } from 'html-to-image';

/* ══════════════════════════════════════════════════
   thumbnailCapture.ts – Screenshot der Worksheet-Seite
   Nutzt html-to-image (SVG <foreignObject>) für 100 %
   CSS-Treue. Filtert Editor-UI-Elemente heraus, damit
   der Screenshot wie ein gedrucktes Blatt aussieht.

   LOGGING: Jeder Schritt wird mit console.log geloggt,
   Fehler werden per console.error mit vollem Stack-Trace
   ausgegeben. Capture-Fehler blockieren NIE das Speichern.
   ══════════════════════════════════════════════════ */

const TAG = '[thumbnailCapture]';

/** Output thumbnail width (px) */
const THUMB_WIDTH = 320;
/** JPEG-Qualität (0-1) */
const JPEG_QUALITY = 0.75;
/** Max. Höhe des gecaptureten Bereichs (px) */
const CAPTURE_HEIGHT = 400;

/**
 * CSS-Klassen, die vom Screenshot ausgeschlossen werden.
 * Editor-Chrome, Hover-Menus, Seitenumbruch-Markierungen.
 */
const EXCLUDED_CLASSES = [
    'task-card-header',   // Drag-Handle + Action-Buttons
    'no-print',           // Diverse Editor-Controls
    'page-break-task',    // Seitenumbruch-Linie
    'print-task-index',   // Print-only Aufgaben-Index
    'zoom-container',     // Zoom-Wrapper (Transform verfälscht Capture)
];

/**
 * Filter-Callback für html-to-image.
 * Gibt `false` zurück → Node wird ausgeblendet.
 */
function shouldIncludeNode(node: HTMLElement): boolean {
    if (!(node instanceof HTMLElement)) return true;
    for (const cls of EXCLUDED_CLASSES) {
        if (node.classList.contains(cls)) return false;
    }
    return true;
}

/**
 * Konvertiert eine DataURL in einen Blob.
 */
function dataUrlToBlob(dataUrl: string): Blob {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

/**
 * Captures the top part of the first `.a4-page` element as a
 * compressed JPEG Blob suitable for storage.
 * Returns `null` if no page element is found or capture fails.
 */
export async function captureWorksheetThumbnail(): Promise<Blob | null> {
    console.log(TAG, '▶ Capture gestartet');

    // ── Schritt A: DOM-Element finden ──
    const pageEl = document.querySelector('.a4-page') as HTMLElement | null;
    if (!pageEl) {
        console.error(TAG, '✖ Kein .a4-page Element im DOM gefunden!');
        return null;
    }
    console.log(TAG, `  .a4-page gefunden: ${pageEl.offsetWidth}×${pageEl.scrollHeight}px`);

    try {
        // ── Schritt B: html-to-image Capture ──
        const captureH = Math.min(pageEl.scrollHeight, CAPTURE_HEIGHT);
        const captureW = pageEl.offsetWidth;
        console.log(TAG, `  toJpeg starten: ${captureW}×${captureH}px, quality=${JPEG_QUALITY}`);

        const dataUrl = await toJpeg(pageEl, {
            quality: JPEG_QUALITY,
            pixelRatio: 1,
            height: captureH,
            width: captureW,
            style: {
                overflow: 'hidden',
                maxHeight: `${CAPTURE_HEIGHT}px`,
            },
            filter: shouldIncludeNode,
            backgroundColor: '#ffffff',
            skipFonts: true,
        });

        if (!dataUrl || dataUrl.length < 100) {
            console.error(TAG, '✖ toJpeg lieferte leere/ungültige DataURL', { length: dataUrl?.length });
            return null;
        }
        console.log(TAG, `  ✔ DataURL erhalten (${(dataUrl.length / 1024).toFixed(1)} KB)`);

        // ── Schritt C: DataURL → Blob → ImageBitmap ──
        const fullBlob = dataUrlToBlob(dataUrl);
        console.log(TAG, `  Full-Blob: ${(fullBlob.size / 1024).toFixed(1)} KB, type=${fullBlob.type}`);

        let bitmap: ImageBitmap;
        try {
            bitmap = await createImageBitmap(fullBlob);
        } catch (bitmapErr) {
            console.error(TAG, '✖ createImageBitmap fehlgeschlagen:', bitmapErr);
            // Fallback: den vollen Blob zurückgeben (nicht skaliert)
            return fullBlob;
        }
        console.log(TAG, `  Bitmap: ${bitmap.width}×${bitmap.height}px`);

        // ── Schritt D: Auf Thumbnail-Größe runterskalieren ──
        const aspect = bitmap.height / bitmap.width;
        const thumbW = THUMB_WIDTH;
        const thumbH = Math.round(thumbW * aspect);

        const out = document.createElement('canvas');
        out.width = thumbW;
        out.height = thumbH;
        const ctx = out.getContext('2d');
        if (!ctx) {
            console.error(TAG, '✖ Canvas 2D Context konnte nicht erstellt werden');
            bitmap.close();
            return fullBlob; // Fallback
        }

        ctx.drawImage(bitmap, 0, 0, thumbW, thumbH);
        bitmap.close();

        // ── Schritt E: Canvas → JPEG Blob ──
        const thumbBlob = await new Promise<Blob | null>((resolve) => {
            out.toBlob(
                (blob) => resolve(blob),
                'image/jpeg',
                JPEG_QUALITY,
            );
        });

        if (!thumbBlob) {
            console.error(TAG, '✖ canvas.toBlob lieferte null');
            return null;
        }

        console.log(TAG, `  ✔ Thumbnail fertig: ${thumbW}×${thumbH}px, ${(thumbBlob.size / 1024).toFixed(1)} KB`);
        return thumbBlob;

    } catch (err: unknown) {
        // ── ROBUSTER CATCH: Alles auf einmal ausgeben ──
        console.error(
            TAG, '✖ CAPTURE FEHLGESCHLAGEN:',
            err instanceof Error
                ? `${err.name}: ${err.message}\n${err.stack}`
                : err
        );
        return null;
    }
}
