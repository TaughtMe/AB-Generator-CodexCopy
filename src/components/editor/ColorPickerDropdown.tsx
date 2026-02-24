import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

interface ColorPickerDropdownProps {
    value: string;
    onChange: (color: string) => void;
    title?: string;
}

interface PaletteColor {
    label: string;
    value: string;
}

const COLOR_PALETTE: PaletteColor[] = [
    { label: 'Schwarz', value: '#000000' },
    { label: 'Grau 700', value: '#374151' },
    { label: 'Grau 500', value: '#6b7280' },
    { label: 'Grau 300', value: '#d1d5db' },
    { label: 'Grau 100', value: '#f3f4f6' },
    { label: 'Rot 700', value: '#b91c1c' },
    { label: 'Rot 500', value: '#ef4444' },
    { label: 'Rot 300', value: '#fca5a5' },
    { label: 'Orange 600', value: '#ea580c' },
    { label: 'Orange 300', value: '#fdba74' },
    { label: 'Gelb 600', value: '#ca8a04' },
    { label: 'Gelb 300', value: '#fde047' },
    { label: 'Grün 700', value: '#15803d' },
    { label: 'Grün 500', value: '#22c55e' },
    { label: 'Grün 300', value: '#86efac' },
    { label: 'Blau 700', value: '#1d4ed8' },
    { label: 'Blau 500', value: '#3b82f6' },
    { label: 'Blau 300', value: '#93c5fd' },
    { label: 'Violett 700', value: '#7e22ce' },
    { label: 'Violett 400', value: '#c084fc' },
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

export function ColorPickerDropdown({
    value,
    onChange,
    title = 'Textfarbe',
}: ColorPickerDropdownProps) {
    const [open, setOpen] = useState(false);
    const [alignRight, setAlignRight] = useState(false);
    const [customHexInput, setCustomHexInput] = useState(value);
    const rootRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setCustomHexInput(value);
    }, [value]);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (rootRef.current?.contains(target)) return;
            setOpen(false);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;

        const updateAlignment = () => {
            const rootRect = rootRef.current?.getBoundingClientRect();
            const panelRect = panelRef.current?.getBoundingClientRect();
            if (!rootRect || !panelRect) return;

            const viewportWidth = window.innerWidth;
            const wouldOverflowRight = rootRect.left + panelRect.width > viewportWidth - 8;
            const hasLeftSpace = rootRect.right - panelRect.width >= 8;

            setAlignRight(wouldOverflowRight && hasLeftSpace);
        };

        updateAlignment();
        window.addEventListener('resize', updateAlignment);
        return () => window.removeEventListener('resize', updateAlignment);
    }, [open]);

    const applyCustomHexColor = () => {
        const normalized = normalizeHexColor(customHexInput);
        if (!normalized) return;
        onChange(normalized);
        setCustomHexInput(normalized);
        setOpen(false);
    };

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setOpen((prev) => !prev)}
                className={clsx(
                    'h-7 w-8 rounded border border-slate-200 bg-white p-1',
                    'hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40',
                )}
                title={title}
                aria-label={title}
                aria-haspopup="dialog"
                aria-expanded={open}
            >
                <span
                    className="block h-5 w-5 rounded border border-slate-300"
                    style={{ backgroundColor: value }}
                    aria-hidden="true"
                />
            </button>

            {open && (
                <div
                    ref={panelRef}
                    className={clsx(
                        'absolute top-full z-30 mt-1 w-44 max-w-[calc(100vw-1rem)] rounded-md border border-slate-200 bg-white p-2 shadow-lg',
                        alignRight ? 'right-0' : 'left-0',
                    )}
                    role="dialog"
                    aria-label="Farbpalette"
                >
                    <div className="grid grid-cols-5 gap-1">
                        {COLOR_PALETTE.map((color) => {
                            const isActive = color.value.toLowerCase() === value.toLowerCase();

                            return (
                                <button
                                    key={color.value}
                                    type="button"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                        onChange(color.value);
                                        setOpen(false);
                                    }}
                                    className={clsx(
                                        'h-6 w-6 rounded border transition-shadow',
                                        'focus:outline-none focus:ring-2 focus:ring-blue-500/40',
                                        isActive ? 'border-blue-500 ring-1 ring-blue-300' : 'border-slate-200',
                                    )}
                                    style={{ backgroundColor: color.value }}
                                    title={color.label}
                                    aria-label={color.label}
                                    aria-pressed={isActive}
                                />
                            );
                        })}
                    </div>

                    <div className="mt-2 border-t border-slate-100 pt-2">
                        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                            HEX-Code
                        </label>
                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                value={customHexInput}
                                onChange={(event) => setCustomHexInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        applyCustomHexColor();
                                    }
                                }}
                                placeholder="#000000"
                                className={clsx(
                                    'h-7 min-w-0 flex-1 rounded border px-2 text-xs text-slate-700',
                                    normalizeHexColor(customHexInput) || !customHexInput.trim()
                                        ? 'border-slate-200'
                                        : 'border-red-300',
                                    'focus:outline-none focus:ring-2 focus:ring-blue-500/40',
                                )}
                                aria-label="Eigene Hex-Farbe eingeben"
                            />
                            <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={applyCustomHexColor}
                                disabled={!normalizeHexColor(customHexInput)}
                                className={clsx(
                                    'h-7 rounded border px-2 text-xs font-medium transition-colors',
                                    'focus:outline-none focus:ring-2 focus:ring-blue-500/40',
                                    normalizeHexColor(customHexInput)
                                        ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                        : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400',
                                )}
                            >
                                Setzen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
