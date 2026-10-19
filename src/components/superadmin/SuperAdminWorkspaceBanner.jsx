import { useNavigate, useLocation } from 'react-router-dom'
import { Shield, ArrowLeft, ChevronDown } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useCompany } from '../../context/CompanyContext'

export default function SuperAdminWorkspaceBanner() {
  const { isSuperAdmin, profileData, user } = useAuth()
  const { company, companies, switchCompany, activeCompanyId } = useCompany()
  const location = useLocation()
  const navigate = useNavigate()

  // Only show when the user is a superadmin and inspecting a client workspace
  const effectiveIsSuperAdmin = Boolean(
    isSuperAdmin || profileData?.role === 'superadmin' || user?.user_metadata?.role === 'superadmin'
  )

  if (!effectiveIsSuperAdmin || location.pathname === '/superadmin') {
    return null
  }

  return (
    <div className="bg-slate-900 border-b border-indigo-500/30 text-white px-4 py-2.5 shadow-md shrink-0">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Indicator */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[11px] font-black uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Platform Operator Mode</span>
          </div>
          <span className="text-slate-400 text-xs hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5 text-xs text-slate-200 truncate">
            <span className="text-slate-400">Viewing Client:</span>
            <span className="font-bold text-white truncate">
              {company?.name || 'Client Workspace'}
            </span>
            {company?.code && (
              <span className="text-[10px] font-mono bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded border border-slate-700">
                {company.code}
              </span>
            )}
          </div>
        </div>

        {/* Right: Tenant Switcher & Console Return Action */}
        <div className="flex items-center gap-2 ml-auto">
          {companies.length > 1 && (
            <div className="relative">
              <select
                value={activeCompanyId || ''}
                onChange={(e) => switchCompany(e.target.value)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 pr-7 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer appearance-none"
                aria-label="Switch client workspace"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code || 'Tenant'})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate('/superadmin')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Platform Console</span>
          </button>
        </div>
      </div>
    </div>
  )
}
