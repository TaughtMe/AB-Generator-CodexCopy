import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { useWorksheetStore } from '../../store/worksheetStore';
import { getImageUrl } from '../../store/dexieStore';

/* ══════════════════════════════════════════════════
   WorksheetHeader – Rendered at the top of the A4 page
   Reads from settingsStore (logo, school name, fields,
   brand color, font). Respects showHeader toggle from
   worksheetStore. Visible in editor and print.
   ══════════════════════════════════════════════════ */

export const WorksheetHeader: React.FC = () => {
    const { schoolName, logoImageId, headerFields, brandColor, logoText } = useSettingsStore();
    const showHeader = useWorksheetStore((s) => s.showHeader);
    const title = useWorksheetStore((s) => s.title);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    useEffect(() => {
        if (logoImageId) {
            getImageUrl(logoImageId).then(setLogoUrl).catch(() => setLogoUrl(null));
        } else {
            setLogoUrl(null);
        }
    }, [logoImageId]);

    // If showHeader is off, just render the simple title
    if (!showHeader) {
        return (
            <div className="mb-6 worksheet-header" style={{ fontFamily: 'inherit' }}>
                <h2
                    className="text-base font-bold text-slate-800 pb-3 mb-4"
                    style={{ borderBottom: '2px solid #e2e8f0' }}
                >
                    {title || 'Neues Arbeitsblatt'}
                </h2>
            </div>
        );
    }

    // showHeader is ON → full design header
    const hasLogo = logoImageId || logoText;
    const hasHeader = schoolName || hasLogo;
    const hasFields = headerFields.showName || headerFields.showDate || headerFields.showClass;

    // Resolve the text displayed inside the fallback logo box
    const logoDisplay = logoText || (schoolName ? schoolName.charAt(0).toUpperCase() : 'S');

    return (
        <div className="mb-6 worksheet-header" style={{ fontFamily: 'inherit' }}>
            {/* ── Logo + School Name ── */}
            {hasHeader && (
                <div
                    className="flex items-center gap-3 mb-4 pb-3"
                    style={{ borderBottom: `2px solid ${brandColor}` }}
                >
                    {logoUrl ? (
                        <img
                            src={logoUrl}
                            alt="Logo"
                            className="h-12 w-auto object-contain"
                        />
                    ) : schoolName || logoText ? (
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                            style={{ backgroundColor: brandColor }}
                        >
                            {logoDisplay}
                        </div>
                    ) : null}
                    <div className="flex-1">
                        <h2
                            className="text-base font-bold"
                            style={{ color: brandColor }}
                        >
                            {schoolName}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {title || 'Arbeitsblatt'}
                        </p>
                    </div>
                </div>
            )}

            {/* If no school header but showHeader is on, show title with brand color */}
            {!hasHeader && (
                <div className="mb-4 pb-3" style={{ borderBottom: `2px solid ${brandColor}` }}>
                    <h2
                        className="text-base font-bold"
                        style={{ color: brandColor }}
                    >
                        {title || 'Arbeitsblatt'}
                    </h2>
                </div>
            )}

            {/* ── Name / Date / Class Fields ── */}
            {hasFields && (
                <div className="flex gap-4 mb-4">
                    {headerFields.showName && (
                        <div className="flex-1">
                            <span className="text-[11px] text-slate-500 block mb-0.5">Name:</span>
                            <div className="border-b-2 border-slate-300 h-5" />
                        </div>
                    )}
                    {headerFields.showDate && (
                        <div className="w-28">
                            <span className="text-[11px] text-slate-500 block mb-0.5">Datum:</span>
                            <div className="border-b-2 border-slate-300 h-5" />
                        </div>
                    )}
                    {headerFields.showClass && (
                        <div className="w-24">
                            <span className="text-[11px] text-slate-500 block mb-0.5">Klasse:</span>
                            <div className="border-b-2 border-slate-300 h-5" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
