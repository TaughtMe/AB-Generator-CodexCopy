import React from 'react';

/**
 * A4Worksheet – Simulates a physical A4 page (210mm × 297mm).
 * Centered on a "desk" background with drop shadow and 20mm padding.
 * All tasks render directly inside this page for true WYSIWYG.
 */
interface A4WorksheetProps {
    children: React.ReactNode;
}

export const A4Worksheet: React.FC<A4WorksheetProps> = ({ children }) => {
    return (
        <div className="a4-desk">
            <div className="a4-page">
                {children}
            </div>
        </div>
    );
};
