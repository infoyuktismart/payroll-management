import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Lock, Mail, User, BadgeCheck, AlertCircle, KeyRound, CheckCircle, Users, Briefcase, TrendingUp } from 'lucide-react'

const hrImages = [
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=600&fit=crop',
]

function ImageCarousel() {
    const [currentIndex, setCurrentIndex] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % hrImages.length)
        }, 4000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="relative w-full h-full overflow-hidden">
            {hrImages.map((img, idx) => (
                <div
                    key={idx}
                    className={`absolute inset-0 transition-all duration-1000 ease-in-out ${idx === currentIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
                >
                    <img src={img} alt="HR Management" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent" />
                </div>
            ))}
            <div className="absolute bottom-8 left-8 right-8">
                <div className="flex space-x-2">
                    {hrImages.map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-1 flex-1 rounded-full transition-all duration-500 ${idx === currentIndex ? 'bg-white' : 'bg-white/30'}`}
                        />
                    ))}
                </div>
            </div>
            <div className="absolute top-8 left-8">
                <h2 className="text-3xl font-bold text-white">HR Management System</h2>
                <p className="text-white/80 mt-2">Streamline your workforce with ease</p>
            </div>
            <div className="absolute bottom-8 left-8 right-8 grid grid-cols-3 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                    <Users className="w-6 h-6 text-white mx-auto mb-2" />
                    <p className="text-white text-sm font-medium">Employee Management</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                    <Briefcase className="w-6 h-6 text-white mx-auto mb-2" />
                    <p className="text-white text-sm font-medium">Payroll Processing</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                    <TrendingUp className="w-6 h-6 text-white mx-auto mb-2" />
                    <p className="text-white text-sm font-medium">Analytics & Reports</p>
                </div>
            </div>
        </div>
    )
}

function LoginForm({ onSwitchToSignup }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const { signIn } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const { error: signInError } = await signIn({ email, password })
            if (signInError) throw signInError

            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                const { data: employee } = await supabase
                    .from('employees')
                    .select('role')
                    .eq('user_id', user.id)
                    .single()

                const role = employee?.role?.toLowerCase()?.trim() || ''
                const isAdminRole = [
                    'admin', 'hr', 'hr_manager', 'hr_admin',
                    'hr manager', 'hr-admin', 'hr-manager',
                    'hr_admin_manager', 'hr administrator',
                    'administrator', 'superadmin', 'hr_head',
                    'hr_executive', 'human resources'
                ].includes(role)

                if (isAdminRole) {
                    navigate('/')
                } else {
                    navigate('/portal')
                }
            } else {
                navigate('/')
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 text-sm">
                    {error}
                </div>
            )}
            <div>
                <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
            </div>

            <div>
                <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">Password</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        id="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        minLength={8}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex items-center justify-end">
                <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
                    Forgot password?
                </Link>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="text-center">
                <span className="text-gray-500">Don't have an account? </span>
                <button type="button" onClick={onSwitchToSignup} className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    Sign up
                </button>
            </div>
        </form>
    )
}

function SignupForm({ onSwitchToLogin }) {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    const [employeeId, setEmployeeId] = useState('')
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    useEffect(() => {
        const cleanSlate = async () => {
            await supabase.auth.signOut()
        }
        cleanSlate()
    }, [])

    const validatePassword = () => {
        if (password !== confirmPassword) {
            throw new Error('Passwords do not match')
        }
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters')
        }
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            throw new Error('Password must include uppercase, lowercase, and number')
        }
    }

    const handleVerifyAndSendOtp = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const { data: verifyData, error: verifyError } = await supabase
                .rpc('verify_signup_eligibility', {
                    p_employee_id: employeeId.trim(),
                    p_email: email.trim()
                })

            if (verifyError || !verifyData?.valid) {
                console.error('Signup eligibility RPC failed:', verifyError || verifyData)
                const details = [verifyError?.message, verifyError?.details, verifyError?.hint]
                    .filter(Boolean)
                    .join(' ')
                throw new Error(details || verifyData?.message || 'Verification failed. Invalid ID or Email.')
            }

            const { error: otpError } = await supabase.auth.signInWithOtp({
                email: email.trim(),
                options: { shouldCreateUser: true }
            })

            if (otpError) throw otpError

            setMessage(`We sent a 6-digit verification code to ${email}. Check spam if it is not in your inbox.`)
            setStep(2)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyOtp = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const { error } = await supabase.auth.verifyOtp({
                email: email.trim(),
                token: otp.trim(),
                type: 'email'
            })

            if (error) throw error
            setStep(3)
            setMessage('Email verified! Please set your password.')
        } catch (err) {
            setError(err.message || 'Invalid OTP Code')
        } finally {
            setLoading(false)
        }
    }

    const handleSetPassword = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            validatePassword()

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Auth session missing')

            const { error: passwordError } = await supabase.auth.updateUser({ password })
            if (passwordError) throw passwordError

            const { error: linkError } = await supabase.rpc('complete_employee_signup', {
                p_employee_id: employeeId.trim(),
                p_email: email.trim()
            })

            if (linkError) throw new Error('Failed to link account. Please contact HR.')

            setMessage('Account created successfully! Redirecting to login...')
            setTimeout(() => {
                setStep(1)
                setMessage('')
                onSwitchToLogin()
            }, 2000)

        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-5">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            {message && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-lg text-sm flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 shrink-0 animate-bounce" />
                    <span>{message}</span>
                </div>
            )}
            {step === 1 && (
                <form onSubmit={handleVerifyAndSendOtp} className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Employee ID</label>
                        <div className="relative">
                            <BadgeCheck className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                required
                                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., EMP26001"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                            <input
                                type="email"
                                required
                                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="name@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {loading ? 'Verifying...' : 'Send Verification Code'}
                    </button>
                </form>
            )}

            {step === 2 && (
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Verification Code</label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                required
                                maxLength={8}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 tracking-widest text-lg"
                                placeholder="e.g., 12345678"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                            />
                        </div>
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {loading ? 'Verifying Code...' : 'Verify Email'}
                    </button>
                    <button type="button" onClick={() => setStep(1)} className="w-full text-sm text-gray-500 hover:text-gray-700">
                        Change Email
                    </button>
                </form>
            )}

            {step === 3 && (
                <form onSubmit={handleSetPassword} className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Create Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                            <input
                                type="password"
                                required
                                minLength={8}
                                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Confirm Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                            <input
                                type="password"
                                required
                                minLength={8}
                                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {loading ? 'Finalize Account...' : 'Create Account'}
                    </button>
                </form>
            )}

            <div className="text-center">
                <span className="text-gray-500">Already have an account? </span>
                <button type="button" onClick={onSwitchToLogin} className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    Sign in
                </button>
            </div>
        </div>
    )
}

export default function Login() {
    const [activeTab, setActiveTab] = useState('login')

    return (
        <div className="min-h-screen bg-slate-50 flex">
            <div className="hidden lg:block lg:w-1/2 bg-slate-900">
                <ImageCarousel />
            </div>

            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="max-w-md w-full">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                            <Users className="w-8 h-8 text-blue-600" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {activeTab === 'login' ? 'Welcome Back' : 'Employee Signup'}
                        </h1>
                        <p className="text-gray-500 mt-2">
                            {activeTab === 'login' ? 'Sign in to your account' : 'Verify your identity to get started'}
                        </p>
                    </div>

                    <div className="flex mb-8 bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setActiveTab('login')}
                            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-semibold transition-all ${activeTab === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => setActiveTab('signup')}
                            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-semibold transition-all ${activeTab === 'signup' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Sign Up
                        </button>
                    </div>

                    {(activeTab === 'login' || activeTab === 'signup') && (
                        <>
                            {activeTab === 'login' && (
                                <LoginForm onSwitchToSignup={() => setActiveTab('signup')} />
                            )}
                            {activeTab === 'signup' && (
                                <SignupForm onSwitchToLogin={() => setActiveTab('login')} />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
