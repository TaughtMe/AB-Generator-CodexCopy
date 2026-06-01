/**
 * mathExportUtils.ts – Converts LaTeX formulas to high-res PNG images
 *
 * Since Word (.docx) cannot render KaTeX HTML/CSS, we render the formula
 * into a temporary DOM element, capture it with html-to-image at ~300 DPI,
 * and return the result as a Blob.
 */

import DOMPurify from 'dompurify';
import { toPng } from 'html-to-image';

/**
 * Fixed pixel-ratio for high-res output (~300 DPI).
 */
const PIXEL_RATIO = 4;

/**
 * Renders a LaTeX string to a high-resolution PNG Blob.
 *
 * @param latex – Raw LaTeX code (without $$ delimiters)
 * @returns A Promise resolving to a PNG Blob
 */
export async function convertMathToImage(latex: string): Promise<Blob> {
    // 1. Create invisible container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.padding = '16px 24px';
    container.style.background = 'white';
    container.style.fontSize = '48px';       // Large size for crisp rendering
    container.style.lineHeight = '1.4';
    container.style.fontFamily = '"KaTeX_Main", serif';

    // 2. Render KaTeX HTML – sanitized against XSS
    const katex = (await import('katex')).default;
    const html = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
        output: 'html',
    });
    container.innerHTML = DOMPurify.sanitize(html);
    document.body.appendChild(container);

    try {
        // 3. Capture with html-to-image at a fixed pixelRatio.
        const dataUrl = await toPng(container, {
            pixelRatio: PIXEL_RATIO,
            backgroundColor: '#ffffff',
        });

        // 4. Convert data-URL to Blob — using atob() instead of fetch() to avoid
        //    CSP connect-src restrictions on data: URIs.
        const base64 = dataUrl.split(',')[1];
        if (!base64) throw new Error('toPng returned an empty data URL');
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/png' });

        // 5. Validate PNG data
        const arrayBuffer = await blob.arrayBuffer();
        const imageData = new Uint8Array(arrayBuffer);
        
        // Check PNG magic bytes
        if (imageData.length < 8 || imageData[0] !== 0x89 || imageData[1] !== 0x50 || 
            imageData[2] !== 0x4e || imageData[3] !== 0x47) {
            throw new Error('Math canvas rendering produced invalid PNG data');
        }

        return blob;
    } finally {
        // 6. Clean up DOM
        document.body.removeChild(container);
    }
}

/**
 * Helper: converts a Blob to a Uint8Array (needed by docx ImageRun).
 */
export async function blobToArrayBuffer(blob: Blob): Promise<Uint8Array> {
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}
