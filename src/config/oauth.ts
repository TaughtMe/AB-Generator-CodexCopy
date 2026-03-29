/* ══════════════════════════════════════════════════
   oauth.ts – Zentrale OAuth-Konfiguration
   Client-IDs werden aus Umgebungsvariablen geladen.
   ══════════════════════════════════════════════════ */

export interface OAuthProviderConfig {
    clientId: string;
    authUrl: string;
    tokenUrl: string;
    scopes: string;
}

export const OAUTH_CONFIG = {
    onedrive: {
        clientId: import.meta.env.VITE_ONEDRIVE_CLIENT_ID ?? '',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        scopes: 'Files.ReadWrite.All offline_access',
    } satisfies OAuthProviderConfig,

    googledrive: {
        clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: 'https://www.googleapis.com/auth/drive.file',
    } satisfies OAuthProviderConfig,

    redirectUri: `${window.location.origin}/oauth-callback.html`,
} as const;
