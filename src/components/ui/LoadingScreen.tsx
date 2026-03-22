export function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-slate-200">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
      <p className="mt-4 text-sm">Arbeitsblatt wird geladen…</p>
    </div>
  );
}
