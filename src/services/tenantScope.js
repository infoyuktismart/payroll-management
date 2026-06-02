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

