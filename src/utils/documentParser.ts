function getFileExtension(fileName: string): string {
    const parts = fileName.toLowerCase().split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
}

function normalizeAndValidateUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) {
        throw new Error('URL ist leer.');
    }

    const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(withProtocol);
    } catch {
        throw new Error('URL ist ungültig.');
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Nur HTTP/HTTPS-URLs werden unterstützt.');
    }

    return parsedUrl.toString();
}

function readTextWithFileReader(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
        reader.readAsText(file, 'utf-8');
    });
}

async function extractTextFromTxt(file: File): Promise<string> {
    const text = await readTextWithFileReader(file);
    return text.trim();
}

async function extractTextFromMarkdown(file: File): Promise<string> {
    const text = await readTextWithFileReader(file);
    return text.trim();
}

type PdfTextItem = { str?: string };

type PdfGetDocument = typeof import('pdfjs-dist')['getDocument'];

let pdfGetDocumentPromise: Promise<PdfGetDocument> | null = null;

async function getPdfGetDocument(): Promise<PdfGetDocument> {
    if (pdfGetDocumentPromise) return pdfGetDocumentPromise;

    pdfGetDocumentPromise = (async () => {
        const [pdfModule, workerModule] = await Promise.all([
            import('pdfjs-dist'),
            import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ]);

        pdfModule.GlobalWorkerOptions.workerSrc = workerModule.default;
        return pdfModule.getDocument;
    })();

    return pdfGetDocumentPromise;
}

async function extractTextFromPdf(file: File): Promise<string> {
    try {
        const getDocument = await getPdfGetDocument();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const pages: string[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item) => (item as PdfTextItem).str ?? '')
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (pageText) pages.push(pageText);
        }

        await pdf.destroy();
        return pages.join('\n\n').trim();
    } catch {
        throw new Error('PDF konnte nicht gelesen werden oder enthält keinen extrahierbaren Text.');
    }
}

interface MammothResult {
    value: string;
    messages?: Array<{ message?: string }>;
}

type MammothExtractRawText = (input: { arrayBuffer: ArrayBuffer }) => Promise<MammothResult>;

function resolveMammothExtractRawText(moduleRef: unknown): MammothExtractRawText | null {
    if (typeof moduleRef !== 'object' || moduleRef === null) return null;
    const maybeModule = moduleRef as {
        extractRawText?: MammothExtractRawText;
        default?: { extractRawText?: MammothExtractRawText };
    };
    return maybeModule.extractRawText ?? maybeModule.default?.extractRawText ?? null;
}

async function extractTextFromDocx(file: File): Promise<string> {
    try {
        const mammothModule = await import('mammoth');
        const extractRawText = resolveMammothExtractRawText(mammothModule);
        if (!extractRawText) {
            throw new Error('Mammoth API nicht verfügbar.');
        }

        const arrayBuffer = await file.arrayBuffer();
        const result = await extractRawText({ arrayBuffer });
        const text = result.value.trim();
        if (!text) {
            const warning = result.messages?.map((msg) => msg.message).filter(Boolean).join('; ');
            throw new Error(warning || 'Kein Text im DOCX gefunden.');
        }
        return text;
    } catch {
        throw new Error('DOCX konnte nicht gelesen werden oder enthält keinen extrahierbaren Text.');
    }
}

export async function extractTextFromUrl(url: string): Promise<string> {
    const normalizedUrl = normalizeAndValidateUrl(url);
    const endpoint = `https://r.jina.ai/${normalizedUrl}`;

    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`Jina Reader Fehler (${response.status}).`);
        }

        const extractedText = (await response.text()).trim();
        if (!extractedText) {
            throw new Error('Kein lesbarer Text von der Website gefunden.');
        }

        return extractedText;
    } catch (reason) {
        if (reason instanceof Error && reason.name === 'TypeError') {
            throw new Error('Netzwerkfehler beim Abruf über Jina Reader.');
        }

        if (reason instanceof Error) {
            throw reason;
        }

        throw new Error('Unbekannter Fehler beim Abruf über Jina Reader.');
    }
}

export async function extractTextFromFile(file: File): Promise<string> {
    const extension = getFileExtension(file.name);
    const mimeType = file.type.toLowerCase();

    if (extension === 'txt' || mimeType === 'text/plain') {
        return extractTextFromTxt(file);
    }

    if (
        extension === 'md'
        || extension === 'markdown'
        || mimeType === 'text/markdown'
        || mimeType === 'text/x-markdown'
        || mimeType === 'application/markdown'
    ) {
        return extractTextFromMarkdown(file);
    }

    if (extension === 'pdf' || mimeType === 'application/pdf') {
        return extractTextFromPdf(file);
    }

    if (
        extension === 'docx'
        || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
        return extractTextFromDocx(file);
    }

    throw new Error(`Dateityp wird noch nicht unterstützt: ${file.name}`);
}
