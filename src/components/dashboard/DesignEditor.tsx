import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Trash2, Type, Palette, Eye } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { addImage, getImageUrl } from '../../store/dexieStore';

/* ══════════════════════════════════════════════════
   DesignEditor – Arbeitsblatt-Design konfigurieren
   Split-Panel: Linke Seite Steuerung, rechte Seite
   Live-Mock-A4-Vorschau mit allen Einstellungen.
   ══════════════════════════════════════════════════ */

interface DesignEditorProps {
    isOpen: boolean;
    onClose: () => void;
}

const FONT_OPTIONS = [
    { value: 'Inter, sans-serif', label: 'Inter' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: '"Comic Sans MS", cursive', label: 'Comic Sans' },
    { value: '"Courier New", monospace', label: 'Courier New' },
    { value: 'system-ui, sans-serif', label: 'System UI' },
];

const COLOR_PRESETS = [
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#14b8a6', '#06b6d4', '#1e293b', '#64748b',
];

export const DesignEditor: React.FC<DesignEditorProps> = ({ isOpen, onClose }) => {
    const {
        schoolName, setSchoolName,
        logoImageId, setLogoImageId,
        logoText, setLogoText,
        headerFields, setHeaderFields,
        brandColor, setBrandColor,
        fontFamily, setFontFamily,
    } = useSettingsStore();

    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load logo preview
    useEffect(() => {
        if (logoImageId) {
            getImageUrl(logoImageId).then(setLogoPreview).catch(() => setLogoPreview(null));
        } else {
            setLogoPreview(null);
        }
    }, [logoImageId]);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        try {
            const id = await addImage(file.name, file);
            setLogoImageId(id as number);
        } catch (err) {
            console.error('Logo upload failed:', err);
        }
    };

    const removeLogo = () => {
        setLogoImageId(null);
        setLogoPreview(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal – wide split-panel */}
            <div className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* Gradient bar */}
                <div className="h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 shrink-0" />

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-lg">
                            <Palette size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                Design-Editor
                            </h2>
                            <p className="text-[10px] text-slate-400">
                                Arbeitsblatt-Vorlage konfigurieren – Änderungen live sichtbar
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                {/* Split Panel */}
                <div className="flex flex-1 overflow-hidden">

                    {/* ─── Left: Controls ─── */}
                    <div className="w-80 shrink-0 border-r border-slate-100 dark:border-slate-800 overflow-y-auto custom-scrollbar p-5 space-y-5">

                        {/* Logo */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                <ImageIcon size={12} />
                                Schul-Logo
                            </label>

                            {/* Uploaded image preview */}
                            {logoPreview ? (
                                <div className="relative inline-block mb-2">
                                    <img
                                        src={logoPreview}
                                        alt="Logo"
                                        className="h-14 w-auto rounded-lg border border-slate-200 dark:border-slate-700 object-contain bg-white p-1"
                                    />
                                    <button
                                        onClick={removeLogo}
                                        className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full cursor-pointer shadow-sm"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Text logo input (up to 3 chars) */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <div
                                            className="w-14 h-14 rounded-lg flex items-center justify-center text-white font-bold shrink-0 text-lg"
                                            style={{ backgroundColor: brandColor }}
                                        >
                                            {logoText || (schoolName ? schoolName.charAt(0).toUpperCase() : 'S')}
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] text-slate-400 mb-0.5">
                                                Kürzel (max. 3 Zeichen)
                                            </label>
                                            <input
                                                type="text"
                                                value={logoText}
                                                maxLength={3}
                                                onChange={(e) => setLogoText(e.target.value.slice(0, 3))}
                                                placeholder="z.B. GS"
                                                className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 font-mono tracking-wider"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mb-2">
                                        Gib bis zu 3 Buchstaben / Zahlen ein, oder lade ein Bild hoch:
                                    </p>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-all cursor-pointer text-xs text-slate-500"
                                    >
                                        <Upload size={14} />
                                        Bild hochladen
                                    </button>
                                </>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="hidden"
                            />
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-800" />

                        {/* School Name */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                                Schulname
                            </label>
                            <input
                                type="text"
                                value={schoolName}
                                onChange={(e) => setSchoolName(e.target.value)}
                                placeholder="z.B. Grundschule am Park"
                                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                            />
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-800" />

                        {/* Header Fields */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                <Eye size={12} />
                                Kopfzeilen-Felder
                            </label>
                            <div className="space-y-2">
                                {([
                                    { key: 'showName' as const, label: 'Name-Feld' },
                                    { key: 'showDate' as const, label: 'Datum-Feld' },
                                    { key: 'showClass' as const, label: 'Klassen-Feld' },
                                ]).map(({ key, label }) => (
                                    <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={headerFields[key]}
                                                onChange={(e) => setHeaderFields({ [key]: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-8 h-4.5 bg-slate-200 dark:bg-slate-700 rounded-full peer-checked:bg-violet-500 transition-colors" />
                                            <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-3.5" />
                                        </div>
                                        <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
                                            {label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-800" />

                        {/* Font Family */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                                <Type size={12} />
                                Schriftart
                            </label>
                            <div className="space-y-1">
                                {FONT_OPTIONS.map(({ value, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => setFontFamily(value)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all cursor-pointer border ${fontFamily === value
                                                ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 font-medium'
                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                            }`}
                                        style={{ fontFamily: value }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-800" />

                        {/* Brand Color */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                <Palette size={12} />
                                Akzent-Farbe
                            </label>
                            <div className="grid grid-cols-6 gap-1.5">
                                {COLOR_PRESETS.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => setBrandColor(color)}
                                        className={`w-8 h-8 rounded-lg cursor-pointer transition-all ${brandColor === color
                                                ? 'ring-2 ring-offset-2 ring-violet-500 scale-110'
                                                : 'hover:scale-105'
                                            }`}
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                ))}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                <input
                                    type="color"
                                    value={brandColor}
                                    onChange={(e) => setBrandColor(e.target.value)}
                                    className="w-8 h-8 border-0 cursor-pointer rounded"
                                />
                                <span className="text-[10px] text-slate-400 font-mono">{brandColor}</span>
                            </div>
                        </div>
                    </div>

                    {/* ─── Right: Mock A4 Preview ─── */}
                    <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950 p-6 flex justify-center">
                        <div
                            className="bg-white shadow-xl rounded-sm"
                            style={{
                                width: '210mm',
                                maxWidth: '100%',
                                minHeight: '297mm',
                                padding: '20mm',
                                boxSizing: 'border-box',
                                fontFamily: fontFamily,
                                transform: 'scale(0.6)',
                                transformOrigin: 'top center',
                            }}
                        >
                            {/* ── Mock Header ── */}
                            <div className="flex items-center gap-4 mb-6 pb-4" style={{ borderBottom: `2px solid ${brandColor}` }}>
                                {/* Logo */}
                                {logoPreview ? (
                                    <img
                                        src={logoPreview}
                                        alt="Logo"
                                        className="h-14 w-auto object-contain"
                                    />
                                ) : (
                                    <div
                                        className="w-14 h-14 rounded-lg flex items-center justify-center text-white text-lg font-bold shrink-0"
                                        style={{ backgroundColor: brandColor }}
                                    >
                                        {logoText || (schoolName ? schoolName.charAt(0).toUpperCase() : 'S')}
                                    </div>
                                )}
                                <div className="flex-1">
                                    <h1 className="text-lg font-bold text-slate-800" style={{ color: brandColor }}>
                                        {schoolName || 'Schulname'}
                                    </h1>
                                    <p className="text-xs text-slate-400 mt-0.5">Arbeitsblatt</p>
                                </div>
                            </div>

                            {/* ── Header Fields ── */}
                            {(headerFields.showName || headerFields.showDate || headerFields.showClass) && (
                                <div className="flex gap-6 mb-8">
                                    {headerFields.showName && (
                                        <div className="flex-1">
                                            <span className="text-xs text-slate-500 block mb-1">Name:</span>
                                            <div className="border-b-2 border-slate-300 h-6" />
                                        </div>
                                    )}
                                    {headerFields.showDate && (
                                        <div className="w-32">
                                            <span className="text-xs text-slate-500 block mb-1">Datum:</span>
                                            <div className="border-b-2 border-slate-300 h-6" />
                                        </div>
                                    )}
                                    {headerFields.showClass && (
                                        <div className="w-28">
                                            <span className="text-xs text-slate-500 block mb-1">Klasse:</span>
                                            <div className="border-b-2 border-slate-300 h-6" />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Mock Title ── */}
                            <h2 className="text-base font-bold text-slate-800 mb-6" style={{ color: brandColor }}>
                                Beispiel-Arbeitsblatt
                            </h2>

                            {/* ── Mock Task 1: Multiple Choice ── */}
                            <div className="mb-6">
                                <p className="text-sm font-semibold text-slate-700 mb-3">
                                    <span style={{ color: brandColor }}>1.</span> Kreuze die richtige Antwort an:
                                </p>
                                <div className="space-y-2 ml-4">
                                    {['Antwort A', 'Antwort B', 'Antwort C', 'Antwort D'].map((opt, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-slate-400 rounded-sm shrink-0" />
                                            <span className="text-sm text-slate-600">{opt}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Mock Task 2: Lineatur ── */}
                            <div className="mb-6">
                                <p className="text-sm font-semibold text-slate-700 mb-3">
                                    <span style={{ color: brandColor }}>2.</span> Schreibe den folgenden Satz in Schreibschrift:
                                </p>
                                <div className="space-y-0">
                                    {[1, 2, 3, 4].map((line) => (
                                        <div
                                            key={line}
                                            className="h-8 border-b border-slate-300"
                                            style={{ borderBottomColor: line === 4 ? brandColor + '40' : undefined }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* ── Mock Task 3: Cloze ── */}
                            <div className="mb-6">
                                <p className="text-sm font-semibold text-slate-700 mb-3">
                                    <span style={{ color: brandColor }}>3.</span> Ergänze die Lücken:
                                </p>
                                <p className="text-sm text-slate-600 leading-relaxed ml-4">
                                    Die Sonne scheint am <span className="inline-block w-20 border-b-2 border-dashed mx-1" style={{ borderColor: brandColor }} /> .
                                    Die Vögel <span className="inline-block w-24 border-b-2 border-dashed mx-1" style={{ borderColor: brandColor }} /> im Baum.
                                    Der Wind weht <span className="inline-block w-16 border-b-2 border-dashed mx-1" style={{ borderColor: brandColor }} /> .
                                </p>
                            </div>

                            {/* ── Mock Footer ── */}
                            <div className="mt-auto pt-8 border-t border-slate-200 flex items-center justify-between">
                                <span className="text-[10px] text-slate-300">
                                    © {schoolName || 'Schule'} — Erstellt mit AB-Generator
                                </span>
                                <span className="text-[10px] text-slate-300">Seite 1</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
                    <p className="text-[10px] text-slate-400">
                        Alle Änderungen werden automatisch als Vorlage gespeichert.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-all cursor-pointer shadow-sm hover:shadow"
                    >
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    );
};
