import type { ClozeGapStyle } from '../types/worksheet';

export interface ClozeTextToken {
    type: 'text';
    value: string;
}

export interface ClozeGapToken {
    type: 'gap';
    answer: string;
}

export type ClozeToken = ClozeTextToken | ClozeGapToken;

export const DEFAULT_CLOZE_GAP_STYLE: ClozeGapStyle = 'continuous';
export const DEFAULT_CLOZE_GAP_MULTIPLIER = 1.5;

const PLACEHOLDER_PATTERN = /(\[[^\]]*\]|\{\{.*?\}\})/g;

export function tokenizeClozeContent(content: string): ClozeToken[] {
    if (!content) return [];

    const parts = content.split(PLACEHOLDER_PATTERN);
    const tokens: ClozeToken[] = [];

    for (const part of parts) {
        if (!part) continue;

        const bracketMatch = part.match(/^\[([^\]]*)\]$/);
        if (bracketMatch) {
            tokens.push({ type: 'gap', answer: bracketMatch[1] });
            continue;
        }

        const legacyMatch = part.match(/^\{\{(.*?)\}\}$/);
        if (legacyMatch) {
            tokens.push({ type: 'gap', answer: legacyMatch[1] });
            continue;
        }

        tokens.push({ type: 'text', value: part });
    }

    return tokens;
}

export function getClozeGapText(answer: string, gapStyle: ClozeGapStyle, gapMultiplier: number): string {
    const safeMultiplier = Number.isFinite(gapMultiplier) ? Math.max(1, gapMultiplier) : DEFAULT_CLOZE_GAP_MULTIPLIER;
    const normalized = (answer ?? '').trim();

    if (gapStyle === 'per-letter') {
        const letters = normalized.split('').filter((c) => c !== ' ');
        const unit = Math.max(1, Math.round(safeMultiplier));
        const segment = '_'.repeat(unit);

        if (letters.length === 0) {
            return '_'.repeat(Math.max(3, unit * 2));
        }

        return letters.map(() => segment).join(' ');
    }

    const baseLength = Math.max(1, normalized.length);
    const underscoreCount = Math.max(6, Math.round(baseLength * 3 * safeMultiplier));
    return '_'.repeat(underscoreCount);
}
