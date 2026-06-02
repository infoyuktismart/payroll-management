declare const Deno: any;

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type WhatsAppPayload = {
  employee_id: string
  payslip_id?: string
  payslip_url?: string
  period?: string
  // Optional dynamic credentials (e.g. for multi-tenant setups)
  twilio_account_sid?: string
  twilio_auth_token?: string
  twilio_from?: string
}

const formatE164 = (phone: string): string => {
  // Remove non-digit characters except '+'
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) {
    return cleaned
  }
  // Assume Indian country code if 10 digits
  if (cleaned.length === 10) {
    return `+91${cleaned}`
  }
  // If it already starts with '91' and is 12 digits
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`
  }
  // Fallback
  return `+${cleaned}`
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Supabase configuration is missing.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 2. Validate JWT/Auth
  const authHeader = req.headers.get('Authorization') || ''
  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  const token = authHeader.replace('Bearer ', '')
  const { data: userData, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const payload = await req.json() as WhatsAppPayload
    const { employee_id, payslip_url, period } = payload

    if (!employee_id) {
      return new Response(JSON.stringify({ error: 'employee_id is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Fetch Employee Details
    const { data: employee, error: empError } = await serviceClient
      .from('employees')
      .select('first_name, last_name, email, phone, whatsapp_enabled, company_id')
      .eq('id', employee_id)
      .single()

    if (empError || !employee) {
      return new Response(JSON.stringify({ error: 'Employee not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const employeeName = `${employee.first_name} ${employee.last_name}`
    const rawPhone = employee.phone || ''

    if (!rawPhone) {
      return new Response(JSON.stringify({ error: 'Employee does not have a registered phone number.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const formattedPhone = formatE164(rawPhone)

    // 4. Resolve Twilio Credentials
    const accountSid = payload.twilio_account_sid || Deno.env.get('TWILIO_ACCOUNT_SID')
    const authToken = payload.twilio_auth_token || Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioFrom = payload.twilio_from || Deno.env.get('TWILIO_WHATSAPP_FROM') || 'whatsapp:+14155238886' // Standard Twilio Sandbox number

    const isConfigured = Boolean(accountSid && authToken)

    // 5. Create WhatsApp notification log
    const { data: logRow, error: logError } = await serviceClient
      .from('notification_logs')
      .insert({
        channel: 'whatsapp',
        notification_type: 'payslip',
        recipient_email: employee.email || '',
        recipient_phone: formattedPhone,
        subject: `Payslip WhatsApp - ${period || 'Current Period'}`,
        status: isConfigured ? 'pending' : 'skipped',
        provider: 'twilio',
        metadata: {
          employee_id,
          employeeName,
          period,
          payslip_url,
          company_id: employee.company_id
        },
        created_by: userData.user.id,
      })
      .select('id')
      .single()

    if (logError) {
      console.error('Failed to insert notification log:', logError)
    }

    if (!isConfigured) {
      return new Response(JSON.stringify({
        success: false,
        status: 'skipped',
        reason: 'Twilio API credentials (account SID, auth token) are not configured in environment.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 6. Invoke Twilio WhatsApp API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    
    // Construct message body
    const periodStr = period ? ` for ${period}` : ''
    const msgText = `Hello ${employeeName},\n\nYour payslip${periodStr} is now available in the payroll portal. You can view or download it directly.`
    
    const formData = new URLSearchParams()
    formData.append('From', twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`)
    formData.append('To', formattedPhone.startsWith('whatsapp:') ? formattedPhone : `whatsapp:${formattedPhone}`)
    formData.append('Body', msgText)
    
    if (payslip_url) {
      formData.append('MediaUrl', payslip_url)
    }

    const basicAuth = btoa(`${accountSid}:${authToken}`)

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    })

    const twilioData = await twilioRes.json()

    if (!twilioRes.ok) {
      const errMsg = twilioData.message || `Twilio responded with status ${twilioRes.status}`
      
      // Update log to failed
      if (logRow?.id) {
        await serviceClient
          .from('notification_logs')
          .update({
            status: 'failed',
            error_message: errMsg
          })
          .eq('id', logRow.id)
      }

      throw new Error(errMsg)
    }

    // 7. Update log on success
    if (logRow?.id) {
      await serviceClient
        .from('notification_logs')
        .update({
          status: 'sent',
          provider_message_id: twilioData.sid,
          sent_at: new Date().toISOString()
        })
        .eq('id', logRow.id)
    }

    return new Response(JSON.stringify({
      success: true,
      status: 'sent',
      messageSid: twilioData.sid
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown WhatsApp dispatch error'
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
