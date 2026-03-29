import type { CloudProviderConfig, WorksheetBundleV1 } from '../types/cloudSync';
import { useCloudSyncStore } from '../store/cloudSyncStore';
import { ensureFreshToken } from './cloudOAuthService';
import {
    listClassProfileRecords,
    listDesignTemplateRecords,
    listWorksheetRecords,
} from '../store/dexieStore';

/* ══════════════════════════════════════════════════
   cloudSyncService.ts – Cloud Upload / Download
   Supports OneDrive, Google Drive, WebDAV.
   ══════════════════════════════════════════════════ */

const WORKSHEET_EXTENSION = '.worksheet';
const BACKUP_FILENAME = `ab-generator-backup${WORKSHEET_EXTENSION}`;
const SETTINGS_STORAGE_KEY = 'ab-generator-settings';

// ─── Helpers ────────────────────────────────────────

function readPersistedSettings(): unknown {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        // Strip API keys for security
        if (parsed?.state?.providers) {
            for (const key of Object.keys(parsed.state.providers)) {
                if (parsed.state.providers[key]?.apiKey) {
                    parsed.state.providers[key].apiKey = '';
                }
            }
        }
        return parsed;
    } catch {
        return {};
    }
}

async function buildWorksheetBundle(): Promise<WorksheetBundleV1> {
    const worksheets = await listWorksheetRecords();
    const templates = await listDesignTemplateRecords();
    const classProfiles = await listClassProfileRecords();

    return {
        format: 'ab-generator-worksheet-bundle',
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
            settings: readPersistedSettings(),
            worksheets: worksheets.map((w) => ({
                ...w,
                createdAt: w.createdAt instanceof Date ? w.createdAt.toISOString() : w.createdAt,
                updatedAt: w.updatedAt instanceof Date ? w.updatedAt.toISOString() : w.updatedAt,
            })),
            designTemplates: templates.map((t) => ({
                ...t,
                design: { ...t.design, logoImageId: null },
                createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
                updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt,
                lastUsedAt: t.lastUsedAt instanceof Date ? t.lastUsedAt.toISOString() : t.lastUsedAt,
            })),
            classProfiles: classProfiles.map((p) => ({
                ...p,
                createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
                updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
            })),
        },
    };
}

function bundleToBlob(bundle: WorksheetBundleV1): Blob {
    const json = JSON.stringify(bundle, null, 2);
    return new Blob([json], { type: 'application/json;charset=utf-8' });
}

function ensureTrailingSlash(path: string): string {
    return path.endsWith('/') ? path : `${path}/`;
}

// ─── OneDrive ───────────────────────────────────────

async function uploadToOneDrive(
    config: CloudProviderConfig,
    blob: Blob,
): Promise<void> {
    const remotePath = ensureTrailingSlash(config.remotePath || '/AB-Generator');
    const uploadPath = `${remotePath}${BACKUP_FILENAME}`;
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(uploadPath)}:/content`;

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: blob,
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`OneDrive Upload fehlgeschlagen (${response.status}): ${errorBody}`);
    }
}

async function downloadFromOneDrive(
    config: CloudProviderConfig,
): Promise<WorksheetBundleV1> {
    const remotePath = ensureTrailingSlash(config.remotePath || '/AB-Generator');
    const downloadPath = `${remotePath}${BACKUP_FILENAME}`;
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(downloadPath)}:/content`;

    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
    });

    if (!response.ok) {
        throw new Error(`OneDrive Download fehlgeschlagen (${response.status})`);
    }

    return response.json() as Promise<WorksheetBundleV1>;
}

// ─── Google Drive ───────────────────────────────────

async function findOrCreateFolder(
    accessToken: string,
    folderName: string,
    parentId?: string,
): Promise<string> {
    const q = [
        `name='${folderName}'`,
        "mimeType='application/vnd.google-apps.folder'",
        'trashed=false',
    ];
    if (parentId) q.push(`'${parentId}' in parents`);

    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q.join(' and '))}&fields=files(id)`;
    const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const searchData = (await searchRes.json()) as { files?: Array<{ id: string }> };

    if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            ...(parentId ? { parents: [parentId] } : {}),
        }),
    });

    const createData = (await createRes.json()) as { id: string };
    return createData.id;
}

async function uploadToGoogleDrive(
    config: CloudProviderConfig,
    blob: Blob,
): Promise<void> {
    const folderPath = (config.remotePath || '/AB-Generator').replace(/^\//, '').split('/');
    let parentId: string | undefined;
    for (const segment of folderPath) {
        if (!segment) continue;
        parentId = await findOrCreateFolder(config.accessToken!, segment, parentId);
    }

    // Check if file already exists
    const q = [
        `name='${BACKUP_FILENAME}'`,
        'trashed=false',
        ...(parentId ? [`'${parentId}' in parents`] : []),
    ];
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q.join(' and '))}&fields=files(id)`;
    const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    const searchData = (await searchRes.json()) as { files?: Array<{ id: string }> };
    const existingFileId = searchData.files?.[0]?.id;

    if (existingFileId) {
        // Update existing
        const url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: blob,
        });
        if (!res.ok) throw new Error(`Google Drive Update fehlgeschlagen (${res.status})`);
    } else {
        // Create new – multipart upload
        const metadata = {
            name: BACKUP_FILENAME,
            ...(parentId ? { parents: [parentId] } : {}),
        };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const res = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${config.accessToken}` },
                body: form,
            },
        );
        if (!res.ok) throw new Error(`Google Drive Upload fehlgeschlagen (${res.status})`);
    }
}

async function downloadFromGoogleDrive(
    config: CloudProviderConfig,
): Promise<WorksheetBundleV1> {
    const q = [`name='${BACKUP_FILENAME}'`, 'trashed=false'];
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q.join(' and '))}&fields=files(id)`;
    const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    const searchData = (await searchRes.json()) as { files?: Array<{ id: string }> };
    const fileId = searchData.files?.[0]?.id;
    if (!fileId) throw new Error('Backup-Datei nicht in Google Drive gefunden.');

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    if (!res.ok) throw new Error(`Google Drive Download fehlgeschlagen (${res.status})`);
    return res.json() as Promise<WorksheetBundleV1>;
}

// ─── WebDAV ─────────────────────────────────────────

function webdavBaseUrl(config: CloudProviderConfig): string {
    const base = config.webdavUrl || '';
    return base.replace(/\/+$/, '');
}

function webdavAuthHeaders(config: CloudProviderConfig): Record<string, string> {
    if (config.webdavUsername && config.webdavPassword) {
        const credentials = btoa(`${config.webdavUsername}:${config.webdavPassword}`);
        return { Authorization: `Basic ${credentials}` };
    }
    if (config.accessToken) {
        return { Authorization: `Bearer ${config.accessToken}` };
    }
    return {};
}

async function ensureWebDavDirectory(
    baseUrl: string,
    remotePath: string,
    headers: Record<string, string>,
): Promise<void> {
    const segments = remotePath.replace(/^\//, '').split('/').filter(Boolean);
    let current = baseUrl;
    for (const segment of segments) {
        current = `${current}/${segment}`;
        await fetch(current, { method: 'MKCOL', headers }).catch(() => {
            /* directory may already exist */
        });
    }
}

async function uploadToWebDav(
    config: CloudProviderConfig,
    blob: Blob,
): Promise<void> {
    const base = webdavBaseUrl(config);
    const headers = webdavAuthHeaders(config);
    const remotePath = config.remotePath || '/AB-Generator';

    await ensureWebDavDirectory(base, remotePath, headers);

    const fileUrl = `${base}${ensureTrailingSlash(remotePath)}${BACKUP_FILENAME}`;
    const response = await fetch(fileUrl, {
        method: 'PUT',
        headers: {
            ...headers,
            'Content-Type': 'application/json',
        },
        body: blob,
    });

    if (!response.ok) {
        throw new Error(`WebDAV Upload fehlgeschlagen (${response.status})`);
    }
}

async function downloadFromWebDav(
    config: CloudProviderConfig,
): Promise<WorksheetBundleV1> {
    const base = webdavBaseUrl(config);
    const headers = webdavAuthHeaders(config);
    const remotePath = config.remotePath || '/AB-Generator';
    const fileUrl = `${base}${ensureTrailingSlash(remotePath)}${BACKUP_FILENAME}`;

    const response = await fetch(fileUrl, { headers });
    if (!response.ok) {
        throw new Error(`WebDAV Download fehlgeschlagen (${response.status})`);
    }
    return response.json() as Promise<WorksheetBundleV1>;
}

// ─── Public API ─────────────────────────────────────

/**
 * Upload current data as .worksheet bundle to the configured cloud provider.
 */
export async function pushBackupToCloud(): Promise<void> {
    const store = useCloudSyncStore.getState();
    const config = store.activeProvider;

    if (!config || !config.enabled) {
        throw new Error('Kein Cloud-Anbieter konfiguriert.');
    }

    store.setSyncStatus('syncing');

    try {
        // Token erneuern falls abgelaufen
        await ensureFreshToken();
        // Config nach Token-Refresh nochmal lesen
        const freshConfig = useCloudSyncStore.getState().activeProvider!;

        const bundle = await buildWorksheetBundle();
        const blob = bundleToBlob(bundle);

        switch (freshConfig.provider) {
            case 'onedrive':
                await uploadToOneDrive(freshConfig, blob);
                break;
            case 'googledrive':
                await uploadToGoogleDrive(freshConfig, blob);
                break;
            case 'webdav':
                await uploadToWebDav(freshConfig, blob);
                break;
            default:
                throw new Error(`Unbekannter Cloud-Anbieter: ${freshConfig.provider}`);
        }

        store.markSyncComplete();
        store.clearCompletedQueue();
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Cloud-Sync fehlgeschlagen.';
        store.setSyncStatus('error', message);
        throw error;
    }
}

/**
 * Download .worksheet bundle from the configured cloud provider.
 */
export async function pullBackupFromCloud(): Promise<WorksheetBundleV1> {
    const store = useCloudSyncStore.getState();
    const config = store.activeProvider;

    if (!config || !config.enabled) {
        throw new Error('Kein Cloud-Anbieter konfiguriert.');
    }

    // Token erneuern falls abgelaufen
    await ensureFreshToken();
    const freshConfig = useCloudSyncStore.getState().activeProvider!;

    switch (freshConfig.provider) {
        case 'onedrive':
            return downloadFromOneDrive(freshConfig);
        case 'googledrive':
            return downloadFromGoogleDrive(freshConfig);
        case 'webdav':
            return downloadFromWebDav(freshConfig);
        default:
            throw new Error(`Unbekannter Cloud-Anbieter: ${freshConfig.provider}`);
    }
}

/**
 * Process the sync queue: push backup for every pending item.
 */
export async function processSyncQueue(): Promise<void> {
    const store = useCloudSyncStore.getState();
    const pending = store.syncQueue.filter((q) => q.status === 'pending');

    if (pending.length === 0) return;

    for (const item of pending) {
        store.updateQueueItem(item.id, { status: 'syncing' });
    }

    try {
        await pushBackupToCloud();
        for (const item of pending) {
            store.updateQueueItem(item.id, { status: 'done' });
        }
        store.clearCompletedQueue();
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Sync fehlgeschlagen';
        for (const item of pending) {
            store.updateQueueItem(item.id, { status: 'error', error: message });
        }
    }
}

/**
 * Called before an app update: create + push backup if cloud is configured.
 */
export async function backupBeforeUpdate(): Promise<void> {
    const store = useCloudSyncStore.getState();
    if (!store.backupBeforeUpdate || !store.activeProvider?.enabled) return;

    // First process any pending queue items
    await processSyncQueue();

    // Then push a fresh backup
    await pushBackupToCloud();
}

/**
 * Enqueue a change for sync (called after worksheet save).
 */
export function notifyDataChanged(label: string): void {
    const store = useCloudSyncStore.getState();
    if (!store.activeProvider?.enabled || !store.autoSyncEnabled) return;

    store.enqueueSync({
        id: `change-${Date.now()}`,
        label,
    });

    // Debounced auto-push: wait 5s then process queue
    clearTimeout(_autoSyncTimer);
    _autoSyncTimer = window.setTimeout(() => {
        void processSyncQueue();
    }, 5000);
}

let _autoSyncTimer: number | undefined;
