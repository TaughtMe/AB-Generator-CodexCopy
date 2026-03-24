import { Plus, Sparkles } from 'lucide-react';

interface QuickActionsProps {
  onCreateWorksheet?: () => void;
  onOpenAssistant?: () => void;
}

export function QuickActions({ onCreateWorksheet, onOpenAssistant }: QuickActionsProps) {
  return (
    <section>
      <h1 className="mb-6 text-3xl font-bold text-slate-900 dark:text-white">Willkommen zurück!</h1>

      <div className="flex flex-col gap-4 lg:flex-row">
        <button
          type="button"
          onClick={onCreateWorksheet}
          className="flex flex-1 items-center gap-4 rounded-2xl bg-gradient-to-r from-teal-400 to-emerald-500 px-6 py-6 text-left text-white shadow-sm transition hover:opacity-95"
        >
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Plus className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-3xl font-bold leading-tight">Neues Arbeitsblatt</span>
            <span className="mt-1 block text-sm text-white/90">
              Schnell ein neues Blatt starten.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenAssistant}
          className="flex flex-1 items-center gap-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-6 text-left text-white shadow-sm transition hover:opacity-95"
        >
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Sparkles className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-3xl font-bold leading-tight">KI-Assistent</span>
            <span className="mt-1 block text-sm text-white/90">
              Letztes Blatt mit KI verfeinern.
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}
