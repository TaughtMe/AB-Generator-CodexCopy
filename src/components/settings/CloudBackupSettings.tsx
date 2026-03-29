import React, { useCallback, useEffect, useState } from 'react';
import {
    AlertCircle,
    Check,
    CheckCircle,
    Cloud,
    CloudOff,
    FolderOpen,
    Loader2,
    LogIn,
    Trash2,
    Upload,
} from 'lucide-react';
import { useCloudSyncStore } from '../../store/cloudSyncStore';
import { pushBackupToCloud, processSyncQueue } from '../../services/cloudSyncService';
import {
    startCloudLogin,
    testWebDavConnection,
    loadPkceSession,
    exchangeOneDriveCode,
    handleGoogleDriveImplicitToken,
} from '../../services/cloudOAuthService';
import {
    CLOUD_PROVIDER_LABELS,
    type CloudProvider,
} from '../../types/cloudSync';
import { ICON_SIZES } from '../ui/iconSizes';

const PROVIDER_OPTIONS: Array<{ id: CloudProvider; label: string; description: string }> = [
    { id: 'onedrive', label: 'OneDrive', description: 'Microsoft OneDrive – Automatischer Login' },
    { id: 'googledrive', label: 'Google Drive', description: 'Google Drive – Automatischer Login' },
    { id: 'webdav', label: 'WebDAV', description: 'Eigener WebDAV-Server' },
];

export const CloudBackupSettings: React.FC = () => {
    const activeProvider = useCloudSyncStore((s) => s.activeProvider);
    const syncStatus = useCloudSyncStore((s) => s.syncStatus);
    const lastSyncAt = useCloudSyncStore((s) => s.lastSyncAt);
    const lastSyncError = useCloudSyncStore((s) => s.lastSyncError);
    const syncQueue = useCloudSyncStore((s) => s.syncQueue);
    const autoSyncEnabled = useCloudSyncStore((s) => s.autoSyncEnabled);
    const backupBeforeUpdate = useCloudSyncStore((s) => s.backupBeforeUpdate);

    const setActiveProvider = useCloudSyncStore((s) => s.setActiveProvider);
    const updateProviderConfig = useCloudSyncStore((s) => s.updateProviderConfig);
    const setAutoSyncEnabled = useCloudSyncStore((s) => s.setAutoSyncEnabled);
    const setBackupBeforeUpdate = useCloudSyncStore((s) => s.setBackupBeforeUpdate);
    const clearQueue = useCloudSyncStore((s) => s.clearQueue);

    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [loginState, setLoginState] = useState<'idle' | 'logging-in' | 'testing'>('idle');
    const [loginError, setLoginError] = useState<string | null>(null);

    // WebDAV inline login fields
    const [webdavUrl, setWebdavUrl] = useState('');
    const [webdavUser, setWebdavUser] = useState('');
    const [webdavPass, setWebdavPass] = useState('');
    const [pendingWebDavProvider, setPendingWebDavProvider] = useState<CloudProvider | null>(null);

    const isConnected =
        activeProvider !== null &&
        (activeProvider.accessToken || (activeProvider.webdavUrl && activeProvider.webdavUsername));

    // ─── Handle OAuth redirect callback via sessionStorage ────
    useEffect(() => {
        if (!window.location.hash.includes('cloud-callback')) return;

        // Clean hash
        window.history.replaceState(null, '', window.location.pathname);

        const raw = sessionStorage.getItem('ab-generator-oauth-result');
        if (!raw) return;
        sessionStorage.removeItem('ab-generator-oauth-result');

        let result: { code?: string; access_token?: string; state?: string; expires_in?: number };
        try {
            result = JSON.parse(raw);
        } catch {
            return;
        }

        const session = loadPkceSession();
        if (!session || session.state !== result.state) {
            setLoginError('OAuth-Sitzung ungültig. Bitte erneut versuchen.');
            return;
        }

        // ── Google Drive: Implicit Flow – Token direkt aus Hash ──
        if (result.access_token) {
            handleGoogleDriveImplicitToken(result.access_token, result.expires_in);
            setLoginState('idle');
            setLoginError(null);
            setSyncMessage(`Erfolgreich bei ${CLOUD_PROVIDER_LABELS[session.provider]} angemeldet.`);
            return;
        }

        // ── OneDrive: Code Flow – Token-Austausch nötig ──
        if (result.code) {
            setLoginState('logging-in');
            exchangeOneDriveCode(result.code, session.verifier)
                .then(() => {
                    setLoginState('idle');
                    setLoginError(null);
                    setSyncMessage(`Erfolgreich bei ${CLOUD_PROVIDER_LABELS[session.provider]} angemeldet.`);
                })
                .catch((err: unknown) => {
                    setLoginState('idle');
                    setLoginError(err instanceof Error ? err.message : 'Token-Austausch fehlgeschlagen.');
                });
        }
    }, []);

    // ─── Provider Selection ─────────────────────────
    const handleSelectProvider = useCallback(
        async (providerId: CloudProvider) => {
            setLoginError(null);
            setSyncMessage(null);

            if (providerId === 'webdav') {
                // Show inline WebDAV login fields
                setPendingWebDavProvider(providerId);
                setWebdavUrl('');
                setWebdavUser('');
                setWebdavPass('');
                return;
            }

            // OAuth providers: set provider and redirect directly
            setActiveProvider({
                provider: providerId,
                enabled: true,
                remotePath: '/AB-Generator',
            });

            try {
                setLoginState('logging-in');
                await startCloudLogin(providerId);
            } catch (err) {
                setLoginState('idle');
                setLoginError(err instanceof Error ? err.message : 'Login fehlgeschlagen.');
            }
        },
        [setActiveProvider],
    );

    // ─── WebDAV Login ───────────────────────────────
    const handleWebDavLogin = useCallback(async () => {
        if (!pendingWebDavProvider) return;
        setLoginError(null);
        setLoginState('testing');

        try {
            await testWebDavConnection(webdavUrl, webdavUser, webdavPass);

            setActiveProvider({
                provider: pendingWebDavProvider,
                enabled: true,
                remotePath: '/AB-Generator',
                webdavUrl,
                webdavUsername: webdavUser,
                webdavPassword: webdavPass,
            });

            setPendingWebDavProvider(null);
            setLoginState('idle');
            setSyncMessage(`Erfolgreich mit ${CLOUD_PROVIDER_LABELS[pendingWebDavProvider]} verbunden.`);
        } catch (err) {
            setLoginState('idle');
            setLoginError(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen.');
        }
    }, [pendingWebDavProvider, webdavUrl, webdavUser, webdavPass, setActiveProvider]);

    const handleDisconnect = useCallback(() => {
        setActiveProvider(null);
        setSyncMessage(null);
        setLoginError(null);
        setPendingWebDavProvider(null);
    }, [setActiveProvider]);

    const handleManualSync = useCallback(async () => {
        setIsSyncing(true);
        setSyncMessage(null);
        try {
            const pending = syncQueue.filter((q) => q.status === 'pending');
            if (pending.length > 0) {
                await processSyncQueue();
            } else {
                await pushBackupToCloud();
            }
            setSyncMessage('Backup erfolgreich in die Cloud hochgeladen.');
        } catch (error) {
            setSyncMessage(
                error instanceof Error ? error.message : 'Sync fehlgeschlagen.',
            );
        } finally {
            setIsSyncing(false);
        }
    }, [syncQueue]);

    const formatDate = (iso: string | null) => {
        if (!iso) return 'Noch nie';
        return new Date(iso).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const pendingCount = syncQueue.filter((q) => q.status === 'pending').length;

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="flex items-center gap-2">
                <Cloud className={`${ICON_SIZES[18]} text-blue-400`} />
                <h4 className="text-sm font-semibold text-slate-200">Cloud-Backup</h4>
            </div>

            {/* ── Login Errors ── */}
            {loginError && (
                <div className="rounded-lg border border-red-700/50 bg-red-500/10 p-3">
                    <p className="text-xs text-red-300">{loginError}</p>
                </div>
            )}

            {/* ── WebDAV Inline Login ── */}
            {pendingWebDavProvider && (
                <div className="rounded-xl border border-slate-700 p-4 bg-slate-800/40 space-y-3">
                    <p className="text-sm font-semibold text-slate-200">
                        {CLOUD_PROVIDER_LABELS[pendingWebDavProvider]} – Anmelden
                    </p>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Server-URL</label>
                        <input
                            type="url"
                            value={webdavUrl}
                            onChange={(e) => setWebdavUrl(e.target.value)}
                            placeholder="https://dav.example.com"
                            className="w-full px-3 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-200"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Benutzername</label>
                            <input
                                type="text"
                                value={webdavUser}
                                onChange={(e) => setWebdavUser(e.target.value)}
                                placeholder="user@example.com"
                                className="w-full px-3 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Passwort</label>
                            <input
                                type="password"
                                value={webdavPass}
                                onChange={(e) => setWebdavPass(e.target.value)}
                                placeholder="••••••"
                                className="w-full px-3 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-200"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleWebDavLogin}
                            disabled={loginState === 'testing' || !webdavUrl || !webdavUser || !webdavPass}
                            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {loginState === 'testing' ? (
                                <Loader2 className={`${ICON_SIZES[14]} animate-spin`} />
                            ) : (
                                <LogIn className={ICON_SIZES[14]} />
                            )}
                            Verbindung testen & anmelden
                        </button>
                        <button
                            onClick={() => setPendingWebDavProvider(null)}
                            className="px-3 py-2 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-700 cursor-pointer"
                        >
                            Abbrechen
                        </button>
                    </div>
                </div>
            )}

            {/* ── Provider Selection (when not connected) ── */}
            {!activeProvider && !pendingWebDavProvider && (
                <div className="rounded-xl border border-slate-700 p-4 bg-slate-800/40 space-y-3">
                    <p className="text-sm text-slate-300">
                        Verbinde einen Cloud-Dienst, um automatisch Backups zu erstellen
                        und deine Daten sicher zu speichern. Der Login öffnet sich automatisch.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {PROVIDER_OPTIONS.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => handleSelectProvider(opt.id)}
                                disabled={loginState !== 'idle'}
                                className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 hover:border-blue-500 hover:bg-slate-800 transition-colors cursor-pointer text-left disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loginState === 'logging-in' ? (
                                    <Loader2 className={`${ICON_SIZES[16]} text-blue-400 animate-spin`} />
                                ) : (
                                    <Cloud className={`${ICON_SIZES[16]} text-slate-400`} />
                                )}
                                <div>
                                    <p className="text-sm font-medium text-slate-200">
                                        {opt.label}
                                    </p>
                                    <p className="text-xs text-slate-400">{opt.description}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Connected Provider View ── */}
            {activeProvider && (
                <>
                    {/* ── Active Provider Info ── */}
                    <div className="rounded-xl border border-slate-700 p-4 bg-slate-800/40 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Cloud className={`${ICON_SIZES[16]} text-blue-400`} />
                                <span className="text-sm font-semibold text-slate-200">
                                    {CLOUD_PROVIDER_LABELS[activeProvider.provider]}
                                </span>
                                {isConnected && (
                                    <span className="inline-flex items-center gap-1 text-xs text-green-400">
                                        <CheckCircle className={ICON_SIZES[12]} />
                                        Verbunden
                                    </span>
                                )}
                                {!isConnected && loginState === 'logging-in' && (
                                    <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                                        <Loader2 className={`${ICON_SIZES[12]} animate-spin`} />
                                        Anmeldung läuft…
                                    </span>
                                )}
                                {!isConnected && loginState === 'idle' && (
                                    <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                                        <AlertCircle className={ICON_SIZES[12]} />
                                        Nicht angemeldet
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={handleDisconnect}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors cursor-pointer"
                                title="Cloud-Verbindung trennen"
                            >
                                <CloudOff className={ICON_SIZES[16]} />
                            </button>
                        </div>

                        {/* Re-Login-Button wenn nicht verbunden */}
                        {!isConnected && loginState === 'idle' && (
                            <button
                                onClick={() => handleSelectProvider(activeProvider.provider)}
                                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                            >
                                <LogIn className={ICON_SIZES[14]} />
                                Erneut anmelden
                            </button>
                        )}

                        {/* Sync status */}
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span>Letztes Backup: {formatDate(lastSyncAt)}</span>
                            {syncStatus === 'up-to-date' && (
                                <span className="inline-flex items-center gap-1 text-green-400">
                                    <CheckCircle className={ICON_SIZES[12]} />
                                    Aktuell
                                </span>
                            )}
                            {syncStatus === 'pending' && (
                                <span className="inline-flex items-center gap-1 text-amber-400">
                                    <AlertCircle className={ICON_SIZES[12]} />
                                    Ausstehend
                                </span>
                            )}
                            {syncStatus === 'syncing' && (
                                <span className="inline-flex items-center gap-1 text-blue-400">
                                    <Loader2 className={`${ICON_SIZES[12]} animate-spin`} />
                                    Synchronisiert…
                                </span>
                            )}
                            {syncStatus === 'error' && (
                                <span className="inline-flex items-center gap-1 text-red-400">
                                    <AlertCircle className={ICON_SIZES[12]} />
                                    Fehler
                                </span>
                            )}
                        </div>

                        {lastSyncError && (
                            <p className="text-xs text-red-300 bg-red-500/10 rounded-lg p-2">
                                {lastSyncError}
                            </p>
                        )}
                    </div>

                    {/* ── Remote Path ── */}
                    <div className="rounded-xl border border-slate-700 p-4 bg-slate-800/40 space-y-2">
                        <label className="block text-xs text-slate-400">
                            <FolderOpen className={`${ICON_SIZES[12]} inline mr-1`} />
                            Speicherpfad in der Cloud
                        </label>
                        <input
                            type="text"
                            value={activeProvider.remotePath}
                            onChange={(e) => updateProviderConfig({ remotePath: e.target.value })}
                            placeholder="/AB-Generator/Backups"
                            className="w-full px-3 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-200"
                        />
                        <p className="text-xs text-slate-500">
                            Ordnerpfad in der Cloud, z.B. /AB-Generator/Backups
                        </p>
                    </div>

                    {/* ── Sync Options ── */}
                    <div className="rounded-xl border border-slate-700 p-4 bg-slate-800/40 space-y-3">
                        <p className="text-xs font-semibold text-slate-300">Sync-Optionen</p>

                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm text-slate-200">Automatischer Sync</p>
                                <p className="text-xs text-slate-400">
                                    Änderungen werden automatisch in die Cloud gesichert.
                                </p>
                            </div>
                            <button
                                onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                    autoSyncEnabled ? 'bg-blue-600' : 'bg-slate-600'
                                }`}
                            >
                                <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                        autoSyncEnabled ? 'translate-x-5' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm text-slate-200">Backup vor Update</p>
                                <p className="text-xs text-slate-400">
                                    Vor jedem App-Update wird automatisch ein Cloud-Backup erstellt.
                                </p>
                            </div>
                            <button
                                onClick={() => setBackupBeforeUpdate(!backupBeforeUpdate)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                    backupBeforeUpdate ? 'bg-blue-600' : 'bg-slate-600'
                                }`}
                            >
                                <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                        backupBeforeUpdate ? 'translate-x-5' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* ── Sync Queue ── */}
                    {syncQueue.length > 0 && (
                        <div className="rounded-xl border border-slate-700 p-4 bg-slate-800/40 space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-slate-300">
                                    Warteschlange ({pendingCount} ausstehend)
                                </p>
                                <button
                                    onClick={clearQueue}
                                    className="text-xs text-slate-400 hover:text-red-400 cursor-pointer"
                                    title="Warteschlange leeren"
                                >
                                    <Trash2 className={ICON_SIZES[12]} />
                                </button>
                            </div>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {syncQueue.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center gap-2 text-xs text-slate-300"
                                    >
                                        {item.status === 'pending' && (
                                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                                        )}
                                        {item.status === 'syncing' && (
                                            <Loader2 className={`${ICON_SIZES[12]} text-blue-400 animate-spin`} />
                                        )}
                                        {item.status === 'done' && (
                                            <Check className={`${ICON_SIZES[12]} text-green-400`} />
                                        )}
                                        {item.status === 'error' && (
                                            <AlertCircle className={`${ICON_SIZES[12]} text-red-400`} />
                                        )}
                                        <span className="truncate">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Manual Sync Button ── */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleManualSync}
                            disabled={isSyncing || syncStatus === 'syncing' || !isConnected}
                            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isSyncing ? (
                                <Loader2 className={`${ICON_SIZES[16]} animate-spin`} />
                            ) : (
                                <Upload className={ICON_SIZES[16]} />
                            )}
                            Jetzt synchronisieren
                        </button>

                        {syncStatus === 'up-to-date' && (
                            <span className="inline-flex items-center gap-1 text-xs text-green-400">
                                <CheckCircle className={ICON_SIZES[14]} />
                                Backup ist aktuell
                            </span>
                        )}
                    </div>

                    {syncMessage && (
                        <p
                            className={`text-xs ${
                                syncMessage.includes('fehlgeschlagen') || syncMessage.includes('Fehler')
                                    ? 'text-red-300'
                                    : 'text-green-400'
                            }`}
                        >
                            {syncMessage}
                        </p>
                    )}
                </>
            )}

            {/* ── File Format Info ── */}
            <div className="rounded-lg border border-slate-700/50 p-3 bg-slate-900/30">
                <p className="text-xs text-slate-500">
                    Das Cloud-Backup wird als <code className="text-slate-400">.worksheet</code>-Datei
                    gespeichert und enthält alle Arbeitsblätter, Einstellungen und Vorlagen in einer
                    einzelnen Datei. Bilddaten sind nicht enthalten.
                </p>
            </div>
        </div>
    );
};
