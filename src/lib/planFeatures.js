export const PLAN_FEATURES = {
    core_hr: {
        label: 'Core HR',
        minimumPlan: 'starter',
    },
    payroll: {
        label: 'Payroll Processing',
        minimumPlan: 'starter',
    },
    attendance: {
        label: 'Attendance',
        minimumPlan: 'starter',
    },
    statutory_reports: {
        label: 'Statutory Reports',
        minimumPlan: 'starter',
    },
    employee_portal: {
        label: 'Employee Portal',
        minimumPlan: 'starter',
    },
    multi_company: {
        label: 'Multi-company',
        minimumPlan: 'growth',
    },
    analytics: {
        label: 'Analytics',
        minimumPlan: 'growth',
    },
    biometric_import: {
        label: 'Biometric Import',
        minimumPlan: 'growth',
    },
    report_builder: {
        label: 'Report Builder',
        minimumPlan: 'growth',
    },
    audit_logs: {
        label: 'Audit Logs',
        minimumPlan: 'enterprise',
    },
    security_controls: {
        label: 'Advanced Security',
        minimumPlan: 'enterprise',
    },
    system_health: {
        label: 'System Health',
        minimumPlan: 'enterprise',
    },
    white_labeling: {
        label: 'White Labelling',
        minimumPlan: 'enterprise',
    },
}

export const PLAN_FEATURE_SETS = {
    starter: [
        'core_hr',
        'payroll',
        'attendance',
        'statutory_reports',
        'employee_portal',
    ],
    growth: [
        'core_hr',
        'payroll',
        'attendance',
        'statutory_reports',
        'employee_portal',
        'multi_company',
        'analytics',
        'biometric_import',
        'report_builder',
    ],
    enterprise: [
        'core_hr',
        'payroll',
        'attendance',
        'statutory_reports',
        'employee_portal',
        'multi_company',
        'analytics',
        'biometric_import',
        'report_builder',
        'audit_logs',
        'security_controls',
        'system_health',
        'white_labeling',
    ],
}

export const ROUTE_FEATURES = {
    '/analytics': 'analytics',
    '/biometric-import': 'biometric_import',
    '/report-builder': 'report_builder',
    '/audit-logs': 'audit_logs',
    '/security-settings': 'security_controls',
    '/security/2fa': 'security_controls',
    '/system-health': 'system_health',
}

export const getFeatureLabel = (featureKey) => PLAN_FEATURES[featureKey]?.label || 'This feature'

export const planAllowsFeature = (planCode, featureKey, explicitFeatures = []) => {
    if (!featureKey) return true
    const code = String(planCode || '').toLowerCase()
    const normalizedExplicitFeatures = (explicitFeatures || [])
        .map(feature => String(feature || '').toLowerCase())
    return normalizedExplicitFeatures.includes(featureKey) || (PLAN_FEATURE_SETS[code] || []).includes(featureKey)
}

export const normalizePlanFeatureKeys = (plan) => {
    const planFeatures = Array.isArray(plan?.feature_keys) ? plan.feature_keys : []
    return planFeatures.length > 0 ? planFeatures : PLAN_FEATURE_SETS[String(plan?.plan_code || '').toLowerCase()] || []
}
