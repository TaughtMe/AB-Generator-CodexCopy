import React, { useEffect, useState } from 'react';
import {
    Plus, Clock, BookOpen, Users, Trash2, FileText,
    ChevronRight, Sparkles, Palette, KeyRound, Eye, EyeOff, X,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useProfileStore } from '../../store/profileStore';
import { useSettingsStore } from '../../store/settingsStore';
import type { WorksheetMeta } from '../../store/dexieStore';

/* ══════════════════════════════════════════════════
   Dashboard.tsx – Startseite / Übersicht
   Quick actions, recent worksheets, profile CRUD,
   and API key settings.
   ══════════════════════════════════════════════════ */

interface DashboardProps {
    onOpenEditor: () => void;
    onOpenDesignEditor: () => void;
}

/** Relative time label */
function timeAgo(date: Date): string {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Gerade eben';
    if (minutes < 60) return `vor ${minutes} Min.`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours} Std.`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Gestern';
    return `vor ${days} Tagen`;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenEditor, onOpenDesignEditor }) => {
    const { recentWorksheets, loadRecent, openWorksheet, createNewWorksheet, removeWorksheet } =
        useWorkspaceStore();
    const { subjects, classes, addSubject, addClassProfile, removeSubject, removeClassProfile } = useProfileStore();
    const { apiKey, setApiKey } = useSettingsStore();

    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showKey, setShowKey] = useState(false);

    // Subject form
    const [newSubjectName, setNewSubjectName] = useState('');
    const [newSubjectCurriculum, setNewSubjectCurriculum] = useState('');
    const [showSubjectForm, setShowSubjectForm] = useState(false);

    // Class form
    const [newClassName, setNewClassName] = useState('');
    const [newClassChar, setNewClassChar] = useState('');
    const [showClassForm, setShowClassForm] = useState(false);

    useEffect(() => {
        loadRecent();
    }, [loadRecent]);

    const handleNewWorksheet = () => {
        createNewWorksheet();
        onOpenEditor();
    };

    const handleOpenWorksheet = async (id: string) => {
        const ok = await openWorksheet(id);
        if (ok) onOpenEditor();
    };

    const handleDelete = async (e: React.MouseEvent, meta: WorksheetMeta) => {
        e.stopPropagation();
        setDeletingId(meta.id);
        await removeWorksheet(meta.id);
        setDeletingId(null);
    };

    const handleAddSubject = () => {
        if (!newSubjectName.trim()) return;
        addSubject(newSubjectName.trim(), newSubjectCurriculum.trim());
        setNewSubjectName('');
        setNewSubjectCurriculum('');
        setShowSubjectForm(false);
    };

    const handleAddClass = () => {
        if (!newClassName.trim()) return;
        addClassProfile(newClassName.trim(), newClassChar.trim());
        setNewClassName('');
        setNewClassChar('');
        setShowClassForm(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20">
            <div className="max-w-5xl mx-auto px-6 py-10">

                {/* ── Hero ── */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <BookOpen size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
                                AB-Generator
                            </h1>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                Arbeitsblätter erstellen, gestalten & exportieren
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Quick Actions ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                    {/* New Worksheet */}
                    <button
                        onClick={handleNewWorksheet}
                        className="group relative flex items-center gap-4 p-5 bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-2xl shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all cursor-pointer active:scale-[0.98] text-left"
                    >
                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                            <Plus size={22} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">Neues Arbeitsblatt</h3>
                            <p className="text-xs text-white/70 mt-0.5">Leeres Blatt erstellen</p>
                        </div>
                        <ChevronRight size={18} className="text-white/40 ml-auto group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Design Editor */}
                    <button
                        onClick={onOpenDesignEditor}
                        className="group relative flex items-center gap-4 p-5 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98] text-left"
                    >
                        <div className="p-3 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-xl">
                            <Palette size={20} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Design-Editor</h3>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Kopfzeile & Logo gestalten</p>
                        </div>
                        <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 ml-auto group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* AI Generate */}
                    <button
                        onClick={handleNewWorksheet}
                        className="group relative flex items-center gap-4 p-5 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98] text-left"
                    >
                        <div className="p-3 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-xl">
                            <Sparkles size={20} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">KI-Arbeitsblatt</h3>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Mit Gemini generieren</p>
                        </div>
                        <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 ml-auto group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>

                {/* ── Recent Worksheets ── */}
                <section className="mb-10">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock size={16} className="text-slate-400" />
                        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            Zuletzt bearbeitet
                        </h2>
                    </div>

                    {recentWorksheets.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700/60 rounded-2xl bg-white/50 dark:bg-slate-800/30">
                            <FileText size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                            <p className="text-sm text-slate-400 dark:text-slate-500">
                                Noch keine gespeicherten Arbeitsblätter.
                            </p>
                            <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">
                                Erstelle dein erstes Arbeitsblatt oben.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {recentWorksheets.map((meta) => (
                                <button
                                    key={meta.id}
                                    onClick={() => handleOpenWorksheet(meta.id)}
                                    disabled={deletingId === meta.id}
                                    className="group relative flex flex-col p-4 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer text-left disabled:opacity-40"
                                >
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate pr-8">
                                        {meta.title}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-[10px] text-slate-400">
                                            {meta.taskCount} {meta.taskCount === 1 ? 'Aufgabe' : 'Aufgaben'}
                                        </span>
                                        <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>
                                        <span className="text-[10px] text-slate-400">
                                            {timeAgo(meta.updatedAt)}
                                        </span>
                                    </div>
                                    {/* Delete */}
                                    <button
                                        onClick={(e) => handleDelete(e, meta)}
                                        className="absolute top-3 right-3 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-500 transition-all cursor-pointer"
                                        title="Löschen"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Profiles: Fächer & Klassen ── */}
                <section className="mb-10">
                    <div className="flex items-center gap-2 mb-4">
                        <Users size={16} className="text-slate-400" />
                        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            Profile
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                        {/* ── Fächer ── */}
                        <div className="p-4 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <BookOpen size={14} className="text-blue-500" />
                                    <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                        Fächer ({subjects.length})
                                    </h4>
                                </div>
                                <button
                                    onClick={() => setShowSubjectForm(!showSubjectForm)}
                                    className="p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 cursor-pointer transition-colors"
                                    title="Fach hinzufügen"
                                >
                                    {showSubjectForm ? <X size={14} /> : <Plus size={14} />}
                                </button>
                            </div>

                            {/* Subject chips */}
                            {subjects.length === 0 && !showSubjectForm ? (
                                <p className="text-[11px] text-slate-400">Noch keine Fächer angelegt.</p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {subjects.map((s) => (
                                        <span key={s.id} className="group/chip inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md">
                                            {s.name}
                                            <button
                                                onClick={() => removeSubject(s.id)}
                                                className="opacity-0 group-hover/chip:opacity-100 hover:text-red-500 cursor-pointer transition-opacity"
                                                title="Entfernen"
                                            >
                                                <X size={10} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Add subject form */}
                            {showSubjectForm && (
                                <div className="mt-2 space-y-2 p-2 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                                    <input
                                        type="text"
                                        value={newSubjectName}
                                        onChange={(e) => setNewSubjectName(e.target.value)}
                                        placeholder="Fachname (z.B. Mathematik)"
                                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
                                    />
                                    <textarea
                                        value={newSubjectCurriculum}
                                        onChange={(e) => setNewSubjectCurriculum(e.target.value)}
                                        placeholder="Lehrplan-Kontext (optional)"
                                        rows={2}
                                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 resize-none"
                                    />
                                    <button
                                        onClick={handleAddSubject}
                                        disabled={!newSubjectName.trim()}
                                        className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Fach hinzufügen
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ── Klassen ── */}
                        <div className="p-4 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Users size={14} className="text-emerald-500" />
                                    <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                        Klassen ({classes.length})
                                    </h4>
                                </div>
                                <button
                                    onClick={() => setShowClassForm(!showClassForm)}
                                    className="p-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-500 cursor-pointer transition-colors"
                                    title="Klasse hinzufügen"
                                >
                                    {showClassForm ? <X size={14} /> : <Plus size={14} />}
                                </button>
                            </div>

                            {/* Class chips */}
                            {classes.length === 0 && !showClassForm ? (
                                <p className="text-[11px] text-slate-400">Noch keine Klassen angelegt.</p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {classes.map((c) => (
                                        <span key={c.id} className="group/chip inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-md">
                                            {c.name}
                                            <button
                                                onClick={() => removeClassProfile(c.id)}
                                                className="opacity-0 group-hover/chip:opacity-100 hover:text-red-500 cursor-pointer transition-opacity"
                                                title="Entfernen"
                                            >
                                                <X size={10} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Add class form */}
                            {showClassForm && (
                                <div className="mt-2 space-y-2 p-2 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                                    <input
                                        type="text"
                                        value={newClassName}
                                        onChange={(e) => setNewClassName(e.target.value)}
                                        placeholder="Klassenname (z.B. 3a)"
                                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddClass()}
                                    />
                                    <input
                                        type="text"
                                        value={newClassChar}
                                        onChange={(e) => setNewClassChar(e.target.value)}
                                        placeholder="Besonderheit (z.B. Inklusion, DaZ-Anteil)"
                                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                                    />
                                    <button
                                        onClick={handleAddClass}
                                        disabled={!newClassName.trim()}
                                        className="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Klasse hinzufügen
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* ── API-Key Settings ── */}
                <section className="mb-10">
                    <div className="flex items-center gap-2 mb-4">
                        <KeyRound size={16} className="text-slate-400" />
                        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            API-Einstellungen
                        </h2>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl max-w-md">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                            <KeyRound size={12} />
                            Gemini API-Key
                        </label>
                        <div className="relative">
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="API-Key einfügen..."
                                className="w-full px-3 py-2.5 pr-10 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-700 dark:text-slate-300 font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                            >
                                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        <p className="mt-1.5 text-[10px] text-slate-400">
                            Wird nur lokal gespeichert. Nie an Dritte übertragen.
                        </p>
                    </div>
                </section>

            </div>
        </div>
    );
};
