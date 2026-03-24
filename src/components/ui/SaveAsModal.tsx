import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useWorksheetStore } from '../../store/worksheetStore';

interface SaveAsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave?: () => void | Promise<void>;
}

export function SaveAsModal({ isOpen, onClose, onSave }: SaveAsModalProps) {
    const documentMeta = useWorkspaceStore((s) => s.documentMeta);
    const updateDocumentMeta = useWorkspaceStore((s) => s.updateDocumentMeta);
    const saveCurrentDocument = useWorkspaceStore((s) => s.saveCurrentDocument);
    const markAsSaved = useWorkspaceStore((s) => s.markAsSaved);
    const worksheetTitle = useWorksheetStore((s) => s.title);
    const setWorksheetTitle = useWorksheetStore((s) => s.setTitle);

    const [title, setTitle] = useState(worksheetTitle || documentMeta.title || '');
    const [subject, setSubject] = useState(documentMeta.subject || '');
    const [classLevel, setClassLevel] = useState(documentMeta.classLevel || '');

    useEffect(() => {
        if (!isOpen) return;
        setTitle(worksheetTitle || documentMeta.title || '');
        setSubject(documentMeta.subject || '');
        setClassLevel(documentMeta.classLevel || '');
    }, [isOpen, worksheetTitle, documentMeta.title, documentMeta.subject, documentMeta.classLevel]);

    if (!isOpen) return null;

    const handleSave = () => {
        const normalizedTitle = title.trim() || 'Unbenannt';

        updateDocumentMeta({
            title: normalizedTitle,
            subject: subject.trim(),
            classLevel: classLevel.trim(),
        });
        setWorksheetTitle(normalizedTitle);
        saveCurrentDocument();
        markAsSaved();
        onClose();
        void onSave?.();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-800 p-6 rounded-xl w-96 border border-slate-700 shadow-2xl">
                <h2 className="text-lg font-semibold text-slate-100 mb-4">Speichern unter</h2>

                <label className="block text-sm text-slate-300">
                    Titel des Arbeitsblatts
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 mt-1 mb-4"
                    />
                </label>

                <label className="block text-sm text-slate-300">
                    Fach (z. B. Mathematik)
                    <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 mt-1 mb-4"
                    />
                </label>

                <label className="block text-sm text-slate-300">
                    Klasse (z. B. 4a)
                    <input
                        type="text"
                        value={classLevel}
                        onChange={(e) => setClassLevel(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 mt-1 mb-4"
                    />
                </label>

                <div className="flex justify-end gap-2 mt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded border border-slate-600 text-slate-200 hover:bg-slate-700"
                    >
                        Abbrechen
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded"
                    >
                        Speichern
                    </button>
                </div>
            </div>
        </div>
    );
}
