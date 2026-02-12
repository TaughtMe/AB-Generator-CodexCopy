import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface UnknownTaskFallbackProps {
    type: string;
}

export const UnknownTaskFallback: React.FC<UnknownTaskFallbackProps> = ({ type }) => (
    <div className="p-4 border-2 border-dashed border-amber-400 dark:border-amber-600 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center gap-3">
        <AlertTriangle size={20} className="text-amber-500 shrink-0" />
        <p className="text-sm text-amber-700 dark:text-amber-300">
            Unbekannter Aufgabentyp: <code className="bg-amber-100 dark:bg-amber-800/40 px-1.5 py-0.5 rounded text-xs font-mono">{type}</code>
        </p>
    </div>
);
