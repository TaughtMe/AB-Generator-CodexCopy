import {
    Document,
    LineRuleType,
    type Paragraph,
    type Table,
    convertMillimetersToTwip,
} from 'docx';

const DEFAULT_LINE_SPACING_TWIP = 360; // 1.5 Zeilen (240 * 1.5)
const DEFAULT_PARAGRAPH_AFTER_TWIP = 120; // 6pt Absatzabstand

export function createStyledDocument(
    fontFamily: string,
    fontSizePt: number,
    children: (Paragraph | Table)[],
): Document {
    return new Document({
        styles: {
            default: {
                document: {
                    paragraph: {
                        spacing: {
                            line: DEFAULT_LINE_SPACING_TWIP,
                            lineRule: LineRuleType.AUTO,
                            after: DEFAULT_PARAGRAPH_AFTER_TWIP,
                        },
                    },
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
