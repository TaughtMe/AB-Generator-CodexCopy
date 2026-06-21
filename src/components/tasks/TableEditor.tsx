import { useCallback, useEffect, useRef, useState } from 'react';
import { type Editor } from '@tiptap/react';
import { getColumnPercents, setColumnPercents, redistribute } from '../editor/tableColumnResize';
import { Plus } from 'lucide-react';
import { useWorksheetStore } from '../../store/worksheetStore';
import type { TableTask } from '../../types/worksheet';
import { RichTextEditor } from '../editor/RichTextEditor';
import { VocabularyList } from '../editor/shared/VocabularyList';
import { ICON_SIZES } from '../ui/iconSizes';

function containsTableMarkup(html: string): boolean {
    return /<table[\s>]/i.test(html);
}

interface TableEditorProps {
    task: TableTask;
    isActive?: boolean;
}

export function TableEditor({ task, isActive = true }: TableEditorProps) {
    const updateTask = useWorksheetStore((state) => state.updateTask);
    const [editor, setEditor] = useState<Editor | null>(null);
    const didAutoInitRef = useRef(false);

    useEffect(() => {
        if (!editor) return;
        if (didAutoInitRef.current) return;

        const hasTableInDom = editor.view.dom.querySelector('table') !== null;
        const hasTableInContent = containsTableMarkup(task.content);
        const hasExistingTable = hasTableInDom || hasTableInContent || editor.isActive('table');
        const isEditorEmpty = editor.getText().trim().length === 0;

        if (!hasExistingTable && isEditorEmpty) {
            editor.chain().focus().insertTable({
                rows: 3,
                cols: 3,
                withHeaderRow: true,
            }).run();
        }

        didAutoInitRef.current = true;
    }, [editor, task.content]);

    const handleAddRowAfter = () => {
        if (!editor) return;
        editor.chain().focus().addRowAfter().run();
    };

    const handleAddColumnAfter = () => {
        if (!editor) return;
        editor.chain().focus().addColumnAfter().run();
    };

    const canMutateTable = Boolean(editor && editor.isActive('table'));

    /* ── Eigene, gut greifbare Spalten-Resize-Griffe (Word-Verhalten) ──────────
       Liegen als Overlay über den Spaltengrenzen. Beim Ziehen ändern sich nur
       die beiden angrenzenden Spalten (redistribute), die Tabelle bleibt 100 %.
       Die Breiten werden per ProseMirror-Transaktion (colwidth) gesetzt und von
       FitTableView als Prozent gerendert – kein externer DOM-Eingriff. */
    const resizeContainerRef = useRef<HTMLDivElement>(null);
    const [columnHandles, setColumnHandles] = useState<
        Array<{ index: number; left: number; top: number; height: number }>
    >([]);

    const recomputeHandles = useCallback(() => {
        const container = resizeContainerRef.current;
        if (!editor || !isActive || !container) { setColumnHandles([]); return; }
        const tableEl = editor.view.dom.querySelector('table');
        const firstRow = tableEl?.querySelector('tr');
        if (!tableEl || !firstRow) { setColumnHandles([]); return; }
        const cells = Array.from(firstRow.children);
        if (cells.length < 2) { setColumnHandles([]); return; }
        const contRect = container.getBoundingClientRect();
        const tableRect = tableEl.getBoundingClientRect();
        const next: Array<{ index: number; left: number; top: number; height: number }> = [];
        for (let i = 0; i < cells.length - 1; i += 1) {
            const rect = cells[i].getBoundingClientRect();
            next.push({
                index: i,
                left: rect.right - contRect.left,
                top: tableRect.top - contRect.top,
                height: tableRect.height,
            });
        }
        setColumnHandles(next);
    }, [editor, isActive]);

    useEffect(() => {
        recomputeHandles();
        if (!editor || !isActive) return;
        const tableEl = editor.view.dom.querySelector('table');
        const observer = new ResizeObserver(() => recomputeHandles());
        if (tableEl) observer.observe(tableEl);
        editor.on('update', recomputeHandles);
        editor.on('selectionUpdate', recomputeHandles);
        window.addEventListener('resize', recomputeHandles);
        return () => {
            observer.disconnect();
            editor.off('update', recomputeHandles);
            editor.off('selectionUpdate', recomputeHandles);
            window.removeEventListener('resize', recomputeHandles);
        };
    }, [editor, isActive, recomputeHandles]);

    // DEV-Hilfe für manuelle Verifikation in der Konsole.
    useEffect(() => {
        if (!import.meta.env.DEV || !editor) return;
        (window as unknown as Record<string, unknown>).__tableEditor = editor;
        (window as unknown as Record<string, unknown>).__tableResize = {
            getColumnPercents, setColumnPercents, redistribute,
        };
    }, [editor]);

    const handleColumnDragStart = (event: React.PointerEvent, index: number) => {
        if (!editor) return;
        event.preventDefault();
        event.stopPropagation();
        const tableEl = editor.view.dom.querySelector('table');
        if (!tableEl) return;
        const tableWidth = tableEl.getBoundingClientRect().width || 1;
        const startX = event.clientX;
        const startPercents = getColumnPercents(editor);
        let lastPercents = startPercents;

        const onMove = (moveEvent: PointerEvent) => {
            const deltaPercent = ((moveEvent.clientX - startX) / tableWidth) * 100;
            lastPercents = redistribute(startPercents, index, deltaPercent);
            setColumnPercents(editor, lastPercents, false); // Zwischenschritte ohne Undo-Eintrag
        };
        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            setColumnPercents(editor, lastPercents, true); // finaler Stand = ein Undo-Eintrag
            recomputeHandles();
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    };

    return (
        <div className="w-full flex flex-col gap-2">

            <div className="relative" ref={resizeContainerRef}>
                <div className="flex flex-row items-center gap-2">
                    <RichTextEditor
                        value={task.content}
                        onChange={(html) => updateTask(task.id, { content: html })}
                        onEditorReady={setEditor}
                        placeholder="Tabelleninhalt eingeben…"
                        minRows={4}
                        // min-w-0: Sicherheitsnetz, falls eine Tabelle doch breiter würde
                        // als der Container (mit FitTableView bleibt sie i.d.R. auf 100 %).
                        className="flex-1 min-w-0"
                        hideToolbar={!isActive}
                        taskId={task.id}
                    />

                    {isActive && (
                        <button
                            type="button"
                            onClick={handleAddColumnAfter}
                            title="Spalte hinzufügen"
                            aria-label="Spalte hinzufügen"
                            disabled={!canMutateTable}
                            className="no-print flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Plus className={ICON_SIZES[14]} />
                        </button>
                    )}
                </div>

                {isActive && columnHandles.map((handle) => (
                    <div
                        key={handle.index}
                        onPointerDown={(event) => handleColumnDragStart(event, handle.index)}
                        className="no-print absolute z-20 flex justify-center cursor-col-resize group/handle"
                        style={{ left: handle.left - 7, top: handle.top, height: handle.height, width: 14 }}
                        title="Spaltenbreite ziehen"
                    >
                        <div className="h-full w-[2px] bg-blue-400/40 group-hover/handle:bg-blue-500 transition-colors" />
                    </div>
                ))}
            </div>

            {isActive && (
                <div className="no-print flex justify-center">
                    <button
                        type="button"
                        onClick={handleAddRowAfter}
                        title="Zeile hinzufügen"
                        aria-label="Zeile hinzufügen"
                        disabled={!canMutateTable}
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Plus className={ICON_SIZES[14]} />
                    </button>
                </div>
            )}

            <VocabularyList vocabulary={task.vocabulary} taskId={task.id} />
        </div>
    );
}
