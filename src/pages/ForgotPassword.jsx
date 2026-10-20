import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Mail,
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [step, setStep] = useState(1) // 1: Request email, 2: Enter 8-digit code & new password
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)

  const handleSendResetEmail = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    if (loading || resending) return

    setError('')
    setLoading(true)

    try {
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (sendError) throw sendError

      setStep(2)
    } catch (err) {
      const msg = err.message || ''
      if (
        msg.toLowerCase().includes('error sending') ||
        msg.toLowerCase().includes('internal server error')
      ) {
        setError(
          'Unable to dispatch email. The mail service is temporarily unavailable or requires custom SMTP configuration in Supabase. Please contact your administrator.'
        )
      } else if (
        msg.toLowerCase().includes('rate limit') ||
        msg.toLowerCase().includes('too many requests')
      ) {
        setError('Too many attempts. Please try again in a moment.')
      } else {
        setError(msg || 'Failed to send reset email. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resending || !email) return
    setResending(true)
    setResetError('')
    try {
      const { error: resendError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resendError) throw resendError
    } catch (err) {
      setResetError(err.message || 'Unable to resend code. Please try again.')
    } finally {
      setResending(false)
    }
  }

  const handleResetWithOtp = async (e) => {
    e.preventDefault()
    if (resetLoading) return
    setResetError('')

    const cleanCode = otpCode.replace(/\s+/g, '')
    if (!cleanCode) {
      setResetError('Please enter the 8-digit verification code from your email.')
      return
    }

    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.')
      return
    }

    setResetLoading(true)

    try {
      // 1. Verify OTP with recovery type
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: cleanCode,
        type: 'recovery',
      })

      if (otpError) throw otpError

      // 2. Set new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) throw updateError

      // 3. Cleanly clear auth session so user can log in with new credentials freshly
      try {
        await supabase.auth.signOut()
      } catch (signOutErr) {
        console.warn('Post-reset sign out notice:', signOutErr)
      }

      setResetSuccess(true)
      setTimeout(() => {
        window.location.href = '/login?reset=success'
      }, 2000)
    } catch (err) {
      setResetError(err.message || 'Invalid or expired code. Please verify the code and try again.')
    } finally {
      setResetLoading(false)
    }
  }

  if (resetSuccess) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-in fade-in duration-300">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Successful!</h1>
          <p className="text-gray-600 mb-6">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <p className="text-sm text-gray-500 mb-6">Redirecting to login...</p>
          <button
            type="button"
            onClick={() => {
              window.location.href = '/login?reset=success'
            }}
            className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer"
          >
            Sign In Now
          </button>
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <KeyRound className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Enter Verification Code</h1>
            <p className="text-gray-600 text-sm mt-2">
              We sent an 8-digit code to <strong className="text-slate-800">{email}</strong>
            </p>
          </div>

          {resetError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl mb-5 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{resetError}</span>
            </div>
          )}

          <form onSubmit={handleResetWithOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                8-Digit Code from Email
              </label>
              <input
                type="text"
                required
                autoFocus
                autoComplete="one-time-code"
                maxLength={12}
                placeholder="12345678"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                className="block w-full py-3 px-4 border border-gray-300 rounded-xl text-center text-xl font-mono font-bold tracking-widest text-slate-900 placeholder-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

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
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full py-2.5 pl-3.5 pr-10 border border-gray-300 rounded-xl text-sm text-slate-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                className="block w-full py-2.5 px-3.5 border border-gray-300 rounded-xl text-sm text-slate-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={resetLoading || !otpCode.trim() || !newPassword || !confirmPassword}
              className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              {resetLoading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
              {resending ? 'Resending...' : 'Resend Code'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1)
                setError('')
                setResetError('')
              }}
              className="font-semibold text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              Change Email
            </button>
          </div>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Forgot Password?</h1>
          <p className="text-gray-500 mt-2">
            Enter your email and we'll send you an 8-digit verification code.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSendResetEmail} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                required
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Enter the email associated with your account
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {loading ? 'Sending...' : 'Send Reset Code'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link
            to="/login"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
