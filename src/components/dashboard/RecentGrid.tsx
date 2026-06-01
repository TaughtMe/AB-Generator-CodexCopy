import { useWorkspaceStore } from '../../store/workspaceStore';
import { WorksheetCard } from './WorksheetCard';

interface RecentGridProps {
  items: unknown[];
  subjectNameById: Record<string, string>;
  onOpenWorksheet?: (id: string) => void;
  onRenameWorksheet?: (id: string) => Promise<void> | void;
  onAssignWorksheet?: (id: string) => Promise<void> | void;
  onDuplicateWorksheet?: (id: string) => Promise<void> | void;
  onDownloadWorksheet?: (id: string, variant: 'student' | 'teacher') => Promise<void> | void;
  onExportAbgenWorksheet?: (id: string) => Promise<void> | void;
  onDeleteWorksheet?: (id: string) => Promise<void> | void;
}

function formatUpdatedLabel(date: string): string {
  const parsed = new Date(date);
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
  const savedFiles = useWorkspaceStore((state) => state.savedFiles);
  const cards = [...savedFiles]
    .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
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
        {cards.map((file) => (
          <WorksheetCard
            key={`${file.id}-${file.tasks?.length || file.taskCount || 0}`}
            title={file.meta.title || 'Unbenannt'}
            subject={file.meta.subject || 'Kein Fach zugeordnet'}
            date={formatUpdatedLabel(file.lastModified)}
            taskCount={file.tasks?.length || file.taskCount || 0}
            tasks={file.tasks || []}
            onOpen={() => props.onOpenWorksheet?.(file.id)}
            onRenameAction={() => props.onRenameWorksheet?.(file.id)}
            onAssignAction={() => props.onAssignWorksheet?.(file.id)}
            onDuplicateAction={() => props.onDuplicateWorksheet?.(file.id)}
            onDeleteAction={() => props.onDeleteWorksheet?.(file.id)}
            onDownloadStudentAction={() => props.onDownloadWorksheet?.(file.id, 'student')}
            onDownloadTeacherAction={() => props.onDownloadWorksheet?.(file.id, 'teacher')}
            onDownloadAbgenAction={() => props.onExportAbgenWorksheet?.(file.id)}
          />
        ))}
      </div>
      )}
    </section>
  );
}
