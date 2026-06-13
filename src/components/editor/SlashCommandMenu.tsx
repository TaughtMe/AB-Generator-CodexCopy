import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { useWorksheetStore } from '../../store/worksheetStore';
import { ICON_SIZES } from '../ui/iconSizes';
import { filterSlashCommands, type SlashCommand } from './slashCommands';

/* ══════════════════════════════════════════════════
   SlashCommandMenu – "/"-Befehlsmenü in Task-Editoren.

   Bewusst KEINE neue Tiptap-Suggestion-Dependency: Trigger und Query
   werden direkt aus dem Editor-State gelesen, Positionierung über
   coordsAtPos, Tastatursteuerung über einen Capture-Listener auf dem
   Editor-DOM (fängt Pfeile/Enter/Escape vor ProseMirror ab).

   Auswahl fügt einen neuen Task-Block NACH der aktuellen Aufgabe ein
   (worksheetStore.insertTaskAt — derselbe Integrationspunkt wie die
   FloatingToolbar). Der "/query"-Text wird vorher entfernt.
   ══════════════════════════════════════════════════ */

interface SlashState {
    /** Doc-Position des "/" (inklusiv) — von hier bis Cursor wird gelöscht. */
    from: number;
    query: string;
    coords: { left: number; top: number; bottom: number };
}

interface SlashCommandMenuProps {
    editor: Editor;
    taskId: string;
}

export function SlashCommandMenu({ editor, taskId }: SlashCommandMenuProps) {
    const [state, setState] = useState<SlashState | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const stateRef = useRef<SlashState | null>(null);
    const activeIndexRef = useRef(0);
    stateRef.current = state;
    activeIndexRef.current = activeIndex;

    const commands = state ? filterSlashCommands(state.query) : [];
    const commandsRef = useRef<SlashCommand[]>(commands);
    commandsRef.current = commands;

    /** Erkennt das "/"-Token unmittelbar vor dem Cursor im aktuellen Textblock. */
    const recompute = useCallback(() => {
        const { state: edState } = editor;
        const { selection } = edState;
        if (!selection.empty) return setState(null);

        const $from = selection.$from;
        const cursorPos = $from.pos;
        // Text vom Blockanfang bis zum Cursor.
        const blockStart = cursorPos - $from.parentOffset;
        const textBefore = edState.doc.textBetween(blockStart, cursorPos, '\n', '\0');

        // Letztes "/" finden, das am Blockanfang oder nach Whitespace steht.
        const match = /(?:^|\s)\/([^\s/]*)$/.exec(textBefore);
        if (!match) return setState(null);

        const query = match[1];
        // Doc-Position des "/" = Cursor − Länge("/"+query).
        const from = cursorPos - (query.length + 1);

        const coords = editor.view.coordsAtPos(cursorPos);
        setState({ from, query, coords: { left: coords.left, top: coords.top, bottom: coords.bottom } });
        setActiveIndex(0);
    }, [editor]);

    useEffect(() => {
        editor.on('update', recompute);
        editor.on('selectionUpdate', recompute);
        return () => {
            editor.off('update', recompute);
            editor.off('selectionUpdate', recompute);
        };
    }, [editor, recompute]);

    const runCommand = useCallback((command: SlashCommand) => {
        const current = stateRef.current;
        if (!current) return;

        // 1) "/query" aus dem Editor entfernen.
        editor.chain().focus().deleteRange({ from: current.from, to: editor.state.selection.from }).run();

        // 2) Neuen Task NACH der aktuellen Aufgabe einfügen.
        const ws = useWorksheetStore.getState();
        const idx = ws.taskIds.indexOf(taskId);
        const insertAt = idx >= 0 ? idx + 1 : ws.taskIds.length;
        ws.insertTaskAt(command.type, insertAt);

        setState(null);
    }, [editor, taskId]);

    // Tastatursteuerung im Capture-Phase (vor ProseMirror) — nur wenn Menü offen.
    useEffect(() => {
        const dom = editor.view.dom as HTMLElement;
        const onKeyDown = (event: KeyboardEvent) => {
            if (!stateRef.current) return;
            const list = commandsRef.current;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setState(null);
                return;
            }
            if (list.length === 0) return;
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();
                setActiveIndex((i) => (i + 1) % list.length);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                event.stopPropagation();
                setActiveIndex((i) => (i - 1 + list.length) % list.length);
            } else if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                event.stopPropagation();
                runCommand(list[activeIndexRef.current] ?? list[0]);
            }
        };
        dom.addEventListener('keydown', onKeyDown, true);
        return () => dom.removeEventListener('keydown', onKeyDown, true);
    }, [editor, runCommand]);

    if (!state) return null;
    if (commands.length === 0) return null;

    // Unterhalb des Cursors, am unteren Viewport-Rand nach oben klappen.
    const MENU_MAX_HEIGHT = 320;
    const openUpwards = state.coords.bottom + MENU_MAX_HEIGHT > window.innerHeight;
    const top = openUpwards ? undefined : state.coords.bottom + 6;
    const bottom = openUpwards ? window.innerHeight - state.coords.top + 6 : undefined;

    return createPortal(
        <div
            data-slash-menu
            role="listbox"
            className="fixed z-[200] w-64 max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-1"
            style={{ left: Math.min(state.coords.left, window.innerWidth - 272), top, bottom }}
        >
            {commands.map((command, index) => {
                const Icon = command.icon;
                const isActive = index === activeIndex;
                return (
                    <button
                        key={command.type}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        // mousedown statt click: verhindert Editor-Blur vor der Aktion.
                        onMouseDown={(event) => { event.preventDefault(); runCommand(command); }}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                            isActive ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isActive ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                            <Icon className={ICON_SIZES[16]} />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{command.label}</span>
                            <span className="block text-xs text-slate-400 dark:text-slate-500 truncate">{command.description}</span>
                        </span>
                    </button>
                );
            })}
        </div>,
        document.body,
    );
}
