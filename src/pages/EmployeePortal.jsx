import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { applyCompanyFilter } from '../services/tenantScope'
import { UserX, ShieldAlert } from 'lucide-react'
import {
  usePortalEmployee,
  usePortalPayroll,
  usePortalTimeOff,
  usePortalAttendance,
  usePortalNotifications,
  usePortalExitData,
  useApplyLeaveMutation,
  usePunchInMutation,
  usePunchOutMutation,
  useApplyRegularizationMutation,
  useSaveTaxDeclarationMutation,
  useMarkNotificationAsReadMutation,
  portalKeys,
} from '../hooks/usePortalData'

// Custom hook & Subcomponents
import { usePortalCalculations } from '../hooks/usePortalCalculations'
import PortalHeader from '../components/portal/PortalHeader'

// Tab panels
import PortalPersonalTab from './portal/PortalPersonalTab'
import PortalJobTab from './portal/PortalJobTab'
import PortalPayrollTab from './portal/PortalPayrollTab'
import PortalTimeOffTab from './portal/PortalTimeOffTab'
import PortalPerformanceTab from './portal/PortalPerformanceTab'
import PortalDocumentsTab from './portal/PortalDocumentsTab'
import PortalExitTab from './portal/PortalExitTab'
import PortalPrivacyTab from './portal/PortalPrivacyTab'

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0)
}

const getEmptyTaxForm = () => ({
  regime: 'new',
  section_80c: '',
  section_80d: '',
  hra_exemption: '',
  home_loan_interest: '',
  other_deductions: '',
  other_income: '',
  tds_already_deducted: '',
})

const EMPTY_ARRAY = Object.freeze([])

export default function EmployeePortal() {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { user: authUser, isAdmin: authIsAdmin, profileData } = useAuth()

  const getPortalCache = () => {
    try {
      const raw = sessionStorage.getItem('employee_portal_cache')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  const cachedPortal = getPortalCache()

  // Identity & Switcher States
  const [viewAsId, setViewAsId] = useState(cachedPortal?.viewAsId || '')
  const [employees, setEmployees] = useState(cachedPortal?.employees || EMPTY_ARRAY)
  const [currentEmployee, setCurrentEmployee] = useState(cachedPortal?.currentEmployee || null)
  const [isAdmin, setIsAdmin] = useState(cachedPortal?.isAdmin || false)
  const [activeTab, setActiveTab] = useState('personal')

  // Queries
  const { data: employeeData, isLoading: isEmployeeLoading } = usePortalEmployee(viewAsId)
  const { data: unreadNotifications = EMPTY_ARRAY } = usePortalNotifications(viewAsId)

  const isPayrollTabActive = activeTab === 'payroll' || activeTab === 'performance'
  const { data: payrollData } = usePortalPayroll(viewAsId, isPayrollTabActive)
  const payslips = payrollData?.payslips || EMPTY_ARRAY
  const taxDeclaration = payrollData?.taxDeclaration || null

  const isTimeOffTabActive = activeTab === 'personal' || activeTab === 'timeoff'
  const { data: timeoffData } = usePortalTimeOff(viewAsId, isTimeOffTabActive)
  const leaves = timeoffData?.leaves || EMPTY_ARRAY
  const leavePolicies = timeoffData?.leavePolicies || EMPTY_ARRAY
  const leaveBalances = timeoffData?.leaveBalances || EMPTY_ARRAY
  const holidays = timeoffData?.holidays || EMPTY_ARRAY

  const isAttendanceTabActive =
    activeTab === 'personal' || activeTab === 'timeoff' || activeTab === 'performance'
  const { data: attendanceData } = usePortalAttendance(viewAsId, isAttendanceTabActive)
  const attendanceLogs = attendanceData?.attendanceLogs || EMPTY_ARRAY
  const todayPunch = attendanceData?.todayPunch || null
  const regularizationRequests = attendanceData?.regularizationRequests || EMPTY_ARRAY

  const isExitTabActive = activeTab === 'exit'
  const { data: activeExit = null } = usePortalExitData(viewAsId, isExitTabActive)

  const isLoading = isEmployeeLoading

  // Local Form & Clock States
  const [taxForm, setTaxForm] = useState(getEmptyTaxForm)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [userIp, setUserIp] = useState('Detecting...')
  const [workMode, setWorkMode] = useState('WFO')
  const [showRegularizeModal, setShowRegularizeModal] = useState(false)
  const [regularizeForm, setRegularizeForm] = useState({
    date: new Date().toISOString().split('T')[0],
    requested_status: 'Present',
    reason: '',
  })
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveForm, setLeaveForm] = useState({
    type: '',
    startDate: '',
    endDate: '',
    reason: '',
    medicalFile: null,
  })
  const [timeOffStatusFilter, setTimeOffStatusFilter] = useState('all')
  const [timeOffStartDate, setTimeOffStartDate] = useState('')
  const [timeOffEndDate, setTimeOffEndDate] = useState('')
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    half: 0,
    rate: 0,
  })

  // Sync taxForm values when database taxDeclaration finishes loading
  useEffect(() => {
    if (taxDeclaration) {
      setTaxForm({
        regime: taxDeclaration.regime || 'new',
        section_80c: taxDeclaration.section_80c ?? '',
        section_80d: taxDeclaration.section_80d ?? '',
        hra_exemption: taxDeclaration.hra_exemption ?? '',
        home_loan_interest: taxDeclaration.home_loan_interest ?? '',
        other_deductions: taxDeclaration.other_deductions ?? '',
        other_income: taxDeclaration.other_income ?? '',
        tds_already_deducted: taxDeclaration.tds_already_deducted ?? '',
      })
    }
  }, [taxDeclaration])

  // Mutations
  const applyLeaveMutation = useApplyLeaveMutation(viewAsId)
  const punchInMutation = usePunchInMutation(viewAsId)
  const punchOutMutation = usePunchOutMutation(viewAsId)
  const applyRegularizationMutation = useApplyRegularizationMutation(viewAsId)
  const saveTaxDeclarationMutation = useSaveTaxDeclarationMutation(viewAsId)
  const markNotificationAsReadMutation = useMarkNotificationAsReadMutation(viewAsId)

  const handleMarkNotificationAsRead = async (notificationId) => {
    markNotificationAsReadMutation.mutate(notificationId)
  }

  // Recalculate attendance stats
  useEffect(() => {
    if (attendanceLogs.length > 0) {
      const total = attendanceLogs.length
      const present = attendanceLogs.filter((a) => a.status === 'present').length
      const abs = attendanceLogs.filter((a) => a.status === 'absent').length
      const half = attendanceLogs.filter((a) => a.status === 'half_day').length
      const rate = total > 0 ? Math.round((present / total) * 100) : 0

      setAttendanceStats((prev) => {
        if (
          prev.present === present &&
          prev.absent === abs &&
          prev.half === half &&
          prev.rate === rate
        ) {
          return prev
        }
        return { present, absent: abs, late: 0, half, rate }
      })
    } else {
      setAttendanceStats((prev) => {
        if (
          prev.present === 0 &&
          prev.absent === 0 &&
          prev.late === 0 &&
          prev.half === 0 &&
          prev.rate === 0
        ) {
          return prev
        }
        return { present: 0, absent: 0, late: 0, half: 0, rate: 0 }
      })
    }
  }, [attendanceLogs])

  // Clock and IP
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const detectIp = async () => {
    try {
      const res = await fetch('https://api.ipify.org?format=json')
      const ipData = await res.json()
      setUserIp(ipData.ip || '127.0.0.1')
    } catch (err) {
      console.error('IP detection failed, using local:', err)
      setUserIp('127.0.0.1')
    }
  }

  useEffect(() => {
    detectIp()
  }, [])

  // Custom hook computations
  const computations = usePortalCalculations({
    currentEmployee,
    leaves,
    leavePolicies,
    leaveBalances,
    payslips,
    attendanceStats,
    timeOffStartDate,
    timeOffEndDate,
    timeOffStatusFilter,
    taxForm,
    taxDeclaration,
  })

  // Geolocation helper
  const getGeolocation = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast.warning(
          'Geolocation is not supported by your browser. Punch location will not be recorded.'
        )
        resolve(null)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          resolve(`point(${longitude}, ${latitude})`)
        },
        (error) => {
          console.warn('Geolocation error:', error)
          toast.warning(
            'Geolocation permission denied or unavailable. Punch location will not be recorded.'
          )
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    })
  }

  const handlePunchIn = async () => {
    if (!viewAsId) return
    const dbPunchLocation = await getGeolocation()
    punchInMutation.mutate({
      workMode,
      userIp,
      punchLocation: dbPunchLocation,
    })
  }

  const handlePunchOut = async () => {
    if (!viewAsId || !todayPunch) return
    const dbPunchLocation = await getGeolocation()
    punchOutMutation.mutate({
      todayPunch,
      workMode,
      punchLocation: dbPunchLocation,
    })
  }

  const handleApplyRegularization = async (e) => {
    e.preventDefault()
    if (!viewAsId) return
    applyRegularizationMutation.mutate(
      {
        date: regularizeForm.date,
        requested_status: regularizeForm.requested_status,
        reason: regularizeForm.reason,
      },
      {
        onSuccess: () => {
          setShowRegularizeModal(false)
          setRegularizeForm({
            date: new Date().toISOString().split('T')[0],
            requested_status: 'Present',
            reason: '',
          })
        },
      }
    )
  }

  // Sync session cache
  useEffect(() => {
    if (employeeData) {
      setCurrentEmployee(employeeData)
      sessionStorage.setItem(
        'employee_portal_cache',
        JSON.stringify({
          currentEmployee: employeeData,
          viewAsId,
          isAdmin,
          employees,
        })
      )
    }
  }, [employeeData, viewAsId, isAdmin, employees])

  // Fetch Identity on load
  useEffect(() => {
    const fetchCurrentEmployee = async () => {
      try {
        const user = authUser || (await supabase.auth.getUser()).data?.user
        if (!user) {
          console.error('No user logged in')
          return
        }

        // 1. Try to find the user's personal employee record by user_id
        let emp = null
        const { data: empByUserId } = await supabase
          .from('employees')
          .select('*, id, registration_id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (empByUserId) {
          emp = empByUserId
        } else if (user.email) {
          // 2. Fallback: match by email within active company
          const { data: empByEmail } = await applyCompanyFilter(
            supabase.from('employees').select('*, id, registration_id').ilike('email', user.email)
          ).maybeSingle()

          if (empByEmail) {
            emp = empByEmail
            // Link the user_id asynchronously for future logins
            supabase
              .from('employees')
              .update({ user_id: user.id })
              .eq('id', emp.id)
              .then(() => {})
          }
        }

        const isUserAdmin = Boolean(
          authIsAdmin ||
          ['admin', 'hr', 'HR', 'superadmin', 'administrator'].includes(profileData?.role) ||
          ['admin', 'hr', 'HR', 'superadmin', 'administrator'].includes(emp?.role)
        )

        if (isUserAdmin) {
          setIsAdmin(true)
          // Fetch all active employees for this company so admin can view/switch between them
          const { data: allEmps } = await applyCompanyFilter(
            supabase
              .from('employees')
              .select('id, first_name, last_name, employee_id, designation, status, email')
              .eq('is_deleted', false)
              .order('created_at', { ascending: true })
          )

          if (allEmps && allEmps.length > 0) {
            setEmployees(allEmps)
            // If cachedPortal has a valid viewAsId matching one of the company's employees, restore it
            const matchedCached = cachedPortal?.viewAsId
              ? allEmps.find((e) => e.id === cachedPortal.viewAsId)
              : null
            const selected = matchedCached || emp || allEmps[0]
            setCurrentEmployee(selected)
            setViewAsId(selected.id)
            return
          }
        }

        // Standard employee without admin privileges
        if (emp) {
          setCurrentEmployee(emp)
          setViewAsId(emp.id)
          setEmployees([emp])
          setIsAdmin(false)
        }
      } catch (error) {
        console.error('Error fetching employee identity:', error)
      }
    }
    fetchCurrentEmployee()
  }, [authUser, authIsAdmin, profileData])

  const handleApplyLeave = async () => {
    if (!leaveForm.type || !leaveForm.startDate || !leaveForm.endDate) {
      toast.warning('Please fill all required fields: Type, Start Date, and End Date.')
      return
    }

    applyLeaveMutation.mutate(
      { leaveForm, holidays },
      {
        onSuccess: () => {
          setShowLeaveModal(false)
          setLeaveForm({ type: '', startDate: '', endDate: '', reason: '', medicalFile: null })
        },
      }
    )
  }

  const parseDateSafe = (value) => {
    if (!value) return null
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const formatDateSafe = (
    value,
    options = { month: 'short', day: '2-digit', year: 'numeric' },
    fallback = 'N/A'
  ) => {
    const d = parseDateSafe(value)
    return d ? d.toLocaleDateString('en-US', options) : fallback
  }

  const formatMonthYearSafe = (value, fallback = 'N/A') => {
    const normalized = value && value.length === 7 ? `${value}-01` : value
    const d = parseDateSafe(normalized)
    return d ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : fallback
  }

  const openEditProfileModal = () => {
    const targetEmployeeId = viewAsId || currentEmployee?.id
    if (!targetEmployeeId) return
    navigate('/employees', { state: { editEmployeeId: targetEmployeeId } })
  }

  const saveTaxDeclaration = async () => {
    if (!viewAsId) return
    if (!computations.canEditTaxDeclaration) {
      toast.error('This declaration is already submitted or approved.')
      return
    }
    saveTaxDeclarationMutation.mutate({
      taxForm,
      taxFinancialYear: computations.taxFinancialYear,
    })
  }

  const updateTaxForm = (field, value) => {
    setTaxForm((prev) => ({ ...prev, [field]: value }))
  }

  if (isLoading && !currentEmployee) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    )
  }

  if (!currentEmployee) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-slate-200/80 rounded-2xl shadow-sm text-center space-y-4">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-100 shadow-sm">
          <UserX className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-black text-slate-900 tracking-tight">
          No Employee Profiles Found
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
          {authIsAdmin
            ? 'There are no active employees created in this workspace yet. Add employees in Employee Management to view and preview their self-service portal.'
            : 'Your account is signed in, but no employee record is linked to your user ID or email.'}
        </p>
        {authIsAdmin ? (
          <button
            onClick={() => navigate('/employees')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 cursor-pointer transition"
          >
            Go to Employee Management
          </button>
        ) : (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 text-xs text-slate-600 text-left space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>How to access the Full Admin Dashboard:</span>
            </div>
            <p className="text-slate-500 pl-6 leading-relaxed">
              To unlock the complete admin dashboard (Employees, Payroll, Salaries, Settings), your
              user must be set to <strong>admin</strong> in the Supabase <code>profiles</code> table
              or linked to an active employee record with role <code>admin</code>.
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-500">
      {currentEmployee && (
        <PortalHeader
          currentEmployee={currentEmployee}
          isAdmin={isAdmin}
          employees={employees}
          viewAsId={viewAsId}
          setViewAsId={setViewAsId}
          unreadNotifications={unreadNotifications}
          onMarkNotificationAsRead={handleMarkNotificationAsRead}
          isMarkingRead={markNotificationAsReadMutation.isPending}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onEditProfile={openEditProfileModal}
        />
      )}

      {/* Dynamic Tab Panels */}
      {activeTab === 'personal' && currentEmployee && (
        <PortalPersonalTab
          currentEmployee={currentEmployee}
          tenureText={computations.tenureText}
          totalRemainingPto={computations.totalRemainingPto}
          attendanceStats={attendanceStats}
          upcomingLeave={computations.upcomingLeave}
          formatDateSafe={formatDateSafe}
          toast={toast}
          onProfileUpdated={() =>
            queryClient.invalidateQueries({ queryKey: portalKeys.employee(viewAsId) })
          }
        />
      )}

      {activeTab === 'payroll' && (
        <PortalPayrollTab
          currentEmployee={currentEmployee}
          isAdmin={isAdmin}
          monthlySalary={computations.monthlySalary}
          annualSalary={computations.annualSalary}
          payFrequency={computations.payFrequency}
          nextPayDate={computations.nextPayDate}
          ytdEarnings={computations.ytdEarnings}
          taxDeclaration={taxDeclaration}
          taxForm={taxForm}
          updateTaxForm={updateTaxForm}
          canEditTaxDeclaration={computations.canEditTaxDeclaration}
          maskedIdentifier={computations.maskedIdentifier}
          taxFinancialYear={computations.taxFinancialYear}
          taxPreview={computations.taxPreview}
          monthlyTdsPreview={computations.monthlyTdsPreview}
          savingTaxDeclaration={saveTaxDeclarationMutation.isPending}
          saveTaxDeclaration={saveTaxDeclaration}
          benefitRows={computations.benefitRows}
          totalBenefitDeduction={computations.totalBenefitDeduction}
          latestPayslips={computations.latestPayslips}
          formatMonthYearSafe={formatMonthYearSafe}
          formatCurrency={formatCurrency}
          toast={toast}
        />
      )}

      {activeTab === 'timeoff' && currentEmployee && (
        <PortalTimeOffTab
          currentEmployee={currentEmployee}
          viewAsId={viewAsId}
          todayPunch={todayPunch}
          punching={punchInMutation.isPending || punchOutMutation.isPending}
          currentTime={currentTime}
          userIp={userIp}
          handlePunchIn={handlePunchIn}
          handlePunchOut={handlePunchOut}
          regularizationRequests={regularizationRequests}
          showRegularizeModal={showRegularizeModal}
          setShowRegularizeModal={setShowRegularizeModal}
          regularizeForm={regularizeForm}
          setRegularizeForm={setRegularizeForm}
          submittingRegularize={applyRegularizationMutation.isPending}
          handleApplyRegularization={handleApplyRegularization}
          timeOffHistory={computations.timeOffHistory}
          timeOffStatusFilter={timeOffStatusFilter}
          setTimeOffStatusFilter={setTimeOffStatusFilter}
          timeOffStartDate={timeOffStartDate}
          setTimeOffStartDate={setTimeOffStartDate}
          timeOffEndDate={timeOffEndDate}
          setTimeOffEndDate={setTimeOffEndDate}
          upcomingLeaves={computations.upcomingLeaves}
          timeOffCards={computations.timeOffCards}
          formatDateSafe={formatDateSafe}
          leavePolicies={leavePolicies}
          leaveForm={leaveForm}
          setLeaveForm={setLeaveForm}
          showLeaveModal={showLeaveModal}
          setShowLeaveModal={setShowLeaveModal}
          handleApplyLeave={handleApplyLeave}
          holidays={holidays}
          loading={isLoading}
          workMode={workMode}
          setWorkMode={setWorkMode}
        />
      )}

      {activeTab === 'performance' && currentEmployee && (
        <PortalPerformanceTab
          currentEmployee={currentEmployee}
          overallRating={computations.overallRating}
          goalsCompletion={computations.goalsCompletion}
          quarterlyGrowth={computations.quarterlyGrowth}
          performanceGoals={computations.performanceGoals}
          competencies={computations.competencies}
          reviewHistory={computations.reviewHistory}
          toast={toast}
        />
      )}

      {activeTab === 'job' && currentEmployee && (
        <PortalJobTab
          currentEmployee={currentEmployee}
          tenureText={computations.tenureText}
          formatDateSafe={formatDateSafe}
          toast={toast}
        />
      )}

      {activeTab === 'documents' && currentEmployee && (
        <PortalDocumentsTab currentEmployee={currentEmployee} viewAsId={viewAsId} toast={toast} />
      )}

      {activeTab === 'exit' && (
        <PortalExitTab
          currentEmployee={currentEmployee}
          viewAsId={viewAsId}
          isAdmin={isAdmin}
          toast={toast}
          activeExit={activeExit}
          setActiveExit={() =>
            queryClient.invalidateQueries({ queryKey: [...portalKeys.all, viewAsId, 'exit'] })
          }
          loading={isLoading}
          setLoading={() => {}}
        />
      )}

      {activeTab === 'privacy' && (
        <PortalPrivacyTab
          currentEmployee={currentEmployee}
          viewAsId={viewAsId}
          isAdmin={isAdmin}
          toast={toast}
        />
      )}
    </div>
  )
}
