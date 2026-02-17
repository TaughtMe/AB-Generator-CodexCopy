import React, { useRef, useState, useEffect, useCallback, type ReactElement } from 'react';

/* ══════════════════════════════════════════════════
   MultiPageContainer – Automatische A4-Seitenverteilung
   Single-render approach: Renders children ONCE,
   then inserts visual page-break markers via state.
   ══════════════════════════════════════════════════ */

/**
 * Nutzbare Höhe einer A4-Seite in px (bei 96 DPI).
 * 297mm - 2×20mm padding = 257mm ≈ 971px
 */
const MM_TO_PX = 96 / 25.4; // ~3.7795
const PAGE_CONTENT_HEIGHT_MM = 257;
const PAGE_CONTENT_HEIGHT_PX = PAGE_CONTENT_HEIGHT_MM * MM_TO_PX;
const GAP_PX = 12; // space-y-3 = 12px

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

        childNodes.forEach((node, index) => {
            // Use offsetHeight (CSS layout pixels) instead of getBoundingClientRect().height
            // because getBoundingClientRect is distorted by ancestor CSS transforms (e.g. zoom slider).
            const height = node.offsetHeight;
            const gap = index > 0 ? GAP_PX : 0;

            if (currentHeight + height + gap > PAGE_CONTENT_HEIGHT_PX && currentHeight > 0) {
                newBreaks.add(index);
                currentHeight = height;
            } else {
                currentHeight += height + gap;
            }
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
                            left: '-20mm',
                            right: '-20mm',
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
            <div className="a4-page" style={pageStyle} data-brand-color={brandColor}>
                <div ref={containerRef} className="space-y-3">
                    {renderItems}
                </div>
            </div>
        </div>
    );
};
