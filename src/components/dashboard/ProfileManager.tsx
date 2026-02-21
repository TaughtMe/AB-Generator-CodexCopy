import React, { useState } from 'react';
import { BookOpen, Users, Plus, X } from 'lucide-react';
import { useProfileStore } from '../../store/profileStore';

/* ══════════════════════════════════════════════════
   ProfileManager.tsx – Fächer & Klassen verwalten
   Eigene Seite innerhalb der AppShell (Sidebar → "Klassen & Fächer").
   ══════════════════════════════════════════════════ */

export const ProfileManager: React.FC = () => {
    const { subjects, classes, addSubject, addClassProfile, removeSubject, removeClassProfile } = useProfileStore();

    // Subject form
    const [newSubjectName, setNewSubjectName] = useState('');
    const [newSubjectCurriculum, setNewSubjectCurriculum] = useState('');
    const [showSubjectForm, setShowSubjectForm] = useState(false);

    // Class form
    const [newClassName, setNewClassName] = useState('');
    const [newClassChar, setNewClassChar] = useState('');
    const [showClassForm, setShowClassForm] = useState(false);

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
        <div className="max-w-3xl mx-auto px-6 py-8 md:py-10">
            <div className="mb-8">
                <h2 className="text-xl font-extrabold tracking-tight text-slate-800 dark:text-white">
                    Klassen & Fächer
                </h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
                    Verwalte deine Fächer und Klassen-Profile für die Zuordnung zu Arbeitsblättern.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* ── Fächer ── */}
                <div className="p-5 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <BookOpen size={16} className="text-blue-500" />
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                Fächer ({subjects.length})
                            </h3>
                        </div>
                        <button
                            onClick={() => setShowSubjectForm(!showSubjectForm)}
                            className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 cursor-pointer transition-colors"
                            title="Fach hinzufügen"
                        >
                            {showSubjectForm ? <X size={15} /> : <Plus size={15} />}
                        </button>
                    </div>

                    {/* Subject chips */}
                    {subjects.length === 0 && !showSubjectForm ? (
                        <p className="text-xs text-slate-400">Noch keine Fächer angelegt.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {subjects.map((s) => (
                                <span key={s.id} className="group/chip inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                                    {s.name}
                                    <button
                                        onClick={() => removeSubject(s.id)}
                                        className="opacity-0 group-hover/chip:opacity-100 hover:text-red-500 cursor-pointer transition-opacity"
                                        title="Entfernen"
                                    >
                                        <X size={11} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Add subject form */}
                    {showSubjectForm && (
                        <div className="mt-3 space-y-2 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                            <input
                                type="text"
                                value={newSubjectName}
                                onChange={(e) => setNewSubjectName(e.target.value)}
                                placeholder="Fachname (z.B. Mathematik)"
                                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
                            />
                            <textarea
                                value={newSubjectCurriculum}
                                onChange={(e) => setNewSubjectCurriculum(e.target.value)}
                                placeholder="Lehrplan-Kontext (optional)"
                                rows={2}
                                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 resize-none"
                            />
                            <button
                                onClick={handleAddSubject}
                                disabled={!newSubjectName.trim()}
                                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Fach hinzufügen
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Klassen ── */}
                <div className="p-5 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Users size={16} className="text-emerald-500" />
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                Klassen ({classes.length})
                            </h3>
                        </div>
                        <button
                            onClick={() => setShowClassForm(!showClassForm)}
                            className="p-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-500 cursor-pointer transition-colors"
                            title="Klasse hinzufügen"
                        >
                            {showClassForm ? <X size={15} /> : <Plus size={15} />}
                        </button>
                    </div>

                    {/* Class chips */}
                    {classes.length === 0 && !showClassForm ? (
                        <p className="text-xs text-slate-400">Noch keine Klassen angelegt.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {classes.map((c) => (
                                <span key={c.id} className="group/chip inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                    {c.name}
                                    <button
                                        onClick={() => removeClassProfile(c.id)}
                                        className="opacity-0 group-hover/chip:opacity-100 hover:text-red-500 cursor-pointer transition-opacity"
                                        title="Entfernen"
                                    >
                                        <X size={11} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Add class form */}
                    {showClassForm && (
                        <div className="mt-3 space-y-2 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                            <input
                                type="text"
                                value={newClassName}
                                onChange={(e) => setNewClassName(e.target.value)}
                                placeholder="Klassenname (z.B. 3a)"
                                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddClass()}
                            />
                            <input
                                type="text"
                                value={newClassChar}
                                onChange={(e) => setNewClassChar(e.target.value)}
                                placeholder="Besonderheit (z.B. Inklusion, DaZ-Anteil)"
                                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                            />
                            <button
                                onClick={handleAddClass}
                                disabled={!newClassName.trim()}
                                className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Klasse hinzufügen
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
