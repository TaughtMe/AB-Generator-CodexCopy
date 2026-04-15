import React from 'react';
import { useTranslation } from 'react-i18next';
import { useProfileStore } from '../../store/profileStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { WorksheetFilter } from '../../store/dexieStore';

/* ══════════════════════════════════════════════════
   FilterBar.tsx – Inline-Filter-Pills neben dem Titel
   Kompakte Pill-Dropdowns: Fach, Klasse, Sortierung.
   ══════════════════════════════════════════════════ */

interface FilterBarProps {
    filter: WorksheetFilter;
    onFilterChange: (filter: WorksheetFilter) => void;
    resultCount: number;
}

const pillClass =
    'appearance-none pl-2 pr-6 py-1 text-xs font-medium rounded-full ' +
    'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ' +
    'text-slate-600 dark:text-slate-300 cursor-pointer ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500/40 ' +
    'bg-[length:10px] bg-[right_6px_center] bg-no-repeat ' +
    'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2710%27%20height%3D%276%27%3E%3Cpath%20d%3D%27M0%200l5%206%205-6z%27%20fill%3D%27%2394a3b8%27%2F%3E%3C%2Fsvg%3E")]';

export const FilterBar: React.FC<FilterBarProps> = ({
    filter,
    onFilterChange,
}) => {
    const { t } = useTranslation();
    const subjects = useProfileStore((s) => s.subjects);
    const classes = useWorkspaceStore((s) => s.classProfiles);

    const handleChange = (key: keyof WorksheetFilter, value: string) => {
        onFilterChange({ ...filter, [key]: value || undefined });
    };

    return (
        <div className="flex items-center gap-2">
            {/* Fach */}
            <label className="relative">
                <span className="sr-only">{t('filter.subject')}</span>
                <select
                    value={filter.subjectId ?? ''}
                    onChange={(e) => handleChange('subjectId', e.target.value)}
                    className={pillClass}
                >
                    <option value="">{t('filter.subjectAll')}</option>
                    {subjects.map((s) => (
                        <option key={s.id} value={s.id}>{t('filter.subjectPrefix')} {s.name}</option>
                    ))}
                </select>
            </label>

            {/* Klasse */}
            <label className="relative">
                <span className="sr-only">{t('filter.class')}</span>
                <select
                    value={filter.classId ?? ''}
                    onChange={(e) => handleChange('classId', e.target.value)}
                    className={pillClass}
                >
                    <option value="">{t('filter.classAll')}</option>
                    {classes.map((c) => (
                        <option key={c.id} value={c.id}>{t('filter.classPrefix')} {c.name}</option>
                    ))}
                </select>
            </label>

            {/* Sortierung */}
            <label className="relative">
                <span className="sr-only">{t('filter.sort')}</span>
                <select
                    value={filter.sortBy ?? 'updatedAt'}
                    onChange={(e) => handleChange('sortBy', e.target.value)}
                    className={pillClass}
                >
                    <option value="updatedAt">{t('filter.sortNewest')}</option>
                    <option value="createdAt">{t('filter.sortCreated')}</option>
                    <option value="title">{t('filter.sortAlphabetical')}</option>
                </select>
            </label>
        </div>
    );
};
