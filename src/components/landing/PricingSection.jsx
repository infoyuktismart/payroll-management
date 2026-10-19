import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Check, ArrowRight, ShieldCheck, Zap } from 'lucide-react'

export default function PricingSection() {
  const [headcount, setHeadcount] = useState(35)
  const [billingCycle, setBillingCycle] = useState('annual') // 'monthly' | 'annual'

  const discountMultiplier = billingCycle === 'annual' ? 0.8 : 1.0

  const plans = useMemo(
    () => [
      {
        id: 'starter',
        name: 'Starter',
        description: 'Essential automated payroll & compliance for emerging teams.',
        baseRate: 149,
        flatRate: 1499,
        popular: false,
        features: [
          'Up to 25 employees included',
          'Single company & branch workspace',
          'Automated 1-click payroll processing',
          'Instant payslip PDF downloads',
          'EPF & ESI monthly calculation engine',
          'Standard leave policies & attendance',
          'Employee self-service portal',
        ],
      },
      {
        id: 'growth',
        name: 'Growth',
        description: 'Advanced multi-branch HR, biometric sync, and loan management.',
        baseRate: 129,
        flatRate: 3999,
        popular: true,
        features: [
          'Up to 150 employees included',
          'Multi-branch management & filtering',
          'Biometric hardware & USB log import',
          'Shift rotations & overtime policy engine',
          'Employee loans & EMI deduction',
          'Expense reimbursements workflow',
          'Comprehensive HR analytics & reports',
          'Priority email & chat support',
        ],
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Unrestricted holding company scale, white-labelling, and audit governance.',
        baseRate: 99,
        flatRate: 8999,
        popular: false,
        features: [
          'Unlimited employee headcount capacity',
          'Multi-company parent & subsidiary support',
          'White-labelling, logos & custom portal branding',
          'Full immutable audit trails & compliance logs',
          'Two-Factor Authentication (2FA / TOTP) enforcement',
          'Custom statutory deduction rule builder',
          'Dedicated account manager & 99.9% uptime SLA',
        ],
      },
    ],
    []
  )

  const formatINR = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val)

  return (
    <section
      id="pricing-section"
      className="relative border-t border-slate-200 bg-linear-to-b from-white via-slate-50 to-slate-100/60 py-20 px-5 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-blue-700">
            <Zap className="h-3.5 w-3.5" />
            Transparent PEPM Pricing
          </span>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Simple, predictable pricing that scales with your headcount.
          </h2>
          <p className="mt-4 text-base font-medium leading-relaxed text-slate-600 sm:text-lg">
            No hidden setup charges. Pay only for active staff with transparent Per-Employee
            Per-Month (PEPM) rates.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-8 inline-flex items-center rounded-2xl border border-slate-200 bg-slate-100 p-1.5 shadow-inner">
            <button
              id="toggle-monthly-billing"
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`rounded-xl px-5 py-2 text-xs font-black transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Billing
            </button>
            <button
              id="toggle-annual-billing"
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-black transition-all ${
                billingCycle === 'annual'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Annual Billing
              <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-black text-emerald-200">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Interactive Headcount Slider Card */}
        <div className="mx-auto mt-12 max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Interactive Estimator
              </span>
              <h3 className="text-lg font-black text-slate-900">How many employees do you have?</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-blue-600 sm:text-4xl">{headcount}</span>
              <span className="text-sm font-bold text-slate-500">Active Staff</span>
            </div>
          </div>

          <div className="mt-6">
            <input
              id="headcount-slider"
              type="range"
              min="5"
              max="300"
              step="5"
              value={headcount}
              onChange={(e) => setHeadcount(Number(e.target.value))}
              className="h-2.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
              aria-label="Adjust headcount"
            />
            <div className="mt-2 flex justify-between text-xs font-bold text-slate-400">
              <span>5 staff</span>
              <span>50 staff</span>
              <span>150 staff</span>
              <span>300+ staff</span>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => {
            const effectiveRate = Math.round(plan.baseRate * discountMultiplier)
            const subtotalMonthly = effectiveRate * headcount
            const gstAmount = Math.round(subtotalMonthly * 0.18)
            const totalMonthly = subtotalMonthly + gstAmount

            return (
              <div
                key={plan.id}
                id={`pricing-card-${plan.id}`}
                className={`relative flex flex-col justify-between rounded-3xl border p-8 transition-all duration-200 ${
                  plan.popular
                    ? 'border-blue-600 bg-white shadow-2xl shadow-blue-100 ring-2 ring-blue-600'
                    : 'border-slate-200 bg-white shadow-sm hover:border-slate-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-linear-to-r from-blue-600 to-indigo-600 px-4 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-md">
                    Most Popular Choice
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-900">{plan.name}</h3>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {formatINR(effectiveRate)}/emp
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-500 leading-relaxed">
                    {plan.description}
                  </p>

                  {/* Calculated Headcount Price Preview */}
                  <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Estimated Total for {headcount} Staff
                    </p>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-900">
                        {formatINR(totalMonthly)}
                      </span>
                      <span className="text-xs font-bold text-slate-500">/mo</span>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      Base: {formatINR(subtotalMonthly)} + 18% GST ({formatINR(gstAmount)})
                    </p>
                    {billingCycle === 'annual' && (
                      <p className="mt-1 text-[11px] font-bold text-emerald-600">
                        Includes 20% annual commitment discount
                      </p>
                    )}
                  </div>

                  {/* Feature Checklist */}
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-3 text-xs font-semibold text-slate-700"
                      >
                        <div className="rounded-full bg-blue-50 p-1 text-blue-600 shrink-0 mt-0.5">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                  <Link
                    id={`cta-btn-${plan.id}`}
                    to={`/register?plan=${plan.id}`}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition-all ${
                      plan.popular
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700'
                        : 'bg-slate-900 text-white hover:bg-black'
                    }`}
                  >
                    Start 14-Day Free Trial
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
                    No credit card required • Instant setup
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Statutory Trust Bar */}
        <div className="mt-16 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <p className="text-center text-xs font-black uppercase tracking-widest text-slate-400">
            Built for 100% Indian Statutory & Legal Compliance
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-50">
              <ShieldCheck className="h-6 w-6 text-blue-600 mb-2" />
              <span className="text-xs font-black text-slate-800">EPF Act 1952</span>
              <span className="text-[10px] font-medium text-slate-500">
                Automated ECR Text Generation
              </span>
            </div>
            <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-50">
              <ShieldCheck className="h-6 w-6 text-emerald-600 mb-2" />
              <span className="text-xs font-black text-slate-800">ESI Act 1948</span>
              <span className="text-[10px] font-medium text-slate-500">
                Monthly Contribution Returns
              </span>
            </div>
            <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-50">
              <ShieldCheck className="h-6 w-6 text-amber-600 mb-2" />
              <span className="text-xs font-black text-slate-800">Income Tax (24Q)</span>
              <span className="text-[10px] font-medium text-slate-500">
                TDS Statements & Form 16
              </span>
            </div>
            <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-50">
              <ShieldCheck className="h-6 w-6 text-indigo-600 mb-2" />
              <span className="text-xs font-black text-slate-800">256-Bit Encryption</span>
              <span className="text-[10px] font-medium text-slate-500">
                Encrypted PAN, Aadhaar & Bank
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
