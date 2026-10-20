import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Lock, CheckCircle, AlertCircle, KeyRound, Mail, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [otpCode, setOtpCode] = useState(searchParams.get('code') || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasValidSession, setHasValidSession] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true

    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const hasRecoveryHash =
        window.location.hash.includes('access_token') ||
        window.location.hash.includes('type=recovery')
      if (mounted) {
        setHasValidSession(Boolean(session || hasRecoveryHash))
        setCheckingSession(false)
      }
    }

    checkAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        if (mounted) {
          setHasValidSession(true)
          setCheckingSession(false)
        }
      }
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!hasValidSession && !email.trim()) {
      setError('Please enter your email address.')
      return
    }

    const cleanCode = otpCode.replace(/\s+/g, '')
    if (!hasValidSession && !cleanCode) {
      setError('Please enter the 8-digit code from your email.')
      return
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    // Validate password strength (Enterprise standard min 8 chars)
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setLoading(true)

    try {
      if (!hasValidSession) {
        // Verify OTP code with recovery type
        const { error: otpError } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: cleanCode,
          type: 'recovery',
        })
        if (otpError) throw otpError
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 2500)
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please check your code and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-in fade-in duration-300">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Successful!</h1>
          <p className="text-gray-600 mb-6">Your password has been updated successfully.</p>
          <p className="text-sm text-gray-500 mb-6">Redirecting to login page...</p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition"
          >
            Sign In Now
          </Link>
        </div>
      </div>
    )
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="animate-pulse text-slate-500 font-semibold text-sm">
          Loading security verification...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            {hasValidSession ? (
              <Lock className="w-8 h-8 text-blue-600" />
            ) : (
              <KeyRound className="w-8 h-8 text-blue-600" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Reset Password</h1>
          <p className="text-gray-500 mt-2 text-sm">
            {hasValidSession
              ? 'Enter your new password below'
              : 'Enter your email and the 8-digit verification code sent to your inbox'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl mb-5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!hasValidSession && (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-slate-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  8-Digit Code from Email
                </label>
                <input
                  type="text"
                  required
                  maxLength={12}
                  placeholder="12345678"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="block w-full py-2.5 px-3.5 border border-gray-300 rounded-xl text-center text-lg font-mono font-bold tracking-widest text-slate-900 placeholder-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              New Password (min 8 characters)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-3.5 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm text-slate-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Confirm New Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-slate-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700 font-semibold">
            Request new code
          </Link>
          <Link to="/login" className="text-gray-600 hover:text-gray-800 font-medium">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
