import React, { useRef, useState, useEffect, useCallback, type ReactElement } from 'react';
import { getPageGeometry } from '../../utils/pageGeometry';

/* ══════════════════════════════════════════════════
   MultiPageContainer – Automatische A4-Seitenverteilung
   Single-render approach: Renders children ONCE,
   then inserts visual page-break markers via state.
   ══════════════════════════════════════════════════ */

/**
 * Seitengeometrie zentral aus pageGeometry (derzeit A4 Hochformat, 20-mm-Rand).
 * Nutzbare Höhe = 297mm - 2×20mm = 257mm ≈ 971px.
 */
const PAGE_GEOMETRY = getPageGeometry();
const PAGE_CONTENT_HEIGHT_PX = PAGE_GEOMETRY.contentHeightPx;
const PAGE_BREAK_SIDE_OFFSET = `-${PAGE_GEOMETRY.marginMm}mm`;

function parsePx(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

interface MultiPageContainerProps {
    children: React.ReactNode;
    fontFamily?: string;
    brandColor?: string;
}

export const MultiPageContainer: React.FC<MultiPageContainerProps> = ({ children, fontFamily, brandColor }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [breakIndices, setBreakIndices] = useState<Set<number>>(new Set());

    const childArray = React.Children.toArray(children).filter(React.isValidElement) as ReactElement[];

    const calculateBreaks = useCallback(() => {
        if (!containerRef.current) return;

        const wrapper = containerRef.current;
        const childNodes = Array.from(wrapper.children).filter(
            (el) => !(el as HTMLElement).dataset.pageBreak
        ) as HTMLElement[];

        if (childNodes.length === 0) {
            setBreakIndices(new Set());
            return;
        }

        const newBreaks = new Set<number>();
        let currentHeight = 0;
        let previousMarginBottom = 0;

        childNodes.forEach((node, index) => {
            // Use offsetHeight (CSS layout pixels) instead of getBoundingClientRect().height
            // because getBoundingClientRect is distorted by ancestor CSS transforms (e.g. zoom slider).
            const height = node.offsetHeight;
            const computedStyle = window.getComputedStyle(node);
            const marginTop = parsePx(computedStyle.marginTop);
            const marginBottom = parsePx(computedStyle.marginBottom);
            const gapBefore = index === 0 ? marginTop : Math.max(previousMarginBottom, marginTop);
            const projectedHeight = currentHeight + gapBefore + height;

            if (projectedHeight > PAGE_CONTENT_HEIGHT_PX && currentHeight > 0) {
                newBreaks.add(index);
                currentHeight = marginTop + height;
            } else {
                currentHeight = projectedHeight;
            }

            previousMarginBottom = marginBottom;
        });

        setBreakIndices((prev) => {
            if (prev.size !== newBreaks.size) return newBreaks;
            for (const idx of newBreaks) {
                if (!prev.has(idx)) return newBreaks;
            }
            return prev;
        });
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;
        const raf = requestAnimationFrame(calculateBreaks);
        const observer = new ResizeObserver(() => {
            calculateBreaks();
        });
        observer.observe(containerRef.current);
        return () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
        };
    }, [calculateBreaks, childArray.length]);

    const renderItems: React.ReactNode[] = [];
    childArray.forEach((child, index) => {
        if (breakIndices.has(index)) {
            renderItems.push(
                <div
                    key={`break-${index}`}
                    data-page-break="true"
                    className="page-break-marker"
                    style={{
                        breakBefore: 'page',
                        position: 'relative',
                        height: '40px',
                        margin: '8px 0',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            left: PAGE_BREAK_SIDE_OFFSET,
                            right: PAGE_BREAK_SIDE_OFFSET,
                            top: '50%',
                            borderTop: '2px dashed #cbd5e1',
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            padding: '2px 12px',
                            background: '#f1f5f9',
                            borderRadius: '999px',
                            fontSize: '10px',
                            color: '#94a3b8',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Seitenumbruch
                    </div>
                </div>
            );
        }
        renderItems.push(
            <React.Fragment key={(child as ReactElement).key ?? index}>
                {child}
            </React.Fragment>
        );
    });

    const pageStyle: React.CSSProperties = {};
    if (fontFamily) pageStyle.fontFamily = fontFamily;

    return (
        <div className="a4-desk">
            <div
                className="a4-page editor-a4-page shrink-0 w-full max-w-[794px] min-w-[794px] min-h-[1123px] print:min-h-[297mm] print:h-auto bg-white text-worksheet-ink shadow-lg mx-auto p-[20mm]"
                style={pageStyle}
                data-brand-color={brandColor}
            >
                <div ref={containerRef} className="worksheet-content flow-root">
                    {renderItems}
                </div>
            </div>
        </div>
    );
};
