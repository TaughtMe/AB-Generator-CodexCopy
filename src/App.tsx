import { useEffect, useState } from 'react';
import { exportToDocx } from './utils/docx';

import { useWorksheetStore } from './store/worksheetStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useSettingsStore } from './store/settingsStore';
import { captureWorksheetThumbnail } from './utils/thumbnailCapture';
import { AIImportWizard } from './components/ai/AIImportWizard';
import { ChatAssistant } from './components/ai/ChatAssistant';
import { EditorChatSidebar } from './components/ai/EditorChatSidebar';
import { SettingsModal } from './components/settings/SettingsModal';
import { Dashboard } from './components/dashboard/Dashboard';
import { DesignEditor } from './components/dashboard/DesignEditor';
import { TemplateGallery } from './components/dashboard/TemplateGallery';
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
  const isTemplateGalleryOpen = useWorkspaceStore((s) => s.isTemplateGalleryOpen);
  const closeTemplateGallery = useWorkspaceStore((s) => s.closeTemplateGallery);
  const clearTemplateEdit = useWorkspaceStore((s) => s.clearTemplateEdit);
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
              onOpenSettings={() => setShowSettingsModal(true)}
            />
          )}
          {currentView === 'dashboard' && dashboardView === 'profiles' && (
            <ProfileManager />
          )}
        </AppShell>
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
        <DesignEditor
          isOpen={showDesignEditor}
          onClose={() => {
            setShowDesignEditor(false);
            clearTemplateEdit();
          }}
        />
        <TemplateGallery
          isOpen={isTemplateGalleryOpen}
          onClose={closeTemplateGallery}
          onOpenDesignEditor={() => setShowDesignEditor(true)}
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
        isAiSidebarOpen={isAiSidebarOpen}
        onToggleAiSidebar={toggleAiSidebar}
      />

      <div className="lg:flex lg:items-stretch">
        <div className="flex-1 min-w-0 pb-28">
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
          <div className="hidden lg:block w-80 xl:w-96 shrink-0 h-[calc(100vh-52px)] sticky top-[52px] pl-2 pr-2 pb-2">
            <EditorChatSidebar />
          </div>
        )}
      </div>

      <div
        className={`no-print fixed bottom-4 sm:bottom-6 lg:bottom-8 z-40 flex justify-center pointer-events-none ${
          isAiSidebarOpen
            ? 'left-0 right-0 lg:right-80 xl:right-96'
            : 'left-0 right-0'
        }`}
      >
        <div className="pointer-events-auto">
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
        </div>
      </div>

      {/* AI Import Wizard Modal */}
      <AIImportWizard
        isOpen={showAIWizard}
        onClose={() => setShowAIWizard(false)}
        onImport={addTasksFromAI}
      />

      {/* Design Editor Modal */}
      <DesignEditor
        isOpen={showDesignEditor}
        onClose={() => {
          setShowDesignEditor(false);
          clearTemplateEdit();
        }}
      />

      <TemplateGallery
        isOpen={isTemplateGalleryOpen}
        onClose={closeTemplateGallery}
        onOpenDesignEditor={() => setShowDesignEditor(true)}
      />
    </div>
  );
}

export default App;
