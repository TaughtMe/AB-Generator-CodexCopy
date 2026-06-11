import type { Task } from '../types/worksheet';
import { useWorksheetStore } from '../store/worksheetStore';

/* ══════════════════════════════════════════════════
   exampleWorksheet – Referenz-Arbeitsblatt für Export-Regressionstests.

   Enthält alle 11 Tasktypen in repräsentativer Ausprägung (inkl.
   Rich-Text-Formatierung, Lücken, LaTeX, Tabelle mit Kopfzeile,
   Spaltenlayout mit Kindern, Seitenumbruch).

   Verwendung (nur DEV):
     window.__loadExampleWorksheet()   → lädt das Fixture in den Editor
   Danach manuell PDF/DOCX exportieren und gegen den Editor vergleichen.

   IDs sind stabil (fx-*) damit Export-Diffs deterministisch sind.
   ══════════════════════════════════════════════════ */

const base = { vocabulary: [] as Task['vocabulary'] };

export const EXAMPLE_TASKS_BY_ID: Record<string, Task> = {
    'fx-heading': {
        ...base,
        id: 'fx-heading',
        type: 'heading',
        title: 'Abschnitt A',
        text: 'Teil 1: Grundlagen',
        showNumber: false,
    },
    'fx-information': {
        ...base,
        id: 'fx-information',
        type: 'information',
        title: 'Einführungstext',
        content:
            '<p>Die <strong>Photosynthese</strong> wandelt Lichtenergie in chemische Energie um. '
            + 'Dabei entstehen <em>Glukose</em> und Sauerstoff.</p>',
        hasNotesColumn: false,
        textWidthRatio: 100,
        highlightVocabulary: false,
        showNumber: false,
    },
    'fx-instruction': {
        ...base,
        id: 'fx-instruction',
        type: 'instruction',
        title: 'Erkläre den Vorgang',
        text:
            '<p>Erkläre die Photosynthese <strong>in eigenen Worten</strong>. Gehe dabei ein auf:</p>'
            + '<ul><li>Ausgangsstoffe</li><li>Produkte</li><li>Bedeutung für <em>Lebewesen</em></li></ul>',
        linesAfter: 4,
        linesAfterStyle: 'lines-8mm',
    },
    'fx-mc': {
        ...base,
        id: 'fx-mc',
        type: 'multiple-choice',
        title: 'Wissensfrage',
        question: '<p>Welches Gas wird bei der Photosynthese <strong>freigesetzt</strong>?</p>',
        options: [
            { id: 'fx-mc-o1', text: 'Kohlenstoffdioxid', isCorrect: false },
            { id: 'fx-mc-o2', text: 'Sauerstoff', isCorrect: true },
            { id: 'fx-mc-o3', text: 'Stickstoff', isCorrect: false },
        ],
    },
    'fx-cloze': {
        ...base,
        id: 'fx-cloze',
        type: 'cloze',
        title: 'Lückentext',
        content: '<p>Pflanzen nehmen [Kohlenstoffdioxid] auf und geben [Sauerstoff] ab. Die Energie liefert das [Sonnenlicht].</p>',
        gapStyle: 'continuous',
        gapMultiplier: 1.5,
        wordBankMode: 'mixed',
        distractors: 'Wasserstoff',
    },
    'fx-math': {
        ...base,
        id: 'fx-math',
        type: 'math',
        title: 'Reaktionsgleichung',
        content: '6 CO_2 + 6 H_2O \\rightarrow C_6H_{12}O_6 + 6 O_2',
    },
    'fx-table': {
        ...base,
        id: 'fx-table',
        type: 'table',
        title: 'Vergleichstabelle',
        rows: 3,
        cols: 3,
        content:
            '<table><tr><th>Stoff</th><th>Edukt</th><th>Produkt</th></tr>'
            + '<tr><td>CO₂</td><td style="text-align:center">✓</td><td></td></tr>'
            + '<tr><td>O₂</td><td></td><td style="text-align:center">✓</td></tr></table>',
    },
    'fx-image': {
        ...base,
        id: 'fx-image',
        type: 'image-placeholder',
        title: 'Skizze',
        caption: 'Zeichne ein Blatt mit Stoffflüssen.',
        widthMm: 80,
        heightMm: 50,
        imageAlign: 'center',
    },
    'fx-pagebreak': {
        ...base,
        id: 'fx-pagebreak',
        type: 'page-break',
        title: 'Seitenumbruch',
        showNumber: false,
    },
    'fx-lineatur': {
        ...base,
        id: 'fx-lineatur',
        type: 'lineatur',
        title: 'Notizen',
        promptHtml: '<p>Notiere deine Beobachtungen:</p>',
        gridColumns: 1,
        lineStyle: 'lines-8mm',
        lineRows: 5,
        rowCount: 5,
    },
    /* columns-Kinder: leben in tasksById, aber NICHT in der Root-taskIds-Liste */
    'fx-col-left': {
        ...base,
        id: 'fx-col-left',
        type: 'instruction',
        title: 'Linke Spalte',
        text: '<p>Vorteile notieren:</p>',
    },
    'fx-col-right': {
        ...base,
        id: 'fx-col-right',
        type: 'lineatur',
        title: 'Rechte Spalte',
        promptHtml: '',
        gridColumns: 1,
        lineStyle: 'grid-5mm',
        lineRows: 3,
        rowCount: 3,
    },
    'fx-columns': {
        ...base,
        id: 'fx-columns',
        type: 'columns',
        title: 'Pro/Contra',
        layout: '50-50',
        gapMm: 6,
        children: ['fx-col-left', 'fx-col-right'],
    },
};

/** Root-Reihenfolge — columns-Kinder sind bewusst nicht enthalten. */
export const EXAMPLE_TASK_IDS: string[] = [
    'fx-heading',
    'fx-information',
    'fx-instruction',
    'fx-mc',
    'fx-cloze',
    'fx-math',
    'fx-table',
    'fx-image',
    'fx-pagebreak',
    'fx-lineatur',
    'fx-columns',
];

export const EXAMPLE_WORKSHEET_TITLE = 'Referenz-Arbeitsblatt (alle Tasktypen)';

/** Lädt das Fixture in den Editor-Store (überschreibt das aktuelle Blatt!). */
export function loadExampleWorksheet(): void {
    useWorksheetStore.getState().loadFromRecord(
        'fx-worksheet',
        EXAMPLE_WORKSHEET_TITLE,
        structuredClone(EXAMPLE_TASKS_BY_ID),
        [...EXAMPLE_TASK_IDS],
        [],
        [],
        undefined,
        undefined,
        undefined,
    );
}
