import { useEffect, useState, useCallback } from 'react';
import Joyride, { STATUS, type CallBackProps, type Step } from 'react-joyride';

/* ══════════════════════════════════════════════════
   FeatureTour.tsx – Wiederverwendbare Tour-Komponente
   Persistiert den Abschluss jeder Tour via localStorage.
   Startet nur, wenn der jeweilige Key noch nicht existiert.
   ══════════════════════════════════════════════════ */

interface FeatureTourProps {
    tourId: string;
    steps: Step[];
}

export function FeatureTour({ tourId, steps }: FeatureTourProps) {
    const [run, setRun] = useState(false);

    useEffect(() => {
        const key = `tour_completed_${tourId}`;
        if (localStorage.getItem(key) === 'true') return;

        const timer = window.setTimeout(() => setRun(true), 500);
        return () => window.clearTimeout(timer);
    }, [tourId]);

    const handleCallback = useCallback(
        (data: CallBackProps) => {
            const { status } = data;
            if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
                localStorage.setItem(`tour_completed_${tourId}`, 'true');
                setRun(false);
            }
        },
        [tourId],
    );

    if (!run) return null;

    return (
        <Joyride
            callback={handleCallback}
            continuous
            disableOverlayClose
            run={run}
            scrollToFirstStep
            showProgress
            showSkipButton
            steps={steps}
            styles={{
                options: {
                    zIndex: 10000,
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
