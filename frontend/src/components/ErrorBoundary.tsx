import React, { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You could log to an external service here
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-rose-50">
          <div className="max-w-2xl rounded-lg border border-rose-200 bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-rose-700">Application Error</h2>
            <p className="mt-2 text-sm text-slate-700">An unexpected error occurred while rendering the app.</p>
            <pre className="mt-4 max-h-48 overflow-auto rounded bg-slate-100 p-3 text-xs text-slate-800">
              {String(this.state.error && (this.state.error.stack || this.state.error))}
            </pre>
            <div className="mt-4 flex gap-2">
              <button
                className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
