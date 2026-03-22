import { AlertTriangle } from 'lucide-react';

interface ErrorFallbackProps {
  error: unknown;
  resetErrorBoundary: () => void;
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-slate-200 p-8">
      <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
      <h1 className="text-2xl font-bold mb-2">Ein Fehler ist aufgetreten</h1>
      <pre className="bg-slate-800 p-4 rounded text-red-400 font-mono text-sm max-w-2xl w-full overflow-auto max-h-48">
        {errorMessage}
      </pre>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="mt-6 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded text-white transition-colors"
      >
        App neu laden
      </button>
    </div>
  );
}
