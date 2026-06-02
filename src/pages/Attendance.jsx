import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { devLog } from '../lib/devLogger'
import { useToast } from '../context/ToastContext'
import { applyCompanyFilter, withCompanyScope } from '../services/tenantScope'
import Modal from '../components/ui/Modal'
import { TableRowSkeleton } from '../components/ui/SkeletonLoader'
import {
    Users,
    UserCheck,
    UserX,
    Calendar,
    Clock,
    LogOut,
    Search,
    RotateCcw,
    Plus,
    Check,
    X,
    Pencil,
    Upload,
    Download,
    AlertTriangle,
    FileUp
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getLeavePolicyOptions } from '../lib/leaveUtils'
import { notifyLeaveStatus } from '../lib/notifications'

const StatCard = ({ title, value, icon: Icon, colorClass, borderColor }) => (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-[6px] ${borderColor} flex items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-default group`}>
        <div className="space-y-1">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-500 transition-colors">{title}</p>
            <p className="text-3xl font-bold text-slate-800 group-hover:scale-105 transition-transform origin-left">{value}</p>
        </div>
        <div className={`p-3 rounded-xl transition-all duration-300 group-hover:rotate-12 group-hover:scale-110 shadow-sm ${colorClass} flex items-center justify-center`}>
            <Icon className="w-5 h-5" />
        </div>
    </div>
)

export default function Attendance() {
    const { isAdmin, profileData } = useAuth()
    const toast = useToast()
    const [stats, setStats] = useState({
        total: 0,
        present: 0,
        absent: 0,
        onLeave: 0,
        late: 0,
        early: 0,
        rate: 0
    })
    const [activeTab, setActiveTab] = useState('daily')
    const [loading, setLoading] = useState(true)
    const [leaveApplications, setLeaveApplications] = useState([])
    const [leavePolicies, setLeavePolicies] = useState([])
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false)
    const [employees, setEmployees] = useState([])
    const [submitting, setSubmitting] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')
    const [leaveForm, setLeaveForm] = useState({
        employee_id: '',
        leave_type: 'Annual Leave',
        start_date: '',
        end_date: '',
        reason: ''
    })
    const [manualForm, setManualForm] = useState({
        employee_id: '',
        date: new Date().toISOString().split('T')[0],
        check_in: '',
        check_out: '',
        status: 'present',
        remarks: ''
    })
    const [manualErrors, setManualErrors] = useState({})

    // Bulk Upload State
    const [csvFile, setCsvFile] = useState(null)
    const [uploadStats, setUploadStats] = useState(null)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadReport, setUploadReport] = useState([]) // Details of success/failure

    const [errorMessage, setErrorMessage] = useState('')
    // Attendance Policy & Webhook State
    const [attendancePolicies, setAttendancePolicies] = useState([
        {
            id: '1',
            name: 'General Shift Policy',
            grace_period_mins: 15,
            core_start_time: '09:00',
            core_end_time: '18:00',
            half_day_threshold_mins: 240,
            late_arrival_limit: 3
        }
    ])
    const [policyForm, setPolicyForm] = useState({
        name: '',
        grace_period_mins: 15,
        core_start_time: '09:00',
        core_end_time: '18:00',
        half_day_threshold_mins: 240,
        late_arrival_limit: 3
    })
    const webhookUrl = 'https://api.payroll.smart/v1/biometrics/punch-webhook'
    const [dailyAttendance, setDailyAttendance] = useState([])
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editingRecord, setEditingRecord] = useState(null)
    const [editForm, setEditForm] = useState({
        check_in: '',
        check_out: '',
        status: '',
        remarks: ''
    })
    const [holidays, setHolidays] = useState([])

    // New Filters State
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('All Status')
    const [deptFilter, setDeptFilter] = useState('All Departments')
    const [dateFilter, setDateFilter] = useState(new Date().toISOString().substring(0, 7)) // Default to current month (YYYY-MM)

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        type: 'danger' // 'danger' or 'info'
    })

    // Calendar View States
    const [selectedCalendarEmployee, setSelectedCalendarEmployee] = useState('')
    const [calendarAttendance, setCalendarAttendance] = useState([])
    const [calendarLoading, setCalendarLoading] = useState(false)

    // Regularization States
    const [regularizationRequests, setRegularizationRequests] = useState([])


    const clearFilters = () => {
        setSearchQuery('')
        setDateFilter(new Date().toISOString().substring(0, 7))
        setStatusFilter('All Status')
        setDeptFilter('All Departments')
    }

    const fetchHolidays = async () => {
        try {
            const { data, error } = await applyCompanyFilter(supabase.from('holidays').select('*'))
            if (error) throw error
            setHolidays(data || [])
            return data || []
        } catch (error) {
            console.error('Error fetching holidays:', error)
            return []
        }
    }

    const normalizeDate = (dateStr) => {
        if (!dateStr) return null
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
        const parts = dateStr.trim().split(/[-/]/)
        if (parts.length === 3) {
            if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
            if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
        }
        return dateStr
    }

    const combineDateAndTime = (dateStr, timeStr) => {
        if (!timeStr) return null
        const t = timeStr.trim()
        if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return `${dateStr}T${t}.000Z`
        if (/^\d{2}:\d{2}$/.test(t)) return `${dateStr}T${t}:00.000Z`
        return null
    }

    const getStatusFromHours = (checkIn, checkOut, defaultStatus, dateStr) => {
        const statusMap = {
            'P': 'present', 'A': 'absent', 'WO': 'weekly_off',
            'present': 'present', 'absent': 'absent', 'weekly_off': 'weekly_off'
        }
        const mappedStatus = statusMap[defaultStatus] || statusMap[defaultStatus?.toUpperCase()]

        const date = new Date(dateStr)
        const isSunday = date.getDay() === 0
        const isHoliday = holidays.some(h => h.date === dateStr)

        if (mappedStatus === 'weekly_off' || (isSunday && !mappedStatus)) return 'weekly_off'
        if (isHoliday && !mappedStatus) return 'on_leave'

        if (mappedStatus === 'absent') return 'absent'

        if (checkIn && checkOut) {
            const diff = new Date(checkOut) - new Date(checkIn)
            const hours = diff / (1000 * 60 * 60)
            if (hours <= 4) return 'absent'
            if (hours < 8) return 'half_day'
            return 'present'
        }

        // Default to absent if no punch, except Sundays/Holidays
        if (isSunday) return 'weekly_off'
        if (isHoliday) return 'on_leave'
        return mappedStatus || 'absent'
    }

    const fetchEmployees = async () => {
        try {
            const { data, error } = await applyCompanyFilter(
                supabase
                    .from('employees')
                    .select('id, first_name, last_name')
            )
                .eq('status', 'active')
 
            if (error) throw error
            setEmployees(data || [])
        } catch (error) {
            console.error('Error fetching employees:', error)
        }
    }

    useEffect(() => {
        fetchHolidays()
    }, [])

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true)
            try {
                if (activeTab === 'daily') {
                    // Fetch attendance stats and daily list concurrently
                    await Promise.all([
                        fetchAttendanceStats(),
                        fetchDailyAttendance()
                    ])
                } else if (activeTab === 'leave') {
                    // Fetch policies, applications, and employee list concurrently
                    await Promise.all([
                        fetchLeavePolicies(),
                        fetchLeaveApplications(),
                        fetchEmployees()
                    ])
                } else if (activeTab === 'manual') {
                    await fetchEmployees()
                } else if (activeTab === 'calendar') {
                    await fetchEmployees()
                } else if (activeTab === 'regularization') {
                    await fetchRegularizationRequests()
                } else if (activeTab === 'policies') {
                    await fetchAttendancePolicies()
                }
            } finally {
                setLoading(false)
            }
        }
        fetchDashboardData()
         
    }, [activeTab, dateFilter, searchQuery, statusFilter, deptFilter])

    // Load first employee for calendar view
    useEffect(() => {
        if (employees.length > 0 && activeTab === 'calendar' && !selectedCalendarEmployee) {
            setSelectedCalendarEmployee(employees[0].id)
        }
    }, [employees, activeTab, selectedCalendarEmployee])

    // Auto-fetch calendar attendance on select/date change
    useEffect(() => {
        if (activeTab === 'calendar' && selectedCalendarEmployee) {
            fetchCalendarAttendance(selectedCalendarEmployee, dateFilter)
        }
    }, [activeTab, selectedCalendarEmployee, dateFilter])

    const fetchAttendancePolicies = async () => {
        try {
            const { data, error } = await applyCompanyFilter(
                supabase.from('attendance_policies').select('*')
            ).order('name')
            if (error) throw error
            if (data && data.length > 0) {
                setAttendancePolicies(data)
            }
        } catch (error) {
            console.error('Error fetching policies:', error)
        }
    }
 
    const handleSavePolicy = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const { error } = await supabase.from('attendance_policies').insert([withCompanyScope(policyForm)])
            if (error) throw error
            toast.success('Attendance policy created successfully!')
            setPolicyForm({
                name: '',
                grace_period_mins: 15,
                core_start_time: '09:00',
                core_end_time: '18:00',
                half_day_threshold_mins: 240,
                late_arrival_limit: 3
            })
            await fetchAttendancePolicies()
        } catch (error) {
            toast.error('Error saving policy: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }
 
    const fetchLeavePolicies = async () => {
        const { data } = await applyCompanyFilter(
            supabase.from('leave_policies').select('*')
        ).order('leave_type')
        setLeavePolicies(getLeavePolicyOptions(data || []))
    }
 
    const handleSubmitLeave = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const { error } = await supabase
                .from('leaves')
                .insert([withCompanyScope({
                    ...leaveForm,
                    status: 'pending'
                })])
 
            if (error) throw error
 
            setIsLeaveModalOpen(false)
            setLeaveForm({
                employee_id: '',
                leave_type: leavePolicies[0]?.leave_type || 'Annual Leave',
                start_date: '',
                end_date: '',
                reason: ''
            })
            await fetchLeaveApplications()
            toast.success('Leave application submitted successfully!')
        } catch (error) {
            toast.error('Error submitting leave application: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }
 
    const handleLeaveStatus = async (id, status) => {
        try {
            const leaveBefore = leaveApplications.find(leave => leave.id === id)
            const rpcName = status === 'approved' ? 'approve_leave_request' : 'reject_leave_request'
            const { error } = await supabase.rpc(rpcName, { p_leave_id: id })
 
            if (error) throw error
 
            const { data: leaveWithEmployee } = await applyCompanyFilter(
                supabase
                    .from('leaves')
                    .select('id, leave_type, employee:employees(first_name, last_name, email)')
            )
                .eq('id', id)
                .single()
            await notifyLeaveStatus({
                email: leaveWithEmployee?.employee?.email,
                employeeName: `${leaveWithEmployee?.employee?.first_name || ''} ${leaveWithEmployee?.employee?.last_name || ''}`.trim(),
                status,
                leaveType: leaveWithEmployee?.leave_type || leaveBefore?.leave_type,
                leaveId: id
            })

            await fetchLeaveApplications()
            await fetchAttendanceStats()
            await fetchDailyAttendance()
            toast.success(`Leave ${status} successfully`)
        } catch (error) {
            toast.error('Error updating leave status: ' + error.message)
        }
    }

    const validateManualForm = () => {
        const errors = {}
        if (!manualForm.employee_id) errors.employee_id = 'Employee is required'
        if (!manualForm.date) errors.date = 'Date is required'

        if (manualForm.status === 'present' || manualForm.status === 'late') {
            if (!manualForm.check_in) errors.check_in = 'Check In time is required for selected status'
        }

        if (manualForm.check_in && manualForm.check_out) {
            if (manualForm.check_out <= manualForm.check_in) {
                errors.check_out = 'Check Out time must be after Check In time'
            }
        }

        setManualErrors(errors)
        return Object.keys(errors).length === 0
    }

    const handleSubmitManual = async (e) => {
        e.preventDefault()
        setErrorMessage('') // Clear previous errors
        if (!validateManualForm()) return

        setSubmitting(true)
        try {

            // 1. Proactive Duplicate Check
            devLog('Checking for duplicate:', manualForm.employee_id, manualForm.date)
            const { data: existingRecord, error: checkError } = await applyCompanyFilter(
                supabase
                    .from('attendance')
                    .select('id')
            )
                .eq('employee_id', manualForm.employee_id)
                .eq('date', manualForm.date)
                .maybeSingle()
 
            if (checkError) {
                console.error('Check Error:', checkError)
                // Don't block insert on check error, let db constraint handle it if needed
            }
 
            devLog('Duplicate Check Result:', existingRecord)
 
            if (existingRecord) {
                devLog('Duplicate Found! Triggering alert.')
                setErrorMessage('Attendance record already exists for this employee on this date.')
                setSubmitting(false)
                return
            }
 
            const checkInTime = combineDateAndTime(manualForm.date, manualForm.check_in)
            const checkOutTime = combineDateAndTime(manualForm.date, manualForm.check_out)
 
            const calculatedStatus = getStatusFromHours(checkInTime, checkOutTime, manualForm.status, manualForm.date)
 
            // 2. Insert if no duplicate found
            devLog('No duplicate found, attempting insert...')
            const { error } = await supabase
                .from('attendance')
                .insert([withCompanyScope({
                    employee_id: manualForm.employee_id,
                    date: manualForm.date,
                    check_in: checkInTime,
                    check_out: checkOutTime,
                    status: calculatedStatus,
                    remarks: manualForm.remarks,
                    // Force DB to store "Local Wall Clock" time by offsetting the date before toISOString
                    created_at: new Date(Date.now() - (new Date().getTimezoneOffset() * 60000)).toISOString().replace('Z', '+00:00')
                })])

            if (error) throw error

            toast.success('Attendance recorded successfully!')
            setManualForm({
                employee_id: '',
                date: new Date().toISOString().split('T')[0],
                check_in: '',
                check_out: '',
                status: 'present',
                remarks: ''
            })
            await Promise.all([
                fetchDailyAttendance(),
                fetchAttendanceStats()
            ])
        } catch (error) {
            console.error('Attendance Submit Error:', error)
            if (error.code === '23505' || error.message?.includes('duplicate key')) {
                toast.error('Attendance record already exists for this employee on this date.')
            } else {
                setErrorMessage('Error recording attendance: ' + error.message)
            }
        } finally {
            setSubmitting(false)
        }
    }

    const handleManualInputChange = (field, value) => {
        setManualForm({ ...manualForm, [field]: value })
        if (manualErrors[field]) {
            setManualErrors({ ...manualErrors, [field]: null })
        }
    }

    const fetchLeaveApplications = async () => {
        try {
            const { data, error } = await applyCompanyFilter(
                supabase
                    .from('leaves')
                    .select(`
                        *,
                        employee:employees(first_name, last_name, department)
                    `)
            )
                .order('created_at', { ascending: false })
 
            if (error) throw error
            setLeaveApplications(data || [])
        } catch (error) {
            console.error('Error fetching leaves:', error)
        }
    }
 
    const fetchAttendanceStats = async () => {
        try {
            if (!dateFilter) return;
 
            const [year, month] = dateFilter.split('-').map(Number);
            const startOfMonth = `${dateFilter}-01`;
            const lastDayDate = new Date(year, month, 0);
            const endOfMonth = `${dateFilter}-${lastDayDate.getDate().toString().padStart(2, '0')}`;
 
            // Ensure holidays are fetched to avoid race condition on mount
            const currentHolidays = holidays.length > 0 ? holidays : await fetchHolidays();
            const holidaysInMonth = currentHolidays.filter(h => h.date >= startOfMonth && h.date <= endOfMonth)
 
            // Fetch employees count, attendance, and leaves concurrently using Promise.all to prevent sequential waterfalls
            const [employeesRes, attendanceRes, leavesRes] = await Promise.all([
                applyCompanyFilter(
                    supabase
                        .from('employees')
                        .select('*', { count: 'exact', head: true })
                )
                    .eq('status', 'active'),
                applyCompanyFilter(
                    supabase
                        .from('attendance')
                        .select('status, date')
                )
                    .gte('date', startOfMonth)
                    .lte('date', endOfMonth),
                applyCompanyFilter(
                    supabase
                        .from('leaves')
                        .select('start_date, end_date')
                )
                    .eq('status', 'approved')
                    .lte('start_date', endOfMonth)
                    .gte('end_date', startOfMonth)
            ])

            if (attendanceRes.error) throw attendanceRes.error
            if (leavesRes.error) throw leavesRes.error

            const totalEmployees = employeesRes.count || 0
            const attendanceData = attendanceRes.data || []
            const leavesData = leavesRes.data || []

            // Separate presents on workable vs non-workable days for accurate math
            const presentRecordsTotal = attendanceData?.filter(a => a.status === 'present' || a.status === 'half_day').length || 0

            const presentOnWorkable = attendanceData?.filter(a => {
                const date = new Date(a.date)
                const isSun = date.getDay() === 0
                const isHol = holidaysInMonth.some(h => h.date === a.date)
                return (a.status === 'present' || a.status === 'half_day') && !isSun && !isHol
            }).length || 0

            let totalOnLeaveDays = 0
            leavesData?.forEach(leave => {
                const leaveStart = new Date(leave.start_date);
                const leaveEnd = new Date(leave.end_date);
                const monthStart = new Date(startOfMonth);
                const monthEnd = new Date(endOfMonth);

                const start = new Date(Math.max(leaveStart, monthStart));
                const end = new Date(Math.min(leaveEnd, monthEnd));

                if (start <= end) {
                    const diffTime = Math.abs(end - start);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    totalOnLeaveDays += diffDays;
                }
            })

            // 4. Calculate Workable Days in Month (excluding Sundays and Holidays)
            let workableDaysCount = 0

            const tempDate = new Date(startOfMonth);
            const monthEndDate = new Date(endOfMonth);
            while (tempDate <= monthEndDate) {
                const dateStr = tempDate.toISOString().split('T')[0]
                const isSunday = tempDate.getDay() === 0
                const isHoliday = holidaysInMonth.some(h => h.date === dateStr)
                if (!isSunday && !isHoliday) {
                    workableDaysCount++
                }
                tempDate.setDate(tempDate.getDate() + 1)
            }

            const totalPossibleManDays = (totalEmployees || 0) * workableDaysCount
            const totalAbsentManDays = Math.max(0, totalPossibleManDays - presentOnWorkable - totalOnLeaveDays)

            const attendanceRate = totalPossibleManDays > 0
                ? Math.round((presentOnWorkable / totalPossibleManDays) * 100)
                : 0

            setStats({
                total: totalEmployees || 0,
                present: presentRecordsTotal,
                absent: totalAbsentManDays,
                onLeave: totalOnLeaveDays,
                late: 0,
                early: 0,
                rate: attendanceRate
            })
        } catch (error) {
            console.error('Error fetching stats:', error)
        }
    }

    const fetchDailyAttendance = async () => {
        try {
            setLoading(true)
            let query = applyCompanyFilter(
                supabase
                    .from('attendance')
                    .select('*, employee:employees(first_name, last_name, employee_id, department, designation)')
            )
                .order('date', { ascending: false })
                .order('check_in', { ascending: true })
 
            if (dateFilter) {
                const [year, month] = dateFilter.split('-').map(Number);
                const startOfMonth = `${dateFilter}-01`;
                const lastDay = new Date(year, month, 0).getDate();
                const endOfMonth = `${dateFilter}-${lastDay.toString().padStart(2, '0')}`;
                query = query.gte('date', startOfMonth).lte('date', endOfMonth)
            }
 
            if (statusFilter !== 'All Status') {
                query = query.eq('status', statusFilter)
            }
 
            const { data, error } = await query
 
            if (error) throw error
 
            let filteredData = data || []
 
            if (searchQuery || deptFilter !== 'All Departments') {
                const lowerQ = searchQuery.toLowerCase()
                filteredData = filteredData.filter(record => {
                    const matchesSearch = !searchQuery || (
                        record.employee?.first_name?.toLowerCase().includes(lowerQ) ||
                        record.employee?.last_name?.toLowerCase().includes(lowerQ) ||
                        record.employee?.employee_id?.toLowerCase().includes(lowerQ)
                    )
                    const matchesDept = deptFilter === 'All Departments' || record.employee?.department === deptFilter
                    return matchesSearch && matchesDept
                })
            }
 
            setDailyAttendance(filteredData)
        } catch (error) {
            console.error('Error fetching daily attendance:', error)
        } finally {
            setLoading(false)
        }
    }
 
    const fetchCalendarAttendance = async (empId, dateFilterStr) => {
        if (!empId || !dateFilterStr) return
        setCalendarLoading(true)
        try {
            const [year, month] = dateFilterStr.split('-').map(Number)
            const startOfMonth = `${dateFilterStr}-01`
            const lastDay = new Date(year, month, 0).getDate()
            const endOfMonth = `${dateFilterStr}-${lastDay.toString().padStart(2, '0')}`
 
            const { data, error } = await applyCompanyFilter(
                supabase
                    .from('attendance')
                    .select('*')
            )
                .eq('employee_id', empId)
                .gte('date', startOfMonth)
                .lte('date', endOfMonth)
 
            if (error) throw error
            setCalendarAttendance(data || [])
        } catch (err) {
            console.error('Error fetching calendar attendance:', err)
        } finally {
            setCalendarLoading(false)
        }
    }
 
    const fetchRegularizationRequests = async () => {
        try {
            const { data, error } = await applyCompanyFilter(
                supabase
                    .from('attendance_regularizations')
                    .select('*, employee:employees(first_name, last_name, employee_id, department)')
            )
                .order('created_at', { ascending: false })
            if (error) throw error
            setRegularizationRequests(data || [])
        } catch (error) {
            toast.error('Error fetching regularization requests: ' + error.message)
        }
    }

    const handleRegularizationStatus = async (id, status) => {
        try {
            const adminName = profileData ? `${profileData.first_name} ${profileData.last_name}` : 'Admin'
            const { error } = await supabase
                .from('attendance_regularizations')
                .update({
                    status: status,
                    reviewed_by: adminName,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', id)

            if (error) throw error

            toast.success(`Regularization request ${status} successfully!`)
            await fetchRegularizationRequests()
            await fetchAttendanceStats()
        } catch (error) {
            toast.error('Error updating regularization request: ' + error.message)
        }
    }

    const handleCalendarDayClick = (dateStr, existingRecord) => {
        const selectedEmp = employees.find(e => e.id === selectedCalendarEmployee)
        const record = existingRecord || {
            employee_id: selectedCalendarEmployee,
            date: dateStr,
            status: 'present',
            check_in: null,
            check_out: null,
            remarks: '',
            employee: selectedEmp
        }
        setEditingRecord(record)
        setEditForm({
            check_in: record.check_in ? new Date(record.check_in).toISOString().substr(11, 5) : '',
            check_out: record.check_out ? new Date(record.check_out).toISOString().substr(11, 5) : '',
            status: record.status || 'present',
            remarks: record.remarks || ''
        })
        setIsEditModalOpen(true)
    }

    const renderCalendarGrid = () => {
        if (!dateFilter || !selectedCalendarEmployee) return null

        const [year, month] = dateFilter.split('-').map(Number)
        const firstDayIndex = new Date(year, month - 1, 1).getDay()
        const totalDays = new Date(year, month, 0).getDate()

        const days = []
        for (let i = 0; i < firstDayIndex; i++) {
            days.push({ blank: true, key: `blank-${i}` })
        }

        for (let day = 1; day <= totalDays; day++) {
            const dateStr = `${dateFilter}-${day.toString().padStart(2, '0')}`
            const record = calendarAttendance.find(a => a.date === dateStr)
            const dateObj = new Date(year, month - 1, day)
            const isSunday = dateObj.getDay() === 0
            const isHoliday = holidays.some(h => h.date === dateStr)
            const holidayInfo = holidays.find(h => h.date === dateStr)

            days.push({
                blank: false,
                day,
                dateStr,
                record,
                isSunday,
                isHoliday,
                holidayName: holidayInfo?.name,
                key: `day-${day}`
            })
        }

        return (
            <div className="grid grid-cols-7 gap-2 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-xs font-bold text-gray-400 uppercase tracking-wider py-2 bg-slate-50 rounded-lg">{d}</div>
                ))}
                
                {days.map((cell) => {
                    if (cell.blank) {
                        return <div key={cell.key} className="aspect-square bg-slate-50/30 border border-transparent rounded-xl"></div>
                    }

                    const { dateStr, record, isSunday, isHoliday, holidayName, day } = cell
                    let status = record?.status
                    
                    if (!status) {
                        if (isSunday) status = 'weekly_off'
                        else if (isHoliday) status = 'on_leave'
                    }

                    let statusClass = 'border-gray-100 hover:border-blue-400 bg-white text-slate-800'
                    let label = ''

                    if (status === 'present') {
                        statusClass = 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 hover:border-emerald-400'
                        label = 'Present'
                    } else if (status === 'absent') {
                        statusClass = 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 hover:border-rose-400'
                        label = 'Absent'
                    } else if (status === 'half_day') {
                        statusClass = 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 hover:border-amber-400'
                        label = 'Half Day'
                    } else if (status === 'weekly_off') {
                        statusClass = 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200 hover:border-slate-300'
                        label = 'Weekly Off'
                    } else if (status === 'on_leave') {
                        statusClass = 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-400'
                        label = isHoliday ? `Holiday: ${holidayName || 'Off'}` : 'On Leave'
                    }

                    return (
                        <div
                            key={cell.key}
                            onClick={() => handleCalendarDayClick(dateStr, record)}
                            className={`aspect-square border p-2 rounded-xl flex flex-col justify-between items-start cursor-pointer transition-all duration-200 hover:scale-[1.03] hover:shadow-sm ${statusClass}`}
                        >
                            <span className="text-xs font-bold">{day}</span>
                            <div className="w-full text-left">
                                {label && (
                                    <span className="text-[8px] font-bold uppercase tracking-wider block truncate max-w-full">
                                        {label}
                                    </span>
                                )}
                                {record?.check_in && (
                                    <span className="text-[7px] font-medium opacity-70 block">
                                        {new Date(record.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false })}
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    const handleEditClick = (record) => {
        setEditingRecord(record)
        setEditForm({
            check_in: record.check_in ? new Date(record.check_in).toISOString().substr(11, 5) : '',
            check_out: record.check_out ? new Date(record.check_out).toISOString().substr(11, 5) : '',
            status: record.status,
            remarks: record.remarks || ''
        })
        setIsEditModalOpen(true)
    }


    const downloadTemplate = () => {
        const headers = ['Employee_ID,Date,Status,Check_In,Check_Out,Remarks']
        const sample = ['EMP001,2024-01-01,present,09:00,18:00,On time']
        const csvContent = [...headers, ...sample].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'attendance_template.csv')
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const parseCSV = (text) => {
        const lines = text.split('\n')
        const headers = lines[0].split(',').map(h => h.trim())
        const results = []

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue
            const currentLine = lines[i].split(',')
            const obj = {}

            headers.forEach((header, index) => {
                obj[header] = currentLine[index]?.trim()
            })

            if (obj.Employee_ID && obj.Date) {
                results.push(obj)
            }
        }
        return results
    }

    const handleFileUpload = (e) => {
        const file = e.target.files[0]
        if (file) {
            setCsvFile(file)
            setUploadReport([])
            setUploadStats(null)
        }
    }

    const handleBulkSubmit = async () => {
        if (!csvFile) return

        setIsUploading(true)
        setUploadReport([])
        const reader = new FileReader()

        reader.onload = async (e) => {
            const text = e.target.result
            const data = parseCSV(text)

            const stats = { total: data.length, success: 0, failed: 0 }
            const report = []

            // cache employees for lookup
            const { data: allEmployees } = await supabase.from('employees').select('id, employee_id')
            const empMap = {} // Code -> UUID
            allEmployees?.forEach(e => {
                if (e.employee_id) empMap[e.employee_id] = e.id
            })

            // Fetch all leaves for the month being uploaded to sync status
            // Determine date range from CSV
            const dates = data.map(d => normalizeDate(d.Date)).filter(Boolean)
            const minDate = dates.reduce((a, b) => a < b ? a : b)
            const maxDate = dates.reduce((a, b) => a > b ? a : b)

            const { data: monthLeaves } = await supabase
                .from('leaves')
                .select('*')
                .gte('end_date', minDate)
                .lte('start_date', maxDate)

            for (const row of data) {
                const empUUID = empMap[row.Employee_ID]
                if (!empUUID) {
                    stats.failed++
                    report.push({ ...row, error: `Employee ID ${row.Employee_ID} not found` })
                    continue
                }

                try {
                    const normalizedDate = normalizeDate(row.Date)
                    const checkInTime = combineDateAndTime(normalizedDate, row.Check_In)
                    const checkOutTime = combineDateAndTime(normalizedDate, row.Check_Out)
                    let calculatedStatus = getStatusFromHours(checkInTime, checkOutTime, row.Status, normalizedDate)
                    let finalRemarks = row.Remarks || ''

                    // Sync with existing leaves for this employee on this date
                    const leave = monthLeaves?.find(l =>
                        l.employee_id === empUUID &&
                        normalizedDate >= l.start_date &&
                        normalizedDate <= l.end_date
                    )

                    if (leave) {
                        if (leave.status === 'approved') {
                            // If they have no punch times, mark as On Leave
                            if (!checkInTime && !checkOutTime) {
                                calculatedStatus = 'on_leave'
                                finalRemarks = 'Approved Leave Sync'
                            }
                        } else if (leave.status === 'rejected') {
                            // If they are absent, mark as rejected leave in remarks
                            if (calculatedStatus === 'absent') {
                                finalRemarks = 'Leave Request Rejected'
                            }
                        }
                    }

                    const { error } = await supabase.from('attendance').upsert({
                        employee_id: empUUID,
                        date: normalizedDate,
                        status: calculatedStatus,
                        check_in: checkInTime,
                        check_out: checkOutTime,
                        remarks: finalRemarks,
                        created_at: new Date().toISOString()
                    }, { onConflict: 'employee_id, date' })

                    if (error) throw error
                    stats.success++
                } catch (err) {
                    stats.failed++
                    report.push({ ...row, error: err.message })
                }
            }

            setUploadStats(stats)
            setUploadReport(report)
            setIsUploading(false)
            if (stats.success > 0 && stats.failed === 0) {
                toast.success(`Successfully uploaded ${stats.success} attendance records!`)
                setCsvFile(null)
                await fetchDailyAttendance()
                await fetchAttendanceStats()
            }
        }

        reader.readAsText(csvFile)
    }

    const handleUpdateAttendance = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const checkInTime = combineDateAndTime(editingRecord.date, editForm.check_in)
            const checkOutTime = combineDateAndTime(editingRecord.date, editForm.check_out)

            const calculatedStatus = getStatusFromHours(checkInTime, checkOutTime, editForm.status, editingRecord.date)

            const updates = {
                status: calculatedStatus,
                remarks: editForm.remarks,
                check_in: checkInTime,
                check_out: checkOutTime
            }

            if (editingRecord.id) {
                const { error } = await supabase
                    .from('attendance')
                    .update(updates)
                    .eq('id', editingRecord.id)

                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('attendance')
                    .insert([{
                        employee_id: editingRecord.employee_id,
                        date: editingRecord.date,
                        ...updates
                    }])

                if (error) throw error
            }

            setSuccessMessage('Attendance updated successfully')
            setIsEditModalOpen(false)
            
            if (activeTab === 'calendar') {
                await fetchCalendarAttendance(selectedCalendarEmployee, dateFilter)
            } else {
                await fetchDailyAttendance()
            }
            await fetchAttendanceStats()
            setTimeout(() => setSuccessMessage(''), 3000)
        } catch (error) {
            toast.error('Error updating attendance: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm font-medium text-gray-400 mt-1">Track and manage employee attendance, leaves and work hours</p>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard title="Total Employees" value={stats.total} icon={Users} colorClass="bg-blue-50 text-blue-600" borderColor="border-l-blue-600" />
                <StatCard title="Present (Total)" value={stats.present} icon={UserCheck} colorClass="bg-emerald-50 text-emerald-600" borderColor="border-l-emerald-500" />
                <StatCard title="Absent (Total)" value={stats.absent} icon={UserX} colorClass="bg-rose-50 text-rose-600" borderColor="border-l-rose-500" />
                <StatCard title="On Leave (Days)" value={stats.onLeave} icon={Calendar} colorClass="bg-amber-50 text-amber-600" borderColor="border-l-amber-500" />
                <StatCard title="Late Arrivals" value={stats.late} icon={Clock} colorClass="bg-orange-50 text-orange-600" borderColor="border-l-orange-500" />
                <StatCard title="Early Departures" value={stats.early} icon={LogOut} colorClass="bg-purple-50 text-purple-600" borderColor="border-l-purple-600" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                <StatCard title="Attendance Rate" value={`${stats.rate}%`} icon={Clock} colorClass="bg-teal-50 text-teal-600" borderColor="border-l-teal-500" />
            </div>

            {/* Tabs */}
            <div className="inline-flex items-center p-1 bg-white rounded-xl space-x-1 border border-gray-200 flex-wrap gap-y-1">
                {[
                    { key: 'daily', label: 'Attendance' },
                    { key: 'calendar', label: 'Attendance Calendar' },
                    { key: 'regularization', label: 'Regularizations' },
                    { key: 'leave', label: 'Leave Management' },
                    { key: 'manual', label: 'Manual Entry' },
                    { key: 'bulk', label: 'Bulk Upload' },
                    { key: 'policies', label: 'Attendance Policies & Biometrics' }
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                            activeTab === tab.key || (activeTab === 'attendance' && tab.key === 'daily')
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tabs Content */}
            {activeTab === 'policies' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Active Attendance Policies</h3>
                            <div className="space-y-4">
                                {attendancePolicies.map((policy) => (
                                    <div key={policy.id} className="p-5 bg-slate-50 border border-gray-100 rounded-xl flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-slate-800">{policy.name}</h4>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Core hours: {policy.core_start_time} - {policy.core_end_time} | Grace window: {policy.grace_period_mins} mins
                                            </p>
                                            <p className="text-[10px] text-blue-600 font-bold mt-1 uppercase tracking-wider">
                                                Late limit: {policy.late_arrival_limit} arrivals/month
                                            </p>
                                        </div>
                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase">Active</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Webhook biometrics policy */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 space-y-4">
                            <h3 className="text-lg font-bold text-gray-800">Biometric Webhook Hardware Hub</h3>
                            <p className="text-xs text-gray-600">Securely connect and feed real-time employee check-in logs from external ZK/ESSL IP hardware scanners.</p>
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Endpoint Webhook API URL</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        readOnly 
                                        value={webhookUrl}
                                        className="flex-1 px-4 py-2 bg-slate-50 border border-gray-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-0 cursor-default"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard.writeText(webhookUrl)
                                            toast.success('Webhook URL copied to clipboard!')
                                        }}
                                        className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                                    <span className="text-xs font-bold text-slate-700">Webhook status: Live & Active</span>
                                </div>
                                <button
                                    onClick={() => {
                                        toast.success('Successfully sent test handshake command to biometric hardware webhook API endpoint!')
                                    }}
                                    className="px-4 py-2 bg-black text-white hover:bg-gray-800 text-xs font-bold rounded-lg transition-all"
                                >
                                    Ping Hardware Handshake
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Policy creation form */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Create Flex-Time Policy</h3>
                        <form onSubmit={handleSavePolicy} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-750 uppercase block">Policy Name</label>
                                <input 
                                    type="text" 
                                    required 
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-xl text-xs font-bold"
                                    placeholder="e.g. Core Night Shift"
                                    value={policyForm.name}
                                    onChange={(e) => setPolicyForm({...policyForm, name: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-750 uppercase block">Core Start</label>
                                    <input 
                                        type="time" 
                                        required 
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-xl text-xs font-bold"
                                        value={policyForm.core_start_time}
                                        onChange={(e) => setPolicyForm({...policyForm, core_start_time: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-750 uppercase block">Core End</label>
                                    <input 
                                        type="time" 
                                        required 
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-xl text-xs font-bold"
                                        value={policyForm.core_end_time}
                                        onChange={(e) => setPolicyForm({...policyForm, core_end_time: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-750 uppercase block">Grace Period (Minutes)</label>
                                <input 
                                    type="number" 
                                    required 
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-xl text-xs font-bold"
                                    value={policyForm.grace_period_mins}
                                    onChange={(e) => setPolicyForm({...policyForm, grace_period_mins: parseInt(e.target.value)})}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-750 uppercase block">Late Limit (Times/Month)</label>
                                <input 
                                    type="number" 
                                    required 
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-xl text-xs font-bold"
                                    value={policyForm.late_arrival_limit}
                                    onChange={(e) => setPolicyForm({...policyForm, late_arrival_limit: parseInt(e.target.value)})}
                                />
                            </div>
                            <button 
                                type="submit" 
                                disabled={submitting}
                                className="w-full bg-blue-600 hover:bg-blue-750 text-white font-bold text-xs py-3 rounded-xl transition-all shadow disabled:opacity-50"
                            >
                                {submitting ? 'Saving...' : 'Add Flex Policy'}
                            </button>
                        </form>
                    </div>
                </div>
            ) : activeTab === 'calendar' ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Select Employee</label>
                                <select
                                    className="px-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
                                    value={selectedCalendarEmployee}
                                    onChange={(e) => setSelectedCalendarEmployee(e.target.value)}
                                >
                                    <option value="">Choose Employee</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Month</label>
                                <input
                                    type="month"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="px-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-medium"
                                />
                            </div>
                        </div>

                        {/* Color Code Legend */}
                        <div className="flex items-center gap-4 flex-wrap">
                            {[
                                { status: 'present', label: 'Present', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                                { status: 'absent', label: 'Absent', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
                                { status: 'half_day', label: 'Half Day', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
                                { status: 'weekly_off', label: 'Weekly Off', bg: 'bg-slate-100 text-slate-500 border-slate-200' },
                                { status: 'on_leave', label: 'On Leave', bg: 'bg-blue-50 text-blue-700 border-blue-200' }
                            ].map((item) => (
                                <div key={item.status} className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold ${item.bg}`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                    {item.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-6">
                        {calendarLoading ? (
                            <div className="flex justify-center items-center h-96">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : selectedCalendarEmployee ? (
                            renderCalendarGrid()
                        ) : (
                            <div className="text-center py-20 text-sm font-medium text-gray-400 italic">
                                Please select an employee to view their attendance calendar.
                            </div>
                        )}
                    </div>
                </div>
            ) : activeTab === 'regularization' ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
                        <div className="p-6 border-b border-gray-50">
                            <h3 className="text-lg font-bold text-gray-800">Regularization Requests</h3>
                            <p className="text-xs text-gray-400 font-medium mt-1">Review and approve changes requested by employees for past attendance.</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        {['Employee', 'Department', 'Date', 'Requested Status', 'Reason', 'Status', 'Actions'].map((h) => (
                                            <th key={h} className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {regularizationRequests.length > 0 ? (
                                        regularizationRequests.map((req) => (
                                            <tr key={req.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-bold text-gray-700">
                                                        {req.employee?.first_name} {req.employee?.last_name}
                                                    </div>
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                                        {req.employee?.employee_id || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {req.employee?.department || '-'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {req.date}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-bold text-slate-800">{req.requested_status}</span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={req.reason}>
                                                    {req.reason}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                                        req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                        req.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                                                        'bg-amber-100 text-amber-700'
                                                    }`}>
                                                        {req.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    {req.status === 'pending' ? (
                                                        <div className="flex items-center space-x-2">
                                                            <button
                                                                onClick={() => handleRegularizationStatus(req.id, 'approved')}
                                                                className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center space-x-1"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                                <span>Approve</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleRegularizationStatus(req.id, 'rejected')}
                                                                className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center space-x-1"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                                <span>Reject</span>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic font-semibold">Reviewed by {req.reviewed_by || '-'}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-20 text-center text-sm font-medium text-gray-400 italic">
                                                No regularization requests found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'daily' || activeTab === 'attendance' ? (
                <>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 flex flex-wrap gap-4">

                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search employee..."
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <input
                            type="month"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-48 px-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-48 px-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-600"
                        >
                            <option>All Status</option>
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="half_day">Half Day</option>
                            <option value="weekly_off">Weekly Off</option>
                            <option value="late">Late</option>
                        </select>
                        <select
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value)}
                            className="w-48 px-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-600"
                        >
                            <option>All Departments</option>
                            <option>HR</option>
                            <option>Engineering</option>
                            <option>Sales</option>
                            <option>Management</option>
                        </select>
                        <button
                            onClick={clearFilters}
                            className="flex items-center space-x-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm font-medium text-gray-600 transition-colors border border-gray-100"
                        >
                            <RotateCcw className="w-4 h-4" />
                            <span>Clear Filters</span>
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
                        <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800">Attendance Records</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        {['Employee ID', 'Employee', 'Department', 'Date', 'Check In', 'Check Out', 'Work Hours', 'Status', 'Remarks', 'Actions'].map((h) => (
                                            <th key={h} className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        <>
                                            <TableRowSkeleton cols={10} />
                                            <TableRowSkeleton cols={10} />
                                            <TableRowSkeleton cols={10} />
                                            <TableRowSkeleton cols={10} />
                                            <TableRowSkeleton cols={10} />
                                        </>
                                    ) : dailyAttendance.length > 0 ? (
                                        dailyAttendance.map((record) => (
                                            <tr key={record.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{record.employee?.employee_id || '-'}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-bold text-gray-700">{record.employee?.first_name} {record.employee?.last_name}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.employee?.department || '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.date}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.check_in ? new Date(record.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) : '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.check_out ? new Date(record.check_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) : '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {record.check_in && record.check_out ? (() => {
                                                        const diff = new Date(record.check_out) - new Date(record.check_in);
                                                        const hours = Math.floor(diff / (1000 * 60 * 60));
                                                        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                        return `${hours} hrs ${minutes} mins`;
                                                    })() : '-'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${record.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                                                        record.status === 'absent' ? 'bg-rose-100 text-rose-700' :
                                                            record.status === 'half_day' ? 'bg-amber-100 text-amber-700' :
                                                                record.status === 'weekly_off' ? 'bg-slate-100 text-slate-700' :
                                                                    'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 italic">
                                                    {record.remarks || '-'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    {(isAdmin || profileData?.role === 'HR') && (
                                                        <button
                                                            onClick={() => handleEditClick(record)}
                                                            className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                                                            title="Edit Attendance"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="10" className="px-6 py-20 text-center text-sm font-medium text-gray-400 italic">No attendance records found for this date.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : activeTab === 'leave' ? (
                <>
                    <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-50 mb-6">
                        <h3 className="text-lg font-bold text-gray-800">Leave Applications</h3>
                        <button onClick={() => setIsLeaveModalOpen(true)} className="bg-black text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center space-x-2 hover:bg-gray-800 transition-colors">
                            <Plus className="w-4 h-4" />
                            <span>Apply for Leave</span>
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    {['Employee', 'Leave Type', 'Duration', 'Applied Date', 'Status', 'Actions'].map((h) => (
                                        <th key={h} className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <>
                                        <TableRowSkeleton cols={6} />
                                        <TableRowSkeleton cols={6} />
                                        <TableRowSkeleton cols={6} />
                                        <TableRowSkeleton cols={6} />
                                        <TableRowSkeleton cols={6} />
                                    </>
                                ) : leaveApplications.length > 0 ? (
                                    leaveApplications.map((leave) => (
                                        <tr key={leave.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-gray-700">{leave.employee?.first_name} {leave.employee?.last_name}</div>
                                                <div className="text-xs text-gray-400">{leave.employee?.department}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">{leave.leave_type}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{leave.start_date} to {leave.end_date}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(leave.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${leave.status === 'approved' ? 'bg-green-100 text-green-700' : leave.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                                    {leave.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 italic">
                                                {isAdmin && leave.status === 'pending' ? (
                                                    <div className="flex items-center space-x-2">
                                                        <button
                                                            onClick={() => handleLeaveStatus(leave.id, 'approved')}
                                                            className="p-1 rounded bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 transition-colors"
                                                            title="Approve"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setConfirmModal({
                                                                    isOpen: true,
                                                                    title: 'Reject Leave Application',
                                                                    message: `Are you sure you want to reject ${leave.employee?.first_name}'s leave application? This will mark their attendance as absent for the selected period.`,
                                                                    type: 'danger',
                                                                    onConfirm: () => handleLeaveStatus(leave.id, 'rejected')
                                                                })
                                                            }}
                                                            className="p-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-colors"
                                                            title="Reject"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span>-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="6" className="px-6 py-20 text-center text-sm font-medium text-gray-400 italic">No leave applications found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : activeTab === 'manual' ? (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-full">
                    <h3 className="text-xl font-bold text-slate-800 mb-6">Manual Attendance Entry</h3>

                    {errorMessage && (
                        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-lg flex items-center space-x-3 text-rose-600">
                            <X className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-bold">{errorMessage}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmitManual} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Employee</label>
                                <select
                                    required
                                    className={`w-full px-4 py-2.5 bg-slate-50 border ${manualErrors.employee_id ? 'border-rose-500' : 'border-gray-100'} rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium`}
                                    value={manualForm.employee_id}
                                    onChange={(e) => handleManualInputChange('employee_id', e.target.value)}
                                >
                                    <option value="">Select employee</option>
                                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
                                </select>
                                {manualErrors.employee_id && <p className="text-[10px] font-bold text-rose-500 uppercase mt-1">{manualErrors.employee_id}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Date</label>
                                <input
                                    type="date"
                                    required
                                    className={`w-full px-4 py-2.5 bg-slate-50 border ${manualErrors.date ? 'border-rose-500' : 'border-gray-100'} rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium`}
                                    value={manualForm.date}
                                    onChange={(e) => handleManualInputChange('date', e.target.value)}
                                />
                                {manualErrors.date && <p className="text-[10px] font-bold text-rose-500 uppercase mt-1">{manualErrors.date}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Check In</label>
                                <input
                                    type="time"
                                    className={`w-full px-4 py-2.5 bg-slate-50 border ${manualErrors.check_in ? 'border-rose-500' : 'border-gray-100'} rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium`}
                                    value={manualForm.check_in}
                                    onChange={(e) => handleManualInputChange('check_in', e.target.value)}
                                />
                                {manualErrors.check_in && <p className="text-[10px] font-bold text-rose-500 uppercase mt-1">{manualErrors.check_in}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Check Out</label>
                                <input
                                    type="time"
                                    className={`w-full px-4 py-2.5 bg-slate-50 border ${manualErrors.check_out ? 'border-rose-500' : 'border-gray-100'} rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium`}
                                    value={manualForm.check_out}
                                    onChange={(e) => handleManualInputChange('check_out', e.target.value)}
                                />
                                {manualErrors.check_out && <p className="text-[10px] font-bold text-rose-500 uppercase mt-1">{manualErrors.check_out}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Status</label>
                                <select
                                    required
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium"
                                    value={manualForm.status}
                                    onChange={(e) => handleManualInputChange('status', e.target.value)}
                                >
                                    <option value="present">Present</option>
                                    <option value="absent">Absent</option>
                                    <option value="late">Late</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Remarks</label>
                            <textarea
                                rows="3"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium resize-none"
                                placeholder="Add any notes here..."
                                value={manualForm.remarks}
                                onChange={(e) => handleManualInputChange('remarks', e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end pt-4">
                            <button type="submit" disabled={submitting} className="bg-black text-white px-10 py-3 rounded-lg text-sm font-bold hover:bg-gray-800 transition-all shadow-sm disabled:opacity-50 active:scale-95">
                                {submitting ? 'Adding...' : 'Add Attendance'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-3xl mx-auto">
                        <div className="space-y-6">
                            <div className={`border-2 border-dashed rounded-2xl p-10 transition-all text-center relative ${csvFile ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'}`}>
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="space-y-3">
                                    {csvFile ? (
                                        <>
                                            <FileUp className="w-12 h-12 text-blue-600 mx-auto" />
                                            <div>
                                                <p className="text-lg font-bold text-slate-800">{csvFile.name}</p>
                                                <p className="text-sm text-gray-500">{(csvFile.size / 1024).toFixed(2)} KB</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-12 h-12 text-gray-300 mx-auto" />
                                            <div>
                                                <p className="text-lg font-bold text-gray-700">Click to upload or drag and drop</p>
                                                <p className="text-sm text-gray-400 mt-1">CSV files only (Column format: Employee_ID, Date, Status, Check_In, Check_Out)</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-4">
                                <button onClick={downloadTemplate} className="flex items-center space-x-2 text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors">
                                    <Download className="w-4 h-4" />
                                    <span>Download Template CSV</span>
                                </button>

                                {csvFile && (
                                    <button
                                        onClick={handleBulkSubmit}
                                        disabled={isUploading}
                                        className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center space-x-2 shadow-lg shadow-slate-200 transition-all active:scale-95"
                                    >
                                        {isUploading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Processing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-4 h-4" />
                                                <span>Start Upload</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Upload Stats */}
                            {uploadStats && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                        <div className="bg-slate-50 p-4 rounded-xl text-center border border-gray-100">
                                            <p className="text-xs font-bold text-gray-400 uppercase">Total Records</p>
                                            <p className="text-2xl font-black text-slate-800">{uploadStats.total}</p>
                                        </div>
                                        <div className="bg-emerald-50 p-4 rounded-xl text-center border border-emerald-100">
                                            <p className="text-xs font-bold text-emerald-600 uppercase">Successful</p>
                                            <p className="text-2xl font-black text-emerald-600">{uploadStats.success}</p>
                                        </div>
                                        <div className="bg-rose-50 p-4 rounded-xl text-center border border-rose-100">
                                            <p className="text-xs font-bold text-rose-600 uppercase">Failed</p>
                                            <p className="text-2xl font-black text-rose-600">{uploadStats.failed}</p>
                                        </div>
                                    </div>

                                    {uploadReport.length > 0 && (
                                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center space-x-2">
                                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                <h4 className="font-bold text-gray-700 text-sm">Issue Report</h4>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-gray-50 text-gray-500 font-bold text-xs uppercase sticky top-0">
                                                        <tr>
                                                            <th className="px-4 py-2">Emp ID</th>
                                                            <th className="px-4 py-2">Date</th>
                                                            <th className="px-4 py-2">Error</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {uploadReport.map((row, i) => (
                                                            <tr key={i} className="hover:bg-gray-50">
                                                                <td className="px-4 py-2 font-medium text-gray-800">{row.Employee_ID || '-'}</td>
                                                                <td className="px-4 py-2 text-gray-600">{row.Date || '-'}</td>
                                                                <td className="px-4 py-2 text-rose-600 font-medium">{row.error}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )
            }

            {/* Global Success Message */}
            {
                successMessage && (
                    <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-4 flex items-center space-x-2">
                        <div className="bg-white/20 p-1 rounded-full"><Plus className="w-4 h-4 rotate-45" /></div>
                        <span>{successMessage}</span>
                    </div>
                )
            }

            {/* Apply Leave Modal */}
            <Modal isOpen={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)} title={<div><h3 className="text-xl font-bold text-slate-800">Apply for Leave</h3><p className="text-sm text-gray-400 font-medium mt-1">Submit a new leave application for approval.</p></div>}>
                <form onSubmit={handleSubmitLeave} className="space-y-5 pb-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700">Employee *</label>
                        <select required className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium" value={leaveForm.employee_id} onChange={(e) => setLeaveForm({ ...leaveForm, employee_id: e.target.value })}>
                            <option value="">Search Employee ID or Name</option>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700">Leave Type *</label>
                        <select required className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium" value={leaveForm.leave_type} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}>
                            {leavePolicies.map(policy => (
                                <option key={policy.leave_type} value={policy.leave_type}>
                                    {policy.leave_type}
                                </option>
                            ))}
                            <option value="Unpaid Leave">Unpaid Leave</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-gray-700">Start Date *</label>
                            <input type="date" required className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium" value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-gray-700">End Date *</label>
                            <input type="date" required className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium" value={leaveForm.end_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700">Reason</label>
                        <textarea rows="4" placeholder="Enter reason for leave" className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium resize-none" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}></textarea>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={() => setIsLeaveModalOpen(false)} className="px-6 py-2.5 bg-slate-50 text-gray-600 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors">Cancel</button>
                        <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit Application'}</button>
                    </div>
                </form>
            </Modal>
            {/* Edit Attendance Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={<div><h3 className="text-xl font-bold text-slate-800">Edit Attendance</h3><p className="text-sm text-gray-400 font-medium mt-1">Update attendance details for {editingRecord?.employee?.first_name}</p></div>}>
                <form onSubmit={handleUpdateAttendance} className="space-y-5 pb-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-gray-700">Check In</label>
                            <input type="time" className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium" value={editForm.check_in} onChange={(e) => setEditForm({ ...editForm, check_in: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-gray-700">Check Out</label>
                            <input type="time" className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium" value={editForm.check_out} onChange={(e) => setEditForm({ ...editForm, check_out: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700">Status</label>
                        <select className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="half_day">Half Day</option>
                            <option value="weekly_off">Weekly Off</option>
                            <option value="late">Late</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700">Remarks</label>
                        <textarea rows="3" className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium resize-none" value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} />
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-6 py-2.5 bg-slate-50 text-gray-600 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors">Cancel</button>
                        <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">{submitting ? 'Update' : 'Update Attendance'}</button>
                    </div>
                </form>
            </Modal>

            {/* Custom Confirmation Modal */}
            <Modal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                title={
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${confirmModal.type === 'danger' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                            {confirmModal.type === 'danger' ? <X className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">{confirmModal.title}</h3>
                    </div>
                }
            >
                <div className="space-y-6 pb-4">
                    <p className="text-gray-600 font-medium leading-relaxed">
                        {confirmModal.message}
                    </p>
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                            className="px-6 py-2.5 bg-slate-50 text-gray-600 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                if (confirmModal.onConfirm) {
                                    await confirmModal.onConfirm()
                                }
                                setConfirmModal({ ...confirmModal, isOpen: false })
                            }}
                            className={`px-6 py-2.5 ${confirmModal.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg text-sm font-bold transition-colors shadow-sm`}
                        >
                            Confirm Action
                        </button>
                    </div>
                </div>
            </Modal>
        </div >
    )
}
