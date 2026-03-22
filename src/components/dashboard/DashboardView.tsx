import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { QuickActions } from './QuickActions';
import { RecentGrid } from './RecentGrid';
import { RecentList } from './RecentList';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useProfileStore } from '../../store/profileStore';
import type { LegalModalType } from '../layout/LegalModals';

type DashboardSidebarView = 'dashboard' | 'profiles' | 'trash';
type DashboardSidebarAction = DashboardSidebarView | 'settings';

interface DashboardViewProps {
  onCreateWorksheet?: () => void;
  onOpenAssistant?: () => void;
  onOpenWorksheet?: (id: string) => void | Promise<void>;
  onSidebarAction?: (action: DashboardSidebarAction) => void;
  onOpenLegalModal?: (modal: Extract<LegalModalType, 'impressum' | 'datenschutz'>) => void;
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
  onSidebarAction,
  onOpenLegalModal,
}: DashboardViewProps) {
  const recentWorksheets = useWorkspaceStore((state) => state.recentWorksheets);
  const loadRecent = useWorkspaceStore((state) => state.loadRecent);
  const filter = useWorkspaceStore((state) => state.filter);
  const subjects = useProfileStore((state) => state.subjects);
  const classProfiles = useWorkspaceStore((state) => state.classProfiles);
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <DashboardLayout
      activeSidebarView="dashboard"
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      onSidebarAction={onSidebarAction}
      onOpenLegalModal={onOpenLegalModal}
    >
      <div className="mx-auto w-full max-w-[1200px] space-y-10">
        <QuickActions
          onCreateWorksheet={onCreateWorksheet}
          onOpenAssistant={onOpenAssistant}
        />
        <RecentGrid items={filteredWorksheets} onOpenWorksheet={onOpenWorksheet} />
        <RecentList
          items={filteredWorksheets}
          subjectNameById={subjectNameById}
          classNameById={classNameById}
          sortLabel={getSortLabel(filter.sortBy)}
          onOpenWorksheet={onOpenWorksheet}
        />
      </div>
    </DashboardLayout>
  );
}
