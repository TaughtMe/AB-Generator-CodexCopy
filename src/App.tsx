import { useEffect, useState } from 'react';
import { exportToDocx } from './utils/docx';

import { useWorksheetStore } from './store/worksheetStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useSettingsStore } from './store/settingsStore';
import { captureWorksheetThumbnail } from './utils/thumbnailCapture';
import { AIImportWizard } from './components/ai/AIImportWizard';
import { ChatAssistant } from './components/ai/ChatAssistant';
import { EditorChatSidebar } from './components/ai/EditorChatSidebar';
import { GlobalSettingsModal } from './components/settings/GlobalSettingsModal';
import { Dashboard } from './components/dashboard/Dashboard';
import { DesignEditor } from './components/dashboard/DesignEditor';
import { TopBar } from './components/editor/TopBar';
import { FloatingToolbar } from './components/editor/FloatingToolbar';
import { WorksheetCanvas } from './components/editor/WorksheetCanvas';
import { AppShell, type DashboardView } from './components/layout/AppShell';
import { ProfileManager } from './components/dashboard/ProfileManager';

import './styles/PrintStyles.css';

function App() {
  const title = useWorksheetStore((state) => state.title);
  const taskIds = useWorksheetStore((state) => state.taskIds);
  const tasksById = useWorksheetStore((state) => state.tasksById);
  const addTask = useWorksheetStore((state) => state.addTask);
  const addTasksFromAI = useWorksheetStore((state) => state.addTasksFromAI);
  const updateTask = useWorksheetStore((state) => state.updateTask);
  const removeTask = useWorksheetStore((state) => state.removeTask);
  const reorderTasks = useWorksheetStore((state) => state.reorderTasks);
  const duplicateTask = useWorksheetStore((state) => state.duplicateTask);
  const isTeacherMode = useWorksheetStore((state) => state.isTeacherMode);
  const toggleTeacherMode = useWorksheetStore((state) => state.toggleTeacherMode);
  const showHeader = useWorksheetStore((state) => state.showHeader);
  const setShowHeader = useWorksheetStore((state) => state.setShowHeader);
  const setTitle = useWorksheetStore((state) => state.setTitle);

  const saveCurrentWorksheet = useWorkspaceStore((s) => s.saveCurrentWorksheet);
  const currentView = useWorkspaceStore((s) => s.currentView);
  const setCurrentView = useWorkspaceStore((s) => s.setCurrentView);
  const isAiSidebarOpen = useWorkspaceStore((s) => s.isAiSidebarOpen);
  const toggleAiSidebar = useWorkspaceStore((s) => s.toggleAiSidebar);
  const fontFamily = useSettingsStore((state) => state.fontFamily);
  const brandColor = useSettingsStore((state) => state.brandColor);
  const themeMode = useSettingsStore((state) => state.themeMode);
  const toggleThemeMode = useSettingsStore((state) => state.toggleThemeMode);

  const [dashboardView, setDashboardView] = useState<DashboardView>('dashboard');
  const [showAIWizard, setShowAIWizard] = useState(false);
  const [showDesignEditor, setShowDesignEditor] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeMode === 'dark');
  }, [themeMode]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Screenshot erfassen, solange das DOM noch steht
      const thumbnail = await captureWorksheetThumbnail();
      await saveCurrentWorksheet(thumbnail ?? undefined);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePdfExport = () => {
    window.print();
  };

  const handleDocxExport = () => {
    exportToDocx(title, tasksById, taskIds, isTeacherMode);
  };

  const handleToggleHeaderDesign = () => {
    setShowHeader(!showHeader);
    if (!showHeader) setShowDesignEditor(true);
  };

  const handleBackToDashboard = async () => {
    // Screenshot ZUERST erfassen – DOM (.a4-page) ist noch gemountet
    if (taskIds.length > 0) {
      const thumbnail = await captureWorksheetThumbnail();
      // Jetzt speichern mit dem fertigen Thumbnail
      await saveCurrentWorksheet(thumbnail ?? undefined);
    }
    // Erst NACH dem vollständigen Speichern wechseln wir den View
    setCurrentView('dashboard');
  };

  const handleToggleNumber = (id: string) => {
    const task = tasksById[id];
    if (!task) return;
    const current = task.showNumber !== false; // default true
    updateTask(id, { showNumber: !current });
  };

  /* ── Dashboard View (mit AppShell + Sidebar) ── */
  if (currentView !== 'editor') {
    return (
      <>
        <AppShell
          activeView={dashboardView}
          onChangeView={(view) => {
            setDashboardView(view);
            setCurrentView('dashboard');
          }}
          onOpenSettings={() => setShowSettingsModal(true)}
        >
          {currentView === 'ai-chat' && (
            <ChatAssistant onBack={() => setCurrentView('dashboard')} />
          )}
          {currentView === 'dashboard' && dashboardView === 'dashboard' && (
            <Dashboard
              onOpenEditor={() => setCurrentView('editor')}
              onOpenAIChat={() => setCurrentView('ai-chat')}
              onOpenDesignEditor={() => setShowDesignEditor(true)}
            />
          )}
          {currentView === 'dashboard' && dashboardView === 'profiles' && (
            <ProfileManager />
          )}
        </AppShell>
        <GlobalSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
        <DesignEditor
          isOpen={showDesignEditor}
          onClose={() => setShowDesignEditor(false)}
        />
      </>
    );
  }

  /* ── Editor View ── */
  return (
    <div className="min-h-screen pb-32 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <TopBar
        title={title}
        onTitleChange={setTitle}
        onBackToDashboard={handleBackToDashboard}
        onSave={handleSave}
        isSaving={isSaving}
        hasTasks={taskIds.length > 0}
        onExportDocx={handleDocxExport}
        onExportPDF={handlePdfExport}
        isDarkMode={themeMode === 'dark'}
        onToggleThemeMode={toggleThemeMode}
        onOpenSettings={() => setShowSettingsModal(true)}
        isAiSidebarOpen={isAiSidebarOpen}
        onToggleAiSidebar={toggleAiSidebar}
      />

      <div className="lg:flex lg:items-stretch">
        <div className="flex-1 min-w-0">
          <WorksheetCanvas
            taskIds={taskIds}
            tasksById={tasksById}
            fontFamily={fontFamily}
            brandColor={brandColor}
            zoomLevel={zoomLevel}
            onReorderTasks={reorderTasks}
            onRemoveTask={removeTask}
            onDuplicateTask={duplicateTask}
            onToggleTaskNumber={handleToggleNumber}
          />

          {/* Empty state */}
          {taskIds.length === 0 && (
            <div className="no-print text-center py-16 mx-auto max-w-[210mm] border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl mt-8">
              <p className="text-slate-400 dark:text-slate-500 text-sm">
                Noch keine Aufgaben vorhanden.<br />
                Klicke unten auf das "+" oder nutze den KI-Import.
              </p>
            </div>
          )}
        </div>

        {isAiSidebarOpen && (
          <div className="hidden lg:block w-80 xl:w-96 shrink-0 border-l border-slate-200 dark:border-slate-800 h-[calc(100vh-52px)] sticky top-[52px]">
            <EditorChatSidebar />
          </div>
        )}
      </div>

      <FloatingToolbar
        onAddTask={addTask}
        onOpenAIImport={() => setShowAIWizard(true)}
        showHeader={showHeader}
        onToggleHeaderDesign={handleToggleHeaderDesign}
        isTeacherMode={isTeacherMode}
        onToggleTeacherMode={toggleTeacherMode}
        zoomLevel={zoomLevel}
        onZoomLevelChange={setZoomLevel}
      />

      {/* AI Import Wizard Modal */}
      <AIImportWizard
        isOpen={showAIWizard}
        onClose={() => setShowAIWizard(false)}
        onImport={addTasksFromAI}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      {/* Settings Modal */}
      <GlobalSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Design Editor Modal */}
      <DesignEditor
        isOpen={showDesignEditor}
        onClose={() => setShowDesignEditor(false)}
      />
    </div>
  );
}

export default App;
