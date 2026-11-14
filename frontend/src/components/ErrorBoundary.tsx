import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-card p-8 text-center">
              <div className="h-12 w-12 rounded-full bg-warning-100 text-warning-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
              <p className="text-sm text-slate-500 mt-1">
                {this.state.error?.message || 'An unexpected error occurred.'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white text-sm font-medium hover:bg-navy-800"
              >
                <RotateCcw className="h-4 w-4" />
                Reload application
              </button>
            </div>
          </div>
        )
      )
    }
    return this.props.children
  }
}
