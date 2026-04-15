import { BubbleMenu, type Editor } from '@tiptap/react';
import { Bold, Gem, Italic, Underline as UnderlineIcon } from 'lucide-react';
import { useWorksheetStore } from '../../../store/worksheetStore';
import type { VocabularyItem } from '../../../types/worksheet';

interface TextEditorBubbleMenuProps {
    editor: Editor;
    taskId: string;
}

function createVocabularyItem(word = ''): VocabularyItem {
    return {
        id: crypto.randomUUID(),
        word: word.trim(),
        pos: '',
        definition: '',
    };
}

export function TextEditorBubbleMenu({ editor, taskId }: TextEditorBubbleMenuProps) {
    const updateTask = useWorksheetStore((state) => state.updateTask);

    const addVocabulary = () => {
        const selectedText = editor.state.doc.textBetween(
            editor.state.selection.from,
            editor.state.selection.to,
            ' ',
        );
        const trimmedSelection = selectedText.trim();

        if (!trimmedSelection) return;

        const currentVocabulary = useWorksheetStore.getState().tasksById[taskId]?.vocabulary ?? [];
        updateTask(taskId, {
            vocabulary: [...currentVocabulary, createVocabularyItem(trimmedSelection)],
        });
    };

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={({ editor: currentEditor, from, to }) => from !== to && currentEditor.isFocused}
            tippyOptions={{
                duration: 100,
                zIndex: 99999,
                appendTo: () => document.getElementById('root') || document.body,
                interactive: true,
            }}
            className="no-print flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 z-[99999]"
        >
            <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${editor.isActive('bold') ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-600 dark:text-slate-300'}`}
            >
                <Bold size={16} />
            </button>
            <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${editor.isActive('italic') ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-600 dark:text-slate-300'}`}
            >
                <Italic size={16} />
            </button>
            <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${editor.isActive('underline') ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-600 dark:text-slate-300'}`}
            >
                <UnderlineIcon size={16} />
            </button>
            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />
            <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={addVocabulary}
                title="Als Vokabel markieren"
                className="tour-vocabulary p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 transition-colors"
            >
                <Gem size={18} />
            </button>
        </BubbleMenu>
    );
}
