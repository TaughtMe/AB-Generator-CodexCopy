import type { ChatMessage } from '../../types/ai';
import type { Task } from '../../types/worksheet';

/* ══════════════════════════════════════════════════
   tokenEstimate.ts – Heuristische Token-Schätzung für den Chat (§7.1/7.2).

   Bewusst eine Schätzung (≈ Zeichen / 4 — übliche Heuristik für
   deutsch/englische Texte über alle gängigen Tokenizer). Provider
   liefern echte usage erst NACH der Antwort; vor dem Senden gibt es
   nur Heuristiken. Die UI kennzeichnet den Wert deshalb mit "≈".

   In die Schätzung fließt ein, was die Revision tatsächlich sendet:
   Chatverlauf + aktueller Entwurf + serialisiertes Arbeitsblatt
   (generateTaskRevisionResult schickt tasksById als JSON mit).
   ══════════════════════════════════════════════════ */

const CHARS_PER_TOKEN = 4;

/** Ab hier zeigt die UI die Komprimierungs-Empfehlung. */
export const LONG_CHAT_TOKEN_THRESHOLD = 6000;

export function estimateTokensForText(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export interface ChatTokenEstimate {
    /** Geschätzte Tokens des Chatverlaufs (inkl. Entwurf). */
    chatTokens: number;
    /** Geschätzte Tokens des Arbeitsblatts (JSON, wie an die Revision gesendet). */
    worksheetTokens: number;
    /** Gesamt. */
    totalTokens: number;
    /** true, wenn die Komprimierungs-Empfehlung angezeigt werden soll. */
    isLong: boolean;
}

export function estimateChatTokens(
    messages: ChatMessage[],
    draft: string,
    tasksById: Record<string, Task>,
): ChatTokenEstimate {
    const chatChars = messages.reduce((sum, message) => sum + message.content.length, 0)
        + draft.length;
    const chatTokens = Math.ceil(chatChars / CHARS_PER_TOKEN);

    let worksheetTokens = 0;
    try {
        worksheetTokens = Math.ceil(JSON.stringify(tasksById).length / CHARS_PER_TOKEN);
    } catch {
        worksheetTokens = 0;
    }

    const totalTokens = chatTokens + worksheetTokens;
    return {
        chatTokens,
        worksheetTokens,
        totalTokens,
        isLong: chatTokens >= LONG_CHAT_TOKEN_THRESHOLD,
    };
}

/** "1234" → "1.234" (deutsche Tausendertrennung für die Anzeige). */
export function formatTokenCount(tokens: number): string {
    return tokens.toLocaleString('de-DE');
}
