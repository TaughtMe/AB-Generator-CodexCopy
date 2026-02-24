import React from 'react';
import { LayoutTemplate, Palette, Trash2 } from 'lucide-react';
import type { DesignTemplate } from '../../types/designTemplate';
import { ICON_SIZES } from '../ui/iconSizes';

interface TemplateGridProps {
    templates: DesignTemplate[];
    isApplyingId: string | null;
    isDeletingId: string | null;
    errorMessage: string | null;
    onRetry: () => void;
    onOpenDesignEditor: () => void;
    onApply: (id: string) => void;
    onDelete: (id: string) => void;
}

function previewInitial(template: DesignTemplate): string {
    return (
        template.design.logoText ||
        template.design.schoolName.charAt(0).toUpperCase() ||
        'S'
    );
}

function dateLabel(date: Date): string {
    return new Date(date).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function dateTimeLabel(date: Date): string {
    return new Date(date).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export const TemplateGrid: React.FC<TemplateGridProps> = ({
    templates,
    isApplyingId,
    isDeletingId,
    errorMessage,
    onRetry,
    onOpenDesignEditor,
    onApply,
    onDelete,
}) => {
    if (errorMessage) {
        return (
            <div className="text-center py-10 border border-red-200 dark:border-red-800/50 rounded-2xl bg-red-50/60 dark:bg-red-950/20">
                <p className="text-sm text-red-600 dark:text-red-300">{errorMessage}</p>
                <button
                    onClick={onRetry}
                    className="mt-3 px-3 py-1.5 text-xs rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 cursor-pointer"
                >
                    Erneut versuchen
                </button>
            </div>
        );
    }

    if (templates.length === 0) {
        return (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700/40 rounded-2xl bg-white/50 dark:bg-slate-800/20">
                <LayoutTemplate className={`${ICON_SIZES[34]} mx-auto text-slate-300 dark:text-slate-600 mb-3`} />
                <p className="text-sm text-slate-500 dark:text-slate-400">Noch keine Vorlagen gespeichert.</p>
                <button
                    onClick={onOpenDesignEditor}
                    className="mt-3 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                    Im Design-Editor Vorlage speichern
                </button>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => {
                const isApplying = isApplyingId === template.id;
                const isDeleting = isDeletingId === template.id;
                const isBusy = isApplying || isDeleting;

                return (
                    <article
                        key={template.id}
                        className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/50 rounded-xl overflow-hidden shadow-sm"
                    >
                        <div className="h-1" style={{ backgroundColor: template.design.brandColor }} />
                        <div className="p-4">
                            <div className="flex items-start gap-3 mb-3">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                                    style={{ backgroundColor: template.design.brandColor }}
                                >
                                    {previewInitial(template)}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{template.name}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                        {template.design.schoolName || 'Ohne Schulname'}
                                    </p>
                                    {template.lastUsedAt && (
                                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium">
                                            Zuletzt genutzt
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-3">
                                <Palette className={ICON_SIZES[12]} />
                                <span>{template.design.brandColor}</span>
                                <span>•</span>
                                <span>
                                    {template.lastUsedAt
                                        ? `Genutzt: ${dateTimeLabel(template.lastUsedAt)}`
                                        : `Aktualisiert: ${dateLabel(template.updatedAt)}`}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onApply(template.id)}
                                    disabled={isBusy}
                                    className="flex-1 px-2.5 py-2 text-xs rounded-lg bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {isApplying ? 'Wird angewendet...' : 'Anwenden'}
                                </button>

                                <button
                                    onClick={() => onDelete(template.id)}
                                    disabled={isBusy}
                                    className="px-2.5 py-2 text-xs rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    title="Vorlage löschen"
                                >
                                    <Trash2 className={ICON_SIZES[13]} />
                                </button>
                            </div>
                        </div>
                    </article>
                );
            })}
        </div>
    );
};
