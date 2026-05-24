import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type NotificationPayload = {
  type: 'leave_status' | 'payslip' | 'payroll_completed' | 'custom'
  to: string | string[]
  subject?: string
  text?: string
  html?: string
  metadata?: Record<string, unknown>
}

const escapeHtml = (value = '') =>
  value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char] || char))

const buildTemplate = (payload: NotificationPayload) => {
  if (payload.subject && (payload.html || payload.text)) {
    return {
      subject: payload.subject,
      html: payload.html || `<p>${escapeHtml(payload.text || '')}</p>`,
      text: payload.text || payload.html?.replace(/<[^>]+>/g, ' ') || '',
    }
  }

  const metadata = payload.metadata || {}
  const employeeName = String(metadata.employeeName || 'Employee')
  const period = String(metadata.period || '')
  const status = String(metadata.status || '')
  const leaveType = String(metadata.leaveType || 'leave')

  if (payload.type === 'leave_status') {
    const subject = `Leave request ${status || 'updated'}`
    const text = `Hello ${employeeName}, your ${leaveType} request has been ${status}.`
    return {
      subject,
      text,
      html: `<p>Hello ${escapeHtml(employeeName)},</p><p>Your <strong>${escapeHtml(leaveType)}</strong> request has been <strong>${escapeHtml(status)}</strong>.</p>`,
    }
  }

  if (payload.type === 'payslip') {
    const subject = `Payslip available${period ? ` - ${period}` : ''}`
    const text = `Hello ${employeeName}, your payslip${period ? ` for ${period}` : ''} is available in the payroll portal.`
    return {
      subject,
      text,
      html: `<p>Hello ${escapeHtml(employeeName)},</p><p>Your payslip${period ? ` for <strong>${escapeHtml(period)}</strong>` : ''} is available in the payroll portal.</p>`,
    }
  }

  if (payload.type === 'payroll_completed') {
    const subject = `Payroll completed${period ? ` - ${period}` : ''}`
    const text = `Payroll processing${period ? ` for ${period}` : ''} has been completed.`
    return {
      subject,
      text,
      html: `<p>Payroll processing${period ? ` for <strong>${escapeHtml(period)}</strong>` : ''} has been completed.</p>`,
    }
  }

  return {
    subject: payload.subject || 'Payroll Management Notification',
    text: payload.text || 'You have a new notification from Payroll Management.',
    html: payload.html || '<p>You have a new notification from Payroll Management.</p>',
  }
}

serve(async (req) => {
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
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL') || 'Payroll Management <noreply@example.com>'

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Supabase service configuration is missing.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

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

  const payload = await req.json() as NotificationPayload
  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to]
  const cleanRecipients = recipients.map((item) => String(item || '').trim()).filter(Boolean)
  if (cleanRecipients.length === 0) {
    return new Response(JSON.stringify({ error: 'At least one recipient is required.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const template = buildTemplate(payload)
  const results = []

  for (const recipient of cleanRecipients) {
    const { data: logRow } = await serviceClient
      .from('notification_logs')
      .insert({
        notification_type: payload.type,
        recipient_email: recipient,
        subject: template.subject,
        status: resendApiKey ? 'pending' : 'skipped',
        provider: 'resend',
        metadata: payload.metadata || {},
        created_by: userData.user.id,
      })
      .select('id')
      .single()

    if (!resendApiKey) {
      results.push({ to: recipient, status: 'skipped', reason: 'RESEND_API_KEY is not configured.' })
      continue
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: recipient,
          subject: template.subject,
          html: template.html,
          text: template.text,
        }),
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body?.message || `Resend returned ${response.status}`)
      }

      await serviceClient
        .from('notification_logs')
        .update({
          status: 'sent',
          provider_message_id: body?.id || null,
          sent_at: new Date().toISOString(),
        })
        .eq('id', logRow?.id)

      results.push({ to: recipient, status: 'sent', id: body?.id })
    } catch (error) {
      await serviceClient
        .from('notification_logs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown email error',
        })
        .eq('id', logRow?.id)

      results.push({ to: recipient, status: 'failed', error: error instanceof Error ? error.message : 'Unknown email error' })
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
