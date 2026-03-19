import React, { useEffect, useState, Suspense } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { ICON_SIZES } from '../ui/iconSizes';
import { AppFooter } from './AppFooter';
import { LegalModals, type LegalModalType } from './LegalModals';
import { useSettingsStore } from '../../store/settingsStore';
import { useWorkspaceStore } from '../../store/workspaceStore';

const OnboardingTour = React.lazy(() => import('../onboarding/OnboardingTour'));

/* ══════════════════════════════════════════════════
   AppShell.tsx – Das Basis-Layout ("Lehrer-Schreibtisch")
   Fixe Sidebar links + scrollbarer Main-Bereich rechts.
   Auf kleinen Bildschirmen wird die Sidebar zum Overlay.
   ══════════════════════════════════════════════════ */

export type DashboardView = 'dashboard' | 'profiles' | 'trash' | 'settings';

interface AppShellProps {
    /** Welche Seite im Main-Bereich aktuell angezeigt wird */
    activeView: DashboardView;
    onChangeView: (view: DashboardView) => void;
    onOpenSettings: () => void;
    children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
    activeView,
    onChangeView,
    onOpenSettings,
    children,
}) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeLegalModal, setActiveLegalModal] = useState<LegalModalType | null>(null);
    const [isOnboardingRunning, setIsOnboardingRunning] = useState(false);

    const hasSeenOnboarding = useSettingsStore((state) => state.hasSeenOnboarding);
    const completeOnboarding = useSettingsStore((state) => state.completeOnboarding);
    const currentView = useWorkspaceStore((state) => state.currentView);

    const shouldAutoStartOnboarding = !hasSeenOnboarding
        && currentView === 'dashboard'
        && activeView === 'dashboard';

    useEffect(() => {
        if (!shouldAutoStartOnboarding || isOnboardingRunning) return;
        setIsOnboardingRunning(true);
    }, [isOnboardingRunning, shouldAutoStartOnboarding]);

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
            <Suspense fallback={null}>
                <OnboardingTour
                    run={isOnboardingRunning}
                    onComplete={() => {
                        setIsOnboardingRunning(false);
                        completeOnboarding();
                    }}
                />
            </Suspense>

            {/* ── Mobile Overlay Backdrop ── */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ── Sidebar ── */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-40 w-64
                    transform transition-transform duration-200 ease-in-out
                    md:translate-x-0 md:static md:z-auto
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                <Sidebar
                    activeView={activeView}
                    onChangeView={(view) => {
                        onChangeView(view);
                        setSidebarOpen(false);
                    }}
                    onOpenSettings={() => {
                        onOpenSettings();
                        setSidebarOpen(false);
                    }}
                />
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 min-w-0 overflow-y-auto">
                {/* Mobile Hamburger-Button */}
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden fixed top-4 left-4 z-20 p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-lg cursor-pointer"
                    aria-label="Menü öffnen"
                >
                    <Menu className={`${ICON_SIZES[20]} text-slate-600 dark:text-slate-300`} />
                </button>

                <div className="min-h-screen flex flex-col">
                    <div className="flex-1 min-h-0">
                        {children}
                    </div>

                    <AppFooter onOpenLegalModal={(modal) => setActiveLegalModal(modal)} />
                </div>
            </main>

            <LegalModals
                activeModal={activeLegalModal}
                onClose={() => setActiveLegalModal(null)}
            />
        </div>
    );
};
