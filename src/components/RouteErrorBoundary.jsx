import { Component } from 'react'
import * as Sentry from '@sentry/react'
import { AlertCircle, RotateCcw } from 'lucide-react'

export default class RouteErrorBoundary extends Component {
    state = { hasError: false, error: null }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, info) {
        if (import.meta.env.PROD) {
            Sentry.captureException(error, { extra: info })
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 border border-red-200 rounded-2xl bg-red-50/50 m-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex gap-3">
                        <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-red-950 font-bold text-sm">This section failed to load</h2>
                            <p className="text-red-700 text-xs mt-0.5 max-w-lg font-medium leading-relaxed">
                                {this.state.error?.message || 'An unexpected rendering error occurred in this module.'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="flex items-center gap-1.5 text-xs px-4 py-2 border border-red-200 bg-white hover:bg-red-50 active:scale-[0.98] rounded-xl text-red-700 font-bold shadow-sm transition-all shrink-0"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retry Section</span>
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}
