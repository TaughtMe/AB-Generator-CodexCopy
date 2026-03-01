export interface ImageMeta {
    data: Uint8Array;
    width: number;
    height: number;
    ratio: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () =>
            reject(new Error('[imageUtils] Failed to load image from source'));
        img.crossOrigin = 'anonymous';
        img.src = src;
    });
}

export async function processImageForDocx(
    source: Blob | Uint8Array | string,
): Promise<ImageMeta> {
    let imgSrc: string;
    let revokeUrl: string | null = null;

    if (source instanceof Blob) {
        imgSrc = URL.createObjectURL(source);
        revokeUrl = imgSrc;
    } else if (source instanceof Uint8Array) {
        const copy = new Uint8Array(source.length);
        copy.set(source);
        const blob = new Blob([copy.buffer]);
        imgSrc = URL.createObjectURL(blob);
        revokeUrl = imgSrc;
    } else if (typeof source === 'string') {
        imgSrc = source;
    } else {
        throw new Error('[imageUtils] Unsupported image source type');
    }

    try {
        const img = await loadImage(imgSrc);

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('[imageUtils] Could not get 2D canvas context');
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const pngDataUrl = canvas.toDataURL('image/png');

        const rawBase64 = pngDataUrl.split(',')[1];
        if (!rawBase64) {
            throw new Error('[imageUtils] Canvas produced an empty data-URL');
        }

        const binaryString = window.atob(rawBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

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
        if (revokeUrl) {
            URL.revokeObjectURL(revokeUrl);
        }
    }
}

export async function generateSyntheticLogo(
    text: string,
    color: string,
): Promise<Blob> {
    const fill = color && color.trim() ? color : '#3B82F6';
    const displayText = text || 'A';
    const SIZE = 256;
    const RADIUS = 40;

    const canvas = new OffscreenCanvas(SIZE, SIZE);
    const ctx = canvas.getContext('2d')!;

    ctx.beginPath();
    ctx.moveTo(RADIUS, 0);
    ctx.lineTo(SIZE - RADIUS, 0);
    ctx.quadraticCurveTo(SIZE, 0, SIZE, RADIUS);
    ctx.lineTo(SIZE, SIZE - RADIUS);
    ctx.quadraticCurveTo(SIZE, SIZE, SIZE - RADIUS, SIZE);
    ctx.lineTo(RADIUS, SIZE);
    ctx.quadraticCurveTo(0, SIZE, 0, SIZE - RADIUS);
    ctx.lineTo(0, RADIUS);
    ctx.quadraticCurveTo(0, 0, RADIUS, 0);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    const fontScale = displayText.length === 1 ? 0.55 : displayText.length === 2 ? 0.42 : 0.33;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(SIZE * fontScale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, SIZE / 2, SIZE / 2 + SIZE * 0.04);

    return await canvas.convertToBlob({ type: 'image/png' });
}
