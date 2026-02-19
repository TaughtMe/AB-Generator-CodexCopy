import {
    Paragraph,
    TextRun,
    ImageRun,
    BorderStyle,
} from 'docx';
import { mmToPx } from '../mmToEmu';
import { useSettingsStore } from '../../store/settingsStore';
import { useWorksheetStore } from '../../store/worksheetStore';
import { getImage } from '../../store/dexieStore';
import { processImageForDocx, generateSyntheticLogo, type ImageMeta } from './imagePipeline';

interface DocxTheme {
    taskTitle: string;
    text: string;
    correctAnswer: string;
    teacherBanner: string;
    placeholder: string;
    muted: string;
    fieldLabel: string;
    error: string;
}

type BorderStyleValue = 'none' | 'single';

interface HeaderGeneratorConfig {
    fontFamily: string;
    headingSizePt: number;
    a4InnerWidthDxa: number;
    noTableBorders: {
        top: { style: BorderStyleValue; size: number; color: string };
        bottom: { style: BorderStyleValue; size: number; color: string };
        left: { style: BorderStyleValue; size: number; color: string };
        right: { style: BorderStyleValue; size: number; color: string };
        insideHorizontal: { style: BorderStyleValue; size: number; color: string };
        insideVertical: { style: BorderStyleValue; size: number; color: string };
    };
    docxTheme: DocxTheme;
}

export async function createHeaderTable(
    exportTitle: string,
    config: HeaderGeneratorConfig,
): Promise<Paragraph[]> {
    const { schoolName, logoImageId, headerFields, brandColor, logoText } = useSettingsStore.getState();
    const { showHeader } = useWorksheetStore.getState();

    const worksheetTitle =
        exportTitle && exportTitle.trim() !== '' ? exportTitle : 'Neues Arbeitsblatt';

    if (!showHeader) return [];

    const paragraphs: Paragraph[] = [];

    try {
        {
            let logoMeta: ImageMeta | null = null;

            if (logoImageId) {
                try {
                    const imageRecord = await getImage(logoImageId);
                    if (imageRecord?.blob) {
                        logoMeta = await processImageForDocx(imageRecord.blob);
                    }
                } catch (logoErr) {
                    console.warn('[docxExport] Failed to load/convert logo:', logoErr);
                }
            }

            if (!logoMeta) {
                try {
                    const logoColor = brandColor || '#3B82F6';
                    const logoChars = logoText && logoText.trim()
                        ? logoText.trim().slice(0, 3)
                        : schoolName && schoolName.trim()
                            ? schoolName.charAt(0).toUpperCase()
                            : worksheetTitle.charAt(0).toUpperCase();
                    const syntheticBlob = await generateSyntheticLogo(logoChars, logoColor);
                    logoMeta = await processImageForDocx(syntheticBlob);
                } catch (synErr) {
                    console.warn('[docxExport] Synthetic logo generation failed:', synErr);
                }
            }

            if (logoMeta) {
                const logoTargetH = 15;
                const logoTargetW = logoTargetH * logoMeta.ratio;
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: logoMeta.data,
                                transformation: { width: mmToPx(logoTargetW), height: mmToPx(logoTargetH) },
                                type: 'png',
                            }),
                        ],
                        spacing: { after: 40 },
                    }),
                );
            }

            if (schoolName && schoolName.trim()) {
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: schoolName,
                                font: config.fontFamily,
                                size: config.headingSizePt * 2,
                                bold: true,
                                color: (brandColor || '#3B82F6').replace('#', ''),
                            }),
                        ],
                        spacing: { after: 20 },
                    }),
                );
            }
        }

        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: worksheetTitle,
                        font: config.fontFamily,
                        size: 9 * 2,
                        color: config.docxTheme.muted,
                    }),
                ],
                spacing: { after: 60 },
                border: {
                    bottom: {
                        style: BorderStyle.SINGLE,
                        size: 6,
                        color: (brandColor || '#3B82F6').replace('#', ''),
                        space: 4,
                    },
                },
            }),
        );

        paragraphs.push(
            new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }),
        );

        const hasFields = headerFields.showName || headerFields.showDate || headerFields.showClass;
        if (hasFields) {
            const parts: string[] = [];
            if (headerFields.showName) parts.push(`Name: ${'_'.repeat(25)}`);
            if (headerFields.showDate) parts.push(`Datum: ${'_'.repeat(12)}`);
            if (headerFields.showClass) parts.push(`Klasse: ${'_'.repeat(12)}`);

            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: parts.join('     '),
                            font: config.fontFamily,
                            size: 10 * 2,
                            color: config.docxTheme.fieldLabel,
                        }),
                    ],
                    spacing: { after: 200 },
                }),
            );
        }
    } catch (headerErr) {
        console.warn('[docxExport] Header construction failed:', headerErr);
        return [];
    }

    return paragraphs;
}
