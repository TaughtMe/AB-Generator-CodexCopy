import React from 'react';

interface EditorErrorBoundaryState {
    hasError: boolean;
    errorMessage: string;
}

interface EditorErrorBoundaryProps {
    children: React.ReactNode;
    fallbackContent?: string;
}

export class EditorErrorBoundary extends React.Component<
    EditorErrorBoundaryProps,
    EditorErrorBoundaryState
> {
    constructor(props: EditorErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }

    static getDerivedStateFromError(error: Error): EditorErrorBoundaryState {
        return {
            hasError: true,
            errorMessage: error?.message || 'Unbekannter Editor-Fehler',
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('[EditorErrorBoundary] Editor crash abgefangen:', error, errorInfo);
    }

    private handleRetry = (): void => {
        this.setState({ hasError: false, errorMessage: '' });
    };

    render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
                    <p className="text-sm font-semibold text-red-700">
                        Der Editor ist abgestürzt.
                    </p>
                    <p className="text-xs text-red-600 break-words">
                        {this.state.errorMessage}
                    </p>
                    {this.props.fallbackContent && (
                        <textarea
                            readOnly
                            value={this.props.fallbackContent}
                            className="w-full h-32 rounded-md border border-red-200 bg-white p-2 text-xs text-slate-700 resize-y"
                        />
                    )}
                    <button
                        onClick={this.handleRetry}
                        className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors cursor-pointer"
                    >
                        Editor neu laden
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
