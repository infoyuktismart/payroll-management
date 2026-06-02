import { RotateCw, Users } from 'lucide-react'

export default function AppCrashFallback({ error }) {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
            <div className="max-w-md w-full bg-white rounded-3xl border border-red-100 shadow-xl p-8 text-center space-y-6 relative overflow-hidden">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-red-50">
                    <Users className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Something went wrong</h1>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        A catastrophic application error occurred. We've automatically logged this failure for our engineering team to review.
                    </p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-slate-400 font-mono text-left break-all">
                    Context: Critical Application Boundary Crash
                    {error?.message ? `\n${error.message}` : ''}
                </div>

                <div className="pt-2">
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-slate-200 active:scale-[0.98] transition-all"
                    >
                        <RotateCw className="w-4 h-4" />
                        <span>Reload app</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
