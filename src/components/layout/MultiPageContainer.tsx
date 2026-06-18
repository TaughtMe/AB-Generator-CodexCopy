import React, { useRef, useState, useEffect, useCallback, type ReactElement } from 'react';
import { getPageGeometry } from '../../utils/pageGeometry';

/* ══════════════════════════════════════════════════
   MultiPageContainer – Echte A4-Seitenboxen (Word-Stil).

   Statt einer einzigen wachsenden Seite mit gestrichelten Umbruch-Markern
   werden die Inhalte auf mehrere, optisch getrennte A4-Boxen verteilt:
     Seite 1 (feste Box) · Abstand · Seite 2 (feste Box) · …

   Vorgehen (Single-render, kein doppeltes Rendern editierbarer Inhalte):
   1. Jedes Kind in einen schlanken Mess-Wrapper packen (Margins kollabieren
      durch den leeren Wrapper hindurch → Abstände bleiben identisch).
   2. Höhen messen und greedy auf Seiten gruppieren (nutzbare Höhe aus
      pageGeometry). Aufgaben bleiben atomar: passt eine Aufgabe nicht mehr
      auf die Restseite, beginnt sie auf der nächsten Seite.
   3. Explizite page-break-Tasks (.page-break-task) erzwingen eine neue Seite.

   A4 Hochformat only (Format/A5/Quer/Spalten kommen später). Ein einzelner
   Block, der höher als eine ganze Seite ist, darf vorerst überlaufen
   (Warnung folgt im nächsten Schritt).
   ══════════════════════════════════════════════════ */

const PAGE_GEOMETRY = getPageGeometry();
const PAGE_CONTENT_HEIGHT_PX = PAGE_GEOMETRY.contentHeightPx;

const PAGE_BOX_CLASS =
    'a4-page editor-a4-page shrink-0 w-full max-w-[794px] min-w-[794px] min-h-[1123px] '
    + 'print:min-h-[297mm] print:h-auto bg-white text-worksheet-ink shadow-lg mx-auto p-[20mm]';

function parsePx(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function pagesEqual(a: number[][], b: number[][]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].length !== b[i].length) return false;
        for (let j = 0; j < a[i].length; j++) {
            if (a[i][j] !== b[i][j]) return false;
        }
    }
    return true;
}

interface MultiPageContainerProps {
    children: React.ReactNode;
    fontFamily?: string;
    brandColor?: string;
}

export const MultiPageContainer: React.FC<MultiPageContainerProps> = ({ children, fontFamily, brandColor }) => {
    const childArray = React.Children.toArray(children).filter(React.isValidElement) as ReactElement[];
    const childCount = childArray.length;

    const itemRefs = useRef<Map<number, HTMLElement | null>>(new Map());
    // Initial: alle Kinder auf einer Seite – nach dem ersten Messen wird umgruppiert.
    const [pages, setPages] = useState<number[][]>(() => [childArray.map((_, i) => i)]);

    const recalc = useCallback(() => {
        if (childCount === 0) {
            setPages((prev) => (prev.length === 1 && prev[0].length === 0 ? prev : [[]]));
            return;
        }

        const newPages: number[][] = [];
        let current: number[] = [];
        let currentHeight = 0;
        let previousMarginBottom = 0;

        for (let index = 0; index < childCount; index++) {
            const el = itemRefs.current.get(index);
            if (!el) {
                // Noch nicht gemessen → vorsichtshalber auf die aktuelle Seite.
                current.push(index);
                continue;
            }

            const height = el.offsetHeight;
            const cs = window.getComputedStyle(el);
            const marginTop = parsePx(cs.marginTop);
            const marginBottom = parsePx(cs.marginBottom);
            const isPageBreak = !!el.querySelector('.page-break-task');

            const gapBefore = current.length === 0 ? 0 : Math.max(previousMarginBottom, marginTop);
            const projected = currentHeight + gapBefore + height;

            if (current.length > 0 && projected > PAGE_CONTENT_HEIGHT_PX) {
                // Passt nicht mehr → neue Seite, Aufgabe bleibt atomar.
                newPages.push(current);
                current = [index];
                currentHeight = height;
            } else {
                current.push(index);
                currentHeight = projected;
            }
            previousMarginBottom = marginBottom;

            if (isPageBreak) {
                // Expliziter Seitenumbruch: nächstes Kind beginnt eine neue Seite.
                newPages.push(current);
                current = [];
                currentHeight = 0;
                previousMarginBottom = 0;
            }
        }
        if (current.length > 0 || newPages.length === 0) {
            newPages.push(current);
        }

        setPages((prev) => (pagesEqual(prev, newPages) ? prev : newPages));
    }, [childCount]);

    useEffect(() => {
        const raf = requestAnimationFrame(recalc);
        const observer = new ResizeObserver(() => recalc());
        itemRefs.current.forEach((el) => {
            if (el) observer.observe(el);
        });
        window.addEventListener('resize', recalc);
        return () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
            window.removeEventListener('resize', recalc);
        };
        // childCount triggert Neu-Beobachtung bei Hinzufügen/Entfernen von Aufgaben;
        // pages, damit nach dem Umgruppieren die neuen Box-Kinder beobachtet werden.
    }, [recalc, childCount, pages]);

    const pageStyle: React.CSSProperties = {};
    if (fontFamily) pageStyle.fontFamily = fontFamily;

    return (
        <div className="a4-desk-multi">
            {pages.map((indices, pageIndex) => (
                <div
                    key={pageIndex}
                    className={PAGE_BOX_CLASS}
                    style={pageStyle}
                    data-brand-color={brandColor}
                    data-page-index={pageIndex}
                >
                    <div className="worksheet-content flow-root">
                        {indices.map((i) => {
                            const child = childArray[i];
                            if (!child) return null;
                            return (
                                <div
                                    key={child.key ?? i}
                                    ref={(el) => { itemRefs.current.set(i, el); }}
                                >
                                    {child}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};
