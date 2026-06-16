import {
    BookOpen,
    Columns,
    FileText,
    Heading,
    Image as ImageIcon,
    ListChecks,
    ListOrdered,
    Scissors,
    Sigma,
    Table,
    TextCursorInput,
    Type,
    type LucideIcon,
} from 'lucide-react';
import type { TaskType } from '../../types/worksheet';

/* ══════════════════════════════════════════════════
   slashCommands.ts – Befehle des Slash-Menüs im Editor.

   Jeder Befehl fügt einen neuen Task-Block NACH der aktuellen Aufgabe
   ein (über worksheetStore.insertTaskAt). `keywords` steuern die
   Filterung beim Tippen (z. B. "/luecke" findet den Lückentext).
   ══════════════════════════════════════════════════ */

export interface SlashCommand {
    type: TaskType;
    label: string;
    description: string;
    icon: LucideIcon;
    /** Zusätzliche Suchbegriffe (lowercase) neben dem Label. */
    keywords: string[];
}

export const SLASH_COMMANDS: SlashCommand[] = [
    { type: 'instruction', label: 'Aufgabe', description: 'Freier Aufgabentext', icon: FileText, keywords: ['aufgabe', 'text', 'frage', 'task'] },
    { type: 'information', label: 'Info-Box', description: 'Informationstext', icon: BookOpen, keywords: ['info', 'information', 'text', 'lesen'] },
    { type: 'cloze', label: 'Lückentext', description: 'Text mit Lücken [Wort]', icon: TextCursorInput, keywords: ['luecke', 'lücke', 'lueckentext', 'cloze', 'gap'] },
    { type: 'multiple-choice', label: 'Multiple Choice', description: 'Frage mit Antwortoptionen', icon: ListChecks, keywords: ['multiple', 'choice', 'mc', 'ankreuzen', 'antwort'] },
    { type: 'ordering', label: 'Reihenfolge', description: 'Elemente in Reihenfolge bringen', icon: ListOrdered, keywords: ['reihenfolge', 'ordering', 'ordnen', 'nummerieren', 'sortieren', 'schritte'] },
    { type: 'table', label: 'Tabelle', description: 'Tabelle einfügen', icon: Table, keywords: ['tabelle', 'table', 'spalten', 'zeilen'] },
    { type: 'math', label: 'Mathematik', description: 'LaTeX-Formel', icon: Sigma, keywords: ['mathe', 'math', 'formel', 'latex', 'gleichung'] },
    { type: 'image-placeholder', label: 'Bild-Platzhalter', description: 'Platz für ein Bild', icon: ImageIcon, keywords: ['bild', 'image', 'foto', 'grafik', 'platzhalter'] },
    { type: 'lineatur', label: 'Lineatur / Raster', description: 'Schreiblinien oder Karo', icon: Type, keywords: ['lineatur', 'linien', 'raster', 'karo', 'schreiben'] },
    { type: 'heading', label: 'Zwischenüberschrift', description: 'Abschnitts-Überschrift', icon: Heading, keywords: ['ueberschrift', 'überschrift', 'heading', 'titel', 'abschnitt'] },
    { type: 'columns', label: 'Zweispaltig', description: 'Zwei-Spalten-Layout', icon: Columns, keywords: ['spalten', 'columns', 'zweispaltig', 'nebeneinander'] },
    { type: 'page-break', label: 'Seitenumbruch', description: 'Neue Seite beginnen', icon: Scissors, keywords: ['seitenumbruch', 'umbruch', 'page', 'break', 'seite'] },
];

/** Filtert Befehle nach Query (Label + keywords, akzentunabhängig genug). */
export function filterSlashCommands(query: string): SlashCommand[] {
    const q = query.trim().toLowerCase();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter((command) =>
        command.label.toLowerCase().includes(q)
        || command.keywords.some((keyword) => keyword.includes(q)),
    );
}
