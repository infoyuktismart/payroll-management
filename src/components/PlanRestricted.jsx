import { Link } from 'react-router-dom'
import { Lock, Crown } from 'lucide-react'
import { getFeatureLabel } from '../lib/planFeatures'

export default function PlanRestricted({ featureKey, planName, message }) {
    return (
        <div className="min-h-[55vh] flex items-center justify-center">
            <div className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                    <Lock className="h-7 w-7" />
                </div>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-amber-700">Plan Restricted</p>
                <h1 className="mt-2 text-2xl font-black text-slate-950">{getFeatureLabel(featureKey)} is not available</h1>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                    {message || `${planName || 'Your current plan'} does not include this feature. Upgrade the company subscription to unlock it.`}
                </p>
                <Link
                    to="/subscription-management"
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-black"
                >
                    <Crown className="h-4 w-4" />
                    Manage Subscription
                </Link>
            </div>
        </div>
    )
}
