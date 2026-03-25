import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  BookOpenText,
  Trash2,
  Settings,
  Sparkles,
  Check,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useShallow } from 'zustand/react/shallow';

export type SidebarView = 'dashboard' | 'profiles' | 'trash' | 'settings';

interface SidebarProps {
  activeView: SidebarView;
  onChangeView: (view: SidebarView) => void;
  onOpenSettings?: () => void;
  onOpenLegalModal?: (modal: 'impressum' | 'datenschutz') => void;
}

const NAV_ITEMS: { id: SidebarView; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'profiles', label: 'Meine Fächer', icon: BookOpenText },
  { id: 'trash', label: 'Papierkorb', icon: Trash2 },
  { id: 'settings', label: 'Einstellungen', icon: Settings },
];

const LEGAL_LINKS = [
  { key: 'impressum' as const, label: 'Impressum' },
  { key: 'datenschutz' as const, label: 'Datenschutz' },
];

const formatModelName = (rawId: string) => rawId.split('/').pop() || rawId;

export function Sidebar({ activeView, onChangeView, onOpenSettings, onOpenLegalModal }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { quickAccessModels, activeModel, setActiveModel } = useWorkspaceStore(
    useShallow((state) => ({
      quickAccessModels: state.quickAccessModels,
      activeModel: state.activeModel,
      setActiveModel: state.setActiveModel,
    })),
  );
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
  const isAiActive = quickAccessModels.length > 0;
  const activeModelLabel = useMemo(
    () => (isAiActive ? formatModelName(activeModel || quickAccessModels[0]) : 'Keine Modelle konfiguriert'),
    [activeModel, isAiActive, quickAccessModels],
  );

  return (
    <div
      className={`relative h-screen bg-white border-r border-slate-200 dark:bg-slate-950 dark:border-slate-800 transition-all duration-300 flex flex-col justify-between print:hidden ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Toggle button (bulge on right edge) */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-white border-y border-r border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-r-md flex items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 z-50"
      >
        {isCollapsed ? (
          <ChevronRight size={14} className="text-slate-500 dark:text-slate-400" />
        ) : (
          <ChevronLeft size={14} className="text-slate-500 dark:text-slate-400" />
        )}
      </button>

      {/* Top: Logo / Title + Navigation */}
      <div className="flex flex-col">
        <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-5">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (!isAiActive) return;
                setIsAiMenuOpen((prev) => !prev);
              }}
              disabled={!isAiActive}
              className={`flex items-center gap-3 w-full p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                isCollapsed ? 'justify-center' : ''
              } ${
                !isAiActive ? 'cursor-not-allowed opacity-80 hover:bg-slate-50 dark:hover:bg-slate-900/50' : ''
              }`}
              title={isCollapsed ? `KI-Assistent: ${activeModelLabel}` : undefined}
            >
              <Sparkles
                className={`shrink-0 w-5 h-5 ${
                  isAiActive ? 'text-emerald-400 animate-pulse' : 'text-red-500 dark:text-slate-400'
                }`}
              />

              {!isCollapsed && (
                <div className="flex flex-col items-start">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    KI-Assistent
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      isAiActive ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                    }`}
                  >
                    {isAiActive ? activeModelLabel : 'Keine Modelle konfiguriert'}
                  </span>
                </div>
              )}
            </button>

            {isAiMenuOpen && isAiActive && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAiMenuOpen(false);
                  }}
                />
                <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-200 shadow-xl dark:bg-slate-800 dark:border-slate-700 rounded-lg z-50 overflow-hidden">
                  {quickAccessModels.map((modelId) => (
                    <button
                      key={modelId}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModel(modelId);
                        setIsAiMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between ${
                        activeModel === modelId
                          ? 'text-emerald-600 dark:text-emerald-400 bg-slate-50 dark:bg-slate-700/50'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="truncate" title={modelId}>{formatModelName(modelId)}</span>
                      {activeModel === modelId && <Check size={16} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <nav className="px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (item.id === 'settings' && onOpenSettings) {
                        onOpenSettings();
                        return;
                      }
                      onChangeView(item.id);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition cursor-pointer ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!isCollapsed && item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Bottom: Legal links */}
      <div className="space-y-1 border-t border-slate-200 dark:border-slate-800 px-3 py-4">
        {LEGAL_LINKS.map((link) => (
          <button
            key={link.key}
            type="button"
            onClick={() => onOpenLegalModal?.(link.key)}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer ${
              isCollapsed ? 'text-center px-0' : ''
            }`}
            title={isCollapsed ? link.label : undefined}
          >
            {isCollapsed ? link.label.charAt(0) : link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
