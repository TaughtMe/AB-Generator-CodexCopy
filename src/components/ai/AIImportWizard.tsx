import React, { useState, useRef } from 'react';
import {
    X, Sparkles, Upload, CheckCircle, XCircle,
    BookOpen, GraduationCap, Loader2, AlertCircle, Cpu,
    SlidersHorizontal, Trash2,
} from 'lucide-react';
import {
    isActiveProviderConfigured,
    getActiveProviderLabel,
    type GenerateTasksOptions,
} from '../../services/aiService';
import { runAI } from '../../features/ai/runAI';
import { useProfileStore } from '../../store/profileStore';
import { useSettingsStore } from '../../store/settingsStore';
import { PROVIDER_MODEL_OPTIONS, getModelLabel } from '../../services/ai/modelCatalog';
import { useProviderModels } from '../../hooks/useProviderModels';
import type { Task } from '../../types/worksheet';

/* ══════════════════════════════════════════════════
   AIImportWizard – KI-gestützter Aufgaben-Import
   Logische Sektionen: Kontext → Input → Steuerung → Ergebnis
   ══════════════════════════════════════════════════ */

interface AIImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onImport?: (tasks: Omit<Task, 'id'>[]) => void;
}

type WizardPhase = 'input' | 'generating' | 'results';

const DIFFICULTY_OPTIONS = [
    { value: 'leicht', label: 'Leicht', emoji: '🟢' },
    { value: 'mittel', label: 'Mittel', emoji: '🟡' },
    { value: 'schwer', label: 'Schwer', emoji: '🔴' },
];

export const AIImportWizard: React.FC<AIImportWizardProps> = ({
    isOpen, onClose, onImport,
}) => {
    // ── Stores ──
    const { subjects, classes } = useProfileStore();
    const { aiProvider, providers, setProviderModel } = useSettingsStore();

    // ── Local State ──
    const [phase, setPhase] = useState<WizardPhase>('input');
    const [topic, setTopic] = useState('');
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('');
    const [difficulty, setDifficulty] = useState('mittel');
    const [taskCount, setTaskCount] = useState(4);
    const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
    const [screenshotName, setScreenshotName] = useState<string | null>(null);
    const [generatedTasks, setGeneratedTasks] = useState<Omit<Task, 'id'>[]>([]);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Derived ──
    const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
    const selectedClass = classes.find((c) => c.id === selectedClassId);
    const activeConfig = providers[aiProvider];
    const { models: detectedProviderModels } = useProviderModels(aiProvider, isOpen);
    const mergedGeminiModels = aiProvider === 'gemini'
        ? Array.from(
            new Map([...detectedProviderModels, ...PROVIDER_MODEL_OPTIONS.gemini].map((option) => [option.value, option])).values(),
        )
        : PROVIDER_MODEL_OPTIONS.gemini;
    const modelOptions = aiProvider === 'gemini'
        ? mergedGeminiModels
        : detectedProviderModels.length > 0
            ? detectedProviderModels
            : PROVIDER_MODEL_OPTIONS[aiProvider];
    const selectedModelIds = activeConfig.selectedModelIds ?? [];
    const favoriteModelOptions = modelOptions.filter((option) => selectedModelIds.includes(option.value));
    const editorModelOptions = favoriteModelOptions.length > 0 ? favoriteModelOptions : modelOptions;
    const providerReady = isActiveProviderConfigured();
    const canGenerate = providerReady && topic.trim().length > 0;

    // ── Handlers ──
    function handleReset() {
        setPhase('input');
        setTopic('');
        setSelectedSubjectId('');
        setSelectedClassId('');
        setDifficulty('mittel');
        setTaskCount(4);
        setScreenshotBase64(null);
        setScreenshotName(null);
        setGeneratedTasks([]);
        setError(null);
    }

    function handleClose() {
        handleReset();
        onClose();
    }

    function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            setScreenshotBase64(base64);
            setScreenshotName(file.name);
        };
        reader.readAsDataURL(file);
    }

    async function handleGenerate() {
        if (!canGenerate) return;

        setPhase('generating');
        setError(null);

        try {
            const opts: GenerateTasksOptions = {
                topic,
                classLevel: selectedClass?.name || 'Klasse 5',
                difficultyLevel: difficulty,
                taskCount,
                subjectName: selectedSubject?.name,
                curriculumText: selectedSubject?.curriculumText,
                className: selectedClass?.name,
                classCharacteristic: selectedClass?.characteristic,
                screenshotBase64: screenshotBase64 || undefined,
            };

            const { output: tasks } = await runAI({
                route: 'worksheetGeneration',
                input: { mode: 'options', options: opts },
            });
            setGeneratedTasks(tasks);
            setPhase('results');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
            setPhase('input');
        }
    }

    function handleImport() {
        if (generatedTasks.length > 0 && onImport) {
            onImport(generatedTasks);
        }
        handleClose();
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
                {/* Gradient Top Bar */}
                <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500" />

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
                            <Sparkles size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                KI-Import
                            </h2>
                            <p className="text-[10px] text-slate-400">
                                {phase === 'input' && 'Aufgaben generieren'}
                                {phase === 'generating' && 'Generiere...'}
                                {phase === 'results' && `${generatedTasks.length} Aufgaben erstellt`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">

                    {/* ═══ API Key Warning ═══ */}
                    {!providerReady && (
                        <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                            <div className="text-xs text-red-600 dark:text-red-400">
                                <p className="font-semibold">KI nicht vollständig konfiguriert</p>
                                <p className="mt-0.5">
                                    Bitte zuerst die Einstellungen im Dashboard öffnen und dort die Daten für {getActiveProviderLabel()} hinterlegen.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ═══ Error ═══ */}
                    {error && (
                        <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                            <div className="text-xs text-amber-700 dark:text-amber-400">
                                <p className="font-semibold">Fehler</p>
                                <p className="mt-0.5">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* ═══ PHASE: INPUT ═══ */}
                    {phase === 'input' && (
                        <>
                            {/* ── SEKTION 1: Kontext ── */}
                            <div className="space-y-3">
                                <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <BookOpen size={12} />
                                    Kontext
                                </h3>

                                <div className="grid grid-cols-2 gap-3">
                                    {/* Subject Dropdown */}
                                    <div>
                                        <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 block">
                                            Fach
                                        </label>
                                        <select
                                            value={selectedSubjectId}
                                            onChange={(e) => setSelectedSubjectId(e.target.value)}
                                            className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-700 dark:text-slate-300 cursor-pointer"
                                        >
                                            <option value="">– Kein Fach –</option>
                                            {subjects.map((s) => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Class Dropdown */}
                                    <div>
                                        <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 block">
                                            Klasse
                                        </label>
                                        <select
                                            value={selectedClassId}
                                            onChange={(e) => setSelectedClassId(e.target.value)}
                                            className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-700 dark:text-slate-300 cursor-pointer"
                                        >
                                            <option value="">– Keine Klasse –</option>
                                            {classes.map((c) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* ── SEKTION 2: Input ── */}
                            <div className="space-y-3">
                                <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <GraduationCap size={12} />
                                    Thema & Material
                                </h3>

                                {/* Topic text area */}
                                <textarea
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="Beschreibe das Thema, z.B. 'Photosynthese bei Pflanzen – Grundlagen und Ablauf' oder 'Addition und Subtraktion bis 100'..."
                                    rows={4}
                                    className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-700 dark:text-slate-300 resize-none placeholder:text-slate-400"
                                />

                                {/* Image upload */}
                                <div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="hidden"
                                    />
                                    {screenshotBase64 ? (
                                        <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                            <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                                            <span className="text-xs text-emerald-700 dark:text-emerald-400 truncate flex-1">
                                                {screenshotName}
                                            </span>
                                            <button
                                                onClick={() => { setScreenshotBase64(null); setScreenshotName(null); }}
                                                className="p-1 text-emerald-500 hover:text-red-500 transition-colors cursor-pointer"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex items-center gap-2 w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-400 transition-all cursor-pointer"
                                        >
                                            <Upload size={14} />
                                            Bild/Screenshot hochladen (optional)
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* ── SEKTION 3: Steuerung ── */}
                            <div className="space-y-3">
                                <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <SlidersHorizontal size={12} />
                                    Steuerung
                                </h3>

                                {/* Difficulty */}
                                <div>
                                    <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">
                                        Schwierigkeit
                                    </label>
                                    <div className="flex gap-1.5">
                                        {DIFFICULTY_OPTIONS.map(({ value, label, emoji }) => (
                                            <button
                                                key={value}
                                                onClick={() => setDifficulty(value)}
                                                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer border ${difficulty === value
                                                    ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                    }`}
                                            >
                                                {emoji} {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Task Count Slider */}
                                <div>
                                    <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
                                        <span>Anzahl Aufgaben</span>
                                        <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{taskCount}</span>
                                    </label>
                                    <input
                                        type="range"
                                        min={1}
                                        max={10}
                                        value={taskCount}
                                        onChange={(e) => setTaskCount(Number(e.target.value))}
                                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                    />
                                    <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                                        <span>1</span>
                                        <span>5</span>
                                        <span>10</span>
                                    </div>
                                </div>

                                {/* Model Selection */}
                                <div>
                                    <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                                        <Cpu size={10} />
                                        KI-Modell
                                    </label>
                                    <div className="flex gap-1.5">
                                        {editorModelOptions.map(({ value, label, desc }) => (
                                            <button
                                                key={value}
                                                onClick={() => setProviderModel(aiProvider, value)}
                                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer border ${activeConfig.model === value
                                                    ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                    }`}
                                            >
                                                {activeConfig.model === value && <CheckCircle size={12} />}
                                                {label}
                                                <span className="text-[9px] opacity-60">({desc})</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ═══ PHASE: GENERATING ═══ */}
                    {phase === 'generating' && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg">
                                    <Sparkles size={28} className="text-white animate-pulse" />
                                </div>
                                <Loader2 size={20} className="absolute -bottom-1 -right-1 text-purple-500 animate-spin" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Generiere {taskCount} Aufgaben...
                                </p>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    {getActiveProviderLabel()} · {getModelLabel(aiProvider, activeConfig.model)}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ═══ PHASE: RESULTS ═══ */}
                    {phase === 'results' && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle size={16} className="text-emerald-500" />
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                    {generatedTasks.length} Aufgaben generiert
                                </span>
                            </div>

                            {generatedTasks.map((task, index) => (
                                <div
                                    key={index}
                                    className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-purple-500 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">
                                            {task.type}
                                        </span>
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                                            {task.title}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
                    {phase === 'results' ? (
                        <>
                            <button
                                onClick={() => setPhase('input')}
                                className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                            >
                                Zurück
                            </button>
                            <button
                                onClick={handleImport}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-sm hover:shadow"
                            >
                                {generatedTasks.length} Aufgaben importieren
                            </button>
                        </>
                    ) : phase === 'input' ? (
                        <>
                            <button
                                onClick={handleClose}
                                className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={!canGenerate}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-sm hover:shadow flex items-center gap-1.5"
                            >
                                <Sparkles size={13} />
                                Generieren
                            </button>
                        </>
                    ) : (
                        <div className="w-full text-center text-[10px] text-slate-400">
                            Bitte warten...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
