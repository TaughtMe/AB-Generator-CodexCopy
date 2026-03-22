import React, { useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { useWorksheetStore } from '../../store/worksheetStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { getImageUrl } from '../../store/dexieStore';
import { useImageUpload } from '../../hooks/useImageUpload';

/* ══════════════════════════════════════════════════
   WorksheetHeader – Rendered at the top of the A4 page
   Reads from settingsStore (logo, school name, fields,
   brand color, font). Respects showHeader toggle from
   worksheetStore. Visible in editor and print.
   ══════════════════════════════════════════════════ */

export const WorksheetHeader: React.FC = () => {
    const {
        schoolName,
        logoImageId,
        headerFields,
        brandColor,
        logoText,
        showHeaderTitle,
        showWorksheetTitle,
    } = useSettingsStore();
    const showHeader = useWorksheetStore((s) => s.showHeader);
    const liveTitle = useWorksheetStore((s) => s.title);
    const setTitle = useWorksheetStore((s) => s.setTitle);
    const currentWorksheetId = useWorkspaceStore((s) => s.currentWorksheetId);
    const recentWorksheets = useWorkspaceStore((s) => s.recentWorksheets);
    const { previewUrl: logoUrl, setPreviewUrl, clearImage } = useImageUpload();

    const persistedTitle = currentWorksheetId
        ? recentWorksheets.find((sheet) => sheet.id === currentWorksheetId)?.title
        : null;
    const title = liveTitle ?? persistedTitle ?? 'Neues Arbeitsblatt';
    const printableTitle = title.trim() ? title : 'Neues Arbeitsblatt';

    useEffect(() => {
        if (logoImageId) {
            getImageUrl(logoImageId).then(setPreviewUrl).catch(() => setPreviewUrl(null));
        } else {
            clearImage();
        }
    }, [logoImageId, setPreviewUrl, clearImage]);

    // If showHeader is off, just render the simple title
    if (!showHeader) {
        return (
            <div className="mb-6 worksheet-header" style={{ fontFamily: 'inherit' }}>
                <h2
                    className="text-base font-bold text-slate-800 pb-3 mb-4"
                    style={{ borderBottom: '2px solid #e2e8f0' }}
                >
                    <input
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Titel des Arbeitsblattes"
                        aria-label="Titel des Arbeitsblattes"
                        className="no-print w-full bg-transparent border-0 p-0 text-base font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none"
                    />
                    <span className="hidden print:block">{printableTitle}</span>
                </h2>
            </div>
        );
    }

    // showHeader is ON → full design header
    const hasLogo = Boolean(logoImageId || logoText);
    const hasTitleBlock = showHeaderTitle || showWorksheetTitle;
    const hasFields = headerFields.showName || headerFields.showDate || headerFields.showClass;

    // Resolve the text displayed inside the fallback logo box
    const logoDisplay = logoText || (schoolName ? schoolName.charAt(0).toUpperCase() : 'S');

    return (
        <div className="mb-6 worksheet-header" style={{ fontFamily: 'inherit' }}>
            {/* ── Logo + Title Block ── */}
            {(hasLogo || hasTitleBlock) && (
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
                    ) : hasLogo ? (
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                            style={{ backgroundColor: brandColor }}
                        >
                            {logoDisplay}
                        </div>
                    ) : null}

                    {hasTitleBlock && (
                        <div className="flex flex-col justify-center min-h-10 flex-1">
                            {showHeaderTitle && (
                                <h2 className="text-base font-bold leading-tight" style={{ color: brandColor }}>
                                    {schoolName || 'Kopfzeile AB'}
                                </h2>
                            )}
                            {showWorksheetTitle && (
                                <p className="text-sm text-slate-600 leading-tight mt-0.5">
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(event) => setTitle(event.target.value)}
                                        placeholder="Titel des Arbeitsblattes"
                                        aria-label="Titel des Arbeitsblattes"
                                        className="no-print w-full bg-transparent border-0 p-0 text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none"
                                    />
                                    <span className="hidden print:block">{printableTitle}</span>
                                </p>
                            )}
                        </div>
                    )}
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
