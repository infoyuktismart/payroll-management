declare const Deno: any;

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type RevisionPayload = {
  componentName: string
  componentCode: string
  newValue: number
  companyId?: string
}

serve(async (req: Request) => {
  // 1. Handle CORS preflight request early
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase service configuration is missing on the host.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Authorize User and check permission
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authentication credentials.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid auth token or session expired.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Service Role Client for database bypass writes and RLS bypasses.
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: { Authorization: `Bearer ${serviceRoleKey}` }
      }
    })

    // Get user role from profiles
    const { data: profile, error: profileErr } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileErr || !profile || !['admin', 'hr', 'superadmin'].includes(String(profile.role).toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Access denied: You do not have permission to perform bulk salary revisions.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Parse and Validate Payload
    const payload = (await req.json()) as RevisionPayload
    const componentName = String(payload.componentName || '').trim()
    const componentCode = String(payload.componentCode || '').trim()

    // Parse to Float, then fix to 2 decimals to prevent Javascript Math glitches
    const newValue = Number(parseFloat(String(payload.newValue)).toFixed(2))
    const companyId = payload.companyId

    if (!componentName || !componentCode || Number.isNaN(newValue)) {
      return new Response(
        JSON.stringify({ error: 'componentName, componentCode, and newValue are strictly required fields.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Fetch Active Employees (FIX: Added limit 10000 to prevent silent PostgREST 1000 row cap)
    let empQuery = serviceClient
      .from('employees')
      .select('id, first_name, last_name, salary_structure')
      .eq('status', 'active')
      .limit(10000)

    if (companyId) {
      empQuery = empQuery.eq('company_id', companyId)
    }

    const { data: employees, error: fetchErr } = await empQuery
    if (fetchErr) throw fetchErr

    if (!employees || employees.length === 0) {
      return new Response(
        JSON.stringify({ success: true, updatedCount: 0, skippedCount: 0, warnings: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let updatedCount = 0
    let skippedCount = 0
    const warnings: Array<{ name: string; reason: string }> = []
    const updates: Array<{ id: string; salary_structure: any; salary_effective_date: string }> = []

    // 4. Processing Loop
    for (const emp of employees) {
      const structure = emp.salary_structure
      if (!structure) {
        skippedCount++
        continue
      }

      let targetComponent: any = null
      let balancingComponent: any = null

      // Case A: JSONB is an Array of Objects
      if (Array.isArray(structure)) {
        // FIX: Added optional chaining (c?.code) to prevent crashes on malformed JSON
        targetComponent = structure.find((c: any) =>
          String(c?.code).toUpperCase() === componentCode.toUpperCase() ||
          String(c?.label).toLowerCase() === componentName.toLowerCase() ||
          String(c?.name).toLowerCase() === componentName.toLowerCase()
        )

        balancingComponent = structure.find((c: any) =>
          String(c?.code).toUpperCase() === 'SA' ||
          String(c?.label).toLowerCase().includes('special allowance') ||
          String(c?.name).toLowerCase().includes('special allowance')
        )

        if (!targetComponent) {
          skippedCount++
          continue
        }

        const oldValue = Number(targetComponent.value) || 0
        // Math rounding fix
        const difference = Number((newValue - oldValue).toFixed(2))

        if (difference === 0) {
          skippedCount++
          continue
        }

        if (!balancingComponent) {
          warnings.push({
            name: `${emp.first_name} ${emp.last_name}`,
            reason: 'Special Allowance (balancing component) not configured in their structure.'
          })
          continue
        }

        const oldSA = Number(balancingComponent.value) || 0
        const newSA = Number((oldSA - difference).toFixed(2))

        if (newSA < 0) {
          warnings.push({
            name: `${emp.first_name} ${emp.last_name}`,
            reason: `Insufficient Special Allowance. Adjusting would make it negative (₹${newSA}).`
          })
          continue
        }

        const newStructure = structure.map((c: any) => {
          if (c === targetComponent) {
            return { ...c, value: newValue }
          }
          if (c === balancingComponent) {
            return { ...c, value: newSA }
          }
          return c
        })

        updates.push({
          id: emp.id,
          salary_structure: newStructure,
          salary_effective_date: new Date().toISOString().split('T')[0]
        })
        updatedCount++

      } else if (typeof structure === 'object' && structure !== null) {
        // Case B: JSONB is a Dictionary Object
        let targetKey: string | null = null
        let balancingKey: string | null = null

        for (const key of Object.keys(structure)) {
          const comp = structure[key]
          if (!comp) continue; // Skip null values

          const isTarget = key.toLowerCase() === componentCode.toLowerCase() ||
            String(comp?.code).toUpperCase() === componentCode.toUpperCase() ||
            String(comp?.label).toLowerCase() === componentName.toLowerCase() ||
            String(comp?.name).toLowerCase() === componentName.toLowerCase()
          if (isTarget) {
            targetKey = key
            targetComponent = comp
          }

          const isBalancing = key.toLowerCase() === 'special_allowance' ||
            String(comp?.code).toUpperCase() === 'SA' ||
            String(comp?.label).toLowerCase().includes('special allowance') ||
            String(comp?.name).toLowerCase().includes('special allowance')
          if (isBalancing) {
            balancingKey = key
            balancingComponent = comp
          }
        }

        if (!targetKey || !targetComponent) {
          skippedCount++
          continue
        }

        const oldValue = Number(targetComponent.value) || 0
        const difference = Number((newValue - oldValue).toFixed(2))

        if (difference === 0) {
          skippedCount++
          continue
        }

        if (!balancingKey || !balancingComponent) {
          warnings.push({
            name: `${emp.first_name} ${emp.last_name}`,
            reason: 'Special Allowance (balancing component) not configured in their structure.'
          })
          continue
        }

        const oldSA = Number(balancingComponent.value) || 0
        const newSA = Number((oldSA - difference).toFixed(2))

        if (newSA < 0) {
          warnings.push({
            name: `${emp.first_name} ${emp.last_name}`,
            reason: `Insufficient Special Allowance. Adjusting would make it negative (₹${newSA}).`
          })
          continue
        }

        const newStructure = {
          ...structure,
          [targetKey]: { ...targetComponent, value: newValue },
          [balancingKey]: { ...balancingComponent, value: newSA }
        }

        updates.push({
          id: emp.id,
          salary_structure: newStructure,
          salary_effective_date: new Date().toISOString().split('T')[0]
        })
        updatedCount++
      }
    }

    // 5. Commit through a trusted RPC so the employee self-update trigger sees
    // the system-update flag in the same database context as the writes.
    if (updates.length > 0) {
      console.log(`[bulk-salary-revision] Committing ${updates.length} employee updates through trusted RPC...`)

      const { data: rpcResult, error: rpcError } = await serviceClient
        .rpc('bulk_update_employee_salary_revisions', { p_updates: updates })

      if (rpcError) {
        console.error('Bulk salary revision RPC failed:', rpcError)
        throw new Error(`Failed to update employee salary revisions. ${rpcError.message}`)
      }

      const committedCount = Array.isArray(rpcResult)
        ? Number(rpcResult[0]?.updated_count || 0)
        : Number((rpcResult as any)?.updated_count || rpcResult || 0)

      if (committedCount !== updates.length) {
        throw new Error(`Expected to update ${updates.length} employees, but committed ${committedCount}.`)
      }
    }

    return new Response(
      JSON.stringify({ success: true, updatedCount, skippedCount, warnings }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[bulk-salary-revision] Error:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
