import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { applyCompanyFilter, withCompanyScope } from '../services/tenantScope'
import { attendanceService } from '../services/attendanceService'
import { getLeavePolicyOptions, normalizeLeaveType, applySandwichRule } from '../lib/leaveUtils'
import { calculateAnnualTax, calculateMonthlyTdsFromDeclaration, getIndianFinancialYear } from '../lib/taxUtils'
import {
    User, Calendar, Mail, FileText, CheckCircle, AlertCircle,
    ChevronDown, Check, Search, MoreHorizontal, Bell
} from 'lucide-react'

import PortalPersonalTab from './portal/PortalPersonalTab'
import PortalJobTab from './portal/PortalJobTab'
import PortalPayrollTab from './portal/PortalPayrollTab'
import PortalTimeOffTab from './portal/PortalTimeOffTab'
import PortalPerformanceTab from './portal/PortalPerformanceTab'
import PortalDocumentsTab from './portal/PortalDocumentsTab'
import PortalExitTab from './portal/PortalExitTab'
import PortalPrivacyTab from './portal/PortalPrivacyTab'

// --- Mock Data / Components ---

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
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
    tds_already_deducted: ''
})

const EmployeeCombobox = ({ employees, selectedId, onChange }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.employee-combobox')) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const filtered = employees.filter(emp =>
        emp.first_name.toLowerCase().includes(search.toLowerCase()) ||
        emp.last_name.toLowerCase().includes(search.toLowerCase()) ||
        emp.employee_id.toLowerCase().includes(search.toLowerCase())
    )

    const selectedEmp = employees.find(e => e.id === selectedId)

    return (
        <div className="relative employee-combobox min-w-[340px]">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full bg-orange-50 px-5 py-3.5 rounded-xl border border-orange-200 shadow-sm cursor-pointer hover:bg-orange-100 transition-colors"
            >
                <div className="flex flex-col items-start overflow-hidden">
                    <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-orange-600/70">Viewing As</span>
                    <span className="text-sm font-bold text-slate-800 truncate w-full leading-tight">
                        {selectedEmp ? `${selectedEmp.first_name} ${selectedEmp.last_name} (${selectedEmp.employee_id})` : 'Select Employee'}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-orange-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-orange-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-orange-50 bg-orange-50/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-orange-400" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search by name or ID..."
                                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none font-medium"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                        {filtered.length > 0 ? (
                            filtered.map(emp => (
                                <div
                                    key={emp.id}
                                    onClick={() => {
                                        onChange(emp.id)
                                        setIsOpen(false)
                                        setSearch('')
                                    }}
                                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedId === emp.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
                                >
                                    <div>
                                        <p className="text-sm font-bold">{emp.first_name} {emp.last_name}</p>
                                        <p className="text-xs opacity-70">{emp.employee_id} • {emp.designation}</p>
                                    </div>
                                    {selectedId === emp.id && <Check className="w-4 h-4" />}
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center text-sm text-gray-400 italic">
                                No employees found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default function EmployeePortal() {
    const navigate = useNavigate()
    const toast = useToast()
    const getPortalCache = () => {
        try {
            const raw = sessionStorage.getItem('employee_portal_cache')
            return raw ? JSON.parse(raw) : null
        } catch {
            return null
        }
    }

    const cachedPortal = getPortalCache()

    const [viewAsId, setViewAsId] = useState(cachedPortal?.viewAsId || '')
    const [employees, setEmployees] = useState(cachedPortal?.employees || [])
    const [currentEmployee, setCurrentEmployee] = useState(cachedPortal?.currentEmployee || null)
    const [isAdmin, setIsAdmin] = useState(cachedPortal?.isAdmin || false)
    const [activeTab, setActiveTab] = useState('personal')
    const [loading, setLoading] = useState(!cachedPortal?.currentEmployee)

    // Data States
    const [payslips, setPayslips] = useState([])
    const [leaves, setLeaves] = useState([])
    const [leavePolicies, setLeavePolicies] = useState([])
    const [leaveBalances, setLeaveBalances] = useState([])
    const [taxDeclaration, setTaxDeclaration] = useState(null)
    const [taxForm, setTaxForm] = useState(getEmptyTaxForm)
    const [savingTaxDeclaration, setSavingTaxDeclaration] = useState(false)
    const [holidays, setHolidays] = useState([])

    // Web Punch-In States
    const [todayPunch, setTodayPunch] = useState(null)
    const [punching, setPunching] = useState(false)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [userIp, setUserIp] = useState('Detecting...')
    const [workMode, setWorkMode] = useState('WFO') // State for WFH, WFO, Client Site

    // ESS Inbox Notifications State
    const [unreadNotifications, setUnreadNotifications] = useState([])
    const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false)

    // Fetch unread notifications
    useEffect(() => {
        const fetchNotifications = async () => {
            if (!viewAsId) {
                setUnreadNotifications([])
                return
            }
            try {
                const { data, error } = await supabase
                    .from('notification_logs')
                    .select('*')
                    .eq('employee_id', viewAsId)
                    .eq('is_read', false)
                    .order('created_at', { ascending: false })
                if (error) throw error
                setUnreadNotifications(data || [])
            } catch (err) {
                console.error('Error fetching unread notifications:', err)
            }
        }
        fetchNotifications()
    }, [viewAsId])

    // Click outside handler for dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.notification-bell-container')) {
                setShowNotificationsDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleMarkNotificationAsRead = async (notificationId) => {
        try {
            const { error } = await supabase
                .from('notification_logs')
                .update({ is_read: true })
                .eq('id', notificationId)
            if (error) throw error

            setUnreadNotifications(prev => prev.filter(n => n.id !== notificationId))
            toast.success('Notification marked as read')
        } catch (err) {
            console.error('Error marking notification as read:', err)
            toast.error('Failed to update notification: ' + err.message)
        }
    }

    // Regularization States
    const [regularizationRequests, setRegularizationRequests] = useState([])
    const [showRegularizeModal, setShowRegularizeModal] = useState(false)
    const [regularizeForm, setRegularizeForm] = useState({
        date: new Date().toISOString().split('T')[0],
        requested_status: 'Present',
        reason: ''
    })
    const [submittingRegularize, setSubmittingRegularize] = useState(false)

    // Running clock effect
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const detectIp = async () => {
        try {
            const res = await fetch('https://api.ipify.org?format=json')
            const data = await res.json()
            setUserIp(data.ip || '127.0.0.1')
        } catch (err) {
            console.error('IP detection failed, using local:', err)
            setUserIp('127.0.0.1')
        }
    }

    const getGeolocation = () => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                toast.warning('Geolocation is not supported by your browser. Punch location will not be recorded.')
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
                    toast.warning('Geolocation permission denied or unavailable. Punch location will not be recorded.')
                    resolve(null)
                },
                { enableHighAccuracy: true, timeout: 5000 }
            )
        })
    }

    const fetchTodayPunch = async (empId) => {
        if (!empId) return
        try {
            const todayStr = new Date().toISOString().split('T')[0]
            const { data, error } = await applyCompanyFilter(
                supabase
                    .from('attendance_punches')
                    .select('*')
            )
                .eq('employee_id', empId)
                .eq('date', todayStr)
                .maybeSingle()
            if (error) throw error

            if (data) {
                // Enrich punch record with work_mode from daily attendance
                const { data: attRecord } = await applyCompanyFilter(
                    supabase
                        .from('attendance')
                        .select('work_mode, punch_location')
                )
                    .eq('employee_id', empId)
                    .eq('date', todayStr)
                    .maybeSingle()

                setTodayPunch({
                    ...data,
                    work_mode: attRecord?.work_mode ? (attRecord.work_mode === 'hybrid' ? 'Client Site' : attRecord.work_mode.toUpperCase()) : 'WFO',
                    punch_location: attRecord?.punch_location || null
                })
            } else {
                setTodayPunch(null)
            }
        } catch (err) {
            console.error('Error fetching today punch:', err)
        }
    }

    const fetchRegularizationRequests = async (empId) => {
        if (!empId) return
        try {
            const { data, error } = await applyCompanyFilter(
                supabase
                    .from('attendance_regularizations')
                    .select('*')
            )
                .eq('employee_id', empId)
                .order('date', { ascending: false })
            if (error) throw error
            setRegularizationRequests(data || [])
        } catch (err) {
            console.error('Error fetching regularization requests:', err)
        }
    }

    const handlePunchIn = async () => {
        if (!viewAsId) return
        setPunching(true)
        try {
            const todayStr = new Date().toISOString().split('T')[0]
            const punchInTime = new Date().toISOString()
            
            // Capture GPS location
            const dbPunchLocation = await getGeolocation()
            
            // Map work_mode
            const dbWorkMode = workMode === 'Client Site' ? 'hybrid' : workMode.toLowerCase()

            // 1. Insert into punches table
            const { error } = await supabase
                .from('attendance_punches')
                .insert([withCompanyScope({
                    employee_id: viewAsId,
                    date: todayStr,
                    punch_in: punchInTime,
                    ip_address: userIp
                })])
            if (error) throw error

            // 2. Also initialize daily attendance record
            const { error: attError } = await supabase
                .from('attendance')
                .upsert(withCompanyScope({
                    employee_id: viewAsId,
                    date: todayStr,
                    status: 'present',
                    check_in: punchInTime,
                    check_out: null,
                    remarks: `Punched In (${workMode})`,
                    work_mode: dbWorkMode,
                    punch_location: dbPunchLocation
                }), { onConflict: 'employee_id, date' })

            if (attError) throw attError

            toast.success(`Successfully Punched In (${workMode})! Have a great shift!`)
            await fetchTodayPunch(viewAsId)
        } catch (err) {
            toast.error('Error punching in: ' + err.message)
        } finally {
            setPunching(false)
        }
    }

    const handlePunchOut = async () => {
        if (!viewAsId || !todayPunch) return
        setPunching(true)
        try {
            const punchOutTime = new Date().toISOString()
            const punchInTime = new Date(todayPunch.punch_in)
            const diffMs = new Date(punchOutTime) - punchInTime
            const workingHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2))

            // Capture GPS location
            const dbPunchLocation = await getGeolocation()

            // Map work_mode
            const dbWorkMode = workMode === 'Client Site' ? 'hybrid' : workMode.toLowerCase()

            // 1. Update punches table
            const { error: punchError } = await supabase
                .from('attendance_punches')
                .update({
                    punch_out: punchOutTime,
                    working_hours: workingHours
                })
                .eq('id', todayPunch.id)

            if (punchError) throw punchError

            // 2. Compute attendance status
            let status = 'present'
            if (workingHours <= 4) status = 'absent'
            else if (workingHours < 8) status = 'half_day'

            // 3. Upsert into daily attendance table
            const todayStr = new Date().toISOString().split('T')[0]
            const { data: attData, error: attError } = await supabase
                .from('attendance')
                .upsert(withCompanyScope({
                    employee_id: viewAsId,
                    date: todayStr,
                    status: status,
                    check_in: todayPunch.punch_in,
                    check_out: punchOutTime,
                    remarks: `Web Punch-In (${workingHours} hrs worked)`,
                    work_mode: dbWorkMode,
                    punch_location: dbPunchLocation
                }), { onConflict: 'employee_id, date' })
                .select()
                .single()

            if (attError) throw attError

            // 4. Trigger Overtime & Comp-Off Auto calculations in backend service
            if (attData) {
                await attendanceService.calculateAndSaveOvertime(attData.id, todayPunch.punch_in, punchOutTime, viewAsId, todayStr)
                await attendanceService.calculateAndCreditCompOff(viewAsId, todayStr)
            }

            toast.success(`Successfully Punched Out! Worked ${workingHours} hours.`)
            await fetchTodayPunch(viewAsId)
        } catch (err) {
            toast.error('Error punching out: ' + err.message)
        } finally {
            setPunching(false)
        }
    }

    const handleApplyRegularization = async (e) => {
        e.preventDefault()
        if (!viewAsId) return
        setSubmittingRegularize(true)
        try {
            // Check if a request already exists for this date
            const { data: existing } = await applyCompanyFilter(
                supabase
                    .from('attendance_regularizations')
                    .select('id')
            )
                .eq('employee_id', viewAsId)
                .eq('date', regularizeForm.date)
                .maybeSingle()

            if (existing) {
                toast.error('A regularization request already exists for this date.')
                setSubmittingRegularize(false)
                return
            }

            const { error } = await supabase
                .from('attendance_regularizations')
                .insert([withCompanyScope({
                    employee_id: viewAsId,
                    date: regularizeForm.date,
                    requested_status: regularizeForm.requested_status,
                    reason: regularizeForm.reason,
                    status: 'pending'
                })])

            if (error) throw error

            toast.success('Regularization request submitted successfully for approval!')
            setShowRegularizeModal(false)
            setRegularizeForm({
                date: new Date().toISOString().split('T')[0],
                requested_status: 'Present',
                reason: ''
            })
            await fetchRegularizationRequests(viewAsId)
        } catch (err) {
            toast.error('Error submitting regularization request: ' + err.message)
        } finally {
            setSubmittingRegularize(false)
        }
    }
    const [attendanceStats, setAttendanceStats] = useState({
        present: 0, absent: 0, late: 0, half: 0, rate: 0
    })

    // Modal State
    const [showLeaveModal, setShowLeaveModal] = useState(false)
    const [leaveForm, setLeaveForm] = useState({
        type: '',
        startDate: '',
        endDate: '',
        reason: ''
    })

    const [timeOffStatusFilter, setTimeOffStatusFilter] = useState('all')
    const [timeOffStartDate, setTimeOffStartDate] = useState('')
    const [timeOffEndDate, setTimeOffEndDate] = useState('')
    const [activeExit, setActiveExit] = useState(null)
    const [refetchTrigger, setRefetchTrigger] = useState(0)
    const triggerRefetch = () => setRefetchTrigger(prev => prev + 1)

    useEffect(() => {
        if (!currentEmployee) return
        sessionStorage.setItem('employee_portal_cache', JSON.stringify({
            currentEmployee,
            viewAsId,
            isAdmin,
            employees
        }))
    }, [currentEmployee, viewAsId, isAdmin, employees])

    // Fetch Current User's Employee Record
    useEffect(() => {
        const fetchCurrentEmployee = async () => {
            try {
                // Get current logged-in user
                const { data: { user } } = await supabase.auth.getUser()

                if (!user) {
                    console.error('No user logged in')
                    return
                }

                // Get employee linked to this user
                const { data: emp, error } = await supabase
                    .from('employees')
                    .select('*, id, registration_id') // Ensure ID is fetched explicitly
                    .eq('user_id', user.id)
                    .single()

                if (error || !emp) {
                    console.error('Employee not found for user:', error)
                    return
                }

                setCurrentEmployee(emp)
                setViewAsId(emp.id)

                // Check if user is admin or HR
                if (['admin', 'hr', 'HR'].includes(emp.role)) {
                    setIsAdmin(true)
                    // Fetch all employees for "View As" dropdown
                    const { data: allEmps } = await applyCompanyFilter(
                        supabase
                            .from('employees')
                            .select('id, first_name, last_name, employee_id, designation')
                    )
                        .eq('status', 'active')
                    if (allEmps) setEmployees(allEmps)
                }
            } catch (error) {


                console.error('Error fetching employee:', error)
            }
        }
        fetchCurrentEmployee()
    }, [])

    // Fetch Data when "View As" changes
    useEffect(() => {
        if (!viewAsId) return

        const fetchData = async () => {
            try {
                setLoading(true)

                const currentYear = new Date().getFullYear()
                const financialYear = getIndianFinancialYear()

                // Execute all independent Supabase lookups concurrently in parallel
                const [
                    empRes,
                    slipsRes,
                    leavesRes,
                    policiesRes,
                    balancesRes,
                    holidaysRes,
                    attendanceRes,
                    exitRes,
                    declarationRes
                ] = await Promise.all([
                    applyCompanyFilter(
                        supabase
                            .from('employees')
                            .select('*')
                    )
                        .eq('id', viewAsId)
                        .single(),
                    applyCompanyFilter(
                        supabase
                            .from('payroll_items')
                            .select(`
                                id, 
                                net_salary, 
                                basic_salary,
                                total_deductions, 
                                total_allowances,
                                attendance_days,
                                breakdown,
                                payroll_run_id,
                                payroll_run:payroll_runs ( month_year, status )
                            `)
                    )
                        .eq('employee_id', viewAsId)
                        .order('created_at', { ascending: false }),
                    applyCompanyFilter(
                        supabase
                            .from('leaves')
                            .select('*')
                    )
                        .eq('employee_id', viewAsId)
                        .order('created_at', { ascending: false }),
                    applyCompanyFilter(
                        supabase
                            .from('leave_policies')
                            .select('*')
                    )
                        .order('leave_type'),
                    applyCompanyFilter(
                        supabase
                            .from('leave_balances')
                            .select('*')
                    )
                        .eq('employee_id', viewAsId)
                        .eq('year', currentYear)
                        .order('leave_type'),
                    applyCompanyFilter(
                        supabase
                            .from('holidays')
                            .select('date')
                    ),
                    applyCompanyFilter(
                        supabase
                            .from('attendance')
                            .select('*')
                    )
                        .eq('employee_id', viewAsId)
                        .order('date', { ascending: false })
                        .limit(30),
                    applyCompanyFilter(
                        supabase
                            .from('exits')
                            .select('*')
                    )
                        .eq('employee_id', viewAsId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle(),
                    applyCompanyFilter(
                        supabase
                            .from('tax_declarations')
                            .select('*')
                    )
                        .eq('employee_id', viewAsId)
                        .eq('financial_year', financialYear)
                        .maybeSingle()
                ])

                if (empRes.error) throw empRes.error

                // 1. Profile Data
                const emp = empRes.data
                setCurrentEmployee(emp)

                // 2. Payslips
                setPayslips(slipsRes.data || [])

                // 3. Leaves
                setLeaves(leavesRes.data || [])
                setLeavePolicies(getLeavePolicyOptions(policiesRes.data || []))
                setLeaveBalances(balancesRes.data || [])
                setHolidays(holidaysRes.data || [])

                // 4. Attendance
                const attLogs = attendanceRes.data || []

                // Fetch punches and regularizations in parallel
                await Promise.all([
                    fetchTodayPunch(viewAsId),
                    fetchRegularizationRequests(viewAsId),
                    detectIp()
                ])

                // Calc Attendance Stats
                const total = attLogs.length
                const present = attLogs.filter(a => a.status === 'present').length
                const abs = attLogs.filter(a => a.status === 'absent').length
                const late = attLogs.filter(a => a.status === 'half_day').length

                setAttendanceStats({
                    present,
                    absent: abs,
                    late: 0,
                    half: late,
                    rate: total > 0 ? Math.round((present / total) * 100) : 0
                })

                // 5. Exit Process Status
                setActiveExit(exitRes.data || null)

                // 6. Tax Declaration
                const declaration = declarationRes.data
                const declarationError = declarationRes.error

                if (!declarationError || declarationError.code === 'PGRST116') {
                    const nextForm = declaration ? {
                        regime: declaration.regime || 'new',
                        section_80c: declaration.section_80c ?? '',
                        section_80d: declaration.section_80d ?? '',
                        hra_exemption: declaration.hra_exemption ?? '',
                        home_loan_interest: declaration.home_loan_interest ?? '',
                        other_deductions: declaration.other_deductions ?? '',
                        other_income: declaration.other_income ?? '',
                        tds_already_deducted: declaration.tds_already_deducted ?? ''
                    } : getEmptyTaxForm()
                    setTaxDeclaration(declaration || null)
                    setTaxForm(nextForm)
                }

            } catch (error) {
                console.error('Error fetching portal data:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [viewAsId, refetchTrigger])

    const handleApplyLeave = async () => {
        if (!leaveForm.type || !leaveForm.startDate || !leaveForm.endDate) {
            toast.warning('Please fill all required fields: Type, Start Date, and End Date.')
            return
        }

        try {
            const diffDays = applySandwichRule(leaveForm.startDate, leaveForm.endDate, holidays)
            if (diffDays <= 0) {
                toast.warning('Selected dates do not contain payable leave days. Weekends and holidays are excluded.')
                return
            }

            const isSickLeave = leaveForm.type === 'Sick Leave' || leaveForm.type === 'Sick'
            if (isSickLeave && diffDays >= 3 && !leaveForm.medicalFile) {
                toast.error('Medical certificate is strictly mandatory for sick leave of 3 or more days.')
                return
            }

            let medicalDocUrl = null
            if (leaveForm.medicalFile) {
                const fileExt = leaveForm.medicalFile.name.split('.').pop()
                const fileName = `${viewAsId}_sick_leave_${Date.now()}.${fileExt}`
                const storagePath = `leaves/${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('employee-documents')
                    .upload(storagePath, leaveForm.medicalFile, {
                        cacheControl: '3600',
                        upsert: true
                    })

                if (uploadError) {
                    console.error('Storage upload error:', uploadError)
                    toast.warning('File upload failed, proceeding without attachment.')
                } else {
                    const { data: publicUrlData } = supabase.storage
                        .from('employee-documents')
                        .getPublicUrl(storagePath)
                    medicalDocUrl = publicUrlData?.publicUrl || null
                }
            }

            const { error } = await supabase.from('leaves').insert([withCompanyScope({
                employee_id: viewAsId,
                leave_type: leaveForm.type,
                start_date: leaveForm.startDate,
                end_date: leaveForm.endDate,
                reason: leaveForm.reason,
                status: 'pending',
                days: diffDays,
                medical_document_url: medicalDocUrl
            })])

            if (error) throw error

            // Refresh leaves
            const { data: updatedLeaves } = await applyCompanyFilter(
                supabase
                    .from('leaves')
                    .select('*')
            )
                .eq('employee_id', viewAsId)
                .order('created_at', { ascending: false })
            setLeaves(updatedLeaves || [])

            const { data: updatedBalances } = await applyCompanyFilter(
                supabase
                    .from('leave_balances')
                    .select('*')
            )
                .eq('employee_id', viewAsId)
                .eq('year', new Date().getFullYear())
                .order('leave_type')
            setLeaveBalances(updatedBalances || [])

            setShowLeaveModal(false)
            setLeaveForm({ type: '', startDate: '', endDate: '', reason: '', medicalFile: null })
            toast.success('Leave application submitted! Your request has been sent for approval.')
        } catch (error) {
            console.error('Error applying leave:', error)
            toast.error('Failed to apply leave: ' + (error.message || 'Unknown error'))
        }
    }

    const parseDateSafe = (value) => {
        if (!value) return null
        const d = new Date(value)
        return Number.isNaN(d.getTime()) ? null : d
    }

    const formatDateSafe = (value, options = { month: 'short', day: '2-digit', year: 'numeric' }, fallback = 'N/A') => {
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

    if (loading && !currentEmployee) return (
        <div className="flex justify-center items-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
        </div>
    )

    const upcomingLeave = leaves.find((leave) => leave.status === 'approved' || leave.status === 'pending')
    const tenureText = (() => {
        if (!currentEmployee?.joining_date) return 'N/A'
        const joined = parseDateSafe(currentEmployee.joining_date)
        if (!joined) return 'N/A'
        const now = new Date()
        const months = (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth())
        const years = Math.floor(Math.max(0, months) / 12)
        const remMonths = Math.max(0, months) % 12
        return `${years}y ${remMonths}m`
    })()

    const overallRating = Number((Math.min(5, Math.max(3.8, 4 + (attendanceStats.rate || 0) / 100))).toFixed(1))
    const goalsCompletion = Math.min(100, Math.max(45, (attendanceStats.rate || 0) + 15))
    const quarterlyGrowth = Math.max(5, Math.min(25, Math.round(((attendanceStats.rate || 50) - 60) * 0.4 + 12)))

    const performanceGoals = [
        {
            title: `Improve ${currentEmployee?.department || 'Department'} delivery quality`,
            progress: Math.min(100, goalsCompletion - 8),
            dateLabel: `Target: ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`,
            status: 'On Track'
        },
        {
            title: `Increase cross-team collaboration`,
            progress: Math.min(100, goalsCompletion - 20),
            dateLabel: `Target: ${new Date(new Date().getFullYear(), new Date().getMonth() + 2, 1).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`,
            status: 'In Progress'
        },
        {
            title: `Mentor junior team members`,
            progress: Math.min(100, goalsCompletion + 5),
            dateLabel: `Updated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`,
            status: 'Completed'
        }
    ]

    const competencies = [
        { label: 'Technical Proficiency', score: Number((4 + (attendanceStats.rate || 0) / 200).toFixed(1)) },
        { label: 'Leadership & Mentorship', score: Number((3.8 + (attendanceStats.present || 0) / 120).toFixed(1)) },
        { label: 'Communication & Teamwork', score: Number((4 + (attendanceStats.rate || 0) / 220).toFixed(1)) },
        { label: 'Strategic Problem Solving', score: Number((3.7 + (attendanceStats.half || 0) / 100 + 0.4).toFixed(1)) }
    ]

    const reviewHistory = (payslips || []).slice(0, 3).map((slip, index) => {
        const period = parseDateSafe(slip.payroll_run?.month_year ? `${slip.payroll_run.month_year}-01` : null)
            || new Date(new Date().getFullYear(), new Date().getMonth() - index, 1)
        const score = Number((4.2 + ((index + 1) * 0.12)).toFixed(1))
        return {
            id: slip.id,
            periodLabel: `${period.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Review`,
            rangeLabel: `${period.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
            reviewer: currentEmployee?.reporting_person || 'Reporting Manager',
            score
        }
    })

    const approvedLeaves = (leaves || []).filter((leave) => (leave.status || '').toLowerCase() === 'approved')
    const usedByType = approvedLeaves.reduce((acc, leave) => {
        const key = normalizeLeaveType(leave.leave_type)
        const days = Number(leave.days || 0)
        acc[key] = (acc[key] || 0) + days
        return acc
    }, { vacation: 0, sick: 0, personal: 0 })

    const cardStyles = [
        { accent: 'bg-blue-600', iconBg: 'bg-blue-100 text-blue-600', icon: Calendar },
        { accent: 'bg-rose-500', iconBg: 'bg-rose-100 text-rose-600', icon: AlertCircle },
        { accent: 'bg-amber-500', iconBg: 'bg-amber-100 text-amber-600', icon: User },
        { accent: 'bg-emerald-500', iconBg: 'bg-emerald-100 text-emerald-600', icon: CheckCircle }
    ]
    const timeOffCards = getLeavePolicyOptions(leavePolicies).map((policy, index) => {
        const key = normalizeLeaveType(policy.leave_type)
        const balanceRow = leaveBalances.find(balance => normalizeLeaveType(balance.leave_type) === key)
        const used = usedByType[key] || 0
        const total = Number(balanceRow?.balance || 0) + used || Number(policy.annual_balance || 0)
        return {
            key,
            title: policy.leave_type,
            total,
            used,
            ...cardStyles[index % cardStyles.length]
        }
    })
    const totalRemainingPto = timeOffCards.reduce((sum, card) => sum + Math.max(0, (card.total || 0) - (card.used || 0)), 0)

    const sortedLeaves = [...(leaves || [])].sort((a, b) => {
        const bd = parseDateSafe(b.created_at || b.start_date)?.getTime() || 0
        const ad = parseDateSafe(a.created_at || a.start_date)?.getTime() || 0
        return bd - ad
    })
    const timeOffHistory = sortedLeaves
        .filter((leave) => {
            const status = (leave.status || '').toLowerCase()
            const leaveStart = parseDateSafe(leave.start_date)
            const fromDate = parseDateSafe(timeOffStartDate)
            const toDate = parseDateSafe(timeOffEndDate)

            if (timeOffStatusFilter !== 'all' && status !== timeOffStatusFilter) return false
            if (!leaveStart || isNaN(leaveStart.getTime())) return false
            if (fromDate && leaveStart < fromDate) return false
            if (toDate) {
                const inclusiveTo = new Date(toDate)
                inclusiveTo.setHours(23, 59, 59, 999)
                if (leaveStart > inclusiveTo) return false
            }
            return true
        })
        .slice(0, 8)
    const upcomingLeaves = (leaves || [])
        .filter((leave) => {
            const status = (leave.status || '').toLowerCase()
            const start = parseDateSafe(leave.start_date)
            if (!start || isNaN(start.getTime())) return false
            return (status === 'approved' || status === 'pending') && start >= new Date(new Date().toDateString())
        })
        .sort((a, b) => {
            const ad = parseDateSafe(a.start_date)?.getTime() || 0
            const bd = parseDateSafe(b.start_date)?.getTime() || 0
            return ad - bd
        })
        .slice(0, 2)

    const monthlySalary = (Number(currentEmployee?.salary || 0) + Number(currentEmployee?.salary_allowances || 0)) ||
        (Number(payslips?.[0]?.basic_salary || 0) + Number(payslips?.[0]?.total_allowances || 0)) || 0
    const annualSalary = monthlySalary * 12
    const ytdEarnings = payslips.reduce((sum, slip) => sum + (Number(slip.net_salary) || 0), 0)
    const payFrequency = 'Monthly'
    const nextPayDate = (() => {
        const today = new Date()
        const next = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        if (today.getDate() >= next.getDate()) {
            next.setMonth(next.getMonth() + 1, 0)
        }
        return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    })()

    const latestPayslips = payslips.slice(0, 3)
    const latestBreakdownDeductions = payslips?.[0]?.breakdown?.deductions || []
    const benefitRows = latestBreakdownDeductions.length > 0
        ? latestBreakdownDeductions.slice(0, 3).map((ded, idx) => ({
            name: ded.name,
            plan: `${currentEmployee?.department || 'Standard'} Plan`,
            value: `${formatCurrency(ded.amount)}/pay`,
            iconBg: idx % 3 === 0 ? 'bg-blue-100 text-blue-600' : idx % 3 === 1 ? 'bg-violet-100 text-violet-600' : 'bg-emerald-100 text-emerald-600'
        }))
        : []

    const totalBenefitDeduction = latestBreakdownDeductions.reduce((sum, ded) => sum + (Number(ded.amount) || 0), 0)

    const taxFinancialYear = getIndianFinancialYear()
    const taxAnnualGross = monthlySalary * 12 + Number(taxForm.other_income || 0)
    const taxPreview = calculateAnnualTax({
        annualGross: taxAnnualGross,
        regime: taxForm.regime,
        declaration: taxForm
    })
    const monthlyTdsPreview = calculateMonthlyTdsFromDeclaration({
        monthlyGross: monthlySalary,
        declaration: taxForm,
        monthsRemaining: 12
    })
    const canEditTaxDeclaration = !taxDeclaration || ['draft', 'rejected'].includes(taxDeclaration.status)

    const updateTaxForm = (field, value) => {
        setTaxForm((prev) => ({ ...prev, [field]: value }))
    }

    const saveTaxDeclaration = async () => {
        if (!viewAsId) return
        if (!canEditTaxDeclaration) {
            toast.error('This declaration is already submitted or approved.')
            return
        }

        setSavingTaxDeclaration(true)
        try {
            const payload = {
                employee_id: viewAsId,
                financial_year: taxFinancialYear,
                regime: taxForm.regime,
                section_80c: Number(taxForm.section_80c || 0),
                section_80d: Number(taxForm.section_80d || 0),
                hra_exemption: Number(taxForm.hra_exemption || 0),
                home_loan_interest: Number(taxForm.home_loan_interest || 0),
                other_deductions: Number(taxForm.other_deductions || 0),
                other_income: Number(taxForm.other_income || 0),
                tds_already_deducted: Number(taxForm.tds_already_deducted || 0),
                status: 'submitted',
                updated_at: new Date().toISOString()
            }

            const { data, error } = await supabase
                .from('tax_declarations')
                .upsert(withCompanyScope(payload), { onConflict: 'employee_id,financial_year' })
                .select('*')
                .single()

            if (error) throw error
            setTaxDeclaration(data)
            toast.success('Tax declaration submitted for HR review.')
        } catch (error) {
            toast.error(error.message || 'Unable to save tax declaration.')
        } finally {
            setSavingTaxDeclaration(false)
        }
    }

    const maskedIdentifier = (() => {
        const raw = (currentEmployee?.aadhaar_number || currentEmployee?.pan_number || '').toString().replace(/\s+/g, '')
        if (!raw) return '***-**-0000'
        const last4 = raw.slice(-4)
        return `***-**-${last4}`
    })()

    return (
        <div className="space-y-8 pb-10 animate-in fade-in duration-500">


            {currentEmployee && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="h-24 bg-gradient-to-r from-blue-600 to-blue-400 rounded-t-2xl"></div>
                    <div className="px-6 pb-5 -mt-10">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                                <div className="w-24 h-24 rounded-xl border-4 border-white shadow-md bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-700 overflow-hidden">
                                    {currentEmployee.profile_photo_url ? (
                                        <img src={currentEmployee.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <>{currentEmployee.first_name?.[0] || ''}{currentEmployee.last_name?.[0] || ''}</>
                                    )}
                                </div>
                                <div className="pt-12 lg:pt-10">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h2 className="text-3xl font-bold text-slate-900 leading-none">{currentEmployee.first_name} {currentEmployee.last_name}</h2>
                                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Active</span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-2">
                                        {currentEmployee.designation || 'Employee'} • Employee ID: #{currentEmployee.employee_id}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 self-end lg:self-auto lg:pt-10 shrink-0">
                                {isAdmin && employees.length > 0 && (
                                    <EmployeeCombobox
                                        employees={employees}
                                        selectedId={viewAsId}
                                        onChange={setViewAsId}
                                    />
                                )}

                                {/* Notification Bell Dropdown */}
                                <div className="relative notification-bell-container">
                                    <button
                                        onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                                        className="h-11 w-11 rounded-lg border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors inline-flex items-center justify-center relative bg-white shadow-sm cursor-pointer"
                                        title="Notifications"
                                    >
                                        <Bell className="w-5 h-5" />
                                        {unreadNotifications.length > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full text-[10px] font-black w-5 h-5 flex items-center justify-center animate-bounce border-2 border-white shadow-sm">
                                                {unreadNotifications.length}
                                            </span>
                                        )}
                                    </button>

                                    {showNotificationsDropdown && (
                                        <div className="absolute right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 w-80 max-w-sm">
                                            <div className="p-4 border-b border-gray-50 bg-slate-50 flex items-center justify-between">
                                                <span className="text-xs uppercase tracking-widest font-black text-slate-500">ESS Inbox Notifications</span>
                                                {unreadNotifications.length > 0 && (
                                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                                        {unreadNotifications.length} Unread
                                                    </span>
                                                )}
                                            </div>
                                            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                                                {unreadNotifications.length > 0 ? (
                                                    unreadNotifications.map(notification => (
                                                        <div
                                                            key={notification.id}
                                                            onClick={() => handleMarkNotificationAsRead(notification.id)}
                                                            className="p-4 hover:bg-slate-50 cursor-pointer transition-colors text-left"
                                                        >
                                                            <p className="text-xs font-bold text-slate-800 leading-tight">
                                                                {notification.subject || notification.notification_type || 'Notification'}
                                                            </p>
                                                            <p className="text-xs text-slate-500 mt-1 font-medium leading-normal">
                                                                {notification.message || notification.metadata?.message || 'New update is available.'}
                                                            </p>
                                                            <p className="text-[9px] text-gray-400 mt-2 font-mono">
                                                                {new Date(notification.created_at).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-8 text-center text-xs text-gray-400 italic">
                                                        No unread notifications
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button onClick={openEditProfileModal} className="h-11 px-4 rounded-lg border border-gray-200 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors inline-flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Edit Profile
                                </button>
                                <button className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
                                    <Mail className="w-4 h-4" /> Message
                                </button>
                                <button className="h-11 w-11 rounded-lg border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors inline-flex items-center justify-center">
                                    <MoreHorizontal className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="mt-6 border-t border-gray-200 pt-3">
                            <div className="inline-flex items-center space-x-1 bg-white p-1 rounded-xl w-fit border border-gray-200">
                                {[
                                    { key: 'personal', label: 'Personal Info' },
                                    { key: 'job', label: 'Job Details' },
                                    { key: 'payroll', label: 'Payroll & Benefits' },
                                    { key: 'timeoff', label: 'Time & Attendance' },
                                    { key: 'performance', label: 'Performance' },
                                    { key: 'documents', label: 'Documents' },
                                    { key: 'exit', label: 'Exit Process' },
                                    { key: 'privacy', label: 'Privacy & Data' }
                                ].map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Content */}

            {activeTab === 'personal' && currentEmployee && (
                <PortalPersonalTab
                    currentEmployee={currentEmployee}
                    tenureText={tenureText}
                    totalRemainingPto={totalRemainingPto}
                    attendanceStats={attendanceStats}
                    upcomingLeave={upcomingLeave}
                    formatDateSafe={formatDateSafe}
                    toast={toast}
                    onProfileUpdated={triggerRefetch}
                />
            )}

            {/* 1. PAYSLIPS TAB */}
            {activeTab === 'payroll' && (
                <PortalPayrollTab
                    currentEmployee={currentEmployee}
                    isAdmin={isAdmin}
                    monthlySalary={monthlySalary}
                    annualSalary={annualSalary}
                    payFrequency={payFrequency}
                    nextPayDate={nextPayDate}
                    ytdEarnings={ytdEarnings}
                    taxDeclaration={taxDeclaration}
                    taxForm={taxForm}
                    updateTaxForm={updateTaxForm}
                    canEditTaxDeclaration={canEditTaxDeclaration}
                    maskedIdentifier={maskedIdentifier}
                    taxFinancialYear={taxFinancialYear}
                    taxPreview={taxPreview}
                    monthlyTdsPreview={monthlyTdsPreview}
                    savingTaxDeclaration={savingTaxDeclaration}
                    saveTaxDeclaration={saveTaxDeclaration}
                    benefitRows={benefitRows}
                    totalBenefitDeduction={totalBenefitDeduction}
                    latestPayslips={latestPayslips}
                    formatMonthYearSafe={formatMonthYearSafe}
                    formatCurrency={formatCurrency}
                    toast={toast}
                />
            )}

            {/* TIME OFF TAB */}
            {activeTab === 'timeoff' && currentEmployee && (
                <PortalTimeOffTab
                    currentEmployee={currentEmployee}
                    viewAsId={viewAsId}
                    todayPunch={todayPunch}
                    punching={punching}
                    currentTime={currentTime}
                    userIp={userIp}
                    handlePunchIn={handlePunchIn}
                    handlePunchOut={handlePunchOut}
                    regularizationRequests={regularizationRequests}
                    showRegularizeModal={showRegularizeModal}
                    setShowRegularizeModal={setShowRegularizeModal}
                    regularizeForm={regularizeForm}
                    setRegularizeForm={setRegularizeForm}
                    submittingRegularize={submittingRegularize}
                    handleApplyRegularization={handleApplyRegularization}
                    timeOffHistory={timeOffHistory}
                    timeOffStatusFilter={timeOffStatusFilter}
                    setTimeOffStatusFilter={setTimeOffStatusFilter}
                    timeOffStartDate={timeOffStartDate}
                    setTimeOffStartDate={setTimeOffStartDate}
                    timeOffEndDate={timeOffEndDate}
                    setTimeOffEndDate={setTimeOffEndDate}
                    upcomingLeaves={upcomingLeaves}
                    timeOffCards={timeOffCards}
                    formatDateSafe={formatDateSafe}
                    leavePolicies={leavePolicies}
                    leaveForm={leaveForm}
                    setLeaveForm={setLeaveForm}
                    showLeaveModal={showLeaveModal}
                    setShowLeaveModal={setShowLeaveModal}
                    handleApplyLeave={handleApplyLeave}
                    holidays={holidays}
                    loading={loading}
                    workMode={workMode}
                    setWorkMode={setWorkMode}
                />
            )}

            {/* PERFORMANCE TAB */}
            {activeTab === 'performance' && currentEmployee && (
                <PortalPerformanceTab
                    currentEmployee={currentEmployee}
                    overallRating={overallRating}
                    goalsCompletion={goalsCompletion}
                    quarterlyGrowth={quarterlyGrowth}
                    performanceGoals={performanceGoals}
                    competencies={competencies}
                    reviewHistory={reviewHistory}
                    toast={toast}
                />
            )}

            {/* JOB DETAILS TAB */}
            {activeTab === 'job' && currentEmployee && (
                <PortalJobTab
                    currentEmployee={currentEmployee}
                    tenureText={tenureText}
                    formatDateSafe={formatDateSafe}
                    toast={toast}
                />
            )}

            {/* DOCUMENTS TAB */}
            {activeTab === 'documents' && currentEmployee && (
                <PortalDocumentsTab
                    currentEmployee={currentEmployee}
                    viewAsId={viewAsId}
                    toast={toast}
                />
            )}

            {/* EXIT PROCESS TAB */}
            {activeTab === 'exit' && (
                <PortalExitTab
                    currentEmployee={currentEmployee}
                    viewAsId={viewAsId}
                    isAdmin={isAdmin}
                    toast={toast}
                    activeExit={activeExit}
                    setActiveExit={setActiveExit}
                    loading={loading}
                    setLoading={setLoading}
                />
            )}

            {/* PRIVACY & DATA TAB */}
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
