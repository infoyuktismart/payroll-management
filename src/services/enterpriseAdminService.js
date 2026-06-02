import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId, withCompanyScope } from './tenantScope'
import { planEntitlementService } from './planEntitlementService'

const emptyOnMissing = async (query, missingCodes = ['42P01', '42703']) => {
    const { data, error, count } = await query
    if (error && missingCodes.includes(error.code)) return { data: [], count: 0, missing: true }
    if (error) throw error
    return { data: data || [], count }
}

const singleOrNullOnMissing = async (query, missingCodes = ['42P01', '42703']) => {
    const { data, error } = await query
    if (error && missingCodes.includes(error.code)) return null
    if (error && error.code !== 'PGRST116') throw error
    return data || null
}

export const enterpriseAdminService = {
    async getAuditLogs({ tableName = 'all', action = 'all', fromDate, toDate, page = 0, pageSize = 50 } = {}) {
        return withRetry(async () => {
            await planEntitlementService.assertFeature('audit_logs')
            let query = supabase
                .from('audit_logs')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })

            const companyId = getActiveCompanyId()
            if (companyId) query = query.or(`company_id.eq.${companyId},company_id.is.null`)
            if (tableName !== 'all') query = query.eq('table_name', tableName)
            if (action !== 'all') query = query.eq('action', action)
            if (fromDate) query = query.gte('created_at', `${fromDate}T00:00:00`)
            if (toDate) query = query.lte('created_at', `${toDate}T23:59:59`)

            const { data, count } = await emptyOnMissing(query.range(page * pageSize, (page + 1) * pageSize - 1))
            return { data, count: count || 0, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) }
        })
    },

    async getSubscriptionDashboard() {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            const [plansRes, subscription, usageRes, companiesRes, employeesRes, branchesRes] = await Promise.all([
                emptyOnMissing(supabase.from('subscription_plans').select('*').order('sort_order')),
                singleOrNullOnMissing(applyCompanyFilter(supabase
                    .from('company_subscriptions')
                    .select('*, plan:subscription_plans(*)')).maybeSingle()),
                emptyOnMissing(applyCompanyFilter(supabase.from('subscription_usage_counters').select('*').order('metric_key'))),
                emptyOnMissing(supabase.from('companies').select('id', { count: 'exact', head: true })),
                emptyOnMissing(applyCompanyFilter(supabase.from('employees').select('id', { count: 'exact', head: true }))),
                emptyOnMissing(companyId
                    ? supabase.from('branches').select('id', { count: 'exact', head: true }).eq('company_id', companyId)
                    : supabase.from('branches').select('id', { count: 'exact', head: true }))
            ])

            return {
                plans: plansRes.data,
                subscription,
                usageCounters: usageRes.data,
                liveUsage: {
                    companies: companiesRes.count || 0,
                    employees: employeesRes.count || 0,
                    branches: branchesRes.count || 0
                }
            }
        })
    },

    async updateCompanySubscription(payload) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            const scoped = withCompanyScope({
                ...payload,
                company_id: payload.company_id || companyId
            })
            const { data, error } = await supabase
                .from('company_subscriptions')
                .upsert(scoped, { onConflict: 'company_id' })
                .select('*, plan:subscription_plans(*)')
                .single()
            if (error) throw error
            return data
        })
    },

    async refreshUsageCounters() {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            if (!companyId) return []

            const [employeesRes, branchesRes, subscription] = await Promise.all([
                supabase.from('employees').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
                supabase.from('branches').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
                singleOrNullOnMissing(supabase.from('company_subscriptions').select('plan:subscription_plans(*)').eq('company_id', companyId).maybeSingle())
            ])
            if (employeesRes.error) throw employeesRes.error
            if (branchesRes.error) throw branchesRes.error

            const plan = subscription?.plan || {}
            const periodStart = new Date()
            periodStart.setDate(1)
            const period = periodStart.toISOString().slice(0, 10)
            const rows = [
                { company_id: companyId, metric_key: 'employees', metric_value: employeesRes.count || 0, metric_limit: plan.max_employees, period_start: period, source: 'live_refresh' },
                { company_id: companyId, metric_key: 'branches', metric_value: branchesRes.count || 0, metric_limit: plan.max_branches, period_start: period, source: 'live_refresh' }
            ]

            const { data, error } = await supabase
                .from('subscription_usage_counters')
                .upsert(rows, { onConflict: 'company_id,metric_key,period_start' })
                .select()
            if (error) throw error
            return data || []
        })
    },

    async getSystemHealth() {
        return withRetry(async () => {
            await planEntitlementService.assertFeature('system_health')
            const startedAt = performance.now()
            const [dbRes, auditRes, mailRes, securityRes, healthRes, reportRes] = await Promise.all([
                supabase.from('companies').select('id', { count: 'exact', head: true }),
                emptyOnMissing(supabase.from('audit_logs').select('id', { count: 'exact', head: true })),
                emptyOnMissing(applyCompanyFilter(supabase.from('notification_logs').select('*').order('created_at', { ascending: false }).limit(10))),
                emptyOnMissing(supabase.from('security_session_logs').select('*').order('created_at', { ascending: false }).limit(10)),
                emptyOnMissing(supabase.from('system_health_checks').select('*').order('checked_at', { ascending: false }).limit(10)),
                emptyOnMissing(applyCompanyFilter(supabase.from('generated_reports').select('id', { count: 'exact', head: true })))
            ])

            return {
                latencyMs: Math.round(performance.now() - startedAt),
                db: { ok: !dbRes.error, count: dbRes.count || 0, error: dbRes.error?.message },
                auditCount: auditRes.count || 0,
                mailLogs: mailRes.data || [],
                sessionLogs: securityRes.data || [],
                healthChecks: healthRes.data || [],
                reportJobsCount: reportRes.count || 0
            }
        })
    }
}
