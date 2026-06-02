import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { devLog } from '../lib/devLogger'
import { useToast } from '../context/ToastContext'
import { buildPayrollCsv, downloadBlob, formatCurrency } from '../lib/payrollUtils'
import { notifyPayrollCompleted, notifyPayslipAvailable } from '../lib/notifications'
import { sendWhatsAppNotification } from '../lib/whatsappService'
import { Calendar, Download, Send, Play, CheckCircle, AlertTriangle, FileText, ChevronRight, Eye, X, Loader2, Search } from 'lucide-react'
import { TableSkeleton } from '../components/ui/SkeletonLoader'
import { usePayrollCalculation } from '../hooks/usePayrollCalculation'

// Helper Components
const Badge = ({ children, color = 'bg-slate-100 text-slate-700' }) => (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${color}`}>
        {children}
    </span>
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
                runType: parsed.runType || 'regular'
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
                runType: 'regular'
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
        calculatePayroll
    } = usePayrollCalculation(initialState)

    const [history, setHistory] = useState([])
    const [successMessage, setSuccessMessage] = useState('')
    const [showPayslip, setShowPayslip] = useState(false)
    const [selectedItem, setSelectedItem] = useState(null)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [selectedRun, setSelectedRun] = useState(null)
    const [runItems, setRunItems] = useState([])
    const [runLoading, setRunLoading] = useState(false)
    const [reversingRun, setReversingRun] = useState(false)

    // WhatsApp & Delivery Logs Upgrade
    const [sendEmail, setSendEmail] = useState(true)
    const [sendWhatsApp, setSendWhatsApp] = useState(false)
    const [deliveryLogs, setDeliveryLogs] = useState([])
    const [logsLoading, setLogsLoading] = useState(false)

    const fetchDeliveryLogs = async () => {
        setLogsLoading(true)
        try {
            const { data, error } = await supabase
                .from('notification_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)
            if (error) throw error
            setDeliveryLogs(data || [])
        } catch (error) {
            console.error('Error fetching delivery logs:', error)
            toast.error('Failed to load delivery logs: ' + error.message)
        } finally {
            setLogsLoading(false)
        }
    }

    // Computed stats
    const totalGross = payrollData.reduce((sum, item) => sum + (item.grossSalary || 0), 0)
    const totalNet = payrollData.reduce((sum, item) => sum + (item.netSalary || 0), 0)
    const departments = ['All Departments', ...Array.from(new Set([...DEFAULT_DEPARTMENTS, ...employees.map(emp => emp.department).filter(Boolean)])).sort()]

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
            runType
        }
        devLog('Syncing payroll_state to sessionStorage:', stateToSave)
        sessionStorage.setItem('payroll_active_state', JSON.stringify(stateToSave))
    }, [selectedDate, selectedDepartment, employeeSearch, processingStep, employees, payrollData, activeTab, runType])

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory()
        } else if (activeTab === 'delivery_logs') {
            fetchDeliveryLogs()
        }
    }, [activeTab])

    const fetchHistory = async () => {
        try {
            const { data, error } = await supabase
                .from('payroll_runs')
                .select('*')
                .order('month_year', { ascending: false })
            if (error) throw error
            setHistory(data || [])
        } catch (error) {
            console.error('Error fetching history:', error)
        }
    }

    const fetchRunItems = async (run) => {
        setRunLoading(true)
        setSelectedRun(run)
        try {
            const { data, error } = await supabase
                .from('payroll_items')
                .select(`
                    *,
                    employees (
                        id,
                        first_name,
                        last_name,
                        employee_id,
                        email,
                        phone,
                        whatsapp_enabled,
                        designation,
                        department,
                        salary,
                        salary_allowances
                    )
                `)
                .eq('payroll_run_id', run.id)

            if (error) throw error

            // Map to same format as payrollData for reuse
            const mapped = (data || []).map(item => ({
                id: item.employees.id,
                name: `${item.employees.first_name} ${item.employees.last_name}`,
                empId: item.employees.employee_id,
                designation: item.employees.designation,
                payableDays: item.attendance_days,
                totalDays: item.breakdown.totalDays,
                basicSalary: item.basic_salary,
                grossSalary: item.breakdown.gross,
                totalDeductions: item.total_deductions,
                netSalary: item.net_salary,
                earningsList: item.breakdown.earnings || [],
                deductionsList: item.breakdown.deductions,
                employee: item.employees
            }))
            setRunItems(mapped)
        } catch (error) {
            toast.error('Failed to load payroll details: ' + error.message)
        } finally {
            setRunLoading(false)
        }
    }

    const handleReversePayrollRun = async (runId) => {
        if (!window.confirm('Are you absolutely sure you want to reverse this payroll run? This will delete all associated payroll items and mark the run as Reversed.')) return
        setReversingRun(true)
        try {
            const { data: authData } = await supabase.auth.getUser()
            
            // Delete associated payroll items
            const { error: itemsError } = await supabase
                .from('payroll_items')
                .delete()
                .eq('payroll_run_id', runId)
            
            if (itemsError) throw itemsError

            // Update payroll run status to reversed
            const { error: runError } = await supabase
                .from('payroll_runs')
                .update({
                    status: 'reversed',
                    reversed_by: authData?.user?.id || null,
                    reversed_at: new Date().toISOString()
                })
                .eq('id', runId)

            if (runError) throw runError

            toast.success('Payroll run reversed successfully.')
            setSelectedRun(null)
            fetchHistory()
        } catch (error) {
            console.error('Error reversing payroll run:', error)
            toast.error('Failed to reverse payroll run: ' + (error.message || 'Unknown error'))
        } finally {
            setReversingRun(false)
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
            const { data: duplicateRun, error: duplicateError } = await supabase
                .from('payroll_runs')
                .select('id, status')
                .eq('month_year', monthStart)
                .eq('run_type', runType)
                .maybeSingle()

            if (duplicateError && duplicateError.code !== 'PGRST116') throw duplicateError
            if (duplicateRun?.id) {
                throw new Error(`Payroll for ${selectedDate} (${runType}) already exists with status ${duplicateRun.status}. Duplicate runs of the same type are blocked.`)
            }

            devLog('Inserting payroll_run...')
            // 1. Create Run Record
            const { data: runData, error: runError } = await supabase
                .from('payroll_runs')
                .insert([{
                    month_year: monthStart,
                    total_amount: totalNet,
                    total_employees: payrollData.length,
                    status: 'Completed',
                    run_type: runType,
                    processed_at: new Date().toISOString()
                }])
                .select()
                .single()

            if (runError) {
                console.error('Supabase runError:', JSON.stringify(runError, null, 2))
                throw runError
            }

            devLog('Payroll run created:', runData.id)

            // 2. Create Items
            const items = payrollData.map(item => ({
                payroll_run_id: runData.id,
                employee_id: item.id,
                basic_salary: parseFloat(item.basicSalary.toFixed(2)),
                total_allowances: parseFloat((item.grossSalary - item.basicSalary).toFixed(2)),
                total_deductions: parseFloat(item.totalDeductions.toFixed(2)),
                net_salary: parseFloat(item.netSalary.toFixed(2)),
                attendance_days: item.payableDays,
                arrears_amount: item.arrearsAmount || 0,
                perquisite_amount: item.perquisiteAmount || 0,
                relief_section_89: item.reliefSection89 || 0,
                breakdown: {
                    gross: item.grossSalary,
                    earnings: item.earningsList,
                    deductions: item.deductionsList,
                    totalDays: item.totalDays
                }
            }))

            devLog('Inserting payroll_items count:', items.length)
            const { error: itemsError } = await supabase
                .from('payroll_items')
                .insert(items)

            if (itemsError) {
                console.error('Supabase itemsError:', JSON.stringify(itemsError, null, 2))
                throw itemsError
            }

            // 3. Update processed arrears logs to processed status
            const employeeIds = payrollData.map(item => item.id)
            const { error: arrearsUpdateError } = await supabase
                .from('salary_arrears_logs')
                .update({ status: 'processed' })
                .in('employee_id', employeeIds)
                .eq('status', 'pending')
            
            if (arrearsUpdateError) {
                console.error('Failed to update arrears status:', arrearsUpdateError)
            }

            devLog('Payroll items and arrears logs updated successfully.')
            const { data: authData } = await supabase.auth.getUser()
            const adminRecipients = [authData?.user?.email].filter(Boolean)
            await notifyPayrollCompleted({
                recipients: adminRecipients,
                period: selectedDate,
                payrollRunId: runData.id,
                totalEmployees: payrollData.length,
                totalAmount: totalNet
            })
            setSuccessMessage('Payroll finalized and saved successfully!')

            // Clear and Switch
            setPayrollData([])
            setProcessingStep(0)
            setActiveTab('history')
            fetchHistory()

            // Clear success message after delay
            setTimeout(() => setSuccessMessage(''), 3000)

        } catch (error) {
            toast.error(`Error finalizing payroll: ${error.message || 'Unknown error'}. Ensure payroll_runs and payroll_items tables exist in Supabase.`)
        } finally {
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
                const emailRecipients = sourceItems.filter(item => item.employee?.email)
                emailCount = emailRecipients.length
                promises.push(
                    ...emailRecipients.map(item => notifyPayslipAvailable({
                        email: item.employee.email,
                        employeeName: item.name,
                        period,
                        payrollRunId: selectedRun?.id
                    }))
                )
            }

            if (sendWhatsApp) {
                const whatsappRecipients = sourceItems.filter(item => item.employee?.phone)
                whatsappCount = whatsappRecipients.length
                
                // Deep link url to employee portal
                const portalUrl = `${window.location.origin}/portal`
                
                promises.push(
                    ...whatsappRecipients.map(item => sendWhatsAppNotification({
                        employeeId: item.id,
                        period,
                        payslipUrl: portalUrl
                    }))
                )
            }

            await Promise.all(promises)

            let statusMsg = ''
            if (sendEmail && emailCount > 0) statusMsg += `Email released for ${emailCount} employee(s). `
            if (sendWhatsApp && whatsappCount > 0) statusMsg += `WhatsApp released for ${whatsappCount} employee(s). `

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
                        <p className="text-sm text-gray-500 mt-1">Process monthly payroll with automated salary calculations and statutory deductions</p>
                    </div>
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                        {/* Delivery Channels Selectors */}
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1.5 space-x-3 text-xs">
                            <span className="font-bold text-slate-500 uppercase tracking-wider pl-2 mr-1">Delivery Channels:</span>
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
                                    WhatsApp <Badge color="bg-emerald-100 text-emerald-800 text-[9px] px-1 py-0.2">Twilio</Badge>
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
                    <button onClick={() => setActiveTab('current_period')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'current_period' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'}`}>Current Period</button>
                    <button onClick={() => setActiveTab('history')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'}`}>Payroll History</button>
                    <button onClick={() => setActiveTab('delivery_logs')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'delivery_logs' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'}`}>Delivery Logs</button>
                </div>

            {activeTab === 'current_period' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* Configuration Card */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-[6px] border-l-indigo-600 group transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center space-x-2 mb-6">
                            <Calendar className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Payroll Period Configuration</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 md:items-end gap-6">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Period</label>
                                <input
                                    type="month"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="w-full bg-slate-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Run Type</label>
                                <select
                                    value={runType}
                                    onChange={(e) => setRunType(e.target.value)}
                                    className="w-full bg-slate-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold"
                                >
                                    <option value="regular">Regular Payroll</option>
                                    <option value="off_cycle">Off-Cycle Payroll</option>
                                    <option value="bonus">Bonus / Incentive</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Department Filter</label>
                                <select
                                    value={selectedDepartment}
                                    onChange={(e) => setSelectedDepartment(e.target.value)}
                                    className="w-full bg-slate-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold"
                                >
                                    {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Employee Search</label>
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={employeeSearch}
                                        onChange={(e) => setEmployeeSearch(e.target.value)}
                                        placeholder="Name, ID, email"
                                        className="w-full pl-9 bg-slate-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold"
                                    />
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Employees</label>
                                <div className="p-2.5 bg-slate-50 border border-gray-200 rounded-lg">
                                    <span className="text-sm font-bold text-slate-800">{employees.length > 0 ? employees.length : 'All'} Eligible</span>
                                </div>
                            </div>
                            <div className="flex-none">
                                <button
                                    onClick={startProcessing}
                                    disabled={loading}
                                    className={`flex items-center space-x-2 px-8 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                                >
                                    {loading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/50 border-t-white mr-2"></div> : <Play className="w-4 h-4 fill-current" />}
                                    <span>{processingStep === 5 ? 'Re-Process' : 'Start Processing'}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Progress Section */}
                    {processingStep > 0 && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-[6px] border-l-slate-400 overflow-hidden relative group transition-all duration-300 hover:shadow-md">
                            <div className="flex items-center space-x-2 mb-6 z-10 relative">
                                <FileText className="w-5 h-5 text-slate-500 group-hover:scale-110 transition-transform" />
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Processing Progress</h3>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-8">
                                <div
                                    className="bg-slate-900 h-2.5 rounded-full transition-all duration-1000 ease-in-out"
                                    style={{ width: `${(processingStep / 5) * 100}%` }}
                                ></div>
                            </div>

                            {/* Steps Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { step: 1, label: 'Attendance Collection', desc: 'Gathering attendance data for all employees' },
                                    { step: 2, label: 'Salary Calculation', desc: 'Computing basic salary and allowances' },
                                    { step: 3, label: 'Deduction Calculation', desc: 'Calculating PF, ESI, PT, TDS deductions' },
                                    { step: 4, label: 'Compliance Verification', desc: 'Verifying statutory compliance' },
                                ].map((s) => (
                                    <div key={s.step} className={`p-4 rounded-xl border transition-all duration-500 ${processingStep >= s.step ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                                        <div className="flex items-center space-x-3">
                                            {processingStep > s.step ? (
                                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                                            ) : processingStep === s.step ? (
                                                <div className="w-5 h-5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin"></div>
                                            ) : (
                                                <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                                            )}
                                            <div>
                                                <p className={`font-bold text-sm ${processingStep >= s.step ? 'text-emerald-900' : 'text-gray-500'}`}>{s.label}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Results Table */}
                    {processingStep === 5 && (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-[6px] border-l-slate-500 transition-all duration-300 hover:scale-[1.02] hover:shadow-md group">
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-500 transition-colors">Total Employees</p>
                                    <p className="text-3xl font-bold text-slate-800 mt-2 transition-transform group-hover:scale-105 origin-left">{payrollData.length}</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-[6px] border-l-emerald-500 transition-all duration-300 hover:scale-[1.02] hover:shadow-md group">
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-500 transition-colors">Gross Payroll</p>
                                    <p className="text-3xl font-bold text-emerald-600 mt-2 transition-transform group-hover:scale-105 origin-left">{formatCurrency(totalGross)}</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-[6px] border-l-blue-500 transition-all duration-300 hover:scale-[1.02] hover:shadow-md group">
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-500 transition-colors">Net Payable</p>
                                    <p className="text-3xl font-bold text-blue-600 mt-2 transition-transform group-hover:scale-105 origin-left">{formatCurrency(totalNet)}</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h3 className="font-bold text-slate-800">Employee Payroll Details ({payrollData.length})</h3>
                                    <button
                                        onClick={handleFinalize}
                                        disabled={loading}
                                        className="px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-75"
                                    >
                                        {loading ? 'Finalizing...' : 'Finalize & Save'}
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Attendance</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Basic Salary</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Gross Salary</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Deductions</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Net Salary</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {payrollData.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div>
                                                            <div className="font-bold text-slate-800">{item.name}</div>
                                                            <div className="text-xs text-gray-500 mt-0.5">{item.designation}</div>
                                                            <div className="text-[10px] text-blue-600 font-mono mt-0.5">{item.empId}</div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="font-medium text-slate-700">{item.payableDays}</span>
                                                        <span className="text-xs text-gray-400">/{item.totalDays} days</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-600">{formatCurrency(item.basicSalary)}</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-slate-800">{formatCurrency(item.grossSalary)}</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-rose-600">
                                                        {formatCurrency(item.totalDeductions)}
                                                        {item.deductionsList.length > 0 && (
                                                            <div className="group relative inline-block ml-1">
                                                                <AlertTriangle className="w-3 h-3 text-gray-400 inline cursor-help" />
                                                                <div className="hidden group-hover:block absolute bg-gray-800 text-white text-xs rounded p-2 z-50 min-w-[150px] -left-10 top-5 shadow-xl">
                                                                    {item.deductionsList.map((d, i) => (
                                                                        <div key={i} className="flex justify-between py-0.5">
                                                                            <span>{d.name}:</span>
                                                                            <span>{d.amount}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-bold text-emerald-600">{formatCurrency(item.netSalary)}</td>
                                                    <td className="px-6 py-4">
                                                        <Badge color="bg-blue-50 text-blue-700 border border-blue-100">Calculated</Badge>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedItem(item)
                                                                setShowPayslip(true)
                                                            }}
                                                            className="text-gray-400 hover:text-slate-800 transition-colors"
                                                        >
                                                            <Eye className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center space-x-3 text-emerald-600 mb-4">
                            <CheckCircle className="w-8 h-8" />
                            <h3 className="text-xl font-bold">Confirm Finalization</h3>
                        </div>
                        <p className="text-gray-600 mb-8 font-medium">
                            Are you sure you want to finalize payroll for <span className="text-slate-900 font-extrabold">{payrollData.length} employees</span>?
                            <br /><br />
                            This will save permanent records to the database and update historical data. This action cannot be undone.
                        </p>
                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={performFinalize}
                                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all"
                            >
                                Yes, Finalize
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {!selectedRun ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                <div className="flex items-center space-x-2">
                                    <FileText className="w-5 h-5 text-slate-700" />
                                    <h3 className="text-lg font-bold text-slate-800">Payroll History</h3>
                                </div>
                            </div>
                            {history.length > 0 ? (
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Period</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Run Type</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Employees</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Total Amount</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date Processed</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {history.map((run) => (
                                            <tr key={run.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-800">{new Date(run.month_year).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</td>
                                                <td className="px-6 py-4">
                                                    <Badge color={
                                                        run.run_type === 'bonus' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                                                        run.run_type === 'off_cycle' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                                        'bg-blue-50 text-blue-700 border border-blue-100'
                                                    }>
                                                        {run.run_type === 'bonus' ? 'Bonus' : run.run_type === 'off_cycle' ? 'Off-Cycle' : 'Regular'}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{run.total_employees}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-emerald-600">{formatCurrency(run.total_amount)}</td>
                                                <td className="px-6 py-4"><Badge color={run.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}>{run.status}</Badge></td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{new Date(run.processed_at || run.created_at).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => fetchRunItems(run)}
                                                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-900 hover:text-white transition-all font-bold text-xs"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        <span>View Details</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-12 text-center text-gray-500 italic">No payroll history found.</div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                             <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <button
                                        onClick={() => setSelectedRun(null)}
                                        className="flex items-center text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
                                        Back to History
                                    </button>
                                    {selectedRun.status !== 'Reversed' && (
                                        <button
                                            onClick={() => handleReversePayrollRun(selectedRun.id)}
                                            disabled={reversingRun}
                                            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 disabled:opacity-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                                        >
                                            {reversingRun ? 'Reversing...' : 'Reverse Payroll Run'}
                                        </button>
                                    )}
                                </div>
                                <div className="text-right">
                                    <h3 className="text-lg font-bold text-slate-800">{new Date(selectedRun.month_year).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</h3>
                                    <p className="text-xs text-slate-400">Payroll run ID: {selectedRun.id.slice(0, 8)}</p>
                                </div>
                            </div>

                            {runLoading ? (
                                <TableSkeleton rows={5} cols={3} />
                            ) : (
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Net Salary</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {runItems.map((item) => (
                                                <tr key={item.empId} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-800">{item.name}</div>
                                                        <div className="text-xs text-gray-500">{item.designation}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatCurrency(item.netSalary)}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedItem(item)
                                                                setShowPayslip(true)
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                                                            title="View Payslip"
                                                        >
                                                            <Eye className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'delivery_logs' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                                <FileText className="w-5 h-5 text-slate-700" />
                                <h3 className="text-lg font-bold text-slate-800">Notification & Delivery Logs</h3>
                            </div>
                            <button
                                onClick={fetchDeliveryLogs}
                                disabled={logsLoading}
                                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-900 hover:text-white transition-all font-bold text-xs disabled:opacity-50"
                            >
                                {logsLoading ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-slate-700 border-t-transparent mr-1"></div>
                                ) : (
                                    <Play className="w-3 h-3 rotate-90" />
                                )}
                                <span>Refresh Logs</span>
                            </button>
                        </div>

                        {logsLoading ? (
                            <TableSkeleton rows={5} cols={5} />
                        ) : deliveryLogs.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Timestamp</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Channel</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Recipient</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Details / Errors</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {deliveryLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge color={
                                                        log.channel === 'whatsapp' 
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                                            : 'bg-blue-50 text-blue-700 border border-blue-100'
                                                    }>
                                                        {log.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-slate-800 text-sm">
                                                    {log.channel === 'whatsapp' ? log.recipient_phone : log.recipient_email}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                                                    {log.notification_type || 'Custom'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge color={
                                                        log.status === 'sent' ? 'bg-green-50 text-green-700 border border-green-100' :
                                                        log.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                                                        log.status === 'skipped' ? 'bg-gray-100 text-gray-600 border border-gray-200' :
                                                        'bg-red-50 text-red-700 border border-red-100'
                                                    }>
                                                        {log.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate" title={log.error_message || log.provider_message_id || ''}>
                                                    {log.status === 'failed' ? (
                                                        <span className="text-red-600 font-medium">{log.error_message}</span>
                                                    ) : (
                                                        <span className="font-mono text-gray-400">{log.provider_message_id || 'N/A'}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-12 text-center text-gray-500 italic">No delivery logs found.</div>
                        )}
                    </div>
                </div>
            )}
            </div>
            {/* Payslip View Modal */}
            {showPayslip && selectedItem && (
                <PayslipModal
                    item={selectedItem}
                    month={selectedDate}
                    onClose={() => {
                        setShowPayslip(false)
                        setSelectedItem(null)
                    }}
                />
            )}

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
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
            `}} />
        </div>
    )
}

function PayslipModal({ item, onClose, month }) {
    const toast = useToast()
    const [downloading, setDownloading] = useState(false)
    const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    const handleDownload = async () => {
        setDownloading(true)
        const element = document.getElementById('payslip-content')
        try {
            const [{ default: jsPDFLib }, { default: html2canvasLib }] = await Promise.all([
                import('jspdf'),
                import('html2canvas')
            ])
            
            const canvas = await html2canvasLib(element, {
                scale: 1.5,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    const clonedRoot = clonedDoc.getElementById('payslip-content');
                    if (clonedRoot) {
                        const styles = clonedDoc.getElementsByTagName('style');
                        const links = clonedDoc.getElementsByTagName('link');
                        while (styles.length > 0) styles[0].parentNode.removeChild(styles[0]);
                        while (links.length > 0) links[0].parentNode.removeChild(links[0]);

                        const stripClasses = (el) => {
                            el.removeAttribute('class');
                            [...el.children].forEach(stripClasses);
                        };
                        stripClasses(clonedRoot);

                        // Enforce A4 Width for PDF Generation (approx 794px at 96 DPI)
                        // This ensures the layout wraps text exactly as it would on A4 paper
                        clonedRoot.style.width = '794px';
                        clonedRoot.style.maxWidth = 'none';
                        clonedRoot.style.minHeight = '1123px'; // A4 height
                        clonedRoot.style.margin = '0 auto';
                        clonedRoot.style.padding = '40px'; // Consistent padding
                        clonedRoot.style.backgroundColor = '#ffffff';
                        clonedRoot.style.position = 'static';
                        clonedRoot.style.overflow = 'visible';
                    }
                }
            })

            const imgData = canvas.toDataURL('image/jpeg', 0.95)
            devLog('Image captured to DataURL, length:', imgData.length)

            if (!imgData || imgData.length < 500) {
                console.error('Image capture seems too small or failed')
                throw new Error('Image capture failed - rendered content is empty')
            }

            const pdf = new jsPDFLib('p', 'mm', 'a4')
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)
            const sanitizedName = item.name.replace(/[^a-z0-9]/gi, '_')
            const sanitizedID = (item.empId || 'ID').toString().replace(/[^a-z0-9]/gi, '_')
            const sanitizedMonth = monthName.replace(/[^a-z0-9]/gi, '_')
            const fileName = `${sanitizedName}_${sanitizedID}_${sanitizedMonth}.pdf`

            devLog('Generating PDF:', fileName)

            // Generate PDF as Blob
            const pdfBlob = pdf.output('blob')

            // Custom secure save function to force filename
            const saveAs = (blob, name) => {
                // IE11 & Edge Legacy support (if needed, though unlikely for this stack)
                if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                    window.navigator.msSaveOrOpenBlob(blob, name)
                    return
                }

                // Modern browsers
                const url = window.URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.style.display = 'none'
                link.href = url
                link.setAttribute('download', name)

                // Appending to body is required for Firefox and some Chrome versions
                document.body.appendChild(link)

                // Programmatic click
                link.click()

                // Cleanup with longer timeout to ensure browser has registered the download
                setTimeout(() => {
                    document.body.removeChild(link)
                    window.URL.revokeObjectURL(url)
                }, 2000)
            }

            saveAs(pdfBlob, fileName)
            devLog('Download triggered successfully via robust saveAs for:', fileName)
        } catch (error) {
            toast.error(`PDF generation failed: ${error.message || 'Unknown error'}. Please use the Print option instead.`)
        } finally {
            setDownloading(false)
        }
    }

    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 print-container-root print:p-0 print:bg-transparent print:backdrop-blur-none">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl relative animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[92vh] border border-slate-200 print:max-h-none print:w-full print:border-none print:shadow-none print:rounded-none print-reset">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800">Payslip - {monthName}</h2>
                        <p className="text-sm text-gray-400 mt-1 font-medium">{item.name} ({item.empId})</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div id="payslip-content" style={{ flexGrow: 1, overflowY: 'auto', backgroundColor: '#ffffff', color: '#111827', width: '100%', padding: '2rem 2.5rem 4rem 2.5rem' }}>
                    {/* Company Branding */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: '900', fontStyle: 'italic', color: '#0f172a', margin: 0, letterSpacing: '-0.05em' }}>YUKTI <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', fontStyle: 'normal', letterSpacing: '0.2em', color: '#2563eb', marginTop: '4px' }}>SMART AUTOMATION</span></h1>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.875rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>PAYSLIP CONFIDENTIAL</p>
                            <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', margin: '4px 0 0 0' }}>{monthName}</p>
                        </div>
                    </div>

                    {/* Employee Profile Card */}
                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '1.5rem', padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Employee Name</p>
                            <p style={{ fontSize: '1.125rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>{item.name}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Employee ID</p>
                            <p style={{ fontSize: '1.125rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>{item.empId}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Designation</p>
                            <p style={{ fontWeight: '700', color: '#334155', margin: 0 }}>{item.designation}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Department</p>
                            <p style={{ fontWeight: '700', color: '#334155', margin: 0 }}>{item.employee?.department || 'Technology'}</p>
                        </div>
                    </div>

                    {/* Attendance Summary */}
                    <div style={{ marginBottom: '2.5rem' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: '900', color: '#0f172a', marginBottom: '1rem', letterSpacing: '-0.02em' }}>Attendance Summary</h3>
                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '1.5rem', padding: '1.5rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                            <div style={{ textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>{item.totalDays}</p>
                                <p style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginTop: '4px' }}>Total Days</p>
                            </div>
                            <div style={{ textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#059669', margin: 0 }}>{item.payableDays}</p>
                                <p style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginTop: '4px' }}>Payable</p>
                            </div>
                            <div style={{ textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#dc2626', margin: 0 }}>{item.totalDays - item.payableDays}</p>
                                <p style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginTop: '4px' }}>Loss of Pay</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#2563eb', margin: 0 }}>0</p>
                                <p style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginTop: '4px' }}>Leave</p>
                            </div>
                        </div>
                    </div>

                    {/* Earnings & Deductions Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginBottom: '2.5rem' }}>
                        {/* Earnings */}
                        <div>
                            <h3 style={{ fontSize: '0.875rem', fontWeight: '900', color: '#059669', marginBottom: '1rem', borderBottom: '1px solid #ecfdf5', paddingBottom: '0.5rem' }}>Earnings</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {(item.earningsList && item.earningsList.length > 0) ? (
                                    item.earningsList.map((earn, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                            <span style={{ color: '#64748b', fontWeight: '500' }}>{earn.name}</span>
                                            <span style={{ color: '#1e293b', fontWeight: '700' }}>{formatCurrency(earn.amount)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                            <span style={{ color: '#64748b', fontWeight: '500' }}>Basic Salary</span>
                                            <span style={{ color: '#1e293b', fontWeight: '700' }}>{formatCurrency(item.basicSalary)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                            <span style={{ color: '#64748b', fontWeight: '500' }}>HRA</span>
                                            <span style={{ color: '#1e293b', fontWeight: '700' }}>{formatCurrency(item.basicSalary * 0.4)}</span>
                                        </div>
                                    </>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #f1f5f9', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
                                    <p style={{ color: '#0f172a', fontWeight: '900', fontSize: '0.875rem', margin: 0 }}>Gross Earnings</p>
                                    <p style={{ color: '#0f172a', fontWeight: '900', fontSize: '0.875rem', margin: 0 }}>{formatCurrency(item.grossSalary)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Deductions */}
                        <div>
                            <h3 style={{ fontSize: '0.875rem', fontWeight: '900', color: '#dc2626', marginBottom: '1rem', borderBottom: '1px solid #fef2f2', paddingBottom: '0.5rem' }}>Deductions</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {item.deductionsList.map((ded, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                        <span style={{ color: '#64748b', fontWeight: '500' }}>{ded.name}</span>
                                        <span style={{ color: '#1e293b', fontWeight: '700' }}>{formatCurrency(ded.amount)}</span>
                                    </div>
                                ))}
                                {item.deductionsList.length === 0 && (
                                    <p style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#94a3b8', margin: 0, padding: '0.5rem 0' }}>No deductions applied</p>
                                )}
                                <div style={{ marginTop: 'auto', paddingTop: '2.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #f1f5f9', paddingTop: '0.75rem' }}>
                                        <p style={{ color: '#0f172a', fontWeight: '900', fontSize: '0.875rem', margin: 0 }}>Total Deductions</p>
                                        <p style={{ color: '#0f172a', fontWeight: '900', fontSize: '0.875rem', margin: 0 }}>{formatCurrency(item.totalDeductions)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Net Salary Highlight Box */}
                    <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '1.5rem', padding: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#166534', margin: 0 }}>Net Salary</h3>
                            <p style={{ fontSize: '10px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Amount Payable to Employee</p>
                        </div>
                        <p style={{ fontSize: '2.25rem', fontWeight: '900', color: '#15803d', margin: 0 }}>{formatCurrency(item.netSalary)}</p>
                    </div>

                    {/* Disclaimer Footer */}
                    <div style={{ marginTop: '4rem', textAlign: 'center', paddingBottom: '2rem' }}>
                        <p style={{ fontSize: '10px', fontWeight: '600', fontStyle: 'italic', color: '#94a3b8', margin: 0 }}>This is a computer generated document and does not require a physical signature.</p>
                        <p style={{ fontSize: '9px', fontWeight: '500', color: '#cbd5e1', marginTop: '0.5rem' }}>© {new Date().getFullYear()} Yukti Smart Automation. All rights reserved.</p>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-8 py-6 border-t border-gray-100 flex justify-end space-x-3 bg-white rounded-b-3xl">
                    <button onClick={handlePrint} className="print-hidden px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-gray-50 transition-all flex items-center space-x-2">
                        <FileText className="w-4 h-4" />
                        <span>Print</span>
                    </button>
                    <button onClick={onClose} className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-gray-50 transition-all">
                        Close
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="flex items-center space-x-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        <span>{downloading ? 'Generating...' : 'Download PDF'}</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
