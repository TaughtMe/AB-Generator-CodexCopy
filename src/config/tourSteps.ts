import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

/* ══════════════════════════════════════════════════
   tourSteps.ts – Unified Onboarding Tour
   Zwei Phasen: Dashboard → Editor.
   Alle Texte über i18n lokalisiert.
   ══════════════════════════════════════════════════ */

export function getDashboardSteps(t: TFunction): Step[] {
    return [
        {
            target: '.tour-ai-assistant',
            title: t('tour.dashboard.aiAssistant.title'),
            content: t('tour.dashboard.aiAssistant.content'),
            placement: 'bottom',
            disableBeacon: true,
        },
        {
            target: '.tour-cloud-sync',
            title: t('tour.dashboard.cloudSync.title'),
            content: t('tour.dashboard.cloudSync.content'),
            placement: 'right',
            disableBeacon: true,
        },
        {
            target: '.tour-new-worksheet',
            title: t('tour.dashboard.newWorksheet.title'),
            content: t('tour.dashboard.newWorksheet.content'),
            placement: 'bottom',
            disableBeacon: true,
            spotlightClicks: true,
        },
    ];
}

export function getEditorSteps(t: TFunction): Step[] {
    return [
        {
            target: '.tour-add-task',
            title: t('tour.editor.addTask.title'),
            content: t('tour.editor.addTask.content'),
            placement: 'top',
            disableBeacon: true,
        },
        {
            target: '.tour-pdf-export',
            title: t('tour.editor.pdfExport.title'),
            content: t('tour.editor.pdfExport.content'),
            placement: 'bottom',
            disableBeacon: true,
        },
        {
            target: '.tour-home-button',
            title: t('tour.editor.homeButton.title'),
            content: t('tour.editor.homeButton.content'),
            placement: 'bottom',
            disableBeacon: true,
            spotlightClicks: true,
        },
    ];
}
