export interface TemplateHeaderFields {
    showName: boolean;
    showDate: boolean;
    showClass: boolean;
}

export interface DesignSnapshot {
    schoolName: string;
    logoImageId: number | null;
    logoText: string;
    headerFields: TemplateHeaderFields;
    brandColor: string;
    fontFamily: string;
    showHeaderTitle: boolean;
    showWorksheetTitle: boolean;
    applyColorToTasks: boolean;
}

export interface DesignTemplate {
    id: string;
    name: string;
    design: DesignSnapshot;
    embeddedLogoBlob?: Blob;
    createdAt: Date;
    updatedAt: Date;
    lastUsedAt?: Date;
}

export const RESERVED_TEMPLATE_NAMES = ['standard'];

export function normalizeHeaderFields(fields?: Partial<TemplateHeaderFields> | null): TemplateHeaderFields {
    return {
        showName: fields?.showName ?? true,
        showDate: fields?.showDate ?? true,
        showClass: fields?.showClass ?? true,
    };
}

export function normalizeDesignSnapshot(snapshot: Partial<DesignSnapshot>): DesignSnapshot {
    return {
        schoolName: (snapshot.schoolName ?? '').trim(),
        logoImageId: typeof snapshot.logoImageId === 'number' ? snapshot.logoImageId : null,
        logoText: (snapshot.logoText ?? '').slice(0, 3),
        headerFields: normalizeHeaderFields(snapshot.headerFields),
        brandColor: snapshot.brandColor ?? '#3b82f6',
        fontFamily: snapshot.fontFamily ?? 'Inter, sans-serif',
        showHeaderTitle: snapshot.showHeaderTitle ?? true,
        showWorksheetTitle: snapshot.showWorksheetTitle ?? true,
        applyColorToTasks: snapshot.applyColorToTasks ?? true,
    };
}

export function normalizeTemplateName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
}

export function validateTemplateName(name: string): string | null {
    const normalized = normalizeTemplateName(name);
    if (!normalized) return 'Bitte gib einen Namen ein.';
    if (normalized.length > 50) return 'Der Name darf maximal 50 Zeichen lang sein.';
    if (RESERVED_TEMPLATE_NAMES.includes(normalized.toLowerCase())) {
        return 'Dieser Name ist reserviert.';
    }
    return null;
}
