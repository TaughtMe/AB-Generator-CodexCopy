import React from 'react';
import type { OrderingTask, OrderingItem } from '../../types/worksheet';
import { useWorksheetStore } from '../../store/worksheetStore';
import { Plus, Trash2 } from 'lucide-react';
import { ICON_SIZES } from '../ui/iconSizes';
import { VocabularyList } from '../editor/shared/VocabularyList';

interface OrderingTaskEditorProps {
    task: OrderingTask;
    isActive?: boolean;
}

/* ══════════════════════════════════════════════════
   OrderingTaskEditor – Nummerierungs-/Reihenfolgeaufgabe.

   - Edit-Modus (isActive): Prompt bearbeiten, Items hinzufügen/löschen,
     korrekte Position je Item setzen.
   - Schüleransicht (isActive=false / Druck): leere Nummernfelder vor
     jedem Element. Die korrekte Reihenfolge (correctPosition) bleibt der
     Lehrerfassung vorbehalten (Export Commit 3).
   ══════════════════════════════════════════════════ */
export const OrderingTaskEditor: React.FC<OrderingTaskEditorProps> = ({ task, isActive = true }) => {
    const updateTask = useWorksheetStore((s) => s.updateTask);

    const patchItems = (items: OrderingItem[]) => {
        updateTask(task.id, { items });
    };

    const updateItemText = (itemId: string, text: string) => {
        patchItems(task.items.map((item) => (item.id === itemId ? { ...item, text } : item)));
    };

    const updateItemPosition = (itemId: string, rawValue: string) => {
        const parsed = Number.parseInt(rawValue, 10);
        if (!Number.isFinite(parsed)) return;
        const clamped = Math.max(1, Math.min(task.items.length, parsed));
        patchItems(task.items.map((item) => (item.id === itemId ? { ...item, correctPosition: clamped } : item)));
    };

    const removeItem = (itemId: string) => {
        patchItems(task.items.filter((item) => item.id !== itemId));
    };

    const addItem = () => {
        patchItems([
            ...task.items,
            { id: crypto.randomUUID(), text: '', correctPosition: task.items.length + 1 },
        ]);
    };

    return (
        <div className="space-y-4">
            {/* Aufgabenstellung */}
            <div>
                {isActive ? (
                    <>
                        <label className="block text-xs font-medium text-worksheet-inkLight mb-1.5 uppercase tracking-wider no-print">
                            Aufgabenstellung
                        </label>
                        <input
                            value={task.prompt}
                            onChange={(e) => updateTask(task.id, { prompt: e.target.value })}
                            placeholder="z. B. Bringe die Schritte in die richtige Reihenfolge."
                            className="w-full text-sm text-worksheet-ink bg-worksheet-field border border-worksheet-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-blue-500 no-print"
                        />
                        {/* Druck/WYSIWYG: Prompt als Text */}
                        {task.prompt.trim() && (
                            <p className="hidden print:block text-sm text-black">{task.prompt}</p>
                        )}
                    </>
                ) : (
                    task.prompt.trim() && <p className="text-sm text-worksheet-ink">{task.prompt}</p>
                )}
            </div>

            {/* Elemente */}
            <div>
                {isActive && (
                    <label className="block text-xs font-medium text-worksheet-inkLight mb-2 uppercase tracking-wider no-print">
                        Elemente <span className="normal-case text-worksheet-inkLight/70">(Zahl = korrekte Position)</span>
                    </label>
                )}
                <div className="space-y-2">
                    {task.items.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center gap-2 group/item rounded-lg border border-worksheet-border bg-worksheet-field px-3 py-1.5 transition-colors focus-within:ring-2 focus-within:ring-blue-500/35 focus-within:border-blue-500"
                        >
                            {/* Nummernfeld: Schüler leer, Editor = korrekte Position setzen */}
                            {isActive ? (
                                <input
                                    type="number"
                                    min={1}
                                    max={task.items.length}
                                    value={item.correctPosition}
                                    onChange={(e) => updateItemPosition(item.id, e.target.value)}
                                    className="shrink-0 w-10 h-9 text-center text-sm font-semibold text-worksheet-ink border-2 border-worksheet-border rounded-md outline-none focus:border-blue-500 no-print"
                                    title="Korrekte Position"
                                />
                            ) : (
                                <span className="shrink-0 w-9 h-9 border-2 border-worksheet-border rounded-md" aria-hidden="true" />
                            )}

                            {/* Element-Text */}
                            <input
                                value={item.text}
                                onChange={(e) => updateItemText(item.id, e.target.value)}
                                readOnly={!isActive}
                                placeholder="Element eingeben…"
                                className="flex-1 min-w-0 text-sm text-worksheet-ink bg-transparent border-0 outline-none px-1 py-1 read-only:cursor-default"
                            />

                            {/* Löschen */}
                            {isActive && (
                                <button
                                    onClick={() => removeItem(item.id)}
                                    disabled={task.items.length <= 2}
                                    className="shrink-0 p-1.5 text-worksheet-inkLight/60 hover:text-red-500 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover/item:opacity-100 no-print"
                                    title="Element entfernen"
                                >
                                    <Trash2 className={ICON_SIZES[14]} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Element hinzufügen */}
            {isActive && (
                <button
                    onClick={addItem}
                    className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors cursor-pointer no-print"
                >
                    <Plus className={ICON_SIZES[16]} /> Element hinzufügen
                </button>
            )}

            <VocabularyList vocabulary={task.vocabulary} taskId={task.id} />
        </div>
    );
};
