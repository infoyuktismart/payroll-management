import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  Lock,
  Mail,
  BadgeCheck,
  AlertCircle,
  KeyRound,
  CheckCircle,
  Users,
  Briefcase,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { logger } from '../lib/devLogger'
import { isAdminRole } from '../constants/roles'

const hrSlides = [
  {
    title: 'Employee Lifecycle & Onboarding',
    description:
      'Seamlessly onboard new hires, manage checklists, and build a unified enterprise culture.',
    renderSvg: () => (
      <svg
        viewBox="0 0 800 600"
        className="w-full h-full object-cover"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="50%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#312e81" />
          </linearGradient>
          <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#c084fc" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#g1)" />
        <path
          d="M 0 100 L 800 100 M 0 200 L 800 200 M 0 300 L 800 300 M 0 400 L 800 400 M 0 500 L 800 500"
          stroke="#ffffff"
          strokeOpacity="0.04"
          strokeWidth="1"
        />
        <path
          d="M 100 0 L 100 600 M 200 0 L 200 600 M 300 0 L 300 600 M 400 0 L 400 600 M 500 0 L 500 600 M 600 0 L 600 600 M 700 0 L 700 600"
          stroke="#ffffff"
          strokeOpacity="0.04"
          strokeWidth="1"
        />

        <circle cx="200" cy="200" r="180" fill="#818cf8" fillOpacity="0.12" filter="blur(60px)" />
        <circle cx="600" cy="400" r="150" fill="#6366f1" fillOpacity="0.12" filter="blur(50px)" />

        <g transform="translate(100, 50)">
          <circle cx="400" cy="250" r="45" fill="url(#g2)" />
          <circle cx="250" cy="180" r="30" fill="url(#g2)" opacity="0.7" />
          <circle cx="550" cy="180" r="30" fill="url(#g2)" opacity="0.7" />
          <circle cx="280" cy="320" r="35" fill="url(#g2)" opacity="0.6" />
          <circle cx="520" cy="320" r="35" fill="url(#g2)" opacity="0.6" />

          <line
            x1="400"
            y1="250"
            x2="250"
            y2="180"
            stroke="#e0e7ff"
            strokeOpacity="0.4"
            strokeWidth="3"
            strokeDasharray="5,5"
          />
          <line
            x1="400"
            y1="250"
            x2="550"
            y2="180"
            stroke="#e0e7ff"
            strokeOpacity="0.4"
            strokeWidth="3"
            strokeDasharray="5,5"
          />
          <line
            x1="400"
            y1="250"
            x2="280"
            y2="320"
            stroke="#e0e7ff"
            strokeOpacity="0.4"
            strokeWidth="3"
            strokeDasharray="5,5"
          />
          <line
            x1="400"
            y1="250"
            x2="520"
            y2="320"
            stroke="#e0e7ff"
            strokeOpacity="0.4"
            strokeWidth="3"
            strokeDasharray="5,5"
          />

          <rect x="360" y="225" width="80" height="50" rx="10" fill="#ffffff" fillOpacity="0.95" />
          <path
            d="M 385 250 L 395 260 L 415 240"
            fill="none"
            stroke="#4f46e5"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    ),
  },
  {
    title: 'Enterprise Payroll & Statutory Audits',
    description:
      'Process monthly wages, configure dynamic salary structures, and automate statutory compliance workflows.',
    renderSvg: () => (
      <svg
        viewBox="0 0 800 600"
        className="w-full h-full object-cover"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
          <linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#g3)" />
        <circle cx="300" cy="300" r="220" fill="#1e40af" fillOpacity="0.2" filter="blur(70px)" />
        <circle cx="500" cy="200" r="120" fill="#06b6d4" fillOpacity="0.1" filter="blur(40px)" />

        <g transform="translate(100, 60)">
          <rect
            x="150"
            y="100"
            width="300"
            height="200"
            rx="20"
            fill="#ffffff"
            fillOpacity="0.07"
            stroke="#ffffff"
            strokeOpacity="0.15"
            strokeWidth="2"
          />
          <circle
            cx="300"
            cy="200"
            r="60"
            fill="none"
            stroke="#22c55e"
            strokeWidth="8"
            strokeDasharray="300,80"
          />
          <circle
            cx="300"
            cy="200"
            r="45"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="8"
            strokeDasharray="200,60"
          />

          <g transform="translate(480, 240)">
            <ellipse cx="0" cy="0" rx="40" ry="15" fill="url(#g4)" />
            <ellipse cx="0" cy="-10" rx="40" ry="15" fill="#10b981" />
            <ellipse cx="0" cy="-20" rx="40" ry="15" fill="#34d399" />
            <path
              d="M -40 -20 L -40 0 A 40 15 0 0 0 40 0 L 40 -20 Z"
              fill="#059669"
              opacity="0.7"
            />
            <text x="0" y="-17" fill="#ffffff" fontSize="16" fontWeight="bold" textAnchor="middle">
              ₹
            </text>
          </g>

          <g transform="translate(410, 270)">
            <ellipse cx="0" cy="0" rx="30" ry="12" fill="url(#g4)" />
            <ellipse cx="0" cy="-8" rx="30" ry="12" fill="#10b981" />
            <ellipse cx="0" cy="-16" rx="30" ry="12" fill="#34d399" />
            <path
              d="M -30 -16 L -30 0 A 30 12 0 0 0 30 0 L 30 -16 Z"
              fill="#059669"
              opacity="0.7"
            />
          </g>
        </g>
      </svg>
    ),
  },
  {
    title: 'Statutory Reporting & Custom Builder',
    description:
      'Generate EPFO ECR returns, state-wise professional tax slabs, Form 16s, and custom reports instantly.',
    renderSvg: () => (
      <svg
        viewBox="0 0 800 600"
        className="w-full h-full object-cover"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#180828" />
            <stop offset="100%" stopColor="#3b0764" />
          </linearGradient>
          <linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff7e5f" />
            <stop offset="100%" stopColor="#feb47b" />
          </linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#g5)" />
        <circle cx="200" cy="400" r="160" fill="#db2777" fillOpacity="0.15" filter="blur(60px)" />
        <circle cx="600" cy="200" r="150" fill="#f43f5e" fillOpacity="0.1" filter="blur(50px)" />

        <g transform="translate(150, 100)">
          <path
            d="M 50 300 L 450 300 M 50 240 L 450 240 M 50 180 L 450 180 M 50 120 L 450 120"
            stroke="#ffffff"
            strokeOpacity="0.05"
            strokeWidth="2"
          />

          <rect x="90" y="210" width="35" height="90" rx="5" fill="#f43f5e" fillOpacity="0.8" />
          <rect x="170" y="150" width="35" height="150" rx="5" fill="#ec4899" fillOpacity="0.8" />
          <rect x="250" y="90" width="35" height="210" rx="5" fill="url(#g6)" />
          <rect x="330" y="130" width="35" height="170" rx="5" fill="#3b82f6" fillOpacity="0.8" />

          <path
            d="M 107 200 L 187 140 L 267 80 L 347 110"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="6"
            strokeLinecap="round"
            filter="drop-shadow(0px 5px 5px rgba(34, 211, 238, 0.4))"
          />
          <circle cx="347" cy="110" r="8" fill="#ffffff" stroke="#22d3ee" strokeWidth="3" />
        </g>
      </svg>
    ),
  },
]

function ImageCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % hrSlides.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-full h-full overflow-hidden">
      {hrSlides.map((slide, idx) => (
        <div
          key={idx}
          className={`absolute inset-0 transition-all duration-1000 ease-in-out ${idx === currentIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
        >
          {slide.renderSvg()}
          <div className="absolute inset-0 bg-linear-to-t from-slate-950/90 via-slate-900/30 to-slate-950/20" />
        </div>
      ))}

      {/* Top Brand Header */}
      <div className="absolute top-8 left-8 flex items-center space-x-3 z-10">
        <div className="w-10 h-10 rounded-xl bg-blue-600/90 backdrop-blur-md flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/30 border border-white/20">
          Y
        </div>
        <div>
          <span className="text-white font-bold text-lg tracking-tight">Yukti Smart HRMS</span>
        </div>
      </div>

      {/* Bottom Progress Bars */}
      <div className="absolute bottom-6 left-8 right-8 z-10">
        <div className="flex space-x-2">
          {hrSlides.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${idx === currentIndex ? 'bg-blue-500' : 'bg-white/20'}`}
            />
          ))}
        </div>
      </div>

      {/* Slide Title & Subtitle */}
      <div className="absolute top-28 left-8 right-8 z-10">
        <h2 className="text-3xl font-bold text-white drop-shadow-sm leading-tight">
          {hrSlides[currentIndex].title}
        </h2>
        <p className="text-slate-200/90 mt-2 text-sm max-w-md drop-shadow-sm font-medium leading-relaxed">
          {hrSlides[currentIndex].description}
        </p>
      </div>

      {/* Feature Highlights */}
      <div className="absolute bottom-12 left-8 right-8 grid grid-cols-3 gap-3 z-10">
        <div
          className={`rounded-xl p-3 text-center border backdrop-blur-md transition-all duration-500 ${currentIndex === 0 ? 'bg-white/15 border-white/30 scale-[1.02] shadow-lg shadow-black/20' : 'bg-white/5 border-white/10 opacity-70'}`}
        >
          <Users className="w-4 h-4 text-blue-300 mx-auto mb-1" />
          <p className="text-white text-[11px] font-bold uppercase tracking-wider">Onboarding</p>
        </div>
        <div
          className={`rounded-xl p-3 text-center border backdrop-blur-md transition-all duration-500 ${currentIndex === 1 ? 'bg-white/15 border-white/30 scale-[1.02] shadow-lg shadow-black/20' : 'bg-white/5 border-white/10 opacity-70'}`}
        >
          <Briefcase className="w-4 h-4 text-emerald-300 mx-auto mb-1" />
          <p className="text-white text-[11px] font-bold uppercase tracking-wider">Payroll</p>
        </div>
        <div
          className={`rounded-xl p-3 text-center border backdrop-blur-md transition-all duration-500 ${currentIndex === 2 ? 'bg-white/15 border-white/30 scale-[1.02] shadow-lg shadow-black/20' : 'bg-white/5 border-white/10 opacity-70'}`}
        >
          <TrendingUp className="w-4 h-4 text-purple-300 mx-auto mb-1" />
          <p className="text-white text-[11px] font-bold uppercase tracking-wider">Analytics</p>
        </div>
      </div>
    </div>
  )
}

function LoginForm({ onSwitchToSignup }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [resendingOtp, setResendingOtp] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const cooldownRef = useRef(null)

  function startCooldown(seconds = 30) {
    setCooldown(seconds)
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => () => clearInterval(cooldownRef.current), [])

  const {
    signIn,
    signInWithGoogle,
    verifyTwoFactor,
    resendTwoFactorCode,
    twoFactorChallenge,
    isTwoFactorVerified,
  } = useAuth()
  const navigate = useNavigate()

  const getLoginErrorMessage = (err) => {
    const message = err?.message?.toLowerCase?.() || ''
    const status = Number(err?.status)

    if (
      status === 400 ||
      status === 401 ||
      message.includes('invalid login credentials') ||
      message.includes('invalid credentials') ||
      message.includes('email not confirmed')
    ) {
      return 'Invalid email or password.'
    }

    if (message.includes('failed to fetch') || message.includes('network')) {
      return 'Unable to reach the authentication server. Check your connection and try again.'
    }

    return err?.message || 'Unable to sign in. Please try again.'
  }

  useEffect(() => {
    if (twoFactorChallenge && !isTwoFactorVerified(twoFactorChallenge.userId)) {
      setEmail(twoFactorChallenge.email || '')
      setOtp('')
      setShowOtpModal(true)
    }
  }, [twoFactorChallenge, isTwoFactorVerified])

  const handleGoogleSignIn = async () => {
    setError('')
    try {
      const { error: googleError } = await signInWithGoogle()
      if (googleError) throw googleError
    } catch (err) {
      setError(err.message || 'Google authentication failed.')
    }
  }

  const routeAfterLogin = async (knownIsAdmin = null) => {
    if (knownIsAdmin === true) {
      navigate('/dashboard', { replace: true })
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const meta = user.user_metadata || {}
      const isMetaAdmin = Boolean(
        meta.trial_admin || meta.role === 'admin' || meta.role === 'superadmin' || meta.is_admin
      )

      if (isMetaAdmin) {
        navigate('/dashboard', { replace: true })
        return
      }

      const [empRes, profileRes, memRes] = await Promise.all([
        supabase
          .from('employees')
          .select('role')
          .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
          .maybeSingle(),
        supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
        supabase
          .from('user_company_memberships')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle(),
      ])

      const role =
        empRes.data?.role ||
        profileRes.data?.role ||
        memRes.data?.role ||
        (isMetaAdmin ? 'admin' : '')
      const isUserAdmin = isMetaAdmin || isAdminRole(role)

      navigate(isUserAdmin ? '/dashboard' : '/portal', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const {
        error: signInError,
        twoFactorRequired,
        isAdmin: signedInIsAdmin,
      } = await signIn({ email, password })
      if (signInError) throw signInError

      if (twoFactorRequired) {
        setOtp('')
        setShowOtpModal(true)
        return
      }

      await routeAfterLogin(signedInIsAdmin)
    } catch (err) {
      setError(getLoginErrorMessage(err))
      startCooldown(30)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setVerifyingOtp(true)

    try {
      const { error: otpError } = await verifyTwoFactor(otp)
      if (otpError) throw otpError
      setShowOtpModal(false)
      await routeAfterLogin()
    } catch (err) {
      setError(err.message || 'Invalid verification code.')
    } finally {
      setVerifyingOtp(false)
    }
  }

  const handleResendOtp = async () => {
    setError('')
    setResendingOtp(true)

    try {
      const { error: resendError } = await resendTwoFactorCode()
      if (resendError) throw resendError
    } catch (err) {
      setError(err.message || 'Unable to resend verification code.')
    } finally {
      setResendingOtp(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
          >
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Mail className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="block w-full pl-10 pr-3.5 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all duration-200"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-slate-700"
            >
              Password
            </label>
            <Link
              to="/forgot-password"
              tabIndex={-1}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Lock className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              minLength={8}
              className="block w-full pl-10 pr-3.5 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all duration-200"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || cooldown > 0}
          className="w-full mt-1 py-2.5 px-4 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
        >
          {cooldown > 0 ? `Try again in ${cooldown}s` : loading ? 'Signing in...' : 'Sign In'}
          {!loading && cooldown === 0 && <ArrowRight className="w-4 h-4 opacity-80" />}
        </button>

        <div className="relative my-2.5">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase font-bold tracking-widest text-slate-400">
            <span className="bg-white px-2.5">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2.5 py-2 px-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 hover:border-slate-300 text-sm font-semibold text-slate-700 transition-all duration-200"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="text-center pt-1">
          <span className="text-xs text-slate-500 font-medium">Don't have an account? </span>
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
          >
            Sign up
          </button>
        </div>
      </form>

      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Two-factor Verification</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Code sent to {email}</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleVerifyOtp} className="p-5 space-y-4">
              <div>
                <label
                  htmlFor="login-2fa-code"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
                >
                  Enter Code
                </label>
                <input
                  id="login-2fa-code"
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-center text-lg font-black tracking-[0.3em] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="000000"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendingOtp || verifyingOtp}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {resendingOtp ? 'Sending...' : 'Resend code'}
                </button>
                <button
                  type="submit"
                  disabled={verifyingOtp}
                  className="flex-1 px-3 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {verifyingOtp ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
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
      const { data: verifyData, error: verifyError } = await supabase.rpc(
        'verify_signup_eligibility',
        {
          p_employee_id: employeeId.trim(),
          p_email: email.trim(),
        }
      )

      if (verifyError || !verifyData?.valid) {
        logger.error('Signup eligibility RPC failed:', verifyError || verifyData)
        const details = [verifyError?.message, verifyError?.details, verifyError?.hint]
          .filter(Boolean)
          .join(' ')
        throw new Error(
          details || verifyData?.message || 'Verification failed. Invalid ID or Email.'
        )
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      })

      if (otpError) throw otpError

      setMessage(
        `We sent a 6-digit verification code to ${email}. Check spam if it is not in your inbox.`
      )
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
        type: 'email',
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

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Auth session missing')

      const { error: passwordError } = await supabase.auth.updateUser({ password })
      if (passwordError) throw passwordError

      const { error: linkError } = await supabase.rpc('complete_employee_signup', {
        p_employee_id: employeeId.trim(),
        p_email: email.trim(),
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
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs sm:text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-xl text-xs sm:text-sm flex items-start gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 animate-bounce mt-0.5" />
          <span>{message}</span>
        </div>
      )}
      {step === 1 && (
        <form onSubmit={handleVerifyAndSendOtp} className="space-y-3">
          <div>
            <label
              htmlFor="signup-employee-id"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
            >
              Employee ID
            </label>
            <div className="relative">
              <BadgeCheck className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="signup-employee-id"
                type="text"
                required
                className="block w-full pl-10 pr-3.5 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all duration-200"
                placeholder="e.g., EMP26001"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="signup-email"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="signup-email"
                type="email"
                required
                className="block w-full pl-10 pr-3.5 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all duration-200"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all duration-200"
          >
            {loading ? 'Verifying...' : 'Send Verification Code'}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleVerifyOtp} className="space-y-3">
          <div>
            <label
              htmlFor="signup-otp"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
            >
              Verification Code
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="signup-otp"
                type="text"
                required
                maxLength={8}
                inputMode="numeric"
                pattern="[0-9]*"
                className="block w-full pl-10 pr-3.5 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-sm tracking-widest text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all duration-200"
                placeholder="e.g., 12345678"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all duration-200"
          >
            {loading ? 'Verifying Code...' : 'Verify Email'}
          </button>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="w-full text-xs font-medium text-slate-500 hover:text-slate-700 text-center"
          >
            Change Email
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleSetPassword} className="space-y-3">
          <div>
            <label
              htmlFor="signup-password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
            >
              Create Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="signup-password"
                type="password"
                required
                minLength={8}
                className="block w-full pl-10 pr-3.5 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all duration-200"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="signup-confirm-password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
            >
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="signup-confirm-password"
                type="password"
                required
                minLength={8}
                className="block w-full pl-10 pr-3.5 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all duration-200"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all duration-200"
          >
            {loading ? 'Finalize Account...' : 'Create Account'}
          </button>
        </form>
      )}

      <div className="text-center pt-1">
        <span className="text-xs text-slate-500 font-medium">Already have an account? </span>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
        >
          Sign in
        </button>
      </div>
    </div>
  )
}

export default function Login() {
  const [activeTab, setActiveTab] = useState('login')
  const [isFirstRun, setIsFirstRun] = useState(false)
  const { user, loading, isRoleLoading, isAdmin, twoFactorChallenge, isTwoFactorVerified } =
    useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const pendingTwoFactor =
      user && twoFactorChallenge?.userId === user.id && !isTwoFactorVerified(user.id)
    if (!loading && !isRoleLoading && user && !pendingTwoFactor) {
      navigate(isAdmin ? '/dashboard' : '/portal', { replace: true })
    }
  }, [loading, isRoleLoading, user, isAdmin, twoFactorChallenge, isTwoFactorVerified, navigate])

  useEffect(() => {
    const checkFirstRunStatus = async () => {
      try {
        // Try checking using RPC
        const { data: firstRunRpc, error: rpcErr } = await supabase.rpc('is_first_run')
        if (!rpcErr && firstRunRpc !== null) {
          if (firstRunRpc === true) {
            setIsFirstRun(true)
          }
          return
        }

        // Fallback direct check
        const { count, error } = await supabase
          .from('profiles')
          .select('id', { head: true, count: 'exact' })
          .eq('role', 'admin')

        if (!error && count === 0) {
          setIsFirstRun(true)
        }
      } catch (err) {
        console.error('Failed to detect system setup status:', err)
      }
    }
    checkFirstRunStatus()
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100/70 flex items-stretch select-none">
      {/* Left Carousel Column */}
      <div className="hidden lg:block lg:w-7/12 bg-slate-950 relative h-full overflow-hidden">
        <ImageCarousel />
      </div>

      {/* Right Form Column */}
      <div className="w-full lg:w-5/12 h-full flex flex-col justify-center items-center px-4 py-4 sm:px-6 overflow-hidden">
        <div className="max-w-100 w-full bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-lg shadow-slate-200/40">
          {isFirstRun && (
            <div
              onClick={() => navigate('/setup-wizard')}
              className="mb-3 p-2.5 bg-linear-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl flex items-start space-x-2 cursor-pointer hover:bg-indigo-100/50 hover:scale-[1.01] active:scale-99 transition-all duration-300 shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5 animate-pulse" />
              <div className="text-left">
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                  Fresh System Onboarding
                </h4>
                <p className="text-xs text-indigo-700 mt-0.5 leading-snug">
                  No admin configured. Click to initialize master tenant.
                </p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-3">
            <div className="inline-flex items-center justify-center w-11 h-11 bg-linear-to-tr from-blue-600 to-indigo-600 rounded-2xl text-white shadow-md shadow-blue-500/25 mb-1.5">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {activeTab === 'login' ? 'Welcome Back' : 'Employee Signup'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              {activeTab === 'login'
                ? 'Sign in to access your HR & Payroll workspace'
                : 'Verify your identity to complete account setup'}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl mb-3 text-sm font-semibold">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${activeTab === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${activeTab === 'signup' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Sign Up
            </button>
          </div>

          {/* Active Form */}
          {(activeTab === 'login' || activeTab === 'signup') && (
            <>
              {activeTab === 'login' && (
                <>
                  <LoginForm onSwitchToSignup={() => setActiveTab('signup')} />

                  {/* 14-Day Company Trial Banner */}
                  <div className="mt-3 rounded-xl border border-blue-100 bg-linear-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-2.5 px-3.5 flex items-center justify-between gap-2">
                    <div className="text-left">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-900">
                        New Client Company?
                      </p>
                      <p className="text-xs text-slate-600 font-medium">Setup your organization</p>
                    </div>
                    <Link
                      to="/register"
                      className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all duration-200"
                    >
                      Start trial
                    </Link>
                  </div>
                </>
              )}
              {activeTab === 'signup' && (
                <SignupForm onSwitchToLogin={() => setActiveTab('login')} />
              )}
            </>
          )}
        </div>

        {/* Footer Copy */}
        <div className="mt-3 text-center">
          <p className="text-xs text-slate-400 font-medium">
            &copy; 2026 Yukti Smart HRMS &bull; Enterprise HR & Payroll Platform
          </p>
        </div>
      </div>
    </div>
  )
}
