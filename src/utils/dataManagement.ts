import {
    clearAllIndexedDbData,
    listClassProfileRecords,
    listDesignTemplateRecords,
    listWorksheetRecords,
    replaceClassProfileRecords,
    replaceDesignTemplateRecords,
    replaceWorksheetRecords,
    type ClassProfileRecord,
    type DesignTemplateRecord,
    type WorksheetRecord,
} from '../store/dexieStore';
import type { ChatMessage } from '../types/ai';
import type { WorksheetSource } from '../types/worksheet';

const SETTINGS_STORAGE_KEY = 'ab-generator-settings';
const BACKUP_FILENAME = 'ab-generator-backup.json';
const BACKUP_SCHEMA_VERSION = 1;

type PersistedSettingsState = {
    state: unknown;
    version?: number;
};

interface BackupWorksheet {
    id: string;
    title: string;
    tasksById: WorksheetRecord['tasksById'];
    taskIds: string[];
    chatHistory: ChatMessage[];
    sources: WorksheetSource[];
    subjectId?: string;
    classId?: string;
    createdAt: string;
    updatedAt: string;
}

interface BackupDesignTemplate {
    id: string;
    name: string;
    nameLower: string;
    design: Omit<DesignTemplateRecord['design'], 'logoImageId'> & { logoImageId: null };
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
}

interface BackupClassProfile {
    id: string;
    name: string;
    nameLower: string;
    subjectId?: string;
    curriculumContext: string;
    studentProfile: string;
    createdAt: string;
    updatedAt: string;
}

interface ABGeneratorBackupV1 {
    app: 'ab-generator';
    schemaVersion: typeof BACKUP_SCHEMA_VERSION;
    exportedAt: string;
    imagePolicy: 'excluded';
    data: {
        settings: PersistedSettingsState;
        worksheets: BackupWorksheet[];
        designTemplates: BackupDesignTemplate[];
        classProfiles?: BackupClassProfile[];
    };
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function readPersistedSettings(): PersistedSettingsState {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
        return {
            state: {},
            version: 6,
        };
    }

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!isObject(parsed) || !('state' in parsed)) {
            throw new Error('SETTINGS_PARSE_INVALID');
        }

        const settings = parsed as PersistedSettingsState;
        if (isObject(settings.state) && 'logoImageId' in settings.state) {
            settings.state = {
                ...settings.state,
                logoImageId: null,
            };
        }

        return settings;
    } catch {
        throw new Error('Die gespeicherten Einstellungen sind beschädigt und konnten nicht exportiert werden.');
    }
}

function serializeWorksheets(records: WorksheetRecord[]): BackupWorksheet[] {
    return records.map((record) => ({
        id: record.id,
        title: record.title,
        tasksById: record.tasksById,
        taskIds: record.taskIds,
        chatHistory: record.chatHistory ?? [],
        sources: record.sources ?? [],
        subjectId: record.subjectId,
        classId: record.classId,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
    }));
}

function serializeTemplates(records: DesignTemplateRecord[]): BackupDesignTemplate[] {
    return records.map((record) => ({
        id: record.id,
        name: record.name,
        nameLower: record.nameLower,
        design: {
            ...record.design,
            logoImageId: null,
        },
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        lastUsedAt: record.lastUsedAt?.toISOString(),
    }));
}

function serializeClassProfiles(records: ClassProfileRecord[]): BackupClassProfile[] {
    return records.map((record) => ({
        id: record.id,
        name: record.name,
        nameLower: record.nameLower,
        subjectId: record.subjectId,
        curriculumContext: record.curriculumContext,
        studentProfile: record.studentProfile,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
    }));
}

/**
 * Entfernt API-Keys aus dem geklonten Settings-Objekt,
 * damit keine sensitiven Daten im Backup landen.
 */
function stripSensitiveKeys(settings: PersistedSettingsState): PersistedSettingsState {
    const cloned = JSON.parse(JSON.stringify(settings)) as PersistedSettingsState;

    if (isObject(cloned.state) && isObject((cloned.state as Record<string, unknown>).providers)) {
        const providers = (cloned.state as Record<string, unknown>).providers as Record<string, unknown>;
        for (const key of Object.keys(providers)) {
            const provider = providers[key];
            if (isObject(provider) && 'apiKey' in provider) {
                (provider as Record<string, unknown>).apiKey = '';
            }
        }
    }

    return cloned;
}

function buildBackupPayload(
    settings: PersistedSettingsState,
    worksheets: BackupWorksheet[],
    templates: BackupDesignTemplate[],
    classProfiles: BackupClassProfile[],
): ABGeneratorBackupV1 {
    return {
        app: 'ab-generator',
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        imagePolicy: 'excluded',
        data: {
            settings: stripSensitiveKeys(settings),
            worksheets,
            designTemplates: templates,
            classProfiles,
        },
    };
}

function downloadJsonFile(payload: ABGeneratorBackupV1): void {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = BACKUP_FILENAME;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
}

function parseBackupJson(raw: string): ABGeneratorBackupV1 {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) {
        throw new Error('Die Backup-Datei ist kein gültiges JSON-Objekt.');
    }

    if (parsed.app !== 'ab-generator') {
        throw new Error('Dieses Backup gehört nicht zu AB-Generator.');
    }

    if (parsed.schemaVersion !== BACKUP_SCHEMA_VERSION) {
        throw new Error('Dieses Backup-Format wird nicht unterstützt.');
    }

    if (!('data' in parsed) || !isObject(parsed.data)) {
        throw new Error('Das Backup enthält keinen gültigen Datenblock.');
    }

    const data = parsed.data;
    if (!('settings' in data) || !('worksheets' in data) || !('designTemplates' in data)) {
        throw new Error('Im Backup fehlen erforderliche Bereiche.');
    }

    if (!Array.isArray(data.worksheets) || !Array.isArray(data.designTemplates)) {
        throw new Error('Arbeitsblätter oder Vorlagen sind im Backup ungültig.');
    }
    if ('classProfiles' in data && data.classProfiles != null && !Array.isArray(data.classProfiles)) {
        throw new Error('Klassenprofile sind im Backup ungültig.');
    }

    return parsed as unknown as ABGeneratorBackupV1;
}

function toDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Ungültiges Datum im Feld: ${field}`);
    }
    return date;
}

function toWorksheetRecords(entries: BackupWorksheet[]): WorksheetRecord[] {
    return entries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        tasksById: entry.tasksById,
        taskIds: entry.taskIds,
        chatHistory: entry.chatHistory ?? [],
        sources: entry.sources ?? [],
        subjectId: entry.subjectId,
        classId: entry.classId,
        createdAt: toDate(entry.createdAt, 'worksheets.createdAt'),
        updatedAt: toDate(entry.updatedAt, 'worksheets.updatedAt'),
    }));
}

function toTemplateRecords(entries: BackupDesignTemplate[]): DesignTemplateRecord[] {
    return entries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        nameLower: entry.nameLower,
        design: {
            ...entry.design,
            logoImageId: null,
        },
        createdAt: toDate(entry.createdAt, 'designTemplates.createdAt'),
        updatedAt: toDate(entry.updatedAt, 'designTemplates.updatedAt'),
        lastUsedAt: entry.lastUsedAt ? toDate(entry.lastUsedAt, 'designTemplates.lastUsedAt') : undefined,
    }));
}

function toClassProfileRecords(entries: BackupClassProfile[]): ClassProfileRecord[] {
    return entries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        nameLower: entry.nameLower,
        subjectId: entry.subjectId,
        curriculumContext: entry.curriculumContext ?? '',
        studentProfile: entry.studentProfile ?? '',
        createdAt: toDate(entry.createdAt, 'classProfiles.createdAt'),
        updatedAt: toDate(entry.updatedAt, 'classProfiles.updatedAt'),
    }));
}

function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Die Backup-Datei konnte nicht gelesen werden.'));
        reader.readAsText(file, 'utf-8');
    });
}

export async function exportLocalBackup(): Promise<void> {
    const settings = readPersistedSettings();
    const worksheets = serializeWorksheets(await listWorksheetRecords());
    const templates = serializeTemplates(await listDesignTemplateRecords());
    const classProfiles = serializeClassProfiles(await listClassProfileRecords());
    const payload = buildBackupPayload(settings, worksheets, templates, classProfiles);
    downloadJsonFile(payload);
}

export async function importLocalBackup(file: File): Promise<void> {
    const fileContent = await readFileAsText(file);
    const backup = parseBackupJson(fileContent);

    const worksheetRecords = toWorksheetRecords(backup.data.worksheets);
    const templateRecords = toTemplateRecords(backup.data.designTemplates);
    const classProfileRecords = toClassProfileRecords(backup.data.classProfiles ?? []);

    await clearAllIndexedDbData();
    await replaceWorksheetRecords(worksheetRecords);
    await replaceDesignTemplateRecords(templateRecords);
    await replaceClassProfileRecords(classProfileRecords);

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(backup.data.settings));

    window.location.reload();
}

export async function hardResetLocalData(): Promise<void> {
    localStorage.clear();
    await clearAllIndexedDbData();
    window.location.reload();
}
