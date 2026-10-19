import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ErrorBoundary from '../components/ErrorBoundary'
import CompanySwitcher from '../components/CompanySwitcher'
import BranchSwitcher from '../components/BranchSwitcher'
import { ROUTE_FEATURES } from '../lib/planFeatures'
import { SubscriptionHeaderPill } from '../components/SubscriptionStatusBanner'
import { usePlanEntitlements } from '../hooks/usePlanEntitlements'
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
} from 'lucide-react'
import clsx from 'clsx'

const SidebarItem = ({ to, icon: Icon, label, active, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={clsx(
      'flex items-center space-x-3 px-3 py-2 rounded-xl transition-all duration-150 group focus:outline-none focus:ring-2 focus:ring-slate-400 text-xs font-semibold',
      active
        ? 'bg-slate-900 text-white shadow-sm'
        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
    )}
    aria-current={active ? 'page' : undefined}
  >
    <Icon
      className={clsx(
        'w-4 h-4 shrink-0 transition-colors duration-150',
        active ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'
      )}
    />
    <span className="truncate tracking-tight">{label}</span>
  </Link>
)

export default function DashboardLayout() {
  const { signOut, user, isAdmin, profileData } = useAuth()
  const { loading: entitlementLoading, canUseFeature, isSuperAdmin } = usePlanEntitlements()
  const location = useLocation()
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
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
        { to: '/superadmin', icon: Shield, label: 'Super Admin Analytics', superadminOnly: true },
      ],
    },
  ]

  const filterItem = (item) => {
    if (item.superadminOnly) {
      return profileData?.role === 'superadmin'
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
              <p className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                {cat.title}
              </p>
              {cat.items.map((item) => (
                <SidebarItem
                  key={item.to}
                  {...item}
                  active={location.pathname === item.to}
                  onClick={() => setIsSidebarOpen(false)}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100 shrink-0">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-gray-500 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer text-xs font-semibold"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4 transition-colors text-gray-400 group-hover:text-rose-600" />
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

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-gray-100">
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>

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
