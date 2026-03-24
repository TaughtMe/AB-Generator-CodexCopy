import type { ReactNode } from 'react';
import { Sidebar, type SidebarView } from '../layout/Sidebar';
import { LegalModals, type LegalModalType } from '../layout/LegalModals';
import { useState } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  activeView: SidebarView;
  onChangeView: (view: SidebarView) => void;
}

export function DashboardLayout({
  children,
  activeView,
  onChangeView,
}: DashboardLayoutProps) {
  const [activeLegalModal, setActiveLegalModal] = useState<LegalModalType | null>(null);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-200">
      <Sidebar
        activeView={activeView}
        onChangeView={onChangeView}
        onOpenLegalModal={(modal) => setActiveLegalModal(modal)}
      />
      <main className="flex-1 overflow-auto relative">{children}</main>
      <LegalModals
        activeModal={activeLegalModal}
        onClose={() => setActiveLegalModal(null)}
      />
    </div>
  );
}
