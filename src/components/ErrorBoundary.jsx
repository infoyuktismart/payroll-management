import React from 'react'
import { logger } from '../lib/devLogger'

/**
 * ErrorBoundary — catches unhandled JS errors in the component tree
 * and shows a friendly UI instead of a white screen crash.
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo })
        logger.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
        window.location.href = '/'
    }

    render() {
        if (!this.state.hasError) return this.props.children

        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 max-w-lg w-full p-10 text-center">
                    {/* Icon */}
                    <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                    </div>

                    <h1 className="text-2xl font-black text-gray-900 mb-2">Something went wrong</h1>
                    <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                        An unexpected error occurred. Our team has been notified. Please try refreshing or going back to the dashboard.
                    </p>

                    {/* Error details (dev only) */}
                    {import.meta.env.DEV && this.state.error && (
                        <details className="mb-6 text-left bg-rose-50 border border-rose-100 rounded-xl p-4">
                            <summary className="text-xs font-bold text-rose-700 cursor-pointer uppercase tracking-wider mb-2">
                                Error Details (Dev Mode)
                            </summary>
                            <pre className="text-xs text-rose-800 whitespace-pre-wrap font-mono overflow-auto max-h-40">
                                {this.state.error.toString()}
                                {'\n\n'}
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </details>
                    )}

                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => window.history.back()}
                            className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            Go Back
                        </button>
                        <button
                            onClick={this.handleReset}
                            className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-100"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        )
    }
}
