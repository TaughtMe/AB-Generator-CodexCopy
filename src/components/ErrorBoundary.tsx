import React from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
    errorMessage: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
    constructor(props: React.PropsWithChildren) {
        super(props);
        this.state = {
            hasError: false,
            errorMessage: '',
        };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return {
            hasError: true,
            errorMessage: error?.message || 'Unbekannter Fehler',
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('[ErrorBoundary] UI crash abgefangen:', error, errorInfo);
    }

    private handleReload = (): void => {
        window.location.reload();
    };

    render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-200 flex items-center justify-center px-6">
                    <div className="max-w-xl w-full bg-white border border-slate-300 rounded-xl shadow p-6">
                        <h1 className="text-lg font-bold text-slate-800 mb-2">Ein Fehler ist aufgetreten</h1>
                        <p className="text-sm text-slate-600 mb-4">
                            Die Oberfläche konnte nicht korrekt geladen werden. Bitte lade das Arbeitsblatt neu.
                        </p>
                        <p className="text-xs text-slate-500 mb-5 break-words">
                            Fehlerdetails: {this.state.errorMessage}
                        </p>
                        <button
                            onClick={this.handleReload}
                            className="px-4 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-800 text-white rounded-md transition-colors cursor-pointer"
                        >
                            Arbeitsblatt neu laden
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}