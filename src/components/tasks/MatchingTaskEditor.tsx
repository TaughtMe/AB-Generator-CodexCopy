import React from 'react';
import type { MatchingTask, MatchingPair } from '../../types/worksheet';
import { useWorksheetStore } from '../../store/worksheetStore';
import { Plus, Trash2, Shuffle } from 'lucide-react';
import { ICON_SIZES } from '../ui/iconSizes';
import { VocabularyList } from '../editor/shared/VocabularyList';

interface MatchingTaskEditorProps {
    task: MatchingTask;
    isActive?: boolean;
}

const letter = (index: number) => String.fromCharCode(97 + index);

/* ══════════════════════════════════════════════════
   MatchingTaskEditor – Zuordnungsaufgabe ("Verbinde die passenden Begriffe").

   - Edit-Modus (isActive): zeigt die Paare bewusst ausgerichtet
     (links ↔ rechts), damit die Lehrkraft sieht, was zusammengehoert.
     "Rechte Seite mischen" wuerfelt die Anzeige-Reihenfolge (rightOrder).
   - Schueleransicht (isActive=false / Druck): KEINE Eingabefelder.
     Links die Begriffe in Reihenfolge (a, b, c …), rechts die gemischten
     Begriffe (rightOrder) mit grossem Abstand und genug vertikalem Raum –
     die Lernenden ziehen die Verbindungslinien selbst.
   - Lehrerfassung: Loesungsbuchstabe vor dem rechten Begriff
     (".matching-solution-letter", nur unter data-export-variant="teacher").
   ══════════════════════════════════════════════════ */
export const MatchingTaskEditor: React.FC<MatchingTaskEditorProps> = ({ task, isActive = true }) => {
    const updateTask = useWorksheetStore((s) => s.updateTask);

    const pairs = task.pairs;

    const updatePair = (pairId: string, updates: Partial<Omit<MatchingPair, 'id'>>) => {
        updateTask(task.id, {
            pairs: pairs.map((pair) => (pair.id === pairId ? { ...pair, ...updates } : pair)),
        });
    };

    const addPair = () => {
        const id = crypto.randomUUID();
        updateTask(task.id, {
            pairs: [...pairs, { id, left: '', right: '' }],
            rightOrder: [...task.rightOrder, id],
        });
    };

    const removePair = (pairId: string) => {
        updateTask(task.id, {
            pairs: pairs.filter((pair) => pair.id !== pairId),
            rightOrder: task.rightOrder.filter((id) => id !== pairId),
        });
    };

    const shuffleRight = () => {
        const ids = pairs.map((pair) => pair.id);
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        updateTask(task.id, { rightOrder: ids });
    };

    /* Schueler-/Druckansicht: rechte Spalte in rightOrder-Reihenfolge. */
    const rightColumn = task.rightOrder
        .map((id) => pairs.find((pair) => pair.id === id))
        .filter((pair): pair is MatchingPair => Boolean(pair));

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
                            placeholder="z. B. Verbinde die passenden Begriffe."
                            className="w-full text-sm text-worksheet-ink bg-worksheet-field border border-worksheet-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-blue-500 no-print"
                        />
                    </>
                ) : (
                    task.prompt.trim() && <p className="text-sm text-worksheet-ink mb-3">{task.prompt}</p>
                )}
            </div>

            {isActive ? (
                /* ── Edit-Modus: ausgerichtete Paare (links ↔ rechts) ── */
                <div className="no-print">
                    <div className="flex items-center gap-2 mb-2 text-xs font-medium text-worksheet-inkLight uppercase tracking-wider">
                        <span className="flex-1">Linke Seite</span>
                        <span className="w-5" />
                        <span className="flex-1">Rechte Seite</span>
                        <span className="w-7" />
                    </div>
                    <div className="space-y-2">
                        {pairs.map((pair, index) => (
                            <div key={pair.id} className="flex items-center gap-2 group/pair">
                                <span className="shrink-0 w-5 text-sm font-semibold text-worksheet-inkLight">
                                    {letter(index)})
                                </span>
                                <input
                                    value={pair.left}
                                    onChange={(e) => updatePair(pair.id, { left: e.target.value })}
                                    placeholder="Linker Begriff"
                                    className="flex-1 min-w-0 text-sm text-worksheet-ink bg-worksheet-field border border-worksheet-border rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-blue-500"
                                />
                                <span className="shrink-0 w-5 text-center text-worksheet-inkLight/60" aria-hidden="true">↔</span>
                                <input
                                    value={pair.right}
                                    onChange={(e) => updatePair(pair.id, { right: e.target.value })}
                                    placeholder="Rechter Begriff"
                                    className="flex-1 min-w-0 text-sm text-worksheet-ink bg-worksheet-field border border-worksheet-border rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-blue-500"
                                />
                                <button
                                    onClick={() => removePair(pair.id)}
                                    disabled={pairs.length <= 2}
                                    className="shrink-0 p-1.5 text-worksheet-inkLight/60 hover:text-red-500 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover/pair:opacity-100"
                                    title="Paar entfernen"
                                >
                                    <Trash2 className={ICON_SIZES[14]} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-4 mt-3">
                        <button
                            onClick={addPair}
                            className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors cursor-pointer"
                        >
                            <Plus className={ICON_SIZES[16]} /> Paar hinzufügen
                        </button>
                        <button
                            onClick={shuffleRight}
                            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors cursor-pointer"
                            title="Reihenfolge der rechten Spalte für die Schülerfassung neu mischen"
                        >
                            <Shuffle className={ICON_SIZES[14]} /> Rechte Seite mischen
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-worksheet-inkLight/70">
                        In der Schülerfassung steht die rechte Seite gemischt – die Lernenden ziehen die Verbindungslinien selbst.
                    </p>
                </div>
            ) : (
                /* ── Schüler-/Druckansicht: keine Boxen, große Lücke, viel Zeilenraum ── */
                <div className="space-y-3">
                    {pairs.map((pair, index) => {
                        const rightPair = rightColumn[index] ?? pair;
                        const solutionLetter = letter(pairs.findIndex((candidate) => candidate.id === rightPair.id));
                        return (
                            <div
                                key={pair.id}
                                className="flex items-start justify-between gap-x-10 sm:gap-x-16 break-inside-avoid min-h-[2.25rem]"
                            >
                                <div className="flex-1 text-sm text-worksheet-ink leading-relaxed">
                                    <span className="font-semibold">{letter(index)}) </span>
                                    {pair.left}
                                </div>
                                <div className="flex-1 text-sm text-worksheet-ink leading-relaxed">
                                    {/* Lösungsbuchstabe: nur Lehrerfassung (Druck). */}
                                    <span className="matching-solution-letter hidden font-semibold">({solutionLetter}) </span>
                                    {rightPair.right}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <VocabularyList vocabulary={task.vocabulary} taskId={task.id} />
        </div>
    );
};
