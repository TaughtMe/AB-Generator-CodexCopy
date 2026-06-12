import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    saveWorksheet,
    loadWorksheet,
    deleteWorksheet as hardDeleteWorksheetRecord,
    softDeleteWorksheet as softDeleteWorksheetRecord,
    restoreWorksheet as restoreWorksheetRecord,
    emptyTrash as emptyTrashRecords,
    listRecentWorksheets,
    listTrashedWorksheets,
    cleanupTrash,
    listClassProfiles,
    getClassProfile,
    createClassProfile as createClassProfileRecord,
    updateClassProfile as updateClassProfileRecord,
    deleteClassProfile as deleteClassProfileRecord,
    countWorksheetsByClassId,
    unlinkClassFromWorksheets,
    createDesignTemplate,
    deleteDesignTemplate,
    getDesignTemplate,
    getImage,
    addImage,
    listDesignTemplates,
    markDesignTemplateUsed,
    updateDesignTemplate,
    getDesignTemplateByName,
    upsertDesignTemplateByName,
    type WorksheetMeta,
    type WorksheetFilter,
    type WorksheetRecord,
} from './dexieStore';
import { useWorksheetStore } from './worksheetStore';
import type { ChatMessage } from '../types/ai';
import { useSettingsStore } from './settingsStore';
import { useProfileStore } from './profileStore';
import { normalizeTemplateName, type DesignTemplate } from '../types/designTemplate';
import {
    AI_JSON_TRUNCATED_USER_MESSAGE,
    generateChatAssistantReply,
    generateTaskRevisionResult,
    type AIClassContext,
} from '../services/aiService';
import { parseOperations, validateOperations } from '../features/ai/operations';
import { usePatchStore } from '../features/ai/patchStore';
import type { Editor } from '@tiptap/react';
import type { Task, WorksheetSource, WorksheetVariant } from '../types/worksheet';
import type { ClassProfile } from '../types/profiles';
import { normalizeDesignSnapshot, type DesignSnapshot } from '../types/designTemplate';

const CHAT_GREETING = 'Hallo! Ich helfe dir beim Planen deines Arbeitsblatts. Nenne mir zuerst Thema, Klasse und gewünschte Aufgabentypen.';
const LEGACY_CLASS_MIGRATION_FLAG = 'ab-generator-classprofiles-migrated-v1';

function hasLegacyClassMigrationRun(): boolean {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(LEGACY_CLASS_MIGRATION_FLAG) === '1';
}

function markLegacyClassMigrationDone(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LEGACY_CLASS_MIGRATION_FLAG, '1');
}

function buildAIClassContextFromProfile(profile?: ClassProfile): AIClassContext | undefined {
    if (!profile) return undefined;

    const subject = profile.subjectId
        ? useProfileStore.getState().subjects.find((entry) => entry.id === profile.subjectId)
        : undefined;

    return {
        className: profile.name,
        subjectName: subject?.name,
        curriculumContext: profile.curriculumContext,
        studentProfile: profile.studentProfile || profile.characteristic || '',
    };
}

function isUnexpectedRevisionProgrammingError(error: unknown): boolean {
    return error instanceof ReferenceError;
}

/**
 * Heuristic: decide whether we should try task-revision or fall back to
 * a pure conversational reply.  Task-revision is expensive and can
 * misinterpret planning / discussion messages as commands to update tasks.
 *
 * Returns `true` only when there are tasks to revise AND the latest user
 * message looks intentional (not long pasted context, not a greeting,
 * not an early planning exchange).
 */
const TASK_ACTION_KEYWORDS = /\b(änder|aktualisier|ersetze?|lösch|entfern|füg|hinzu|verschieb|umschreib|korrigier|ergänz|tausch|formulier|überarbeit|kürz|verlänger|vereinfach|anpass|Aufgabe\s*\d)/i;
const CONVERSATIONAL_START_PATTERNS = /^(hi|hallo|hey|guten\s+(morgen|tag|abend))\b/i;

function shouldAttemptTaskRevision(
    latestUserMessage: string,
    allMessages: ChatMessage[],
    taskCount: number,
): boolean {
    // No tasks in the worksheet → nothing to revise & don't accidentally add
    if (taskCount === 0) return false;

    // Very first user message → normally context-setting, not a revision request
    const userMessageCount = allMessages.filter((m) => m.role === 'user').length;
    if (userMessageCount <= 1) return false;

    // If greeting / introduction, skip revision
    if (CONVERSATIONAL_START_PATTERNS.test(latestUserMessage.trim())) return false;

    // Very long pasted content (>1200 chars) without explicit action keywords
    // is likely additional context, not a change request
    if (latestUserMessage.length > 1200 && !TASK_ACTION_KEYWORDS.test(latestUserMessage)) return false;

    return true;
}

const ABGEN_WORKSHEET_SCHEMA_V1 = 1;
const ABGEN_WORKSHEET_SCHEMA_V2 = 2;
const ABGEN_LATEST_WORKSHEET_SCHEMA_VERSION = ABGEN_WORKSHEET_SCHEMA_V2;

type AbgenEmbeddedImageAsset = {
    id: number;
    name: string;
    mimeType: string;
    dataBase64: string;
};

type AbgenWorksheetExportPayload = {
    app: 'ab-generator';
    kind: 'worksheet';
    schemaVersion: number;
    exportedAt: string;
    worksheet: {
        originalId: string;
        title: string;
        tasksById: Record<string, Task>;
        taskIds: string[];
        variants?: WorksheetVariant[];
        activeVariantId?: string;
        chatHistory: ChatMessage[];
        sources: WorksheetSource[];
        subjectId?: string;
        classId?: string;
        createdAt?: string;
        updatedAt?: string;
        design?: Partial<DesignSnapshot>;
    };
    assets?: {
        images: AbgenEmbeddedImageAsset[];
    };
};

type AbgenWorksheetImportData = {
    title: string;
    tasksById: Record<string, Task>;
    taskIds: string[];
    variants?: WorksheetVariant[];
    activeVariantId?: string;
    chatHistory: ChatMessage[];
    sources: WorksheetSource[];
    subjectId?: string;
    classId?: string;
    design?: DesignSnapshot;
    embeddedImages?: AbgenEmbeddedImageAsset[];
};

function deepClonePlainObject<T>(value: T): T {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as T;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function collectWorksheetImageIds(tasksById: Record<string, Task>): number[] {
    const ids = new Set<number>();
    for (const task of Object.values(tasksById)) {
        if (task.type !== 'image-placeholder') continue;
        if (typeof task.imageId === 'number' && Number.isFinite(task.imageId)) {
            ids.add(task.imageId);
        }
    }
    return [...ids];
}

function remapTaskImageIds(tasksById: Record<string, Task>, imageIdMap: Map<number, number>): Record<string, Task> {
    const cloned = deepClonePlainObject(tasksById);
    for (const task of Object.values(cloned)) {
        if (task.type !== 'image-placeholder') continue;
        if (typeof task.imageId !== 'number') continue;
        const remapped = imageIdMap.get(task.imageId);
        task.imageId = remapped;
    }
    return cloned;
}

function remapVariantImageIds(
    variants: WorksheetVariant[] | undefined,
    imageIdMap: Map<number, number>,
): WorksheetVariant[] | undefined {
    if (!variants || imageIdMap.size === 0) return variants;
    return variants.map((variant) => ({
        ...variant,
        tasksById: remapTaskImageIds(variant.tasksById, imageIdMap),
        taskIds: [...variant.taskIds],
    }));
}

async function blobToBase64(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function base64ToBlob(dataBase64: string, mimeType: string): Blob {
    const binary = atob(dataBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

async function buildEmbeddedImageAssetsForWorksheetExport(
    record: WorksheetRecord,
    design: DesignSnapshot,
): Promise<AbgenEmbeddedImageAsset[]> {
    const imageIds = new Set<number>(collectWorksheetImageIds(record.tasksById));
    for (const variant of record.variants ?? []) {
        for (const imageId of collectWorksheetImageIds(variant.tasksById)) {
            imageIds.add(imageId);
        }
    }
    if (typeof design.logoImageId === 'number' && Number.isFinite(design.logoImageId)) {
        imageIds.add(design.logoImageId);
    }

    const assets: AbgenEmbeddedImageAsset[] = [];
    for (const imageId of imageIds) {
        const image = await getImage(imageId);
        if (!image) continue;
        assets.push({
            id: imageId,
            name: image.name,
            mimeType: image.blob.type || 'application/octet-stream',
            dataBase64: await blobToBase64(image.blob),
        });
    }

    return assets;
}

function cloneWorksheetDataWithFreshIds(input: {
    title: string;
    tasksById: Record<string, Task>;
    taskIds: string[];
    chatHistory: ChatMessage[];
    sources: WorksheetSource[];
    titleSuffix?: string;
}): {
    id: string;
    title: string;
    tasksById: Record<string, Task>;
    taskIds: string[];
    chatHistory: ChatMessage[];
    sources: WorksheetSource[];
} {
    const nextWorksheetId = crypto.randomUUID();
    const allTaskIds = Object.keys(input.tasksById);
    const taskIdMap: Record<string, string> = Object.fromEntries(
        allTaskIds.map((taskId) => [taskId, crypto.randomUUID()]),
    );

    const nextTasksById: Record<string, Task> = {};

    for (const [taskId, task] of Object.entries(input.tasksById)) {
        const clonedTask = deepClonePlainObject(task);
        clonedTask.id = taskIdMap[taskId] ?? crypto.randomUUID();

        if (clonedTask.type === 'multiple-choice') {
            clonedTask.options = clonedTask.options.map((option) => ({
                ...option,
                id: crypto.randomUUID(),
            }));
        }

        if (clonedTask.type === 'columns') {
            clonedTask.children = clonedTask.children.map((childId) => (
                childId ? (taskIdMap[childId] ?? null) : null
            )) as [string | null, string | null];
        }

        nextTasksById[clonedTask.id] = clonedTask;
    }

    return {
        id: nextWorksheetId,
        title: `${input.title}${input.titleSuffix ?? ''}`,
        tasksById: nextTasksById,
        taskIds: input.taskIds.map((taskId) => taskIdMap[taskId]).filter(Boolean),
        chatHistory: deepClonePlainObject(input.chatHistory ?? []),
        sources: deepClonePlainObject(input.sources ?? []),
    };
}

function cloneWorksheetVariantsWithFreshIds(
    variants: WorksheetVariant[] | undefined,
): { variants?: WorksheetVariant[]; variantIdMap: Map<string, string> } {
    if (!variants || variants.length === 0) {
        return { variants: undefined, variantIdMap: new Map() };
    }

    const variantIdMap = new Map<string, string>();
    const clonedVariants = variants.map((variant) => {
        const cloned = cloneWorksheetDataWithFreshIds({
            title: '',
            tasksById: variant.tasksById,
            taskIds: variant.taskIds,
            chatHistory: [],
            sources: [],
        });
        const nextVariantId = crypto.randomUUID();
        variantIdMap.set(variant.id, nextVariantId);

        return {
            id: nextVariantId,
            label: variant.label,
            tasksById: cloned.tasksById,
            taskIds: cloned.taskIds,
        };
    });

    return { variants: clonedVariants, variantIdMap };
}

function parseAbgenWorksheetJson(raw: string): AbgenWorksheetImportData {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('Die Datei ist kein gültiges JSON.');
    }

    if (!isObjectRecord(parsed)) {
        throw new Error('Die Datei enthält kein gültiges Objekt.');
    }

    if (parsed.app !== 'ab-generator' || parsed.kind !== 'worksheet') {
        throw new Error('Dies ist keine gültige .abgen-Arbeitsblattdatei.');
    }

    if (parsed.schemaVersion !== ABGEN_WORKSHEET_SCHEMA_V1 && parsed.schemaVersion !== ABGEN_WORKSHEET_SCHEMA_V2) {
        throw new Error('Dieses .abgen-Format wird nicht unterstützt.');
    }

    const worksheet = parsed.worksheet;
    if (!isObjectRecord(worksheet)) {
        throw new Error('Der Arbeitsblatt-Block ist ungültig.');
    }

    if (!isObjectRecord(worksheet.tasksById)) {
        if (!Array.isArray(worksheet.variants)) {
            throw new Error('tasksById ist ungültig.');
        }
    }

    if (
        worksheet.taskIds !== undefined
        && (!Array.isArray(worksheet.taskIds) || !worksheet.taskIds.every((id) => typeof id === 'string'))
    ) {
        throw new Error('taskIds ist ungültig.');
    }

    if (worksheet.chatHistory !== undefined && !Array.isArray(worksheet.chatHistory)) {
        throw new Error('chatHistory ist ungültig.');
    }

    if (worksheet.sources !== undefined && !Array.isArray(worksheet.sources)) {
        throw new Error('sources ist ungültig.');
    }

    let variants: WorksheetVariant[] | undefined;
    if (worksheet.variants !== undefined) {
        if (!Array.isArray(worksheet.variants)) {
            throw new Error('variants ist ungültig.');
        }

        variants = worksheet.variants.map((entry) => {
            if (!isObjectRecord(entry)) {
                throw new Error('Eine Variante ist ungültig.');
            }
            if (!isObjectRecord(entry.tasksById)) {
                throw new Error('variant.tasksById ist ungültig.');
            }
            if (!Array.isArray(entry.taskIds) || !entry.taskIds.every((id) => typeof id === 'string')) {
                throw new Error('variant.taskIds ist ungültig.');
            }

            return {
                id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : crypto.randomUUID(),
                label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : 'Variante',
                tasksById: deepClonePlainObject(entry.tasksById as Record<string, Task>),
                taskIds: [...entry.taskIds],
            } satisfies WorksheetVariant;
        });
    }

    const design = worksheet.design && isObjectRecord(worksheet.design)
        ? normalizeDesignSnapshot(worksheet.design as Partial<DesignSnapshot>)
        : undefined;

    let embeddedImages: AbgenEmbeddedImageAsset[] | undefined;
    if (parsed.schemaVersion === ABGEN_WORKSHEET_SCHEMA_V2) {
        const assets = parsed.assets;
        if (assets !== undefined) {
            if (!isObjectRecord(assets) || !Array.isArray(assets.images)) {
                throw new Error('assets.images ist ungültig.');
            }

            embeddedImages = assets.images.map((entry) => {
                if (!isObjectRecord(entry)) {
                    throw new Error('Ein eingebettetes Bild ist ungültig.');
                }
                if (typeof entry.id !== 'number' || !Number.isFinite(entry.id)) {
                    throw new Error('Bild-ID im Asset ist ungültig.');
                }
                if (typeof entry.name !== 'string') {
                    throw new Error('Bildname im Asset ist ungültig.');
                }
                if (typeof entry.mimeType !== 'string') {
                    throw new Error('Bild-MIME-Type im Asset ist ungültig.');
                }
                if (typeof entry.dataBase64 !== 'string') {
                    throw new Error('Bilddaten im Asset sind ungültig.');
                }
                return {
                    id: entry.id,
                    name: entry.name,
                    mimeType: entry.mimeType,
                    dataBase64: entry.dataBase64,
                };
            });
        }
    }

    return {
        title: typeof worksheet.title === 'string' && worksheet.title.trim()
            ? worksheet.title.trim()
            : 'Importiertes Arbeitsblatt',
        tasksById: deepClonePlainObject((worksheet.tasksById ?? {}) as Record<string, Task>),
        taskIds: Array.isArray(worksheet.taskIds) ? [...worksheet.taskIds] : [],
        variants,
        activeVariantId:
            typeof worksheet.activeVariantId === 'string' && worksheet.activeVariantId.trim()
                ? worksheet.activeVariantId.trim()
                : undefined,
        chatHistory: deepClonePlainObject((worksheet.chatHistory ?? []) as ChatMessage[]),
        sources: deepClonePlainObject((worksheet.sources ?? []) as WorksheetSource[]),
        subjectId:
            typeof worksheet.subjectId === 'string' && worksheet.subjectId.trim()
                ? worksheet.subjectId.trim()
                : undefined,
        classId:
            typeof worksheet.classId === 'string' && worksheet.classId.trim()
                ? worksheet.classId.trim()
                : undefined,
        design,
        embeddedImages,
    };
}

function buildDuplicatedWorksheetRecord(record: WorksheetRecord): {
    id: string;
    title: string;
    tasksById: Record<string, Task>;
    taskIds: string[];
    variants?: WorksheetVariant[];
    activeVariantId?: string;
    chatHistory: ChatMessage[];
    sources: WorksheetSource[];
} {
    const cloned = cloneWorksheetDataWithFreshIds({
        title: record.title,
        tasksById: record.tasksById,
        taskIds: record.taskIds,
        chatHistory: record.chatHistory ?? [],
        sources: record.sources ?? [],
        titleSuffix: ' (Kopie)',
    });

    const { variants, variantIdMap } = cloneWorksheetVariantsWithFreshIds(record.variants);
    const activeVariantId = record.activeVariantId ? variantIdMap.get(record.activeVariantId) : undefined;

    return {
        ...cloned,
        variants,
        activeVariantId: activeVariantId ?? variants?.[0]?.id,
    };
}

function sanitizeWorksheetExportFilename(title: string): string {
    const base = title
        .replace(/[^a-zA-Z0-9äöüÄÖÜß\s_-]/g, '')
        .trim()
        .replace(/\s+/g, ' ');
    return `${base || 'Arbeitsblatt'}.abgen`;
}

async function createWorksheetExportPayload(
    record: WorksheetRecord,
    version: 1 | 2 = ABGEN_LATEST_WORKSHEET_SCHEMA_VERSION,
): Promise<AbgenWorksheetExportPayload> {
    const design = useSettingsStore.getState().getDesignSnapshot();
    const normalizedDesign = normalizeDesignSnapshot(design);
    const includeEmbeddedImages = version >= ABGEN_WORKSHEET_SCHEMA_V2;
    const embeddedImages = includeEmbeddedImages
        ? await buildEmbeddedImageAssetsForWorksheetExport(record, normalizedDesign)
        : [];

    return {
        app: 'ab-generator',
        kind: 'worksheet',
        schemaVersion: version,
        exportedAt: new Date().toISOString(),
        worksheet: {
            originalId: record.id,
            title: record.title,
            tasksById: deepClonePlainObject(record.tasksById),
            taskIds: deepClonePlainObject(record.taskIds),
            variants: record.variants ? deepClonePlainObject(record.variants) : undefined,
            activeVariantId: record.activeVariantId,
            chatHistory: deepClonePlainObject(record.chatHistory ?? []),
            sources: deepClonePlainObject(record.sources ?? []),
            subjectId: record.subjectId,
            classId: record.classId,
            createdAt: record.createdAt?.toISOString(),
            updatedAt: record.updatedAt?.toISOString(),
            design: normalizedDesign,
        },
        assets: includeEmbeddedImages ? { images: embeddedImages } : undefined,
    };
}

async function createWorksheetExportArtifact(
    record: WorksheetRecord,
    version: 1 | 2 = ABGEN_LATEST_WORKSHEET_SCHEMA_VERSION,
): Promise<{
    filename: string;
    json: string;
    blob: Blob;
}> {
    const payload = await createWorksheetExportPayload(record, version);
    const json = JSON.stringify(payload, null, 2);
    return {
        filename: sanitizeWorksheetExportFilename(record.title),
        json,
        blob: new Blob([json], { type: 'application/json;charset=utf-8' }),
    };
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
        throw new Error('Download ist in dieser Umgebung nicht verfügbar.');
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function canShareFiles(): boolean {
    if (typeof navigator === 'undefined' || typeof File === 'undefined') return false;
    if (typeof navigator.share !== 'function') return false;

    const canShareFn = (navigator as Navigator & { canShare?: (data?: ShareData) => boolean }).canShare;
    if (typeof canShareFn !== 'function') return false;

    try {
        const file = new File(['{}'], 'test.abgen', { type: 'application/json' });
        return canShareFn.call(navigator, { files: [file] });
    } catch {
        return false;
    }
}

/* ══════════════════════════════════════════════════
   workspaceStore.ts – Workspace / Worksheet Management
   Verbindet worksheetStore (In-Memory) mit Dexie (Persistenz).
   ══════════════════════════════════════════════════ */

/** @deprecated Nur noch als Compat-Re-Export – intern durch CustomProvider ersetzt. */
export type ProviderId = string;

export interface CustomProvider {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    presetId: string;
}

export interface AIModel {
    id: string;
    name: string;
    providerId: string;
}

function normalizeOpenAICompatibleProviderBaseUrl(baseUrl: string): string {
    const trimmed = baseUrl.trim().replace(/\/+$/, '');
    if (!trimmed) return '';
    if (/\/v1$/i.test(trimmed)) return trimmed;
    return `${trimmed}/v1`;
}

function getModelEndpointBaseUrlCandidates(baseUrl: string): string[] {
    const normalized = normalizeOpenAICompatibleProviderBaseUrl(baseUrl);
    if (!normalized) return [];

    const candidates = [normalized];

    try {
        const url = new URL(normalized);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            const dockerHostUrl = new URL(normalized);
            dockerHostUrl.hostname = 'host.docker.internal';
            candidates.push(dockerHostUrl.toString().replace(/\/+$/, ''));
        }
    } catch {
        return candidates;
    }

    return Array.from(new Set(candidates));
}

interface WorkspaceState {
    recentWorksheets: WorksheetMeta[];
    trashedWorksheets: WorksheetMeta[];
    classProfiles: ClassProfile[];
    currentWorksheetId: string | null;
    isLoading: boolean;
    isClassProfilesLoading: boolean;
    classProfilesError: string | null;
    /** Aktive Filter für die Materialien-Ansicht */
    filter: WorksheetFilter;
    currentView: WorkspaceView;
    providers: CustomProvider[];
    availableModels: AIModel[];
    quickAccessModels: string[];
    activeModel: string;
    aiModel: string;
    chatMessages: ChatMessage[];
    aiSidebarDraft: string;
    isChatLoading: boolean;
    chatError: string | null;
    chatStatusNotice: string | null;
    isChatGenerating: boolean;
    isAiSidebarOpen: boolean;
    /** Outline-Navigator (linke Sidebar im Editor) */
    isOutlineOpen: boolean;
    /** Placement-Modus: Nutzer platziert eine neue Aufgabe per Klick im Canvas */
    isPlacingNewTask: boolean;
    designTemplates: DesignTemplate[];
    selectedTemplateId: string | null;
    isTemplateLoading: boolean;
    isTemplateGalleryOpen: boolean;
    editingTemplateId: string | null;
    autoSaveStatus: WorkspaceAutoSaveStatus;
    /** Aktuell fokussierter Tiptap-Editor (für Ribbon-Toolbar) */
    activeEditor: Editor | null;
    documentMeta: DocumentMeta;
    savedFiles: SavedFileSnapshot[];
    isFirstSave: boolean;
    agentPhase: AgentPhase;
    agentLogs: string[];
    isAgentRunning: boolean;
    afbConfig: AfbConfig;
}

export type WorkspaceView = 'dashboard' | 'ai-chat' | 'editor';
export type AgentPhase = 'idle' | 'planning' | 'creating' | 'validating' | 'success' | 'error';

export interface AfbConfig {
    isActive: boolean;
    reproduktion: number;
    reorganisation: number;
    transfer: number;
    problemloesung: number;
}
export type WorkspaceAutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type DocumentMeta = {
    title: string;
    subject: string;
    classLevel: string;
};

type SavedFileSnapshot = {
    id: string;
    meta: DocumentMeta;
    lastModified: string;
    tasks?: Task[];
    taskCount?: number;
    variations?: unknown[];
    variationCount?: number;
};

type PersistWorksheetOptions = {
    refreshRecent?: boolean;
    setCurrentWorksheetId?: boolean;
};

type PersistCurrentWorksheetOptions = PersistWorksheetOptions & {
    thumbnail?: Blob;
    chatHistory?: ChatMessage[];
    sources?: WorksheetSource[];
};

interface WorkspaceActions {
    loadClassProfiles: () => Promise<void>;
    createClassProfile: (payload: {
        name: string;
        subjectId?: string;
        curriculumContext?: string;
        studentProfile?: string;
    }) => Promise<ClassProfile>;
    updateClassProfile: (id: string, patch: {
        name?: string;
        subjectId?: string | null;
        curriculumContext?: string;
        studentProfile?: string;
    }) => Promise<ClassProfile | undefined>;
    removeClassProfile: (id: string) => Promise<void>;
    getClassProfileById: (id: string) => ClassProfile | undefined;
    /** Lädt die "Zuletzt bearbeitet" Liste aus Dexie (mit optionalem Filter) */
    loadRecent: (filter?: WorksheetFilter) => Promise<void>;
    /** Lädt den Papierkorb aus Dexie */
    loadTrash: () => Promise<void>;
    /** Setzt den aktiven Filter und lädt neu */
    setFilter: (filter: WorksheetFilter) => Promise<void>;
    addProvider: () => void;
    updateProvider: (id: string, updates: Partial<CustomProvider>) => void;
    removeProvider: (id: string) => void;
    toggleQuickAccessModel: (modelId: string) => void;
    setActiveModel: (modelId: string) => void;
    fetchModelsForProvider: (providerId: string) => Promise<AIModel[]>;
    /** Speichert das aktuelle Arbeitsblatt in Dexie.
     *  Optionaler `thumbnail`-Blob wird direkt mitgespeichert.
     *  Wird kein Blob übergeben, bleibt das alte Thumbnail erhalten. */
    saveCurrentWorksheet: (thumbnail?: Blob) => Promise<void>;
    /** Öffnet ein gespeichertes Arbeitsblatt im Editor */
    openWorksheet: (id: string) => Promise<boolean>;
    /** Erstellt ein neues leeres Arbeitsblatt */
    createNewWorksheet: () => void;
    /** Verschiebt ein Arbeitsblatt in den Papierkorb und aktualisiert die Listen */
    deleteWorksheet: (id: string) => Promise<void>;
    /** Kompatibilitäts-Alias: Soft-Delete */
    removeWorksheet: (id: string) => Promise<void>;
    /** Stellt ein Arbeitsblatt aus dem Papierkorb wieder her */
    restoreWorksheet: (id: string) => Promise<void>;
    /** Löscht ein Arbeitsblatt endgültig aus Dexie */
    hardDeleteWorksheet: (id: string) => Promise<void>;
    /** Leert den Papierkorb endgültig */
    emptyTrash: () => Promise<void>;
    /** Dupliziert ein gespeichertes Arbeitsblatt inkl. frischer Task-IDs */
    duplicateWorksheet: (id: string) => Promise<string | null>;
    /** Exportiert ein gespeichertes Arbeitsblatt als .abgen-Datei (default: V2) */
    exportWorksheet: (id: string, version?: 1 | 2) => Promise<void>;
    /** Teilt ein gespeichertes Arbeitsblatt als .abgen-Datei via Web Share API */
    shareWorksheet: (id: string) => Promise<boolean>;
    /** UI-Helfer für bedingte Anzeige des nativen Teilen-Buttons */
    canShareWorksheetFiles: () => boolean;
    /** Importiert ein Arbeitsblatt aus einer .abgen-Datei und speichert es mit neuen IDs */
    importWorksheet: (file: File) => Promise<string | null>;
    setCurrentView: (view: WorkspaceView) => void;
    setAiModel: (model: string) => void;
    addChatMessage: (message: ChatMessage) => void;
    setChatMessages: (messages: ChatMessage[]) => void;
    setAiSidebarDraft: (draft: string) => void;
    clearChat: () => void;
    setIsChatGenerating: (isGenerating: boolean) => void;
    setChatError: (error: string | null) => void;
    setChatStatusNotice: (notice: string | null) => void;
    clearChatError: () => void;
    seedGreetingIfEmpty: () => void;
    startNewChat: () => void;
    sendChatMessage: (text: string) => Promise<void>;
    /** Bricht alle laufenden KI-Chat-Requests ab */
    abortChat: () => void;
    createDifferentiatedVariantFromPrompt: (instruction: string, label?: string) => Promise<boolean>;
    setWorksheetSources: (sources: WorksheetSource[]) => Promise<void>;
    upsertWorksheetSource: (source: WorksheetSource) => Promise<void>;
    removeWorksheetSource: (sourceId: string) => Promise<void>;
    toggleAiSidebar: () => void;
    toggleOutline: () => void;
    /** Startet den Placement-Modus: Maus-Klick im Canvas platziert neue Aufgabe */
    startPlacingTask: () => void;
    /** Bricht den Placement-Modus ab */
    cancelPlacingTask: () => void;
    loadDesignTemplates: () => Promise<void>;
    saveCurrentDesignAsTemplate: (name: string, overwrite?: boolean, targetTemplateId?: string) => Promise<DesignTemplate>;
    applyTemplateToCurrentWorksheet: (templateId: string) => Promise<boolean>;
    removeDesignTemplate: (templateId: string) => Promise<void>;
    openTemplateGallery: () => void;
    closeTemplateGallery: () => void;
    startTemplateEdit: (templateId: string) => void;
    clearTemplateEdit: () => void;
    setActiveEditor: (editor: Editor | null) => void;
    updateTask: (taskId: string, updates: Partial<Task>) => void;
    updateDocumentMeta: (meta: Partial<DocumentMeta>) => void;
    saveCurrentDocument: () => void;
    deleteDocuments: (ids: string[]) => Promise<void>;
    markAsSaved: () => void;
    startAgent: () => void;
    resetAgent: () => void;
    addAgentLog: (message: string) => void;
    setAgentPhase: (phase: AgentPhase) => void;
}

type WorkspaceStore = WorkspaceState & WorkspaceActions;

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => {
    let latestPersistOperationId = 0;
    let latestChatRequestId = 0;
    let hasInitialTrashCleanupRun = false;
    let chatAbortController: AbortController | null = null;

    const persistWorksheetRecordWithStatus = async (
        params: Parameters<typeof saveWorksheet>,
        options: PersistWorksheetOptions = {},
    ): Promise<void> => {
        const operationId = ++latestPersistOperationId;
        useWorksheetStore.getState().setSaveStatus('saving');
        set({ autoSaveStatus: 'saving' });

        try {
            await saveWorksheet(...params);

            if (options.setCurrentWorksheetId) {
                set({ currentWorksheetId: params[0] });
            }

            if (options.refreshRecent) {
                await get().loadRecent();
            }

            if (operationId === latestPersistOperationId) {
                useWorksheetStore.getState().setSaveStatus('saved');
                set({ autoSaveStatus: 'saved' });
            }
        } catch (error) {
            if (operationId === latestPersistOperationId) {
                useWorksheetStore.getState().setSaveStatus('unsaved');
                set({ autoSaveStatus: 'error' });
            }
            throw error;
        }
    };

    const persistCurrentWorksheetWithStatus = async (options: PersistCurrentWorksheetOptions = {}): Promise<void> => {
        const ws = useWorksheetStore.getState();
        const meta = get().documentMeta;
        await persistWorksheetRecordWithStatus(
            [
                ws.id,
                ws.title,
                ws.tasksById,
                ws.taskIds,
                options.chatHistory ?? ws.chatHistory,
                options.sources ?? ws.sources,
                undefined,
                ws.classId,
                options.thumbnail,
                ws.variants,
                ws.activeVariantId,
                meta.subject,
                meta.classLevel,
            ],
            options,
        );
    };
    const runInitialTrashCleanupOnce = async (): Promise<void> => {
        if (hasInitialTrashCleanupRun) return;
        hasInitialTrashCleanupRun = true;
        try {
            await cleanupTrash();
        } catch (error) {
            console.warn('cleanupTrash() beim Store-Start fehlgeschlagen:', error);
        }
    };

    const store: WorkspaceStore = {
    recentWorksheets: [],
    trashedWorksheets: [],
    classProfiles: [],
    currentWorksheetId: null,
    isLoading: false,
    isClassProfilesLoading: false,
    classProfilesError: null,
    filter: {},
    currentView: 'dashboard',
    providers: [],
    availableModels: [],
    quickAccessModels: [],
    activeModel: '',
    aiModel: 'GPT-4o (Standard)',
    chatMessages: [],
    aiSidebarDraft: '',
    isChatLoading: false,
    chatError: null,
    chatStatusNotice: null,
    isChatGenerating: false,
    isAiSidebarOpen: false,
    isOutlineOpen: false,
    isPlacingNewTask: false,
    designTemplates: [],
    selectedTemplateId: null,
    isTemplateLoading: false,
    isTemplateGalleryOpen: false,
    editingTemplateId: null,
    autoSaveStatus: 'idle',
    activeEditor: null,
    documentMeta: {
        title: 'Unbenannt',
        subject: '',
        classLevel: '',
    },
    savedFiles: [],
    isFirstSave: true,
    agentPhase: 'idle',
    agentLogs: [],
    isAgentRunning: false,
    afbConfig: {
        isActive: false,
        reproduktion: 25,
        reorganisation: 25,
        transfer: 25,
        problemloesung: 25,
    },

    loadClassProfiles: async () => {
        set({ isClassProfilesLoading: true, classProfilesError: null });
        try {
            let profiles = await listClassProfiles();

            if (profiles.length === 0 && !hasLegacyClassMigrationRun()) {
                const legacyClasses = useProfileStore.getState().classes;

                for (const legacy of legacyClasses) {
                    const legacyStudentProfile = typeof legacy.studentProfile === 'string'
                        ? legacy.studentProfile
                        : (legacy.characteristic ?? '');

                    await createClassProfileRecord({
                        id: legacy.id,
                        name: legacy.name,
                        subjectId: legacy.subjectId,
                        curriculumContext: legacy.curriculumContext ?? '',
                        studentProfile: legacyStudentProfile,
                    });
                }

                markLegacyClassMigrationDone();
                profiles = await listClassProfiles();
            }

            set({ classProfiles: profiles, isClassProfilesLoading: false, classProfilesError: null });
        } catch (error) {
            set({
                isClassProfilesLoading: false,
                classProfilesError: error instanceof Error ? error.message : 'Klassenprofile konnten nicht geladen werden.',
            });
        }
    },

    createClassProfile: async (payload) => {
        const created = await createClassProfileRecord(payload);
        set((state) => ({
            classProfiles: [created, ...state.classProfiles.filter((entry) => entry.id !== created.id)],
            classProfilesError: null,
        }));
        return created;
    },

    updateClassProfile: async (id, patch) => {
        const updated = await updateClassProfileRecord(id, patch);
        if (!updated) return undefined;

        set((state) => ({
            classProfiles: state.classProfiles
                .map((entry) => (entry.id === id ? updated : entry))
                .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()),
            classProfilesError: null,
        }));

        return updated;
    },

    removeClassProfile: async (id) => {
        const linkedCount = await countWorksheetsByClassId(id);
        if (linkedCount > 0) {
            await unlinkClassFromWorksheets(id);
        }

        await deleteClassProfileRecord(id);
        if (useProfileStore.getState().activeClassId === id) {
            useProfileStore.getState().setActiveClass(null);
        }

        set((state) => ({
            classProfiles: state.classProfiles.filter((entry) => entry.id !== id),
            classProfilesError: null,
            filter: state.filter.classId === id ? { ...state.filter, classId: undefined } : state.filter,
        }));

        const ws = useWorksheetStore.getState();
        if (ws.classId === id) {
            ws.setClassId(undefined);
        }

        await get().loadRecent();
    },

    getClassProfileById: (id) => {
        return get().classProfiles.find((entry) => entry.id === id);
    },

    loadRecent: async (filter) => {
        const activeFilter = filter ?? get().filter;
        const oldRecent = get().recentWorksheets;
        for (const item of oldRecent) {
            if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
        }
        const recent = await listRecentWorksheets(5000, activeFilter);
        set({ recentWorksheets: recent });
    },

    loadTrash: async () => {
        const oldTrashed = get().trashedWorksheets;
        for (const item of oldTrashed) {
            if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
        }
        const trashed = await listTrashedWorksheets();
        set({ trashedWorksheets: trashed });
    },

    setFilter: async (filter) => {
        set({ filter });
        await get().loadRecent(filter);
    },

    saveCurrentWorksheet: async (thumbnail?: Blob) => {
        await persistCurrentWorksheetWithStatus({
            thumbnail,
            setCurrentWorksheetId: true,
            refreshRecent: true,
        });
    },

    openWorksheet: async (id: string) => {
        set({ isLoading: true });
        try {
            const record = await loadWorksheet(id);
            if (!record) {
                set({ isLoading: false });
                return false;
            }
            // Push data into worksheetStore
            const wsStore = useWorksheetStore.getState();
            wsStore.loadFromRecord(
                record.id,
                record.title,
                record.tasksById,
                record.taskIds,
                record.chatHistory,
                record.sources,
                record.classId,
                record.variants,
                record.activeVariantId,
            );
            const normalizedChatHistory = useWorksheetStore.getState().chatHistory;
            set({
                currentWorksheetId: id,
                chatMessages: normalizedChatHistory,
                chatError: null,
                chatStatusNotice: null,
                isChatLoading: false,
                isLoading: false,
                autoSaveStatus: 'saved',
                documentMeta: {
                    title: record.title || 'Unbenannt',
                    subject: record.documentSubject ?? '',
                    classLevel: record.documentClassLevel ?? '',
                },
                isFirstSave: false,
            });
            return true;
        } catch {
            set({ isLoading: false });
            return false;
        }
    },

    createNewWorksheet: () => {
        const wsStore = useWorksheetStore.getState();
        wsStore.resetWorksheet();
        const nextWorksheet = useWorksheetStore.getState();
        set({
            currentWorksheetId: nextWorksheet.id,
            chatMessages: [],
            chatError: null,
            chatStatusNotice: null,
            isChatLoading: false,
            autoSaveStatus: 'idle',
            documentMeta: {
                title: nextWorksheet.title || 'Unbenannt',
                subject: '',
                classLevel: '',
            },
            isFirstSave: true,
        });
    },

    deleteWorksheet: async (id: string) => {
        await softDeleteWorksheetRecord(id, Date.now());
        set((state) => ({
            savedFiles: state.savedFiles.filter((file) => file.id !== id),
        }));
        await Promise.all([
            get().loadRecent(),
            get().loadTrash(),
        ]);
    },

    removeWorksheet: async (id: string) => {
        await get().deleteWorksheet(id);
    },

    restoreWorksheet: async (id: string) => {
        await restoreWorksheetRecord(id);
        await Promise.all([
            get().loadRecent(),
            get().loadTrash(),
        ]);
    },

    hardDeleteWorksheet: async (id: string) => {
        await hardDeleteWorksheetRecord(id);
        await Promise.all([
            get().loadRecent(),
            get().loadTrash(),
        ]);
    },

    emptyTrash: async () => {
        await emptyTrashRecords();
        await Promise.all([
            get().loadRecent(),
            get().loadTrash(),
        ]);
    },

    duplicateWorksheet: async (id: string) => {
        const original = await loadWorksheet(id);
        if (!original) return null;

        const duplicated = buildDuplicatedWorksheetRecord(original);

        await saveWorksheet(
            duplicated.id,
            duplicated.title,
            duplicated.tasksById,
            duplicated.taskIds,
            duplicated.chatHistory,
            duplicated.sources,
            original.subjectId,
            original.classId,
            original.thumbnailBlob,
            duplicated.variants,
            duplicated.activeVariantId,
            original.documentSubject,
            original.documentClassLevel,
        );

        await get().loadRecent();
        return duplicated.id;
    },

    exportWorksheet: async (id: string, version = ABGEN_LATEST_WORKSHEET_SCHEMA_VERSION) => {
        const record = await loadWorksheet(id);
        if (!record) {
            throw new Error('WORKSHEET_NOT_FOUND');
        }

        const { blob, filename } = await createWorksheetExportArtifact(record, version);
        triggerBrowserDownload(blob, filename);
    },

    shareWorksheet: async (id: string) => {
        const record = await loadWorksheet(id);
        if (!record) {
            throw new Error('WORKSHEET_NOT_FOUND');
        }

        if (!canShareFiles()) {
            return false;
        }

        const { blob, filename } = await createWorksheetExportArtifact(record, ABGEN_LATEST_WORKSHEET_SCHEMA_VERSION);
        const file = new File([blob], filename, { type: blob.type || 'application/json' });

        try {
            await navigator.share({
                title: record.title,
                text: `Arbeitsblatt: ${record.title}`,
                files: [file],
            });
            return true;
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                return false;
            }
            throw error;
        }
    },

    canShareWorksheetFiles: () => canShareFiles(),

    importWorksheet: async (file) => {
        const raw = await file.text();
        const parsed = parseAbgenWorksheetJson(raw);
        const imageIdMap = new Map<number, number>();

        if (parsed.embeddedImages && parsed.embeddedImages.length > 0) {
            for (const asset of parsed.embeddedImages) {
                const blob = base64ToBlob(asset.dataBase64, asset.mimeType);
                const newImageId = await addImage(asset.name || `import-${asset.id}`, blob);
                imageIdMap.set(asset.id, newImageId);
            }
        }

        const importedTasksById = imageIdMap.size > 0
            ? remapTaskImageIds(parsed.tasksById, imageIdMap)
            : parsed.tasksById;
        const importedVariants = imageIdMap.size > 0
            ? remapVariantImageIds(parsed.variants, imageIdMap)
            : parsed.variants;

        let importedDesign = parsed.design;
        if (importedDesign && typeof importedDesign.logoImageId === 'number') {
            importedDesign = {
                ...importedDesign,
                logoImageId: imageIdMap.get(importedDesign.logoImageId) ?? null,
            };
        }

        const imported = cloneWorksheetDataWithFreshIds({
            title: parsed.title,
            tasksById: importedTasksById,
            taskIds: parsed.taskIds,
            chatHistory: parsed.chatHistory,
            sources: parsed.sources,
        });
        const { variants: importedClonedVariants, variantIdMap: importedVariantIdMap } =
            cloneWorksheetVariantsWithFreshIds(importedVariants);
        const importedActiveVariantId =
            (parsed.activeVariantId ? importedVariantIdMap.get(parsed.activeVariantId) : undefined)
            ?? importedClonedVariants?.[0]?.id;

        await saveWorksheet(
            imported.id,
            parsed.title,
            imported.tasksById,
            imported.taskIds,
            imported.chatHistory,
            imported.sources,
            parsed.subjectId,
            parsed.classId,
            undefined,
            importedClonedVariants,
            importedActiveVariantId,
            undefined,
            undefined,
        );

        if (importedDesign) {
            useSettingsStore.getState().applyDesignSnapshot(importedDesign);
        }

        await get().loadRecent();
        return imported.id;
    },

    setCurrentView: (view) => {
        set({ currentView: view });
    },

    addProvider: () => {
        const newProvider: CustomProvider = {
            id: crypto.randomUUID(),
            name: '',
            baseUrl: '',
            apiKey: '',
            presetId: 'custom',
        };
        set((state) => ({ providers: [...state.providers, newProvider] }));
    },

    updateProvider: (id, updates) => {
        set((state) => ({
            providers: state.providers.map((p) =>
                p.id === id ? { ...p, ...updates } : p,
            ),
        }));
    },

    removeProvider: (id) => {
        set((state) => {
            const providers = state.providers.filter((p) => p.id !== id);
            const availableModels = state.availableModels.filter((m) => m.providerId !== id);
            const availableIds = new Set(availableModels.map((m) => m.id));
            const quickAccessModels = state.quickAccessModels.filter((mid) => availableIds.has(mid));
            const activeModel = quickAccessModels.includes(state.activeModel)
                ? state.activeModel
                : (quickAccessModels[0] ?? '');
            return {
                providers,
                availableModels,
                quickAccessModels,
                activeModel,
                aiModel: activeModel,
            };
        });
    },

    toggleQuickAccessModel: (modelId) => {
        const normalizedModelId = modelId.trim();
        if (!normalizedModelId) return;

        set((state) => {
            const availableIds = new Set(state.availableModels.map((model) => model.id));
            if (!availableIds.has(normalizedModelId)) {
                return state;
            }

            const isSelected = state.quickAccessModels.includes(normalizedModelId);
            const quickAccessModels = isSelected
                ? state.quickAccessModels.filter((id) => id !== normalizedModelId)
                : [...state.quickAccessModels, normalizedModelId];

            const activeModel = isSelected && state.activeModel === normalizedModelId
                ? (quickAccessModels[0] ?? '')
                : (!isSelected && !state.activeModel ? normalizedModelId : state.activeModel);

            return {
                quickAccessModels,
                activeModel,
                aiModel: activeModel,
            };
        });
    },

    setActiveModel: (modelId) => {
        const normalizedModelId = modelId.trim();
        set({
            activeModel: normalizedModelId,
            aiModel: normalizedModelId,
        });
    },

    fetchModelsForProvider: async (providerId) => {
        const provider = get().providers.find((p) => p.id === providerId);
        if (!provider) {
            throw new Error('Anbieter wurde nicht gefunden.');
        }

        const candidateBaseUrls = getModelEndpointBaseUrlCandidates(provider.baseUrl);
        if (candidateBaseUrls.length === 0) {
            throw new Error('Bitte eine Base-URL eintragen. Für LM Studio ist meist http://localhost:1234/v1 richtig.');
        }

        let lastHttpStatus: number | null = null;

        for (const candidateBaseUrl of candidateBaseUrls) {
            try {
                const response = await fetch(`${candidateBaseUrl}/models`, {
                    headers: provider.apiKey.trim()
                        ? { Authorization: `Bearer ${provider.apiKey.trim()}` }
                        : undefined,
                });

                if (!response.ok) {
                    lastHttpStatus = response.status;
                    continue;
                }

                const json = (await response.json()) as { data?: Array<{ id?: string; name?: string }> };
                const models: AIModel[] = (json.data ?? [])
                    .map((entry) => ({
                        id: entry.id?.trim() ?? '',
                        name: entry.name?.trim() || entry.id?.trim() || '',
                        providerId,
                    }))
                    .filter((model) => Boolean(model.id));

                if (models.length === 0) {
                    throw new Error('Der Anbieter ist erreichbar, liefert aber keine Modelle zurück.');
                }

                set((state) => {
                    const otherModels = state.availableModels.filter((m) => m.providerId !== providerId);
                    const availableModels = [...otherModels, ...models];
                    const availableIds = new Set(availableModels.map((m) => m.id));
                    const quickAccessModels = state.quickAccessModels.filter((mid) => availableIds.has(mid));
                    const activeModel = quickAccessModels.includes(state.activeModel)
                        ? state.activeModel
                        : (quickAccessModels[0] ?? '');
                    return {
                        availableModels,
                        quickAccessModels,
                        activeModel,
                        aiModel: activeModel,
                    };
                });

                return models;
            } catch (error) {
                if (error instanceof Error && error.message === 'Der Anbieter ist erreichbar, liefert aber keine Modelle zurück.') {
                    throw error;
                }
            }
        }

        if (lastHttpStatus !== null) {
            throw new Error(`Modelle konnten nicht geladen werden (HTTP ${lastHttpStatus}). Bitte Base-URL und API-Key prüfen.`);
        }

        throw new Error('Modelle konnten nicht geladen werden. Prüfe, ob LM Studio läuft, der Server gestartet ist und Browser/CORS-Zugriff erlaubt.');
    },

    setAiModel: (model) => {
        const normalizedModel = model.trim();
        set({
            aiModel: normalizedModel,
            activeModel: normalizedModel,
        });
    },

    addChatMessage: (message) => {
        const messages = [...get().chatMessages, message];
        useWorksheetStore.getState().setChatHistory(messages);
        set({ chatMessages: messages });
        persistCurrentWorksheetWithStatus().catch((err) =>
            console.error('[workspaceStore] addChatMessage persist failed:', err),
        );
    },

    setChatMessages: (messages) => {
        useWorksheetStore.getState().setChatHistory(messages);
        set({ chatMessages: messages });
        persistCurrentWorksheetWithStatus().catch((err) =>
            console.error('[workspaceStore] setChatMessages persist failed:', err),
        );
    },

    setAiSidebarDraft: (draft) => {
        set({ aiSidebarDraft: draft });
    },

    clearChat: () => {
        useWorksheetStore.getState().setChatHistory([]);
        set({ chatMessages: [] });
        persistCurrentWorksheetWithStatus().catch((err) =>
            console.error('[workspaceStore] clearChat persist failed:', err),
        );
    },

    setIsChatGenerating: (isGenerating) => {
        set({ isChatGenerating: isGenerating });
    },

    setChatError: (error) => {
        set({ chatError: error });
    },

    setChatStatusNotice: (notice) => {
        set({ chatStatusNotice: notice });
    },

    clearChatError: () => {
        set({ chatError: null });
    },

    seedGreetingIfEmpty: () => {
        set((state) => {
            if (state.chatMessages.length > 0) return state;
            const seeded = [{ role: 'assistant', content: CHAT_GREETING } as ChatMessage];
            useWorksheetStore.getState().setChatHistory(seeded);
            persistCurrentWorksheetWithStatus().catch((err) =>
                console.error('[workspaceStore] seedGreetingIfEmpty persist failed:', err),
            );
            return {
                chatMessages: seeded,
                aiSidebarDraft: '',
                chatError: null,
                chatStatusNotice: null,
            };
        });
    },

    startNewChat: () => {
        chatAbortController?.abort();
        chatAbortController = null;
        const seeded = [{ role: 'assistant', content: CHAT_GREETING } as ChatMessage];
        useWorksheetStore.getState().setChatHistory(seeded);
        set({
            chatMessages: seeded,
            aiSidebarDraft: '',
            chatError: null,
            chatStatusNotice: null,
            isChatLoading: false,
        });
        persistCurrentWorksheetWithStatus().catch((err) =>
            console.error('[workspaceStore] startNewChat persist failed:', err),
        );
    },

    abortChat: () => {
        chatAbortController?.abort();
        chatAbortController = null;
        latestChatRequestId++;
        set({ isChatLoading: false, isChatGenerating: false });
    },

    sendChatMessage: async (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        const state = get();
        if (state.isChatLoading || state.isChatGenerating) return;

        chatAbortController?.abort();
        chatAbortController = new AbortController();
        const signal = chatAbortController.signal;
        const requestId = ++latestChatRequestId;

        const userMessage: ChatMessage = { role: 'user', content: trimmed };
        const nextMessages = [...state.chatMessages, userMessage];
        const wsStore = useWorksheetStore.getState();

        wsStore.setChatHistory(nextMessages);
        set({
            aiSidebarDraft: '',
            chatMessages: nextMessages,
            isChatLoading: true,
            chatError: null,
            chatStatusNotice: null,
        });

        await persistCurrentWorksheetWithStatus({ chatHistory: nextMessages });

        try {
            if (requestId !== latestChatRequestId) return;

            const latestWorksheet = useWorksheetStore.getState();
            let aiClassContext: AIClassContext | undefined;
            if (latestWorksheet.classId) {
                let classProfile = get().getClassProfileById(latestWorksheet.classId);
                if (!classProfile) {
                    classProfile = await getClassProfile(latestWorksheet.classId);
                    if (classProfile) {
                        const resolvedProfile = classProfile;
                        set((state) => ({
                            classProfiles: [resolvedProfile, ...state.classProfiles.filter((entry) => entry.id !== resolvedProfile.id)],
                        }));
                    }
                }
                aiClassContext = buildAIClassContextFromProfile(classProfile);
            }

            if (requestId !== latestChatRequestId) return;

            let assistantMessageContent = '';
            let revisionStaged = false;

            const tryRevision = shouldAttemptTaskRevision(
                trimmed,
                nextMessages,
                latestWorksheet.taskIds.length,
            );

            if (tryRevision) {
            try {
                const revision = await generateTaskRevisionResult(
                    nextMessages,
                    latestWorksheet.tasksById,
                    latestWorksheet.taskIds,
                    latestWorksheet.sources,
                    aiClassContext,
                    signal,
                );

                // KI-Operationen werden NICHT mehr direkt angewendet, sondern
                // typisiert, gegen den echten Bestand validiert und als Patch
                // gestaged — der Nutzer bestätigt in der Vorschau (Spec §3.3).
                const parsed = parseOperations(revision.operations as unknown[]);
                const currentWs = useWorksheetStore.getState();
                const validated = validateOperations(parsed.operations, currentWs.tasksById, currentWs.taskIds);

                if (validated.operations.length > 0) {
                    usePatchStore.getState().stagePatch(validated.operations, validated.errors, 'chat');
                    revisionStaged = true;
                    assistantMessageContent = validated.operations.length === 1
                        ? 'Ich habe einen Änderungsvorschlag vorbereitet. Prüfe ihn in der Vorschau und übernimm ihn dort.'
                        : `Ich habe ${validated.operations.length} Änderungsvorschläge vorbereitet. Prüfe sie in der Vorschau und übernimm sie dort.`;
                }
            } catch (revisionError) {
                if (revisionError instanceof Error && revisionError.message === AI_JSON_TRUNCATED_USER_MESSAGE) {
                    throw revisionError;
                }
                if (isUnexpectedRevisionProgrammingError(revisionError)) {
                    throw revisionError;
                }
                revisionStaged = false;
            }
            } // end tryRevision

            if (requestId !== latestChatRequestId) return;

            if (!revisionStaged) {
                const reply = await generateChatAssistantReply(nextMessages, aiClassContext, signal);
                assistantMessageContent =
                    reply || 'Ich habe dazu gerade keine gute Antwort. Kannst du es bitte anders formulieren?';
            }

            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: assistantMessageContent,
            };

            const finalMessages = [...nextMessages, assistantMessage];
            useWorksheetStore.getState().setChatHistory(finalMessages);

            set({
                chatMessages: finalMessages,
                isChatLoading: false,
                chatStatusNotice: revisionStaged ? 'Vorschläge warten in der Vorschau auf deine Bestätigung.' : null,
            });

            await persistCurrentWorksheetWithStatus();
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            set({
                isChatLoading: false,
                chatError: err instanceof Error ? err.message : 'Unbekannter Fehler bei der KI-Antwort.',
                chatStatusNotice: null,
            });
        } finally {
            if (chatAbortController?.signal === signal) {
                chatAbortController = null;
            }
        }
    },

    createDifferentiatedVariantFromPrompt: async (instruction, label) => {
        const trimmedInstruction = instruction.trim();
        if (!trimmedInstruction) return false;

        const state = get();
        if (state.isChatLoading || state.isChatGenerating) return false;

        chatAbortController?.abort();
        chatAbortController = new AbortController();
        const signal = chatAbortController.signal;

        set({
            isChatLoading: true,
            chatError: null,
            chatStatusNotice: null,
        });

        try {
            const wsStore = useWorksheetStore.getState();
            let aiClassContext: AIClassContext | undefined;

            if (wsStore.classId) {
                let classProfile = get().getClassProfileById(wsStore.classId);
                if (!classProfile) {
                    classProfile = await getClassProfile(wsStore.classId);
                    if (classProfile) {
                        const resolvedProfile = classProfile;
                        set((prev) => ({
                            classProfiles: [resolvedProfile, ...prev.classProfiles.filter((entry) => entry.id !== resolvedProfile.id)],
                        }));
                    }
                }
                aiClassContext = buildAIClassContextFromProfile(classProfile);
            }

            const sourceVariant = wsStore.variants.find((variant) => variant.id === wsStore.activeVariantId) ?? wsStore.variants[0];
            if (!sourceVariant) {
                throw new Error('Keine aktive Variante verfügbar.');
            }

            const revision = await generateTaskRevisionResult(
                [{ role: 'user', content: trimmedInstruction }],
                wsStore.tasksById,
                wsStore.taskIds,
                wsStore.sources,
                aiClassContext,
                signal,
            );

            if (revision.operations.length === 0) {
                set({
                    isChatLoading: false,
                    chatStatusNotice: 'Keine Änderungen aus der KI-Antwort ableitbar. Keine neue Variante erstellt.',
                });
                return false;
            }

            const existingLabels = new Set(wsStore.variants.map((variant) => variant.label));
            const requestedBaseLabel = label?.trim() || `${sourceVariant.label} (KI)`;
            let nextLabel = requestedBaseLabel;
            let counter = 2;
            while (existingLabels.has(nextLabel)) {
                nextLabel = `${requestedBaseLabel} ${counter}`;
                counter += 1;
            }

            wsStore.addVariant(nextLabel, 'duplicate-active');

            let updatedCount = 0;
            let addedCount = 0;
            for (const operation of revision.operations) {
                const currentWs = useWorksheetStore.getState();
                if (operation.action === 'update_task') {
                    if (!currentWs.tasksById[operation.taskId]) continue;
                    currentWs.updateTask(operation.taskId, operation.updates as Partial<Task>);
                    updatedCount += 1;
                    continue;
                }

                if (operation.action === 'add_task') {
                    if (operation.payload) {
                        currentWs.addTasksFromAI([operation.payload]);
                    } else {
                        currentWs.addTask(operation.type);
                    }
                    addedCount += 1;
                }
            }

            await persistCurrentWorksheetWithStatus();

            set({
                isChatLoading: false,
                chatStatusNotice:
                    `Neue Variante "${nextLabel}" erstellt (${updatedCount} aktualisiert, ${addedCount} hinzugefügt).`,
            });
            return true;
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return false;
            set({
                isChatLoading: false,
                chatError: err instanceof Error ? err.message : 'Fehler bei der KI-Differenzierung.',
                chatStatusNotice: null,
            });
            return false;
        } finally {
            if (chatAbortController?.signal === signal) {
                chatAbortController = null;
            }
        }
    },

    setWorksheetSources: async (sources) => {
        useWorksheetStore.getState().setSources(sources);
        await persistCurrentWorksheetWithStatus({ sources });
    },

    upsertWorksheetSource: async (source) => {
        useWorksheetStore.getState().upsertSource(source);
        await persistCurrentWorksheetWithStatus();
    },

    removeWorksheetSource: async (sourceId) => {
        useWorksheetStore.getState().removeSource(sourceId);
        await persistCurrentWorksheetWithStatus();
    },

    toggleAiSidebar: () => {
        set((state) => ({ isAiSidebarOpen: !state.isAiSidebarOpen }));
    },

    toggleOutline: () => {
        set((state) => ({ isOutlineOpen: !state.isOutlineOpen }));
    },

    startPlacingTask: () => {
        set({ isPlacingNewTask: true });
    },

    cancelPlacingTask: () => {
        set({ isPlacingNewTask: false });
    },

    loadDesignTemplates: async () => {
        const templates = await listDesignTemplates({ sortBy: 'updatedAt' });
        const sortedTemplates = [...templates].sort((a, b) => {
            const aTime = new Date(a.lastUsedAt ?? a.updatedAt).getTime();
            const bTime = new Date(b.lastUsedAt ?? b.updatedAt).getTime();
            return bTime - aTime;
        });
        set({ designTemplates: sortedTemplates });
    },

    saveCurrentDesignAsTemplate: async (name, overwrite = false, targetTemplateId) => {
        const normalizedName = normalizeTemplateName(name);
        const settings = useSettingsStore.getState();
        const snapshot = settings.getDesignSnapshot();
        const existingLogo =
            typeof snapshot.logoImageId === 'number' ? await getImage(snapshot.logoImageId) : undefined;

        const savePayload = {
            name: normalizedName,
            idForCreate: crypto.randomUUID(),
            design: snapshot,
            embeddedLogoBlob: existingLogo?.blob,
        };

        let template: DesignTemplate;

        if (targetTemplateId) {
            try {
                const updated = await updateDesignTemplate(targetTemplateId, {
                    name: savePayload.name,
                    design: savePayload.design,
                    embeddedLogoBlob: savePayload.embeddedLogoBlob,
                });
                if (!updated) {
                    throw new Error('TEMPLATE_UPDATE_FAILED');
                }
                template = updated;
            } catch (error) {
                if (
                    overwrite &&
                    error instanceof Error &&
                    error.message === 'TEMPLATE_NAME_EXISTS'
                ) {
                    const conflicting = await getDesignTemplateByName(savePayload.name);
                    if (conflicting && conflicting.id !== targetTemplateId) {
                        await deleteDesignTemplate(conflicting.id);
                    }

                    const updated = await updateDesignTemplate(targetTemplateId, {
                        name: savePayload.name,
                        design: savePayload.design,
                        embeddedLogoBlob: savePayload.embeddedLogoBlob,
                    });

                    if (!updated) {
                        throw new Error('TEMPLATE_UPDATE_FAILED');
                    }
                    template = updated;
                } else {
                    throw error;
                }
            }
        } else {
            template = overwrite
                ? await upsertDesignTemplateByName(savePayload)
                : await createDesignTemplate({
                    id: savePayload.idForCreate,
                    name: savePayload.name,
                    design: savePayload.design,
                    embeddedLogoBlob: savePayload.embeddedLogoBlob,
                });
        }

        await get().loadDesignTemplates();
        set({ selectedTemplateId: template.id });
        return template;
    },

    applyTemplateToCurrentWorksheet: async (templateId) => {
        set({ isTemplateLoading: true });
        try {
            const template = await getDesignTemplate(templateId);
            if (!template) return false;

            let resolvedLogoImageId = template.design.logoImageId;

            if (typeof resolvedLogoImageId === 'number') {
                const existing = await getImage(resolvedLogoImageId);
                if (!existing) {
                    resolvedLogoImageId = null;
                }
            }

            if (resolvedLogoImageId == null && template.embeddedLogoBlob) {
                resolvedLogoImageId = await addImage(`${template.name}-logo`, template.embeddedLogoBlob);
            }

            useSettingsStore.getState().applyDesignSnapshot({
                ...template.design,
                logoImageId: resolvedLogoImageId,
            });

            await markDesignTemplateUsed(template.id);
            await get().loadDesignTemplates();

            set({ selectedTemplateId: template.id });
            return true;
        } finally {
            set({ isTemplateLoading: false });
        }
    },

    removeDesignTemplate: async (templateId) => {
        await deleteDesignTemplate(templateId);
        await get().loadDesignTemplates();

        set((state) => ({
            selectedTemplateId: state.selectedTemplateId === templateId ? null : state.selectedTemplateId,
            editingTemplateId: state.editingTemplateId === templateId ? null : state.editingTemplateId,
        }));
    },

    openTemplateGallery: () => {
        set({ isTemplateGalleryOpen: true });
        void get().loadDesignTemplates();
    },

    closeTemplateGallery: () => {
        set({ isTemplateGalleryOpen: false });
    },

    startTemplateEdit: (templateId) => {
        set({ editingTemplateId: templateId, selectedTemplateId: templateId });
    },

    clearTemplateEdit: () => {
        set({ editingTemplateId: null });
    },

    setActiveEditor: (editor) => {
        set({ activeEditor: editor });
    },

    updateTask: (taskId, updates) => {
        useWorksheetStore.getState().updateTask(taskId, updates);
    },

    updateDocumentMeta: (meta) => {
        set((state) => {
            const nextMeta: DocumentMeta = {
                ...state.documentMeta,
                ...meta,
            };
            const ws = useWorksheetStore.getState();
            const worksheetId = ws.id;
            const savedFileId = state.currentWorksheetId
                ?? worksheetId
                ?? (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                    ? crypto.randomUUID()
                    : Date.now().toString());
            const lastModified = new Date().toISOString();
            // Bewusst KEINE Task-Kopien: volle Tasks in localStorage sprengen das
            // 5-MB-Quota und divergieren von Dexie (dem einzigen Persistenz-Ort).
            const nextSavedFiles = [
                {
                    id: savedFileId,
                    meta: nextMeta,
                    lastModified,
                    taskCount: ws.taskIds.length,
                    variationCount: Math.max(1, ws.variants.length),
                },
                ...state.savedFiles.filter((file) => file.id !== savedFileId),
            ];

            return {
                currentWorksheetId: state.currentWorksheetId ?? savedFileId,
                documentMeta: nextMeta,
                savedFiles: nextSavedFiles,
            };
        });
    },

    saveCurrentDocument: () => {
        set((state) => {
            const ws = useWorksheetStore.getState();
            const now = new Date().toISOString();
            const docId = state.currentWorksheetId
                ?? ws.id
                ?? crypto.randomUUID();
            const actualVariationCount = ws.variants?.length || 1;

            // Leichtgewichtiger Snapshot ohne Task-Kopien (siehe updateDocumentMeta).
            const currentSnapshot = {
                id: docId,
                meta: { ...state.documentMeta },
                lastModified: now,
                taskCount: ws.taskIds.length,
                variationCount: actualVariationCount,
            };

            const existingIndex = state.savedFiles.findIndex((f) => f.id === docId);

            if (existingIndex >= 0) {
                const updatedFiles = [...state.savedFiles];
                updatedFiles[existingIndex] = currentSnapshot;
                return {
                    savedFiles: updatedFiles,
                    isFirstSave: false,
                    currentWorksheetId: docId,
                    documentMeta: { ...state.documentMeta },
                };
            }

            return {
                savedFiles: [currentSnapshot, ...state.savedFiles],
                isFirstSave: false,
                currentWorksheetId: docId,
                documentMeta: { ...state.documentMeta },
            };
        });
    },

    deleteDocuments: async (ids: string[]) => {
        for (const id of ids) {
            await softDeleteWorksheetRecord(id, Date.now());
        }
        set((state) => ({
            savedFiles: state.savedFiles.filter((file) => !ids.includes(file.id)),
        }));
        await Promise.all([
            get().loadRecent(),
            get().loadTrash(),
        ]);
    },

    markAsSaved: () => {
        set({ isFirstSave: false });
    },

    startAgent: () => {
        set({ agentPhase: 'planning', agentLogs: [], isAgentRunning: true });
    },

    resetAgent: () => {
        set({ agentPhase: 'idle', agentLogs: [], isAgentRunning: false });
    },

    addAgentLog: (message) => {
        set((state) => ({ agentLogs: [...state.agentLogs, message] }));
    },

    setAgentPhase: (phase) => {
        set({ agentPhase: phase });
    },
    };

    queueMicrotask(() => {
        void runInitialTrashCleanupOnce();
    });

    return store;
    },
    {
      name: 'workspace-storage',
      partialize: (state) => ({
        savedFiles: state.savedFiles,
        documentMeta: state.documentMeta,
        isFirstSave: state.isFirstSave,
        currentWorksheetId: state.currentWorksheetId,
        providers: state.providers,
        availableModels: state.availableModels,
        quickAccessModels: state.quickAccessModels,
        activeModel: state.activeModel,
      }),
    },
  ),
);
