import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, Image as ImageIcon, Trash2, Type, Palette, Eye, Save, FolderOpen, Search } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { addImage, getImageUrl } from '../../store/dexieStore';
import { useImageUpload } from '../../hooks/useImageUpload';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { validateTemplateName } from '../../types/designTemplate';
import { CURATED_FONTS, loadGoogleFont, preloadCuratedFonts } from '../../utils/googleFonts';
import { IconButton } from '../ui/IconButton';
import { ICON_SIZES } from '../ui/iconSizes';
import { Modal } from '../ui/Modal';

/* ══════════════════════════════════════════════════
   DesignEditor – Arbeitsblatt-Design konfigurieren
   Split-Panel: Linke Seite Steuerung, rechte Seite
   Live-Mock-A4-Vorschau mit allen Einstellungen.
   ══════════════════════════════════════════════════ */

interface DesignEditorProps {
    isOpen: boolean;
    onClose: () => void;
}

/** Font-Kategorie-Labels für die gruppierte Anzeige */
const CATEGORY_LABELS: Record<string, string> = {
    'sans-serif': 'Sans-Serif',
    serif: 'Serif',
    handwriting: 'Handschrift',
    monospace: 'Monospace',
    system: 'System',
};

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
        showHeaderTitle, setShowHeaderTitle,
        showWorksheetTitle, setShowWorksheetTitle,
        applyColorToTasks, setApplyColorToTasks,
    } = useSettingsStore();

    const {
        designTemplates,
        selectedTemplateId,
        editingTemplateId,
        isTemplateLoading,
        loadDesignTemplates,
        saveCurrentDesignAsTemplate,
        applyTemplateToCurrentWorksheet,
        removeDesignTemplate,
        clearTemplateEdit,
    } = useWorkspaceStore();

    const [activeTemplateId, setActiveTemplateId] = useState<string>('');
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templateNameError, setTemplateNameError] = useState<string | null>(null);
    const [isNameConflict, setIsNameConflict] = useState(false);
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [fontSearch, setFontSearch] = useState('');

    // Preload Google Fonts beim ersten Öffnen des Editors
    useEffect(() => {
        if (isOpen) preloadCuratedFonts();
    }, [isOpen]);

    // Aktive Schriftart sicherstellen
    useEffect(() => {
        if (fontFamily) loadGoogleFont(fontFamily);
    }, [fontFamily]);

    const editingTemplate = editingTemplateId
        ? designTemplates.find((item) => item.id === editingTemplateId)
        : null;

    const {
        previewUrl: logoPreview,
        handleImageUpload,
        setPreviewUrl,
        clearImage,
    } = useImageUpload({
        onUpload: async (file) => {
            const id = await addImage(file.name, file);
            setLogoImageId(id as number);
        },
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load logo preview
    useEffect(() => {
        if (logoImageId) {
            getImageUrl(logoImageId).then(setPreviewUrl).catch(() => setPreviewUrl(null));
        } else {
            clearImage();
        }
    }, [logoImageId, setPreviewUrl, clearImage]);

    useEffect(() => {
        if (!isOpen) return;
        void loadDesignTemplates();
    }, [isOpen, loadDesignTemplates]);

    useEffect(() => {
        if (selectedTemplateId) {
            setActiveTemplateId(selectedTemplateId);
        }
    }, [selectedTemplateId]);

    const removeLogo = () => {
        setLogoImageId(null);
        clearImage();
    };

    const mockTaskAccentColor = applyColorToTasks ? brandColor : '#334155';

    const openSaveDialog = () => {
        setStatusMessage(null);
        const fallbackName = schoolName.trim() || 'Neue Vorlage';
        setTemplateName(editingTemplate?.name ?? fallbackName);
        setTemplateNameError(null);
        setIsNameConflict(false);
        setIsSaveDialogOpen(true);
    };

    const handleSaveTemplate = async (overwrite = false) => {
        const validationError = validateTemplateName(templateName);
        if (validationError) {
            setTemplateNameError(validationError);
            return;
        }

        setIsSavingTemplate(true);
        setTemplateNameError(null);

        try {
            await saveCurrentDesignAsTemplate(templateName, overwrite, editingTemplateId ?? undefined);
            setStatusMessage({
                type: 'success',
                text: editingTemplateId ? 'Vorlage aktualisiert.' : 'Vorlage gespeichert.',
            });
            setIsSaveDialogOpen(false);
            setIsNameConflict(false);
            if (editingTemplateId) {
                clearTemplateEdit();
            }
        } catch (error) {
            const code = error instanceof Error ? error.message : '';
            if (code === 'TEMPLATE_NAME_EXISTS') {
                setTemplateNameError('Eine Vorlage mit diesem Namen existiert bereits.');
                setIsNameConflict(true);
            } else {
                setTemplateNameError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
                setStatusMessage({
                    type: 'error',
                    text: editingTemplateId ? 'Vorlage konnte nicht aktualisiert werden.' : 'Vorlage konnte nicht gespeichert werden.',
                });
            }
        } finally {
            setIsSavingTemplate(false);
        }
    };

    const handleApplyTemplate = async () => {
        if (!activeTemplateId) return;

        const ok = await applyTemplateToCurrentWorksheet(activeTemplateId);
        if (ok) {
            setStatusMessage({ type: 'success', text: 'Vorlage angewendet.' });
        } else {
            setStatusMessage({ type: 'error', text: 'Vorlage konnte nicht angewendet werden.' });
        }
    };

    const handleDeleteTemplate = async () => {
        if (!activeTemplateId) return;
        const entry = designTemplates.find((item) => item.id === activeTemplateId);
        if (!entry) return;

        const confirmed = window.confirm(`Vorlage "${entry.name}" wirklich löschen?`);
        if (!confirmed) return;

        await removeDesignTemplate(entry.id);
        setActiveTemplateId('');
        setStatusMessage({ type: 'success', text: 'Vorlage gelöscht.' });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            ariaLabel="Design-Editor"
            className="w-full max-w-5xl max-h-[90vh] bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
                {/* Gradient bar */}
                <div className="h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 shrink-0" />

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-lg">
                            <Palette className={`${ICON_SIZES[16]} text-white`} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                Design-Editor
                            </h2>
                            <p className="text-[10px] text-slate-400">
                                Arbeitsblatt-Vorlage konfigurieren – Änderungen live sichtbar
                            </p>
                            {editingTemplate && (
                                <p className="text-[10px] text-violet-500 mt-0.5">
                                    Bearbeite Vorlage: {editingTemplate.name}
                                </p>
                            )}
                        </div>
                    </div>
                    <IconButton
                        onClick={onClose}
                        size="md"
                        className="rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <X className={`${ICON_SIZES[18]} text-slate-400`} />
                    </IconButton>
                </div>

                {/* Split Panel */}
                <div className="flex flex-1 overflow-hidden">

                    {/* ─── Left: Controls ─── */}
                    <div className="w-80 shrink-0 border-r border-slate-100 dark:border-white/[0.06] overflow-y-auto custom-scrollbar p-5 space-y-5">

                        {/* Logo */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                <FolderOpen className={ICON_SIZES[12]} />
                                Gespeicherte Vorlagen
                            </label>

                            <div className="space-y-2">
                                <select
                                    value={activeTemplateId}
                                    onChange={(e) => setActiveTemplateId(e.target.value)}
                                    className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-700 dark:text-slate-300"
                                >
                                    <option value="">Vorlage auswählen...</option>
                                    {designTemplates.map((template) => (
                                        <option key={template.id} value={template.id}>
                                            {template.name}
                                        </option>
                                    ))}
                                </select>

                                {designTemplates.length === 0 && (
                                    <p className="text-[10px] text-slate-400">
                                        Noch keine Vorlagen gespeichert.
                                    </p>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={handleApplyTemplate}
                                        disabled={!activeTemplateId || isTemplateLoading}
                                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.07] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {isTemplateLoading ? 'Lädt...' : 'Anwenden'}
                                    </button>

                                    <button
                                        onClick={handleDeleteTemplate}
                                        disabled={!activeTemplateId}
                                        className="px-2.5 py-2 text-xs rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        Löschen
                                    </button>
                                </div>

                                <button
                                    onClick={openSaveDialog}
                                    className="w-full mt-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors cursor-pointer"
                                >
                                    <Save className={ICON_SIZES[13]} />
                                    {editingTemplate ? 'Vorlage aktualisieren' : 'Als Vorlage speichern'}
                                </button>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-white/[0.06]" />

                        {/* Logo */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                <ImageIcon className={ICON_SIZES[12]} />
                                Schul-Logo
                            </label>

                            {/* Uploaded image preview */}
                            {logoPreview ? (
                                <div className="relative inline-block mb-2">
                                    <img
                                        src={logoPreview}
                                        alt="Logo"
                                        className="h-14 w-auto rounded-lg border border-slate-200 dark:border-white/[0.08] object-contain bg-white p-1"
                                    />
                                    <IconButton
                                        onClick={removeLogo}
                                        size="sm"
                                        className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-sm"
                                    >
                                        <Trash2 className={ICON_SIZES[10]} />
                                    </IconButton>
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
                                                className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 font-mono tracking-wider"
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
                                        <Upload className={ICON_SIZES[14]} />
                                        Bild hochladen
                                    </button>
                                </>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(event) => {
                                    void handleImageUpload(event);
                                }}
                                className="hidden"
                            />
                        </div>

                        <div className="border-t border-slate-100 dark:border-white/[0.06]" />

                        {/* Header Title */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                                Kopfzeile AB
                            </label>
                            <input
                                type="text"
                                value={schoolName}
                                onChange={(e) => setSchoolName(e.target.value)}
                                placeholder="z.B. Grundschule am Park"
                                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                            />
                        </div>

                        <div className="border-t border-slate-100 dark:border-white/[0.06]" />

                        {/* Header / Title / Task Color Toggles */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                <Eye className={ICON_SIZES[12]} />
                                Anzeigeoptionen
                            </label>
                            <div className="space-y-2">
                                {([
                                    {
                                        key: 'showHeaderTitle' as const,
                                        label: 'Kopfzeile AB anzeigen',
                                        value: showHeaderTitle,
                                        onChange: setShowHeaderTitle,
                                    },
                                    {
                                        key: 'showWorksheetTitle' as const,
                                        label: 'Arbeitsblatt-Titel anzeigen',
                                        value: showWorksheetTitle,
                                        onChange: setShowWorksheetTitle,
                                    },
                                    {
                                        key: 'applyColorToTasks' as const,
                                        label: 'Primärfarbe für Aufgaben',
                                        value: applyColorToTasks,
                                        onChange: setApplyColorToTasks,
                                    },
                                ]).map(({ key, label, value, onChange }) => (
                                    <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={value}
                                                onChange={(e) => onChange(e.target.checked)}
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

                        <div className="border-t border-slate-100 dark:border-white/[0.06]" />

                        {/* Header Fields */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                <Eye className={ICON_SIZES[12]} />
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

                        <div className="border-t border-slate-100 dark:border-white/[0.06]" />

                        {/* Font Family */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                                <Type className={ICON_SIZES[12]} />
                                Schriftart
                            </label>

                            {/* Suchfeld */}
                            <div className="relative mb-2">
                                <Search className={`${ICON_SIZES[12]} absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400`} />
                                <input
                                    type="text"
                                    value={fontSearch}
                                    onChange={(e) => setFontSearch(e.target.value)}
                                    placeholder="Font suchen..."
                                    className="w-full pl-7 pr-2.5 py-1.5 text-xs bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                                />
                            </div>

                            {/* Gruppierte Font-Liste */}
                            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                                {(['sans-serif', 'serif', 'handwriting', 'monospace'] as const).map((cat) => {
                                    const fonts = CURATED_FONTS
                                        .filter((f) => f.category === cat)
                                        .filter((f) => !fontSearch || f.label.toLowerCase().includes(fontSearch.toLowerCase()));
                                    if (fonts.length === 0) return null;
                                    return (
                                        <div key={cat}>
                                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                                                {CATEGORY_LABELS[cat]}
                                            </p>
                                            <div className="space-y-0.5">
                                                {fonts.map(({ value, label }) => (
                                                    <button
                                                        key={value}
                                                        onClick={() => {
                                                            loadGoogleFont(value);
                                                            setFontFamily(value);
                                                        }}
                                                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer border ${fontFamily === value
                                                                ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 font-medium'
                                                                : 'bg-white dark:bg-white/[0.04] border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.07]'
                                                            }`}
                                                        style={{ fontFamily: value }}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-white/[0.06]" />

                        {/* Brand Color */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                <Palette className={ICON_SIZES[12]} />
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
                                    {showHeaderTitle && (
                                        <h1 className="text-lg font-bold text-slate-800" style={{ color: brandColor }}>
                                            {schoolName || 'Kopfzeile AB'}
                                        </h1>
                                    )}
                                    {showWorksheetTitle && (
                                        <p className="text-xs text-slate-400 mt-0.5">Arbeitsblatt-Titel</p>
                                    )}
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

                            {/* ── Mock Task 1: Multiple Choice ── */}
                            <div className="mb-6">
                                <p className="text-sm font-semibold text-slate-700 mb-3">
                                    <span style={{ color: mockTaskAccentColor }}>1.</span> Kreuze die richtige Antwort an:
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
                                    <span style={{ color: mockTaskAccentColor }}>2.</span> Schreibe den folgenden Satz in Schreibschrift:
                                </p>
                                <div className="space-y-0">
                                    {[1, 2, 3, 4].map((line) => (
                                        <div
                                            key={line}
                                            className="h-8 border-b border-slate-300"
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* ── Mock Task 3: Cloze ── */}
                            <div className="mb-6">
                                <p className="text-sm font-semibold text-slate-700 mb-3">
                                    <span style={{ color: mockTaskAccentColor }}>3.</span> Ergänze die Lücken:
                                </p>
                                <p className="text-sm text-slate-600 leading-relaxed ml-4">
                                    Die Sonne scheint am <span className="inline-block w-20 border-b-2 border-dashed border-slate-400 mx-1" /> .
                                    Die Vögel <span className="inline-block w-24 border-b-2 border-dashed border-slate-400 mx-1" /> im Baum.
                                    Der Wind weht <span className="inline-block w-16 border-b-2 border-dashed border-slate-400 mx-1" /> .
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
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-white/[0.03] shrink-0">
                    <p className={`text-[10px] ${statusMessage?.type === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                        {statusMessage?.text ?? 'Design wird erst beim Klick auf „Als Vorlage speichern“ als Vorlage gesichert.'}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={openSaveDialog}
                            className="px-3 py-2 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-xs font-medium rounded-lg transition-all cursor-pointer"
                        >
                            {editingTemplate ? 'Vorlage aktualisieren' : 'Als Vorlage speichern'}
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-all cursor-pointer shadow-sm hover:shadow"
                        >
                            Schließen
                        </button>
                    </div>
                </div>

            {isSaveDialogOpen && (
                <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setIsSaveDialogOpen(false)} />
                    <div className="relative w-full max-w-sm rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141c30] p-4 shadow-2xl">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
                            {editingTemplate ? 'Vorlage aktualisieren' : 'Als Vorlage speichern'}
                        </h3>

                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Name
                        </label>
                        <input
                            type="text"
                            value={templateName}
                            onChange={(e) => {
                                setTemplateName(e.target.value);
                                setTemplateNameError(null);
                                setIsNameConflict(false);
                            }}
                            maxLength={50}
                            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-700 dark:text-slate-300"
                            placeholder="z.B. Deutsch Klasse 4"
                            autoFocus
                        />

                        {templateNameError && (
                            <p className="mt-1 text-[10px] text-red-500">{templateNameError}</p>
                        )}

                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setIsSaveDialogOpen(false)}
                                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] cursor-pointer"
                            >
                                Abbrechen
                            </button>

                            {isNameConflict && (
                                <button
                                    onClick={() => void handleSaveTemplate(true)}
                                    disabled={isSavingTemplate}
                                    className="px-3 py-2 text-xs rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50 cursor-pointer"
                                >
                                    Überschreiben
                                </button>
                            )}

                            <button
                                onClick={() => void handleSaveTemplate(false)}
                                disabled={isSavingTemplate || Boolean(validateTemplateName(templateName))}
                                className="px-3 py-2 text-xs rounded-lg bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {isSavingTemplate ? 'Speichern...' : editingTemplate ? 'Aktualisieren' : 'Speichern'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};
