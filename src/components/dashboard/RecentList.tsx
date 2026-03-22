import { FileText } from 'lucide-react';
import type { WorksheetMeta } from '../../store/dexieStore';

interface RecentListProps {
  items: WorksheetMeta[];
  subjectNameById: Record<string, string>;
  classNameById: Record<string, string>;
  sortLabel: string;
  onOpenWorksheet?: (id: string) => void;
}

const tableHeaders = [
  'Titel',
  'Erstellt',
  'Fach',
  'Klasse',
  'Sortierung',
  'Variationen',
] as const;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function RecentList({
  items,
  subjectNameById,
  classNameById,
  sortLabel,
  onOpenWorksheet,
}: RecentListProps) {
  const rows = items.slice(0, 6);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-4xl font-semibold text-white">Zuletzt erstellt</h2>
        <button
          type="button"
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
        >
          Weitere anzeigen &gt;
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-slate-700/60 bg-slate-800/70 text-left text-xs uppercase tracking-wide text-slate-300">
              {tableHeaders.map((header, index) => (
                <th
                  key={header}
                  className={`px-4 py-3 font-medium ${
                    index === 0 ? 'w-[30%]' : 'w-[14%]'
                  }`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                  Noch keine gespeicherten Arbeitsblätter vorhanden.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenWorksheet?.(row.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onOpenWorksheet?.(row.id);
                    }
                  }}
                  className="border-b border-slate-700/40 text-sm text-slate-200 transition hover:bg-slate-700/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700 text-slate-200">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="font-medium text-slate-100">{row.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {row.subjectId ? (subjectNameById[row.subjectId] ?? '—') : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {row.classId ? (classNameById[row.classId] ?? '—') : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{sortLabel}</td>
                  <td className="px-4 py-3 text-slate-300">{row.variantCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
