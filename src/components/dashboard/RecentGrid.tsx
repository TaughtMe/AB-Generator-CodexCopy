import type { FolderRecord, WorksheetMeta } from '../../store/dexieStore';
import { WorksheetCard } from './WorksheetCard';

interface RecentGridProps {
  /** Dexie-basierte Worksheet-Metadaten (einzige Wahrheitsquelle, identisch zur Liste). */
  items: WorksheetMeta[];
  subjectNameById: Record<string, string>;
  /** Bibliotheks-Ordner für das "Verschieben"-Untermenü der Karten. */
  folders?: FolderRecord[];
  onOpenWorksheet?: (id: string) => void;
  onRenameWorksheet?: (id: string) => Promise<void> | void;
  onAssignWorksheet?: (id: string) => Promise<void> | void;
  onDuplicateWorksheet?: (id: string) => Promise<void> | void;
  onDownloadWorksheet?: (id: string, variant: 'student' | 'teacher') => Promise<void> | void;
  onExportAbgenWorksheet?: (id: string) => Promise<void> | void;
  onDeleteWorksheet?: (id: string) => Promise<void> | void;
  onToggleFavorite?: (id: string, next: boolean) => Promise<void> | void;
  onMoveToFolder?: (id: string, folderId: string | undefined) => Promise<void> | void;
  onUpdateTags?: (id: string, tags: string[]) => Promise<void> | void;
}

function formatUpdatedLabel(date: Date | string): string {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Unbekannt';

  const diff = Date.now() - parsed.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Gestern';

  return `vor ${days} Tagen`;
}

export function RecentGrid(props: RecentGridProps) {
  const cards = [...props.items]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Zuletzt bearbeitet</h2>
        <button
          type="button"
          className="text-sm font-medium px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
        >
          Weitere anzeigen &gt;
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="w-full h-32 flex items-center justify-center rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 dark:bg-slate-800/30 dark:border-slate-700/50">
          <span className="text-sm text-slate-500 dark:text-slate-400">Keine kürzlich bearbeiteten Dateien</span>
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((meta) => (
          <WorksheetCard
            key={meta.id}
            title={meta.title || 'Unbenannt'}
            subject={
              (meta.subjectId ? props.subjectNameById[meta.subjectId] : undefined)
                ?? meta.documentSubject
                ?? 'Kein Fach zugeordnet'
            }
            date={formatUpdatedLabel(meta.updatedAt)}
            taskCount={meta.taskCount}
            tasks={meta.taskPreview.map((item) => ({ type: item.type, content: item.label }))}
            onOpen={() => props.onOpenWorksheet?.(meta.id)}
            onRenameAction={() => props.onRenameWorksheet?.(meta.id)}
            onAssignAction={() => props.onAssignWorksheet?.(meta.id)}
            onDuplicateAction={() => props.onDuplicateWorksheet?.(meta.id)}
            onDeleteAction={() => props.onDeleteWorksheet?.(meta.id)}
            onDownloadStudentAction={() => props.onDownloadWorksheet?.(meta.id, 'student')}
            onDownloadTeacherAction={() => props.onDownloadWorksheet?.(meta.id, 'teacher')}
            onDownloadAbgenAction={() => props.onExportAbgenWorksheet?.(meta.id)}
            favorite={meta.favorite}
            tags={meta.tags}
            folders={props.folders}
            onToggleFavoriteAction={() => props.onToggleFavorite?.(meta.id, !meta.favorite)}
            onMoveToFolderAction={(folderId) => props.onMoveToFolder?.(meta.id, folderId)}
            onUpdateTagsAction={(tags) => props.onUpdateTags?.(meta.id, tags)}
          />
        ))}
      </div>
      )}
    </section>
  );
}
