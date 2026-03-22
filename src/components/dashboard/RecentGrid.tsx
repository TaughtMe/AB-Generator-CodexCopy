import { FileText } from 'lucide-react';
import type { WorksheetMeta } from '../../store/dexieStore';

interface RecentGridProps {
  items: WorksheetMeta[];
  onOpenWorksheet?: (id: string) => void;
}

function formatUpdatedLabel(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Gestern';

  return `vor ${days} Tagen`;
}

export function RecentGrid({ items, onOpenWorksheet }: RecentGridProps) {
  const cards = items.slice(0, 4);
  const emptySlots = Math.max(0, 4 - cards.length);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-4xl font-semibold text-white">Zuletzt bearbeitet</h2>
        <button
          type="button"
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
        >
          Weitere anzeigen &gt;
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {cards.map((item) => (
          <article
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpenWorksheet?.(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenWorksheet?.(item.id);
              }
            }}
            className="overflow-hidden rounded-xl bg-slate-800 shadow-sm ring-1 ring-slate-700/60 transition hover:-translate-y-0.5 hover:ring-slate-500/80"
          >
            {item.thumbnailUrl ? (
              <div className="aspect-video bg-slate-700">
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="h-full w-full object-cover object-top"
                  draggable={false}
                />
              </div>
            ) : (
              <div className="aspect-video bg-slate-700 p-3">
                <div className="h-full rounded-lg border border-slate-600/70 bg-slate-600/30 p-3">
                  <div className="mb-2 h-2 w-1/2 rounded bg-slate-400/60" />
                  <div className="mb-2 h-2 w-3/4 rounded bg-slate-500/60" />
                  <div className="h-2 w-2/3 rounded bg-slate-500/60" />
                </div>
              </div>
            )}

            <div className="space-y-2 p-4">
              <h3 className="text-base font-semibold text-white">{item.title}</h3>
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>{formatUpdatedLabel(item.updatedAt)}</span>
                <span>{item.taskCount} Aufgaben</span>
              </div>
            </div>
          </article>
        ))}

        {Array.from({ length: emptySlots }).map((_, index) => (
          <article
            key={`empty-slot-${index}`}
            className="overflow-hidden rounded-xl border border-dashed border-slate-700/70 bg-slate-800/40"
          >
            <div className="aspect-video flex items-center justify-center bg-slate-800/30">
              <FileText className="h-8 w-8 text-slate-500" />
            </div>
            <div className="space-y-2 p-4">
              <h3 className="text-base font-semibold text-slate-400">Noch kein Arbeitsblatt</h3>
              <div className="text-sm text-slate-500">Sobald du speicherst, erscheint es hier.</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
