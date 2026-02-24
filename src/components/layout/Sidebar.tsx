import React from 'react';
import { BookOpen, LayoutDashboard, FolderOpen, Users, Settings, HelpCircle, ChevronDown, Trash2 } from 'lucide-react';
import { useProfileStore } from '../../store/profileStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { DashboardView } from './AppShell';
import { IconButton } from '../ui/IconButton';
import { ICON_SIZES } from '../ui/iconSizes';

/* ══════════════════════════════════════════════════
   Sidebar.tsx – Fixe linke Navigation
   Kontext-Dropdown oben, Navigation, Footer-Icons.
   ══════════════════════════════════════════════════ */

interface SidebarProps {
    activeView: DashboardView;
    onChangeView: (view: DashboardView) => void;
    onOpenSettings: () => void;
}

/** Navigation items */
const NAV_ITEMS: { id: DashboardView | 'settings'; label: string; icon: React.ElementType; action?: 'settings' }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'dashboard', label: 'Meine Materialien', icon: FolderOpen },
    { id: 'profiles', label: 'Klassen & Fächer', icon: Users },
    { id: 'trash', label: 'Papierkorb', icon: Trash2 },
    { id: 'settings', label: 'Einstellungen', icon: Settings, action: 'settings' },
];

export const Sidebar: React.FC<SidebarProps> = ({
    activeView,
    onChangeView,
    onOpenSettings,
}) => {
    const subjects = useProfileStore((s) => s.subjects);
    const classes = useWorkspaceStore((s) => s.classProfiles);
    const activeSubjectId = useProfileStore((s) => s.activeSubjectId);
    const activeClassId = useProfileStore((s) => s.activeClassId);
    const setActiveSubject = useProfileStore((s) => s.setActiveSubject);
    const setActiveClass = useProfileStore((s) => s.setActiveClass);

    const activeSubject = activeSubjectId ? subjects.find((s) => s.id === activeSubjectId) : null;
    const activeClass = activeClassId ? classes.find((c) => c.id === activeClassId) : null;

    /* Zusammengefasster Kontext-Label */
    const contextLabel = [activeSubject?.name, activeClass?.name].filter(Boolean).join(', ') || 'Alle';

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900/95 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-700/50">
            {/* ── Aktiver Kontext (oben) ── */}
            <div className="px-4 pt-5 pb-4">
                <div className="relative group">
                    <button
                        className="w-full flex items-center gap-3 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                            <BookOpen className={`${ICON_SIZES[14]} text-white`} />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none mb-0.5">
                                Aktiver Kontext:
                            </p>
                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                {contextLabel}
                            </p>
                        </div>
                        <ChevronDown className={`${ICON_SIZES[14]} text-slate-400 shrink-0`} />
                    </button>

                    {/* Kontext-Dropdown (öffnet bei Hover) */}
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 space-y-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
                        <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Fach</label>
                            <select
                                value={activeSubjectId ?? ''}
                                onChange={(e) => setActiveSubject(e.target.value || null)}
                                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                                <option value="">Alle Fächer</option>
                                {subjects.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Klasse</label>
                            <select
                                value={activeClassId ?? ''}
                                onChange={(e) => setActiveClass(e.target.value || null)}
                                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                                <option value="">Alle Klassen</option>
                                {classes.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Navigation ── */}
            <nav className="px-3 flex-1" data-tour="sidebar-nav">
                <ul className="space-y-0.5">
                    {NAV_ITEMS.map(({ id, label, icon: Icon, action }, index) => {
                        const isActive = !action && activeView === id;
                        return (
                            <li key={`${id}-${index}`}>
                                <button
                                    onClick={() => action === 'settings' ? onOpenSettings() : onChangeView(id as DashboardView)}
                                    className={`
                                        w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium
                                        transition-colors cursor-pointer
                                        ${isActive
                                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                                        }
                                    `}
                                >
                                    <Icon className={`${ICON_SIZES[17]} ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                                    {label}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* ── Footer (Hilfe + Avatar) ── */}
            <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-700/40 flex items-center justify-between">
                <IconButton
                    size="lg"
                    className="text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-600 dark:hover:text-slate-300"
                    title="Hilfe"
                >
                    <HelpCircle className={ICON_SIZES[18]} />
                </IconButton>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                    <span className="text-[11px] font-bold text-white">L</span>
                </div>
            </div>
        </div>
    );
};
