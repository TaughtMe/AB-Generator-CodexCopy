import React, { useEffect, useState } from 'react';
import { X, LayoutTemplate, Trash2, Pencil } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { DesignTemplate } from '../../types/designTemplate';
import { Modal } from '../ui/Modal';

interface TemplateGalleryProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenDesignEditor: () => void;
}

function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({ isOpen, onClose, onOpenDesignEditor }) => {
    const {
        designTemplates,
        loadDesignTemplates,
        removeDesignTemplate,
        applyTemplateToCurrentWorksheet,
        startTemplateEdit,
    } = useWorkspaceStore();

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
    const [isEditingId, setIsEditingId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        void (async () => {
            try {
                setErrorMessage(null);
                await loadDesignTemplates();
            } catch {
                setErrorMessage('Vorlagen konnten nicht geladen werden.');
            }
        })();
    }, [isOpen, loadDesignTemplates]);

    const handleDelete = async (template: DesignTemplate) => {
        const confirmed = window.confirm(`Vorlage "${template.name}" wirklich löschen?`);
        if (!confirmed) return;

        setIsDeletingId(template.id);
        try {
            await removeDesignTemplate(template.id);
            setErrorMessage(null);
        } catch {
            setErrorMessage('Vorlage konnte nicht gelöscht werden.');
        } finally {
            setIsDeletingId(null);
        }
    };

    const handleEdit = async (template: DesignTemplate) => {
        setIsEditingId(template.id);
        try {
            const ok = await applyTemplateToCurrentWorksheet(template.id);
            if (!ok) {
                setErrorMessage('Vorlage konnte nicht geladen werden.');
                return;
            }

            startTemplateEdit(template.id);
            onClose();
            onOpenDesignEditor();
        } catch {
            setErrorMessage('Vorlage konnte nicht geladen werden.');
        } finally {
            setIsEditingId(null);
        }
    };

    const handleRetry = () => {
        void (async () => {
            try {
                setErrorMessage(null);
                await loadDesignTemplates();
            } catch {
                setErrorMessage('Vorlagen konnten nicht geladen werden.');
            }
        })();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            ariaLabel="Vorlagen-Galerie"
            className="w-full max-w-4xl max-h-[85vh] bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
                <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 shrink-0" />

                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Vorlagen-Galerie
                        </h2>
                        <p className="text-[10px] text-slate-400">
                            Gespeicherte Design-Vorlagen verwalten
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer"
                    >
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    {errorMessage && (
                        <div className="text-center py-8 border border-red-200 dark:border-red-800/50 rounded-xl bg-red-50/60 dark:bg-red-950/20 mb-4">
                            <p className="text-sm text-red-600 dark:text-red-300">{errorMessage}</p>
                            <button
                                onClick={handleRetry}
                                className="mt-3 px-3 py-1.5 text-xs rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 cursor-pointer"
                            >
                                Erneut versuchen
                            </button>
                        </div>
                    )}

                    {!errorMessage && designTemplates.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-white/[0.06] rounded-2xl bg-white/50 dark:bg-white/[0.02]">
                            <LayoutTemplate size={34} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">Noch keine Vorlagen gespeichert.</p>
                        </div>
                    )}

                    {!errorMessage && designTemplates.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {designTemplates.map((template) => {
                                const isDeleting = isDeletingId === template.id;
                                const isEditing = isEditingId === template.id;
                                const isBusy = isDeleting || isEditing;

                                return (
                                    <article
                                        key={template.id}
                                        className="bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] rounded-xl overflow-hidden shadow-sm"
                                    >
                                        <div className="h-1" style={{ backgroundColor: template.design.brandColor }} />

                                        <div className="p-4">
                                            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                                {template.name}
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                Aktualisiert: {formatDate(template.updatedAt)}
                                            </p>

                                            <div className="mt-3 flex items-center gap-2">
                                                <button
                                                    onClick={() => void handleEdit(template)}
                                                    disabled={isBusy}
                                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs rounded-lg bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                                >
                                                    <Pencil size={12} />
                                                    {isEditing ? 'Lädt...' : 'Bearbeiten'}
                                                </button>

                                                <button
                                                    onClick={() => void handleDelete(template)}
                                                    disabled={isBusy}
                                                    className="px-2.5 py-2 text-xs rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                                    title="Vorlage löschen"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Modal>
    );
};
