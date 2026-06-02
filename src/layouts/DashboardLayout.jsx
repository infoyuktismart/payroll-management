import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ErrorBoundary from '../components/ErrorBoundary'
import CompanySwitcher from '../components/CompanySwitcher'
import BranchSwitcher from '../components/BranchSwitcher'
import SubscriptionStatusBanner from '../components/SubscriptionStatusBanner'
import { ROUTE_FEATURES } from '../lib/planFeatures'
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
    Crown
} from 'lucide-react'
import clsx from 'clsx'

const SidebarItem = ({ to, icon: Icon, label, active }) => (
    <Link
        to={to}
        className={clsx(
            "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2",
            active
                ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                : "text-gray-600 hover:bg-slate-50 hover:text-slate-900 hover:pl-6"
        )}
        aria-current={active ? 'page' : undefined}
    >
        <Icon className={clsx(
            "w-5 h-5 transition-all duration-300",
            active ? "text-white" : "text-gray-600 group-hover:text-slate-900 group-hover:scale-110"
        )} />
        <span className={clsx(
            "font-bold text-sm transition-all duration-300",
            !active && "group-hover:tracking-wide"
        )}>{label}</span>
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

    // Navigation Items Configuration
    const allNavItems = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', adminOnly: true },
        { to: '/employees', icon: Users, label: 'Employee Management', adminOnly: true },
        { to: '/onboarding', icon: UserCheck, label: 'Onboarding Checklist', adminOnly: true },
        { to: '/attendance', icon: CalendarCheck, label: 'Attendance', adminOnly: true },
        { to: '/biometric-import', icon: Fingerprint, label: 'Biometric Import', adminOnly: true },
        { to: '/salary-structure', icon: Wallet, label: 'Salary Structure', adminOnly: true },
        // { to: '/deductions', icon: MinusCircle, label: 'Deductions', adminOnly: true },
        { to: '/payroll-processing', icon: ClipboardList, label: 'Payroll Processing', adminOnly: true },
        { to: '/loans', icon: Banknote, label: 'Loans & Advances', adminOnly: true },
        { to: '/reimbursements', icon: Receipt, label: 'Reimbursements', adminOnly: true },
        { to: '/reports', icon: BarChart3, label: 'Reports', adminOnly: true },
        { to: '/analytics', icon: ChartSpline, label: 'Analytics', adminOnly: true },
        { to: '/exits', icon: DoorOpen, label: 'Exit Management', adminOnly: true },
        { to: '/tax-declarations', icon: ReceiptText, label: 'Tax Declarations', adminOnly: true },
        { to: '/subscription-management', icon: Crown, label: 'Subscription Management', adminOnly: true },
        { to: '/billing', icon: Receipt, label: 'Billing & Invoices', adminOnly: true },
        { to: '/company-settings', icon: Building, label: 'Company Settings', adminOnly: true },
        { to: '/settings', icon: Settings, label: 'Settings', adminOnly: true },
        { to: '/superadmin', icon: Shield, label: 'Super Admin Analytics', superadminOnly: true },
        { to: '/portal', icon: UserSquare2, label: 'Employee Portal', adminOnly: false },
    ]

    const navItems = allNavItems.filter(item => {
        if (item.superadminOnly) {
            return profileData?.role === 'superadmin'
        }
        if (isAdmin) {
            const requiredFeature = ROUTE_FEATURES[item.to]
            if (requiredFeature && !isSuperAdmin && !entitlementLoading && !canUseFeature(requiredFeature)) {
                return false
            }
            return true
        }
        return !item.adminOnly // Employees only see non-admin items (Portal)
    })
    const bottomNavItems = navItems.filter(item => (
        isAdmin
            ? ['/dashboard', '/attendance', '/payroll-processing', '/reports', '/settings'].includes(item.to)
            : ['/portal'].includes(item.to)
    ))

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
                    "fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-30 transform transition-transform duration-200 ease-in-out lg:translate-x-0 flex flex-col h-screen shrink-0",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="h-20 flex items-center px-6 border-b border-gray-100 shrink-0">
                    <h1 className="text-lg font-semibold text-gray-800 tracking-tight">Payroll Management</h1>
                </div>

                {/* Profile Card */}
                <div className="px-4 py-4 shrink-0">
                    <div className="bg-slate-50 rounded-2xl p-4 relative overflow-hidden group hover:bg-slate-100 transition-all duration-300 border border-transparent hover:border-gray-200">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-inner group-hover:scale-110 transition-transform duration-300">
                                {profileData?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                                {profileData?.lastName?.[0] || ''}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{profileData?.firstName || 'System'}</p>
                                <p className="text-sm font-bold text-gray-900 truncate uppercase mt-[-2px]">{profileData?.lastName || 'Administrator'}</p>
                                <p className="text-xs text-blue-600 font-medium mt-1 truncate">{profileData?.role || (isAdmin ? 'Admin' : 'Employee')}</p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-600 uppercase tracking-wider">
                                {isAdmin ? 'Admin' : 'Employee'}
                            </span>
                            <span className="text-[10px] font-semibold text-gray-600 group-hover:text-gray-600 transition-colors">{profileData?.employeeId || 'EMP24001'}</span>
                        </div>
                    </div>
                </div>

                <nav className="p-4 space-y-1 overflow-y-auto flex-1 flex flex-col justify-between min-h-0">
                    <div className="space-y-1">
                        {navItems.map((item) => (
                            <SidebarItem
                                key={item.to}
                                {...item}
                                active={location.pathname === item.to}
                            />
                        ))}
                    </div>

                    <div className="pt-2 shrink-0">
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center space-x-3 px-4 py-2 rounded-xl text-gray-500 hover:bg-rose-50 hover:text-rose-600 hover:pl-6 transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 cursor-pointer"
                            aria-label="Sign out"
                        >
                            <LogOut className="w-5 h-5 transition-all duration-300 text-gray-400 group-hover:text-rose-600 group-hover:scale-110" />
                            <span className="font-bold text-sm transition-all duration-300 group-hover:tracking-wide">Sign Out</span>
                        </button>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile Header */}
                <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 lg:hidden focus:outline-none focus:ring-2 focus:ring-slate-500 rounded-lg"
                            aria-label="Open menu"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <h2 className="text-lg font-semibold text-gray-800">{profileData?.role === 'Employee' ? 'Employee Portal' : location.pathname === '/dashboard' ? 'Dashboard' : location.pathname.replace('/', '').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</h2>
                    </div>

                    <div className="flex items-center space-x-6">
                        {isAdmin && (
                            <div className="flex items-center space-x-4">
                                {canUseFeature('multi_company') && <CompanySwitcher />}
                                <BranchSwitcher />
                            </div>
                        )}
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs" aria-hidden="true">
                                IT
                            </div>
                            <span className="text-sm text-gray-600 font-medium">Welcome to Payroll Management System</span>
                        </div>
                        <div className="flex items-center space-x-4 text-gray-600 border-l pl-6 border-gray-100">
                            <button className="cursor-pointer hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-slate-500 rounded-lg p-1" aria-label="Search">
                                <Search className="w-5 h-5" />
                            </button>
                            <button className="cursor-pointer hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-slate-500 rounded-lg p-1" aria-label="Add new">
                                <Plus className="w-5 h-5" />
                            </button>
                            <button className="cursor-pointer hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-slate-500 rounded-lg p-1" aria-label="Settings">
                                <Settings className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-gray-100">
                    <div className="max-w-7xl mx-auto">
                        <ErrorBoundary>
                            {isAdmin && <SubscriptionStatusBanner />}
                            <Outlet />
                        </ErrorBoundary>
                    </div>
                </main>

                <nav
                    className="pwa-bottom-nav lg:hidden"
                    style={{ gridTemplateColumns: `repeat(${Math.max(1, bottomNavItems.length)}, minmax(0, 1fr))` }}
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
                </nav>
            </div>
        </div>
    )
}
