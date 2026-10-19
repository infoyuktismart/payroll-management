import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { devLog } from '../lib/devLogger'
import { useToast } from '../context/ToastContext'
import { buildPayrollCsv, downloadBlob, formatCurrency } from '../lib/payrollUtils'
import { notifyPayrollCompleted, notifyPayslipAvailable } from '../lib/notifications'
import { sendWhatsAppNotification } from '../lib/whatsappService'
import { Download, Send, Play } from 'lucide-react'

// Hooks & Services
import { usePayrollCalculation } from '../hooks/usePayrollCalculation'
import {
  usePayrollHistoryQuery,
  useDeliveryLogsQuery,
  useReversePayrollMutation,
  useFinalizePayrollMutation,
} from '../hooks/usePayrollRuns'
import { getActiveCompanyId } from '../services/tenantScope'
import { payrollService } from '../services/payrollService'

// Subcomponents
import PayrollFilterBar from '../components/payroll/PayrollFilterBar'
import PayrollSummaryCards from '../components/payroll/PayrollSummaryCards'
import PayrollCurrentTable from '../components/payroll/PayrollCurrentTable'
import PayrollHistoryTab from '../components/payroll/PayrollHistoryTab'
import PayrollDeliveryLogsTab from '../components/payroll/PayrollDeliveryLogsTab'
import { ConfirmFinalizeModal, PayslipPreviewModal } from '../components/payroll/PayrollModals'

// Helper Components
const Badge = ({ children, color = 'bg-slate-100 text-slate-700' }) => (
  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${color}`}>{children}</span>
)

const DEFAULT_DEPARTMENTS = ['Engineering', 'HR', 'Sales', 'Marketing', 'Finance', 'Operations']

export default function PayrollProcessing() {
  // 1. Initial State Loading from Atomic Bundle
  const getInitialState = () => {
    try {
      const saved = sessionStorage.getItem('payroll_active_state')
      const parsed = saved ? JSON.parse(saved) : {}
      devLog('Mount: Loading consolidated payroll_state:', parsed)
      return {
        selectedDate: parsed.selectedDate || new Date().toISOString().slice(0, 7),
        selectedDepartment: parsed.selectedDepartment || 'All Departments',
        employeeSearch: parsed.employeeSearch || '',
        processingStep: parsed.processingStep || 0,
        employees: parsed.employees || [],
        payrollData: parsed.payrollData || [],
        activeTab: parsed.activeTab || 'current_period',
        runType: parsed.runType || 'regular',
      }
    } catch (e) {
      console.error('Mount: Persistence Error:', e)
      return {
        selectedDate: new Date().toISOString().slice(0, 7),
        selectedDepartment: 'All Departments',
        employeeSearch: '',
        processingStep: 0,
        employees: [],
        payrollData: [],
        activeTab: 'current_period',
        runType: 'regular',
      }
    }
  }

  const initialState = getInitialState()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState(initialState.activeTab)
  const [selectedDate, setSelectedDate] = useState(initialState.selectedDate)
  const [selectedDepartment, setSelectedDepartment] = useState(initialState.selectedDepartment)
  const [employeeSearch, setEmployeeSearch] = useState(initialState.employeeSearch)
  const [runType, setRunType] = useState(initialState.runType || 'regular')

  const {
    loading,
    setLoading,
    processingStep,
    setProcessingStep,
    employees,
    payrollData,
    setPayrollData,
    calculatePayroll,
  } = usePayrollCalculation(initialState)

  const [successMessage, setSuccessMessage] = useState('')
  const [showPayslip, setShowPayslip] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedRun, setSelectedRun] = useState(null)
  const [runItems, setRunItems] = useState([])
  const [runLoading, setRunLoading] = useState(false)

  // WhatsApp & Delivery Logs Upgrade
  const [sendEmail, setSendEmail] = useState(true)
  const [sendWhatsApp, setSendWhatsApp] = useState(false)

  const activeCompanyId = getActiveCompanyId()

  // React Query Queries & Mutations
  const { data: history = [], refetch: refetchHistory } = usePayrollHistoryQuery()
  const {
    data: deliveryLogs = [],
    isLoading: logsLoading,
    refetch: refetchDeliveryLogs,
  } = useDeliveryLogsQuery(activeCompanyId)

  const reversePayrollMutation = useReversePayrollMutation()
  const finalizePayrollMutation = useFinalizePayrollMutation()

  // Computed stats
  const totalGross = payrollData.reduce((sum, item) => sum + (item.grossSalary || 0), 0)
  const totalNet = payrollData.reduce((sum, item) => sum + (item.netSalary || 0), 0)
  const departments = [
    'All Departments',
    ...Array.from(
      new Set([...DEFAULT_DEPARTMENTS, ...employees.map((emp) => emp.department).filter(Boolean)])
    ).sort(),
  ]

  // 2. Persistent State Sync
  useEffect(() => {
    const stateToSave = {
      selectedDate,
      selectedDepartment,
      employeeSearch,
      processingStep,
      employees,
      payrollData,
      activeTab,
      runType,
    }
    devLog('Syncing payroll_state to sessionStorage:', stateToSave)
    sessionStorage.setItem('payroll_active_state', JSON.stringify(stateToSave))
  }, [
    selectedDate,
    selectedDepartment,
    employeeSearch,
    processingStep,
    employees,
    payrollData,
    activeTab,
    runType,
  ])

  useEffect(() => {
    if (activeTab === 'history') {
      refetchHistory()
    } else if (activeTab === 'delivery_logs') {
      refetchDeliveryLogs()
    }
  }, [activeTab, refetchHistory, refetchDeliveryLogs])

  const fetchRunItems = async (run) => {
    setRunLoading(true)
    setSelectedRun(run)
    try {
      const data = await payrollService.getPayrollItems(run.id)
      // Map to same format as payrollData for reuse
      const mapped = (data || []).map((item) => ({
        id: item.employees.id,
        name: `${item.employees.first_name} ${item.employees.last_name}`,
        empId: item.employees.employee_id,
        designation: item.employees.designation,
        payableDays: item.attendance_days,
        totalDays: item.breakdown?.totalDays || item.attendance_days,
        basicSalary: item.basic_salary,
        grossSalary: item.breakdown?.gross || item.basic_salary,
        totalDeductions: item.total_deductions,
        netSalary: item.net_salary,
        earningsList: item.breakdown?.earnings || [],
        deductionsList: item.breakdown?.deductions || [],
        employee: item.employees,
      }))
      setRunItems(mapped)
    } catch (error) {
      toast.error('Failed to load payroll details: ' + error.message)
    } finally {
      setRunLoading(false)
    }
  }

  const handleReversePayrollRun = async (runId) => {
    if (
      !window.confirm(
        'Are you absolutely sure you want to reverse this payroll run? This will delete all associated payroll items and mark the run as Reversed.'
      )
    )
      return

    try {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData?.user?.id || null

      reversePayrollMutation.mutate(
        { runId, userId },
        {
          onSuccess: () => {
            toast.success('Payroll run reversed successfully.')
            setSelectedRun(null)
          },
          onError: (error) => {
            console.error('Error reversing payroll run:', error)
            toast.error('Failed to reverse payroll run: ' + (error.message || 'Unknown error'))
          },
        }
      )
    } catch (error) {
      console.error('Auth error in reversal:', error)
      toast.error('Auth error: ' + error.message)
    }
  }

  const startProcessing = async () => {
    try {
      await calculatePayroll(selectedDate, selectedDepartment, employeeSearch, runType)
    } catch (error) {
      console.error('Error starting payroll processing:', error)
    }
  }

  const performFinalize = async () => {
    setLoading(true)
    setShowConfirmModal(false)
    try {
      const monthStart = `${selectedDate}-01`
      const employeeIds = payrollData.map((item) => item.id)

      finalizePayrollMutation.mutate(
        {
          monthStart,
          totalNet,
          runType,
          payrollData,
          employeeIds,
          activeCompanyId,
        },
        {
          onSuccess: async (runData) => {
            try {
              const { data: authData } = await supabase.auth.getUser()
              const adminRecipients = [authData?.user?.email].filter(Boolean)
              await notifyPayrollCompleted({
                recipients: adminRecipients,
                period: selectedDate,
                payrollRunId: runData.id,
                totalEmployees: payrollData.length,
                totalAmount: totalNet,
              })
            } catch (err) {
              console.error('Failed to send payroll completed notification:', err)
            }

            setSuccessMessage('Payroll finalized and saved successfully!')
            setPayrollData([])
            setProcessingStep(0)
            setActiveTab('history')

            // Clear success message after delay
            setTimeout(() => setSuccessMessage(''), 3000)
            setLoading(false)
          },
          onError: (error) => {
            toast.error(
              `Error finalizing payroll: ${error.message || 'Unknown error'}. Ensure payroll_runs and payroll_items tables exist in Supabase.`
            )
            setLoading(false)
          },
        }
      )
    } catch (error) {
      toast.error(`Error initiating finalization: ${error.message || 'Unknown error'}`)
      setLoading(false)
    }
  }

  const handleFinalize = () => {
    if (payrollData.length === 0) {
      toast.warning('No payroll data to finalize.')
      return
    }
    setShowConfirmModal(true)
  }

  const handleExportPayroll = () => {
    const sourceItems = selectedRun ? runItems : payrollData
    if (!sourceItems.length) {
      toast.warning('No payroll data available to export.')
      return
    }

    downloadBlob(
      buildPayrollCsv(sourceItems),
      `payroll_${selectedRun?.month_year || selectedDate}.csv`
    )
    setSuccessMessage('Payroll CSV exported successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleSendPayslips = async () => {
    if (!sendEmail && !sendWhatsApp) {
      toast.warning('Please select at least one delivery channel (Email or WhatsApp).')
      return
    }

    const sourceItems = selectedRun ? runItems : payrollData
    if (!sourceItems.length) {
      toast.warning('No payroll data available to send.')
      return
    }

    setLoading(true)
    try {
      const period = selectedRun?.month_year || selectedDate
      let emailCount = 0
      let whatsappCount = 0
      const promises = []

      if (sendEmail) {
        const emailRecipients = sourceItems.filter((item) => item.employee?.email)
        emailCount = emailRecipients.length
        promises.push(
          ...emailRecipients.map((item) =>
            notifyPayslipAvailable({
              email: item.employee.email,
              employeeName: item.name,
              period,
              payrollRunId: selectedRun?.id,
            })
          )
        )
      }

      if (sendWhatsApp) {
        const whatsappRecipients = sourceItems.filter((item) => item.employee?.phone)
        whatsappCount = whatsappRecipients.length

        // Deep link url to employee portal
        const portalUrl = `${window.location.origin}/portal`

        promises.push(
          ...whatsappRecipients.map((item) =>
            sendWhatsAppNotification({
              employeeId: item.id,
              period,
              payslipUrl: portalUrl,
            })
          )
        )
      }

      await Promise.all(promises)

      let statusMsg = ''
      if (sendEmail && emailCount > 0) statusMsg += `Email released for ${emailCount} employee(s). `
      if (sendWhatsApp && whatsappCount > 0)
        statusMsg += `WhatsApp released for ${whatsappCount} employee(s). `

      if (statusMsg === '') {
        toast.warning('No eligible recipients with valid email or phone number found.')
      } else {
        setSuccessMessage(statusMsg.trim())
        setTimeout(() => setSuccessMessage(''), 4000)
      }
    } catch (error) {
      console.error('Payslips release failed:', error)
      toast.error('Failed to dispatch notifications: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-4">
          {successMessage}
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-500 mt-1">
              Process monthly payroll with automated salary calculations and statutory deductions
            </p>
          </div>
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
            {/* Delivery Channels Selectors */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1.5 space-x-3 text-xs">
              <span className="font-bold text-slate-500 uppercase tracking-wider pl-2 mr-1">
                Delivery Channels:
              </span>
              <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="font-bold text-slate-700">Email</span>
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer select-none border-l border-slate-200 pl-3 pr-2">
                <input
                  type="checkbox"
                  checked={sendWhatsApp}
                  onChange={(e) => setSendWhatsApp(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  WhatsApp{' '}
                  <Badge color="bg-emerald-100 text-emerald-800 text-[9px] px-1 py-0.2">
                    Twilio
                  </Badge>
                </span>
              </label>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleExportPayroll}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" /> <span>Export Payroll</span>
              </button>
              <button
                onClick={handleSendPayslips}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" /> <span>Send Payslips</span>
              </button>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="inline-flex items-center p-1 bg-white rounded-xl space-x-1 mb-6 border border-gray-200">
          <button
            onClick={() => setActiveTab('current_period')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'current_period' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'}`}
          >
            Current Period
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'}`}
          >
            Payroll History
          </button>
          <button
            onClick={() => setActiveTab('delivery_logs')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'delivery_logs' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'}`}
          >
            Delivery Logs
          </button>
        </div>

        <PayrollFilterBar
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedDepartment={selectedDepartment}
          setSelectedDepartment={setSelectedDepartment}
          employeeSearch={employeeSearch}
          setEmployeeSearch={setEmployeeSearch}
          runType={runType}
          setRunType={setRunType}
          departments={departments}
          activeTab={activeTab}
        />

        {activeTab === 'current_period' && (
          <div className="mt-6 space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="text-sm font-semibold text-gray-600">
                Eligible Employees:{' '}
                <span className="text-slate-900 font-bold">
                  {employees.length > 0 ? employees.length : 'All'}
                </span>
              </div>
              <button
                onClick={startProcessing}
                disabled={loading}
                className={`flex items-center space-x-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 transition-all ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/50 border-t-white mr-2"></div>
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                <span>
                  {processingStep === 5 ? 'Re-Process Payroll' : 'Start Payroll Processing'}
                </span>
              </button>
            </div>

            {processingStep > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-[6px] border-l-slate-400 overflow-hidden relative group transition-all duration-300 hover:shadow-md">
                <div className="flex items-center space-x-2 mb-6 z-10 relative">
                  <Play className="w-5 h-5 text-slate-500 group-hover:scale-110 transition-transform" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">
                    Processing Progress
                  </h3>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-2.5 mb-8">
                  <div
                    className="bg-slate-900 h-2.5 rounded-full transition-all duration-1000 ease-in-out"
                    style={{ width: `${(processingStep / 5) * 100}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      step: 1,
                      label: 'Attendance Collection',
                      desc: 'Gathering attendance data for all employees',
                    },
                    {
                      step: 2,
                      label: 'Salary Calculation',
                      desc: 'Computing basic salary and allowances',
                    },
                    {
                      step: 3,
                      label: 'Deduction Calculation',
                      desc: 'Calculating PF, ESI, PT, TDS deductions',
                    },
                    {
                      step: 4,
                      label: 'Compliance Verification',
                      desc: 'Verifying statutory compliance',
                    },
                  ].map((s) => (
                    <div
                      key={s.step}
                      className={`p-4 rounded-xl border transition-all duration-500 ${processingStep >= s.step ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100 opacity-50'}`}
                    >
                      <div className="flex items-center space-x-3">
                        {processingStep > s.step ? (
                          <span className="text-emerald-600 font-bold">✓</span>
                        ) : processingStep === s.step ? (
                          <div className="w-5 h-5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin"></div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                        )}
                        <div>
                          <p
                            className={`font-bold text-sm ${processingStep >= s.step ? 'text-emerald-900' : 'text-gray-500'}`}
                          >
                            {s.label}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {processingStep === 5 && (
              <>
                <PayrollSummaryCards
                  employeeCount={payrollData.length}
                  totalGross={totalGross}
                  totalNet={totalNet}
                  formatCurrency={formatCurrency}
                />

                <PayrollCurrentTable
                  payrollData={payrollData}
                  formatCurrency={formatCurrency}
                  onViewPayslip={(item) => {
                    setSelectedItem(item)
                    setShowPayslip(true)
                  }}
                  handleFinalize={handleFinalize}
                  loading={loading}
                />
              </>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="mt-6">
            <PayrollHistoryTab
              history={history}
              selectedRun={selectedRun}
              setSelectedRun={setSelectedRun}
              runItems={runItems}
              runLoading={runLoading}
              reversingRun={reversePayrollMutation.isPending}
              handleReversePayrollRun={handleReversePayrollRun}
              fetchRunItems={fetchRunItems}
              formatCurrency={formatCurrency}
              onViewPayslip={(item) => {
                setSelectedItem(item)
                setShowPayslip(true)
              }}
            />
          </div>
        )}

        {activeTab === 'delivery_logs' && (
          <div className="mt-6">
            <PayrollDeliveryLogsTab
              deliveryLogs={deliveryLogs}
              logsLoading={logsLoading}
              fetchDeliveryLogs={refetchDeliveryLogs}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <ConfirmFinalizeModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={performFinalize}
        employeeCount={payrollData.length}
      />

      <PayslipPreviewModal
        isOpen={showPayslip}
        onClose={() => {
          setShowPayslip(false)
          setSelectedItem(null)
        }}
        item={selectedItem}
        month={selectedRun ? selectedRun.month_year.slice(0, 7) : selectedDate}
        formatCurrency={formatCurrency}
      />

      {/* Print Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
                @media print {
                    @page { margin: 0; size: auto; }
                    body { 
                        visibility: hidden; 
                        margin: 0 !important; 
                        padding: 0 !important;
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    /* Neutralize parent layout constraints */
                    html, body, #root, .flex-1, main, .overflow-y-auto, .max-w-7xl {
                        overflow: visible !important;
                        position: static !important;
                        display: block !important;
                        height: auto !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    .print-container-root, .print-container-root * {
                        visibility: visible !important;
                    }
                    
                    .print-container-root {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        display: block !important;
                        background: white !important;
                        z-index: 99999 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }

                    .print-reset {
                        display: block !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                    }

                    .print-hidden, 
                    .print-reset > *:not(#payslip-content) {
                        display: none !important;
                    }
                    
                    #payslip-content {
                        display: block !important;
                        width: 100% !important;
                        padding: 1.5cm 2cm !important;
                        margin: 0 !important;
                        background: white !important;
                    }
                }
            `,
        }}
      />
    </div>
  )
}
