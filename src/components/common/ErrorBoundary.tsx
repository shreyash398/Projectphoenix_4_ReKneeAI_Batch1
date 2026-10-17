import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log safe error telemetry without capturing personal health information or secrets
    console.error('ReKnee AI Application Error Boundary:', error.name, errorInfo.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: null });
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-warm-bg flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-warm-border shadow-card p-6 sm:p-8 max-w-md w-full text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-status-error-bg text-status-error mx-auto flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h1 className="text-lg font-bold text-navy-900">Something interrupted your recovery view</h1>
              <p className="text-xs text-slate-muted mt-1 leading-relaxed">
                We encountered an unexpected interface issue. Your saved exercise and check-in records remain safe.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReload}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Reload Page
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={this.handleReset}
                icon={<Home className="w-3.5 h-3.5" />}
              >
                Return to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
