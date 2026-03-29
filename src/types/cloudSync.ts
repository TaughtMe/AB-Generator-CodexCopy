/* ══════════════════════════════════════════════════
   cloudSync.ts – Typen für Cloud-Backup & Sync
   ══════════════════════════════════════════════════ */

export type CloudProvider = 'onedrive' | 'googledrive' | 'webdav';

export const CLOUD_PROVIDER_LABELS: Record<CloudProvider, string> = {
    onedrive: 'OneDrive',
    googledrive: 'Google Drive',
    webdav: 'WebDAV',
};

export interface CloudProviderConfig {
    provider: CloudProvider;
    enabled: boolean;
    /** User-defined remote path, e.g. "/AB-Generator/Backups" */
    remotePath: string;
    /** OAuth access token (OneDrive, Google Drive) */
    accessToken?: string;
    /** OAuth refresh token */
    refreshToken?: string;
    /** Token expiry ISO timestamp */
    tokenExpiresAt?: string;
    /** WebDAV-specific: server URL */
    webdavUrl?: string;
    /** WebDAV-specific: username */
    webdavUsername?: string;
    /** WebDAV-specific: password */
    webdavPassword?: string;
}

export type SyncStatus =
    | 'idle'
    | 'syncing'
    | 'up-to-date'
    | 'pending'
    | 'error';

export interface SyncQueueItem {
    id: string;
    label: string;
    status: 'pending' | 'syncing' | 'done' | 'error';
    error?: string;
    addedAt: string;
}

export interface CloudSyncState {
    /** Active cloud provider config (null = disabled) */
    activeProvider: CloudProviderConfig | null;
    /** Current sync status */
    syncStatus: SyncStatus;
    /** Last successful sync ISO timestamp */
    lastSyncAt: string | null;
    /** Error message from last sync attempt */
    lastSyncError: string | null;
    /** Pending items waiting to sync */
    syncQueue: SyncQueueItem[];
    /** Whether auto-sync is enabled */
    autoSyncEnabled: boolean;
    /** Auto-sync before updates */
    backupBeforeUpdate: boolean;
}

/** The .worksheet file format wrapping all data */
export interface WorksheetBundleV1 {
    format: 'ab-generator-worksheet-bundle';
    version: 1;
    exportedAt: string;
    data: {
        settings: unknown;
        worksheets: unknown[];
        designTemplates: unknown[];
        classProfiles: unknown[];
    };
}
