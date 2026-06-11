import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { ExportVariant } from './types/export';
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
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import type { SidebarView } from './components/layout/Sidebar';
import { PrintWorksheet } from './components/print/PrintWorksheet';
import { ExportWarningsDialog } from './components/editor/ExportWarningsDialog';
import { EmptyWorksheetState } from './components/editor/EmptyWorksheetState';
import { validateForExport, type ValidationWarning } from './utils/exportValidator';
import './styles/PrintStyles.css';

function App() {
  const { t } = useTranslation();
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
  const setActiveTask = useWorksheetStore((state) => state.setActiveTask);

  const saveCurrentWorksheet = useWorkspaceStore((s) => s.saveCurrentWorksheet);
  const exportWorksheet = useWorkspaceStore((s) => s.exportWorksheet);
  const currentWorksheetId = useWorkspaceStore((s) => s.currentWorksheetId);
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
  const openTemplateGallery = useWorkspaceStore((s) => s.openTemplateGallery);
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
  const [isExporting, setIsExporting] = useState(false);
  /**
   * Gemessene Höhe des Editor-Headers (Ribbon + Variantenleiste).
   * Die Sidebars (Outline, KI-Chat) nutzen sie als CSS-Variable für
   * sticky-Offset und Höhe — vorher war "90px" hartkodiert, real sind es
   * je nach Umbruch ~200px, wodurch die Chat-Eingabe unter den Viewport
   * rutschte und nur per Scrollen erreichbar war.
   */
  const editorHeaderRef = useRef<HTMLDivElement | null>(null);
  const [editorHeaderHeight, setEditorHeaderHeight] = useState(90);
  const [printVariant, setPrintVariant] = useState<ExportVariant | null>(null);
  /** Ausstehender Export, der wegen Validierungswarnungen auf Bestätigung wartet. */
  const [pendingExport, setPendingExport] = useState<{
    label: string;
    warnings: ValidationWarning[];
    run: () => Promise<void> | void;
  } | null>(null);
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

  useEffect(() => {
    const el = editorHeaderRef.current;
    if (!el) return;
    const update = () => setEditorHeaderHeight(Math.ceil(el.getBoundingClientRect().height));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [currentView]);

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

  /**
   * PDF-Export über die dedizierte Druckansicht (PrintWorksheet).
   *
   * Ablauf:
   * 1. data-export-variant setzen (steuert Schüler-/Lehrer-Ansicht per CSS).
   * 2. PrintWorksheet via State mounten (Portal in #print-root).
   * 3. Auf vollständiges Rendern warten (Schriften, Tiptap, Bilder).
   * 4. window.print() → Browser erzeugt das PDF aus der sauberen Ansicht.
   *
   * WYSIWYG ohne Drift: PrintWorksheet nutzt dieselben Task-Komponenten wie
   * der Editor – es gibt keine zweite Render-Implementierung mehr.
   */
  const waitForPrintViewReady = async (): Promise<void> => {
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch { /* ignore */ }
    }
    // Two rAFs to let React flush all renders.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    // Wait for all <img> elements in #print-root to finish loading
    // (images are fetched async from IndexedDB and set as blob URLs).
    const printRoot = document.getElementById('print-root');
    if (printRoot) {
      const imgs = Array.from(printRoot.querySelectorAll('img'));
      const pending = imgs.filter((img) => !img.complete);
      if (pending.length > 0) {
        await Promise.all(pending.map(
          (img) => new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          }),
        ));
      }
    }

    // Extra settle for KaTeX math and other async content.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
  };

  const printAndAwait = (): Promise<void> => new Promise<void>((resolve) => {
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('afterprint', onAfterPrint);
      resolve();
    };
    const onAfterPrint = () => cleanup();
    const timeoutId = window.setTimeout(cleanup, 60000);
    window.addEventListener('afterprint', onAfterPrint, { once: true });
    window.print();
  });

  const handlePdfExport = async (variants: ExportVariant[]) => {
    if (taskIds.length === 0 || isExporting) return;
    setIsExporting(true);
    const html = document.documentElement;
    const previousVariant = html.dataset.exportVariant;
    try {
      for (const variant of variants) {
        html.dataset.exportVariant = variant;
        setPrintVariant(variant);
        await waitForPrintViewReady();

        // body.pdf-exporting aktiviert die @media-print-Regeln, die NUR beim
        // Drucken den Editor (#root) ausblenden und #print-root zeigen. Auf dem
        // Bildschirm bleibt #print-root durch sein inline display:none verborgen.
        document.body.classList.add('pdf-exporting');
        try {
          await printAndAwait();
        } finally {
          document.body.classList.remove('pdf-exporting');
        }
      }
    } finally {
      setPrintVariant(null);
      if (previousVariant) html.dataset.exportVariant = previousVariant;
      else delete html.dataset.exportVariant;
      setIsExporting(false);
    }
  };

  const handleDocxExport = async (variants: ExportVariant[]) => {
    if (taskIds.length === 0) return;
    const { exportToDocx } = await import('./utils/docx');
    for (const variant of variants) {
      await exportToDocx(title, tasksById, taskIds, variant === 'teacher');
    }
  };

  const handleAbgenExport = async () => {
    if (!currentWorksheetId) return;
    try {
      await exportWorksheet(currentWorksheetId);
    } catch (err) {
      console.error('[abgenExport] Fehler:', err);
      alert('Export fehlgeschlagen: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  /**
   * Validiert das Arbeitsblatt vor dem Export. Bei Warnungen öffnet sich der
   * ExportWarningsDialog (Liste + "Zur Aufgabe springen" + "Trotzdem
   * exportieren") statt eines window.confirm. Ohne Warnungen läuft der Export
   * direkt. Gilt für PDF und DOCX; .abgen ist eine Rohdatendatei und wird
   * bewusst nicht validiert.
   */
  const runGuardedExport = (label: string, run: () => Promise<void> | void) => {
    const warnings = validateForExport(tasksById, taskIds);
    if (warnings.length === 0) {
      void run();
      return;
    }
    setPendingExport({ label, warnings, run });
  };

  const variantLabel = (variants: ExportVariant[]) =>
    variants.map((v) => (v === 'teacher' ? 'Lehrer' : 'Schüler')).join(' + ');

  const handlePdfExportGuarded = (variants: ExportVariant[]) =>
    runGuardedExport(`PDF ${variantLabel(variants)}`, () => handlePdfExport(variants));

  const handleDocxExportGuarded = (variants: ExportVariant[]) =>
    runGuardedExport(`Word ${variantLabel(variants)}`, () => handleDocxExport(variants));

  const handleJumpToWarnedTask = (taskId: string) => {
    setPendingExport(null);
    setActiveTask(taskId);
    // Nach dem Schließen des Dialogs zur Aufgabe scrollen.
    window.setTimeout(() => {
      document
        .querySelector(`[data-task-id="${taskId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
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
    let label = t('editor.defaultVariant', { index });
    while (existingLabels.has(label)) {
      index += 1;
      label = t('editor.defaultVariant', { index });
    }
    addVariant(label, 'duplicate-active');
  };

  const handleOnboardingCreate = useCallback(() => {
    createNewWorksheet();
    setCurrentView('editor');
  }, [createNewWorksheet, setCurrentView]);

  /* ── Shared onboarding (lives across view switches) ── */
  const onboardingElement = (
    <OnboardingFlow
      currentView={currentView}
      onCreateAndOpenEditor={handleOnboardingCreate}
    />
  );

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
        {onboardingElement}
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
    <div
      className="min-h-screen pb-32 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
      style={{ ['--editor-header-h' as string]: `${editorHeaderHeight}px` }}
    >
      {onboardingElement}
      {printVariant && <PrintWorksheet />}
      {pendingExport && (
        <ExportWarningsDialog
          warnings={pendingExport.warnings}
          exportLabel={pendingExport.label}
          onJumpToTask={handleJumpToWarnedTask}
          onExportAnyway={() => {
            const run = pendingExport.run;
            setPendingExport(null);
            void run();
          }}
          onCancel={() => setPendingExport(null)}
        />
      )}
      <div ref={editorHeaderRef}>
        <RibbonToolbar
          onBackToDashboard={handleBackToDashboard}
          onSave={handleSave}
          isSaving={isSaving}
          hasTasks={taskIds.length > 0}
          isExporting={isExporting}
          onExportPdf={handlePdfExportGuarded}
          onExportDocx={handleDocxExportGuarded}
          onExportAbgen={handleAbgenExport}
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
      </div>

      <div className="lg:flex lg:items-stretch">
        {/* Outline-Navigator (linke Sidebar) */}
        <div
          className={`no-print hidden lg:block shrink-0 h-[calc(100dvh-var(--editor-header-h))] sticky top-[var(--editor-header-h)] transition-all duration-200 ease-in-out overflow-hidden ${
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

        <div className="flex-1 min-w-0 pb-28">
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
            emptySlot={
              <EmptyWorksheetState
                onAddFirstTask={startPlacingTask}
                onOpenAiChat={() => { if (!isAiSidebarOpen) toggleAiSidebar(); }}
                onOpenTemplates={openTemplateGallery}
              />
            }
          />
        </div>

        {isAiSidebarOpen && (
          <div className="no-print hidden lg:flex w-80 xl:w-96 shrink-0 min-h-0 h-[calc(100dvh-var(--editor-header-h))] sticky top-[var(--editor-header-h)] pl-2 pr-2 pb-2">
            <EditorChatSidebar onOpenSources={() => setShowSourcesManager(true)} />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={toggleAiSidebar}
        aria-label={isAiSidebarOpen ? t('app.closeAIChat') : t('app.openAIChat')}
        aria-pressed={isAiSidebarOpen}
        title={isAiSidebarOpen ? t('app.hideAIChat') : t('app.showAIChat')}
        className={`no-print hidden lg:flex fixed z-50 h-14 w-14 items-center justify-center rounded-full border text-white shadow-xl transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
          isAiSidebarOpen
            ? 'bottom-6 right-[21rem] xl:right-[25rem] bg-teal-500 dark:bg-purple-600 border-white/25 dark:border-white/10 hover:bg-teal-400 dark:hover:bg-purple-500 hover:-translate-y-0.5 hover:shadow-2xl active:scale-95'
            : 'bottom-6 right-6 bg-teal-500 dark:bg-purple-600 border-white/25 dark:border-white/10 hover:bg-teal-400 dark:hover:bg-purple-500 hover:-translate-y-0.5 hover:scale-105 hover:shadow-2xl active:scale-95'
        }`}
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <div
        className={`no-print fixed bottom-4 sm:bottom-6 lg:bottom-8 z-40 flex justify-center pointer-events-none ${
          isAiSidebarOpen
            ? 'left-0 right-0 lg:right-80 xl:right-96'
            : 'left-0 right-0'
        }`}
      >
        <div className="pointer-events-auto" data-floating-toolbar-anchor="true">
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
