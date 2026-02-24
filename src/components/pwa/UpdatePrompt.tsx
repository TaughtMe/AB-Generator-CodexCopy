import { Suspense, lazy } from 'react';

const UpdatePromptPwa = lazy(() => import('./UpdatePromptPwa'));

export function UpdatePrompt() {
  // In dev läuft der Vite-Server oft ohne neu geladenes PWA-Plugin.
  // Deshalb kein Zugriff auf das virtuelle Modul im Entwicklungsmodus.
  if (import.meta.env.DEV) return null;

  return (
    <Suspense fallback={null}>
      <UpdatePromptPwa />
    </Suspense>
  );
}
