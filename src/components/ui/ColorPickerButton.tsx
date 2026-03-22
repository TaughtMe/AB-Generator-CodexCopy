import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

interface ColorPickerButtonProps {
    color: string | null;
    onChange: (newColor: string) => void;
}

const QUICK_COLORS = [
    '#000000',
    '#374151',
    '#6b7280',
    '#9ca3af',
    '#d1d5db',
    '#ffffff',
    '#b91c1c',
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#eab308',
    '#22c55e',
    '#16a34a',
    '#0ea5e9',
    '#3b82f6',
    '#1d4ed8',
    '#8b5cf6',
    '#a855f7',
];

function normalizeHexColor(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;

    if (/^#[0-9a-f]{6}$/i.test(prefixed)) {
        return prefixed.toLowerCase();
    }

    if (/^#[0-9a-f]{3}$/i.test(prefixed)) {
        const [, r, g, b] = prefixed;
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }

    return null;
}

export function ColorPickerButton({ color, onChange }: ColorPickerButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [lastSelectedColor, setLastSelectedColor] = useState('#000000');
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!color) return;
        const normalized = normalizeHexColor(color);
        if (normalized) {
            setLastSelectedColor(normalized);
        }
    }, [color]);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (rootRef.current?.contains(target)) return;
            setIsOpen(false);
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [isOpen]);

    const applyColor = (newColor: string) => {
        const normalized = normalizeHexColor(newColor) ?? '#000000';
        setLastSelectedColor(normalized);
        onChange(normalized);
        setIsOpen(false);
    };

    const pickerValue = normalizeHexColor(lastSelectedColor) ?? '#000000';

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    onChange(pickerValue);
                    setIsOpen((prev) => !prev);
                }}
                title="Textfarbe"
                aria-label="Textfarbe"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/70',
                    'shadow-inner transition-colors hover:border-slate-500',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500/40',
                )}
                style={{ backgroundColor: pickerValue }}
            >
                <span
                    className="h-2.5 w-2.5 rounded-full bg-white/75 shadow-sm mix-blend-soft-light"
                    aria-hidden="true"
                />
            </button>

            {isOpen && (
                <div
                    className="absolute top-full left-1/2 z-50 mt-2 w-44 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2 shadow-lg"
                    role="dialog"
                    aria-label="Farbpalette"
                >
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Eigene Farbe
                        </span>
                        <input
                            type="color"
                            value={pickerValue}
                            onChange={(e) => applyColor(e.target.value)}
                            className="h-7 w-10 cursor-pointer rounded border border-slate-300 bg-transparent p-0"
                            aria-label="Farbe wählen"
                        />
                    </div>

                    <div className="grid grid-cols-6 gap-1">
                        {QUICK_COLORS.map((preset) => {
                            const isActive = preset === pickerValue;
                            return (
                                <button
                                    key={preset}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => applyColor(preset)}
                                    className={clsx(
                                        'h-6 w-6 rounded-full border transition-transform hover:scale-105',
                                        isActive ? 'border-blue-500 ring-1 ring-blue-300' : 'border-slate-300',
                                    )}
                                    style={{ backgroundColor: preset }}
                                    title={preset}
                                    aria-label={`Farbe ${preset}`}
                                    aria-pressed={isActive}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
