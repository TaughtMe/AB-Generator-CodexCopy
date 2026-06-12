import { AlignmentType, ImageRun, Paragraph, TextRun } from 'docx';
import type { ImageAlignment, ImagePlaceholderTask } from '../../../types/worksheet';
import { getImage } from '../../../store/dexieStore';
import { mmToPx } from '../../mmToEmu';
import { processImageForDocx } from '../imagePipeline';
import type { DocxAlignment, TaskRendererConfig } from './shared';

function imageAlignmentToDocx(value: ImageAlignment | undefined): DocxAlignment {
    switch (value) {
        case 'center':
            return AlignmentType.CENTER;
        case 'right':
            return AlignmentType.RIGHT;
        case 'left':
        default:
            return AlignmentType.LEFT;
    }
}

export async function renderImagePlaceholder(task: ImagePlaceholderTask, config: TaskRendererConfig): Promise<Paragraph[]> {
    const paragraphs: Paragraph[] = [];
    const imageAlignment = imageAlignmentToDocx(task.imageAlign);

    if (task.caption && task.caption.trim()) {
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: task.caption,
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        italics: true,
                        color: config.docxTheme.fieldLabel,
                    }),
                ],
                alignment: imageAlignment,
                spacing: { after: 80 },
            }),
        );
    }

    if (task.imageId) {
        try {
            const imageRecord = await getImage(task.imageId);
            if (imageRecord?.blob) {
                const imageMeta = await processImageForDocx(imageRecord.blob);

                const boxW = task.widthMm;
                const boxH = task.heightMm;
                const ratio = imageMeta.ratio || 1;

                let fitW: number;
                let fitH: number;

                if (boxW / boxH > ratio) {
                    fitH = boxH;
                    fitW = boxH * ratio;
                } else {
                    fitW = boxW;
                    fitH = boxW / ratio;
                }

                const widthPx = mmToPx(fitW);
                const heightPx = mmToPx(fitH);

                paragraphs.push(
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: imageMeta.data,
                                transformation: {
                                    width: widthPx,
                                    height: heightPx,
                                },
                                type: 'png',
                            }),
                        ],
                        alignment: imageAlignment,
                        spacing: { after: config.taskGapAfter },
                    }),
                );
            } else {
                console.warn('[docxExport] Image not found for task:', task.id);
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '(Bild nicht gefunden)',
                                font: config.fontFamily,
                                size: config.fontSizePt * 2,
                                color: config.docxTheme.error,
                                italics: true,
                            }),
                        ],
                        alignment: imageAlignment,
                    }),
                );
            }
        } catch (error) {
            console.error('[docxExport] Failed to load image:', error);
            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: '(Fehler beim Laden des Bildes)',
                            font: config.fontFamily,
                            size: config.fontSizePt * 2,
                            color: config.docxTheme.error,
                            italics: true,
                        }),
                    ],
                    alignment: imageAlignment,
                }),
            );
        }
    } else {
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `[Bildplatzhalter: ${task.widthMm}mm × ${task.heightMm}mm]`,
                        font: config.fontFamily,
                        size: config.fontSizePt * 2,
                        color: config.docxTheme.muted,
                        italics: true,
                    }),
                ],
                alignment: imageAlignment,
                spacing: { after: config.taskGapAfter },
            }),
        );
    }

    return paragraphs;
}
