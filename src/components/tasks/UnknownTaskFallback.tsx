import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ICON_SIZES } from '../ui/iconSizes';

interface UnknownTaskFallbackProps {
    type: string;
}

export const UnknownTaskFallback: React.FC<UnknownTaskFallbackProps> = ({ type }) => (
    <div className="p-4 border-2 border-dashed border-amber-400 rounded-lg bg-amber-50 flex items-center gap-3 print:bg-transparent print:border-none">
        <AlertTriangle className={`${ICON_SIZES[20]} text-amber-500 shrink-0`} />
        <p className="text-sm text-amber-700">
            Unbekannter Aufgabentyp: <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">{type}</code>
        </p>
    </div>
);
