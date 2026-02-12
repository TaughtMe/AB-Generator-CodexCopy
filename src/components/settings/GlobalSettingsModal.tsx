import React, { useState } from 'react';
import { X, Settings, Eye, EyeOff, KeyRound, CheckCircle, XCircle, Cpu } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';

/* ══════════════════════════════════════════════════
   GlobalSettingsModal – Einstellungen
   API-Key Verwaltung + Modell-Wahl.
   Profile werden im Dashboard konfiguriert.
   ══════════════════════════════════════════════════ */

interface GlobalSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MODEL_OPTIONS = [
    { value: 'flash' as const, label: 'Gemini 2.0 Flash', desc: 'Standard, schnell' },
    { value: 'pro' as const, label: 'Gemini 1.5 Pro', desc: 'Höhere Qualität' },
];

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({ isOpen, onClose }) => {
    const { apiKey, setApiKey, geminiModel, setGeminiModel } = useSettingsStore();
    const [showKey, setShowKey] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const hasApiKey = Boolean(apiKey.trim());

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                {/* Gradient Top Bar */}
                <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
                            <Settings size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                Einstellungen
                            </h2>
                            <p className="text-[10px] text-slate-400">
                                API-Key & KI-Modell
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-5">

                    {/* ── API-Key Status + Input ── */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                            <KeyRound size={12} />
                            Gemini API-Key
                        </label>

                        {/* Status Indicator */}
                        <div className="flex items-center gap-2 mb-2">
                            {hasApiKey ? (
                                <>
                                    <CheckCircle size={14} className="text-emerald-500" />
                                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                        Aktiv
                                    </span>
                                    <span className="text-[10px] text-slate-400 ml-1">
                                        •••• {apiKey.slice(-4)}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <XCircle size={14} className="text-red-400" />
                                    <span className="text-xs font-medium text-red-500 dark:text-red-400">
                                        Fehlt
                                    </span>
                                </>
                            )}

                            {!isEditing && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="ml-auto text-[10px] text-blue-500 hover:text-blue-600 font-medium cursor-pointer hover:underline"
                                >
                                    {hasApiKey ? 'Ändern' : 'Eingeben'}
                                </button>
                            )}
                        </div>

                        {/* Key Input (only when editing) */}
                        {isEditing && (
                            <div className="relative">
                                <input
                                    type={showKey ? 'text' : 'password'}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="API-Key einfügen..."
                                    className="w-full px-3 py-2.5 pr-10 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-700 dark:text-slate-300 font-mono"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                                >
                                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        )}

                        <p className="mt-1 text-[10px] text-slate-400">
                            Wird nur lokal gespeichert. Nie an Dritte übertragen.
                        </p>
                    </div>

                    {/* ── Model Selection ── */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                            <Cpu size={12} />
                            KI-Modell
                        </label>
                        <div className="space-y-1.5">
                            {MODEL_OPTIONS.map(({ value, label, desc }) => (
                                <button
                                    key={value}
                                    onClick={() => setGeminiModel(value)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-all cursor-pointer border ${geminiModel === value
                                            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 shadow-sm'
                                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    <div>
                                        <span className="font-medium">{label}</span>
                                        <span className="ml-2 text-[10px] opacity-60">{desc}</span>
                                    </div>
                                    {geminiModel === value && (
                                        <CheckCircle size={14} className="text-amber-500 shrink-0" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Info ── */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-[11px] text-blue-600 dark:text-blue-400">
                            💡 Fächer, Klassen und Lehrplan-Kontext werden im <strong>Dashboard</strong> unter „Profile" verwaltet.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <p className="text-[10px] text-slate-400">
                        Änderungen werden automatisch gespeichert.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-all cursor-pointer shadow-sm hover:shadow"
                    >
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    );
};
