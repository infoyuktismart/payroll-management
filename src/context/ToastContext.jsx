/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export const useToast = () => {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be used within ToastProvider')
    return ctx
}

let toastId = 0

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([])

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = ++toastId
        setToasts(prev => [...prev, { id, message, type, duration }])
        if (duration > 0) {
            setTimeout(() => removeToast(id), duration)
        }
        return id
    }, [removeToast])

    const toast = {
        success: (msg, duration) => addToast(msg, 'success', duration),
        error:   (msg, duration) => addToast(msg, 'error',   duration ?? 6000),
        warning: (msg, duration) => addToast(msg, 'warning', duration),
        info:    (msg, duration) => addToast(msg, 'info',    duration),
    }

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    )
}

// ─── Toast Container (renders all toasts) ────────────────────────────────────
const STYLES = {
    success: {
        bar:  'bg-emerald-500',
        icon: 'bg-emerald-100 text-emerald-600',
        text: 'text-emerald-900',
        sub:  'text-emerald-700',
        border: 'border-emerald-100',
        svg: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
        ),
    },
    error: {
        bar:  'bg-rose-500',
        icon: 'bg-rose-100 text-rose-600',
        text: 'text-rose-900',
        sub:  'text-rose-700',
        border: 'border-rose-100',
        svg: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        ),
    },
    warning: {
        bar:  'bg-amber-400',
        icon: 'bg-amber-100 text-amber-600',
        text: 'text-amber-900',
        sub:  'text-amber-700',
        border: 'border-amber-100',
        svg: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
        ),
    },
    info: {
        bar:  'bg-blue-500',
        icon: 'bg-blue-100 text-blue-600',
        text: 'text-blue-900',
        sub:  'text-blue-700',
        border: 'border-blue-100',
        svg: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
}

function ToastContainer({ toasts, onRemove }) {
    if (toasts.length === 0) return null
    return (
        <div
            aria-live="polite"
            aria-label="Notifications"
            className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none"
            style={{ maxWidth: '420px', width: '100%' }}
        >
            {toasts.map(t => (
                <ToastItem key={t.id} toast={t} onRemove={onRemove} />
            ))}
        </div>
    )
}

function ToastItem({ toast, onRemove }) {
    const s = STYLES[toast.type] || STYLES.info

    return (
        <div
            role="alert"
            className={`pointer-events-auto relative flex items-start gap-3 bg-white rounded-2xl shadow-xl border ${s.border} px-4 py-3.5 overflow-hidden`}
            style={{ animation: 'toastSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
            {/* Colour bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar} rounded-l-2xl`} />

            {/* Icon */}
            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ml-1 ${s.icon}`}>
                {s.svg}
            </div>

            {/* Message */}
            <div className="flex-1 min-w-0 pt-0.5">
                <p className={`text-sm font-bold leading-snug ${s.text}`}>{toast.message}</p>
            </div>

            {/* Close */}
            <button
                onClick={() => onRemove(toast.id)}
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Dismiss notification"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <style>{`
                @keyframes toastSlideIn {
                    from { opacity: 0; transform: translateX(100%) scale(0.9); }
                    to   { opacity: 1; transform: translateX(0)    scale(1);   }
                }
            `}</style>
        </div>
    )
}
