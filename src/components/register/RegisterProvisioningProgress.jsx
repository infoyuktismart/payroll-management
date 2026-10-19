import { CheckCircle, Loader2, ArrowRight } from 'lucide-react'

export default function RegisterProvisioningProgress({
    isCompleted,
    setupProgress,
    onDashboardRedirect
}) {
    return (
        <div className="space-y-6 py-4">
            <div className="text-center mb-6">
                {isCompleted ? (
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mx-auto mb-4 border border-emerald-100 animate-bounce">
                        <CheckCircle className="w-8 h-8" />
                    </div>
                ) : (
                    <Loader2 className="w-12 h-12 text-slate-900 animate-spin mx-auto mb-4" />
                )}
                <h3 className="text-xl font-bold text-slate-950">{isCompleted ? 'Workspace Provisioned!' : 'Onboarding Corporate Workspace...'}</h3>
                <p className="text-xs text-slate-500 mt-1.5">{isCompleted ? 'Your SaaS enterprise payroll workspace is configured and ready.' : 'Creating your dedicated company, admin memberships, and trial subscription counters.'}</p>
            </div>

            <div className="space-y-3 bg-slate-50 p-6 rounded-xl border border-gray-200">
                {setupProgress.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                        <span className={`font-semibold ${item.status === 'completed' ? 'text-slate-400 line-through font-normal' : item.status === 'in_progress' ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>{item.label}</span>
                        <span className="flex items-center shrink-0">
                            {item.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                            {item.status === 'in_progress' && <Loader2 className="w-4 h-4 text-slate-900 animate-spin" />}
                            {item.status === 'pending' && <span className="w-2 h-2 rounded-full bg-slate-300"></span>}
                        </span>
                    </div>
                ))}
            </div>

            {isCompleted && (
                <button 
                    onClick={onDashboardRedirect}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-lg flex items-center justify-center space-x-2 uppercase tracking-widest cursor-pointer mt-8"
                >
                    <span>Enter Corporate Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                </button>
            )}
        </div>
    )
}
