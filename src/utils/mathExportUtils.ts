/**
 * mathExportUtils.ts – Converts LaTeX formulas to high-res PNG images
 *
 * Since Word (.docx) cannot render KaTeX HTML/CSS, we render the formula
 * into a temporary DOM element, capture it with html2canvas at ~300 DPI,
 * and return the result as a Blob.
 */

import katex from 'katex';
import html2canvas from 'html2canvas';

/**
 * Fixed scale factor for high-res output (~300 DPI).
 * html2canvas applies this to the element's CSS pixel dimensions,
 * producing a zoom-independent result (does NOT use devicePixelRatio
 * when scale is explicitly provided).
 */
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
        // 3. Capture with html2canvas at a fixed scale.
        //    html2canvas uses the explicit scale directly (not multiplied
        //    by devicePixelRatio), so the output canvas dimensions are
        //    always elementCSSWidth×4 × elementCSSHeight×4 regardless
        //    of browser zoom level.
        const canvas = await html2canvas(container, {
            scale: CANVAS_SCALE,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
        });

        // 4. Convert canvas to Blob
        const blob = await new Promise<Blob>((resolve, reject) => {
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
