import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { WorksheetMeta } from '../../store/dexieStore';
import { useWorkspaceStore } from '../../store/workspaceStore';

interface RecentListProps {
  items: WorksheetMeta[];
  subjectNameById: Record<string, string>;
  classNameById: Record<string, string>;
  sortLabel: string;
  onOpenWorksheet?: (id: string) => void;
}

type SortKey = 'title' | 'folder' | 'date' | 'subject' | 'class' | 'variations';

function formatDate(date: Date | string): string {
  if (!date) return '—';

  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function RecentList(props: RecentListProps) {
  const { items, subjectNameById, classNameById } = props;
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { deleteDocuments, folders } = useWorkspaceStore(useShallow((state) => ({
    deleteDocuments: state.deleteDocuments,
    folders: state.folders,
  })));

  const folderNameById = useMemo(
    () => Object.fromEntries(folders.map((folder) => [folder.id, folder.name])),
    [folders],
  );
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDirection('asc');
  };

  const sorted = [...items]
    .sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortKey) {
        case 'title':
          valA = a.title?.toLowerCase() || '';
          valB = b.title?.toLowerCase() || '';
          break;
        case 'folder':
          valA = (a.folderId ? folderNameById[a.folderId] : undefined)?.toLowerCase() || '';
          valB = (b.folderId ? folderNameById[b.folderId] : undefined)?.toLowerCase() || '';
          break;
        case 'date':
          valA = new Date(a.updatedAt).getTime();
          valB = new Date(b.updatedAt).getTime();
          break;
        case 'subject':
          valA = ((a.subjectId ? subjectNameById[a.subjectId] : undefined) || a.documentSubject || '').toLowerCase();
          valB = ((b.subjectId ? subjectNameById[b.subjectId] : undefined) || b.documentSubject || '').toLowerCase();
          break;
        case 'class':
          valA = ((a.classId ? classNameById[a.classId] : undefined) || a.documentClassLevel || '').toLowerCase();
          valB = ((b.classId ? classNameById[b.classId] : undefined) || b.documentClassLevel || '').toLowerCase();
          break;
        case 'variations':
          valA = a.variantCount || 1;
          valB = b.variantCount || 1;
          break;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  // Standardmäßig nur die 6 neuesten; "Weitere anzeigen" klappt ALLE auf.
  const COLLAPSED_COUNT = 6;
  const sortedFiles = showAll ? sorted : sorted.slice(0, COLLAPSED_COUNT);
  const hasMore = sorted.length > COLLAPSED_COUNT;

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedFiles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedFiles.map((f) => f.id));
    }
  };

  const handleDeleteSelected = () => {
    if (deleteDocuments) {
      deleteDocuments(selectedIds);
    }
    setIsSelectionMode(false);
    setSelectedIds([]);
  };

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
        className={`text-left font-semibold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors group select-none ${className || ''}`}
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
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-300 dark:hover:bg-slate-700"
          >
            {showAll ? (
              <>Weniger anzeigen <ChevronUp size={16} /></>
            ) : (
              <>Alle anzeigen ({sorted.length}) <ChevronDown size={16} /></>
            )}
          </button>
        )}
      </div>

      <div className="mb-4 flex items-center justify-end">
        {isSelectionMode ? (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
            <span className="text-sm text-slate-500 dark:text-slate-400 mr-2">
              {selectedIds.length} ausgewählt
            </span>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0}
              className="text-sm px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed text-white rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Trash2 size={16} />
              Löschen
            </button>
            <button
              onClick={toggleSelectionMode}
              className="text-sm px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md transition-colors"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            onClick={toggleSelectionMode}
            className="text-sm px-4 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md transition-colors shadow-sm"
          >
            Auswählen
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/70">
              {isSelectionMode && (
                <th className="w-12 px-4 py-3 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/70">
                  <input
                    type="checkbox"
                    className="w-4 h-4 cursor-pointer accent-blue-500 rounded border-slate-300 dark:border-slate-600"
                    checked={selectedIds.length === sortedFiles.length && sortedFiles.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              <SortableHeader label="Titel" sortKeyProp="title" className="w-[28%]" />
              <SortableHeader label="Ordner" sortKeyProp="folder" className="w-[16%]" />
              <SortableHeader label="Erstellt" sortKeyProp="date" className="w-[14%]" />
              <SortableHeader label="Fach" sortKeyProp="subject" className="w-[14%]" />
              <SortableHeader label="Klasse" sortKeyProp="class" className="w-[14%]" />
              <SortableHeader label="Variationen" sortKeyProp="variations" className="w-[14%]" />
            </tr>
          </thead>

          <tbody>
            {sortedFiles.length === 0 ? (
              <tr>
                <td colSpan={isSelectionMode ? 7 : 6} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-400">
                  Noch keine Arbeitsblätter erstellt.
                </td>
              </tr>
            ) : (
              sortedFiles.map((file) => (
                <tr
                  key={file.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => isSelectionMode ? toggleSelect(file.id) : props.onOpenWorksheet?.(file.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      if (isSelectionMode) {
                        toggleSelect(file.id);
                      } else {
                        props.onOpenWorksheet?.(file.id);
                      }
                    }
                  }}
                  className="border-b border-slate-100 dark:border-slate-700/40 text-sm text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  {isSelectionMode && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 cursor-pointer accent-blue-500 rounded border-slate-300 dark:border-slate-600"
                        checked={selectedIds.includes(file.id)}
                        onChange={() => toggleSelect(file.id)}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{file.title || 'Unbenannt'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-300">{(file.folderId ? folderNameById[file.folderId] : undefined) || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-300">{formatDate(file.updatedAt)}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-300">{(file.subjectId ? subjectNameById[file.subjectId] : undefined) || file.documentSubject || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-300">{(file.classId ? classNameById[file.classId] : undefined) || file.documentClassLevel || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{file.variantCount || 1}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
