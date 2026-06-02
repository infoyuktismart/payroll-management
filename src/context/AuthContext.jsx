/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { devLog, logger } from '../lib/devLogger'
import { isAdminRole } from '../constants/roles'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

const TWO_FACTOR_SESSION_KEY = 'payroll_2fa_verified_user'
const AUTH_LAST_ACTIVITY_KEY = 'payroll_auth_last_activity_at'
const AUTH_BOOT_TIMEOUT_MS = 10_000
const AUTH_IDLE_TIMEOUT_MS = 60 * 60 * 1000
const ACTIVITY_WRITE_THROTTLE_MS = 30_000

const withTimeout = (promise, timeoutMs, label) => {
    let timerId
    const timeout = new Promise((_, reject) => {
        timerId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`)), timeoutMs)
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

const AuthBootScreen = ({ message = 'Starting application...' }) => (
    <div
        role="status"
        aria-live="polite"
        aria-label={message}
        className="min-h-screen flex items-center justify-center bg-slate-50 px-6"
    >
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-8 py-7 text-center shadow-xl shadow-slate-200/70">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-700" aria-hidden="true" />
            <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-900">Payroll Management</p>
                <p className="mt-2 text-sm font-semibold text-slate-500">{message}</p>
            </div>
        </div>
    </div>
)

const AuthBootError = ({ error, onRetry }) => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-xl rounded-2xl border border-rose-200 bg-white p-7 shadow-xl shadow-slate-200/70">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-600">Application startup blocked</p>
            <h1 className="mt-3 text-2xl font-black text-slate-950">Unable to initialize login session</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
                The application could not complete the initial Supabase auth check. This usually means the network,
                Supabase URL/key, or session verification query is failing before the dashboard can render.
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
    else if (/Android/i.test(ua)) { os = 'Android'; deviceType = 'mobile' }
    else if (/iPhone|iPad/i.test(ua)) { os = 'iOS'; deviceType = 'mobile' }
    else if (/Linux/i.test(ua)) os = 'Linux'

    return { browser, os, deviceType, userAgent: ua }
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)
    const userRef = useRef(null)
    const sessionTokenRef = useRef(null)
    const lastRoleCheckRef = useRef({ userId: null, at: 0 })
    const lastActivityWriteRef = useRef(0)
    const [isAdmin, setIsAdmin] = useState(() => {
        if (typeof window === 'undefined') return false
        try {
            return JSON.parse(localStorage.getItem('payroll_auth_is_admin') || 'false')
        } catch { return false }
    })
    const [profileData, setProfileData] = useState(() => {
        if (typeof window === 'undefined') return null
        try {
            return JSON.parse(localStorage.getItem('payroll_auth_profile_data') || 'null')
        } catch { return null }
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
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            const { browser, os, deviceType, userAgent } = getBrowserInfo()
            const eventMetadata = {
                email: currentUser?.email,
                ...metadata
            }
            await supabase.from('security_session_logs').insert({
                user_id: currentUser?.id || metadata.userId || null,
                event_type: eventType,
                user_agent: userAgent,
                device_type: deviceType,
                browser,
                os,
                metadata: eventMetadata
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

    const checkRole = async (userId) => {
        const now = Date.now()
        if (
            lastRoleCheckRef.current.userId === userId &&
            profileData !== null &&
            isAdmin !== null &&
            now - lastRoleCheckRef.current.at < 7200_000
        ) {
            devLog('AuthContext: Skipping duplicate role check for:', userId)
            setLoading(false)
            return
        }
        lastRoleCheckRef.current = { userId, at: now }

        try {
            // Do not set loading to true here as it causes the entire React tree to unmount and lose state during updates.
            devLog('AuthContext: Starting checkRole for:', userId)
            let isUserAdmin = false
            let finalProfileData = null

            // Execute both profile and employee lookups in parallel
            const [profileRes, employeeRes] = await Promise.all([
                supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
                supabase.from('employees').select('first_name, last_name, role, employee_id, registration_id').eq('user_id', userId).maybeSingle()
            ])

            const profile = profileRes.data
            const profileErr = profileRes.error
            const employee = employeeRes.data
            const employeeErr = employeeRes.error

            if (profileErr || employeeErr) {
                devLog('AuthContext: Database query failed, throwing to preserve session:', profileErr || employeeErr)
                throw new Error(profileErr?.message || employeeErr?.message || 'Database query error during checkRole')
            }

            devLog('Profiles Table Result:', { profile, profileErr })

            if (profile && isAdminRole(profile.role)) {
                isUserAdmin = true
            }

            devLog('Employees Table Result:', { employee, employeeErr })

            if (employee) {
                if (isAdminRole(employee.role)) {
                    isUserAdmin = true
                }

                finalProfileData = {
                    firstName: employee.first_name,
                    lastName: employee.last_name,
                    role: employee.role || profile?.role || 'Employee',
                    employeeId: employee.employee_id || employee.registration_id || 'N/A'
                }
            } else {
                finalProfileData = {
                    firstName: 'Guest',
                    lastName: 'User',
                    role: profile?.role || 'guest',
                    employeeId: 'N/A'
                }
            }

            devLog('Final Determination:', { isUserAdmin, finalProfileData })

            // ATOMIC UPDATE: Only update state if values changed to prevent redundant re-renders
            setIsAdmin(prev => prev !== isUserAdmin ? isUserAdmin : prev)
            setProfileData(prev => {
                if (!prev) return finalProfileData
                const changed = prev.firstName !== finalProfileData.firstName ||
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

            setLoading(false)
        } catch (e) {
            logger.error('Error in AuthContext checkRole:', e)
            if (typeof window !== 'undefined' && (!navigator.onLine || !isInvalidSessionError(e))) {
                devLog('AuthContext: Network error or transient DB error. Retaining cached credentials:', e?.message)
            } else {
                setIsAdmin(prev => prev !== false ? false : prev)
                setProfileData(prev => prev !== null ? null : prev)
                if (typeof window !== 'undefined') {
                    try {
                        localStorage.removeItem('payroll_auth_is_admin')
                        localStorage.removeItem('payroll_auth_profile_data')
                    } catch (err) {
                        devLog('Failed to clear cached auth state:', err)
                    }
                }
            }
            setLoading(false)
        }
    }

    const clearCachedAuthState = useCallback(() => {
        setIsAdmin(false)
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
                devLog('AuthContext: Cached session is no longer valid. Clearing local auth state.', error?.message)
                clearCachedAuthState()
                await supabase.auth.signOut()
                return null
            }

            devLog('AuthContext: User verification failed without an invalid-session signal. Keeping cached session.', error?.message)
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
    }, [])

    const signIn = async (credentials) => {
        clearTwoFactorVerified()

        const response = await supabase.auth.signInWithPassword(credentials)
        if (response.error) return response
        recordActivity(true)

        const signedInUser = response.data?.user
        await logSecurityEvent('password_login', { email: credentials.email, userId: signedInUser?.id })

        if (!signedInUser?.id) return response

        const settings = await getTwoFactorSettings(signedInUser.id)
        if (!settings?.enabled) {
            markTwoFactorVerified(signedInUser.id)
            return response
        }

        const otpResponse = await supabase.auth.signInWithOtp({
            email: signedInUser.email || credentials.email,
            options: { shouldCreateUser: false }
        })

        if (otpResponse.error) return { data: response.data, error: otpResponse.error }

        setTwoFactorChallenge({
            userId: signedInUser.id,
            email: signedInUser.email || credentials.email,
            expiresAt: Date.now() + (10 * 60 * 1000)
        })
        await logSecurityEvent('2fa_challenge_sent', { email: signedInUser.email || credentials.email, userId: signedInUser.id })

        return {
            data: response.data,
            error: null,
            twoFactorRequired: true
        }
    }

    const signInWithGoogle = async () => {
        clearTwoFactorVerified()
        recordActivity(true)
        const redirectUrl = `${window.location.origin}/dashboard`
        const response = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl
            }
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
            type: 'email'
        })

        if (error) {
            await logSecurityEvent('2fa_failed', { email: twoFactorChallenge.email, userId: twoFactorChallenge.userId })
            return { data, error }
        }

        markTwoFactorVerified(twoFactorChallenge.userId)
        await supabase
            .from('user_2fa_settings')
            .update({ last_verified_at: new Date().toISOString() })
            .eq('user_id', twoFactorChallenge.userId)
            .eq('method', 'email_otp')
        await logSecurityEvent('2fa_verified', { email: twoFactorChallenge.email, userId: twoFactorChallenge.userId })
        return { data, error: null }
    }

    const resendTwoFactorCode = async () => {
        if (!twoFactorChallenge?.email) {
            return { error: new Error('No active two-factor challenge found.') }
        }

        const response = await supabase.auth.signInWithOtp({
            email: twoFactorChallenge.email,
            options: { shouldCreateUser: false }
        })

        if (!response.error) {
            await logSecurityEvent('2fa_challenge_sent', {
                email: twoFactorChallenge.email,
                userId: twoFactorChallenge.userId,
                resent: true
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
            if (fallbackSession?.user && isTimeoutError(error)) {
                devLog('AuthContext auth check timed out. Keeping existing cached session:', error?.message)
                setSession(fallbackSession)
                setUser(fallbackSession.user)
                recordActivity(true)
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
                const { data: { session } } = await withTimeout(
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
                    devLog('AuthContext: Initial user verification timed out. Continuing with cached session.')
                    verifiedUser = session.user
                }
                if (!isMounted) return

                applyAuthState(verifiedUser, verifiedUser ? session : null)
                if (verifiedUser) {
                    if (!localStorage.getItem(AUTH_LAST_ACTIVITY_KEY) || isIdleSessionExpired()) recordActivity(true)
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
                                expiresAt: Date.now() + (10 * 60 * 1000)
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

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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
                                    expiresAt: Date.now() + (10 * 60 * 1000)
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
                const { data: { user }, error } = await supabase.auth.getUser()
                
                if (error && (
                    error.status === 401 || 
                    error.status === 403 ||
                    error.code === '401' || 
                    error.code === '403' ||
                    error.message?.includes('JWT') || 
                    error.message?.includes('claims') || 
                    error.message?.includes('invalid signature') ||
                    error.message?.includes('session missing')
                )) {
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

    const value = {
        session,
        user,
        loading,
        isAdmin,
        profileData,
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
            await logSecurityEvent(options?.scope === 'global' ? 'global_logout' : 'logout')
            clearTwoFactorVerified()
            if (typeof window !== 'undefined') {
                try {
                    localStorage.removeItem('payroll_auth_is_admin')
                    localStorage.removeItem('payroll_auth_profile_data')
                } catch (err) {
                    devLog('Failed to clear cached auth state:', err)
                }
            }
            return supabase.auth.signOut(options)
        },
    }

    return (
        <AuthContext.Provider value={value}>
            {bootError ? (
                <AuthBootError error={bootError} onRetry={() => window.location.reload()} />
            ) : loading ? (
                <AuthBootScreen message="Checking secure session..." />
            ) : children}
        </AuthContext.Provider>
    )
}
