/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { devLog, logger } from '../lib/devLogger'
import { isAdminRole } from '../constants/roles'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

const TWO_FACTOR_SESSION_KEY = 'payroll_2fa_verified_user'
const AUTH_LAST_ACTIVITY_KEY = 'payroll_auth_last_activity_at'
const AUTH_BOOT_TIMEOUT_MS = 3_500
const AUTH_IDLE_TIMEOUT_MS = 60 * 60 * 1000
const ACTIVITY_WRITE_THROTTLE_MS = 30_000

const withTimeout = (promise, timeoutMs, label) => {
  let timerId
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`)),
      timeoutMs
    )
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId))
}

const isInvalidSessionError = (error) => {
  const message = error?.message?.toLowerCase?.() || ''
  const name = error?.name?.toLowerCase?.() || ''
  const status = Number(error?.status)

  return (
    name.includes('authsessionmissing') ||
    status === 401 ||
    status === 403 ||
    message.includes('session missing') ||
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found') ||
    message.includes('jwt expired') ||
    message.includes('invalid jwt') ||
    message.includes('invalid token')
  )
}

const isTimeoutError = (error) => error?.message?.toLowerCase?.().includes('timed out after')

const AuthBootError = ({ error, onRetry }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
    <div className="w-full max-w-xl rounded-2xl border border-rose-200 bg-white p-7 shadow-xl shadow-slate-200/70">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-600">
        Application startup blocked
      </p>
      <h1 className="mt-3 text-2xl font-black text-slate-950">
        Unable to initialize login session
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        The application could not complete the initial Supabase auth check. This usually means the
        network, Supabase URL/key, or session verification query is failing before the dashboard can
        render.
      </p>
      <pre className="mt-4 max-h-48 overflow-auto rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs font-semibold text-rose-900">
        {error?.message || String(error || 'Unknown auth startup error')}
      </pre>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('payroll_auth_is_admin')
            localStorage.removeItem('payroll_auth_profile_data')
            sessionStorage.removeItem(TWO_FACTOR_SESSION_KEY)
            window.location.assign('/login')
          }}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900"
        >
          Go to login
        </button>
      </div>
    </div>
  </div>
)

const getBrowserInfo = () => {
  if (typeof navigator === 'undefined') {
    return { browser: 'Unknown Browser', os: 'Unknown OS', deviceType: 'desktop', userAgent: '' }
  }

  const ua = navigator.userAgent
  let browser = 'Unknown Browser'
  let os = 'Unknown OS'
  let deviceType = 'desktop'

  if (/Edg/i.test(ua)) browser = 'Microsoft Edge'
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera'
  else if (/Firefox/i.test(ua)) browser = 'Firefox'
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Browser'
  else if (/Chrome/i.test(ua)) browser = 'Google Chrome'
  else if (/Safari/i.test(ua)) browser = 'Safari'

  if (/Windows NT/i.test(ua)) os = 'Windows'
  else if (/Mac OS X/i.test(ua)) os = 'macOS'
  else if (/Android/i.test(ua)) {
    os = 'Android'
    deviceType = 'mobile'
  } else if (/iPhone|iPad/i.test(ua)) {
    os = 'iOS'
    deviceType = 'mobile'
  } else if (/Linux/i.test(ua)) os = 'Linux'

  return { browser, os, deviceType, userAgent: ua }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      const keys = Object.keys(localStorage)
      const hasToken = keys.some((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
      return hasToken
    } catch {
      return true
    }
  })
  const userRef = useRef(null)
  const sessionTokenRef = useRef(null)
  const lastRoleCheckRef = useRef({ userId: null, at: 0 })
  const lastActivityWriteRef = useRef(0)
  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return JSON.parse(localStorage.getItem('payroll_auth_is_admin') || 'false')
    } catch {
      return false
    }
  })
  const [isRoleLoading, setIsRoleLoading] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const keys = Object.keys(localStorage)
      const hasToken = keys.some((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
      if (!hasToken) return false
      const cached = localStorage.getItem('payroll_auth_is_admin')
      return cached === null
    } catch {
      return false
    }
  })
  const [profileData, setProfileData] = useState(() => {
    if (typeof window === 'undefined') return null
    try {
      return JSON.parse(localStorage.getItem('payroll_auth_profile_data') || 'null')
    } catch {
      return null
    }
  })
  const [twoFactorChallenge, setTwoFactorChallenge] = useState(null)
  const [bootError, setBootError] = useState(null)

  useEffect(() => {
    userRef.current = user
  }, [user])

  const markTwoFactorVerified = (userId) => {
    if (!userId) return
    sessionStorage.setItem(TWO_FACTOR_SESSION_KEY, userId)
    setTwoFactorChallenge(null)
  }

  const clearTwoFactorVerified = () => {
    sessionStorage.removeItem(TWO_FACTOR_SESSION_KEY)
    setTwoFactorChallenge(null)
  }

  const isTwoFactorVerified = (userId) => {
    if (!userId) return false
    return sessionStorage.getItem(TWO_FACTOR_SESSION_KEY) === userId
  }

  const logSecurityEvent = async (eventType, metadata = {}) => {
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()
      const { browser, os, deviceType, userAgent } = getBrowserInfo()
      const eventMetadata = {
        email: currentUser?.email,
        ...metadata,
      }
      await supabase.from('security_session_logs').insert({
        user_id: currentUser?.id || metadata.userId || null,
        event_type: eventType,
        user_agent: userAgent,
        device_type: deviceType,
        browser,
        os,
        metadata: eventMetadata,
      })
    } catch (error) {
      devLog('Security event logging skipped:', error?.message)
    }
  }

  const getTwoFactorSettings = async (userId) => {
    const { data, error } = await supabase
      .from('user_2fa_settings')
      .select('*')
      .eq('user_id', userId)
      .eq('method', 'email_otp')
      .maybeSingle()

    if (error && error.code !== '42P01') throw error
    return data
  }

  const checkRole = async (userId, userObj = null) => {
    const now = Date.now()
    if (
      lastRoleCheckRef.current.userId === userId &&
      profileData !== null &&
      isAdmin !== null &&
      now - lastRoleCheckRef.current.at < 7200_000
    ) {
      devLog('AuthContext: Skipping duplicate role check for:', userId)
      setLoading(false)
      setIsRoleLoading(false)
      return isAdmin
    }
    lastRoleCheckRef.current = { userId, at: now }

    try {
      devLog('AuthContext: Starting checkRole for:', userId)
      let isUserAdmin = false
      let finalProfileData = null

      // 1. Fetch current authenticated user or use passed/cached user to inspect metadata
      let currentUser = userObj || userRef.current
      if (!currentUser) {
        const { data } = await supabase.auth.getUser()
        currentUser = data?.user
      }
      const userEmail = currentUser?.email?.toLowerCase()?.trim() || ''
      const meta = currentUser?.user_metadata || {}
      const isMetaAdmin = Boolean(
        meta.trial_admin || meta.role === 'admin' || meta.role === 'superadmin' || meta.is_admin
      )

      // Fast-path: If user metadata already confirms admin, set admin immediately to prevent portal flash
      if (isMetaAdmin) {
        isUserAdmin = true
        setIsAdmin(true)
        setIsRoleLoading(false)
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('payroll_auth_is_admin', 'true')
          } catch (err) {
            devLog('Failed to save admin flag to localStorage:', err)
          }
        }
      }

      // 2. Execute profile, employee, and company membership lookups in parallel
      const [profileRes, employeeRes, membershipRes] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
        supabase
          .from('employees')
          .select(
            'id, first_name, last_name, role, employee_id, registration_id, company_id, user_id'
          )
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_company_memberships')
          .select('role, company_id')
          .eq('user_id', userId)
          .maybeSingle(),
      ])

      const profile = profileRes.data
      const profileErr = profileRes.error
      let employee = employeeRes.data
      const employeeErr = employeeRes.error
      const membership = membershipRes.data

      if (profileErr && profileErr.code !== 'PGRST116') {
        devLog('AuthContext: Profiles query warning:', profileErr)
      }
      if (employeeErr && employeeErr.code !== 'PGRST116') {
        devLog('AuthContext: Employees query warning:', employeeErr)
      }

      // 3. Fallback: If employee not linked by user_id, check if employee exists with this user's email
      if (!employee && userEmail) {
        try {
          const { data: empByEmail } = await supabase
            .from('employees')
            .select(
              'id, first_name, last_name, role, employee_id, registration_id, company_id, user_id'
            )
            .ilike('email', userEmail)
            .maybeSingle()

          if (empByEmail) {
            employee = empByEmail
            // Auto-link user_id if currently unlinked
            if (!empByEmail.user_id) {
              try {
                await supabase.rpc('complete_employee_signup', {
                  p_employee_id: empByEmail.employee_id,
                  p_email: userEmail,
                })
                employee.user_id = userId
              } catch (linkErr) {
                devLog('Auto-link error (non-fatal):', linkErr)
              }
            }
          }
        } catch (emailQueryErr) {
          devLog('Email employee lookup warning:', emailQueryErr)
        }
      }

      devLog('Profiles Table Result:', { profile, profileErr })
      devLog('Employees Table Result:', { employee, employeeErr })
      devLog('Membership Table Result:', { membership })

      // 4. Role determination: check metadata, profile, employee, and membership
      if (
        isMetaAdmin ||
        (profile && isAdminRole(profile.role)) ||
        (employee && isAdminRole(employee.role)) ||
        (membership && isAdminRole(membership.role))
      ) {
        isUserAdmin = true
      }

      // 5. Build rich profile data so real names are always displayed (never generic "Guest User")
      const resolvedFirstName =
        employee?.first_name || meta.first_name || currentUser?.email?.split('@')[0] || 'User'
      const resolvedLastName = employee?.last_name || meta.last_name || ''
      const isSuperAdminUser = Boolean(
        meta.role === 'superadmin' ||
        profile?.role === 'superadmin' ||
        employee?.role === 'superadmin' ||
        membership?.role === 'superadmin'
      )
      const resolvedRole = isSuperAdminUser
        ? 'superadmin'
        : employee?.role || (isUserAdmin ? 'Admin' : profile?.role || 'Employee')
      const resolvedEmpId =
        employee?.employee_id || employee?.registration_id || (isUserAdmin ? 'ADM001' : 'N/A')

      finalProfileData = {
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        role: resolvedRole,
        employeeId: resolvedEmpId,
      }

      // 6. Self-heal profile in database if confirmed admin (preserving superadmin)
      if (
        isUserAdmin &&
        !isSuperAdminUser &&
        profile?.role !== 'admin' &&
        profile?.role !== 'superadmin' &&
        meta.role !== 'superadmin'
      ) {
        supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', userId)
          .then(() => {
            devLog('Auto-synced profile role to admin')
          })
          .catch(() => {})
      }

      devLog('Final Determination:', { isUserAdmin, finalProfileData })

      // ATOMIC UPDATE: Only update state if values changed to prevent redundant re-renders
      setIsAdmin((prev) => (prev !== isUserAdmin ? isUserAdmin : prev))
      setProfileData((prev) => {
        if (!prev) return finalProfileData
        const changed =
          prev.firstName !== finalProfileData.firstName ||
          prev.lastName !== finalProfileData.lastName ||
          prev.role !== finalProfileData.role ||
          prev.employeeId !== finalProfileData.employeeId
        return changed ? finalProfileData : prev
      })

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('payroll_auth_is_admin', JSON.stringify(isUserAdmin))
          localStorage.setItem('payroll_auth_profile_data', JSON.stringify(finalProfileData))
        } catch (err) {
          devLog('Failed to save auth state to localStorage:', err)
        }
      }

      setIsRoleLoading(false)
      setLoading(false)
      return isUserAdmin
    } catch (e) {
      logger.error('Error in AuthContext checkRole:', e)
      if (typeof window !== 'undefined' && (!navigator.onLine || !isInvalidSessionError(e))) {
        devLog(
          'AuthContext: Network error or transient DB error. Retaining cached credentials:',
          e?.message
        )
      } else {
        setIsAdmin((prev) => (prev !== false ? false : prev))
        setProfileData((prev) => (prev !== null ? null : prev))
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('payroll_auth_is_admin')
            localStorage.removeItem('payroll_auth_profile_data')
          } catch (err) {
            devLog('Failed to clear cached auth state:', err)
          }
        }
      }
      setIsRoleLoading(false)
      setLoading(false)
      return false
    }
  }

  const clearCachedAuthState = useCallback(() => {
    setIsAdmin(false)
    setIsRoleLoading(false)
    setProfileData(null)
    setSession(null)
    setUser(null)
    sessionTokenRef.current = null
    userRef.current = null
    lastRoleCheckRef.current = { userId: null, at: 0 }
    clearTwoFactorVerified()
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('payroll_auth_is_admin')
        localStorage.removeItem('payroll_auth_profile_data')
        localStorage.removeItem(AUTH_LAST_ACTIVITY_KEY)
        sessionStorage.removeItem('employee_portal_cache')
      } catch (err) {
        devLog('Failed to clear cached auth state:', err)
      }
    }
  }, [])

  const recordActivity = useCallback((force = false) => {
    if (typeof window === 'undefined') return
    const now = Date.now()
    if (!force && now - lastActivityWriteRef.current < ACTIVITY_WRITE_THROTTLE_MS) return
    lastActivityWriteRef.current = now
    try {
      localStorage.setItem(AUTH_LAST_ACTIVITY_KEY, String(now))
    } catch (err) {
      devLog('Failed to save last activity timestamp:', err)
    }
  }, [])

  const signOutForIdle = useCallback(async () => {
    if (!userRef.current) return
    devLog('AuthContext: Session expired after 60 minutes of inactivity.')
    try {
      await logSecurityEvent('idle_timeout', { idleMinutes: 60 })
    } catch (err) {
      devLog('Idle timeout audit log skipped:', err?.message)
    }
    clearCachedAuthState()
    try {
      await supabase.auth.signOut()
    } catch (err) {
      devLog('Supabase sign-out after idle timeout failed:', err?.message)
    }
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign('/login')
    }
  }, [clearCachedAuthState])

  const expireIfIdle = useCallback(() => {
    if (typeof window === 'undefined' || !userRef.current) return false
    const lastActivity = Number(localStorage.getItem(AUTH_LAST_ACTIVITY_KEY) || 0)
    if (!lastActivity) {
      recordActivity(true)
      return false
    }
    if (Date.now() - lastActivity >= AUTH_IDLE_TIMEOUT_MS) {
      signOutForIdle()
      return true
    }
    return false
  }, [recordActivity, signOutForIdle])

  const verifyCachedSession = async (cachedSession) => {
    if (!cachedSession?.user) return null

    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) {
      if (isInvalidSessionError(error)) {
        devLog(
          'AuthContext: Cached session is no longer valid. Clearing local auth state.',
          error?.message
        )
        clearCachedAuthState()
        await supabase.auth.signOut()
        return null
      }

      devLog(
        'AuthContext: User verification failed without an invalid-session signal. Keeping cached session.',
        error?.message
      )
      return cachedSession.user
    }

    return data.user
  }

  const isIdleSessionExpired = () => {
    if (typeof window === 'undefined') return false
    const lastActivity = Number(localStorage.getItem(AUTH_LAST_ACTIVITY_KEY) || 0)
    return Boolean(lastActivity && Date.now() - lastActivity >= AUTH_IDLE_TIMEOUT_MS)
  }

  const applyAuthState = useCallback((verifiedUser, nextSession) => {
    const nextToken = nextSession?.access_token || null
    const nextUserId = verifiedUser?.id || null
    const currentUserId = userRef.current?.id || null

    if (sessionTokenRef.current !== nextToken) {
      sessionTokenRef.current = nextToken
      setSession(nextSession || null)
    }

    if (currentUserId !== nextUserId) {
      userRef.current = verifiedUser || null
      setUser(verifiedUser || null)
    }

    if (verifiedUser) {
      const meta = verifiedUser.user_metadata || {}
      const isMetaAdmin = Boolean(
        meta.trial_admin || meta.role === 'admin' || meta.role === 'superadmin' || meta.is_admin
      )
      if (isMetaAdmin) {
        setIsAdmin(true)
        setIsRoleLoading(false)
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('payroll_auth_is_admin', 'true')
          } catch (err) {
            devLog('Failed to save admin flag to localStorage:', err)
          }
        }
      }
    }
  }, [])

  const signIn = async (credentials) => {
    clearTwoFactorVerified()
    setIsRoleLoading(true)

    const response = await supabase.auth.signInWithPassword(credentials)
    if (response.error) {
      setIsRoleLoading(false)
      return response
    }
    recordActivity(true)

    const signedInUser = response.data?.user
    await logSecurityEvent('password_login', { email: credentials.email, userId: signedInUser?.id })

    if (!signedInUser?.id) {
      setIsRoleLoading(false)
      return response
    }

    // Instantly detect admin from metadata to prevent any flash of non-admin UI
    const meta = signedInUser.user_metadata || {}
    const isMetaAdmin = Boolean(
      meta.trial_admin || meta.role === 'admin' || meta.role === 'superadmin' || meta.is_admin
    )
    if (isMetaAdmin) {
      setIsAdmin(true)
      setIsRoleLoading(false)
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('payroll_auth_is_admin', 'true')
        } catch (err) {
          devLog('Failed to save admin flag to localStorage:', err)
        }
      }
    }

    const settings = await getTwoFactorSettings(signedInUser.id)
    if (!settings?.enabled) {
      markTwoFactorVerified(signedInUser.id)
      const roleResult = await checkRole(signedInUser.id, signedInUser)
      const userIsSuperAdmin = Boolean(
        meta.role === 'superadmin' ||
        roleResult?.isSuperAdmin ||
        roleResult?.profileData?.role === 'superadmin' ||
        profileData?.role === 'superadmin'
      )
      return {
        ...response,
        isAdmin:
          typeof roleResult === 'object'
            ? roleResult.isUserAdmin
            : typeof roleResult === 'boolean'
              ? roleResult
              : isMetaAdmin,
        isSuperAdmin: userIsSuperAdmin,
      }
    }

    const otpResponse = await supabase.auth.signInWithOtp({
      email: signedInUser.email || credentials.email,
      options: { shouldCreateUser: false },
    })

    if (otpResponse.error) return { data: response.data, error: otpResponse.error }

    setTwoFactorChallenge({
      userId: signedInUser.id,
      email: signedInUser.email || credentials.email,
      expiresAt: Date.now() + 10 * 60 * 1000,
    })
    await logSecurityEvent('2fa_challenge_sent', {
      email: signedInUser.email || credentials.email,
      userId: signedInUser.id,
    })

    return {
      data: response.data,
      error: null,
      twoFactorRequired: true,
      isAdmin: isMetaAdmin,
    }
  }

  const signInWithGoogle = async () => {
    clearTwoFactorVerified()
    recordActivity(true)
    const redirectUrl = `${window.location.origin}/dashboard`
    const response = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    })
    return response
  }

  const verifyTwoFactor = async (otp) => {
    if (!twoFactorChallenge?.email || !twoFactorChallenge?.userId) {
      return { error: new Error('No active two-factor challenge found.') }
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: twoFactorChallenge.email,
      token: otp.trim(),
      type: 'email',
    })

    if (error) {
      await logSecurityEvent('2fa_failed', {
        email: twoFactorChallenge.email,
        userId: twoFactorChallenge.userId,
      })
      return { data, error }
    }

    markTwoFactorVerified(twoFactorChallenge.userId)
    await supabase
      .from('user_2fa_settings')
      .update({ last_verified_at: new Date().toISOString() })
      .eq('user_id', twoFactorChallenge.userId)
      .eq('method', 'email_otp')
    await logSecurityEvent('2fa_verified', {
      email: twoFactorChallenge.email,
      userId: twoFactorChallenge.userId,
    })
    return { data, error: null }
  }

  const resendTwoFactorCode = async () => {
    if (!twoFactorChallenge?.email) {
      return { error: new Error('No active two-factor challenge found.') }
    }

    const response = await supabase.auth.signInWithOtp({
      email: twoFactorChallenge.email,
      options: { shouldCreateUser: false },
    })

    if (!response.error) {
      await logSecurityEvent('2fa_challenge_sent', {
        email: twoFactorChallenge.email,
        userId: twoFactorChallenge.userId,
        resent: true,
      })
    }

    return response
  }

  useEffect(() => {
    let isMounted = true

    const finishLoading = () => {
      if (isMounted) setLoading(false)
    }

    const recoverAuthCheck = (error, fallbackSession = null) => {
      if (isTimeoutError(error)) {
        devLog(
          fallbackSession?.user
            ? 'AuthContext auth check timed out. Keeping existing cached session:'
            : 'AuthContext auth check timed out. Continuing signed out until Supabase emits a session:',
          error?.message
        )
        if (isMounted) {
          setBootError(null)
          if (fallbackSession?.user) {
            setSession(fallbackSession)
            setUser(fallbackSession.user)
            recordActivity(true)
          } else {
            setUser(null)
            setSession(null)
            setIsAdmin(false)
            setProfileData(null)
          }
        }
        finishLoading()
        return
      }

      logger.error('AuthContext auth check failed. Recovering to signed-out state:', error)
      if (isMounted) {
        setBootError(null)
        setUser(null)
        setSession(null)
        setIsAdmin(false)
        setProfileData(null)
        clearTwoFactorVerified()
        setLoading(false)
      }
    }

    const initializeAuth = async () => {
      try {
        devLog('AuthContext: Security Patch Loaded')
        const {
          data: { session },
        } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_BOOT_TIMEOUT_MS,
          'Supabase auth session check'
        )
        if (!isMounted) return

        let verifiedUser = null
        try {
          verifiedUser = await withTimeout(
            verifyCachedSession(session),
            AUTH_BOOT_TIMEOUT_MS,
            'Supabase user verification'
          )
        } catch (error) {
          if (!session?.user || !isTimeoutError(error)) throw error
          devLog(
            'AuthContext: Initial user verification timed out. Continuing with cached session.'
          )
          verifiedUser = session.user
        }
        if (!isMounted) return

        applyAuthState(verifiedUser, verifiedUser ? session : null)
        if (verifiedUser) {
          if (!localStorage.getItem(AUTH_LAST_ACTIVITY_KEY) || isIdleSessionExpired())
            recordActivity(true)
          try {
            const settings = await withTimeout(
              getTwoFactorSettings(verifiedUser.id),
              AUTH_BOOT_TIMEOUT_MS,
              'Two-factor settings check'
            )
            if (settings?.enabled && !isTwoFactorVerified(verifiedUser.id)) {
              setTwoFactorChallenge({
                userId: verifiedUser.id,
                email: verifiedUser.email,
                expiresAt: Date.now() + 10 * 60 * 1000,
              })
            }
          } catch (err) {
            devLog('AuthContext: Initial 2FA setting query failed:', err?.message)
          }
          checkRole(verifiedUser.id)
        } else {
          finishLoading()
        }
      } catch (error) {
        recoverAuthCheck(error)
      }
    }

    devLog('AuthContext: Security Patch Loaded')
    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        const verifiedUser = session?.user || null
        if (!isMounted) return
        setBootError(null)

        applyAuthState(verifiedUser, verifiedUser ? session : null)
        if (verifiedUser) {
          if (event === 'SIGNED_IN' || isIdleSessionExpired()) recordActivity(true)
          if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
            try {
              const settings = await withTimeout(
                getTwoFactorSettings(verifiedUser.id),
                AUTH_BOOT_TIMEOUT_MS,
                'Auth state 2FA settings check'
              )
              if (settings?.enabled && !isTwoFactorVerified(verifiedUser.id)) {
                setTwoFactorChallenge({
                  userId: verifiedUser.id,
                  email: verifiedUser.email,
                  expiresAt: Date.now() + 10 * 60 * 1000,
                })
              }
            } catch (err) {
              devLog('AuthContext: auth state change 2FA setting query failed:', err?.message)
            }
          }
          checkRole(verifiedUser.id)
        } else {
          clearCachedAuthState()
          finishLoading()
        }
      } catch (error) {
        recoverAuthCheck(error, session)
      }
    })

    // Server-side verification function to validate token against Supabase Auth database
    const verifySessionOnServer = async () => {
      if (typeof window !== 'undefined' && !navigator.onLine) return
      try {
        // Query getUser directly from the Supabase Auth schema - this verifies token validity in the cheapest way without hitting public.profiles DB table
        const { error } = await supabase.auth.getUser()

        if (
          error &&
          (error.status === 401 ||
            error.status === 403 ||
            error.code === '401' ||
            error.code === '403' ||
            error.message?.includes('JWT') ||
            error.message?.includes('claims') ||
            error.message?.includes('invalid signature') ||
            error.message?.includes('session missing'))
        ) {
          devLog('AuthContext: Session invalidated globally on server. Logging out.')
          await supabase.auth.signOut()
          setIsAdmin(false)
          setProfileData(null)
          setSession(null)
          setUser(null)
          clearTwoFactorVerified()
        }
      } catch (err) {
        logger.error('Error during active session server verification:', err)
      }
    }

    let lastServerVerificationAt = 0
    const verifySessionOnServerThrottled = () => {
      const now = Date.now()
      if (now - lastServerVerificationAt < 15 * 60 * 1000) return
      lastServerVerificationAt = now
      verifySessionOnServer()
    }

    // Run validation when browser tab is refocused by the user, throttled to avoid noisy duplicate checks.
    window.addEventListener('focus', verifySessionOnServerThrottled)

    // Periodically check server-side session validity without creating constant network noise.
    const sessionInterval = setInterval(verifySessionOnServerThrottled, 5 * 60 * 1000)

    return () => {
      isMounted = false
      subscription.unsubscribe()
      window.removeEventListener('focus', verifySessionOnServerThrottled)
      clearInterval(sessionInterval)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleActivity = () => {
      if (!userRef.current) return
      if (!expireIfIdle()) recordActivity()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') handleActivity()
    }

    const handleStorageChange = (event) => {
      if (event.key !== AUTH_LAST_ACTIVITY_KEY) return
      if (event.newValue === null && userRef.current) {
        clearCachedAuthState()
        if (window.location.pathname !== '/login') window.location.assign('/login')
        return
      }
      expireIfIdle()
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true })
    })
    window.addEventListener('focus', handleActivity)
    window.addEventListener('storage', handleStorageChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const idleInterval = window.setInterval(expireIfIdle, 60_000)

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity)
      })
      window.removeEventListener('focus', handleActivity)
      window.removeEventListener('storage', handleStorageChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.clearInterval(idleInterval)
    }
  }, [clearCachedAuthState, expireIfIdle, recordActivity])

  const isSuperAdmin = Boolean(
    profileData?.role === 'superadmin' ||
    user?.user_metadata?.role === 'superadmin' ||
    user?.app_metadata?.role === 'superadmin'
  )

  const value = {
    session,
    user,
    loading,
    isRoleLoading,
    isAdmin,
    isSuperAdmin,
    profileData,
    checkRole,
    twoFactorChallenge,
    isTwoFactorVerified,
    signIn,
    signInWithGoogle,
    verifyTwoFactor,
    resendTwoFactorCode,
    logSecurityEvent,
    getTwoFactorSettings,
    signUp: (data) => supabase.auth.signUp(data),
    signOut: async (options) => {
      const currentUser = userRef.current
      clearCachedAuthState()
      const logPromise = logSecurityEvent(
        options?.scope === 'global' ? 'global_logout' : 'logout',
        {
          userId: currentUser?.id,
          email: currentUser?.email,
        }
      ).catch((err) => devLog('SignOut audit log error:', err?.message))

      const signOutPromise = supabase.auth
        .signOut(options)
        .catch((err) => devLog('Supabase signOut error:', err?.message))

      await Promise.race([
        Promise.all([logPromise, signOutPromise]),
        new Promise((resolve) => setTimeout(resolve, 150)),
      ])
    },
  }

  return (
    <AuthContext.Provider value={value}>
      {bootError ? (
        <AuthBootError error={bootError} onRetry={() => window.location.reload()} />
      ) : (
        children
      )}
    </AuthContext.Provider>
  )
}
