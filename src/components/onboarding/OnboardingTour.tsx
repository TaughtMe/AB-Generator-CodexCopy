import { useEffect, useState } from 'react';
import Joyride, {
    ACTIONS,
    EVENTS,
    STATUS,
    type CallBackProps,
    type Step,
} from 'react-joyride';

interface OnboardingTourProps {
    run: boolean;
    onComplete: () => void;
}

const ONBOARDING_STEPS: Step[] = [
    {
        target: '[data-tour="sidebar-nav"]',
        title: 'Navigation',
        content: 'Hier wechselst du zwischen Dashboard, Klassen/Fächern und den globalen Einstellungen.',
        placement: 'right',
        disableBeacon: true,
    },
    {
        target: '[data-tour="dashboard-new-worksheet"]',
        title: 'Neues Arbeitsblatt',
        content: 'Starte hier schnell ein neues Blatt. Das ist der häufigste Einstieg.',
        placement: 'bottom',
        disableBeacon: true,
    },
    {
        target: '[data-tour="dashboard-ai-assistant"]',
        title: 'KI-Assistent',
        content: 'Öffnet den KI-Chat für Vorschläge und schnelle Erstellung von Aufgaben.',
        placement: 'bottom',
        disableBeacon: true,
    },
    {
        target: '[data-tour="dashboard-templates"]',
        title: 'Vorlagen',
        content: 'Durchsuche Vorlagen, um mit einer bestehenden Struktur zu starten.',
        placement: 'bottom',
        disableBeacon: true,
    },
    {
        target: '[data-tour="dashboard-settings"]',
        title: 'Einstellungen',
        content: 'Hier findest du globale Optionen. Dort kannst du diese Tour später erneut starten.',
        placement: 'left',
        disableBeacon: true,
    },
];

export function OnboardingTour({ run, onComplete }: OnboardingTourProps) {
    const [stepIndex, setStepIndex] = useState(0);

    useEffect(() => {
        if (run) setStepIndex(0);
    }, [run]);

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { action, index, status, type } = data;

        if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            onComplete();
            return;
        }

        if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
            setStepIndex((current) => {
                const next = index + (action === ACTIONS.PREV ? -1 : 1);
                return Number.isFinite(next) ? Math.max(0, next) : current;
            });
        }
    };

    return (
        <Joyride
            callback={handleJoyrideCallback}
            continuous
            disableOverlayClose
            run={run}
            scrollToFirstStep
            showProgress
            showSkipButton
            stepIndex={stepIndex}
            steps={ONBOARDING_STEPS}
            styles={{
                options: {
                    zIndex: 80,
                    primaryColor: '#2563eb',
                },
            }}
            locale={{
                back: 'Zurück',
                close: 'Schließen',
                last: 'Fertig',
                next: 'Weiter',
                skip: 'Überspringen',
            }}
        />
    );
}

export default OnboardingTour;
