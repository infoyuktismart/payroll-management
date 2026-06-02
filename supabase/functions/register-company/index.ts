declare const Deno: any;

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type RegisterPayload = {
  companyName: string
  companyCode: string
  firstName: string
  lastName: string
  email: string
  password: string
  planCode?: string
  billingModel?: string
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const cleanText = (value: unknown) => String(value || '').trim()

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '').trim()
    if (message) return message
  }
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

const findUserByEmail = async (serviceClient: any, email: string) => {
  const normalizedEmail = email.toLowerCase()

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    })

    if (error) throw error

    const user = data?.users?.find((item: any) => item.email?.toLowerCase() === normalizedEmail)
    if (user) return user
    if (!data?.users || data.users.length < 1000) return null
  }

  return null
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase service configuration is missing.' }, 500)
    }

    const payload = await req.json() as RegisterPayload
    const companyName = cleanText(payload.companyName)
    const companyCode = cleanText(payload.companyCode).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    const firstName = cleanText(payload.firstName)
    const lastName = cleanText(payload.lastName)
    const email = cleanText(payload.email).toLowerCase()
    const password = String(payload.password || '')
    const planCode = cleanText(payload.planCode || 'growth').toLowerCase()
    const billingModel = cleanText(payload.billingModel || 'per_employee').toLowerCase()

    if (!companyName || companyCode.length < 2 || !firstName || !lastName || !email || password.length < 8) {
      return jsonResponse({ error: 'Company, admin, email, and 8-character password details are required.' }, 400)
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: duplicateCompany, error: companyCheckError } = await serviceClient
      .from('companies')
      .select('id')
      .eq('code', companyCode)
      .maybeSingle()

    if (companyCheckError && companyCheckError.code !== 'PGRST116') throw companyCheckError
    if (duplicateCompany?.id) {
      return jsonResponse({ error: `Company code ${companyCode} is already taken.` }, 409)
    }

    let authUser = await findUserByEmail(serviceClient, email)
    if (authUser?.id) {
      const { data: existingEmployee, error: employeeCheckError } = await serviceClient
        .from('employees')
        .select('id, company_id')
        .eq('user_id', authUser.id)
        .maybeSingle()

      if (employeeCheckError && employeeCheckError.code !== 'PGRST116') throw employeeCheckError
      if (existingEmployee?.id) {
        return jsonResponse({ error: 'This email is already attached to an existing company account.' }, 409)
      }
    }

    if (authUser) {
      const { data, error } = await serviceClient.auth.admin.updateUserById(authUser.id, {
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          trial_admin: true,
        },
      })
      if (error) throw error
      authUser = data.user
    } else {
      const { data, error } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          trial_admin: true,
        },
      })
      if (error) throw error
      authUser = data.user
    }

    if (!authUser?.id) {
      throw new Error('Admin authentication account could not be created.')
    }

    const { data: workspace, error: workspaceError } = await serviceClient.rpc('setup_trial_workspace', {
      p_company_name: companyName,
      p_company_code: companyCode,
      p_first_name: firstName,
      p_last_name: lastName,
      p_email: email,
      p_user_id: authUser.id,
      p_plan_code: planCode,
      p_billing_model: billingModel,
    })

    if (workspaceError) throw workspaceError

    return jsonResponse({
      success: true,
      user_id: authUser.id,
      company_id: workspace?.company_id,
      branch_id: workspace?.branch_id,
      employee_id: workspace?.employee_id,
      plan_code: workspace?.plan_code,
      trial_ends_at: workspace?.trial_ends_at,
    })
  } catch (error) {
    console.error('register-company failed:', error)
    const message = getErrorMessage(error, 'Unable to register company trial.')
    return jsonResponse({ error: message }, 500)
  }
})
