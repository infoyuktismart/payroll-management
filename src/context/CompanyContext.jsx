/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from './ToastContext'
import { useAuth } from './AuthContext'
import { logger } from '../lib/devLogger'
import { getActiveCompanyId, setActiveCompanyId as persistActiveCompanyId, getActiveBranchId, setActiveBranchId as persistActiveBranchId } from '../services/tenantScope'

// Dynamic subdomains parsing helper for multi-tenancy
const getSubdomain = () => {
    const hostname = window.location.hostname
    const parts = hostname.split('.')
    if (parts.length > 2) {
        const sub = parts[0].toLowerCase()
        if (sub !== 'www' && sub !== 'app' && sub !== 'payroll') {
            return sub
        }
    }
    // Simulation query for local developer previews (e.g. localhost:5173?tenant=acme)
    const params = new URLSearchParams(window.location.search)
    const testTenant = params.get('tenant')
    if (testTenant) return testTenant.toLowerCase()
    return null
}

// Convert HEX colors dynamically to hover colors
const darkenColor = (hex, percent) => {
    if (!hex || !hex.startsWith('#')) return hex
    let num = parseInt(hex.slice(1), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) - amt,
        G = (num >> 8 & 0x00FF) - amt,
        B = (num & 0x0000FF) - amt
    return '#' + (0x1000000 + (R < 0 ? 0 : R > 255 ? 255 : R) * 0x10000 + (G < 0 ? 0 : G > 255 ? 255 : G) * 0x100 + (B < 0 ? 0 : B > 255 ? 255 : B)).toString(16).slice(1)
}

const CompanyContext = createContext(null)
const COMPANY_FETCH_DEDUPE_MS = 15_000

export const useCompany = () => {
    const ctx = useContext(CompanyContext)
    if (!ctx) throw new Error('useCompany must be used within a CompanyProvider')
    return ctx
}

export const CompanyProvider = ({ children }) => {
    const { user, isAdmin } = useAuth()
    const toast = useToast()
    const [company, setCompany] = useState(null)
    const [companies, setCompanies] = useState([])
    const [branches, setBranches] = useState([])
    const [activeCompanyId, setActiveCompanyIdState] = useState(getActiveCompanyId())
    const [activeBranchId, setActiveBranchIdState] = useState(getActiveBranchId())
    const [loading, setLoading] = useState(true)
    const inFlightFetchRef = useRef({ key: null, promise: null })
    const lastFetchRef = useRef({ key: null, at: 0 })

    const fetchCompanySettings = useCallback(async (preferredCompanyId = getActiveCompanyId(), options = {}) => {
        const force = Boolean(options?.force)
        const subdomain = getSubdomain()
        const fetchKey = `${subdomain || 'default'}:${preferredCompanyId || 'auto'}`
        const now = Date.now()

        if (!force) {
            if (inFlightFetchRef.current.key === fetchKey && inFlightFetchRef.current.promise) {
                return inFlightFetchRef.current.promise
            }

            if (lastFetchRef.current.key === fetchKey && now - lastFetchRef.current.at < COMPANY_FETCH_DEDUPE_MS) {
                return { skipped: true }
            }
        }

        const fetchPromise = (async () => {
            try {
            setLoading(true)

            // Resolve subdomain scoping
            let resolvedCompanyId = preferredCompanyId

            if (subdomain) {
                logger.info('[CompanyContext] Resolving subdomain:', subdomain)
                const { data: subComp } = await supabase
                    .from('companies')
                    .select('id')
                    .eq('tenant_subdomain', subdomain)
                    .maybeSingle()

                if (subComp?.id) {
                    resolvedCompanyId = subComp.id
                    logger.info('[CompanyContext] Subdomain resolved to company ID:', resolvedCompanyId)
                }
            }

            const [companyRes, settingsRes] = await Promise.all([
                supabase
                    .from('companies')
                    .select('*')
                    .order('name'),
                supabase
                    .from('company_settings')
                    .select('*')
            ])

            if (companyRes.error && companyRes.error.code !== '42P01') throw companyRes.error
            if (settingsRes.error && settingsRes.error.code !== '42P01') throw settingsRes.error

            let availableCompanies = companyRes.data || []

            if (availableCompanies.length === 0) {
                const fallbackSettings = settingsRes.data || []
                availableCompanies = fallbackSettings.map(row => ({
                    id: row.company_id || row.id,
                    name: row.name,
                    code: row.code || 'DEFAULT',
                    legal_name: row.name,
                    status: 'active'
                }))
            }

            if (subdomain && resolvedCompanyId) {
                // Strict multi-tenant boundary: subdomain scopes the switcher options strictly to the single resolved tenant
                availableCompanies = availableCompanies.filter(item => item.id === resolvedCompanyId)
            }

            const selectedId = resolvedCompanyId && availableCompanies.some(item => item.id === resolvedCompanyId)
                ? resolvedCompanyId
                : availableCompanies[0]?.id || null

            setCompanies(availableCompanies)
            setActiveCompanyIdState(selectedId)
            persistActiveCompanyId(selectedId)

            const selectedCompany = availableCompanies.find(item => item.id === selectedId) || null
            const selectedSettings = (settingsRes.data || []).find(row => row.company_id === selectedId || row.id === selectedId) || null

            if (selectedId) {
                const { data: branchRows, error: branchError } = await supabase
                    .from('branches')
                    .select('*')
                    .eq('company_id', selectedId)
                    .order('name')

                if (branchError && branchError.code !== '42P01') throw branchError
                setBranches(branchRows || [])
            } else {
                setBranches([])
            }

            setCompany(selectedSettings ? { ...selectedCompany, ...selectedSettings, id: selectedId } : selectedCompany)
            lastFetchRef.current = { key: fetchKey, at: Date.now() }
        } catch (error) {
            logger.error('Error fetching company settings:', error)

            try {
                const { data, error: fallbackError } = await supabase
                    .from('company_settings')
                    .select('*')
                    .limit(1)
                    .single()

                if (fallbackError && fallbackError.code !== 'PGRST116') throw fallbackError
                setCompany(data || null)
                setCompanies(data ? [{ id: data.company_id || data.id, name: data.name, code: 'DEFAULT' }] : [])
                const fallbackId = data?.company_id || data?.id || null
                setActiveCompanyIdState(fallbackId)
                persistActiveCompanyId(fallbackId)
            } catch (fallbackError) {
                logger.error('Fallback company settings fetch failed:', fallbackError)
            }
        } finally {
            if (inFlightFetchRef.current.key === fetchKey) {
                inFlightFetchRef.current = { key: null, promise: null }
            }
            setLoading(false)
        }
        })()

        inFlightFetchRef.current = { key: fetchKey, promise: fetchPromise }
        return fetchPromise
    }, [])

    const switchCompany = useCallback((companyId) => {
        if (!companyId || companyId === activeCompanyId) return
        setActiveCompanyIdState(companyId)
        persistActiveCompanyId(companyId)
        setActiveBranchIdState(null)
        persistActiveBranchId(null)
        fetchCompanySettings(companyId, { force: true })
        toast.success('Company switched.')
    }, [activeCompanyId, fetchCompanySettings, toast])

    const switchBranch = useCallback((branchId) => {
        setActiveBranchIdState(branchId)
        persistActiveBranchId(branchId)
        toast.success('Branch switched.')
    }, [toast])

    const fetchLegacyCompanySettings = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('company_settings')
                .select('*')
                .limit(1)
                .single()

            if (error) {
                // If no row found, it's fine, we will handle empty state gracefully
                if (error.code !== 'PGRST116') {
                    throw error
                }
            } else {
                setCompany(data)
            }
        } catch (error) {
            logger.error('Error fetching company settings:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (user) {
            fetchCompanySettings()
        } else {
            setCompany(null)
            setCompanies([])
            setBranches([])
            setActiveCompanyIdState(null)
            persistActiveCompanyId(null)
            setActiveBranchIdState(null)
            persistActiveBranchId(null)
            setLoading(false)
        }
    }, [user, fetchCompanySettings])

    // Dynamic White-Labelling Theme CSS Variables Injection
    useEffect(() => {
        if (company) {
            const primaryColor = company.primary_color || '#2563eb'
            const secondaryColor = company.secondary_color || '#4f46e5'

            const primaryHover = darkenColor(primaryColor, 12)
            const primaryLight = company.primary_color ? `${company.primary_color}22` : '#3b82f622'
            const secondaryLight = company.secondary_color ? `${company.secondary_color}22` : '#6366f122'

            document.documentElement.style.setProperty('--color-primary', primaryColor)
            document.documentElement.style.setProperty('--color-primary-hover', primaryHover)
            document.documentElement.style.setProperty('--color-primary-light', primaryLight)
            document.documentElement.style.setProperty('--color-secondary', secondaryColor)
            document.documentElement.style.setProperty('--color-secondary-light', secondaryLight)

            logger.info('[CompanyContext] Dynamic theme colors injected:', { primaryColor, secondaryColor })
        } else {
            document.documentElement.style.removeProperty('--color-primary')
            document.documentElement.style.removeProperty('--color-primary-hover')
            document.documentElement.style.removeProperty('--color-primary-light')
            document.documentElement.style.removeProperty('--color-secondary')
            document.documentElement.style.removeProperty('--color-secondary-light')
        }
    }, [company])

    const updateCompany = async (updates) => {
        try {
            setLoading(true)
            const targetCompanyId = activeCompanyId || company?.company_id || company?.id || getActiveCompanyId()
            
            // Separate brand coloring and subdomain variables targeting public.companies
            const companyFields = ['primary_color', 'secondary_color', 'tenant_subdomain']
            const companyUpdates = {}
            const settingsUpdates = {}

            Object.keys(updates).forEach(key => {
                if (companyFields.includes(key)) {
                    companyUpdates[key] = updates[key]
                } else {
                    settingsUpdates[key] = updates[key]
                }
            })

            // 1. Update public.companies if activeCompanyId is set
            if (Object.keys(companyUpdates).length > 0 && targetCompanyId) {
                const { error: companyError } = await supabase
                    .from('companies')
                    .update(companyUpdates)
                    .eq('id', targetCompanyId)
                
                if (companyError) throw companyError
            }

            // 2. Update company_settings if any compliance updates exist
            if (Object.keys(settingsUpdates).length > 0) {
                const scopedUpdates = targetCompanyId
                    ? { ...settingsUpdates, company_id: settingsUpdates.company_id || targetCompanyId }
                    : settingsUpdates
                
                let existingSettings = null

                if (targetCompanyId) {
                    const { data: byCompanyId, error: byCompanyError } = await supabase
                        .from('company_settings')
                        .select('id')
                        .eq('company_id', targetCompanyId)
                        .maybeSingle()

                    if (byCompanyError) throw byCompanyError
                    existingSettings = byCompanyId

                    if (!existingSettings) {
                        const { data: byLegacyId, error: byLegacyError } = await supabase
                            .from('company_settings')
                            .select('id')
                            .eq('id', targetCompanyId)
                            .maybeSingle()

                        if (byLegacyError) throw byLegacyError
                        existingSettings = byLegacyId
                    }
                }

                if (existingSettings?.id) {
                    const { error } = await supabase
                        .from('company_settings')
                        .update(scopedUpdates)
                        .eq('id', existingSettings.id)
                    if (error) throw error
                } else {
                    const { error } = await supabase
                        .from('company_settings')
                        .insert([scopedUpdates])
                    if (error) throw error
                }
            }

            // Refresh settings to rebuild local state and trigger CSS inject triggers
            await fetchCompanySettings(targetCompanyId, { force: true })

            toast.success('Company settings updated successfully!')
            return { success: true }
        } catch (error) {
            toast.error('Error updating company settings: ' + error.message)
            return { success: false, error }
        } finally {
            setLoading(false)
        }
    }

    const value = {
        company,
        companies,
        branches,
        activeCompanyId,
        selectedBranch: activeBranchId,
        setSelectedBranch: switchBranch,
        isMultiCompany: companies.length > 1,
        loading,
        updateCompany,
        switchCompany,
        refreshCompany: fetchCompanySettings,
        refreshLegacyCompany: fetchLegacyCompanySettings,
        isAdmin
    }

    return (
        <CompanyContext.Provider value={value}>
            {children}
        </CompanyContext.Provider>
    )
}
