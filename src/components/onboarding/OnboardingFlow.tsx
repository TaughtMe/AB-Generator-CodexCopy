import { useEffect, useState, useCallback, useMemo } from 'react';
import Joyride, { STATUS, type CallBackProps } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from './LanguageSelector';
import { getDashboardSteps, getEditorSteps } from '../../config/tourSteps';

/* ══════════════════════════════════════════════════
   OnboardingFlow.tsx – Unified multi-phase onboarding
   Phase: language → dashboard → editor → farewell → done
   Spanning across Dashboard ↔ Editor view transitions.
   ══════════════════════════════════════════════════ */

type Phase = 'idle' | 'language' | 'dashboard' | 'wait-for-editor' | 'editor' | 'wait-for-dashboard' | 'farewell' | 'done';

const STORAGE_KEY = 'onboarding_completed';
const PHASE_KEY = 'onboarding_phase';

const VALID_PHASES: Phase[] = ['language', 'dashboard', 'wait-for-editor', 'editor', 'wait-for-dashboard', 'farewell'];

interface OnboardingFlowProps {
    /** Current app view: 'dashboard' | 'editor' | … */
    currentView: string;
    /** Callback to create a new worksheet & navigate to editor (called when user clicks "Neues Arbeitsblatt" during tour) */
    onCreateAndOpenEditor: () => void;
}

export function OnboardingFlow({ currentView, onCreateAndOpenEditor }: OnboardingFlowProps) {
    const { t, i18n } = useTranslation();

    // Persist phase in sessionStorage so it survives view-switch remounts
    const [phase, setPhaseRaw] = useState<Phase>(() => {
        if (localStorage.getItem(STORAGE_KEY) === 'true') return 'done';
        const saved = sessionStorage.getItem(PHASE_KEY);
        if (saved && (VALID_PHASES as string[]).includes(saved)) return saved as Phase;
        return 'idle';
    });

    const setPhase = useCallback((p: Phase) => {
        setPhaseRaw(p);
        if (p === 'done' || p === 'idle') {
            sessionStorage.removeItem(PHASE_KEY);
        } else {
            sessionStorage.setItem(PHASE_KEY, p);
        }
    }, []);

    const [runJoyride, setRunJoyride] = useState(false);

    // ── Initialisation: check if onboarding should start ──
    useEffect(() => {
        if (phase !== 'idle') return;
        if (localStorage.getItem(STORAGE_KEY) === 'true') {
            setPhase('done');
            return;
        }
        // Only launch when on the dashboard
        if (currentView === 'dashboard') {
            setPhase('language');
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Phase transitions triggered by view changes ──
    useEffect(() => {
        if (phase === 'wait-for-editor' && currentView === 'editor') {
            // User clicked "Neues Arbeitsblatt" → editor is now rendered
            const timer = window.setTimeout(() => {
                setPhase('editor');
                setRunJoyride(true);
            }, 600);
            return () => window.clearTimeout(timer);
        }

        if (phase === 'wait-for-dashboard' && currentView !== 'editor') {
            // User clicked Home → back on dashboard
            setPhase('farewell');
        }
    }, [currentView, phase]);

    // ── Start dashboard Joyride after language selection ──
    const handleLanguageSelected = useCallback(() => {
        setPhase('dashboard');
        // Small delay so the LanguageSelector unmounts and DOM is ready
        window.setTimeout(() => setRunJoyride(true), 400);
    }, []);

    // ── Steps (re-computed when language changes) ──
    const dashboardSteps = useMemo(() => getDashboardSteps(t), [t, i18n.language]);
    const editorSteps = useMemo(() => getEditorSteps(t), [t, i18n.language]);

    // ── Joyride callback ──
    const handleJoyrideCallback = useCallback(
        (data: CallBackProps) => {
            const { status } = data;

            if (status === STATUS.SKIPPED) {
                // User skipped → mark complete
                localStorage.setItem(STORAGE_KEY, 'true');
                setRunJoyride(false);
                setPhase('done');
                return;
            }

            if (status === STATUS.FINISHED) {
                setRunJoyride(false);

                if (phase === 'dashboard') {
                    // Dashboard tour finished → wait for view to switch to editor.
                    // The last step had spotlightClicks: true so user could click
                    // the "Neues Arbeitsblatt" button. We also trigger it explicitly
                    // as a fallback.
                    setPhase('wait-for-editor');
                    onCreateAndOpenEditor();
                    return;
                }

                if (phase === 'editor') {
                    // Editor tour finished → wait for user to click Home.
                    // Last step had spotlightClicks: true.
                    setPhase('wait-for-dashboard');
                    return;
                }
            }
        },
        [phase, onCreateAndOpenEditor],
    );

    // ── Farewell toast (auto-dismiss) ──
    useEffect(() => {
        if (phase !== 'farewell') return;
        const timer = window.setTimeout(() => {
            localStorage.setItem(STORAGE_KEY, 'true');
            setPhase('done');
        }, 4000);
        return () => window.clearTimeout(timer);
    }, [phase]);

    const joyrideLocale = useMemo(() => ({
        back: t('tour.locale.back'),
        close: t('tour.locale.close'),
        last: t('tour.locale.last'),
        next: t('tour.locale.next'),
        skip: t('tour.locale.skip'),
    }), [t, i18n.language]);

    // ── Render ──

    if (phase === 'done') return null;

    if (phase === 'language') {
        return <LanguageSelector onSelect={handleLanguageSelected} />;
    }

    if (phase === 'farewell') {
        return (
            <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 px-10 py-8 text-center max-w-sm mx-4 animate-[fadeIn_0.3s_ease-out]">
                    <div className="text-4xl mb-4">🎉</div>
                    <p className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                        {t('tour.farewell')}
                    </p>
                </div>
            </div>
        );
    }

    const activeSteps = phase === 'dashboard' ? dashboardSteps : phase === 'editor' ? editorSteps : [];

    if (activeSteps.length === 0) return null;

    return (
        <Joyride
            callback={handleJoyrideCallback}
            continuous
            disableOverlayClose
            run={runJoyride}
            scrollToFirstStep
            showSkipButton
            steps={activeSteps}
            styles={{
                options: {
                    zIndex: 10000,
                    primaryColor: '#2563eb',
                },
            }}
            locale={joyrideLocale}
        />
    );
}
