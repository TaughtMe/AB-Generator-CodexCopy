/* ══════════════════════════════════════════════════
   cloudOAuthService.ts – OAuth 2.0 PKCE Flows
   für OneDrive, Google Drive und WebDAV-Login.
   Leitet direkt per window.location.href weiter.
   ══════════════════════════════════════════════════ */

import type { CloudProvider } from '../types/cloudSync';
import { useCloudSyncStore } from '../store/cloudSyncStore';
import { OAUTH_CONFIG } from '../config/oauth';

// ─── PKCE Helpers ───────────────────────────────────

function generateRandomString(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

async function sha256(plain: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function base64UrlEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
    const verifier = generateRandomString(64);
    const hashed = await sha256(verifier);
    const challenge = base64UrlEncode(hashed);
    return { verifier, challenge };
}

// ─── PKCE State Storage ─────────────────────────────

const PKCE_STORAGE_KEY = 'ab-generator-oauth-pkce';

interface PkceSession {
    provider: CloudProvider;
    verifier: string;
    state: string;
}

function storePkceSession(session: PkceSession): void {
    sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify(session));
}

export function loadPkceSession(): PkceSession | null {
    const raw = sessionStorage.getItem(PKCE_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PKCE_STORAGE_KEY);
    try {
        return JSON.parse(raw) as PkceSession;
    } catch {
        return null;
    }
}

// ─── OneDrive OAuth ─────────────────────────────────

async function startOneDriveLogin(): Promise<void> {
    const { clientId } = OAUTH_CONFIG.onedrive;
    if (!clientId) {
        throw new Error('VITE_ONEDRIVE_CLIENT_ID ist nicht konfiguriert.');
    }

    const { verifier, challenge } = await generatePKCE();
    const state = generateRandomString(32);

    storePkceSession({ provider: 'onedrive', verifier, state });

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: OAUTH_CONFIG.redirectUri,
        scope: OAUTH_CONFIG.onedrive.scopes,
        response_mode: 'query',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
    });

    window.location.href = `${OAUTH_CONFIG.onedrive.authUrl}?${params}`;
}

export async function exchangeOneDriveCode(code: string, verifier: string): Promise<void> {
    const body = new URLSearchParams({
        client_id: OAUTH_CONFIG.onedrive.clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: OAUTH_CONFIG.redirectUri,
        code_verifier: verifier,
    });

    const res = await fetch(OAUTH_CONFIG.onedrive.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`OneDrive Token-Austausch fehlgeschlagen: ${err}`);
    }

    const data = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
    };

    const store = useCloudSyncStore.getState();
    const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined;
    store.setTokens(data.access_token, data.refresh_token, expiresAt);
}

/**
 * Refresh OneDrive token using refresh_token.
 */
export async function refreshOneDriveToken(): Promise<void> {
    const store = useCloudSyncStore.getState();
    const provider = store.activeProvider;
    if (!provider?.refreshToken) throw new Error('Kein Refresh-Token vorhanden.');

    const body = new URLSearchParams({
        client_id: OAUTH_CONFIG.onedrive.clientId,
        grant_type: 'refresh_token',
        refresh_token: provider.refreshToken,
        redirect_uri: OAUTH_CONFIG.redirectUri,
    });

    const res = await fetch(OAUTH_CONFIG.onedrive.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (!res.ok) throw new Error('OneDrive Token-Erneuerung fehlgeschlagen.');

    const data = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
    };

    const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined;
    store.setTokens(data.access_token, data.refresh_token, expiresAt);
}

// ─── Google Drive OAuth (Implicit Flow) ─────────────

async function startGoogleDriveLogin(): Promise<void> {
    const { clientId } = OAUTH_CONFIG.googledrive;
    if (!clientId) {
        throw new Error('VITE_GOOGLE_CLIENT_ID ist nicht konfiguriert.');
    }

    const state = generateRandomString(32);

    // Nur state speichern – kein PKCE beim Implicit Flow
    storePkceSession({ provider: 'googledrive', verifier: '', state });

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'token',
        redirect_uri: OAUTH_CONFIG.redirectUri,
        scope: OAUTH_CONFIG.googledrive.scopes,
        state,
        include_granted_scopes: 'true',
    });

    window.location.href = `${OAUTH_CONFIG.googledrive.authUrl}?${params}`;
}

/**
 * Speichert den access_token aus dem Implicit-Flow-Hash direkt im Store.
 */
export function handleGoogleDriveImplicitToken(
    accessToken: string,
    expiresIn?: number,
): void {
    const store = useCloudSyncStore.getState();
    const expiresAt = expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : undefined;
    store.setTokens(accessToken, undefined, expiresAt);
}

// ─── WebDAV Login Test ──────────────────────────────

export async function testWebDavConnection(
    serverUrl: string,
    username: string,
    password: string,
): Promise<void> {
    const base = serverUrl.replace(/\/+$/, '');
    const credentials = btoa(`${username}:${password}`);

    const res = await fetch(base, {
        method: 'PROPFIND',
        headers: {
            Authorization: `Basic ${credentials}`,
            Depth: '0',
        },
    });

    if (!res.ok && res.status !== 207) {
        throw new Error(`WebDAV-Verbindung fehlgeschlagen (${res.status}). Bitte Zugangsdaten prüfen.`);
    }
}

// ─── Public: Start Login ────────────────────────────

/**
 * Startet den OAuth-Login für den gewählten Provider.
 * Für OneDrive/Google Drive wird direkt per Redirect weitergeleitet.
 * Für WebDAV wird die Verbindung direkt getestet.
 */
export async function startCloudLogin(provider: CloudProvider): Promise<void> {
    switch (provider) {
        case 'onedrive':
            await startOneDriveLogin();
            break;
        case 'googledrive':
            await startGoogleDriveLogin();
            break;
        case 'webdav':
            // WebDAV: kein Redirect – der Login erfolgt über
            // Eingabefelder im UI + testWebDavConnection().
            break;
    }
}

/**
 * Prüft, ob der aktuelle Token noch gültig ist.
 */
export function isTokenExpired(): boolean {
    const provider = useCloudSyncStore.getState().activeProvider;
    if (!provider?.tokenExpiresAt) return false;
    return new Date(provider.tokenExpiresAt).getTime() < Date.now();
}

/**
 * Erneuert den Token falls abgelaufen.
 * Google Drive (Implicit Flow) hat keinen Refresh-Token – erneuter Login nötig.
 */
export async function ensureFreshToken(): Promise<void> {
    if (!isTokenExpired()) return;

    const provider = useCloudSyncStore.getState().activeProvider;
    if (!provider) return;

    switch (provider.provider) {
        case 'onedrive':
            await refreshOneDriveToken();
            break;
        case 'googledrive':
            throw new Error('Google Drive Token abgelaufen. Bitte erneut anmelden.');
        default:
            break;
    }
}
