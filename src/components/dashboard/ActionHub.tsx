import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Sparkles, Palette, FolderOpen, RotateCcw } from 'lucide-react';

/* ══════════════════════════════════════════════════
   ActionHub.tsx – Prominente Start-Aktionen
   Zwei große Gradient-Karten + drei Quick-Link-Karten.
   ══════════════════════════════════════════════════ */

interface ActionHubProps {
    onNewWorksheet: () => void;
    onOpenAIChat: () => void;
    onOpenDesignEditor: () => void;
    onBrowseTemplates: () => void;
    onResumeLastWorksheet?: () => void;
    hasRecentWorksheet?: boolean;
}

export const ActionHub: React.FC<ActionHubProps> = ({
    onNewWorksheet,
    onOpenAIChat,
    onOpenDesignEditor,
    onBrowseTemplates,
    onResumeLastWorksheet,
    hasRecentWorksheet = false,
}) => {
    const { t } = useTranslation();
    return (
        <section className="mb-8">
            {/* ── Große Gradient-Karten ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                {/* Neues Arbeitsblatt erstellen */}
                <button
                    onClick={onNewWorksheet}
                    className="group relative flex items-center gap-5 p-7 bg-gradient-to-br from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 rounded-2xl shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/30 transition-all duration-200 cursor-pointer active:scale-[0.98] text-left overflow-hidden"
                >
                    {/* Subtle background pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute -right-4 -top-4 w-32 h-32 rounded-full bg-white/20" />
                        <div className="absolute -left-8 -bottom-8 w-40 h-40 rounded-full bg-white/10" />
                    </div>
                    <div className="relative p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
                        <Plus size={28} className="text-white" strokeWidth={2.5} />
                    </div>
                    <div className="relative">
                        <h3 className="text-lg font-bold text-white leading-tight">{t('actionHub.newWorksheet')}</h3>
                        <p className="text-xs text-white/70 mt-1">{t('actionHub.newWorksheetDesc')}</p>
                    </div>
                </button>

                {/* KI-Assistent starten */}
                <button
                    onClick={onOpenAIChat}
                    className="group relative flex items-center gap-5 p-7 bg-gradient-to-br from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 rounded-2xl shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-200 cursor-pointer active:scale-[0.98] text-left overflow-hidden"
                >
                    {/* Subtle background pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute -right-4 -top-4 w-32 h-32 rounded-full bg-white/20" />
                        <div className="absolute -left-8 -bottom-8 w-40 h-40 rounded-full bg-white/10" />
                    </div>
                    <div className="relative p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
                        <Sparkles size={28} className="text-white" />
                    </div>
                    <div className="relative">
                        <h3 className="text-lg font-bold text-white leading-tight">{t('actionHub.startAI')}</h3>
                        <p className="text-xs text-white/70 mt-1">{t('actionHub.startAIDesc')}</p>
                    </div>
                </button>
            </div>

            {/* ── Quick-Link-Karten (3er Reihe) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Vorlagen durchsuchen */}
                <button
                    onClick={onBrowseTemplates}
                    className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer text-left"
                >
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <FolderOpen size={17} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{t('actionHub.browseTemplates')}</span>
                </button>

                {/* Kopfzeilen-Editor öffnen */}
                <button
                    onClick={onOpenDesignEditor}
                    className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer text-left"
                >
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                        <Palette size={17} className="text-rose-600 dark:text-rose-400" />
                    </div>
                    <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{t('actionHub.openHeaderEditor')}</span>
                </button>

                {/* Letztes Blatt fortsetzen */}
                <button
                    onClick={onResumeLastWorksheet}
                    disabled={!hasRecentWorksheet}
                    className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0"
                >
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <RotateCcw size={17} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{t('actionHub.resumeLast')}</span>
                </button>
            </div>
        </section>
    );
};
