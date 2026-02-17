import { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import {
  Moon, Sun, Plus, FileDown, GraduationCap, BookOpen,
  Sparkles, Image as ImageIcon, ChevronDown, Type, ListChecks, TextCursorInput,
  ArrowLeft, Printer, Save, Sigma, Palette, Settings,
  ZoomIn, ZoomOut, Scissors, Trash2,
} from 'lucide-react';
import { exportToDocx } from './utils/docxExport';

import { useWorksheetStore } from './store/worksheetStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useSettingsStore } from './store/settingsStore';
import { MultiPageContainer } from './components/layout/MultiPageContainer';
import { WorksheetHeader } from './components/layout/WorksheetHeader';
import { TaskEditorRenderer } from './components/tasks/TaskRegistry';
import { TaskCard } from './components/tasks/TaskCard';
import { AIImportWizard } from './components/ai/AIImportWizard';
import { GlobalSettingsModal } from './components/settings/GlobalSettingsModal';
import { Dashboard } from './components/dashboard/Dashboard';
import { DesignEditor } from './components/dashboard/DesignEditor';

import './styles/PrintStyles.css';

/* ─── Add-Task Dropdown Menu ─── */
const TASK_OPTIONS = [
  { type: 'lineatur' as const, label: 'Lineatur', desc: 'Schreiblinien & Kästchen', icon: Type },
  { type: 'multiple-choice' as const, label: 'Multiple Choice', desc: 'Antworten ankreuzen', icon: ListChecks },
  { type: 'cloze' as const, label: 'Lückentext', desc: 'Wörter ergänzen', icon: TextCursorInput },
  { type: 'image-placeholder' as const, label: 'Bild-Platzhalter', desc: 'Bild einfügen', icon: ImageIcon },
  { type: 'math' as const, label: 'Mathematik', desc: 'LaTeX-Formeln einfügen', icon: Sigma },
  { type: 'page-break' as const, label: 'Seitenumbruch', desc: 'Neue Seite in Word & PDF', icon: Scissors },
];

type AppView = 'dashboard' | 'editor';

function App() {
  const { title, taskIds, tasksById, addTask, addTasksFromAI, removeTask, reorderTasks, duplicateTask, isTeacherMode, toggleTeacherMode, showHeader, setShowHeader, setTitle } = useWorksheetStore();
  const saveCurrentWorksheet = useWorkspaceStore((s) => s.saveCurrentWorksheet);
  const { fontFamily, brandColor } = useSettingsStore();

  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  const [showAIWizard, setShowAIWizard] = useState(false);
  const [showDesignEditor, setShowDesignEditor] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    if (showAddMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAddMenu]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark((prev) => !prev);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id.toString());
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = taskIds.indexOf(active.id.toString());
      const newIndex = taskIds.indexOf(over.id.toString());
      const newOrder = arrayMove(taskIds, oldIndex, newIndex);
      reorderTasks(newOrder);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
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

  const handleBackToDashboard = async () => {
    // Auto-save before navigating away
    if (taskIds.length > 0) {
      await saveCurrentWorksheet();
    }
    setCurrentView('dashboard');
  };

  const activeTask = activeId ? tasksById[activeId] : null;

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
      {/* ── Toolbar ── */}
      <header className="no-print sticky top-0 z-30 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        <div className="max-w-[260mm] mx-auto px-5 py-2.5 flex items-center gap-2">

          {/* ─ Left: Back + Title ─ */}
          <div className="mr-auto flex items-center gap-2.5">
            <button
              onClick={handleBackToDashboard}
              className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
              title="Zurück zum Dashboard"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/60" />

            {/* Editable Title Input */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Arbeitsblatt-Name..."
              className="text-[13px] font-bold tracking-tight text-slate-800 dark:text-slate-100 bg-transparent border-0 border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none px-1 py-0.5 transition-colors min-w-0 w-40 sm:w-52"
            />
          </div>

          {/* ─ Center: Add + AI ─ */}
          <div className="flex items-center gap-1.5">
            {/* Add Task Dropdown */}
            <div className="relative" ref={addMenuRef}>
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className={`flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95 ${showAddMenu
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow'
                  }`}
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>Aufgabe</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${showAddMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {showAddMenu && (
                <div className="absolute top-full left-0 mt-1.5 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  {TASK_OPTIONS.map(({ type, label, desc, icon: Icon }) => (
                    <button
                      key={type}
                      onClick={() => { addTask(type); setShowAddMenu(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer text-left group"
                    >
                      <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                        <Icon size={14} className="text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* AI Import */}
            <button
              onClick={() => setShowAIWizard(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all text-xs font-semibold cursor-pointer shadow-sm hover:shadow-md active:scale-95"
            >
              <Sparkles size={13} />
              <span>KI-Import</span>
            </button>

            {/* Design Toggle */}
            <button
              onClick={() => {
                setShowHeader(!showHeader);
                if (!showHeader) setShowDesignEditor(true);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${showHeader
                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 ring-1 ring-violet-200 dark:ring-violet-800'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              title={showHeader ? 'Design-Header aktiv' : 'Design-Header aktivieren'}
            >
              <Palette size={13} />
              <span>Design</span>
            </button>
          </div>

          {/* ─ Separator ─ */}
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700/60 mx-1" />

          {/* ─ Right: Utilities ─ */}
          <div className="flex items-center gap-1">
            {/* Teacher Mode Toggle */}
            <button
              onClick={toggleTeacherMode}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${isTeacherMode
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              title={isTeacherMode ? 'Lehrer-Modus (Lösungen sichtbar)' : 'Schüler-Modus (Lösungen ausgeblendet)'}
            >
              {isTeacherMode ? <GraduationCap size={14} /> : <BookOpen size={14} />}
              {isTeacherMode ? 'Lehrer' : 'Schüler'}
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={taskIds.length === 0 || isSaving}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all text-xs font-medium cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
              title="Arbeitsblatt speichern"
            >
              <Save size={14} />
              <span>{isSaving ? '...' : 'Speichern'}</span>
            </button>

            {/* DOCX Export */}
            <button
              onClick={() => exportToDocx(title, tasksById, taskIds, isTeacherMode)}
              disabled={taskIds.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all text-xs font-medium cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
              title="Als Word-Datei exportieren"
            >
              <FileDown size={14} />
              <span>.docx</span>
            </button>

            {/* PDF Export */}
            <button
              onClick={handlePdfExport}
              disabled={taskIds.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all text-xs font-medium cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
              title="Als PDF exportieren (Druckdialog)"
            >
              <Printer size={14} />
              <span>PDF</span>
            </button>

            {/* Dark Mode */}
            <button
              onClick={toggleDark}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isDark ? 'Light Mode' : 'Dark Mode'}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Einstellungen"
            >
              <Settings size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Zoom Slider Bar ── */}
      <div className="no-print sticky top-[49px] z-20 flex items-center justify-center gap-2 py-1.5 px-4 bg-slate-50/80 dark:bg-slate-900/60 backdrop-blur border-b border-slate-200/50 dark:border-slate-800/50">
        <ZoomOut size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
        <input
          type="range"
          min={50}
          max={200}
          step={5}
          value={Math.round(zoomLevel * 100)}
          onChange={(e) => setZoomLevel(Number(e.target.value) / 100)}
          className="w-32 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <ZoomIn size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
        <button
          onClick={() => setZoomLevel(1)}
          className="px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer tabular-nums min-w-[3rem] text-center"
          title="Zoom zurücksetzen"
        >
          {Math.round(zoomLevel * 100)}%
        </button>
      </div>

      {/* ── Multi-Page A4 Worksheet ── */}
      <div
        className="overflow-x-auto"
        style={{
          paddingBottom: zoomLevel > 1 ? `${(zoomLevel - 1) * 100}vh` : undefined,
        }}
      >
        <div
          className="zoom-container"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
          }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
          >
            <SortableContext
              items={taskIds}
              strategy={verticalListSortingStrategy}
            >
              <MultiPageContainer fontFamily={fontFamily} brandColor={brandColor}>
                <WorksheetHeader />
                {taskIds.map((id, index) => {
                  const task = tasksById[id];
                  if (!task) return null;

                  // Page-break: render a visual divider, not a TaskCard
                  if (task.type === 'page-break') {
                    return (
                      <div
                        key={id}
                        className="page-break-task relative my-2"
                        style={{ breakAfter: 'page' }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-600" />
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-2 whitespace-nowrap flex items-center gap-1">
                            <Scissors size={10} />
                            Seitenumbruch
                          </span>
                          <div className="flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-600" />
                          <button
                            onClick={() => removeTask(id)}
                            className="p-0.5 text-slate-300 hover:text-red-500 transition-colors cursor-pointer no-print"
                            title="Seitenumbruch entfernen"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <TaskCard
                      key={id}
                      id={id}
                      task={task}
                      index={index}
                      onRemove={removeTask}
                      onDuplicate={duplicateTask}
                    >
                      <TaskEditorRenderer task={task} />
                    </TaskCard>
                  );
                })}
              </MultiPageContainer>
            </SortableContext>

            {/* Drag Overlay */}
            <DragOverlay>
              {activeTask ? (
                <div className="bg-white border-2 border-blue-500 rounded-lg shadow-2xl p-3 opacity-90 rotate-1">
                  <span className="text-xs font-medium text-blue-500">
                    {activeTask.type.replace('-', ' ')}
                  </span>
                  <p className="text-slate-700 text-xs mt-0.5 truncate">
                    {activeTask.title}
                  </p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

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
