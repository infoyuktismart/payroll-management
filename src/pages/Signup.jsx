import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { devLog } from '../lib/devLogger'
import { Lock, Mail, User, BadgeCheck, AlertCircle, KeyRound, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Signup() {
    devLog('Signup Component Rendered - Version: 4.0 (Fixes Applied)')
    // Steps: 1=Verify, 2=OTP, 3=Set Password
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    // Force Clean Slate on Mount
    // This prevents "Session from session_id claim does not exist" caused by stale tokens
    useEffect(() => {
        const cleanSlate = async () => {
            devLog('Signup: Cleaning up stale sessions...')
            await supabase.auth.signOut()
            localStorage.removeItem('sb-ssepsawjtwskjkdxsrgx-auth-token') // Try to clear strict key if possible, but signOut handles it
        }
        cleanSlate()
    }, [])

    // Form Data
    const [employeeId, setEmployeeId] = useState('')
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const sessionBackup = useRef(null)

    const navigate = useNavigate()

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

    // Step 1: Verify Eligibility & Send OTP
    const handleVerifyAndSendOtp = async (e) => {
        devLog('Signup: Starting Verification...')
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            // 1. Check Eligibility (Secure RPC)
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

            // 2. Send OTP
            const { error: otpError } = await supabase.auth.signInWithOtp({
                email: email.trim(),
                options: {
                    // This ensures we get a strict code, not a magic link
                    shouldCreateUser: true,
                }
            })

            if (otpError) throw otpError

            setMessage(`We sent a verification code to ${email}. Check spam if it is not in your inbox.`)
            setStep(2)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Step 2: Verify OTP
    const handleVerifyOtp = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email: email.trim(),
                token: otp.trim(),
                type: 'email'
            })

            if (error) throw error

            if (!data.session) {
                throw new Error('Verification failed. Session not created.')
            }

            // Capture Session for Resilience
            devLog('OTP Verified. Session Captured.')
            sessionBackup.current = data.session

            setStep(3)
            setMessage('Email verified! Please set your password.')
        } catch (err) {
            setError(err.message || 'Invalid OTP Code')
        } finally {
            setLoading(false)
        }
    }

    // Step 3: Set Password & Link Account
    const handleSetPassword = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            validatePassword()

            let userId = null

            // 1. Try standard update (Best Practice)
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    userId = user.id
                    const { error: passwordError } = await supabase.auth.updateUser({ password })
                    if (passwordError) throw passwordError
                } else {
                    throw new Error('Auth session missing')
                }
            } catch (authError) {
                console.warn('Standard auth failed, falling back to direct token usage:', authError.message)

                // 2. FALLBACK: Use captured session token directly against API
                if (sessionBackup.current?.access_token) {
                    const { access_token } = sessionBackup.current

                    // Manually call Supabase User Update API
                    // This bypasses the potentially stale internal client state
                    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/user`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${access_token}`,
                            'Content-Type': 'application/json',
                            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                        },
                        body: JSON.stringify({ password: password })
                    })

                    if (!response.ok) {
                        const errData = await response.json()
                        throw new Error(errData.msg || errData.message || 'Failed to set password via fallback')
                    }

                    const responseData = await response.json()
                    userId = responseData.id || responseData.data?.user?.id

                } else {
                    throw new Error('Session lost for good. Please restart signup.')
                }
            }

            if (!userId && sessionBackup.current?.user) {
                userId = sessionBackup.current.user.id
            }

            // 3. Link Employee Record through DB RPC so RLS is not bypassed in the client.
            if (userId) {
                const { error: linkError } = await supabase.rpc('complete_employee_signup', {
                    p_employee_id: employeeId.trim(),
                    p_email: email.trim()
                })

                if (linkError) {
                    console.error('Link Error:', linkError)
                    throw new Error('Failed to link account. Please contact HR.')
                }
            } else {
                throw new Error('User ID not found for linking.')
            }

            setMessage('Account created successfully! Redirecting to login...')
            setTimeout(() => navigate('/login'), 2000)

        } catch (err) {
            console.error('Signup Error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                        <User className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">Employee Signup</h1>
                    <p className="text-gray-500 mt-2">
                        {step === 1 && 'Verify your identity to get started'}
                        {step === 2 && 'Enter the code sent to your email'}
                        {step === 3 && 'Secure your account'}
                    </p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center mb-8 space-x-2">
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`h-2 w-12 rounded-full transition-colors ${step >= s ? 'bg-blue-600' : 'bg-gray-200'}`} />
                    ))}
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 flex items-start">
                        <AlertCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {message && (
                    <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-6 flex items-start">
                        <CheckCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
                        <span className="text-sm">{message}</span>
                    </div>
                )}

                {/* STEP 1: Verify */}
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

                {/* STEP 2: OTP */}
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

                {/* STEP 3: Password */}
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

                <div className="mt-8 text-center">
                    <Link to="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                        Already have an account? Sign in
                    </Link>
                </div>
            </div>
        </div>
    )
}
