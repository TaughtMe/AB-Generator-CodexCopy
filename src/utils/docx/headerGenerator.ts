import {
    Paragraph,
    TextRun,
    ImageRun,
    Table,
    TableCell,
    TableRow,
    WidthType,
    VerticalAlign,
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
): Promise<(Paragraph | Table)[]> {
    const {
        schoolName,
        logoImageId,
        headerFields,
        brandColor,
        logoText,
        showHeaderTitle,
        showWorksheetTitle,
    } = useSettingsStore.getState();
    const { showHeader } = useWorksheetStore.getState();

    const worksheetTitle =
        exportTitle && exportTitle.trim() !== '' ? exportTitle : 'Neues Arbeitsblatt';

    if (!showHeader) return [];

    const blocks: (Paragraph | Table)[] = [];

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

            const logoTargetH = 15;
            const logoTargetW = logoMeta ? logoTargetH * logoMeta.ratio : 15;
            const logoCellParagraph = logoMeta
                ? new Paragraph({
                    children: [
                        new ImageRun({
                            data: logoMeta.data,
                            transformation: {
                                width: mmToPx(logoTargetW),
                                height: mmToPx(logoTargetH),
                            },
                            type: 'png',
                        }),
                    ],
                })
                : new Paragraph({ children: [] });

            const titleRuns: Paragraph[] = [];
            if (showHeaderTitle) {
                titleRuns.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: schoolName?.trim() || 'Kopfzeile AB',
                                font: config.fontFamily,
                                size: config.headingSizePt * 2,
                                bold: true,
                                color: (brandColor || '#3B82F6').replace('#', ''),
                            }),
                        ],
                        spacing: { after: showWorksheetTitle ? 40 : 0 },
                    }),
                );
            }

            if (showWorksheetTitle) {
                titleRuns.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: worksheetTitle,
                                font: config.fontFamily,
                                size: 10 * 2,
                                color: config.docxTheme.muted,
                            }),
                        ],
                    }),
                );
            }

            const headerTable = new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                width: { size: 18, type: WidthType.PERCENTAGE },
                                verticalAlign: VerticalAlign.CENTER,
                                children: [logoCellParagraph],
                                borders: {
                                    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                },
                            }),
                            new TableCell({
                                width: { size: 82, type: WidthType.PERCENTAGE },
                                verticalAlign: VerticalAlign.CENTER,
                                children: titleRuns.length > 0 ? titleRuns : [new Paragraph({ children: [] })],
                                borders: {
                                    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                },
                            }),
                        ],
                    }),
                ],
            });

            blocks.push(headerTable);
        }

        blocks.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: '',
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

        blocks.push(
            new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }),
        );

        const hasFields = headerFields.showName || headerFields.showDate || headerFields.showClass;
        if (hasFields) {
            const parts: string[] = [];
            if (headerFields.showName) parts.push(`Name: ${'_'.repeat(25)}`);
            if (headerFields.showDate) parts.push(`Datum: ${'_'.repeat(12)}`);
            if (headerFields.showClass) parts.push(`Klasse: ${'_'.repeat(12)}`);

            blocks.push(
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

    return blocks;
}
