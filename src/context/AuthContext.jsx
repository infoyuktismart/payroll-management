/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { devLog } from '../lib/devLogger'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [profileData, setProfileData] = useState(null)

    const checkRole = async (userId) => {
        try {
            // Do not set loading to true here as it causes the entire React tree to unmount and lose state during updates.
            devLog('AuthContext: Starting checkRole for:', userId)
            const adminRoles = [
                'admin', 'hr', 'hr_manager', 'hr_admin',
                'hr manager', 'hr-admin', 'hr-manager',
                'hr_admin_manager', 'hr administrator',
                'administrator', 'superadmin', 'hr_head',
                'hr_executive', 'human resources'
            ]

            const isRoleAdmin = (role) => {
                const normalized = role?.toLowerCase()?.trim()
                const isMatch = adminRoles.includes(normalized)
                devLog(`AuthContext: Checking role: "${role}" -> normalized: "${normalized}" -> isMatch: ${isMatch}`)
                return isMatch
            }

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

            devLog('Profiles Table Result:', { profile, profileErr })

            if (profile && isRoleAdmin(profile.role)) {
                isUserAdmin = true
            }

            devLog('Employees Table Result:', { employee, employeeErr })

            if (employee) {
                if (isRoleAdmin(employee.role)) {
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

            // ATOMIC UPDATE: Set everything at once to prevent flickering
            setIsAdmin(isUserAdmin)
            setProfileData(finalProfileData)
            setLoading(false)
        } catch (e) {
            console.error('Error in AuthContext checkRole:', e)
            setIsAdmin(false)
            setLoading(false)
        }
    }

    useEffect(() => {
        devLog('AuthContext: Security Patch Loaded')
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) checkRole(session.user.id)
            else setLoading(false)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) checkRole(session.user.id)
            else {
                setIsAdmin(false)
                setProfileData(null)
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const value = {
        session,
        user,
        loading,
        isAdmin,
        profileData,
        signIn: (data) => supabase.auth.signInWithPassword(data),
        signUp: (data) => supabase.auth.signUp(data),
        signOut: () => supabase.auth.signOut(),
    }

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    )
}
