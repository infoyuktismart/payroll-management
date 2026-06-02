// =============================================================================
// process-payroll/index.ts
// Supabase Edge Function — Payroll Run Orchestrator
//
// Purpose:
//   1. Validates JWT (admin/HR via is_admin_or_hr() DB function)
//   2. Computes attendance-derived LOP days per employee
//   3. Creates the payroll_run row
//   4. Calls calculate_payroll_engine() RPC for each employee
//   5. Marks the run Completed and returns finalized payslip DTOs
//
// Contract:
//   - This function does ZERO salary arithmetic.
//   - All money values come from the DB engine and are passed through as-is.
//   - The response is the immutable source of truth for the frontend.
// =============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessPayrollRequest {
  month_year: string          // "2025-03" (YYYY-MM)
  run_type?: string           // "regular" | "off_cycle" (default: "regular")
  department_filter?: string  // Filter by department name (optional)
  employee_ids?: string[]     // Process only these employees (optional)
}

interface ComponentLine {
  name: string
  amount: number
  type?: string
  system_type?: string
  custom?: boolean
}

interface EmployerContributions {
  employer_epf: number
  employer_eps: number
  employer_esi: number
  gratuity_provision: number
  lwf_employer: number
  total_employer_share: number
}

interface PayslipDTO {
  payroll_item_id: string
  employee_id: string
  emp_code: string
  name: string
  department: string
  designation: string
  email?: string
  phone?: string
  whatsapp_enabled?: boolean
  // ── SSOT Money fields — frontend reads these directly, never recomputes ──
  basic_salary: number
  total_allowances: number
  gross_salary: number
  total_deductions: number
  net_salary: number
  monthly_ctc: number
  annual_ctc: number
  // ── Attendance ───────────────────────────────────────────────────────────
  lop_days: number
  payable_days: number
  days_in_month: number
  // ── Breakdowns ───────────────────────────────────────────────────────────
  earnings_breakdown: ComponentLine[]
  deductions_breakdown: ComponentLine[]
  employer_contributions: EmployerContributions
  // ── Metadata ─────────────────────────────────────────────────────────────
  finalized_at: string
}

interface BatchSummary {
  run_id: string
  month_year: string
  run_type: string
  status: string
  processed: number
  failed: number
  total_gross_salary: number
  total_deductions: number
  total_net_salary: number
  total_monthly_ctc: number
  total_annual_ctc: number
  payslips: PayslipDTO[]
  errors: Array<{ employee_id: string; name?: string; error: string }>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Compute months remaining in the Indian Financial Year (April–March).
 * Used for TDS projection in the DB engine.
 */
function getMonthsRemaining(year: number, month: number): number {
  // FY ends in March. If we're in April (month 4) → 12 months remaining.
  const fyEndMonth = 3  // March = 3
  const fyEndYear  = month >= 4 ? year + 1 : year
  const monthsLeft = (fyEndYear - year) * 12 + (fyEndMonth - month) + 1
  return Math.max(1, monthsLeft)
}

/**
 * Compute LOP days from attendance records.
 * Applies the same logic as the original hook — moved here so the DB engine
 * receives a clean scalar rather than raw attendance rows.
 */
function computeLopDays(
  employeeId: string,
  attendanceRows: Array<{ employee_id: string; status: string; date: string }>,
  approvedLeaves: Array<{ employee_id: string; start_date: string; end_date: string; status: string }>,
  sundays: string[],
  holidays: string[],
  daysInMonth: number,
  joiningDate?: string | null,
  exitDate?: string | null,
  startDate?: string,
  endDate?: string,
): { lopDays: number; payableDays: number } {
  const empAtt = attendanceRows.filter(a => a.employee_id === employeeId)

  const isOnApprovedLeave = (date: string) =>
    approvedLeaves.some(
      l =>
        l.employee_id === employeeId &&
        date >= l.start_date &&
        date <= l.end_date &&
        l.status === 'approved',
    )

  const absentDays = empAtt.filter(a => {
    const isAbsent = ['Absent', 'absent'].includes(a.status)
    const isSun = sundays.includes(a.date)
    const isHoliday = holidays.includes(a.date)
    const isWO = ['weekly_off', 'Weekly Off'].includes(a.status)
    return isAbsent && !isSun && !isHoliday && !isWO && !isOnApprovedLeave(a.date)
  }).length

  const halfDays = empAtt.filter(a => {
    const isHalf = ['Half Day', 'half_day'].includes(a.status)
    const isSun = sundays.includes(a.date)
    const isHoliday = holidays.includes(a.date)
    const isWO = ['weekly_off', 'Weekly Off'].includes(a.status)
    return isHalf && !isSun && !isHoliday && !isWO && !isOnApprovedLeave(a.date)
  }).length

  // Proration for mid-month joiners/leavers
  let activeDays = daysInMonth
  if (startDate && endDate) {
    const currentMonthStart = new Date(startDate)
    const currentMonthEnd   = new Date(endDate)
    if (joiningDate) {
      const joinDate = new Date(joiningDate)
      if (joinDate > currentMonthStart && joinDate <= currentMonthEnd) {
        const activeMs = currentMonthEnd.getTime() - joinDate.getTime()
        activeDays = Math.ceil(activeMs / 86400000) + 1
      }
    }
    if (exitDate) {
      const exDate = new Date(exitDate)
      if (exDate >= currentMonthStart && exDate < currentMonthEnd) {
        const activeMs = exDate.getTime() - currentMonthStart.getTime()
        activeDays = Math.min(activeDays, Math.ceil(activeMs / 86400000) + 1)
      }
    }
  }

  const lopDays     = absentDays + halfDays * 0.5
  const payableDays = Math.max(0, activeDays - lopDays)
  return { lopDays, payableDays }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // ── Auth: create client with caller's JWT ────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    // Service-role client for engine RPC calls (bypasses RLS after guard check)
    const serviceClient: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Validate caller is admin/HR ──────────────────────────────────────────
    const { data: isAdmin, error: authCheckError } = await supabase
      .rpc('is_admin_or_hr')
    if (authCheckError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: HR or Admin role required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Parse request body ───────────────────────────────────────────────────
    const body: ProcessPayrollRequest = await req.json()
    const { month_year, run_type = 'regular', department_filter, employee_ids } = body

    if (!month_year || !/^\d{4}-\d{2}$/.test(month_year)) {
      return new Response(
        JSON.stringify({ error: 'month_year must be in YYYY-MM format (e.g. "2025-03")' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const [year, month] = month_year.split('-').map(Number)
    const daysInMonth   = getDaysInMonth(year, month)
    const startDate     = `${month_year}-01`
    const endDate       = `${month_year}-${String(daysInMonth).padStart(2, '0')}`
    const monthsRemaining = getMonthsRemaining(year, month)

    // ── Guard: check for existing payroll run ────────────────────────────────
    const { data: existingRun } = await serviceClient
      .from('payroll_runs')
      .select('id, status')
      .eq('month_year', startDate)
      .eq('run_type', run_type)
      .maybeSingle()

    if (existingRun) {
      return new Response(
        JSON.stringify({
          error: `Payroll for ${month_year} (${run_type}) already exists with status "${existingRun.status}". Open Payroll History to view it.`,
          run_id: existingRun.id,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── Fetch employees ──────────────────────────────────────────────────────
    let empQuery = serviceClient
      .from('employees')
      .select('id, employee_id, first_name, last_name, email, phone, whatsapp_enabled, department, designation, salary, joining_date, state, is_specially_abled')
      .neq('status', 'terminated')
      .or('hold_payroll.is.null,hold_payroll.eq.false')
      .order('first_name')

    if (department_filter && department_filter !== 'All Departments') {
      empQuery = empQuery.eq('department', department_filter)
    }
    if (employee_ids?.length) {
      empQuery = empQuery.in('id', employee_ids)
    }

    const { data: employees, error: empError } = await empQuery
    if (empError) throw new Error(`Failed to fetch employees: ${empError.message}`)
    if (!employees?.length) {
      return new Response(
        JSON.stringify({ error: 'No eligible employees found for this payroll run.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── Fetch attendance, leaves, holidays in parallel ───────────────────────
    const [attRes, leavesRes, holidaysRes] = await Promise.all([
      serviceClient
        .from('attendance')
        .select('employee_id, status, date')
        .gte('date', startDate)
        .lte('date', endDate),
      serviceClient
        .from('leaves')
        .select('employee_id, start_date, end_date, status')
        .eq('status', 'approved')
        .lte('start_date', endDate)
        .gte('end_date', startDate),
      serviceClient
        .from('holidays')
        .select('date')
        .gte('date', startDate)
        .lte('date', endDate),
    ])

    const attendanceRows = attRes.data   || []
    const approvedLeaves = leavesRes.data || []
    const holidayDates   = (holidaysRes.data || []).map((h: { date: string }) => h.date)

    // Pre-compute Sundays for this month
    const sundays: string[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d)
      if (date.getDay() === 0) {
        sundays.push(`${month_year}-${String(d).padStart(2, '0')}`)
      }
    }

    // ── Create payroll_run row ───────────────────────────────────────────────
    const { data: newRun, error: runError } = await serviceClient
      .from('payroll_runs')
      .insert({
        month_year:       startDate,
        run_type:         run_type,
        status:           'Draft',
        total_employees:  employees.length,
      })
      .select()
      .single()

    if (runError) throw new Error(`Failed to create payroll run: ${runError.message}`)
    const runId = newRun.id

    // ── Call engine RPC per employee ─────────────────────────────────────────
    const payslips: PayslipDTO[] = []
    const errors: BatchSummary['errors'] = []

    for (const emp of employees) {
      const empFullName = `${emp.first_name} ${emp.last_name}`

      try {
        const { lopDays } = computeLopDays(
          emp.id,
          attendanceRows,
          approvedLeaves,
          sundays,
          holidayDates,
          daysInMonth,
          emp.joining_date,
          null,
          startDate,
          endDate,
        )

        // Call the integer-cents engine in the DB
        const { data: itemId, error: engineError } = await serviceClient.rpc(
          'calculate_payroll_engine',
          {
            p_run_id:           runId,
            p_employee_id:      emp.id,
            p_days_in_month:    daysInMonth,
            p_lop_days:         lopDays,
            p_month:            month,
            p_months_remaining: monthsRemaining,
          },
        )

        if (engineError) throw new Error(engineError.message)

        // Fetch the finalized row to build the response DTO
        const { data: item, error: fetchError } = await serviceClient
          .from('payroll_items')
          .select('*')
          .eq('id', itemId)
          .single()

        if (fetchError) throw new Error(fetchError.message)

        payslips.push({
          payroll_item_id:        item.id,
          employee_id:            emp.id,
          emp_code:               emp.employee_id || '',
          name:                   empFullName,
          email:                  emp.email || '',
          phone:                  emp.phone || '',
          whatsapp_enabled:       emp.whatsapp_enabled || false,
          department:             emp.department || '',
          designation:            emp.designation || '',
          // ── SSOT Money — straight from DB, no arithmetic ────────────────
          basic_salary:           Number(item.basic_salary),
          total_allowances:       Number(item.total_allowances),
          gross_salary:           Number(item.gross_salary),
          total_deductions:       Number(item.total_deductions),
          net_salary:             Number(item.net_salary),
          monthly_ctc:            Number(item.monthly_ctc),
          annual_ctc:             Number(item.annual_ctc),
          // ── Attendance ────────────────────────────────────────────────
          lop_days:               Number(item.lop_days),
          payable_days:           Number(item.payable_days),
          days_in_month:          daysInMonth,
          // ── Breakdowns ────────────────────────────────────────────────
          earnings_breakdown:     item.earnings_breakdown  || [],
          deductions_breakdown:   item.deductions_breakdown || [],
          employer_contributions: item.employer_contributions || {},
          finalized_at:           item.finalized_at,
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push({ employee_id: emp.id, name: empFullName, error: msg })
        console.error(`[process-payroll] Engine failed for ${empFullName}:`, msg)
      }
    }

    // ── Mark run as Completed ────────────────────────────────────────────────
    const totalNet    = payslips.reduce((s, p) => s + p.net_salary, 0)
    const totalGross  = payslips.reduce((s, p) => s + p.gross_salary, 0)
    const totalCtc    = payslips.reduce((s, p) => s + p.monthly_ctc, 0)
    const finalStatus = errors.length === 0 ? 'Completed' : 'Draft'

    await serviceClient
      .from('payroll_runs')
      .update({
        status:           finalStatus,
        total_amount:     totalNet,
        total_employees:  payslips.length,
        processed_at:     new Date().toISOString(),
      })
      .eq('id', runId)

    // ── Build response summary ───────────────────────────────────────────────
    const summary: BatchSummary = {
      run_id:              runId,
      month_year:          month_year,
      run_type:            run_type,
      status:              finalStatus,
      processed:           payslips.length,
      failed:              errors.length,
      total_gross_salary:  Number(totalGross.toFixed(2)),
      total_deductions:    Number(payslips.reduce((s, p) => s + p.total_deductions, 0).toFixed(2)),
      total_net_salary:    Number(totalNet.toFixed(2)),
      total_monthly_ctc:   Number(totalCtc.toFixed(2)),
      total_annual_ctc:    Number(payslips.reduce((s, p) => s + p.annual_ctc, 0).toFixed(2)),
      payslips,
      errors,
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    console.error('[process-payroll] Fatal error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
