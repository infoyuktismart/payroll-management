import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { registrationService } from '../services/registrationService'

// Subcomponents
import RegisterHeader from '../components/register/RegisterHeader'
import RegisterUserForm from '../components/register/RegisterUserForm'
import RegisterCompanyForm from '../components/register/RegisterCompanyForm'
import RegisterPlanForm from '../components/register/RegisterPlanForm'
import RegisterProvisioningProgress from '../components/register/RegisterProvisioningProgress'

export default function Register() {
  const navigate = useNavigate()
  const toast = useToast()
  const {
    user,
    loading: authLoading,
    isRoleLoading,
    isAdmin,
    twoFactorChallenge,
    isTwoFactorVerified,
  } = useAuth()

  // Core Multi-Step State
  const [step, setStep] = useState(1) // 1: User Account, 2: Company Details, 3: Plan & Billing, 4: Provisioning Workspace
  const [setupError, setSetupError] = useState('')
  const [isCompleted, setIsCompleted] = useState(false)
  const [plans, setPlans] = useState([])

  // Step 1: User Account State
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2: Company Details State
  const [companyName, setCompanyName] = useState('')
  const [companyCode, setCompanyCode] = useState('')

  // Step 3: Plan Selection
  const [selectedPlanCode, setSelectedPlanCode] = useState('growth')
  const [billingModel, setBillingModel] = useState('per_employee')

  const [errors, setErrors] = useState({})
  const [setupProgress, setSetupProgress] = useState([])

  useEffect(() => {
    const pendingTwoFactor =
      user && twoFactorChallenge?.userId === user.id && !isTwoFactorVerified(user.id)
    if (!authLoading && !isRoleLoading && user && !pendingTwoFactor) {
      navigate(isAdmin ? '/dashboard' : '/portal', { replace: true })
    }
  }, [authLoading, isRoleLoading, user, isAdmin, twoFactorChallenge, isTwoFactorVerified, navigate])

  // Fetch subscription plans on load
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await registrationService.fetchSubscriptionPlans()
        setPlans(data)
      } catch (e) {
        console.error('Failed to load plans:', e)
      }
    }
    fetchPlans()
  }, [])

  const updateProgress = (index, status) => {
    setSetupProgress((prev) => prev.map((item, i) => (i === index ? { ...item, status } : item)))
  }

  const validateStep1 = () => {
    const newErrors = {}
    const nameRegex = /^[A-Za-z\s]+$/
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required'
    } else if (!nameRegex.test(firstName.trim())) {
      newErrors.firstName = 'First name must contain only letters'
    }

    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    } else if (!nameRegex.test(lastName.trim())) {
      newErrors.lastName = 'Last name must contain only letters'
    }

    if (!email.trim()) {
      newErrors.email = 'Valid email address is required'
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address (e.g., name@company.com)'
    }

    if (password.length < 8) newErrors.password = 'Password must be at least 8 characters'
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return false
    }
    setErrors({})
    return true
  }

  const validateStep2 = () => {
    const newErrors = {}
    if (!companyName.trim()) newErrors.companyName = 'Company name is required'
    if (!companyCode.trim()) newErrors.companyCode = 'Company code is required'
    else if (companyCode.trim().length < 2)
      newErrors.companyCode = 'Company code must be at least 2 characters'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return false
    }
    setErrors({})
    return true
  }

  const handleNextStep = (e) => {
    if (e) e.preventDefault()
    if (step === 1 && validateStep1()) {
      setStep(2)
    } else if (step === 2 && validateStep2()) {
      setStep(3)
    }
  }

  const handleBackStep = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleRegister = async (e) => {
    if (e) e.preventDefault()
    setErrors({})
    setSetupError('')
    setStep(4)

    setSetupProgress([
      { label: 'Creating confirmed administrator login...', status: 'pending' },
      { label: 'Registering tenant company workspace...', status: 'pending' },
      { label: 'Activating 14-day SaaS trial subscription...', status: 'pending' },
      { label: 'Signing you into the new workspace...', status: 'pending' },
    ])

    try {
      updateProgress(0, 'in_progress')

      const payload = {
        companyName: companyName.trim(),
        companyCode: companyCode.trim().toUpperCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        planCode: selectedPlanCode,
        billingModel,
      }

      const registrationData = await registrationService.registerCompany(payload)
      updateProgress(0, 'completed')

      updateProgress(1, 'in_progress')
      updateProgress(2, 'in_progress')
      updateProgress(1, 'completed')
      updateProgress(2, 'completed')

      updateProgress(3, 'in_progress')

      if (registrationData?.company_id) {
        window.localStorage.setItem('payroll_active_company_id', registrationData.company_id)
      }
      if (registrationData?.branch_id) {
        window.localStorage.setItem('payroll_active_branch_id', registrationData.branch_id)
      }

      await registrationService.signIn({
        email: email.trim(),
        password,
      })

      setTimeout(() => {
        updateProgress(3, 'completed')
        setIsCompleted(true)
        toast.success('Your corporate workspace setup is complete!')
      }, 1500)
    } catch (err) {
      console.error('Registration failed:', err)
      const message = err.message || 'Onboarding failed due to system exception.'
      setSetupError(message)
      setStep(message.toLowerCase().includes('company code') ? 2 : 3)
    }
  }

  const currentPlanDetails = useMemo(() => {
    return plans.find((p) => p.plan_code === selectedPlanCode)
  }, [plans, selectedPlanCode])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,.12),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_42%,#f8fafc_100%)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <RegisterHeader />

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl z-10">
        <div className="bg-white/95 border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-xl shadow-blue-100/60 relative">
          {/* Error Box */}
          {setupError && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-start space-x-3 text-rose-700 mb-6">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-xs font-black uppercase tracking-wider leading-relaxed">
                {setupError}
              </p>
            </div>
          )}

          {/* Progress indicator steps header */}
          {step < 4 && (
            <div className="flex items-center justify-between mb-8 border-b border-gray-200 pb-5">
              <div className="flex items-center space-x-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                >
                  1
                </span>
                <span
                  className={`text-xs font-bold ${step === 1 ? 'text-slate-950' : 'text-slate-500'}`}
                >
                  Profile
                </span>
              </div>
              <div className="h-px bg-gray-200 flex-1 mx-2"></div>
              <div className="flex items-center space-x-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                >
                  2
                </span>
                <span
                  className={`text-xs font-bold ${step === 2 ? 'text-slate-950' : 'text-slate-500'}`}
                >
                  Company
                </span>
              </div>
              <div className="h-px bg-gray-200 flex-1 mx-2"></div>
              <div className="flex items-center space-x-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 3 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                >
                  3
                </span>
                <span
                  className={`text-xs font-bold ${step === 3 ? 'text-slate-950' : 'text-slate-500'}`}
                >
                  Plan & Subscription
                </span>
              </div>
            </div>
          )}

          {/* Step 1: User Account Form */}
          {step === 1 && (
            <RegisterUserForm
              firstName={firstName}
              setFirstName={setFirstName}
              lastName={lastName}
              setLastName={setLastName}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              errors={errors}
              onSubmit={handleNextStep}
            />
          )}

          {/* Step 2: Company Setup Form */}
          {step === 2 && (
            <RegisterCompanyForm
              companyName={companyName}
              setCompanyName={setCompanyName}
              companyCode={companyCode}
              setCompanyCode={setCompanyCode}
              errors={errors}
              onSubmit={handleNextStep}
              onBack={handleBackStep}
            />
          )}

          {/* Step 3: Choose Plan & Subscription Model */}
          {step === 3 && (
            <RegisterPlanForm
              plans={plans}
              selectedPlanCode={selectedPlanCode}
              setSelectedPlanCode={setSelectedPlanCode}
              billingModel={billingModel}
              setBillingModel={setBillingModel}
              currentPlanDetails={currentPlanDetails}
              onSubmit={handleRegister}
              onBack={handleBackStep}
            />
          )}

          {/* Step 4: Loading & Success Provisioning Progress */}
          {step === 4 && (
            <RegisterProvisioningProgress
              isCompleted={isCompleted}
              setupProgress={setupProgress}
              onDashboardRedirect={() => navigate('/dashboard')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
