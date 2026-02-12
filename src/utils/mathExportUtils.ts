/**
 * mathExportUtils.ts – Converts LaTeX formulas to high-res PNG images
 *
 * Since Word (.docx) cannot render KaTeX HTML/CSS, we render the formula
 * into a temporary DOM element, capture it with html2canvas at ~300 DPI,
 * and return the result as a Blob.
 */

import katex from 'katex';
import html2canvas from 'html2canvas';

/** Scale factor for high-res output (~300 DPI at typical screen density) */
const CANVAS_SCALE = 4;

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

    // 2. Render KaTeX HTML into it
    const html = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
        output: 'html',
    });
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
        // 3. Capture with html2canvas at high scale
        const canvas = await html2canvas(container, {
            scale: CANVAS_SCALE,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
        });

        // 4. Convert canvas to Blob
        return new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to convert math canvas to Blob'));
                    }
                },
                'image/png',
                1.0,
            );
        });
    } finally {
        // 5. Clean up DOM
        document.body.removeChild(container);
    }
}

/**
 * Helper: converts a Blob to an ArrayBuffer (needed by docx ImageRun).
 */
export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return blob.arrayBuffer();
}
