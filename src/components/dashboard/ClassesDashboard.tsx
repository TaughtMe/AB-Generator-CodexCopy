import React, { useEffect, useState } from 'react';
import { BookOpen, Users, Plus, X, Pencil, Save, Trash2 } from 'lucide-react';
import { useProfileStore } from '../../store/profileStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { ClassProfile } from '../../types/profiles';

interface ClassFormState {
    name: string;
    subjectId: string;
    curriculumContext: string;
    studentProfile: string;
}

const EMPTY_FORM: ClassFormState = {
    name: '',
    subjectId: '',
    curriculumContext: '',
    studentProfile: '',
};

function toFormState(profile: ClassProfile): ClassFormState {
    return {
        name: profile.name,
        subjectId: profile.subjectId ?? '',
        curriculumContext: profile.curriculumContext ?? '',
        studentProfile: profile.studentProfile ?? profile.characteristic ?? '',
    };
}

export const ClassesDashboard: React.FC = () => {
    const subjects = useProfileStore((s) => s.subjects);
    const addSubject = useProfileStore((s) => s.addSubject);
    const removeSubject = useProfileStore((s) => s.removeSubject);

    const classProfiles = useWorkspaceStore((s) => s.classProfiles);
    const isClassProfilesLoading = useWorkspaceStore((s) => s.isClassProfilesLoading);
    const classProfilesError = useWorkspaceStore((s) => s.classProfilesError);
    const loadClassProfiles = useWorkspaceStore((s) => s.loadClassProfiles);
    const createClassProfile = useWorkspaceStore((s) => s.createClassProfile);
    const updateClassProfile = useWorkspaceStore((s) => s.updateClassProfile);
    const removeClassProfile = useWorkspaceStore((s) => s.removeClassProfile);

    const [editingClassId, setEditingClassId] = useState<string | null>(null);
    const [classForm, setClassForm] = useState<ClassFormState>(EMPTY_FORM);
    const [isSavingClass, setIsSavingClass] = useState(false);
    const [classFormError, setClassFormError] = useState<string | null>(null);

    const [newSubjectName, setNewSubjectName] = useState('');
    const [newSubjectCurriculum, setNewSubjectCurriculum] = useState('');
    const [showSubjectForm, setShowSubjectForm] = useState(false);

    useEffect(() => {
        void loadClassProfiles();
    }, [loadClassProfiles]);

    const subjectNameById = new Map(subjects.map((subject) => [subject.id, subject.name]));

    function resetClassForm() {
        setEditingClassId(null);
        setClassForm(EMPTY_FORM);
        setClassFormError(null);
    }

    function handleEditClass(profile: ClassProfile) {
        setEditingClassId(profile.id);
        setClassForm(toFormState(profile));
        setClassFormError(null);
    }

    async function handleSaveClass() {
        const trimmedName = classForm.name.trim();
        if (!trimmedName) {
            setClassFormError('Bitte einen Klassennamen angeben.');
            return;
        }

        setIsSavingClass(true);
        setClassFormError(null);

        try {
            const payload = {
                name: trimmedName,
                subjectId: classForm.subjectId || undefined,
                curriculumContext: classForm.curriculumContext,
                studentProfile: classForm.studentProfile,
            };

            if (editingClassId) {
                await updateClassProfile(editingClassId, payload);
            } else {
                await createClassProfile(payload);
            }

            resetClassForm();
        } catch (error) {
            setClassFormError(error instanceof Error ? error.message : 'Klassenprofil konnte nicht gespeichert werden.');
        } finally {
            setIsSavingClass(false);
        }
    }

    async function handleDeleteClass(profile: ClassProfile) {
        const confirmed = window.confirm(
            `Klassenprofil "${profile.name}" löschen? Verknüpfte Arbeitsblätter werden automatisch entkoppelt.`
        );
        if (!confirmed) return;

        try {
            await removeClassProfile(profile.id);
            if (editingClassId === profile.id) {
                resetClassForm();
            }
        } catch (error) {
            setClassFormError(error instanceof Error ? error.message : 'Klassenprofil konnte nicht gelöscht werden.');
        }
    }

    function handleAddSubject() {
        const trimmedName = newSubjectName.trim();
        if (!trimmedName) return;

        addSubject(trimmedName, newSubjectCurriculum.trim());
        setNewSubjectName('');
        setNewSubjectCurriculum('');
        setShowSubjectForm(false);
    }

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 md:py-10">
            <div className="mb-8">
                <h2 className="text-xl font-extrabold tracking-tight text-slate-800 dark:text-white">
                    Klassen & Faecher
                </h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
                    Klassenprofile mit Lehrplan-Kontext und KI-Lerngruppenprofil verwalten.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
                <div className="space-y-6">
                    <section className="p-5 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <BookOpen size={16} className="text-blue-500" />
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                    Faecher ({subjects.length})
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowSubjectForm((v) => !v)}
                                className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 cursor-pointer transition-colors"
                                title="Fach hinzufuegen"
                            >
                                {showSubjectForm ? <X size={15} /> : <Plus size={15} />}
                            </button>
                        </div>

                        {subjects.length === 0 && !showSubjectForm ? (
                            <p className="text-xs text-slate-400">Noch keine Faecher angelegt.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {subjects.map((subject) => (
                                    <span
                                        key={subject.id}
                                        className="group/chip inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg"
                                    >
                                        {subject.name}
                                        <button
                                            onClick={() => removeSubject(subject.id)}
                                            className="opacity-0 group-hover/chip:opacity-100 hover:text-red-500 cursor-pointer transition-opacity"
                                            title="Entfernen"
                                        >
                                            <X size={11} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

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
                                    rows={3}
                                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 resize-none"
                                />
                                <button
                                    onClick={handleAddSubject}
                                    disabled={!newSubjectName.trim()}
                                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Fach hinzufuegen
                                </button>
                            </div>
                        )}
                    </section>

                    <section className="p-5 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <Users size={16} className="text-emerald-500" />
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                Klassenprofile ({classProfiles.length})
                            </h3>
                        </div>

                        {isClassProfilesLoading && classProfiles.length === 0 ? (
                            <p className="text-xs text-slate-400">Lade Klassenprofile ...</p>
                        ) : classProfiles.length === 0 ? (
                            <p className="text-xs text-slate-400">Noch keine Klassenprofile angelegt.</p>
                        ) : (
                            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                                {classProfiles.map((profile) => {
                                    const isActive = editingClassId === profile.id;
                                    const subjectName = profile.subjectId ? subjectNameById.get(profile.subjectId) : undefined;
                                    return (
                                        <div
                                            key={profile.id}
                                            className={`rounded-lg border px-3 py-2 ${
                                                isActive
                                                    ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-900/10'
                                                    : 'border-slate-200 dark:border-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                                                        {profile.name}
                                                    </div>
                                                    <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                        {subjectName ? `Fach: ${subjectName}` : 'Kein Fach zugeordnet'}
                                                    </div>
                                                    {(profile.curriculumContext || profile.studentProfile) && (
                                                        <div className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                                                            {[profile.curriculumContext, profile.studentProfile].filter(Boolean).join(' | ')}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        onClick={() => handleEditClass(profile)}
                                                        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                                                        title="Bearbeiten"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => void handleDeleteClass(profile)}
                                                        className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 cursor-pointer"
                                                        title="Löschen"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>

                <section className="p-5 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl h-fit">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                {editingClassId ? 'Klassenprofil bearbeiten' : 'Neues Klassenprofil'}
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Diese Angaben werden spaeter in den KI-System-Prompt injiziert.
                            </p>
                        </div>
                        <button
                            onClick={resetClassForm}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                        >
                            <Plus size={13} /> Neu
                        </button>
                    </div>

                    {(classFormError || classProfilesError) && (
                        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
                            {classFormError ?? classProfilesError}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                                Klassenname
                            </label>
                            <input
                                type="text"
                                value={classForm.name}
                                onChange={(e) => setClassForm((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="z.B. 8b GPG"
                                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-slate-700 dark:text-slate-300"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                                Fach (optional)
                            </label>
                            <select
                                value={classForm.subjectId}
                                onChange={(e) => setClassForm((prev) => ({ ...prev, subjectId: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                                <option value="">Kein Fach</option>
                                {subjects.map((subject) => (
                                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                                Lehrplan-Kontext (Text, Links)
                            </label>
                            <textarea
                                value={classForm.curriculumContext}
                                onChange={(e) => setClassForm((prev) => ({ ...prev, curriculumContext: e.target.value }))}
                                rows={7}
                                placeholder="Kompetenzerwartungen, Inhalte, Schwerpunkte, Links zum Lehrplan ..."
                                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-slate-700 dark:text-slate-300 resize-y"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                                Klassenprofil (KI)
                            </label>
                            <textarea
                                value={classForm.studentProfile}
                                onChange={(e) => setClassForm((prev) => ({ ...prev, studentProfile: e.target.value }))}
                                rows={7}
                                placeholder="Leistungsniveau, Tempo, DaZ-Anteil, Foerderbedarf, Differenzierungshinweise ..."
                                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-slate-700 dark:text-slate-300 resize-y"
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            <button
                                onClick={() => void handleSaveClass()}
                                disabled={isSavingClass || !classForm.name.trim()}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save size={15} /> {isSavingClass ? 'Speichere ...' : editingClassId ? 'Aenderungen speichern' : 'Klassenprofil anlegen'}
                            </button>
                            {editingClassId && (
                                <button
                                    onClick={resetClassForm}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                                >
                                    Abbrechen
                                </button>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};
