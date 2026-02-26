interface LocalModelsResponse {
    data?: Array<{ id?: string }>;
}

function normalizeLocalBaseUrl(baseUrl: string): string {
    const trimmed = baseUrl.trim().replace(/\/$/, '');
    if (!trimmed) return '';
    if (/\/v1$/i.test(trimmed)) return trimmed;
    return `${trimmed}/v1`;
}

function getCandidateLocalBaseUrls(baseUrl: string): string[] {
    const normalizedBaseUrl = normalizeLocalBaseUrl(baseUrl);
    if (!normalizedBaseUrl) return [];

    const candidates = [normalizedBaseUrl];

    try {
        const url = new URL(normalizedBaseUrl);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            const dockerHostUrl = new URL(normalizedBaseUrl);
            dockerHostUrl.hostname = 'host.docker.internal';
            candidates.push(dockerHostUrl.toString().replace(/\/$/, ''));
        }
    } catch {
        return candidates;
    }

    return Array.from(new Set(candidates));
}

export async function fetchRunningLocalModels(baseUrl: string): Promise<string[]> {
    try {
        const candidateBaseUrls = getCandidateLocalBaseUrls(baseUrl);
        if (candidateBaseUrls.length === 0) return [];

        for (const candidateBaseUrl of candidateBaseUrls) {
            try {
                const response = await fetch(`${candidateBaseUrl}/models`, {
                    method: 'GET',
                });

                if (!response.ok) {
                    continue;
                }

                const payload = (await response.json()) as LocalModelsResponse;
                const ids = (payload.data ?? [])
                    .map((entry) => entry.id?.trim() ?? '')
                    .filter(Boolean);

                return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
            } catch {
                continue;
            }
        }

        return [];
    } catch {
        return [];
    }
}

