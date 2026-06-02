import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
    Building, 
    Lock, 
    Shield, 
    CheckCircle, 
    ArrowRight, 
    ArrowLeft, 
    AlertCircle, 
    Sparkles,
    Loader2,
    Mail
} from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

const fallbackPlans = [
    {
        id: 'starter-fallback',
        plan_code: 'starter',
        name: 'Starter',
        description: 'Core payroll and HR for small teams.',
        monthly_price: 2999,
        annual_price: 29990,
        price_per_employee: 149,
        max_employees: 50,
        features: ['Payroll processing', 'Attendance', 'Employee portal', 'Statutory reports']
    },
    {
        id: 'growth-fallback',
        plan_code: 'growth',
        name: 'Growth',
        description: 'Multi-branch payroll with analytics and integrations.',
        monthly_price: 7999,
        annual_price: 79990,
        price_per_employee: 129,
        max_employees: 250,
        features: ['Everything in Starter', 'Multi-company', 'Analytics', 'Biometric import']
    },
    {
        id: 'enterprise-fallback',
        plan_code: 'enterprise',
        name: 'Enterprise',
        description: 'Advanced controls for larger organizations.',
        monthly_price: 19999,
        annual_price: 199990,
        price_per_employee: 99,
        max_employees: null,
        features: ['Everything in Growth', '2FA controls', 'Audit logs', 'Priority support']
    }
]

export default function Register() {
    const navigate = useNavigate()
    const toast = useToast()
    const { user, loading: authLoading, isAdmin, twoFactorChallenge, isTwoFactorVerified } = useAuth()
    
    // Core Multi-Step State
    const [step, setStep] = useState(1) // 1: User Account, 2: Company Details, 3: Plan & Billing, 4: Provisioning Workspace
    const [loading, setLoading] = useState(false)
    const [setupError, setSetupError] = useState('')
    const [isCompleted, setIsCompleted] = useState(false)
    const [plans, setPlans] = useState([])

    // Step 1: User Account State
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    
    // Step 2: Company Details State
    const [companyName, setCompanyName] = useState('')
    const [companyCode, setCompanyCode] = useState('')

    // Step 3: Plan Selection
    const [selectedPlanCode, setSelectedPlanCode] = useState('growth')
    const [billingModel, setBillingModel] = useState('per_employee')

    const [errors, setErrors] = useState({})
    const [setupProgress, setSetupProgress] = useState([])

    useEffect(() => {
        const pendingTwoFactor = user && twoFactorChallenge?.userId === user.id && !isTwoFactorVerified(user.id)
        if (!authLoading && user && !pendingTwoFactor) {
            navigate(isAdmin ? '/dashboard' : '/portal', { replace: true })
        }
    }, [authLoading, user, isAdmin, twoFactorChallenge, isTwoFactorVerified, navigate])

    // Fetch subscription plans on load
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const { data, error } = await supabase
                    .from('subscription_plans')
                    .select('*')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true })
                if (!error && data?.length) {
                    setPlans(data)
                } else {
                    setPlans(fallbackPlans)
                }
            } catch (e) {
                console.error('Failed to load plans:', e)
                setPlans(fallbackPlans)
            }
        }
        fetchPlans()
    }, [])

    const updateProgress = (index, status) => {
        setSetupProgress(prev => prev.map((item, i) => i === index ? { ...item, status } : item))
    }

    const validateStep1 = () => {
        const newErrors = {}
        if (!firstName.trim()) newErrors.firstName = 'First name is required'
        if (!lastName.trim()) newErrors.lastName = 'Last name is required'
        if (!email.trim()) newErrors.email = 'Valid email address is required'
        if (password.length < 8) newErrors.password = 'Password must be at least 8 characters'
        if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match'

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            return false
        }
        setErrors({})
        return true
    }

    const validateStep2 = () => {
        const newErrors = {}
        if (!companyName.trim()) newErrors.companyName = 'Company name is required'
        if (!companyCode.trim()) newErrors.companyCode = 'Company code is required'
        else if (companyCode.trim().length < 2) newErrors.companyCode = 'Company code must be at least 2 characters'

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            return false
        }
        setErrors({})
        return true
    }

    const handleNextStep = (e) => {
        e.preventDefault()
        if (step === 1 && validateStep1()) {
            setStep(2)
        } else if (step === 2 && validateStep2()) {
            setStep(3)
        }
    }

    const handleBackStep = () => {
        if (step > 1) {
            setStep(step - 1)
        }
    }

    const handleRegister = async (e) => {
        e.preventDefault()
        setErrors({})
        setSetupError('')
        setStep(4)

        setSetupProgress([
            { label: 'Creating confirmed administrator login...', status: 'pending' },
            { label: 'Registering tenant company workspace...', status: 'pending' },
            { label: 'Activating 14-day SaaS trial subscription...', status: 'pending' },
            { label: 'Signing you into the new workspace...', status: 'pending' }
        ])

        try {
            updateProgress(0, 'in_progress')
            const { data: registrationData, error: registrationError } = await supabase.functions.invoke('register-company', {
                body: {
                    companyName: companyName.trim(),
                    companyCode: companyCode.trim().toUpperCase(),
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    email: email.trim(),
                    password,
                    planCode: selectedPlanCode,
                    billingModel
                }
            })
            if (registrationError) throw registrationError
            if (registrationData?.error) throw new Error(registrationData.error)
            updateProgress(0, 'completed')

            updateProgress(1, 'in_progress')
            updateProgress(2, 'in_progress')
            updateProgress(1, 'completed')
            updateProgress(2, 'completed')

            updateProgress(3, 'in_progress')

            if (registrationData?.company_id) {
                window.localStorage.setItem('payroll_active_company_id', registrationData.company_id)
            }
            if (registrationData?.branch_id) {
                window.localStorage.setItem('payroll_active_branch_id', registrationData.branch_id)
            }

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password
            })

            if (signInError) {
                throw new Error(`Workspace created, but automatic sign-in failed: ${signInError.message}`)
            }

            setTimeout(() => {
                updateProgress(3, 'completed')
                setIsCompleted(true)
                toast.success('Your corporate workspace setup is complete!')
            }, 1500)

        } catch (err) {
            console.error('Registration failed:', err)
            const message = err.message || 'Onboarding failed due to system exception.'
            setSetupError(message)
            setStep(message.toLowerCase().includes('company code') ? 2 : 3)
        }
    }

    const currentPlanDetails = plans.find(p => p.plan_code === selectedPlanCode)

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,.12),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_42%,#f8fafc_100%)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-80 border-b border-slate-200 bg-white/80 backdrop-blur">
                <div className="max-w-7xl mx-auto px-4 py-8 flex justify-between items-center text-slate-500">
                    <Link to="/" className="text-lg font-black text-slate-950 tracking-widest uppercase">Yukti Smart HRMS</Link>
                    <div className="flex items-center gap-4">
                        <Link to="/" className="text-xs font-bold text-slate-600 hover:text-slate-950 uppercase tracking-wider">Home</Link>
                        <Link to="/login" className="text-xs font-bold text-blue-700 hover:text-blue-900 uppercase tracking-wider">Sign In</Link>
                    </div>
                </div>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 pt-4">
                <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 px-4 py-1.5 rounded-full text-blue-700 text-xs font-black uppercase tracking-widest mb-4">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Free 14-Day Corporate Trial</span>
                </div>
                <h1 className="text-3xl font-black text-slate-950 tracking-tight sm:text-4xl">Register Your Enterprise</h1>
                <p className="mt-2 text-sm font-medium text-slate-600">Launch a multi-company dynamic payroll workspace for your organization in seconds.</p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl z-10">
                <div className="bg-white/95 border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-xl shadow-blue-100/60 relative">
                    
                    {/* Error Box */}
                    {setupError && (
                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-start space-x-3 text-rose-700 mb-6">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <p className="text-xs font-black uppercase tracking-wider leading-relaxed">{setupError}</p>
                        </div>
                    )}

                    {/* Progress indicator steps header */}
                    {step < 4 && (
                        <div className="flex items-center justify-between mb-8 border-b border-gray-200 pb-5">
                            <div className="flex items-center space-x-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>1</span>
                                <span className={`text-xs font-bold ${step === 1 ? 'text-slate-950' : 'text-slate-500'}`}>Profile</span>
                            </div>
                            <div className="h-px bg-gray-200 flex-1 mx-2"></div>
                            <div className="flex items-center space-x-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>2</span>
                                <span className={`text-xs font-bold ${step === 2 ? 'text-slate-950' : 'text-slate-500'}`}>Company</span>
                            </div>
                            <div className="h-px bg-gray-200 flex-1 mx-2"></div>
                            <div className="flex items-center space-x-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 3 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>3</span>
                                <span className={`text-xs font-bold ${step === 3 ? 'text-slate-950' : 'text-slate-500'}`}>Plan & Subscription</span>
                            </div>
                        </div>
                    )}

                    {/* Step 1: User Account Form */}
                    {step === 1 && (
                        <form onSubmit={handleNextStep} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">First Name *</label>
                                    <input 
                                        type="text"
                                        required
                                        placeholder="John"
                                        value={firstName}
                                        onChange={e => setFirstName(e.target.value)}
                                        className={`w-full rounded-xl bg-slate-50 border px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.firstName ? 'border-rose-500' : 'border-gray-200'}`}
                                    />
                                    {errors.firstName && <p className="text-rose-500 text-[10px] font-bold uppercase mt-1">{errors.firstName}</p>}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Last Name *</label>
                                    <input 
                                        type="text"
                                        required
                                        placeholder="Doe"
                                        value={lastName}
                                        onChange={e => setLastName(e.target.value)}
                                        className={`w-full rounded-xl bg-slate-50 border px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.lastName ? 'border-rose-500' : 'border-gray-200'}`}
                                    />
                                    {errors.lastName && <p className="text-rose-500 text-[10px] font-bold uppercase mt-1">{errors.lastName}</p>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Admin Email Address *</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input 
                                        type="email"
                                        required
                                        placeholder="e.g., admin@acme.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className={`w-full rounded-xl bg-slate-50 border pl-12 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-rose-500' : 'border-gray-200'}`}
                                    />
                                </div>
                                {errors.email && <p className="text-rose-500 text-[10px] font-bold uppercase mt-1">{errors.email}</p>}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Create Password *</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                        <input 
                                            type="password"
                                            required
                                            placeholder="Min 8 chars"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            className={`w-full rounded-xl bg-slate-50 border pl-12 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.password ? 'border-rose-500' : 'border-gray-200'}`}
                                        />
                                    </div>
                                    {errors.password && <p className="text-rose-500 text-[10px] font-bold uppercase mt-1">{errors.password}</p>}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Confirm Password *</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                        <input 
                                            type="password"
                                            required
                                            placeholder="Confirm password"
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            className={`w-full rounded-xl bg-slate-50 border pl-12 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.confirmPassword ? 'border-rose-500' : 'border-gray-200'}`}
                                        />
                                    </div>
                                    {errors.confirmPassword && <p className="text-rose-500 text-[10px] font-bold uppercase mt-1">{errors.confirmPassword}</p>}
                                </div>
                            </div>

                            <button 
                                type="submit"
                                className="w-full py-3.5 bg-slate-950 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-slate-200 flex items-center justify-center space-x-2 uppercase tracking-widest cursor-pointer mt-6"
                            >
                                <span>Continue: Workspace Setup</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </form>
                    )}

                    {/* Step 2: Company Setup Form */}
                    {step === 2 && (
                        <form onSubmit={handleNextStep} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Legal Company Name *</label>
                                <div className="relative">
                                    <Building className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input 
                                        type="text"
                                        required
                                        placeholder="e.g., Acme Technologies Pvt Ltd"
                                        value={companyName}
                                        onChange={e => setCompanyName(e.target.value)}
                                        className={`w-full rounded-xl bg-slate-50 border pl-12 pr-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.companyName ? 'border-rose-500' : 'border-gray-200'}`}
                                    />
                                </div>
                                {errors.companyName && <p className="text-rose-500 text-[10px] font-bold uppercase mt-1">{errors.companyName}</p>}
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Workspace Unique Code *</label>
                                <div className="relative">
                                    <Shield className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input 
                                        type="text"
                                        required
                                        maxLength={10}
                                        placeholder="e.g., ACME"
                                        value={companyCode}
                                        onChange={e => setCompanyCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                                        className={`w-full rounded-xl bg-slate-50 border pl-12 pr-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase ${errors.companyCode ? 'border-rose-500' : 'border-gray-200'}`}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5">Short code for company login subdomains & compliance forms</p>
                                {errors.companyCode && <p className="text-rose-500 text-[10px] font-bold uppercase mt-1">{errors.companyCode}</p>}
                            </div>

                            <div className="flex gap-2 justify-end pt-4">
                                <button 
                                    type="button" 
                                    onClick={handleBackStep}
                                    className="px-4 py-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-3.5 bg-slate-950 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-slate-200 flex items-center justify-center space-x-2 uppercase tracking-widest cursor-pointer"
                                >
                                    <span>Select Free Plan</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Step 3: Choose Plan & Subscription Model */}
                    {step === 3 && (
                        <form onSubmit={handleRegister} className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2.5">Choose Plan Tier</label>
                                <div className="space-y-2.5">
                                    {plans.map(p => (
                                        <button 
                                            key={p.id}
                                            type="button"
                                            onClick={() => setSelectedPlanCode(p.plan_code)}
                                            className={`w-full text-left border rounded-xl p-3.5 flex items-center justify-between transition ${selectedPlanCode === p.plan_code ? 'border-blue-500 bg-blue-50/40 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-300'}`}
                                        >
                                            <div>
                                                <h4 className="font-black text-slate-900 text-sm">{p.name}</h4>
                                                <p className="text-[10px] text-slate-500 mt-0.5">{p.description}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-slate-900 text-sm">
                                                    INR {p.monthly_price}<span className="text-[10px] text-slate-500">/mo flat</span>
                                                </p>
                                                <p className="text-[9px] font-bold text-blue-600 mt-0.5">
                                                    OR INR {p.price_per_employee}/emp/mo
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2.5">Trial Billing Calculation Model</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        type="button" 
                                        onClick={() => setBillingModel('per_employee')}
                                        className={`border rounded-xl p-3 flex flex-col text-left transition ${billingModel === 'per_employee' ? 'border-blue-500 bg-blue-50/40' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                                    >
                                        <span className="font-black text-slate-900 text-xs">Per Employee</span>
                                        <span className="text-[9px] text-slate-500 mt-0.5">INR {currentPlanDetails?.price_per_employee || 129}/emp/mo. Pay for active headcount.</span>
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setBillingModel('flat')}
                                        className={`border rounded-xl p-3 flex flex-col text-left transition ${billingModel === 'flat' ? 'border-blue-500 bg-blue-50/40' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                                    >
                                        <span className="font-black text-slate-900 text-xs">Flat Monthly</span>
                                        <span className="text-[9px] text-slate-500 mt-0.5">INR {currentPlanDetails?.monthly_price || 7999}/mo flat fee regardless.</span>
                                    </button>
                                </div>
                            </div>

                            {/* Plan detail preview snippet */}
                            {currentPlanDetails && (
                                <div className="bg-blue-50 border border-blue-100 rounded-xl text-slate-700 p-4 text-xs space-y-2">
                                    <div className="flex items-center justify-between text-slate-500">
                                        <span>Activation Plan:</span>
                                        <span className="font-bold text-slate-950 uppercase">{currentPlanDetails.name} Tier</span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-500">
                                        <span>Included Trial Days:</span>
                                        <span className="font-bold text-slate-950">14 Days Free</span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-500">
                                        <span>Capacity Limit:</span>
                                        <span className="font-bold text-slate-950">{currentPlanDetails.max_employees || 'Unlimited'} Employees</span>
                                    </div>
                                    <div className="border-t border-blue-100 my-1 pt-1.5 flex items-center justify-between font-black text-blue-700">
                                        <span>Estimated Cost Post-Trial:</span>
                                        <span>
                                            {billingModel === 'per_employee' 
                                                ? `INR ${currentPlanDetails.price_per_employee}/emp/mo`
                                                : `INR ${currentPlanDetails.monthly_price}/mo flat`
                                            }
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                                <button 
                                    type="button" 
                                    onClick={handleBackStep}
                                    className="px-4 py-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-3.5 bg-slate-950 hover:bg-black text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-slate-200 flex items-center justify-center space-x-2 uppercase tracking-widest cursor-pointer"
                                >
                                    <span>Provision Trial Workspace</span>
                                    <Sparkles className="w-4 h-4" />
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Step 4: Loading & Success Provisioning Progress */}
                    {step === 4 && (
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
                                    onClick={() => navigate('/dashboard')}
                                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-lg flex items-center justify-center space-x-2 uppercase tracking-widest cursor-pointer mt-8"
                                >
                                    <span>Enter Corporate Dashboard</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
