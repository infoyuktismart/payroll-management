import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    ArrowRight,
    BarChart3,
    Building2,
    CalendarCheck,
    CheckCircle2,
    CreditCard,
    FileText,
    ShieldCheck,
    Sparkles,
    Users
} from 'lucide-react'

const proofPoints = [
    '14-day company trial',
    'Per-employee monthly billing',
    'Multi-company and branch ready',
    'PF, ESI, PT, LWF reporting foundation'
]

const moduleCards = [
    { icon: Users, title: 'People', body: 'Employee records, onboarding, documents, and exits.' },
    { icon: CalendarCheck, title: 'Time', body: 'Attendance, shifts, leave policies, and overtime.' },
    { icon: FileText, title: 'Payroll', body: 'Salary runs, payslips, statutory reports, and exports.' },
    { icon: CreditCard, title: 'Billing', body: 'Trial plans, PEPM pricing, invoices, and Razorpay checkout.' }
]

export default function Landing() {
    const { user, loading, isAdmin, twoFactorChallenge, isTwoFactorVerified } = useAuth()

    if (loading) return null

    const pendingTwoFactor = user && twoFactorChallenge?.userId === user.id && !isTwoFactorVerified(user.id)

    if (pendingTwoFactor) {
        return <Navigate to="/login" replace />
    }

    if (user) {
        return <Navigate to={isAdmin ? '/dashboard' : '/portal'} replace />
    }

    return (
        <main className="min-h-screen bg-slate-50 text-slate-950">
            <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
                    <Link to="/" className="flex items-center gap-3 text-slate-950">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
                            <Sparkles className="h-5 w-5 text-white" />
                        </span>
                        <span className="text-sm font-black uppercase tracking-[0.18em]">Yukti Smart HRMS</span>
                    </Link>
                    <nav className="flex items-center gap-2 sm:gap-3">
                        <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100 sm:px-4">
                            Sign in
                        </Link>
                        <Link to="/register" className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-black text-white shadow-sm hover:bg-black sm:px-4">
                            Start trial
                            <ArrowRight className="hidden h-4 w-4 sm:block" />
                        </Link>
                    </nav>
                </div>
            </header>

            <section className="relative min-h-[92vh] overflow-hidden bg-slate-50 px-5 pb-14 pt-28 text-slate-950 lg:px-8">
                <ProductBackdrop />
                <div className="relative z-10 mx-auto flex min-h-[calc(92vh-7rem)] max-w-7xl flex-col justify-center">
                    <div className="max-w-3xl">
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                            <Building2 className="h-4 w-4" />
                            Yukti Smart HRMS payroll SaaS
                        </div>
                        <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                            Payroll, attendance, compliance, and subscriptions in one client workspace.
                        </h1>
                        <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-600">
                            Give every client company a clean trial path, a secure tenant workspace, and the HR/payroll workflows needed to move from onboarding to paid subscription.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-lg shadow-slate-200 hover:bg-black">
                                Create company trial
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link to="/login" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
                                Existing client login
                            </Link>
                        </div>
                        <div className="mt-8 grid gap-3 sm:grid-cols-2">
                            {proofPoints.map((point) => (
                                <div key={point} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    {point}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="mx-auto -mt-5 grid max-w-7xl gap-5 px-5 pb-14 lg:grid-cols-4 lg:px-8">
                {moduleCards.map(({ icon: Icon, title, body }) => (
                    <article key={title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Icon className="h-5 w-5" />
                        </span>
                        <h2 className="mt-5 text-lg font-black text-slate-950">{title}</h2>
                        <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{body}</p>
                    </article>
                ))}
            </section>

            <section className="border-t border-slate-200 bg-white px-5 py-12 lg:px-8">
                <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Built for SaaS operations</p>
                        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Start clients on trial, then manage billing without leaving payroll.</h2>
                        <p className="mt-4 text-sm font-medium leading-6 text-slate-600">
                            The app now has a public entry point, trial registration, subscription status, billing pages, and admin-only operational modules.
                        </p>
                    </div>
                    <div className="grid gap-3">
                        <Capability icon={ShieldCheck} text="Tenant-safe company and branch workspace" />
                        <Capability icon={BarChart3} text="Admin dashboard, analytics, and reports" />
                        <Capability icon={CreditCard} text="Subscription management and invoice billing" />
                    </div>
                </div>
            </section>
        </main>
    )
}

const ProductBackdrop = () => (
    <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(37,99,235,.16),transparent_34%),linear-gradient(120deg,#f8fafc_0%,#eff6ff_50%,#f1f5f9_100%)]" />
        <div className="absolute right-[-120px] top-28 hidden w-[760px] rotate-[-5deg] opacity-95 lg:block">
            <div className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-2xl shadow-blue-100/80">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Workspace</p>
                        <p className="text-lg font-black text-slate-950">Acme Technologies Pvt Ltd</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">Trialing</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                    <MockMetric label="Employees" value="128" tone="blue" />
                    <MockMetric label="Attendance" value="94%" tone="emerald" />
                    <MockMetric label="Payroll" value="Ready" tone="amber" />
                    <MockMetric label="Billing" value="INR 16.5k" tone="slate" />
                </div>
                <div className="mt-4 grid grid-cols-[1fr_280px] gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-4 flex items-center justify-between">
                            <p className="text-sm font-black text-slate-950">Current Payroll Cycle</p>
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black text-blue-700">Active</span>
                        </div>
                        <MockBar label="Attendance synced" value="100%" width="100%" />
                        <MockBar label="Salary calculation" value="72%" width="72%" />
                        <MockBar label="Compliance review" value="88%" width="88%" />
                        <MockBar label="Payslip publish" value="35%" width="35%" />
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-black text-slate-950">Action Needed</p>
                        <div className="mt-4 space-y-3">
                            <MockTask title="Finalize payroll" tag="High" />
                            <MockTask title="Review PT filing" tag="Medium" />
                            <MockTask title="Issue invoice" tag="Billing" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-slate-50 via-slate-50/92 to-slate-50/20" />
    </div>
)

const MockMetric = ({ label, value, tone }) => {
    const tones = {
        blue: 'bg-blue-50 text-blue-700',
        emerald: 'bg-emerald-50 text-emerald-700',
        amber: 'bg-amber-50 text-amber-700',
        slate: 'bg-slate-100 text-slate-700'
    }

    return (
        <div className={`rounded-xl p-4 ${tones[tone]}`}>
            <p className="text-xl font-black">{value}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-wider opacity-70">{label}</p>
        </div>
    )
}

const MockBar = ({ label, value, width }) => (
    <div className="mb-4 last:mb-0">
        <div className="mb-2 flex items-center justify-between text-xs font-black text-slate-600">
            <span>{label}</span>
            <span>{value}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-blue-600" style={{ width }} />
        </div>
    </div>
)

const MockTask = ({ title, tag }) => (
    <div className="flex items-center justify-between rounded-lg bg-white p-3">
        <span className="text-xs font-black text-slate-700">{title}</span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">{tag}</span>
    </div>
)

const Capability = ({ icon: Icon, text }) => (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
            <Icon className="h-5 w-5" />
        </span>
        <p className="text-sm font-black text-slate-800">{text}</p>
    </div>
)
