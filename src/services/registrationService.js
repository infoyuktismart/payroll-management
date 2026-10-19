import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'

const fallbackPlans = [
  {
    id: 'starter-fallback',
    plan_code: 'starter',
    name: 'Starter',
    description: 'Core payroll and HR for small teams.',
    monthly_price: 2999,
    annual_price: 29990,
    price_per_employee: 149,
    max_employees: 50,
    features: ['Payroll processing', 'Attendance', 'Employee portal', 'Statutory reports'],
  },
  {
    id: 'growth-fallback',
    plan_code: 'growth',
    name: 'Growth',
    description: 'Multi-branch payroll with analytics and integrations.',
    monthly_price: 7999,
    annual_price: 79990,
    price_per_employee: 129,
    max_employees: 250,
    features: ['Everything in Starter', 'Multi-company', 'Analytics', 'Biometric import'],
  },
  {
    id: 'enterprise-fallback',
    plan_code: 'enterprise',
    name: 'Enterprise',
    description: 'Advanced controls for larger organizations.',
    monthly_price: 19999,
    annual_price: 199990,
    price_per_employee: 99,
    max_employees: null,
    features: ['Everything in Growth', '2FA controls', 'Audit logs', 'Priority support'],
  },
]

export const registrationService = {
  /**
   * Fetch all active subscription plans ordered by sorting order.
   * @returns {Promise<Array>} List of plans
   */
  async fetchSubscriptionPlans() {
    return withRetry(async () => {
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
        if (error) throw error
        return data?.length ? data : fallbackPlans
      } catch (e) {
        console.error('Failed to load plans from DB, using fallbacks:', e)
        return fallbackPlans
      }
    })
  },

  /**
   * Call company registration Edge Function with robust error parsing and client fallback.
   * @param {Object} payload - Registration details
   * @returns {Promise<Object>} Registration response (company_id, branch_id, etc.)
   */
  async registerCompany(payload) {
    return withRetry(async () => {
      let data = null
      let invokeError = null

      try {
        const res = await supabase.functions.invoke('register-company', {
          body: payload,
        })
        data = res.data
        invokeError = res.error
      } catch (err) {
        invokeError = err
      }

      if (invokeError) {
        let extractedMessage = ''

        // Inspect context (Response object) attached to FunctionsHttpError
        if (invokeError.context && typeof invokeError.context.clone === 'function') {
          try {
            const clonedRes = invokeError.context.clone()
            const jsonBody = await clonedRes.json()
            if (jsonBody?.error) {
              extractedMessage = jsonBody.error
            } else if (jsonBody?.message) {
              extractedMessage = jsonBody.message
            }
          } catch {
            try {
              const clonedRes = invokeError.context.clone()
              const textBody = await clonedRes.text()
              if (textBody) extractedMessage = textBody
            } catch {
              // ignore secondary parse error
            }
          }
        }

        if (!extractedMessage) {
          extractedMessage = invokeError.message || 'Onboarding failed due to system exception.'
        }

        // If error is a database trust exception from setup_trial_workspace
        if (extractedMessage.includes('trusted backend services')) {
          throw new Error(
            'Trial workspace setup requires database permissions. Please run the SQL migration 202606130001_fix_trial_registration_rpc.sql in your Supabase SQL Editor.'
          )
        }

        // Clean up generic Edge Function error string
        if (
          extractedMessage.includes('FunctionsHttpError') ||
          extractedMessage.includes('Edge Function returned a non-2xx')
        ) {
          extractedMessage =
            'Registration service unavailable. Please verify workspace details or try again.'
        }

        // If error is a user-facing validation message (e.g. duplicate code or email), throw readable Error directly
        const lowerMsg = extractedMessage.toLowerCase()
        if (
          lowerMsg.includes('company code') ||
          lowerMsg.includes('already taken') ||
          lowerMsg.includes('already attached') ||
          lowerMsg.includes('already linked') ||
          lowerMsg.includes('required') ||
          lowerMsg.includes('password')
        ) {
          throw new Error(extractedMessage)
        }

        // If edge function returned network or connection error, attempt direct trial registration fallback
        console.warn(
          '[RegistrationService] Edge Function error:',
          extractedMessage,
          '. Running trial registration fallback...'
        )
        try {
          return await this.registerCompanyFallback(payload)
        } catch (fallbackErr) {
          throw new Error(fallbackErr.message || extractedMessage)
        }
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      return data
    })
  },

  /**
   * Fallback trial company registration using Auth and setup_trial_workspace RPC.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async registerCompanyFallback(payload) {
    const companyName = payload.companyName.trim()
    const companyCode = payload.companyCode.trim().toUpperCase()
    const firstName = payload.firstName.trim()
    const lastName = payload.lastName.trim()
    const email = payload.email.trim().toLowerCase()
    const password = payload.password
    const planCode = (payload.planCode || 'growth').toLowerCase()
    const billingModel = (payload.billingModel || 'per_employee').toLowerCase()

    // 1. Check duplicate company code in companies table
    const { data: existingComp, error: compCheckErr } = await supabase
      .from('companies')
      .select('id')
      .eq('code', companyCode)
      .maybeSingle()

    if (compCheckErr && compCheckErr.code !== 'PGRST116') {
      console.warn('[RegistrationService] Company code pre-check warning:', compCheckErr)
    }
    if (existingComp?.id) {
      throw new Error(
        `Company code ${companyCode} is already taken. Please choose a different short code.`
      )
    }

    // 2. Sign up or sign in user via Supabase Auth
    let userId = null
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          trial_admin: true,
          role: 'admin',
          is_admin: true,
        },
      },
    })

    if (signUpErr || (signUpData?.user && signUpData.user.identities?.length === 0)) {
      const errStr = signUpErr?.message?.toLowerCase() || ''
      if (
        signUpData?.user?.identities?.length === 0 ||
        errStr.includes('already registered') ||
        errStr.includes('already exists') ||
        signUpErr?.status === 400
      ) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInErr) {
          throw new Error(
            'This admin email is already attached to an existing account. Please sign in or use another email.'
          )
        }
        userId = signInData.user?.id
      } else {
        throw new Error(signUpErr?.message || 'Failed to create administrator account.')
      }
    } else {
      userId = signUpData.user?.id
    }

    if (!userId) {
      throw new Error('Admin authentication account could not be created.')
    }

    // 3. Check duplicate email linked to employee
    const { data: existingEmp } = await supabase
      .from('employees')
      .select('id')
      .eq('email', email)
      .not('user_id', 'is', null)
      .maybeSingle()

    if (existingEmp?.id) {
      throw new Error('This admin email is already linked to an existing employee account.')
    }

    // 4. Provision workspace using setup_trial_workspace RPC
    const { data: rpcData, error: rpcErr } = await supabase.rpc('setup_trial_workspace', {
      p_company_name: companyName,
      p_company_code: companyCode,
      p_first_name: firstName,
      p_last_name: lastName,
      p_email: email,
      p_user_id: userId,
      p_plan_code: planCode,
      p_billing_model: billingModel,
    })

    if (rpcErr) {
      throw new Error(rpcErr.message || 'Failed to provision trial workspace.')
    }

    return rpcData
  },

  /**
   * Sign in newly created administrator.
   * @param {Object} params
   * @param {string} params.email
   * @param {string} params.password
   * @returns {Promise<any>} Sign in response
   */
  async signIn({ email, password }) {
    return withRetry(async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      return data
    })
  },
}
