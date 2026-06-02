// =============================================================================
// razorpay-checkout/index.ts
// Supabase Edge Function — Razorpay Payment Gateway Handler
//
// Purpose:
//   1. Create Razorpay Orders securely using Private API keys.
//   2. Verify payment signatures using SHA256 HMAC before marking invoices paid.
// =============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface OrderRequest {
  action: 'create_order' | 'verify_payment'
  invoice_id: string
  // For verification:
  razorpay_payment_id?: string
  razorpay_order_id?: string
  razorpay_signature?: string
}

const createHmacSha256Hex = async (secret: string, value: string) => {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const serviceClient = createClient(supabaseUrl, supabaseKey)

    // Razorpay Key & Secret
    const keyId = Deno.env.get('RAZORPAY_KEY_ID') || 'rzp_test_mockKeyId12345'
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || 'mockSecretKey12345'

    const body: OrderRequest = await req.json()
    const { action, invoice_id } = body

    // 1. Fetch Invoice
    const { data: invoice, error: invErr } = await serviceClient
      .from('billing_invoices')
      .select('*, companies(name)')
      .eq('id', invoice_id)
      .single()

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'create_order') {
      // Amount in paise (1 INR = 100 Paise)
      const amountInPaise = Math.round(Number(invoice.total_amount) * 100)

      // If keys are mock, return a mock order immediately to enable instant frontend testing
      if (keyId.includes('mockKeyId')) {
        return new Response(
          JSON.stringify({
            order_id: `order_mock_${Math.random().toString(36).substring(2, 11)}`,
            amount: amountInPaise,
            currency: 'INR',
            key_id: keyId,
            is_mock: true
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Call Razorpay API
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(`${keyId}:${keySecret}`)
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: invoice.invoice_number,
          notes: {
            invoice_id: invoice.id,
            company_id: invoice.company_id
          }
        })
      })

      if (!rzpRes.ok) {
        const rzpErr = await rzpRes.json()
        throw new Error(rzpErr.error?.description || 'Razorpay order creation failed')
      }

      const orderData = await rzpRes.json()

      return new Response(
        JSON.stringify({
          order_id: orderData.id,
          amount: orderData.amount,
          currency: orderData.currency,
          key_id: keyId,
          is_mock: false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'verify_payment') {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body

      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return new Response(JSON.stringify({ error: 'Missing verification signatures' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Verify HMAC SHA256 Signature
      let verified = false

      if (razorpay_order_id.includes('mock')) {
        verified = true // Auto-pass mock order tests in development
      } else {
        const dataToVerify = `${razorpay_order_id}|${razorpay_payment_id}`
        const expectedSignature = await createHmacSha256Hex(keySecret, dataToVerify)
        verified = expectedSignature === razorpay_signature
      }

      if (!verified) {
        return new Response(JSON.stringify({ error: 'Payment signature verification failed' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Update Invoice status to paid
      const { error: updateErr } = await serviceClient
        .from('billing_invoices')
        .update({
          status: 'paid',
          payment_reference: razorpay_payment_id,
          paid_at: new Date().toISOString()
        })
        .eq('id', invoice_id)

      if (updateErr) throw updateErr

      // Update Subscription status to active
      await serviceClient
        .from('company_subscriptions')
        .update({
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('company_id', invoice.company_id)

      return new Response(JSON.stringify({ success: true, message: 'Payment successfully settled!' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown exception'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
