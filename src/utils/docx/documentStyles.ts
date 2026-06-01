import {
    Document,
    LineRuleType,
    type Paragraph,
    type Table,
    convertMillimetersToTwip,
} from 'docx';

// lineRule AUTO: 240 = single line, 348 ≈ 1.45 → matches the editor's line-height: 1.45
const DEFAULT_LINE_SPACING_TWIP = 348;
const DEFAULT_PARAGRAPH_AFTER_TWIP = 40;

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
