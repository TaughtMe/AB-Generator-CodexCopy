import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Upload } from 'lucide-react';
import { QuickActions } from './QuickActions';
import { RecentGrid } from './RecentGrid';
import { RecentList } from './RecentList';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useProfileStore } from '../../store/profileStore';
import { loadWorksheet as loadWorksheetRecord, saveWorksheet as saveWorksheetRecord } from '../../store/dexieStore';

interface DashboardViewProps {
  onCreateWorksheet?: () => void;
  onOpenAssistant?: () => void;
  onOpenWorksheet?: (id: string) => void | Promise<void>;
}

function getSortLabel(sortBy: 'updatedAt' | 'createdAt' | 'title' | undefined): string {
  if (sortBy === 'createdAt') return 'Erstellt';
  if (sortBy === 'title') return 'Alphabetisch';
  return 'Neueste zuerst';
}

export function DashboardView({
  onCreateWorksheet,
  onOpenAssistant,
  onOpenWorksheet,
}: DashboardViewProps) {
  const recentWorksheets = useWorkspaceStore((state) => state.recentWorksheets);
  const loadRecent = useWorkspaceStore((state) => state.loadRecent);
  const duplicateWorksheet = useWorkspaceStore((state) => state.duplicateWorksheet);
  const removeWorksheet = useWorkspaceStore((state) => state.removeWorksheet);
  const importWorksheet = useWorkspaceStore((state) => state.importWorksheet);
  const filter = useWorkspaceStore((state) => state.filter);
  const subjects = useProfileStore((state) => state.subjects);
  const classProfiles = useWorkspaceStore((state) => state.classProfiles);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Drag & Drop .abgen import ──────────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const dragCounterRef = useRef(0); // track nested drag-enter/leave pairs

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith('.abgen'));
    if (files.length === 0) return;

    setIsImporting(true);
    try {
      for (const file of files) {
        await importWorksheet(file);
      }
      await loadRecent();
    } catch (err) {
      alert('Import fehlgeschlagen: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsImporting(false);
    }
  }, [importWorksheet, loadRecent]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const subjectNameById = useMemo(
    () =>
      Object.fromEntries(
        subjects.map((subject) => [subject.id, subject.name]),
      ),
    [subjects],
  );

  const classNameById = useMemo(
    () =>
      Object.fromEntries(
        classProfiles.map((classProfile) => [classProfile.id, classProfile.name]),
      ),
    [classProfiles],
  );

  const filteredWorksheets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return recentWorksheets;

    return recentWorksheets.filter((worksheet) => {
      const subjectName = worksheet.subjectId
        ? (subjectNameById[worksheet.subjectId] ?? '')
        : '';
      const className = worksheet.classId
        ? (classNameById[worksheet.classId] ?? '')
        : '';
      const previewText = worksheet.taskPreview
        .map((item) => item.label)
        .join(' ');

      const haystack = `${worksheet.title} ${subjectName} ${className} ${previewText}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [classNameById, recentWorksheets, searchQuery, subjectNameById]);

  const handleRenameWorksheet = async (id: string) => {
    const record = await loadWorksheetRecord(id);
    if (!record) return;

    const nextTitle = window.prompt('Arbeitsblatt umbenennen', record.title)?.trim();
    if (!nextTitle || nextTitle === record.title) return;

    await saveWorksheetRecord(
      record.id,
      nextTitle,
      record.tasksById,
      record.taskIds,
      record.chatHistory,
      record.sources,
      record.subjectId,
      record.classId,
      record.thumbnailBlob,
      record.variants,
      record.activeVariantId,
    );
    await loadRecent();
  };

  const handleAssignWorksheet = async (id: string) => {
    await onOpenWorksheet?.(id);
  };

  const handleDuplicateWorksheet = async (id: string) => {
    await duplicateWorksheet(id);
  };

  const handleDownloadWorksheet = async (id: string, variant: 'student' | 'teacher') => {
    const record = await loadWorksheetRecord(id);
    if (!record) return;

    const { exportToDocx } = await import('../../utils/docx');
    await exportToDocx(record.title, record.tasksById, record.taskIds, variant === 'teacher');
  };

  const handleExportAbgenWorksheet = async (id: string) => {
    const exportWorksheetFn = useWorkspaceStore.getState().exportWorksheet;
    await exportWorksheetFn(id);
  };

  const handleDeleteWorksheet = async (id: string) => {
    const shouldDelete = window.confirm('Arbeitsblatt in den Papierkorb verschieben?');
    if (!shouldDelete) return;
    await removeWorksheet(id);
  };

  return (
    <div
      className="relative px-8 py-8"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {(isDragOver || isImporting) && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl border-4 border-dashed border-blue-400 bg-blue-50/90 dark:bg-blue-950/90 backdrop-blur-sm pointer-events-none">
          <Upload className="h-14 w-14 text-blue-400 mb-4 animate-bounce" />
          <p className="text-lg font-semibold text-blue-600 dark:text-blue-300">
            {isImporting ? 'Wird importiert…' : '.abgen-Datei hier ablegen'}
          </p>
          <p className="text-sm text-blue-400 mt-1">
            {isImporting ? '' : 'Arbeitsblatt wird importiert und gespeichert'}
          </p>
        </div>
      )}

      <div className="relative max-w-2xl mb-8">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Alle Dokumente durchsuchen"
          className="w-full max-w-xl rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-slate-500"
        />
      </div>
      <div className="mx-auto w-full max-w-[1200px] space-y-10">
        <QuickActions
          onCreateWorksheet={onCreateWorksheet}
          onOpenAssistant={onOpenAssistant}
        />
        <RecentGrid
          items={filteredWorksheets}
          subjectNameById={subjectNameById}
          onOpenWorksheet={onOpenWorksheet}
          onRenameWorksheet={handleRenameWorksheet}
          onAssignWorksheet={handleAssignWorksheet}
          onDuplicateWorksheet={handleDuplicateWorksheet}
          onDownloadWorksheet={handleDownloadWorksheet}
          onExportAbgenWorksheet={handleExportAbgenWorksheet}
          onDeleteWorksheet={handleDeleteWorksheet}
        />
        <RecentList
          items={filteredWorksheets}
          subjectNameById={subjectNameById}
          classNameById={classNameById}
          sortLabel={getSortLabel(filter.sortBy)}
          onOpenWorksheet={onOpenWorksheet}
        />
      </div>
    </div>
  );
}
