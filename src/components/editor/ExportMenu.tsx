import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { ICON_SIZES } from '../ui/iconSizes';

export type ExportFormat = 'abgen' | 'pdf' | 'docx';
export type ExportVariant = 'student' | 'teacher';

export interface ExportMenuProps {
    hasTasks: boolean;
    onExportAbgen: () => void | Promise<void>;
    onExportPdf: (variants: ExportVariant[]) => void | Promise<void>;
    onExportDocx: (variants: ExportVariant[]) => void | Promise<void>;
    isAbgenExporting?: boolean;
    isAbgenSharing?: boolean;
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
    abgen: '.abgen (Daten)',
    pdf: 'PDF',
    docx: 'Word (.docx)',
};

const VARIANT_LABELS: Record<ExportVariant, string> = {
    student: 'Schülerversion',
    teacher: 'Lehrerversion (mit Lösungen)',
};

export function ExportMenu({
    hasTasks,
    onExportAbgen,
    onExportPdf,
    onExportDocx,
    isAbgenExporting = false,
    isAbgenSharing = false,
}: ExportMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [format, setFormat] = useState<ExportFormat>('pdf');
    const [includeStudent, setIncludeStudent] = useState(true);
    const [includeTeacher, setIncludeTeacher] = useState(false);
    const wrapperRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointer = (event: MouseEvent) => {
            if (!wrapperRef.current) return;
            if (!wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointer);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handlePointer);
            document.removeEventListener('keydown', handleKey);
        };
    }, [isOpen]);

    const selectedVariants: ExportVariant[] = [
        ...(includeStudent ? (['student'] as ExportVariant[]) : []),
        ...(includeTeacher ? (['teacher'] as ExportVariant[]) : []),
    ];

    const isAbgenBusy = isAbgenExporting || isAbgenSharing;
    const requiresVariants = format !== 'abgen';
    const canExport = hasTasks
        && (!requiresVariants || selectedVariants.length > 0)
        && (format !== 'abgen' || !isAbgenBusy);

    const handleExport = async () => {
        if (!canExport) return;

        if (format === 'abgen') {
            await onExportAbgen();
        } else if (format === 'pdf') {
            await onExportPdf(selectedVariants);
        } else {
            await onExportDocx(selectedVariants);
        }

        setIsOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative">
            <button
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all text-xs font-medium cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
                title="Exportmenü öffnen"
                disabled={!hasTasks}
            >
                <Download className={ICON_SIZES[14]} />
                <span>Exportieren</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3 z-50">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                        Format wählen
                    </div>
                    <div className="grid gap-1">
                        {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setFormat(key)}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                    format === key
                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                <span>{FORMAT_LABELS[key]}</span>
                                {format === key && (
                                    <span className="text-[10px] font-semibold">Aktiv</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {requiresVariants && (
                        <div className="mt-3">
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                                Version
                            </div>
                            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={includeStudent}
                                    onChange={(event) => setIncludeStudent(event.target.checked)}
                                    className="accent-blue-500"
                                />
                                {VARIANT_LABELS.student}
                            </label>
                            <label className="mt-2 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={includeTeacher}
                                    onChange={(event) => setIncludeTeacher(event.target.checked)}
                                    className="accent-blue-500"
                                />
                                {VARIANT_LABELS.teacher}
                            </label>
                        </div>
                    )}

                    <div className="mt-4 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                            {requiresVariants && selectedVariants.length === 0
                                ? 'Mindestens eine Version wählen'
                                : format === 'abgen' && isAbgenBusy
                                    ? 'ABGEN-Export läuft'
                                    : ''}
                        </span>
                        <button
                            onClick={handleExport}
                            disabled={!canExport}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Export starten
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
