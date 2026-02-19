import { useState } from 'react';
import { exportToDocx } from './utils/docx';

import { useWorksheetStore } from './store/worksheetStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useSettingsStore } from './store/settingsStore';
import { AIImportWizard } from './components/ai/AIImportWizard';
import { GlobalSettingsModal } from './components/settings/GlobalSettingsModal';
import { Dashboard } from './components/dashboard/Dashboard';
import { DesignEditor } from './components/dashboard/DesignEditor';
import { EditorToolbar } from './components/editor/EditorToolbar';
import { WorksheetCanvas } from './components/editor/WorksheetCanvas';

import './styles/PrintStyles.css';

type AppView = 'dashboard' | 'editor';

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
  const fontFamily = useSettingsStore((state) => state.fontFamily);
  const brandColor = useSettingsStore((state) => state.brandColor);

  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  const [showAIWizard, setShowAIWizard] = useState(false);
  const [showDesignEditor, setShowDesignEditor] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark((prev) => !prev);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveCurrentWorksheet();
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
    // Auto-save before navigating away
    if (taskIds.length > 0) {
      await saveCurrentWorksheet();
    }
    setCurrentView('dashboard');
  };

  const handleToggleNumber = (id: string) => {
    const task = tasksById[id];
    if (!task) return;
    const current = task.showNumber !== false; // default true
    updateTask(id, { showNumber: !current });
  };

  /* ── Dashboard View ── */
  if (currentView === 'dashboard') {
    return (
      <>
        <Dashboard
          onOpenEditor={() => setCurrentView('editor')}
          onOpenDesignEditor={() => setShowDesignEditor(true)}
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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <EditorToolbar
        title={title}
        onTitleChange={setTitle}
        onBackToDashboard={handleBackToDashboard}
        onAddTask={addTask}
        onOpenAIImport={() => setShowAIWizard(true)}
        showHeader={showHeader}
        onToggleHeaderDesign={handleToggleHeaderDesign}
        isTeacherMode={isTeacherMode}
        onToggleTeacherMode={toggleTeacherMode}
        onSave={handleSave}
        isSaving={isSaving}
        hasTasks={taskIds.length > 0}
        onExportDocx={handleDocxExport}
        onExportPDF={handlePdfExport}
        isDark={isDark}
        onToggleDark={toggleDark}
        onOpenSettings={() => setShowSettingsModal(true)}
        zoomLevel={zoomLevel}
        onZoomLevelChange={setZoomLevel}
      />

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
            Klicke oben auf einen Aufgabentyp oder nutze den KI-Import.
          </p>
        </div>
      )}

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
