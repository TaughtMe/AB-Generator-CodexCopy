import Dexie, { type EntityTable } from 'dexie';
import type { Task } from '../types/worksheet';
import {
    normalizeDesignSnapshot,
    normalizeTemplateName,
    type DesignSnapshot,
    type DesignTemplate,
} from '../types/designTemplate';

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
    /** Optionale Zuordnung zu einem Fach (profileStore Subject-ID) */
    subjectId?: string;
    /** Optionale Zuordnung zu einer Klasse (profileStore ClassProfile-ID) */
    classId?: string;
    /** Screenshot-Thumbnail des Worksheets (JPEG Blob, top ~300px) */
    thumbnailBlob?: Blob;
    createdAt: Date;
    updatedAt: Date;
}

/** A compact task preview shown in the card thumbnail */
export interface TaskPreviewItem {
    type: string;
    label: string;
}

/** Lightweight metadata for listing worksheets (no heavy task data) */
export interface WorksheetMeta {
    id: string;
    title: string;
    taskCount: number;
    subjectId?: string;
    classId?: string;
    createdAt: Date;
    updatedAt: Date;
    /** First few tasks summarised for the card preview */
    taskPreview: TaskPreviewItem[];
    /** Object-URL for the stored screenshot thumbnail (created on the fly) */
    thumbnailUrl?: string;
}

export interface DesignTemplateRecord {
    id: string;
    name: string;
    nameLower: string;
    design: DesignSnapshot;
    embeddedLogoBlob?: Blob;
    createdAt: Date;
    updatedAt: Date;
    lastUsedAt?: Date;
}

export interface DesignTemplateListOptions {
    sortBy?: 'updatedAt' | 'createdAt' | 'lastUsedAt' | 'name';
    query?: string;
}

/* ── Database Definition ── */

class ABGeneratorDB extends Dexie {
    images!: EntityTable<ImageRecord, 'id'>;
    worksheets!: EntityTable<WorksheetRecord, 'id'>;
    designTemplates!: EntityTable<DesignTemplateRecord, 'id'>;

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

        // Version 3: add subjectId & classId indexes for filtering
        this.version(3).stores({
            images: '++id, name, createdAt',
            worksheets: 'id, title, updatedAt, subjectId, classId',
        });

        // Version 4: add design templates
        this.version(4).stores({
            images: '++id, name, createdAt',
            worksheets: 'id, title, updatedAt, subjectId, classId',
            designTemplates: 'id, nameLower, updatedAt, createdAt, lastUsedAt',
        });
    }
}

const db = new ABGeneratorDB();

export async function listWorksheetRecords(): Promise<WorksheetRecord[]> {
    return db.worksheets.toArray();
}

export async function listDesignTemplateRecords(): Promise<DesignTemplateRecord[]> {
    return db.designTemplates.toArray();
}

export async function replaceWorksheetRecords(records: WorksheetRecord[]): Promise<void> {
    await db.transaction('rw', db.worksheets, async () => {
        await db.worksheets.clear();
        if (records.length > 0) {
            await db.worksheets.bulkPut(records);
        }
    });
}

export async function replaceDesignTemplateRecords(records: DesignTemplateRecord[]): Promise<void> {
    await db.transaction('rw', db.designTemplates, async () => {
        await db.designTemplates.clear();
        if (records.length > 0) {
            await db.designTemplates.bulkPut(records);
        }
    });
}

export async function clearAllIndexedDbData(): Promise<void> {
    await db.transaction('rw', db.images, db.worksheets, db.designTemplates, async () => {
        await db.images.clear();
        await db.worksheets.clear();
        await db.designTemplates.clear();
    });
}

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
   Design Template CRUD Helpers
   ══════════════════════════════════════════════════ */

function toTemplate(record: DesignTemplateRecord): DesignTemplate {
    return {
        ...record,
        design: normalizeDesignSnapshot(record.design),
    };
}

export async function getDesignTemplateByName(name: string): Promise<DesignTemplate | undefined> {
    const normalizedName = normalizeTemplateName(name).toLowerCase();
    if (!normalizedName) return undefined;
    const record = await db.designTemplates.where('nameLower').equals(normalizedName).first();
    return record ? toTemplate(record) : undefined;
}

export async function createDesignTemplate(payload: {
    id: string;
    name: string;
    design: Partial<DesignSnapshot>;
    embeddedLogoBlob?: Blob;
}): Promise<DesignTemplate> {
    const trimmedName = normalizeTemplateName(payload.name);
    const now = new Date();

    const existing = await db.designTemplates.where('nameLower').equals(trimmedName.toLowerCase()).first();
    if (existing) {
        throw new Error('TEMPLATE_NAME_EXISTS');
    }

    const record: DesignTemplateRecord = {
        id: payload.id,
        name: trimmedName,
        nameLower: trimmedName.toLowerCase(),
        design: normalizeDesignSnapshot(payload.design),
        embeddedLogoBlob: payload.embeddedLogoBlob,
        createdAt: now,
        updatedAt: now,
    };

    await db.designTemplates.add(record);
    return toTemplate(record);
}

export async function updateDesignTemplate(
    id: string,
    patch: Partial<Omit<DesignTemplateRecord, 'id' | 'createdAt' | 'design'>> & {
        design?: Partial<DesignSnapshot>;
    }
): Promise<DesignTemplate | undefined> {
    const current = await db.designTemplates.get(id);
    if (!current) return undefined;

    const nextName = patch.name ? normalizeTemplateName(patch.name) : current.name;
    const nextNameLower = nextName.toLowerCase();

    if (nextNameLower !== current.nameLower) {
        const other = await db.designTemplates.where('nameLower').equals(nextNameLower).first();
        if (other && other.id !== id) {
            throw new Error('TEMPLATE_NAME_EXISTS');
        }
    }

    const nextRecord: DesignTemplateRecord = {
        ...current,
        ...patch,
        name: nextName,
        nameLower: nextNameLower,
        design: patch.design ? normalizeDesignSnapshot(patch.design) : normalizeDesignSnapshot(current.design),
        updatedAt: new Date(),
    };

    await db.designTemplates.put(nextRecord);
    return toTemplate(nextRecord);
}

export async function deleteDesignTemplate(id: string): Promise<void> {
    await db.designTemplates.delete(id);
}

export async function getDesignTemplate(id: string): Promise<DesignTemplate | undefined> {
    const record = await db.designTemplates.get(id);
    return record ? toTemplate(record) : undefined;
}

export async function listDesignTemplates(options?: DesignTemplateListOptions): Promise<DesignTemplate[]> {
    const sortBy = options?.sortBy ?? 'updatedAt';
    const query = normalizeTemplateName(options?.query ?? '').toLowerCase();

    let records = await db.designTemplates.orderBy(sortBy).reverse().toArray();

    if (query) {
        records = records.filter((entry) => entry.nameLower.includes(query));
    }

    return records.map(toTemplate);
}

export async function upsertDesignTemplateByName(payload: {
    name: string;
    idForCreate: string;
    design: Partial<DesignSnapshot>;
    embeddedLogoBlob?: Blob;
}): Promise<DesignTemplate> {
    const trimmedName = normalizeTemplateName(payload.name);
    const existing = await db.designTemplates.where('nameLower').equals(trimmedName.toLowerCase()).first();

    if (!existing) {
        return createDesignTemplate({
            id: payload.idForCreate,
            name: trimmedName,
            design: payload.design,
            embeddedLogoBlob: payload.embeddedLogoBlob,
        });
    }

    const updated = await updateDesignTemplate(existing.id, {
        name: trimmedName,
        design: payload.design,
        embeddedLogoBlob: payload.embeddedLogoBlob,
    });

    if (!updated) {
        throw new Error('TEMPLATE_UPDATE_FAILED');
    }

    return updated;
}

export async function markDesignTemplateUsed(id: string): Promise<void> {
    const current = await db.designTemplates.get(id);
    if (!current) return;
    await db.designTemplates.update(id, {
        lastUsedAt: new Date(),
        updatedAt: new Date(),
    });
}

/* ══════════════════════════════════════════════════
   Worksheet CRUD Helpers
   ══════════════════════════════════════════════════ */

/** Speichert (erstellt oder überschreibt) ein Arbeitsblatt */
export async function saveWorksheet(
    id: string,
    title: string,
    tasksById: Record<string, Task>,
    taskIds: string[],
    subjectId?: string,
    classId?: string,
    thumbnailBlob?: Blob
): Promise<void> {
    const existing = await db.worksheets.get(id);
    const now = new Date();

    await db.worksheets.put({
        id,
        title,
        tasksById,
        taskIds,
        subjectId: subjectId ?? existing?.subjectId,
        classId: classId ?? existing?.classId,
        thumbnailBlob: thumbnailBlob ?? existing?.thumbnailBlob,
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

/** Filter-Optionen für die Worksheet-Liste */
export interface WorksheetFilter {
    subjectId?: string;
    classId?: string;
    sortBy?: 'updatedAt' | 'createdAt' | 'title';
}

/** Gibt Arbeitsblätter als Metadaten zurück, optional gefiltert & sortiert */
export async function listRecentWorksheets(
    limit = 10,
    filter?: WorksheetFilter
): Promise<WorksheetMeta[]> {
    const sortField = filter?.sortBy ?? 'updatedAt';

    let records = await db.worksheets
        .orderBy(sortField)
        .reverse()
        .toArray();

    // Client-side filter (Dexie compound-index wäre Overkill hier)
    if (filter?.subjectId) {
        records = records.filter((r) => r.subjectId === filter.subjectId);
    }
    if (filter?.classId) {
        records = records.filter((r) => r.classId === filter.classId);
    }

    // Limit nach Filter
    records = records.slice(0, limit);

    return records.map((rec) => {
        const { id, title, taskIds, tasksById, subjectId, classId, createdAt, updatedAt } = rec;
        // Build a compact preview from the first 4 tasks
        const taskPreview: TaskPreviewItem[] = taskIds.slice(0, 4).map((tid) => {
            const t = tasksById[tid];
            if (!t) return { type: 'unknown', label: '' };
            let label = t.title || '';
            switch (t.type) {
                case 'multiple-choice':
                    label = label || t.question?.slice(0, 60) || 'Multiple Choice';
                    break;
                case 'cloze':
                    label = label || t.content?.replace(/\[.*?\]/g, '___').slice(0, 60) || 'Lückentext';
                    break;
                case 'instruction':
                    label = label || t.text?.slice(0, 60) || 'Aufgabe';
                    break;
                case 'math':
                    label = label || t.content?.slice(0, 40) || 'Mathe';
                    break;
                case 'lineatur':
                    label = label || `Lineatur ${t.lineRows} Zeilen`;
                    break;
                case 'image-placeholder':
                    label = label || t.caption || 'Bild';
                    break;
                case 'columns':
                    label = label || `Spalten ${t.layout}`;
                    break;
                case 'page-break':
                    label = '— Seitenumbruch —';
                    break;
                default:
                    label = label || 'Aufgabe';
            }
            return { type: t.type, label };
        });

        return {
            id,
            title,
            taskCount: taskIds.length,
            subjectId,
            classId,
            createdAt,
            updatedAt,
            taskPreview,
            thumbnailUrl: rec.thumbnailBlob ? URL.createObjectURL(rec.thumbnailBlob) : undefined,
        };
    });
}
