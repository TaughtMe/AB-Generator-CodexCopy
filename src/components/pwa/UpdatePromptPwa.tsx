import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { backupBeforeUpdate } from '../../services/cloudSyncService';

export default function UpdatePromptPwa() {
  const [isReloading, setIsReloading] = useState(false);
  const [backupStatus, setBackupStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  const handleClose = () => {
    if (isReloading) return;
    setNeedRefresh(false);
  };

  const handleRefresh = async () => {
    if (isReloading) return;
    setIsReloading(true);

    // Cloud-Backup vor Update erstellen
    try {
      setBackupStatus('running');
      await backupBeforeUpdate();
      setBackupStatus('done');
    } catch {
      setBackupStatus('error');
      // Trotz Backup-Fehler wird das Update fortgesetzt
    }

    await updateServiceWorker(true);
  };

  return (
    <div className="fixed top-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur-sm">
      <div className="p-4">
        <p className="text-sm font-semibold">Neue Version verfügbar</p>
        <p className="mt-1 text-xs text-slate-300">
          Es gibt ein Update der App. Jetzt aktualisieren, um die neueste Version zu laden.
        </p>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors cursor-pointer"
            disabled={isReloading}
          >
            Später
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-70"
            disabled={isReloading}
          >
            {isReloading ? 'Aktualisiert...' : 'Aktualisieren'}
          </button>
        </div>
      </div>
    </div>
  );
}
