import { useState, useEffect, useMemo, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import { useToast } from '../context/ToastContext'
import { devLog } from '../lib/devLogger'
import { getLeavePolicyOptions } from '../lib/leaveUtils'
import { notifyLeaveStatus } from '../lib/notifications'
import { Plus } from 'lucide-react'

// Services
import { attendanceService } from '../services/attendanceService'
import { leaveService } from '../services/leaveService'

// Custom Hooks
import { useAllEmployees } from '../hooks/useEmployees'
import { useLeavePolicies, useLeaveApplicationsWithEmployee } from '../hooks/useLeavesData'
import {
    useHolidays,
    useDailyAttendance,
    useCalendarAttendance,
    useRegularizationRequests,
    useAttendancePolicies,
    useAttendanceStats
} from '../hooks/useAttendanceData'

// Decomposed Subcomponents
import AttendanceFilterBar from '../components/attendance/AttendanceFilterBar'
import AttendanceStats from '../components/attendance/AttendanceStats'
import AttendanceTable from '../components/attendance/AttendanceTable'
import AttendanceCalendar from '../components/attendance/AttendanceCalendar'
import RegularizationTab from '../components/attendance/RegularizationTab'
import LeaveManagementTab from '../components/attendance/LeaveManagementTab'
import ManualEntryTab from '../components/attendance/ManualEntryTab'
import BulkUploadTab from '../components/attendance/BulkUploadTab'
import AttendancePoliciesTab from '../components/attendance/AttendancePoliciesTab'
import AttendanceModals from '../components/attendance/AttendanceModals'

const DEFAULT_ATTENDANCE_STATS = {
    total: 0,
    present: 0,
    absent: 0,
    onLeave: 0,
    late: 0,
    early: 0,
    rate: 0
}

const DEFAULT_ATTENDANCE_POLICIES = [
    {
        id: '1',
        name: 'General Shift Policy',
        grace_period_mins: 15,
        core_start_time: '09:00',
        core_end_time: '18:00',
        half_day_threshold_mins: 240,
        late_arrival_limit: 3
    }
]

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

const getStatusFromHours = (checkIn, checkOut, defaultStatus, dateStr, holidays) => {
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

    if (isSunday) return 'weekly_off'
    if (isHoliday) return 'on_leave'
    return mappedStatus || 'absent'
}

export default function Attendance() {
    const { isAdmin, profileData } = useAuth()
    const { activeCompanyId, selectedBranch } = useCompany()
    const toast = useToast()
    const queryClient = useQueryClient()

    // Active Tab State
    const [activeTab, setActiveTab] = useState('daily')

    // Filter states
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('All Status')
    const [deptFilter, setDeptFilter] = useState('All Departments')
    const [dateFilter, setDateFilter] = useState(new Date().toISOString().substring(0, 7)) // YYYY-MM

    // Modals visibility states
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')
    const [errorMessage, setErrorMessage] = useState('')

    // Form inputs states
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
    const [policyForm, setPolicyForm] = useState({
        name: '',
        grace_period_mins: 15,
        core_start_time: '09:00',
        core_end_time: '18:00',
        half_day_threshold_mins: 240,
        late_arrival_limit: 3
    })
    const [editingRecord, setEditingRecord] = useState(null)
    const [editForm, setEditForm] = useState({
        check_in: '',
        check_out: '',
        status: '',
        remarks: ''
    })

    // Bulk Upload state
    const [csvFile, setCsvFile] = useState(null)
    const [uploadStats, setUploadStats] = useState(null)
    const [uploadReport, setUploadReport] = useState([])
    const [isUploading, setIsUploading] = useState(false)

    // Confirmation Modal state
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        type: 'danger'
    })

    // Calendar View selected employee state
    const [selectedCalendarEmployee, setSelectedCalendarEmployee] = useState('')

    const webhookUrl = 'https://api.payroll.smart/v1/biometrics/punch-webhook'

    // Compute Date filter boundaries
    const { startDate, endDate } = useMemo(() => {
        if (!dateFilter) return { startDate: '', endDate: '' }
        const [year, month] = dateFilter.split('-').map(Number)
        const start = `${dateFilter}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const end = `${dateFilter}-${lastDay.toString().padStart(2, '0')}`
        return { startDate: start, endDate: end }
    }, [dateFilter])

    // ─── Query Hooks ───
    const holidaysQuery = useHolidays()
    const employeesQuery = useAllEmployees()
    const policiesQuery = useAttendancePolicies()
    const leavePoliciesRawQuery = useLeavePolicies()
    const leaveApplicationsQuery = useLeaveApplicationsWithEmployee()
    const regularizationQuery = useRegularizationRequests()

    const dailyAttendanceQuery = useDailyAttendance({
        startDate,
        endDate,
        statusFilter,
        page: 0,
        pageSize: 1000
    })

    const calendarAttendanceQuery = useCalendarAttendance(
        selectedCalendarEmployee,
        startDate,
        endDate
    )

    const holidays = holidaysQuery.data || []
    const statsQuery = useAttendanceStats({ dateFilter, holidays })

    const employees = employeesQuery.data || []
    const attendancePolicies = policiesQuery.data || DEFAULT_ATTENDANCE_POLICIES
    const leavePolicies = useMemo(() => getLeavePolicyOptions(leavePoliciesRawQuery.data || []), [leavePoliciesRawQuery.data])
    const leaveApplications = leaveApplicationsQuery.data || []
    const regularizationRequests = regularizationQuery.data || []
    const stats = statsQuery.data || DEFAULT_ATTENDANCE_STATS

    const loading = dailyAttendanceQuery.isLoading || holidaysQuery.isLoading || employeesQuery.isLoading || regularizationQuery.isLoading
    const calendarLoading = calendarAttendanceQuery.isLoading

    // Filter daily attendance in-memory for Search & Department
    const dailyAttendanceRaw = dailyAttendanceQuery.data?.data || []
    const dailyAttendance = useMemo(() => {
        let filtered = dailyAttendanceRaw
        if (searchQuery || deptFilter !== 'All Departments') {
            const lowerQ = searchQuery.toLowerCase()
            filtered = filtered.filter(record => {
                const matchesSearch = !searchQuery || (
                    record.employee?.first_name?.toLowerCase().includes(lowerQ) ||
                    record.employee?.last_name?.toLowerCase().includes(lowerQ) ||
                    record.employee?.employee_id?.toLowerCase().includes(lowerQ)
                )
                const matchesDept = deptFilter === 'All Departments' || record.employee?.department === deptFilter
                return matchesSearch && matchesDept
            })
        }
        return filtered
    }, [dailyAttendanceRaw, searchQuery, deptFilter])

    const calendarAttendance = calendarAttendanceQuery.data || []

    // Sync default calendar employee selection
    useEffect(() => {
        if (employees.length > 0 && activeTab === 'calendar' && !selectedCalendarEmployee) {
            setSelectedCalendarEmployee(employees[0].id)
        }
    }, [employees, activeTab, selectedCalendarEmployee])

    // Sync default leave policy selection
    useEffect(() => {
        if (leavePolicies.length > 0 && !leaveForm.leave_type) {
            setLeaveForm(prev => ({ ...prev, leave_type: leavePolicies[0].leave_type }))
        }
    }, [leavePolicies, leaveForm.leave_type])

    const clearFilters = () => {
        setSearchQuery('')
        setDateFilter(new Date().toISOString().substring(0, 7))
        setStatusFilter('All Status')
        setDeptFilter('All Departments')
    }

    // ─── Mutation Hooks ───
    const savePolicyMutation = useMutation({
        mutationFn: async (policyData) => {
            await attendanceService.createAttendancePolicy(policyData)
        },
        onSuccess: () => {
            toast.success('Attendance policy created successfully!')
            setPolicyForm({
                name: '',
                grace_period_mins: 15,
                core_start_time: '09:00',
                core_end_time: '18:00',
                half_day_threshold_mins: 240,
                late_arrival_limit: 3
            })
            queryClient.invalidateQueries({ queryKey: ['attendancePolicies'] })
        },
        onError: (error) => {
            toast.error('Error saving policy: ' + error.message)
        }
    })

    const submitLeaveMutation = useMutation({
        mutationFn: async (leaveData) => {
            await leaveService.createLeaveRequest({
                ...leaveData,
                status: 'pending'
            })
        },
        onSuccess: () => {
            setIsLeaveModalOpen(false)
            setLeaveForm({
                employee_id: '',
                leave_type: leavePolicies[0]?.leave_type || 'Annual Leave',
                start_date: '',
                end_date: '',
                reason: ''
            })
            queryClient.invalidateQueries({ queryKey: ['leaveApplicationsWithEmployee'] })
            queryClient.invalidateQueries({ queryKey: ['dailyAttendance'] })
            queryClient.invalidateQueries({ queryKey: ['attendanceStats'] })
            toast.success('Leave application submitted successfully!')
        },
        onError: (error) => {
            toast.error('Error submitting leave application: ' + error.message)
        }
    })

    const updateLeaveStatusMutation = useMutation({
        mutationFn: async ({ id, status, employeeEmail, employeeName, leaveType }) => {
            await leaveService.updateLeaveStatus({ id, status })
            await notifyLeaveStatus({
                email: employeeEmail,
                employeeName,
                status,
                leaveType,
                leaveId: id
            }).catch(e => console.error('Notification Error:', e))
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['leaveApplicationsWithEmployee'] })
            queryClient.invalidateQueries({ queryKey: ['dailyAttendance'] })
            queryClient.invalidateQueries({ queryKey: ['attendanceStats'] })
            toast.success(`Leave ${variables.status} successfully`)
        },
        onError: (error) => {
            toast.error('Error updating leave status: ' + error.message)
        }
    })

    const submitManualMutation = useMutation({
        mutationFn: async (formData) => {
            const checkInTime = combineDateAndTime(formData.date, formData.check_in)
            const checkOutTime = combineDateAndTime(formData.date, formData.check_out)
            const calculatedStatus = getStatusFromHours(checkInTime, checkOutTime, formData.status, formData.date, holidays)

            await attendanceService.createAttendance({
                employee_id: formData.employee_id,
                date: formData.date,
                check_in: checkInTime,
                check_out: checkOutTime,
                status: calculatedStatus,
                remarks: formData.remarks,
                created_at: new Date(Date.now() - (new Date().getTimezoneOffset() * 60000)).toISOString().replace('Z', '+00:00')
            })
        },
        onSuccess: () => {
            toast.success('Attendance recorded successfully!')
            setManualForm({
                employee_id: '',
                date: new Date().toISOString().split('T')[0],
                check_in: '',
                check_out: '',
                status: 'present',
                remarks: ''
            })
            queryClient.invalidateQueries({ queryKey: ['dailyAttendance'] })
            queryClient.invalidateQueries({ queryKey: ['attendanceStats'] })
        },
        onError: (error) => {
            console.error('Attendance Submit Error:', error)
            if (error.code === '23505' || error.message?.includes('duplicate key')) {
                toast.error('Attendance record already exists for this employee on this date.')
            } else {
                setErrorMessage('Error recording attendance: ' + error.message)
            }
        }
    })

    const updateAttendanceMutation = useMutation({
        mutationFn: async ({ record, form }) => {
            const checkInTime = combineDateAndTime(record.date, form.check_in)
            const checkOutTime = combineDateAndTime(record.date, form.check_out)
            const calculatedStatus = getStatusFromHours(checkInTime, checkOutTime, form.status, record.date, holidays)

            const updates = {
                status: calculatedStatus,
                remarks: form.remarks,
                check_in: checkInTime,
                check_out: checkOutTime
            }

            if (record.id) {
                await attendanceService.updateAttendance({ id: record.id, payload: updates })
            } else {
                await attendanceService.createAttendance({
                    employee_id: record.employee_id,
                    date: record.date,
                    ...updates
                })
            }
        },
        onSuccess: () => {
            setSuccessMessage('Attendance updated successfully')
            setIsEditModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['dailyAttendance'] })
            queryClient.invalidateQueries({ queryKey: ['calendarAttendance'] })
            queryClient.invalidateQueries({ queryKey: ['attendanceStats'] })
            setTimeout(() => setSuccessMessage(''), 3000)
        },
        onError: (error) => {
            toast.error('Error updating attendance: ' + error.message)
        }
    })

    const updateRegularizationMutation = useMutation({
        mutationFn: async ({ id, status }) => {
            const adminName = profileData ? `${profileData.first_name} ${profileData.last_name}` : 'Admin'
            await attendanceService.updateRegularizationStatus({ id, status, reviewedBy: adminName })
        },
        onSuccess: (_, variables) => {
            toast.success(`Regularization request ${variables.status} successfully!`)
            queryClient.invalidateQueries({ queryKey: ['regularizationRequests'] })
            queryClient.invalidateQueries({ queryKey: ['dailyAttendance'] })
            queryClient.invalidateQueries({ queryKey: ['attendanceStats'] })
        },
        onError: (error) => {
            toast.error('Error updating regularization request: ' + error.message)
        }
    })

    const bulkUploadMutation = useMutation({
        mutationFn: async (csvData) => {
            return await attendanceService.bulkUploadAttendance({ data: csvData, activeCompanyId })
        },
        onSuccess: (res) => {
            setUploadStats(res.stats)
            setUploadReport(res.report)
            setIsUploading(false)
            if (res.stats.success > 0 && res.stats.failed === 0) {
                toast.success(`Successfully uploaded ${res.stats.success} attendance records!`)
                setCsvFile(null)
                queryClient.invalidateQueries({ queryKey: ['dailyAttendance'] })
                queryClient.invalidateQueries({ queryKey: ['attendanceStats'] })
            }
        },
        onError: (error) => {
            setIsUploading(false)
            toast.error('Bulk upload failed: ' + error.message)
        }
    })

    const submitting =
        savePolicyMutation.isPending ||
        submitLeaveMutation.isPending ||
        updateLeaveStatusMutation.isPending ||
        submitManualMutation.isPending ||
        updateAttendanceMutation.isPending ||
        updateRegularizationMutation.isPending ||
        bulkUploadMutation.isPending

    // ─── Actions & Handlers ───
    const handleSavePolicy = async (e) => {
        e.preventDefault()
        savePolicyMutation.mutate(policyForm)
    }

    const handleSubmitLeave = async (e) => {
        e.preventDefault()
        submitLeaveMutation.mutate(leaveForm)
    }

    const handleLeaveStatus = async (id, status) => {
        const leave = leaveApplications.find(l => l.id === id)
        updateLeaveStatusMutation.mutate({
            id,
            status,
            employeeEmail: leave?.employee?.email,
            employeeName: `${leave?.employee?.first_name || ''} ${leave?.employee?.last_name || ''}`.trim(),
            leaveType: leave?.leave_type
        })
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
        setErrorMessage('')
        if (!validateManualForm()) return

        devLog('Checking for duplicate:', manualForm.employee_id, manualForm.date)
        
        try {
            const existingRecord = await attendanceService.getAttendanceRecord(manualForm.employee_id, manualForm.date)
            if (existingRecord) {
                setErrorMessage('Attendance record already exists for this employee on this date.')
                return
            }
        } catch (err) {
            console.error('Error checking duplicate:', err)
        }

        submitManualMutation.mutate(manualForm)
    }

    const handleManualInputChange = (field, value) => {
        setManualForm(prev => ({ ...prev, [field]: value }))
        if (manualErrors[field]) {
            setManualErrors(prev => ({ ...prev, [field]: null }))
        }
    }

    const handleRegularizationStatus = async (id, status) => {
        updateRegularizationMutation.mutate({ id, status })
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

    const handleEditSubmit = (e) => {
        e.preventDefault()
        updateAttendanceMutation.mutate({ record: editingRecord, form: editForm })
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

    const handleBulkSubmit = () => {
        if (!csvFile) return
        setIsUploading(true)
        setUploadReport([])
        const reader = new FileReader()

        reader.onload = async (e) => {
            const text = e.target.result
            const parsedData = parseCSV(text)
            bulkUploadMutation.mutate(parsedData)
        }

        reader.readAsText(csvFile)
    }

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm font-medium text-gray-400 mt-1">Track and manage employee attendance, leaves and work hours</p>
            </header>

            {/* Stats Summary Cards */}
            <AttendanceStats stats={stats} />

            {/* Navigation Tabs */}
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
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                            activeTab === tab.key
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Views */}
            {activeTab === 'policies' ? (
                <AttendancePoliciesTab
                    attendancePolicies={attendancePolicies}
                    policyForm={policyForm}
                    setPolicyForm={setPolicyForm}
                    onSubmitPolicy={handleSavePolicy}
                    submitting={submitting}
                    webhookUrl={webhookUrl}
                    onCopyWebhook={() => {
                        navigator.clipboard.writeText(webhookUrl)
                        toast.success('Webhook URL copied to clipboard!')
                    }}
                    onPingHardware={() => {
                        toast.success('Successfully sent test handshake command to biometric hardware webhook API endpoint!')
                    }}
                />
            ) : activeTab === 'calendar' ? (
                <AttendanceCalendar
                    employees={employees}
                    dateFilter={dateFilter}
                    setDateFilter={setDateFilter}
                    selectedEmployee={selectedCalendarEmployee}
                    setSelectedEmployee={setSelectedCalendarEmployee}
                    calendarAttendance={calendarAttendance}
                    calendarLoading={calendarLoading}
                    holidays={holidays}
                    onDayClick={handleCalendarDayClick}
                />
            ) : activeTab === 'regularization' ? (
                <RegularizationTab
                    regularizationRequests={regularizationRequests}
                    onStatusChange={handleRegularizationStatus}
                />
            ) : activeTab === 'leave' ? (
                <LeaveManagementTab
                    loading={loading}
                    leaveApplications={leaveApplications}
                    isAdmin={isAdmin}
                    onStatusChange={handleLeaveStatus}
                    onApplyClick={() => setIsLeaveModalOpen(true)}
                />
            ) : activeTab === 'manual' ? (
                <ManualEntryTab
                    employees={employees}
                    manualForm={manualForm}
                    manualErrors={manualErrors}
                    submitting={submitting}
                    errorMessage={errorMessage}
                    onSubmit={handleSubmitManual}
                    onInputChange={handleManualInputChange}
                />
            ) : activeTab === 'bulk' ? (
                <BulkUploadTab
                    isUploading={isUploading}
                    uploadStats={uploadStats}
                    uploadReport={uploadReport}
                    csvFile={csvFile}
                    setCsvFile={setCsvFile}
                    onFileUpload={handleFileUpload}
                    onBulkSubmit={handleBulkSubmit}
                    downloadTemplate={downloadTemplate}
                />
            ) : (
                <>
                    <AttendanceFilterBar
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        dateFilter={dateFilter}
                        setDateFilter={setDateFilter}
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        deptFilter={deptFilter}
                        setDeptFilter={setDeptFilter}
                        clearFilters={clearFilters}
                    />
                    <AttendanceTable
                        dailyAttendance={dailyAttendance}
                        loading={loading}
                        isAdmin={isAdmin}
                        profileData={profileData}
                        onEditClick={handleEditClick}
                    />
                </>
            )}

            {/* Global Success Banner */}
            {successMessage && (
                <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-4 flex items-center space-x-2">
                    <div className="bg-white/20 p-1 rounded-full"><Plus className="w-4 h-4 rotate-45" /></div>
                    <span>{successMessage}</span>
                </div>
            )}

            {/* Overlays / Modals */}
            <AttendanceModals
                isLeaveModalOpen={isLeaveModalOpen}
                setIsLeaveModalOpen={setIsLeaveModalOpen}
                leaveForm={leaveForm}
                setLeaveForm={setLeaveForm}
                leavePolicies={leavePolicies}
                onSubmitLeave={handleSubmitLeave}
                isEditModalOpen={isEditModalOpen}
                setIsEditModalOpen={setIsEditModalOpen}
                editForm={editForm}
                setEditForm={setEditForm}
                editingRecord={editingRecord}
                onSubmitEdit={handleEditSubmit}
                confirmModal={confirmModal}
                setConfirmModal={setConfirmModal}
                employees={employees}
                submitting={submitting}
            />
        </div>
    )
}
