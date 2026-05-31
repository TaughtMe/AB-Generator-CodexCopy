import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWorksheetStore } from '../../store/worksheetStore';
import { useSettingsStore } from '../../store/settingsStore';
import { WorksheetHeader } from '../layout/WorksheetHeader';
import { TaskEditorRenderer } from '../tasks/TaskRegistry';
import type { Task } from '../../types/worksheet';

/* ══════════════════════════════════════════════════
   PrintWorksheet – Saubere, druckbare Ansicht des Arbeitsblatts.

   Architektur (WYSIWYG ohne Drift):
   - Rendert über ein Portal in ein eigenes #print-root (Geschwister von #root).
   - Verwendet bewusst dieselben Task-Komponenten wie der Editor
     (TaskEditorRenderer mit isActive={false}) → eine einzige Render-Quelle,
     die nicht auseinanderlaufen kann.
   - @media print blendet #root aus und zeigt nur #print-root. Editor-Chrome
     (Toolbars, Drag-Griffe, Buttons) verschwindet durch isActive={false} und
     die bestehenden no-print/print:-Regeln.
   - page-break-Tasks sind reine Layout-Organisation und erzeugen echte
     Seitenumbrüche, ohne selbst sichtbaren Inhalt zu sein.
   ══════════════════════════════════════════════════ */

const TASK_TYPE_LABELS: Record<Task['type'], string> = {
    'instruction': 'AUFGABE',
    'heading': 'ÜBERSCHRIFT',
    'multiple-choice': 'MULTIPLE CHOICE',
    'cloze': 'LÜCKENTEXT',
    'math': 'MATHEMATIK',
    'table': 'TABELLE',
    'lineatur': 'LINEATUR',
    'columns': 'ZWEISPALTIG',
    'page-break': 'SEITENUMBRUCH',
    'image-placeholder': 'BILD',
    'information': 'INFORMATION',
};

/** Erstellt (einmalig) den Portal-Container als Geschwister von #root. */
function usePrintRootContainer(): HTMLElement | null {
    const [container, setContainer] = useState<HTMLElement | null>(null);

    useEffect(() => {
        let el = document.getElementById('print-root');
        let created = false;
        if (!el) {
            el = document.createElement('div');
            el.id = 'print-root';
            document.body.appendChild(el);
            created = true;
        }
        // Bulletproof: hidden on screen via inline style. The @media print rule
        // `#print-root { display: block !important }` overrides this only while
        // printing (an !important stylesheet rule beats a normal inline style).
        el.style.display = 'none';
        setContainer(el);
        return () => {
            if (created && el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        };
    }, []);

    return container;
}

export function PrintWorksheet() {
    const container = usePrintRootContainer();
    const taskIds = useWorksheetStore((s) => s.taskIds);
    const tasksById = useWorksheetStore((s) => s.tasksById);
    const fontFamily = useSettingsStore((s) => s.fontFamily);
    const brandColor = useSettingsStore((s) => s.brandColor);
    const applyColorToTasks = useSettingsStore((s) => s.applyColorToTasks);

    /* Sichtbare Aufgabennummerierung – identisch zur Logik im WorksheetCanvas. */
    const taskNumberMap = useMemo(() => {
        const map: Record<string, number | null> = {};
        let counter = 0;
        for (const id of taskIds) {
            const task = tasksById[id];
            if (!task || task.type === 'page-break') continue;
            if (task.showNumber === false) {
                map[id] = null;
            } else {
                counter += 1;
                map[id] = counter;
            }
        }
        return map;
    }, [taskIds, tasksById]);

    if (!container) return null;

    return createPortal(
        <div className="print-sheet" style={{ fontFamily }}>
            <WorksheetHeader />

            {taskIds.map((id) => {
                const task = tasksById[id];
                if (!task) return null;

                if (task.type === 'page-break') {
                    return <div key={id} className="print-page-break" aria-hidden="true" />;
                }

                const number = taskNumberMap[id] ?? null;
                const accent = task.accentColor || (applyColorToTasks ? brandColor : undefined);
                const typeLabel = TASK_TYPE_LABELS[task.type] ?? task.type.toUpperCase();
                const hasTitleSuffix =
                    Boolean(task.title) && task.type !== 'heading';

                return (
                    <div
                        key={id}
                        className="print-task"
                        style={{ ['--task-accent-color' as string]: accent || '#1e293b' }}
                    >
                        <div className="print-task__header">
                            {number !== null && (
                                <span className="print-task__num" style={{ color: accent || undefined }}>
                                    {number}.
                                </span>
                            )}
                            <span className="print-task__type">{typeLabel}</span>
                            {hasTitleSuffix && (
                                <span className="print-task__title"> — {task.title}</span>
                            )}
                        </div>
                        <div className="print-task__body">
                            <TaskEditorRenderer task={task} isActive={false} />
                        </div>
                    </div>
                );
            })}
        </div>,
        container,
    );
}
