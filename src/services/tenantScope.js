export const ACTIVE_COMPANY_STORAGE_KEY = 'payroll_active_company_id'
export const ACTIVE_BRANCH_STORAGE_KEY = 'payroll_active_branch_id'

export const getActiveCompanyId = () => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY) || null
}

export const setActiveCompanyId = (companyId) => {
    if (typeof window === 'undefined') return
    if (companyId) {
        window.localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, companyId)
    } else {
        window.localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY)
    }
}

export const getActiveBranchId = () => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY) || null
}

export const setActiveBranchId = (branchId) => {
    if (typeof window === 'undefined') return
    if (branchId) {
        window.localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, branchId)
    } else {
        window.localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY)
    }
}

export const applyTenantFilter = (query, { companyId = getActiveCompanyId(), branchId = getActiveBranchId() } = {}) => {
    let q = companyId ? query.eq('company_id', companyId) : query
    if (branchId) q = q.eq('branch_id', branchId)
    return q
}

export const applyCompanyFilter = (query, companyId = getActiveCompanyId()) => {
    if (!companyId) return query
    let q = query.eq('company_id', companyId)
    
    // Auto-scope employees table queries by branch if a branch is currently selected
    const activeBranchId = getActiveBranchId()
    if (activeBranchId) {
        const urlStr = q.url?.toString() || ''
        if (urlStr.includes('/employees') || urlStr.includes('/user_company_memberships')) {
            q = q.eq('branch_id', activeBranchId)
        }
    }
    return q
}

export const withCompanyScope = (payload, companyId = getActiveCompanyId()) => {
    if (!companyId || payload?.company_id) return payload
    return { ...payload, company_id: companyId }
}

export const withCompanyScopeList = (items, companyId = getActiveCompanyId()) => {
    return (items || []).map(item => withCompanyScope(item, companyId))
}

/**
 * Syncs the active company ID to the PostgreSQL session config via an RPC call.
 * This sets `app.active_company_id` server-side so that RLS helper functions
 * like `is_active_company_member()` and `get_active_company_id()` can validate
 * tenant scoping at the database level — not just from client-supplied query filters.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {string|null} companyId - UUID of the company to activate in the session
 */
export const syncActiveCompanyToSession = async (supabase, companyId) => {
    if (!companyId) return
    try {
        const { error } = await supabase.rpc('set_active_company', { p_company_id: companyId })
        if (error) {
            console.warn('[TenantScope] Failed to sync active company to DB session:', error.message)
        }
    } catch (err) {
        // Non-fatal: existing RLS policies still protect data via auth.uid()
        console.warn('[TenantScope] set_active_company RPC unavailable:', err.message)
    }
}
