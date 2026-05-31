import React, { useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Loader2, Terminal, X } from 'lucide-react';
import { useWorkspaceStore, type AgentPhase } from '../../store/workspaceStore';

type TrackerStep = {
  key: Exclude<AgentPhase, 'idle' | 'error'>;
  label: string;
};

const TRACKER_STEPS: TrackerStep[] = [
  { key: 'planning', label: 'Lehrplan-Analyse' },
  { key: 'creating', label: 'Arbeitsblatt-Kreation' },
  { key: 'validating', label: 'Didaktische Prüfung' },
  { key: 'success', label: 'Fertigstellung' },
];

export const AgentProgressTracker: React.FC = () => {
  const isAgentRunning = useWorkspaceStore((state) => state.isAgentRunning);
  const agentPhase = useWorkspaceStore((state) => state.agentPhase);
  const agentLogs = useWorkspaceStore((state) => state.agentLogs);
  const resetAgent = useWorkspaceStore((state) => state.resetAgent);
  const terminalRef = useRef<HTMLDivElement>(null);

  const isError = agentPhase === 'error';

  const activeStepIndex = useMemo(() => {
    if (isError) return -1;
    const index = TRACKER_STEPS.findIndex((step) => step.key === agentPhase);
    return index >= 0 ? index : 0;
  }, [agentPhase, isError]);

  useEffect(() => {
    const node = terminalRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [agentLogs]);

  if (!isAgentRunning && !isError) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <div className={`w-full max-w-3xl rounded-2xl border ${isError ? 'border-red-700/80' : 'border-slate-700/80'} bg-slate-950 text-slate-100 shadow-2xl`}>
        <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
          {isError ? (
            <AlertTriangle className="h-4 w-4 text-red-400" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
          )}
          <h2 className={`text-sm font-semibold tracking-wide ${isError ? 'text-red-300' : ''}`}>
            {isError ? 'Agent Fehler' : 'Agent Progress Tracker'}
          </h2>
          {isError && (
            <button
              onClick={() => resetAgent()}
              className="ml-auto inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Schließen"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="border-b border-slate-800 px-5 py-5">
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {TRACKER_STEPS.map((step, index) => {
              const isCompleted = !isError && (index < activeStepIndex || (agentPhase === 'success' && index === activeStepIndex));
              const isActive = !isError && index === activeStepIndex && agentPhase !== 'success';

              return (
                <li
                  key={step.key}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                    isError
                      ? 'border-red-700/40 bg-red-900/20 text-red-400'
                      : isCompleted
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : isActive
                          ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                  }`}
                >
                  {isError ? (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0" />
                  )}
                  <span className="text-xs font-medium">{step.label}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="px-5 py-5">
          <div className={`mb-2 flex items-center gap-2 text-xs ${isError ? 'text-red-300' : 'text-slate-300'}`}>
            <Terminal className="h-3.5 w-3.5" />
            <span>{isError ? 'Error Log' : 'Terminal'}</span>
          </div>
          <div
            ref={terminalRef}
            className={`h-56 overflow-y-auto rounded-lg border ${isError ? 'border-red-700' : 'border-slate-700'} bg-slate-900 p-3 font-mono text-xs`}
          >
            {agentLogs.length === 0 ? (
              <p className="text-slate-400">&gt; Warte auf Agenten-Logs...</p>
            ) : (
              agentLogs.map((entry, index) => (
                <p key={`${entry}-${index}`} className={`break-words leading-6 ${isError ? 'text-red-400' : 'text-green-400'}`}>
                  &gt; {entry}
                </p>
              ))
            )}
          </div>

          {isError && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => resetAgent()}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Schließen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
