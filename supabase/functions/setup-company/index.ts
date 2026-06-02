declare const Deno: any;

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type SetupPayload = {
  companyName: string
  companyCode: string
  firstName: string
  lastName: string
  email: string
  password: string
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

    const payload = await req.json() as SetupPayload
    const companyName = cleanText(payload.companyName)
    const companyCode = cleanText(payload.companyCode).toUpperCase()
    const firstName = cleanText(payload.firstName)
    const lastName = cleanText(payload.lastName)
    const email = cleanText(payload.email).toLowerCase()
    const password = String(payload.password || '')

    if (!companyName || !companyCode || !firstName || !lastName || !email || password.length < 6) {
      return jsonResponse({ error: 'Company, admin, email, and password details are required.' }, 400)
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: firstRun, error: firstRunError } = await serviceClient.rpc('is_first_run')
    if (firstRunError) throw firstRunError
    if (firstRun !== true) {
      return jsonResponse({ error: 'The system has already been initialized.' }, 409)
    }

    let authUser = await findUserByEmail(serviceClient, email)
    let authTriggerDisabled = false

    try {
      if (!authUser) {
        const { error: disableTriggerError } = await serviceClient.rpc('set_first_run_auth_trigger_enabled', {
          p_enabled: false,
        })
        if (disableTriggerError) {
          console.warn('setup-company could not disable auth trigger before user creation:', disableTriggerError)
        } else {
          authTriggerDisabled = true
        }
      }

      if (authUser) {
        const { data, error } = await serviceClient.auth.admin.updateUserById(authUser.id, {
          password,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            setup_admin: true,
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
            setup_admin: true,
          },
        })
        if (error) throw error
        authUser = data.user
      }
    } finally {
      if (authTriggerDisabled) {
        const { error: enableTriggerError } = await serviceClient.rpc('set_first_run_auth_trigger_enabled', {
          p_enabled: true,
        })
        if (enableTriggerError) {
          console.error('setup-company failed to re-enable auth trigger:', enableTriggerError)
        }
      }
    }

    if (!authUser?.id) {
      throw new Error('Admin authentication account could not be created.')
    }

    const { data: setupData, error: setupError } = await serviceClient.rpc('setup_first_run_workspace', {
      p_company_name: companyName,
      p_company_code: companyCode,
      p_first_name: firstName,
      p_last_name: lastName,
      p_email: email,
      p_user_id: authUser.id,
    })

    if (setupError) throw setupError

    return jsonResponse({
      success: true,
      user_id: authUser.id,
      company_id: setupData?.company_id,
      branch_id: setupData?.branch_id,
      employee_id: setupData?.employee_id,
    })
  } catch (error) {
    console.error('setup-company failed:', error)
    const message = getErrorMessage(error, 'Unable to initialize company setup.')
    return jsonResponse({ error: message }, 500)
  }
})
