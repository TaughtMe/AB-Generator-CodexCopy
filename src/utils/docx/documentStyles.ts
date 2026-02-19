import { Document, type Paragraph, type Table, convertMillimetersToTwip } from 'docx';

export function createStyledDocument(
    fontFamily: string,
    fontSizePt: number,
    children: (Paragraph | Table)[],
): Document {
    return new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: fontFamily,
                        size: fontSizePt * 2,
                    },
                },
            },
        },
        sections: [{
            properties: {
                page: {
                    size: {
                        width: convertMillimetersToTwip(210),
                        height: convertMillimetersToTwip(297),
                    },
                    margin: {
                        top: convertMillimetersToTwip(20),
                        right: convertMillimetersToTwip(20),
                        bottom: convertMillimetersToTwip(20),
                        left: convertMillimetersToTwip(20),
                    },
                },
            },
            children,
        }],
    });
}
