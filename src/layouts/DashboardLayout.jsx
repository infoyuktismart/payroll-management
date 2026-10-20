import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ErrorBoundary from '../components/ErrorBoundary'
import CompanySwitcher from '../components/CompanySwitcher'
import BranchSwitcher from '../components/BranchSwitcher'
import { ROUTE_FEATURES } from '../lib/planFeatures'
import { SubscriptionHeaderPill } from '../components/SubscriptionStatusBanner'
import { usePlanEntitlements } from '../hooks/usePlanEntitlements'
import SuperAdminWorkspaceBanner from '../components/superadmin/SuperAdminWorkspaceBanner'
import RedeemLicenseModal from '../components/subscription/RedeemLicenseModal'
import { useCompany } from '../context/CompanyContext'
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Wallet,
  ClipboardList,
  BarChart3,
  UserSquare2,
  LogOut,
  Menu,
  Search,
  Settings,
  Plus,
  DoorOpen,
  ReceiptText,
  Building,
  UserCheck,
  Banknote,
  Receipt,
  ChartSpline,
  Fingerprint,
  Shield,
  Crown,
  MoreHorizontal,
  KeyRound,
  Lock,
} from 'lucide-react'
import clsx from 'clsx'

const SidebarItem = ({ to, icon: Icon, label, active, onClick, isItemLocked, badge }) => (
  <Link
    to={to}
    onClick={onClick}
    className={clsx(
      'flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 group focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm font-semibold',
      active
        ? 'bg-slate-900 text-white shadow-sm'
        : isItemLocked
          ? 'text-slate-400 hover:bg-slate-50'
          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
    )}
    aria-current={active ? 'page' : undefined}
  >
    <div className="flex items-center space-x-3 min-w-0">
      <Icon
        className={clsx(
          'w-4.5 h-4.5 shrink-0 transition-colors duration-150',
          active
            ? 'text-white'
            : isItemLocked
              ? 'text-slate-400'
              : 'text-slate-400 group-hover:text-slate-700'
        )}
      />
      <span className="truncate tracking-tight text-sm font-semibold">{label}</span>
    </div>
    {isItemLocked ? (
      <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
    ) : badge ? (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse shrink-0">
        {badge}
      </span>
    ) : null}
  </Link>
)

export default function DashboardLayout() {
  const { signOut, user, isAdmin, profileData, isSuperAdmin: authIsSuperAdmin } = useAuth()
  const { activeCompanyId } = useCompany()
  const {
    loading: entitlementLoading,
    canUseFeature,
    isSuperAdmin: planIsSuperAdmin,
    isLocked,
  } = usePlanEntitlements()
  const location = useLocation()
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false)

  const isSuperAdmin = Boolean(
    authIsSuperAdmin ||
    planIsSuperAdmin ||
    profileData?.role === 'superadmin' ||
    user?.user_metadata?.role === 'superadmin'
  )

  const handleSignOut = async () => {
    navigate('/login', { replace: true })
    await signOut()
  }

  // Categorized Navigation Architecture
  const navCategories = [
    {
      title: 'Core HR',
      items: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', adminOnly: true },
        { to: '/employees', icon: Users, label: 'Employee Management', adminOnly: true },
        { to: '/onboarding', icon: UserCheck, label: 'Onboarding Checklist', adminOnly: true },
        { to: '/exits', icon: DoorOpen, label: 'Exit Management', adminOnly: true },
        { to: '/portal', icon: UserSquare2, label: 'Employee Portal', adminOnly: false },
      ],
    },
    {
      title: 'Time & Attendance',
      items: [
        { to: '/attendance', icon: CalendarCheck, label: 'Attendance', adminOnly: true },
        { to: '/biometric-import', icon: Fingerprint, label: 'Biometric Import', adminOnly: true },
      ],
    },
    {
      title: 'Payroll & Finance',
      items: [
        {
          to: '/payroll-processing',
          icon: ClipboardList,
          label: 'Payroll Processing',
          adminOnly: true,
        },
        { to: '/salary-structure', icon: Wallet, label: 'Salary Structure', adminOnly: true },
        { to: '/loans', icon: Banknote, label: 'Loans & Advances', adminOnly: true },
        { to: '/reimbursements', icon: Receipt, label: 'Reimbursements', adminOnly: true },
        { to: '/tax-declarations', icon: ReceiptText, label: 'Tax Declarations', adminOnly: true },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        { to: '/reports', icon: BarChart3, label: 'Reports', adminOnly: true },
        { to: '/analytics', icon: ChartSpline, label: 'Analytics', adminOnly: true },
      ],
    },
    {
      title: 'Administration & Billing',
      items: [
        {
          to: '/subscription-management',
          icon: Crown,
          label: 'Subscription & Plans',
          adminOnly: true,
        },
        { to: '/billing', icon: Receipt, label: 'Billing & Invoices', adminOnly: true },
        { to: '/company-settings', icon: Building, label: 'Company Settings', adminOnly: true },
        { to: '/settings', icon: Settings, label: 'Settings', adminOnly: true },
        {
          to: '/superadmin',
          icon: Shield,
          label: 'Platform Console (Super Admin)',
          superadminOnly: true,
        },
      ],
    },
  ]

  const filterItem = (item) => {
    if (item.superadminOnly) {
      return (
        isSuperAdmin ||
        profileData?.role === 'superadmin' ||
        user?.user_metadata?.role === 'superadmin'
      )
    }
    if (isAdmin) {
      const requiredFeature = ROUTE_FEATURES[item.to]
      if (
        requiredFeature &&
        !isSuperAdmin &&
        !entitlementLoading &&
        !canUseFeature(requiredFeature)
      ) {
        return false
      }
      return true
    }
    return !item.adminOnly
  }

  const groupedNav = navCategories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(filterItem),
    }))
    .filter((cat) => cat.items.length > 0)

  const allFilteredItems = groupedNav.flatMap((cat) => cat.items)

  const bottomNavItems = allFilteredItems.filter((item) =>
    isAdmin
      ? ['/dashboard', '/attendance', '/payroll-processing', '/reports'].includes(item.to)
      : ['/portal'].includes(item.to)
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-30 transform transition-transform duration-200 ease-in-out lg:translate-x-0 flex flex-col h-screen shrink-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Top Profile Card */}
        <div className="p-3 border-b border-gray-100 shrink-0">
          <div className="bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/60 rounded-2xl p-3 transition-all duration-200 group">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-black text-sm shadow-md shadow-indigo-100 shrink-0 group-hover:scale-105 transition-transform">
                {profileData?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                {profileData?.lastName?.[0] || ''}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate leading-snug">
                  {profileData?.firstName
                    ? `${profileData.firstName} ${profileData.lastName || ''}`.trim()
                    : user?.email?.split('@')[0] || 'User'}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 capitalize border border-indigo-100/80 tracking-wide">
                    {profileData?.role || (isAdmin ? 'Admin' : 'Employee')}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/70 font-mono tracking-tight">
                    {profileData?.employeeId || 'EMP001'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grouped Sidebar Navigation */}
        <nav className="p-3 space-y-4 overflow-y-auto flex-1 min-h-0">
          {groupedNav.map((cat) => (
            <div key={cat.title} className="space-y-1">
              <p className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
                {cat.title}
              </p>
              {cat.items.map((item) => (
                <SidebarItem
                  key={item.to}
                  {...item}
                  active={location.pathname === item.to}
                  isItemLocked={
                    isLocked &&
                    !isSuperAdmin &&
                    !['/subscription-management', '/billing'].includes(item.to)
                  }
                  badge={
                    isLocked && !isSuperAdmin && item.to === '/subscription-management'
                      ? 'Action'
                      : null
                  }
                  onClick={() => setIsSidebarOpen(false)}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100 shrink-0">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-gray-500 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer text-sm font-semibold"
            aria-label="Sign out"
          >
            <LogOut className="w-4.5 h-4.5 transition-colors text-gray-400 group-hover:text-rose-600" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10 shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-600 hover:text-gray-900 lg:hidden focus:outline-none focus:ring-2 focus:ring-slate-500 rounded-lg"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-base lg:text-lg font-bold text-gray-800 truncate">
              {profileData?.role === 'Employee'
                ? 'Employee Portal'
                : location.pathname === '/dashboard'
                  ? 'Dashboard'
                  : location.pathname
                      .replace('/', '')
                      .replace('-', ' ')
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
            </h2>
          </div>

          <div className="flex items-center space-x-3 lg:space-x-4">
            {isSuperAdmin &&
              (location.pathname === '/superadmin' ? (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
                  title="Switch to Client Workspace HRMS"
                >
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  <span>Client HRMS</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/superadmin')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs cursor-pointer border border-slate-800"
                  title="Return to Super Admin Central Console"
                >
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Platform Console</span>
                </button>
              ))}
            {isAdmin && (
              <div className="flex items-center space-x-2 lg:space-x-3">
                {canUseFeature('multi_company') && <CompanySwitcher />}
                <BranchSwitcher />
                <SubscriptionHeaderPill />
              </div>
            )}
            <div className="hidden xl:flex items-center space-x-4 text-gray-600 border-l pl-4 border-gray-100">
              <button
                className="cursor-pointer hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500 rounded-lg p-1"
                aria-label="Search"
              >
                <Search className="w-4.5 h-4.5" />
              </button>
              <button
                className="cursor-pointer hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500 rounded-lg p-1"
                aria-label="Add new"
              >
                <Plus className="w-4.5 h-4.5" />
              </button>
              <button
                className="cursor-pointer hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500 rounded-lg p-1"
                aria-label="Settings"
                onClick={() => navigate('/settings')}
              >
                <Settings className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Super Admin Platform Operator Banner */}
        <SuperAdminWorkspaceBanner />

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-gray-100">
          <div className="max-w-7xl mx-auto">
            {isLocked && !isSuperAdmin && (
              <div className="mb-6 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-rose-700">
                      Trial Expired • Core Services Suspended
                    </p>
                    <p className="text-xs text-rose-900 font-semibold mt-0.5">
                      Please activate an enterprise license key or select a plan to restore full
                      workspace services.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRedeemModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition shrink-0 cursor-pointer"
                >
                  Activate License Key
                </button>
              </div>
            )}
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>

        <RedeemLicenseModal
          isOpen={isRedeemModalOpen}
          onClose={() => setIsRedeemModalOpen(false)}
          activeCompanyId={activeCompanyId}
        />

        {/* Mobile PWA Bottom Nav */}
        <nav
          className="pwa-bottom-nav lg:hidden"
          style={{ gridTemplateColumns: `repeat(${isAdmin ? 5 : 1}, minmax(0, 1fr))` }}
          aria-label="Primary mobile navigation"
        >
          {bottomNavItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={clsx('pwa-bottom-nav__item', active && 'pwa-bottom-nav__item--active')}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label.replace(' Processing', '').replace(' Management', '')}</span>
              </Link>
            )
          })}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="pwa-bottom-nav__item"
              aria-label="More navigation options"
            >
              <MoreHorizontal className="w-5 h-5" />
              <span>More</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  )
}
