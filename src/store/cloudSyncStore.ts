import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
    CloudProviderConfig,
    CloudSyncState,
    SyncQueueItem,
    SyncStatus,
} from '../types/cloudSync';

/* ══════════════════════════════════════════════════
   cloudSyncStore.ts – Zustand Store für Cloud-Sync
   Persistiert via localStorage.
   ══════════════════════════════════════════════════ */

interface CloudSyncActions {
    /** Configure the active cloud provider */
    setActiveProvider: (config: CloudProviderConfig | null) => void;
    /** Update fields on the active provider config */
    updateProviderConfig: (patch: Partial<CloudProviderConfig>) => void;
    /** Set sync status */
    setSyncStatus: (status: SyncStatus, error?: string | null) => void;
    /** Record a successful sync timestamp */
    markSyncComplete: () => void;
    /** Toggle auto-sync */
    setAutoSyncEnabled: (enabled: boolean) => void;
    /** Toggle backup-before-update */
    setBackupBeforeUpdate: (enabled: boolean) => void;
    /** Add item to sync queue */
    enqueueSync: (item: Omit<SyncQueueItem, 'status' | 'addedAt'>) => void;
    /** Update queue item status */
    updateQueueItem: (id: string, patch: Partial<SyncQueueItem>) => void;
    /** Remove completed items from queue */
    clearCompletedQueue: () => void;
    /** Clear entire queue */
    clearQueue: () => void;
    /** Store OAuth tokens */
    setTokens: (accessToken: string, refreshToken?: string, expiresAt?: string) => void;
    /** Clear tokens (logout) */
    clearTokens: () => void;
}

type CloudSyncStore = CloudSyncState & CloudSyncActions;

const INITIAL_STATE: CloudSyncState = {
    activeProvider: null,
    syncStatus: 'idle',
    lastSyncAt: null,
    lastSyncError: null,
    syncQueue: [],
    autoSyncEnabled: true,
    backupBeforeUpdate: true,
};

export const useCloudSyncStore = create<CloudSyncStore>()(
    persist(
        (set, get) => ({
            ...INITIAL_STATE,

            setActiveProvider: (config) =>
                set({
                    activeProvider: config,
                    syncStatus: 'idle',
                    lastSyncAt: null,
                    lastSyncError: null,
                    syncQueue: [],
                }),

            updateProviderConfig: (patch) => {
                const current = get().activeProvider;
                if (!current) return;
                set({ activeProvider: { ...current, ...patch } });
            },

            setSyncStatus: (status, error) =>
                set({
                    syncStatus: status,
                    lastSyncError: error ?? null,
                }),

            markSyncComplete: () =>
                set({
                    syncStatus: 'up-to-date',
                    lastSyncAt: new Date().toISOString(),
                    lastSyncError: null,
                }),

            setAutoSyncEnabled: (enabled) => set({ autoSyncEnabled: enabled }),

            setBackupBeforeUpdate: (enabled) => set({ backupBeforeUpdate: enabled }),

            enqueueSync: (item) =>
                set((state) => ({
                    syncQueue: [
                        ...state.syncQueue,
                        { ...item, status: 'pending', addedAt: new Date().toISOString() },
                    ],
                    syncStatus: 'pending',
                })),

            updateQueueItem: (id, patch) =>
                set((state) => ({
                    syncQueue: state.syncQueue.map((qi) =>
                        qi.id === id ? { ...qi, ...patch } : qi,
                    ),
                })),

            clearCompletedQueue: () =>
                set((state) => ({
                    syncQueue: state.syncQueue.filter((qi) => qi.status !== 'done'),
                })),

            clearQueue: () => set({ syncQueue: [] }),

            setTokens: (accessToken, refreshToken, expiresAt) => {
                const current = get().activeProvider;
                if (!current) return;
                set({
                    activeProvider: {
                        ...current,
                        accessToken,
                        refreshToken: refreshToken ?? current.refreshToken,
                        tokenExpiresAt: expiresAt ?? current.tokenExpiresAt,
                    },
                });
            },

            clearTokens: () => {
                const current = get().activeProvider;
                if (!current) return;
                set({
                    activeProvider: {
                        ...current,
                        accessToken: undefined,
                        refreshToken: undefined,
                        tokenExpiresAt: undefined,
                    },
                });
            },
        }),
        {
            name: 'ab-generator-cloud-sync',
            version: 1,
            partialize: (state) => ({
                activeProvider: state.activeProvider
                    ? {
                          ...state.activeProvider,
                          // Never persist plaintext WebDAV password
                          webdavPassword: state.activeProvider.webdavPassword
                              ? '***'
                              : undefined,
                      }
                    : null,
                autoSyncEnabled: state.autoSyncEnabled,
                backupBeforeUpdate: state.backupBeforeUpdate,
                lastSyncAt: state.lastSyncAt,
            }),
        },
    ),
);
