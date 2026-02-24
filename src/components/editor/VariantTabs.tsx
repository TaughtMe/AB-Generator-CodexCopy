import { CheckCircle2, GripHorizontal, Layers3, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorksheetVariant } from '../../types/worksheet';
import { ICON_SIZES } from '../ui/iconSizes';

interface VariantTabsProps {
    variants: WorksheetVariant[];
    activeVariantId: string;
    onSelectVariant: (variantId: string) => void;
    onAddVariant: () => void;
    onRenameVariant: (variantId: string, label: string) => void;
    onReorderVariants: (variantIds: string[]) => void;
    onRemoveVariant: (variantId: string) => void;
}

export function VariantTabs({
    variants,
    activeVariantId,
    onSelectVariant,
    onAddVariant,
    onRenameVariant,
    onReorderVariants,
    onRemoveVariant,
}: VariantTabsProps) {
    const canRemoveVariants = variants.length > 1;
    const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
    const [draftLabel, setDraftLabel] = useState('');
    const [draggedVariantId, setDraggedVariantId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const variantIds = useMemo(() => variants.map((variant) => variant.id), [variants]);

    useEffect(() => {
        if (!editingVariantId) return;
        inputRef.current?.focus();
        inputRef.current?.select();
    }, [editingVariantId]);

    const commitRename = (variantId: string) => {
        const nextLabel = draftLabel.trim();
        const current = variants.find((variant) => variant.id === variantId);
        if (!current) {
            setEditingVariantId(null);
            return;
        }

        if (nextLabel && nextLabel !== current.label) {
            onRenameVariant(variantId, nextLabel);
        }
        setEditingVariantId(null);
    };

    const moveVariant = (fromId: string, toId: string) => {
        if (fromId === toId) return;
        const fromIndex = variantIds.indexOf(fromId);
        const toIndex = variantIds.indexOf(toId);
        if (fromIndex === -1 || toIndex === -1) return;

        const next = [...variantIds];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        onReorderVariants(next);
    };

    return (
        <div className="no-print sticky top-[52px] -mt-px z-20 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
            <div className="max-w-[260mm] mx-auto px-5 py-1.5 flex items-center gap-2 overflow-x-auto">
                <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 shrink-0">
                    <Layers3 className={ICON_SIZES[14]} />
                    <span className="hidden sm:inline">Varianten</span>
                </div>

                <div className="flex items-center gap-1 min-w-0">
                    {variants.map((variant) => {
                        const isActive = variant.id === activeVariantId;
                        return (
                            <div
                                key={variant.id}
                                draggable={editingVariantId !== variant.id}
                                onDragStart={(event) => {
                                    event.dataTransfer.setData('text/plain', variant.id);
                                    setDraggedVariantId(variant.id);
                                }}
                                onDragEnd={() => setDraggedVariantId(null)}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = 'move';
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    if (!draggedVariantId) return;
                                    moveVariant(draggedVariantId, variant.id);
                                    setDraggedVariantId(null);
                                }}
                                className={`inline-flex items-center gap-1.5 px-1.5 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                                    isActive
                                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-blue-500/10 dark:hover:text-blue-300 dark:hover:border-blue-500/30'
                                } ${draggedVariantId === variant.id ? 'opacity-60' : ''}`}
                            >
                                <span
                                    className="pl-1 text-slate-400 dark:text-slate-500 cursor-grab active:cursor-grabbing"
                                    title="Variante verschieben"
                                    aria-hidden="true"
                                >
                                    <GripHorizontal className={ICON_SIZES[12]} />
                                </span>
                                {editingVariantId === variant.id ? (
                                    <div className="inline-flex items-center gap-1.5 pl-1 pr-0.5">
                                        {isActive && <CheckCircle2 className={ICON_SIZES[14]} />}
                                        <input
                                            ref={inputRef}
                                            value={draftLabel}
                                            onChange={(event) => setDraftLabel(event.target.value)}
                                            onBlur={() => commitRename(variant.id)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    commitRename(variant.id);
                                                    return;
                                                }
                                                if (event.key === 'Escape') {
                                                    event.preventDefault();
                                                    setEditingVariantId(null);
                                                }
                                            }}
                                            className="w-24 bg-transparent border-b border-blue-300 dark:border-blue-500 outline-none"
                                            aria-label={`Variante ${variant.label} umbenennen`}
                                        />
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onSelectVariant(variant.id)}
                                        onDoubleClick={() => {
                                            setEditingVariantId(variant.id);
                                            setDraftLabel(variant.label);
                                        }}
                                        className="inline-flex items-center gap-1.5 pl-1 pr-0.5 cursor-pointer"
                                        title={`Variante ${variant.label}`}
                                        aria-pressed={isActive}
                                    >
                                        {isActive && <CheckCircle2 className={ICON_SIZES[14]} />}
                                        <span>{variant.label}</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!canRemoveVariants) return;
                                        onRemoveVariant(variant.id);
                                    }}
                                    disabled={!canRemoveVariants}
                                    className={`p-0.5 rounded-full transition-colors ${
                                        canRemoveVariants
                                            ? 'hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-500/20 dark:hover:text-red-300 cursor-pointer'
                                            : 'opacity-40 cursor-not-allowed'
                                    }`}
                                    title={canRemoveVariants ? `Variante "${variant.label}" entfernen` : 'Mindestens eine Variante muss bestehen bleiben'}
                                    aria-label={`Variante ${variant.label} entfernen`}
                                >
                                    <X className={ICON_SIZES[12]} />
                                </button>
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={onAddVariant}
                    className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                    title="Neue Variante aus aktueller Variante erstellen"
                >
                    <Plus className={ICON_SIZES[14]} />
                    <span>Variante</span>
                </button>
            </div>
        </div>
    );
}
