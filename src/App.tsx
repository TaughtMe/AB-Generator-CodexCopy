import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

import { useWorksheetStore } from './store/worksheetStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useSettingsStore } from './store/settingsStore';
import { useFontStore } from './store/fontStore';
import { captureWorksheetThumbnail } from './utils/thumbnailCapture';
import { ChatAssistant } from './components/ai/ChatAssistant';
import { EditorChatSidebar } from './components/ai/EditorChatSidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { TrashView } from './components/dashboard/TrashView';
import { DesignEditor } from './components/dashboard/DesignEditor';
import { TemplateGallery } from './components/dashboard/TemplateGallery';
import type { ExportVariant } from './components/editor/ExportMenu';
import { RibbonToolbar } from './components/layout/RibbonToolbar';
import { VariantTabs } from './components/editor/VariantTabs';
import { FloatingToolbar } from './components/editor/FloatingToolbar';
import { WorksheetCanvas } from './components/editor/WorksheetCanvas';
import { SourcesManagerModal } from './components/editor/SourcesManagerModal';
import { OutlineNavigator } from './components/layout/OutlineNavigator';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { LegalModals, type LegalModalType } from './components/layout/LegalModals';
import { ClassesDashboard } from './components/dashboard/ClassesDashboard';
import { SettingsView } from './components/settings/SettingsView';
import type { SidebarView } from './components/layout/Sidebar';

import './styles/PrintStyles.css';

function App() {
  const title = useWorksheetStore((state) => state.title);
  const taskIds = useWorksheetStore((state) => state.taskIds);
  const tasksById = useWorksheetStore((state) => state.tasksById);
  const variants = useWorksheetStore((state) => state.variants);
  const activeVariantId = useWorksheetStore((state) => state.activeVariantId);
  const insertTaskAt = useWorksheetStore((state) => state.insertTaskAt);
  const updateTask = useWorksheetStore((state) => state.updateTask);
  const removeTask = useWorksheetStore((state) => state.removeTask);
  const reorderTasks = useWorksheetStore((state) => state.reorderTasks);
  const moveTask = useWorksheetStore((state) => state.moveTask);
  const duplicateTask = useWorksheetStore((state) => state.duplicateTask);
  const setActiveVariant = useWorksheetStore((state) => state.setActiveVariant);
  const addVariant = useWorksheetStore((state) => state.addVariant);
  const renameVariant = useWorksheetStore((state) => state.renameVariant);
  const reorderVariants = useWorksheetStore((state) => state.reorderVariants);
  const removeVariant = useWorksheetStore((state) => state.removeVariant);
  const showHeader = useWorksheetStore((state) => state.showHeader);
  const setShowHeader = useWorksheetStore((state) => state.setShowHeader);

  const saveCurrentWorksheet = useWorkspaceStore((s) => s.saveCurrentWorksheet);
  const createNewWorksheet = useWorkspaceStore((s) => s.createNewWorksheet);
  const openWorksheet = useWorkspaceStore((s) => s.openWorksheet);
  const loadClassProfiles = useWorkspaceStore((s) => s.loadClassProfiles);
  const currentView = useWorkspaceStore((s) => s.currentView);
  const setCurrentView = useWorkspaceStore((s) => s.setCurrentView);
  const isAiSidebarOpen = useWorkspaceStore((s) => s.isAiSidebarOpen);
  const toggleAiSidebar = useWorkspaceStore((s) => s.toggleAiSidebar);
  const isOutlineOpen = useWorkspaceStore((s) => s.isOutlineOpen);
  const toggleOutline = useWorkspaceStore((s) => s.toggleOutline);
  const isPlacingNewTask = useWorkspaceStore((s) => s.isPlacingNewTask);
  const startPlacingTask = useWorkspaceStore((s) => s.startPlacingTask);
  const cancelPlacingTask = useWorkspaceStore((s) => s.cancelPlacingTask);
  const isTemplateGalleryOpen = useWorkspaceStore((s) => s.isTemplateGalleryOpen);
  const closeTemplateGallery = useWorkspaceStore((s) => s.closeTemplateGallery);
  const clearTemplateEdit = useWorkspaceStore((s) => s.clearTemplateEdit);
  const fontFamily = useSettingsStore((state) => state.fontFamily);
  const brandColor = useSettingsStore((state) => state.brandColor);
  const themeMode = useSettingsStore((state) => state.themeMode);
  const loadCustomFonts = useFontStore((state) => state.loadCustomFonts);

  const [sidebarView, setSidebarView] = useState<SidebarView>('dashboard');
  const [showDesignEditor, setShowDesignEditor] = useState(false);
  const [showSourcesManager, setShowSourcesManager] = useState(false);
  const [activeLegalModal, setActiveLegalModal] = useState<LegalModalType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeMode === 'dark');
  }, [themeMode]);

  useEffect(() => {
    void loadClassProfiles();
  }, [loadClassProfiles]);

  useEffect(() => {
    void loadCustomFonts();
  }, [loadCustomFonts]);

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

  const runPrintExport = async (variant: ExportVariant) => {
    const root = document.documentElement;
    const previousVariant = root.dataset.exportVariant;
    root.dataset.exportVariant = variant;

    const waitForPrint = () => new Promise<void>((resolve) => {
      let resolved = false;

      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        window.removeEventListener('afterprint', handleAfterPrint);
        resolve();
      };

      const handleAfterPrint = () => {
        window.clearTimeout(timeoutId);
        cleanup();
      };

      const timeoutId = window.setTimeout(cleanup, 15000);
      window.addEventListener('afterprint', handleAfterPrint, { once: true });
      window.print();
    });

    try {
      await waitForPrint();
    } finally {
      if (previousVariant) {
        root.dataset.exportVariant = previousVariant;
      } else {
        delete root.dataset.exportVariant;
      }
    }
  };

  const handlePdfExport = async (variants: ExportVariant[]) => {
    if (taskIds.length === 0) return;
    for (const variant of variants) {
      await runPrintExport(variant);
    }
  };

  const handleDocxExport = async (variants: ExportVariant[]) => {
    if (taskIds.length === 0) return;
    const { exportToDocx } = await import('./utils/docx');
    for (const variant of variants) {
      await exportToDocx(title, tasksById, taskIds, variant === 'teacher');
    }
  };

  const handleToggleHeaderDesign = () => {
    setShowHeader(!showHeader);
    if (!showHeader) setShowDesignEditor(true);
  };

  const handleBackToDashboard = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      // Screenshot ZUERST erfassen – DOM (.a4-page) ist noch gemountet
      if (taskIds.length > 0) {
        const thumbnail = await captureWorksheetThumbnail();
        // Jetzt speichern mit dem fertigen Thumbnail
        await saveCurrentWorksheet(thumbnail ?? undefined);
      }
      // Erst NACH dem vollständigen Speichern wechseln wir den View
      setCurrentView('dashboard');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNumber = (id: string) => {
    const task = tasksById[id];
    if (!task) return;
    const current = task.showNumber !== false; // default true
    updateTask(id, { showNumber: !current });
  };

  const handleAddVariant = () => {
    const existingLabels = new Set(variants.map((variant) => variant.label));
    let index = variants.length + 1;
    let label = `Niveau ${index}`;
    while (existingLabels.has(label)) {
      index += 1;
      label = `Niveau ${index}`;
    }
    addVariant(label, 'duplicate-active');
  };

  /* ── Dashboard View (unified layout) ── */
  if (currentView !== 'editor') {
    const handleSidebarChange = (view: SidebarView) => {
      setSidebarView(view);
      if (view !== 'settings') {
        setCurrentView('dashboard');
      }
    };

    return (
      <>
        <DashboardLayout
          activeView={sidebarView}
          onChangeView={handleSidebarChange}
        >
          {currentView === 'ai-chat' && (
            <ChatAssistant onBack={() => { setSidebarView('dashboard'); setCurrentView('dashboard'); }} />
          )}
          {sidebarView === 'dashboard' && currentView === 'dashboard' && (
            <DashboardView
              onCreateWorksheet={() => {
                createNewWorksheet();
                setCurrentView('editor');
              }}
              onOpenAssistant={() => setCurrentView('ai-chat')}
              onOpenWorksheet={async (id) => {
                const ok = await openWorksheet(id);
                if (ok) setCurrentView('editor');
              }}
            />
          )}
          {sidebarView === 'profiles' && currentView === 'dashboard' && (
            <ClassesDashboard />
          )}
          {sidebarView === 'trash' && currentView === 'dashboard' && (
            <TrashView />
          )}
          {sidebarView === 'settings' && (
            <SettingsView />
          )}
        </DashboardLayout>
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
        <LegalModals
          activeModal={activeLegalModal}
          onClose={() => setActiveLegalModal(null)}
        />
      </>
    );
  }

  /* ── Editor View ── */
  return (
    <div className="min-h-screen print:h-auto pb-32 print:pb-0 bg-slate-100 print:bg-white dark:bg-slate-950 print:dark:bg-white text-slate-900 dark:text-slate-100 print:dark:text-slate-900">
      <RibbonToolbar
        onBackToDashboard={handleBackToDashboard}
        onSave={handleSave}
        isSaving={isSaving}
        hasTasks={taskIds.length > 0}
        onExportPdf={handlePdfExport}
        onExportDocx={handleDocxExport}
        onOpenSources={() => setShowSourcesManager(true)}
      />

      <VariantTabs
        variants={variants}
        activeVariantId={activeVariantId}
        onSelectVariant={setActiveVariant}
        onAddVariant={handleAddVariant}
        onRenameVariant={renameVariant}
        onReorderVariants={reorderVariants}
        onRemoveVariant={removeVariant}
      />

      <div className="lg:flex lg:items-stretch print:block print:overflow-visible print:p-0 print:m-0">
        {/* Outline-Navigator (linke Sidebar) */}
        <div
          className={`no-print hidden lg:block shrink-0 h-[calc(100vh-90px)] sticky top-[90px] transition-all duration-200 ease-in-out overflow-hidden ${
            isOutlineOpen ? 'w-60 border-r border-slate-200/80 dark:border-slate-800/80' : 'w-0'
          }`}
        >
          {isOutlineOpen && (
            <OutlineNavigator
              taskIds={taskIds}
              tasksById={tasksById}
              onReorderTasks={reorderTasks}
              onClose={toggleOutline}
            />
          )}
        </div>

        <div className="flex-1 min-w-0 pb-28 print:block print:pb-0 print:overflow-visible print:p-0 print:m-0">
          <WorksheetCanvas
            taskIds={taskIds}
            tasksById={tasksById}
            fontFamily={fontFamily}
            brandColor={brandColor}
            zoomLevel={zoomLevel}
            onReorderTasks={reorderTasks}
            onMoveTask={moveTask}
            onRemoveTask={removeTask}
            onDuplicateTask={duplicateTask}
            onToggleTaskNumber={handleToggleNumber}
            onUpdateTask={updateTask}
            onInsertTaskAt={insertTaskAt}
            isPlacingNewTask={isPlacingNewTask}
            onCancelPlacing={cancelPlacingTask}
          />

          {/* Empty state */}
          {taskIds.length === 0 && (
            <div className="no-print text-center py-16 mx-auto max-w-[210mm] border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl mt-8">
              <p className="text-slate-400 dark:text-slate-500 text-sm">
                Noch keine Aufgaben vorhanden.<br />
                Klicke unten auf das "+" oder nutze den KI-Chat.
              </p>
            </div>
          )}
        </div>

        {isAiSidebarOpen && (
          <div className="no-print hidden lg:flex w-80 xl:w-96 shrink-0 min-h-0 h-[calc(100vh-90px)] sticky top-[90px] pl-2 pr-2 pb-2">
            <EditorChatSidebar onOpenSources={() => setShowSourcesManager(true)} />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={toggleAiSidebar}
        aria-label={isAiSidebarOpen ? 'KI-Chat schließen' : 'KI-Chat öffnen'}
        aria-pressed={isAiSidebarOpen}
        title={isAiSidebarOpen ? 'KI-Chat ausblenden' : 'KI-Chat einblenden'}
        className={`no-print hidden lg:flex fixed z-50 h-14 w-14 items-center justify-center rounded-full border text-white shadow-xl transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
          isAiSidebarOpen
            ? 'bottom-6 right-[21rem] xl:right-[25rem] bg-teal-500 dark:bg-purple-600 border-white/25 dark:border-white/10 hover:bg-teal-400 dark:hover:bg-purple-500 hover:-translate-y-0.5 hover:shadow-2xl active:scale-95'
            : 'bottom-6 right-6 bg-teal-500 dark:bg-purple-600 border-white/25 dark:border-white/10 hover:bg-teal-400 dark:hover:bg-purple-500 hover:-translate-y-0.5 hover:scale-105 hover:shadow-2xl active:scale-95'
        }`}
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <div
        className={`no-print fixed bottom-16 sm:bottom-18 lg:bottom-20 z-40 flex justify-center pointer-events-none ${
          isAiSidebarOpen
            ? 'left-0 right-0 lg:right-80 xl:right-96'
            : 'left-0 right-0'
        }`}
      >
        <div className="pointer-events-auto">
          <FloatingToolbar
            showHeader={showHeader}
            onToggleHeaderDesign={handleToggleHeaderDesign}
            zoomLevel={zoomLevel}
            onZoomLevelChange={setZoomLevel}
            isPlacingNewTask={isPlacingNewTask}
            onStartPlacing={startPlacingTask}
            onCancelPlacing={cancelPlacingTask}
          />
        </div>
      </div>

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

      <SourcesManagerModal
        isOpen={showSourcesManager}
        onClose={() => setShowSourcesManager(false)}
      />
    </div>
  );
}

export default App;
