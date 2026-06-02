import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
    Building, 
    User, 
    Lock, 
    Shield, 
    CheckCircle, 
    ArrowRight, 
    ArrowLeft, 
    AlertCircle, 
    Sparkles,
    Loader2
} from 'lucide-react'
import { useToast } from '../context/ToastContext'

export default function SetupWizard() {
    const navigate = useNavigate()
    const toast = useToast()
    
    // Core Wizard State
    const [step, setStep] = useState(1) // 1: Checking, 2: Company, 3: Admin, 4: Progress
    const [loading, setLoading] = useState(true)
    const [isEligible, setIsEligible] = useState(false)
    const [setupError, setSetupError] = useState('')
    const [isCompleted, setIsCompleted] = useState(false)
    
    // Form Inputs
    const [companyName, setCompanyName] = useState('')
    const [companyCode, setCompanyCode] = useState('')
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [errors, setErrors] = useState({})
    
    // Setup Progress Tracking
    const [setupProgress, setSetupProgress] = useState([])

    // Verify first-run status on boot
    useEffect(() => {
        const detectFirstRun = async () => {
            try {
                // 1. Try RPC check
                const { data: firstRunRpc, error: rpcErr } = await supabase.rpc('is_first_run')
                if (!rpcErr && firstRunRpc !== null) {
                    if (firstRunRpc === true) {
                        setIsEligible(true)
                        setStep(2)
                    } else {
                        setIsEligible(false)
                        setStep(1) // Lockdown state
                    }
                    setLoading(false)
                    return
                }

                // 2. Direct query fallback
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('role', 'admin')
                    .limit(1)

                if (!error) {
                    if (!data || data.length === 0) {
                        setIsEligible(true)
                        setStep(2)
                    } else {
                        setIsEligible(false)
                        setStep(1)
                    }
                } else {
                    const { count } = await supabase
                        .from('profiles')
                        .select('id', { count: 'exact', head: true })
                    if (count === 0) {
                        setIsEligible(true)
                        setStep(2)
                    } else {
                        setIsEligible(false)
                        setStep(1)
                    }
                }
            } catch (e) {
                console.error('First run check failed:', e)
                setIsEligible(false)
                setStep(1)
            } finally {
                setLoading(false)
            }
        }
        detectFirstRun()
    }, [])

    const updateProgress = (index, status) => {
        setSetupProgress(prev => prev.map((item, i) => i === index ? { ...item, status } : item))
    }

    const getFunctionErrorMessage = async (error) => {
        if (!error) return ''

        try {
            const response = error.context
            if (response && typeof response.json === 'function') {
                const body = await response.clone().json()
                if (body?.error) return body.error
            }
        } catch {
            // Fall back to the SDK message below.
        }

        if (error.message?.includes('Failed to send a request')) {
            return 'Setup service is not deployed. Deploy the setup-company Supabase function and try again.'
        }

        return error.message || 'Company setup service failed.'
    }

    const handleNextStep = (e) => {
        e.preventDefault()
        const newErrors = {}
        if (!companyName.trim()) newErrors.companyName = 'Company Name is required'
        if (!companyCode.trim()) newErrors.companyCode = 'Company Code is required'
        else if (companyCode.trim().length < 2) newErrors.companyCode = 'Company Code must be at least 2 characters'

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            return
        }
        setErrors({})
        setStep(3)
    }

    const handleInitialize = async (e) => {
        e.preventDefault()
        setErrors({})
        setSetupError('')

        const newErrors = {}
        if (!firstName.trim()) newErrors.firstName = 'First Name is required'
        if (!lastName.trim()) newErrors.lastName = 'Last Name is required'
        if (!email.trim()) newErrors.email = 'Email Address is required'
        if (password.length < 6) newErrors.password = 'Password must be at least 6 characters'
        if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match'

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            return
        }

        setStep(4)
        setSetupProgress([
            { label: 'Creating Master Authentication Account...', status: 'pending' },
            { label: 'Creating Company Payroll Workspace...', status: 'pending' },
            { label: 'Assigning Payroll Admin Permissions...', status: 'pending' },
            { label: 'Finalizing Payroll Management Dashboard...', status: 'pending' }
        ])

        try {
            // Step 1: Create the initial admin through the first-run setup function.
            updateProgress(0, 'in_progress')
            const { data: setupData, error: setupFunctionErr } = await supabase.functions.invoke('setup-company', {
                body: {
                    companyName: companyName.trim(),
                    companyCode: companyCode.trim().toUpperCase(),
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    email: email.trim(),
                    password
                }
            })

            if (setupFunctionErr) {
                throw new Error(await getFunctionErrorMessage(setupFunctionErr))
            }

            if (!setupData?.success) {
                throw new Error(setupData?.error || 'Company setup service did not complete.')
            }

            updateProgress(0, 'completed')
            updateProgress(1, 'completed')
            updateProgress(2, 'completed')

            // Step 4: Finalize dashboard
            updateProgress(3, 'in_progress')
            setTimeout(() => {
                updateProgress(3, 'completed')
                setIsCompleted(true)
                toast.success('Master administrator onboarding complete!')
            }, 1500)

        } catch (err) {
            console.error('Setup failed:', err)
            setSetupError(err.message || 'An error occurred during onboarding.')
            setStep(3) // Let them edit details and try again
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <Loader2 className="w-12 h-12 text-slate-900 animate-spin mb-4" />
                <p className="text-slate-500 font-medium text-sm tracking-wider uppercase">Checking payroll setup status...</p>
            </div>
        )
    }

    // Step 1: Locked Out / Not Eligible
    if (step === 1 && !isEligible) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
                <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-xl">
                    <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 mx-auto mb-6 border border-rose-100">
                        <Shield className="w-8 h-8" />
                    </div>
                    
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Payroll Setup Complete</h2>
                    <p className="text-slate-500 text-sm mt-3 leading-relaxed">
                        This payroll management workspace has already been configured. For security reasons, the setup wizard is locked after the first admin is created.
                    </p>
                    
                    <button 
                        onClick={() => navigate('/login')}
                        className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-lg mt-8 uppercase tracking-widest"
                    >
                        Go to Sign In
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-72 bg-slate-100/80 border-b border-gray-200"></div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
                <div className="inline-flex items-center space-x-2 bg-slate-100 border border-gray-200 px-4 py-1.5 rounded-full text-slate-800 text-xs font-black uppercase tracking-widest mb-6">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Payroll Management Setup</span>
                </div>
                <h1 className="text-3xl font-black text-slate-950 tracking-tight sm:text-4xl">System Configuration</h1>
                <p className="mt-2 text-sm text-slate-600">Create your company workspace and first payroll administrator.</p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl z-10">
                <div className="bg-white border border-gray-200 rounded-2xl p-8 sm:p-10 shadow-xl relative">
                    {/* Error Banner */}
                    {setupError && (
                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-start space-x-3 text-rose-700 mb-6">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <p className="text-xs font-bold uppercase">{setupError}</p>
                        </div>
                    )}

                    {/* Step Indicators */}
                    {step < 4 && (
                        <div className="flex items-center justify-between mb-8 border-b border-gray-200 pb-5">
                            <div className="flex items-center space-x-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>1</span>
                                <span className={`text-xs font-bold ${step === 2 ? 'text-slate-950' : 'text-slate-500'}`}>Company Setup</span>
                            </div>
                            <div className="h-px bg-gray-200 flex-1 mx-4"></div>
                            <div className="flex items-center space-x-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 3 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>2</span>
                                <span className={`text-xs font-bold ${step === 3 ? 'text-slate-950' : 'text-slate-500'}`}>Admin Account</span>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Company Setup Form */}
                    {step === 2 && (
                        <form onSubmit={handleNextStep} className="space-y-6">
                            <div>
                                <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Company Name *</label>
                                <div className="relative">
                                    <Building className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input 
                                        type="text"
                                        required
                                        placeholder="e.g. Acme Enterprise Solutions"
                                        value={companyName}
                                        onChange={e => setCompanyName(e.target.value)}
                                        className={`w-full rounded-xl bg-slate-50 border pl-12 pr-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 ${errors.companyName ? 'border-rose-500' : 'border-gray-200'}`}
                                    />
                                </div>
                                {errors.companyName && <p className="text-rose-500 text-[10px] font-bold uppercase mt-1.5">{errors.companyName}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Company Code *</label>
                                <div className="relative">
                                    <Shield className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input 
                                        type="text"
                                        required
                                        placeholder="e.g. ACME"
                                        value={companyCode}
                                        onChange={e => setCompanyCode(e.target.value)}
                                        className={`w-full rounded-xl bg-slate-50 border pl-12 pr-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 uppercase ${errors.companyCode ? 'border-rose-500' : 'border-gray-200'}`}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1.5">Short unique identifier for compliance forms</p>
                                {errors.companyCode && <p className="text-rose-500 text-[10px] font-bold uppercase mt-1.5">{errors.companyCode}</p>}
                            </div>

                            <button 
                                type="submit"
                                className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center space-x-2 uppercase tracking-widest cursor-pointer mt-8"
                            >
                                <span>Next: Admin Account</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </form>
                    )}

                    {/* Step 3: Admin Account Form */}
                    {step === 3 && (
                        <form onSubmit={handleInitialize} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">First Name *</label>
                                    <input 
                                        type="text"
                                        required
                                        placeholder="John"
                                        value={firstName}
                                        onChange={e => setFirstName(e.target.value)}
                                        className={`w-full rounded-xl bg-slate-50 border px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 ${errors.firstName ? 'border-rose-500' : 'border-gray-200'}`}
                                    />
                                    {errors.firstName && <p className="text-rose-500 text-[10px] font-bold uppercase mt-1.5">{errors.firstName}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Last Name *</label>
                                    <input 
                                        type="text"
                                        required
                                        placeholder="Doe"
                                        value={lastName}
                                        onChange={e => setLastName(e.target.value)}
                                        className={`w-full rounded-xl bg-slate-50 border px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 ${errors.lastName ? 'border-rose-500' : 'border-gray-200'}`}
                                    />
                                    {errors.lastName && <p className="text-rose-500 text-[10px] font-bold uppercase mt-1.5">{errors.lastName}</p>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Admin Email Address *</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input 
                                        type="email"
                                        required
                                        placeholder="admin@yourcompany.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className={`w-full rounded-xl bg-slate-50 border pl-12 pr-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 ${errors.email ? 'border-rose-500' : 'border-gray-200'}`}
                                    />
                                </div>
                                {errors.email && <p className="text-rose-500 text-[10px] font-bold uppercase mt-1.5">{errors.email}</p>}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Create Password *</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input 
                                            type="password"
                                            required
                                            placeholder="Min 6 chars"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            className={`w-full rounded-xl bg-slate-50 border pl-12 pr-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 ${errors.password ? 'border-rose-500' : 'border-gray-200'}`}
                                        />
                                    </div>
                                    {errors.password && <p className="text-rose-500 text-[10px] font-bold uppercase mt-1.5">{errors.password}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Confirm Password *</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input 
                                            type="password"
                                            required
                                            placeholder="Confirm"
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            className={`w-full rounded-xl bg-slate-50 border pl-12 pr-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 ${errors.confirmPassword ? 'border-rose-500' : 'border-gray-200'}`}
                                        />
                                    </div>
                                    {errors.confirmPassword && <p className="text-rose-500 text-[10px] font-bold uppercase mt-1.5">{errors.confirmPassword}</p>}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-200">
                                <button 
                                    type="button"
                                    onClick={() => setStep(2)}
                                    className="py-4 px-6 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 uppercase tracking-widest border border-gray-300"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span>Back</span>
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center space-x-2 uppercase tracking-widest cursor-pointer"
                                >
                                    <span>Onboard & Initialize</span>
                                    <Sparkles className="w-4 h-4" />
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Step 4: Loading & Success Progress */}
                    {step === 4 && (
                        <div className="space-y-6 py-4">
                            <div className="text-center mb-6">
                                {isCompleted ? (
                                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mx-auto mb-4 border border-emerald-100 scale-110 animate-bounce">
                                        <CheckCircle className="w-8 h-8" />
                                    </div>
                                ) : (
                                    <Loader2 className="w-12 h-12 text-slate-900 animate-spin mx-auto mb-4" />
                                )}
                                <h3 className="text-xl font-bold text-slate-950">{isCompleted ? 'Setup Complete!' : 'Initializing Payroll...'}</h3>
                                <p className="text-xs text-slate-500 mt-1.5">{isCompleted ? 'Your payroll management workspace is configured.' : 'Creating your company, admin account, and payroll workspace.'}</p>
                            </div>

                            <div className="space-y-3 bg-slate-50 p-6 rounded-xl border border-gray-200">
                                {setupProgress.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <span className={`font-medium ${item.status === 'completed' ? 'text-slate-400 line-through' : item.status === 'in_progress' ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>{item.label}</span>
                                        <span className="flex items-center shrink-0">
                                            {item.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                                            {item.status === 'in_progress' && <Loader2 className="w-4 h-4 text-slate-900 animate-spin" />}
                                            {item.status === 'pending' && <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {isCompleted && (
                                <button 
                                    onClick={() => navigate('/login')}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center space-x-2 uppercase tracking-widest cursor-pointer mt-8"
                                >
                                    <span>Proceed to Sign In</span>
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
