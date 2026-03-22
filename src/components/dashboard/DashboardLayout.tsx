import type { ReactNode } from 'react';
import {
  Bell,
  BookOpenText,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  Trash2,
} from 'lucide-react';
import type { LegalModalType } from '../layout/LegalModals';

type DashboardSidebarView = 'dashboard' | 'profiles' | 'trash';
type DashboardSidebarAction = DashboardSidebarView | 'settings';

interface DashboardLayoutProps {
  children: ReactNode;
  userName?: string | null;
  activeSidebarView?: DashboardSidebarView;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSidebarAction?: (action: DashboardSidebarAction) => void;
  onOpenLegalModal?: (modal: Extract<LegalModalType, 'impressum' | 'datenschutz'>) => void;
}

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'profiles', label: 'Meine Fächer', icon: BookOpenText },
  { key: 'trash', label: 'Papierkorb', icon: Trash2 },
  { key: 'settings', label: 'Einstellungen', icon: Settings },
] as const;

const legalLinks = [
  { key: 'impressum', label: 'Impressum' },
  { key: 'datenschutz', label: 'Datenschutz' },
] as const;
const FALLBACK_USER_NAME = 'Empty Bot';

function resolveUserName(userName?: string | null): string {
  const trimmed = userName?.trim();
  return trimmed ? trimmed : FALLBACK_USER_NAME;
}

function getUserInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'EB';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function DashboardLayout({
  children,
  userName,
  activeSidebarView = 'dashboard',
  searchQuery,
  onSearchQueryChange,
  onSidebarAction,
  onOpenLegalModal,
}: DashboardLayoutProps) {
  const resolvedUserName = resolveUserName(userName);
  const userInitials = getUserInitials(resolvedUserName);

  return (
    <div className="h-screen overflow-hidden bg-slate-900 text-slate-100">
      <div className="flex h-full">
        <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
          <div className="border-b border-slate-800 px-5 py-5">
            <div className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100">
              <span className="h-2 w-2 rounded-full bg-teal-400" />
              Dashboard
            </div>
          </div>

          <nav className="flex flex-1 flex-col px-3 py-4">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.key !== 'settings' && activeSidebarView === item.key;

                return (
                  <li key={item.label}>
                    <button
                      type="button"
                      onClick={() => onSidebarAction?.(item.key)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                        isActive
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-auto space-y-2 border-t border-slate-800 pt-4">
              {legalLinks.map((link) => (
                <button
                  key={link.key}
                  type="button"
                  onClick={() => onOpenLegalModal?.(link.key)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
                >
                  {link.label}
                </button>
              ))}
            </div>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-800 bg-slate-900/90 px-8 py-4 backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="relative max-w-2xl flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  placeholder="Alle Dokumente durchsuchen"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                aria-label="Nachrichten"
              >
                <MessageSquare className="h-4 w-4" />
              </button>

              <button
                type="button"
                className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                aria-label="Benachrichtigungen"
              >
                <Bell className="h-4 w-4" />
              </button>

              <button
                type="button"
                className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 transition hover:bg-slate-700"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-600 text-xs font-semibold">
                  {userInitials}
                </span>
                <span className="hidden sm:inline">{resolvedUserName}</span>
              </button>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-8 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
