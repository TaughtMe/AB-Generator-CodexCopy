import { useMemo } from 'react';
import { GraduationCap, BookOpen } from 'lucide-react';
import { useWorksheetStore } from '../../store/worksheetStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useProfileStore } from '../../store/profileStore';
import { ICON_SIZES } from '../ui/iconSizes';

/* ══════════════════════════════════════════════════
   ChatContextCard – Sichtbarer KI-Kontext im Chat (Spec §4.1–4.3).

   Zeigt, mit welchem Klassenprofil (und damit Fach + Lerngruppen-
   Beschreibung) die KI gerade arbeitet, und erlaubt den Wechsel direkt
   im Chat. Die Auswahl schreibt worksheet.classId — genau das Feld,
   aus dem sendChatMessage/createDifferentiatedVariant den
   AIClassContext bauen. Die Karte ist also keine Deko: sie steuert
   den echten KI-Kontext.
   ══════════════════════════════════════════════════ */

function truncate(text: string, max = 110): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function ChatContextCard() {
    const classId = useWorksheetStore((s) => s.classId);
    const setClassId = useWorksheetStore((s) => s.setClassId);
    const classProfiles = useWorkspaceStore((s) => s.classProfiles);
    const subjects = useProfileStore((s) => s.subjects);

    const activeProfile = useMemo(
        () => classProfiles.find((profile) => profile.id === classId),
        [classProfiles, classId],
    );
    const subjectName = useMemo(() => {
        if (!activeProfile?.subjectId) return undefined;
        return subjects.find((subject) => subject.id === activeProfile.subjectId)?.name;
    }, [activeProfile, subjects]);

    const profileSummary = activeProfile
        ? truncate(activeProfile.studentProfile || activeProfile.characteristic || activeProfile.curriculumContext || '')
        : '';

    return (
        <div
            data-chat-context-card
            className="shrink-0 px-3 py-2 border-b border-slate-200/70 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30"
        >
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                <GraduationCap className={ICON_SIZES[12]} />
                Klassenprofil (KI-Kontext)
            </label>
            <select
                value={classId ?? ''}
                onChange={(event) => setClassId(event.target.value || undefined)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 px-2.5 py-2 text-xs text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
                <option value="">Kein Profil (ohne Klassenkontext)</option>
                {classProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                        {profile.name}
                    </option>
                ))}
            </select>

            {activeProfile ? (
                <div className="mt-1.5 space-y-0.5">
                    {subjectName && (
                        <p className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                            <BookOpen className={`${ICON_SIZES[11]} shrink-0 text-slate-400`} />
                            <span className="font-medium">Fach:</span> {subjectName}
                        </p>
                    )}
                    {profileSummary && (
                        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                            {profileSummary}
                        </p>
                    )}
                </div>
            ) : (
                <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                    Die KI antwortet ohne Klassen-/Fachkontext. Wähle ein Profil für passgenauere Vorschläge.
                </p>
            )}
        </div>
    );
}
