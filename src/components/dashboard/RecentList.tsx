import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

interface RecentListProps {
  items: unknown[];
  subjectNameById: Record<string, string>;
  classNameById: Record<string, string>;
  sortLabel: string;
  onOpenWorksheet?: (id: string) => void;
}

type SortKey = 'title' | 'date' | 'subject' | 'class' | 'variations';

function formatDate(date: string): string {
  if (!date) return '—';

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function RecentList(props: RecentListProps) {
  const savedFiles = useWorkspaceStore((state) => state.savedFiles);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const variantCountById = useMemo(() => {
    const map = new Map<string, number>();

    props.items.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const record = item as { id?: unknown; variantCount?: unknown };
      if (typeof record.id !== 'string') return;
      const count = typeof record.variantCount === 'number' ? record.variantCount : 1;
      map.set(record.id, Math.max(1, count));
    });

    return map;
  }, [props.items]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDirection('asc');
  };

  const sortedFiles = [...savedFiles]
    .sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortKey) {
        case 'title':
          valA = a.meta.title?.toLowerCase() || '';
          valB = b.meta.title?.toLowerCase() || '';
          break;
        case 'date':
          valA = new Date(a.lastModified).getTime();
          valB = new Date(b.lastModified).getTime();
          break;
        case 'subject':
          valA = a.meta.subject?.toLowerCase() || '';
          valB = b.meta.subject?.toLowerCase() || '';
          break;
        case 'class':
          valA = a.meta.classLevel?.toLowerCase() || '';
          valB = b.meta.classLevel?.toLowerCase() || '';
          break;
        case 'variations':
          valA = a.variations?.length || a.variationCount || variantCountById.get(a.id) || 1;
          valB = b.variations?.length || b.variationCount || variantCountById.get(b.id) || 1;
          break;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    })
    .slice(0, 6);

  const SortableHeader = ({
    label,
    sortKeyProp,
    className,
  }: {
    label: string;
    sortKeyProp: SortKey;
    className?: string;
  }) => {
    const isActive = sortKey === sortKeyProp;

    return (
      <th
        className={`text-left font-semibold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider pb-4 px-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors group select-none ${className || ''}`}
        onClick={() => handleSort(sortKeyProp)}
      >
        <div className="flex items-center gap-1">
          {label}
          <span className={`flex items-center ${isActive ? 'text-blue-500 dark:text-blue-400' : 'text-transparent group-hover:text-slate-300 dark:group-hover:text-slate-600'}`}>
            {isActive && sortDirection === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </span>
        </div>
      </th>
    );
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-4xl font-semibold text-slate-900 dark:text-white">Zuletzt erstellt</h2>
        <button
          type="button"
          className="rounded-lg bg-slate-200 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-300 dark:hover:bg-slate-700"
        >
          Weitere anzeigen &gt;
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/70">
              <SortableHeader label="Titel" sortKeyProp="title" className="w-[36%]" />
              <SortableHeader label="Erstellt" sortKeyProp="date" className="w-[16%]" />
              <SortableHeader label="Fach" sortKeyProp="subject" className="w-[16%]" />
              <SortableHeader label="Klasse" sortKeyProp="class" className="w-[16%]" />
              <SortableHeader label="Variationen" sortKeyProp="variations" className="w-[16%]" />
            </tr>
          </thead>

          <tbody>
            {sortedFiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-400">
                  Noch keine Arbeitsblätter erstellt.
                </td>
              </tr>
            ) : (
              sortedFiles.map((file) => (
                <tr
                  key={file.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => props.onOpenWorksheet?.(file.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      props.onOpenWorksheet?.(file.id);
                    }
                  }}
                  className="border-b border-slate-100 dark:border-slate-700/40 text-sm text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{file.meta.title || 'Unbenannt'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-300">{formatDate(file.lastModified)}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-300">{file.meta.subject || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-300">{file.meta.classLevel || '—'}</td>
                  <td className="p-4 text-sm text-slate-500 dark:text-slate-400">{file.variations?.length || file.variationCount || variantCountById.get(file.id) || 1}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
