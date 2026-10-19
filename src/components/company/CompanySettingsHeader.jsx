import { Building, ShieldCheck, Globe } from 'lucide-react'
import { useToast } from '../../context/ToastContext'

export default function CompanySettingsHeader({
    logoUrl,
    companyName,
    activeTab,
    setActiveTab,
    canWhiteLabel
}) {
    const toast = useToast()

    return (
        <div className="space-y-6">
            {/* Header banner */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-slate-50 rounded-full -z-10 opacity-60" />
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center text-white font-bold text-2xl shadow-xl shadow-slate-100 shrink-0 overflow-hidden border border-slate-800">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            <Building className="w-10 h-10" />
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">{companyName || 'Acme Solutions'}</h1>
                        <p className="text-slate-400 text-sm font-medium mt-1">Manage corporate branding, legal identifier records & state taxation details</p>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-100 gap-6">
                <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className={`pb-3 font-bold text-sm transition-all border-b-2 px-1 flex items-center gap-2 ${activeTab === 'profile' ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-600 hover:text-slate-800'}`}
                >
                    <Building className="w-4 h-4" />
                    Company Profile
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('legal')}
                    className={`pb-3 font-bold text-sm transition-all border-b-2 px-1 flex items-center gap-2 ${activeTab === 'legal' ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-600 hover:text-slate-800'}`}
                >
                    <ShieldCheck className="w-4 h-4" />
                    Legal & Compliance
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (!canWhiteLabel) {
                            toast.error('White-labelling is available on the Enterprise plan.')
                            return
                        }
                        setActiveTab('branding')
                    }}
                    className={`pb-3 font-bold text-sm transition-all border-b-2 px-1 flex items-center gap-2 ${activeTab === 'branding' ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-600 hover:text-slate-800'} ${!canWhiteLabel ? 'opacity-50' : ''}`}
                >
                    <Globe className="w-4 h-4" />
                    White-Labelling & Themes
                </button>
            </div>
        </div>
    )
}
