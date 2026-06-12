import Dexie, { type EntityTable } from 'dexie';
import type { Task, WorksheetVariant } from '../types/worksheet';
import type { ChatMessage } from '../types/ai';
import type { WorksheetSource } from '../types/worksheet';
import type { ClassProfile } from '../types/profiles';
import { notifyDataChanged } from '../services/cloudSyncService';
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

export type CustomFontFormat = 'ttf' | 'otf' | 'woff' | 'woff2';

export interface CustomFontRecord {
    id?: number;
    name: string;
    data: string;
    format: CustomFontFormat;
    createdAt: Date;
}

/* ── Worksheet Records ── */

export interface WorksheetRecord {
    id: string;
    title: string;
    tasksById: Record<string, Task>;
    taskIds: string[];
    variants?: WorksheetVariant[];
    activeVariantId?: string;
    chatHistory: ChatMessage[];
    sources: WorksheetSource[];
    /** Optionale Zuordnung zu einem Fach (profileStore Subject-ID) */
    subjectId?: string;
    /** Optionale Zuordnung zu einem Klassenprofil (Dexie classProfiles-ID) */
    classId?: string;
    /** Screenshot-Thumbnail des Worksheets (JPEG Blob, top ~300px) */
    thumbnailBlob?: Blob;
    /** Freitext-Metadaten für Save-As Dialog */
    documentSubject?: string;
    documentClassLevel?: string;
    /** Unix-Timestamp (ms) wenn im Papierkorb, sonst undefined */
    deletedAt?: number;
    /** Bibliotheks-Ordner (reine Organisation — bewusst getrennt von Fach/Klasse). */
    folderId?: string;
    /** Freie Schlagwörter (z. B. "Klassenarbeit", "Übung"). */
    tags?: string[];
    /** Favoriten-Markierung für die Bibliothek. */
    favorite?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/** Bibliotheks-Ordner. parentId erlaubt Verschachtelung (null = Wurzelebene). */
export interface FolderRecord {
    id: string;
    name: string;
    parentId: string | null;
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
    variantCount: number;
    subjectId?: string;
    classId?: string;
    documentSubject?: string;
    documentClassLevel?: string;
    createdAt: Date;
    updatedAt: Date;
    /** First few tasks summarised for the card preview */
    taskPreview: TaskPreviewItem[];
    /** Object-URL for the stored screenshot thumbnail (created on the fly) */
    thumbnailUrl?: string;
    /** Unix-Timestamp (ms) wenn im Papierkorb, sonst undefined */
    deletedAt?: number;
    /** Bibliotheks-Ordner (undefined = Unsortiert) */
    folderId?: string;
    tags?: string[];
    favorite?: boolean;
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

/* ── Class Profile Records ── */

export interface ClassProfileRecord {
    id: string;
    name: string;
    nameLower: string;
    subjectId?: string;
    curriculumContext: string;
    studentProfile: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateClassProfileInput {
    id?: string;
    name: string;
    subjectId?: string;
    curriculumContext?: string;
    studentProfile?: string;
}

export interface UpdateClassProfileInput {
    name?: string;
    subjectId?: string | null;
    curriculumContext?: string;
    studentProfile?: string;
}

/* ── Database Definition ── */

class ABGeneratorDB extends Dexie {
    images!: EntityTable<ImageRecord, 'id'>;
    customFonts!: EntityTable<CustomFontRecord, 'id'>;
    worksheets!: EntityTable<WorksheetRecord, 'id'>;
    designTemplates!: EntityTable<DesignTemplateRecord, 'id'>;
    classProfiles!: EntityTable<ClassProfileRecord, 'id'>;
    folders!: EntityTable<FolderRecord, 'id'>;

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

        // Version 5: add class profiles table (for KI context + worksheet coupling)
        this.version(5).stores({
            images: '++id, name, createdAt',
            worksheets: 'id, title, updatedAt, subjectId, classId',
            designTemplates: 'id, nameLower, updatedAt, createdAt, lastUsedAt',
            classProfiles: 'id, nameLower, subjectId, updatedAt, createdAt',
        });

        // Version 6: add deletedAt index for trash / soft-delete workflows
        this.version(6).stores({
            images: '++id, name, createdAt',
            worksheets: 'id, title, updatedAt, subjectId, classId, deletedAt',
            designTemplates: 'id, nameLower, updatedAt, createdAt, lastUsedAt',
            classProfiles: 'id, nameLower, subjectId, updatedAt, createdAt',
        });

        // Version 7: add custom fonts table for local uploaded fonts
        this.version(7).stores({
            images: '++id, name, createdAt',
            customFonts: '++id, name, createdAt',
            worksheets: 'id, title, updatedAt, subjectId, classId, deletedAt',
            designTemplates: 'id, nameLower, updatedAt, createdAt, lastUsedAt',
            classProfiles: 'id, nameLower, subjectId, updatedAt, createdAt',
        });

        // Version 8: Bibliotheks-Ordner. folderId/tags/favorite auf worksheets
        // werden client-seitig gefiltert (Listen sind klein) → keine neuen Indizes.
        this.version(8).stores({
            folders: 'id, parentId, name',
        });
    }
}

const db = new ABGeneratorDB();

export async function listWorksheetRecords(): Promise<WorksheetRecord[]> {
    return db.worksheets.toArray();
}

export async function listCustomFontRecords(): Promise<CustomFontRecord[]> {
    return db.customFonts.orderBy('createdAt').toArray();
}

export async function listDesignTemplateRecords(): Promise<DesignTemplateRecord[]> {
    return db.designTemplates.toArray();
}

export async function listClassProfileRecords(): Promise<ClassProfileRecord[]> {
    return db.classProfiles.toArray();
}

export async function replaceWorksheetRecords(records: WorksheetRecord[]): Promise<void> {
    await db.transaction('rw', db.worksheets, async () => {
        await db.worksheets.clear();
        if (records.length > 0) {
            await db.worksheets.bulkPut(records);
        }
    });
}

export async function replaceCustomFontRecords(records: CustomFontRecord[]): Promise<void> {
    await db.transaction('rw', db.customFonts, async () => {
        await db.customFonts.clear();
        if (records.length > 0) {
            await db.customFonts.bulkPut(records);
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

export async function replaceClassProfileRecords(records: ClassProfileRecord[]): Promise<void> {
    await db.transaction('rw', db.classProfiles, async () => {
        await db.classProfiles.clear();
        if (records.length > 0) {
            await db.classProfiles.bulkPut(records);
        }
    });
}

export async function clearAllIndexedDbData(): Promise<void> {
    await db.delete();
    await db.open();
}

/* ══════════════════════════════════════════════════
   Custom Font CRUD Helpers
   ══════════════════════════════════════════════════ */

export async function addCustomFont(name: string, data: string, format: CustomFontFormat): Promise<number> {
    const id = await db.customFonts.add({
        name,
        data,
        format,
        createdAt: new Date(),
    });
    return id as number;
}

export async function deleteCustomFont(id: number): Promise<void> {
    await db.customFonts.delete(id);
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
   Class Profile CRUD Helpers
   ══════════════════════════════════════════════════ */

function normalizeClassProfileName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
}

function toClassProfile(record: ClassProfileRecord): ClassProfile {
    return {
        id: record.id,
        name: record.name,
        subjectId: record.subjectId,
        curriculumContext: record.curriculumContext,
        studentProfile: record.studentProfile,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}

export async function listClassProfiles(): Promise<ClassProfile[]> {
    const records = await db.classProfiles.orderBy('updatedAt').reverse().toArray();
    return records.map(toClassProfile);
}

export async function getClassProfile(id: string): Promise<ClassProfile | undefined> {
    const record = await db.classProfiles.get(id);
    return record ? toClassProfile(record) : undefined;
}

export async function createClassProfile(input: CreateClassProfileInput): Promise<ClassProfile> {
    const trimmedName = normalizeClassProfileName(input.name);
    if (!trimmedName) {
        throw new Error('CLASS_PROFILE_NAME_REQUIRED');
    }

    const now = new Date();
    const record: ClassProfileRecord = {
        id: input.id ?? crypto.randomUUID(),
        name: trimmedName,
        nameLower: trimmedName.toLowerCase(),
        subjectId: input.subjectId?.trim() || undefined,
        curriculumContext: input.curriculumContext?.trim() ?? '',
        studentProfile: input.studentProfile?.trim() ?? '',
        createdAt: now,
        updatedAt: now,
    };

    await db.classProfiles.put(record);
    return toClassProfile(record);
}

export async function updateClassProfile(
    id: string,
    patch: UpdateClassProfileInput,
): Promise<ClassProfile | undefined> {
    const current = await db.classProfiles.get(id);
    if (!current) return undefined;

    const nextName = patch.name != null ? normalizeClassProfileName(patch.name) : current.name;
    if (!nextName) {
        throw new Error('CLASS_PROFILE_NAME_REQUIRED');
    }

    const nextRecord: ClassProfileRecord = {
        ...current,
        name: nextName,
        nameLower: nextName.toLowerCase(),
        subjectId:
            patch.subjectId === null
                ? undefined
                : patch.subjectId !== undefined
                    ? (patch.subjectId.trim() || undefined)
                    : current.subjectId,
        curriculumContext:
            patch.curriculumContext !== undefined
                ? patch.curriculumContext.trim()
                : current.curriculumContext,
        studentProfile:
            patch.studentProfile !== undefined
                ? patch.studentProfile.trim()
                : current.studentProfile,
        updatedAt: new Date(),
    };

    await db.classProfiles.put(nextRecord);
    return toClassProfile(nextRecord);
}

export async function deleteClassProfile(id: string): Promise<void> {
    await db.classProfiles.delete(id);
}

export async function countWorksheetsByClassId(classId: string): Promise<number> {
    return db.worksheets.where('classId').equals(classId).count();
}

export async function unlinkClassFromWorksheets(classId: string): Promise<void> {
    const linked = await db.worksheets.where('classId').equals(classId).toArray();
    if (linked.length === 0) return;

    const now = new Date();
    await db.transaction('rw', db.worksheets, async () => {
        for (const worksheet of linked) {
            await db.worksheets.put({
                ...worksheet,
                classId: undefined,
                updatedAt: now,
            });
        }
    });
}

/* ══════════════════════════════════════════════════
   Worksheet CRUD Helpers
   ══════════════════════════════════════════════════ */

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function toWorksheetMeta(rec: WorksheetRecord): WorksheetMeta {
    const { id, title, subjectId, classId, createdAt, updatedAt, deletedAt } = rec;
    const variants = Array.isArray(rec.variants) ? rec.variants : [];
    const activeVariant = variants.find((variant) => variant.id === rec.activeVariantId) ?? variants[0];
    const effectiveTaskIds = activeVariant?.taskIds ?? rec.taskIds;
    const effectiveTasksById = activeVariant?.tasksById ?? rec.tasksById;

    const taskPreview: TaskPreviewItem[] = effectiveTaskIds.slice(0, 4).map((tid) => {
        const t = effectiveTasksById[tid];
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
            case 'heading':
                label = t.text?.slice(0, 60) || label || 'Zwischenüberschrift';
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
            case 'table':
                label = label || `Tabelle ${t.rows}×${t.cols}`;
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
        taskCount: effectiveTaskIds.length,
        variantCount: Math.max(1, variants.length),
        subjectId,
        classId,
        documentSubject: rec.documentSubject,
        documentClassLevel: rec.documentClassLevel,
        createdAt,
        updatedAt,
        taskPreview,
        thumbnailUrl: rec.thumbnailBlob ? URL.createObjectURL(rec.thumbnailBlob) : undefined,
        deletedAt,
        folderId: rec.folderId,
        tags: rec.tags,
        favorite: rec.favorite,
    };
}

/** Speichert (erstellt oder überschreibt) ein Arbeitsblatt */
export async function saveWorksheet(
    id: string,
    title: string,
    tasksById: Record<string, Task>,
    taskIds: string[],
    chatHistory: ChatMessage[],
    sources: WorksheetSource[],
    subjectId?: string,
    classId?: string,
    thumbnailBlob?: Blob,
    variants?: WorksheetVariant[],
    activeVariantId?: string,
    documentSubject?: string,
    documentClassLevel?: string,
): Promise<void> {
    const existing = await db.worksheets.get(id);
    const now = new Date();
    const classIdWasProvided = arguments.length >= 8;

    await db.worksheets.put({
        id,
        title,
        tasksById,
        taskIds,
        chatHistory,
        sources,
        subjectId: subjectId ?? existing?.subjectId,
        classId: classIdWasProvided ? classId : existing?.classId,
        thumbnailBlob: thumbnailBlob ?? existing?.thumbnailBlob,
        variants: variants ?? existing?.variants,
        activeVariantId: activeVariantId ?? existing?.activeVariantId,
        documentSubject: documentSubject ?? existing?.documentSubject,
        documentClassLevel: documentClassLevel ?? existing?.documentClassLevel,
        // Soft-delete status must survive regular autosaves unless explicitly changed elsewhere.
        deletedAt: existing?.deletedAt,
        // Bibliotheks-Metadaten überleben Autosaves — Änderungen laufen
        // ausschließlich über die dedizierten Setter (setWorksheetFolder etc.).
        folderId: existing?.folderId,
        tags: existing?.tags,
        favorite: existing?.favorite,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    });

    // Cloud-Sync benachrichtigen
    notifyDataChanged(`Arbeitsblatt gespeichert: ${title}`);
}

/** Lädt ein vollständiges Arbeitsblatt */
export async function loadWorksheet(id: string): Promise<WorksheetRecord | undefined> {
    return await db.worksheets.get(id);
}

/** Löscht ein Arbeitsblatt */
export async function deleteWorksheet(id: string): Promise<void> {
    await db.worksheets.delete(id);
}

/** Verschiebt ein Arbeitsblatt in den Papierkorb (Soft-Delete) */
export async function softDeleteWorksheet(id: string, deletedAt = Date.now()): Promise<boolean> {
    const existing = await db.worksheets.get(id);
    if (!existing) return false;

    await db.worksheets.put({
        ...existing,
        deletedAt,
        updatedAt: new Date(),
    });
    return true;
}

/** Stellt ein Arbeitsblatt aus dem Papierkorb wieder her */
export async function restoreWorksheet(id: string): Promise<boolean> {
    const existing = await db.worksheets.get(id);
    if (!existing) return false;

    await db.worksheets.put({
        ...existing,
        deletedAt: undefined,
        updatedAt: new Date(),
    });
    return true;
}

/** Leert den Papierkorb vollständig (Hard-Delete aller getrashten Einträge) */
export async function emptyTrash(): Promise<number> {
    return db.worksheets.where('deletedAt').aboveOrEqual(0).delete();
}

/** Filter-Optionen für die Worksheet-Liste */
export interface WorksheetFilter {
    subjectId?: string;
    classId?: string;
    /** Ordner-ID oder 'unsorted' für Arbeitsblätter ohne Ordner. */
    folderId?: string | 'unsorted';
    /** Nur Favoriten anzeigen. */
    favoritesOnly?: boolean;
    /** Nur Arbeitsblätter mit diesem Tag. */
    tag?: string;
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

    // Hide trashed worksheets from the regular dashboard listing.
    records = records.filter((r) => r.deletedAt == null);

    // Client-side filter (Dexie compound-index wäre Overkill hier)
    if (filter?.subjectId) {
        records = records.filter((r) => r.subjectId === filter.subjectId);
    }
    if (filter?.classId) {
        records = records.filter((r) => r.classId === filter.classId);
    }
    if (filter?.folderId) {
        records = filter.folderId === 'unsorted'
            ? records.filter((r) => !r.folderId)
            : records.filter((r) => r.folderId === filter.folderId);
    }
    if (filter?.favoritesOnly) {
        records = records.filter((r) => r.favorite === true);
    }
    if (filter?.tag) {
        records = records.filter((r) => r.tags?.includes(filter.tag as string));
    }

    // Limit nach Filter
    records = records.slice(0, limit);

    return records.map(toWorksheetMeta);
}

/** Gibt nur Arbeitsblätter im Papierkorb zurück (neueste Löschung zuerst) */
export async function listTrashedWorksheets(): Promise<WorksheetMeta[]> {
    const trashed = await db.worksheets
        .where('deletedAt')
        .aboveOrEqual(0)
        .reverse()
        .toArray();

    return trashed.map(toWorksheetMeta);
}

/** Löscht dauerhaft alle Papierkorb-Einträge, die älter als 30 Tage sind */
export async function cleanupTrash(): Promise<number> {
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    return db.worksheets.where('deletedAt').belowOrEqual(cutoff).delete();
}

/* ══════════════════════════════════════════════════
   Bibliotheks-Ordner & Organisation (Phase 7)

   Konzepttrennung (Spec §5): Ordner = Organisation, Fach = fachlicher
   Kontext, Klasse = Lerngruppe/KI-Kontext, Tags = flexible Suche.
   Die Organisations-Setter bumpen updatedAt bewusst NICHT — Einsortieren
   soll die "Zuletzt bearbeitet"-Reihenfolge nicht verfälschen.
   ══════════════════════════════════════════════════ */

/** Alle Ordner, alphabetisch. */
export async function listFolders(): Promise<FolderRecord[]> {
    const folders = await db.folders.toArray();
    return folders.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export async function createFolder(name: string, parentId: string | null = null): Promise<FolderRecord> {
    const now = new Date();
    const folder: FolderRecord = {
        id: crypto.randomUUID(),
        name: name.trim() || 'Neuer Ordner',
        parentId,
        createdAt: now,
        updatedAt: now,
    };
    await db.folders.put(folder);
    notifyDataChanged(`Ordner erstellt: ${folder.name}`);
    return folder;
}

export async function renameFolder(id: string, name: string): Promise<FolderRecord | undefined> {
    const existing = await db.folders.get(id);
    if (!existing) return undefined;
    const next: FolderRecord = { ...existing, name: name.trim() || existing.name, updatedAt: new Date() };
    await db.folders.put(next);
    notifyDataChanged(`Ordner umbenannt: ${next.name}`);
    return next;
}

/**
 * Löscht einen Ordner. Enthaltene Arbeitsblätter wandern nach "Unsortiert"
 * (folderId = undefined), Unterordner rücken auf die Elternebene des
 * gelöschten Ordners — es geht nie Inhalt verloren.
 */
export async function deleteFolder(id: string): Promise<void> {
    const folder = await db.folders.get(id);
    if (!folder) return;

    await db.transaction('rw', db.folders, db.worksheets, async () => {
        // folderId ist bewusst unindiziert (client-seitige Filterung) → Scan statt where().
        await db.worksheets.filter((w) => w.folderId === id).modify({ folderId: undefined });
        await db.folders.where('parentId').equals(id).modify({ parentId: folder.parentId });
        await db.folders.delete(id);
    });
    notifyDataChanged(`Ordner gelöscht: ${folder.name}`);
}

/** Verschiebt ein Arbeitsblatt in einen Ordner (undefined = Unsortiert). */
export async function setWorksheetFolder(id: string, folderId: string | undefined): Promise<boolean> {
    const existing = await db.worksheets.get(id);
    if (!existing) return false;
    await db.worksheets.put({ ...existing, folderId });
    notifyDataChanged('Arbeitsblatt einsortiert');
    return true;
}

export async function setWorksheetTags(id: string, tags: string[]): Promise<boolean> {
    const existing = await db.worksheets.get(id);
    if (!existing) return false;
    const normalized = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
    await db.worksheets.put({ ...existing, tags: normalized });
    notifyDataChanged('Tags aktualisiert');
    return true;
}

export async function setWorksheetFavorite(id: string, favorite: boolean): Promise<boolean> {
    const existing = await db.worksheets.get(id);
    if (!existing) return false;
    await db.worksheets.put({ ...existing, favorite });
    notifyDataChanged(favorite ? 'Als Favorit markiert' : 'Favorit entfernt');
    return true;
}
