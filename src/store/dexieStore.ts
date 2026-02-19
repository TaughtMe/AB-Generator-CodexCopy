import Dexie, { type EntityTable } from 'dexie';
import type { Task } from '../types/worksheet';

/* ══════════════════════════════════════════════════
   DexieStore – IndexedDB via Dexie.js
   Manages binary assets AND worksheet persistence.
   ══════════════════════════════════════════════════ */

/* ── Image Records ── */

export interface ImageRecord {
    id?: number;
    name: string;
    blob: Blob;
    createdAt: Date;
}

/* ── Worksheet Records ── */

export interface WorksheetRecord {
    id: string;
    title: string;
    tasksById: Record<string, Task>;
    taskIds: string[];
    createdAt: Date;
    updatedAt: Date;
}

/** Lightweight metadata for listing worksheets (no heavy task data) */
export interface WorksheetMeta {
    id: string;
    title: string;
    taskCount: number;
    createdAt: Date;
    updatedAt: Date;
}

/* ── Database Definition ── */

class ABGeneratorDB extends Dexie {
    images!: EntityTable<ImageRecord, 'id'>;
    worksheets!: EntityTable<WorksheetRecord, 'id'>;

    constructor() {
        super('ABGeneratorDB');

        // Version 1: images only
        this.version(1).stores({
            images: '++id, name, createdAt',
        });

        // Version 2: add worksheets table
        this.version(2).stores({
            images: '++id, name, createdAt',
            worksheets: 'id, title, updatedAt',
        });
    }
}

const db = new ABGeneratorDB();

/* ══════════════════════════════════════════════════
   Image CRUD Helpers
   ══════════════════════════════════════════════════ */

/** Speichert ein Bild und gibt die auto-increment ID zurück */
export async function addImage(name: string, blob: Blob): Promise<number> {
    const id = await db.images.add({
        name,
        blob,
        createdAt: new Date(),
    });
    return id as number;
}

/** Lädt ein Bild per ID */
export async function getImage(id: number): Promise<ImageRecord | undefined> {
    return await db.images.get(id);
}

/** Erzeugt eine temporäre Object-URL für ein gespeichertes Bild */
export async function getImageUrl(id: number): Promise<string | null> {
    const record = await db.images.get(id);
    if (!record) return null;
    return URL.createObjectURL(record.blob);
}

/* ══════════════════════════════════════════════════
   Worksheet CRUD Helpers
   ══════════════════════════════════════════════════ */

/** Speichert (erstellt oder überschreibt) ein Arbeitsblatt */
export async function saveWorksheet(
    id: string,
    title: string,
    tasksById: Record<string, Task>,
    taskIds: string[]
): Promise<void> {
    const existing = await db.worksheets.get(id);
    const now = new Date();

    await db.worksheets.put({
        id,
        title,
        tasksById,
        taskIds,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    });
}

/** Lädt ein vollständiges Arbeitsblatt */
export async function loadWorksheet(id: string): Promise<WorksheetRecord | undefined> {
    return await db.worksheets.get(id);
}

/** Löscht ein Arbeitsblatt */
export async function deleteWorksheet(id: string): Promise<void> {
    await db.worksheets.delete(id);
}

/** Gibt die letzten N Arbeitsblätter als Metadaten zurück (nach updatedAt sortiert) */
export async function listRecentWorksheets(limit = 10): Promise<WorksheetMeta[]> {
    const records = await db.worksheets
        .orderBy('updatedAt')
        .reverse()
        .limit(limit)
        .toArray();

    return records.map(({ id, title, taskIds, createdAt, updatedAt }) => ({
        id,
        title,
        taskCount: taskIds.length,
        createdAt,
        updatedAt,
    }));
}
