import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { downloadBlob, formatCurrency } from '../lib/payrollUtils'
import { downloadECR, downloadECRSummary } from '../lib/ecrGenerator'
import { downloadESIC, getESICSummary } from '../lib/esicGenerator'
import { downloadSalaryRegister } from '../lib/salaryRegister'
import { PageHeaderSkeleton, CardSkeleton, TableSkeleton } from '../components/ui/SkeletonLoader'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    Legend
} from 'recharts'
import {
    FileText,
    Download,
    TrendingUp,
    Users,
    CalendarCheck,
    AlertCircle,
    Filter,
    Search,
    ChevronDown,
    FileBarChart,
    ShieldCheck,
    Settings,
    X,
    Building2,
    Landmark,
    Receipt,
    BookOpen,
    FileBadge
} from 'lucide-react'

export default function Reports() {
    const navigate = useNavigate()
    const toast = useToast()
    const [loading, setLoading] = useState(true)
    const [payrollTrendData, setPayrollTrendData] = useState([])
    const [attendanceData, setAttendanceData] = useState([])
    const [departmentData, setDepartmentData] = useState([])
    const [reports, setReports] = useState([])
    const [metrics, setMetrics] = useState({
        averageSalary: 0,
        retentionRate: 0,
        attendanceRate: 0,
        complianceScore: 0,
        activeEmployees: 0,
        totalEmployees: 0
    })
    const [searchTerm, setSearchTerm] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [showComplianceModal, setShowComplianceModal] = useState(false)
    const [showCustomReportModal, setShowCustomReportModal] = useState(false)
    const [customReportForm, setCustomReportForm] = useState({
        type: '',
        dateRange: '',
        department: '',
        format: '',
        dataPoints: []
    })
    const reportsPerPage = 10
    // Statutory export state
    const [statutoryMonth, setStatutoryMonth] = useState(() => {
        const d = new Date()
        d.setMonth(d.getMonth() - 1)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
    const [payrollEmployees, setPayrollEmployees] = useState([])
    const [esicSummary, setEsicSummary] = useState({ eligibleCount: 0, totalContribution: 0 })
    const [companySettings, setCompanySettings] = useState({})

    useEffect(() => {
        fetchReportData()
        fetchStatutoryData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        fetchStatutoryData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statutoryMonth])

    const fetchStatutoryData = async () => {
        try {
            // Company settings
            const { data: settings } = await supabase.from('company_settings').select('*').single()
            if (settings) setCompanySettings(settings)

            // Get payroll run for the selected month
            const { data: run } = await supabase
                .from('payroll_runs')
                .select('*')
                .eq('month_year', statutoryMonth + '-01')
                .eq('status', 'Completed')
                .maybeSingle()

            if (run?.payroll_items) {
                setPayrollEmployees(run.payroll_items)
                setEsicSummary(getESICSummary(run.payroll_items))
            } else {
                // Fallback: fetch active employees for current month
                const { data: emps } = await supabase
                    .from('employees')
                    .select('id, first_name, last_name, salary, department, uan_number, esi_number, pan_number, joining_date')
                    .eq('status', 'active')
                const mapped = (emps || []).map(e => ({
                    ...e,
                    name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
                    grossSalary: e.salary,
                    basicSalary: Math.round((e.salary || 0) * 0.4),
                    uan: e.uan_number,
                    esic_number: e.esi_number,
                    pan: e.pan_number
                }))
                setPayrollEmployees(mapped)
                setEsicSummary(getESICSummary(mapped))
            }
        } catch (err) {
            console.error('Error fetching statutory data:', err)
        }
    }

    const exportAllReports = () => {
        const headers = ['Report ID', 'Name', 'Type', 'Description', 'Date', 'Status']
        const rows = reports.map(r => [r.id, r.name, r.type, r.description, r.date, r.status])

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `all_reports_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const fetchReportData = async () => {
        try {
            setLoading(true)

            const sixMonthsAgo = new Date()
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

            // Fetch all independent data sets concurrently
            const [runsRes, employeesRes, attendanceRes, reportsRes] = await Promise.all([
                supabase
                    .from('payroll_runs')
                    .select('*')
                    .eq('status', 'Completed')
                    .order('month_year', { ascending: true }),
                supabase
                    .from('employees')
                    .select('department, salary, salary_structure, status'),
                supabase
                    .from('attendance')
                    .select('date, status')
                    .gte('date', sixMonthsAgo.toISOString().split('T')[0]),
                supabase
                    .from('generated_reports')
                    .select('*')
                    .order('generated_date', { ascending: false })
            ])

            if (runsRes.error) throw runsRes.error
            if (employeesRes.error) throw employeesRes.error
            if (attendanceRes.error) throw attendanceRes.error

            const runs = runsRes.data || []
            const employees = employeesRes.data || []
            const attendance = attendanceRes.data || []
            const generatedReports = reportsRes.data || []
            const reportsError = reportsRes.error

            // 1. Process Payroll Trend
            const trendData = runs.map(run => ({
                month: new Date(run.month_year).toLocaleString('default', { month: 'short' }),
                amount: Number(run.total_amount),
                fullDate: run.month_year
            }))
            setPayrollTrendData(trendData.slice(-6))

            // 2. Process Department Distribution
            const deptCounts = {}
            employees.forEach(emp => {
                const dept = emp.department || 'Unknown'
                deptCounts[dept] = (deptCounts[dept] || 0) + 1
            })

            const totalEmps = employees.length || 1
            const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f97316', '#8b5cf6', '#ec4899']

            const deptData = Object.keys(deptCounts).map((dept, index) => ({
                name: dept,
                value: Math.round((deptCounts[dept] / totalEmps) * 100),
                rawCount: deptCounts[dept],
                color: COLORS[index % COLORS.length]
            }))
            setDepartmentData(deptData)

            // 3. Process Attendance Trends
            const attMap = {}
            attendance.forEach(record => {
                const month = new Date(record.date).toLocaleString('default', { month: 'short' })
                if (!attMap[month]) attMap[month] = { month, present: 0, absent: 0 }

                if (record.status === 'present') attMap[month].present++
                else if (record.status === 'absent') attMap[month].absent++
            })
            setAttendanceData(Object.values(attMap))

            const activeEmployees = employees.filter(emp => emp.status !== 'terminated' && emp.status !== 'resigned')
            const averageSalary = activeEmployees.length
                ? activeEmployees.reduce((sum, emp) => sum + (Number(emp.salary) || 0), 0) / activeEmployees.length
                : 0
            const retentionRate = employees.length
                ? (activeEmployees.length / employees.length) * 100
                : 0
            const present = attendance.filter(record => String(record.status).toLowerCase() === 'present').length
            const attendanceRate = attendance.length ? (present / attendance.length) * 100 : 0
            const employeesWithStatutory = activeEmployees.filter(emp => {
                const structure = emp.salary_structure || {}
                return Object.values(structure).some(component => component?.enabled && component?.category === 'deduction' && component?.is_statutory)
            }).length
            const complianceScore = activeEmployees.length ? (employeesWithStatutory / activeEmployees.length) * 100 : 0
            setMetrics({
                averageSalary,
                retentionRate,
                attendanceRate,
                complianceScore,
                activeEmployees: activeEmployees.length,
                totalEmployees: employees.length || 0
            })

            // 4. Unified Reports List
            // A. Payroll Reports
            const payrollReports = runs.map(run => ({
                id: run.id,
                name: `Payroll Summary - ${new Date(run.month_year).toLocaleString('default', { month: 'long', year: 'numeric' })}`,
                type: 'Payroll',
                description: `Monthly payroll summary for ${run.total_employees} employees`,
                date: new Date(run.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                status: 'available',
                raw_data: run // Store for download logic
            }))

            // B. Generated Reports
            if (reportsError && reportsError.code !== '42P01') {
                console.error('Error fetching generated reports:', reportsError)
            }

            const otherReports = generatedReports.map(report => ({
                id: report.id,
                name: report.title,
                type: report.report_type,
                description: report.description,
                date: new Date(report.generated_date || report.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                status: report.status,
                raw_data: report
            }))

            // Combine and Sort by Date Descending
            const allReports = [...payrollReports, ...otherReports].sort((a, b) =>
                new Date(b.date.split(' ').reverse().join('-')) - new Date(a.date.split(' ').reverse().join('-'))
            )

            setReports(allReports)

        } catch (error) {
            console.error('Error fetching report data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDownload = (report) => {
        if (report.raw_data?.metadata?.format === 'CSV' || report.raw_data?.metadata?.format === 'Excel') {
            const csv = [
                ['Report', 'Type', 'Description', 'Date', 'Status'],
                [report.name, report.type, report.description, report.date, report.status]
            ].map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
            downloadBlob(csv, `${report.name.replace(/\s+/g, '_')}.${report.raw_data?.metadata?.format === 'Excel' ? 'xls' : 'csv'}`)
            return
        }

        const pdf = new jsPDF()
        pdf.setFontSize(16)
        pdf.text(report.name, 14, 20)
        pdf.setFontSize(10)
        pdf.text(`Type: ${report.type}`, 14, 34)
        pdf.text(`Generated: ${report.date}`, 14, 42)
        pdf.text(`Status: ${report.status}`, 14, 50)
        pdf.text(`Description: ${report.description || 'No description available'}`, 14, 62, { maxWidth: 180 })

        if (report.type === 'Payroll' && report.raw_data) {
            pdf.text(`Employees: ${report.raw_data.total_employees || 0}`, 14, 82)
            pdf.text(`Total Amount: ${formatCurrency(report.raw_data.total_amount || 0)}`, 14, 90)
        }

        pdf.save(`${report.name.replace(/\s+/g, '_')}.pdf`)
    }

    const handleGenerateCustomReport = async () => {
        const { type, dateRange, department, format, dataPoints } = customReportForm

        if (!type || !dateRange || !format) {
            toast.warning('Please select a Report Type, Date Range, and Output Format.')
            return
        }
        if (dataPoints.length === 0) {
            toast.warning('Please select at least one data point to include.')
            return
        }

        try {
            setLoading(true)

            // ── 1. Compute date filter bounds ──
            const now = new Date()
            let fromDate = null
            if (dateRange === 'Current Month') {
                fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
            } else if (dateRange === 'Last Quarter') {
                const q = new Date(now); q.setMonth(q.getMonth() - 3)
                fromDate = q.toISOString().split('T')[0]
            } else if (dateRange === 'Last Financial Year') {
                const fyStart = now.getMonth() >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2
                fromDate = `${fyStart}-04-01`
            }

            // ── 2. Fetch real data based on report type ──
            let rows = []
            let headers = []

            const FIELD_MAP = {
                'Employee Details': ['first_name', 'last_name', 'email', 'phone'],
                'Basic Salary': ['salary'],
                'Gross Salary': ['salary'],
                'Designation': ['designation'],
                'Department': ['department'],
                'Joining Date': ['joining_date'],
            }

            if (type === 'Employee') {
                let query = supabase.from('employees').select('*').eq('status', 'active')
                if (department) query = query.eq('department', department)

                const { data: emps, error } = await query
                if (error) throw error

                // Determine which columns to show
                const colMap = {
                    'Employee Details': (e) => [`${e.first_name} ${e.last_name}`, e.email || '', e.phone || ''],
                    'Basic Salary': (e) => [e.salary || 0],
                    'Gross Salary': (e) => [e.salary || 0],
                    'Designation': (e) => [e.designation || ''],
                    'Department': (e) => [e.department || ''],
                    'Joining Date': (e) => [e.joining_date || ''],
                }
                const headerMap = {
                    'Employee Details': ['Full Name', 'Email', 'Phone'],
                    'Basic Salary': ['Basic Salary (₹)'],
                    'Gross Salary': ['Gross Salary (₹)'],
                    'Designation': ['Designation'],
                    'Department': ['Department'],
                    'Joining Date': ['Joining Date'],
                }

                headers = ['EMP ID', ...dataPoints.flatMap(dp => headerMap[dp] || [dp])]
                rows = (emps || []).map(e => [
                    e.employee_id || '',
                    ...dataPoints.flatMap(dp => colMap[dp] ? colMap[dp](e) : [''])
                ])
            } else if (type === 'Payroll') {
                let query = supabase
                    .from('payroll_items')
                    .select(`id, basic_salary, total_allowances, total_deductions, net_salary, attendance_days,
                        employees(first_name, last_name, employee_id, department, designation),
                        payroll_runs(month_year)`)
                if (fromDate) query = query.gte('created_at', fromDate)

                const { data: items, error } = await query
                if (error) throw error

                const filteredItems = department
                    ? (items || []).filter(i => i.employees?.department === department)
                    : (items || [])

                const payColMap = {
                    'Employee Details': (i) => [`${i.employees?.first_name || ''} ${i.employees?.last_name || ''}`.trim(), i.employees?.designation || ''],
                    'Department': (i) => [i.employees?.department || ''],
                    'Basic Salary': (i) => [i.basic_salary || 0],
                    'Allowances': (i) => [i.total_allowances || 0],
                    'Deductions': (i) => [i.total_deductions || 0],
                    'Gross Salary': (i) => [(Number(i.basic_salary) + Number(i.total_allowances)) || 0],
                    'Net Salary': (i) => [i.net_salary || 0],
                    'Attendance': (i) => [i.attendance_days || 0],
                }
                const payHeaderMap = {
                    'Employee Details': ['Full Name', 'Designation'],
                    'Department': ['Department'],
                    'Basic Salary': ['Basic Salary (₹)'],
                    'Allowances': ['Allowances (₹)'],
                    'Deductions': ['Deductions (₹)'],
                    'Gross Salary': ['Gross Salary (₹)'],
                    'Net Salary': ['Net Salary (₹)'],
                    'Attendance': ['Attendance Days'],
                }

                headers = ['EMP ID', 'Payroll Month', ...dataPoints.flatMap(dp => payHeaderMap[dp] || [dp])]
                rows = filteredItems.map(i => [
                    i.employees?.employee_id || '',
                    i.payroll_runs?.month_year || '',
                    ...dataPoints.flatMap(dp => payColMap[dp] ? payColMap[dp](i) : [''])
                ])
            } else if (type === 'Attendance') {
                let query = supabase
                    .from('attendance')
                    .select('date, status, check_in, check_out, remarks, employees(first_name, last_name, employee_id, department)')
                if (fromDate) query = query.gte('date', fromDate)

                const { data: attData, error } = await query
                if (error) throw error

                const filteredAttData = department
                    ? (attData || []).filter(a => a.employees?.department === department)
                    : (attData || [])

                const attColMap = {
                    'Employee Details': (a) => [`${a.employees?.first_name || ''} ${a.employees?.last_name || ''}`.trim()],
                    'Department': (a) => [a.employees?.department || ''],
                    'Attendance': (a) => [a.status || ''],
                }
                const attHeaderMap = {
                    'Employee Details': ['Full Name'],
                    'Department': ['Department'],
                    'Attendance': ['Status'],
                }

                headers = ['EMP ID', 'Date', ...dataPoints.flatMap(dp => attHeaderMap[dp] || [dp]), 'Check In', 'Check Out']
                rows = filteredAttData.map(a => [
                    a.employees?.employee_id || '',
                    a.date || '',
                    ...dataPoints.flatMap(dp => attColMap[dp] ? attColMap[dp](a) : ['']),
                    a.check_in ? new Date(a.check_in).toLocaleTimeString() : '',
                    a.check_out ? new Date(a.check_out).toLocaleTimeString() : ''
                ])
            }

            // ── 3. Export ──
            const title = `Custom_${type}_Report_${dateRange.replace(/\s+/g, '_')}`
            const dateStr = new Date().toISOString().split('T')[0]
            const fileName = `${title}_${dateStr}`

            if (format === 'Excel') {
                const wb = XLSX.utils.book_new()
                const wsData = [headers, ...rows]
                const ws = XLSX.utils.aoa_to_sheet(wsData)
                // Auto column widths
                ws['!cols'] = headers.map((h, i) => ({
                    wch: Math.max(h.length + 2, ...rows.map(r => String(r[i] || '').length + 2))
                }))
                XLSX.utils.book_append_sheet(wb, ws, type)
                XLSX.writeFile(wb, `${fileName}.xlsx`)
            } else if (format === 'CSV') {
                const csv = [headers, ...rows]
                    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
                    .join('\n')
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = `${fileName}.csv`
                document.body.appendChild(a); a.click(); document.body.removeChild(a)
                URL.revokeObjectURL(url)
            } else {
                // PDF
                const pdf = new jsPDF({ orientation: rows.length > 0 && headers.length > 6 ? 'landscape' : 'portrait' })
                pdf.setFontSize(14)
                pdf.text(`${type} Report — ${dateRange}`, 14, 18)
                pdf.setFontSize(8)
                pdf.text(`Generated: ${new Date().toLocaleDateString()} | ${rows.length} records`, 14, 26)
                // Simple table
                const cellW = Math.floor((pdf.internal.pageSize.getWidth() - 28) / headers.length)
                let y = 36
                pdf.setFillColor(30, 41, 59); pdf.setTextColor(255)
                pdf.rect(14, y, pdf.internal.pageSize.getWidth() - 28, 7, 'F')
                headers.forEach((h, i) => pdf.text(String(h), 14 + i * cellW + 1, y + 5))
                y += 9; pdf.setTextColor(0)
                rows.forEach(row => {
                    if (y > pdf.internal.pageSize.getHeight() - 20) { pdf.addPage(); y = 14 }
                    row.forEach((cell, i) => pdf.text(String(cell ?? '').slice(0, 20), 14 + i * cellW + 1, y + 4))
                    y += 7
                })
                pdf.save(`${fileName}.pdf`)
            }

            // ── 4. Save to generated_reports table ──
            await supabase.from('generated_reports').insert({
                title: `Custom ${type} Report - ${dateRange}`,
                report_type: type,
                description: `Custom report for ${department || 'All Departments'} (${format}) — ${rows.length} records`,
                status: 'available',
                metadata: { ...customReportForm, record_count: rows.length },
                generated_date: new Date().toISOString()
            })

            await fetchReportData()
            setShowCustomReportModal(false)
            setCustomReportForm({ type: '', dateRange: '', department: '', format: '', dataPoints: [] })
            toast.success(`Custom ${type} report exported as ${format} with ${rows.length} records.`)

        } catch (error) {
            console.error('Error generating custom report:', error)
            toast.error('Failed to generate report: ' + (error.message || 'Unknown error'))
        } finally {
            setLoading(false)
        }
    }

    const filteredReports = reports.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.type.toLowerCase().includes(searchTerm.toLowerCase())
    )
    const totalPages = Math.max(1, Math.ceil(filteredReports.length / reportsPerPage))
    const currentReports = filteredReports.slice((currentPage - 1) * reportsPerPage, currentPage * reportsPerPage)

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm])

    if (loading) return (
        <div className="space-y-6">
            <PageHeaderSkeleton />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <CardSkeleton className="lg:col-span-2" />
                <CardSkeleton />
                <CardSkeleton className="lg:col-span-2" />
                <CardSkeleton />
            </div>
            <TableSkeleton rows={5} cols={6} />
        </div>
    )

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-gray-500 mt-1">Generate and view payroll, compliance, and analytical reports</p>
                    </div>
                    <button
                        onClick={exportAllReports}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                    >
                        <Download className="w-4 h-4" />
                        <span className="font-semibold text-sm">Export All Reports</span>
                    </button>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Monthly Payroll Trend */}
                <div className="col-span-1 lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center space-x-2 mb-6">
                        <TrendingUp className="w-5 h-5 text-gray-400" />
                        <h3 className="font-bold text-gray-800">Monthly Payroll Trend</h3>
                    </div>
                    <div className="h-64 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={payrollTrendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#8b5cf6"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Department Distribution */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-6">Department-wise Employee Distribution</h3>
                    <div className="h-48 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={departmentData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {departmentData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        {departmentData.map((item, index) => (
                            <div key={index} className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-gray-600 font-medium">{item.name}: {item.value}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Attendance Trends */}
                <div className="col-span-1 lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center space-x-2 mb-6">
                        <CalendarCheck className="w-5 h-5 text-gray-400" />
                        <h3 className="font-bold text-gray-800">Attendance Trends</h3>
                    </div>
                    <div className="h-64 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={attendanceData} barSize={12}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                                <Legend iconType="circle" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                                <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="a" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Key Metrics */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between border-l-[6px] border-l-slate-900 group transition-all duration-300 hover:shadow-md">
                    <div className="flex items-center space-x-2 mb-6">
                        <TrendingUp className="w-5 h-5 text-slate-400 group-hover:scale-110 transition-transform" />
                        <h3 className="text-[11px] font-bold text-gray-900 uppercase tracking-widest">Key Metrics Overview</h3>
                    </div>
                    <div className="space-y-6">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Average Salary</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(metrics.averageSalary)}</p>
                            </div>
                            <span className="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-full">Live</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Employee Retention</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.retentionRate.toFixed(1)}%</p>
                            </div>
                            <span className="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-full">{metrics.activeEmployees}/{metrics.totalEmployees}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Avg. Attendance</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.attendanceRate.toFixed(1)}%</p>
                            </div>
                            <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-full">6 mo</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Compliance Score</p>
                                <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics.complianceScore.toFixed(1)}%</p>
                            </div>
                            <ShieldCheck className="w-6 h-6 text-emerald-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Reports Section */}
            <div id="reports-table" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-2">
                        <h2 className="text-lg font-bold text-gray-800">Available Reports</h2>
                        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">{filteredReports.length}</span>
                    </div>
                    <div className="flex gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search reports..."
                                className="pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-medium text-gray-700 w-full sm:w-64 focus:ring-2 focus:ring-blue-100 transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                            <Filter className="w-4 h-4" />
                            Filter
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Report Name</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Last Generated</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredReports.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-8 text-gray-500 text-sm">No reports found</td>
                                </tr>
                            ) : (
                                currentReports.map((report) => (
                                    <tr key={report.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{report.name}</p>
                                                    <p className="text-xs text-gray-400 font-medium">{report.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                                                {report.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-500 font-medium truncate max-w-xs">{report.description}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-600 font-semibold">{report.date}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize
                                                ${report.status === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {report.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleDownload(report)}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                    title="Download Report"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {filteredReports.length > reportsPerPage && (
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                        <span>Page {currentPage} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg font-bold disabled:opacity-40 hover:bg-gray-50"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg font-bold disabled:opacity-40 hover:bg-gray-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Statutory Compliance Exports ─────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
                            <Landmark className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Statutory Compliance Exports</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Generate EPFO ECR, ESIC, Salary Register &amp; Form 16 for any payroll month</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-gray-600">Payroll Month</label>
                        <input
                            type="month"
                            value={statutoryMonth}
                            onChange={(e) => setStatutoryMonth(e.target.value)}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                        />
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                            {payrollEmployees.length} employees
                        </span>
                    </div>
                </div>

                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="border border-gray-100 rounded-2xl p-5 hover:border-blue-200 hover:shadow-md transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-800">EPFO ECR 2.0</h3>
                        <p className="text-xs text-gray-500 mt-1 mb-4">Electronic Challan cum Return for PF deposit to EPFO portal</p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => {
                                    if (!payrollEmployees.length) { toast.warning('No payroll data for selected month.'); return }
                                    downloadECR(payrollEmployees, statutoryMonth, companySettings.pf_reg_no || '')
                                    toast.success('ECR text file downloaded.')
                                }}
                                className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Download className="w-3.5 h-3.5" /> ECR Text File
                            </button>
                            <button
                                onClick={() => {
                                    if (!payrollEmployees.length) { toast.warning('No payroll data for selected month.'); return }
                                    downloadECRSummary(payrollEmployees, statutoryMonth)
                                    toast.success('ECR summary CSV downloaded.')
                                }}
                                className="w-full py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <Download className="w-3.5 h-3.5" /> Summary CSV
                            </button>
                        </div>
                    </div>

                    <div className="border border-gray-100 rounded-2xl p-5 hover:border-emerald-200 hover:shadow-md transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-800">ESIC Monthly Return</h3>
                        <p className="text-xs text-gray-500 mt-1 mb-1">Employee State Insurance contribution file</p>
                        <p className="text-xs font-bold text-emerald-600 mb-4">
                            {esicSummary.eligibleCount} eligible &middot; {formatCurrency(esicSummary.totalContribution)} total
                        </p>
                        <button
                            onClick={() => {
                                if (!payrollEmployees.length) { toast.warning('No payroll data for selected month.'); return }
                                downloadESIC(payrollEmployees, statutoryMonth, companySettings.esic_reg_no || '')
                                toast.success('ESIC CSV downloaded.')
                            }}
                            className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Download className="w-3.5 h-3.5" /> Download CSV
                        </button>
                    </div>

                    <div className="border border-gray-100 rounded-2xl p-5 hover:border-violet-200 hover:shadow-md transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-800">Salary Register</h3>
                        <p className="text-xs text-gray-500 mt-1 mb-4">Statutory register with earnings, deductions &amp; net pay for all employees</p>
                        <button
                            onClick={() => {
                                if (!payrollEmployees.length) { toast.warning('No payroll data for selected month.'); return }
                                downloadSalaryRegister(payrollEmployees, statutoryMonth, {
                                    name: companySettings.company_name,
                                    pan: companySettings.pan_number,
                                    tan: companySettings.tan_number,
                                    pf_reg_no: companySettings.pf_reg_no,
                                    esic_reg_no: companySettings.esic_reg_no
                                })
                                toast.success('Salary Register CSV downloaded.')
                            }}
                            className="w-full py-2 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Download className="w-3.5 h-3.5" /> Download Register
                        </button>
                    </div>

                    <div className="border border-gray-100 rounded-2xl p-5 hover:border-amber-200 hover:shadow-md transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <FileBadge className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-800">Form 16</h3>
                        <p className="text-xs text-gray-500 mt-1 mb-4">TDS certificate (Part A + B) generated per employee from Tax Declarations</p>
                        <button
                            onClick={() => navigate('/tax-declarations')}
                            className="w-full py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <Receipt className="w-3.5 h-3.5" /> Go to Tax Declarations
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div onClick={() => navigate('/payroll-processing')} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group border-l-[6px] border-l-blue-600 hover:scale-[1.02]">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <FileBarChart className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">Quick Payroll Report</h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">Generate current month payroll summary instantly</p>
                    <button onClick={(e) => { e.stopPropagation(); navigate('/payroll-processing') }} className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors">Generate Report</button>
                </div>
                <div onClick={() => setShowComplianceModal(true)} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group border-l-[6px] border-l-emerald-600 hover:scale-[1.02]">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">Compliance Dashboard</h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">View all compliance reports in one place</p>
                    <button onClick={(e) => { e.stopPropagation(); setShowComplianceModal(true) }} className="mt-4 w-full py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors">View Dashboard</button>
                </div>
                <div onClick={() => setShowCustomReportModal(true)} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group border-l-[6px] border-l-violet-600 hover:scale-[1.02]">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Settings className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">Custom Report Builder</h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">Create custom reports with specific parameters</p>
                    <button onClick={(e) => { e.stopPropagation(); setShowCustomReportModal(true) }} className="mt-4 w-full py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors">Build Report</button>
                </div>
            </div>

            {/* Compliance Dashboard Modal */}
            {showComplianceModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Compliance Dashboard</h2>
                                <p className="text-sm text-gray-500 mt-1">View all compliance reports and status in one centralized location</p>
                            </div>
                            <button onClick={() => setShowComplianceModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-8">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="border border-gray-100 rounded-2xl p-4 text-center">
                                    <p className="text-xs font-bold text-gray-600 mb-3">PF Compliance</p>
                                    <p className="text-2xl font-black text-emerald-500">{metrics.complianceScore.toFixed(1)}%</p>
                                    <p className="text-[10px] text-gray-400 mt-1">{metrics.activeEmployees}/{metrics.totalEmployees} employees</p>
                                </div>
                                <div className="border border-gray-100 rounded-2xl p-4 text-center">
                                    <p className="text-xs font-bold text-gray-600 mb-3">ESI Eligible</p>
                                    <p className="text-2xl font-black text-emerald-500">{esicSummary.eligibleCount}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">employees this month</p>
                                </div>
                                <div className="border border-gray-100 rounded-2xl p-4 text-center">
                                    <p className="text-xs font-bold text-gray-600 mb-3">PT Compliance</p>
                                    <p className="text-2xl font-black text-amber-500">{metrics.complianceScore.toFixed(1)}%</p>
                                    <p className="text-[10px] text-gray-400 mt-1">Derived from enabled rules</p>
                                </div>
                                <div className="border border-gray-100 rounded-2xl p-4 text-center">
                                    <p className="text-xs font-bold text-gray-600 mb-3">TDS Compliance</p>
                                    <p className="text-2xl font-black text-emerald-500">{metrics.complianceScore.toFixed(1)}%</p>
                                    <p className="text-[10px] text-gray-400 mt-1">TDS enabled in payroll</p>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 mb-4">Recent Compliance Activities</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">Latest Payroll Reports</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{reports.filter(r => r.type === 'Payroll').length} payroll report(s) available</p>
                                        </div>
                                        <span className="bg-slate-900 text-white text-[10px] font-bold px-3 py-1 rounded-full">Completed</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">Statutory Coverage</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{metrics.complianceScore.toFixed(1)}% of active employees have statutory deductions configured</p>
                                        </div>
                                        <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-3 py-1 rounded-full">Pending</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">Attendance Basis</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{metrics.attendanceRate.toFixed(1)}% present rate in the last 6 months</p>
                                        </div>
                                        <span className="bg-slate-900 text-white text-[10px] font-bold px-3 py-1 rounded-full">Completed</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Report Builder Modal */}
            {showCustomReportModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Custom Report Builder</h2>
                                <p className="text-sm text-gray-500 mt-1">Create custom reports by selecting specific parameters and data points</p>
                            </div>
                            <button onClick={() => setShowCustomReportModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Report Type</label>
                                    <select value={customReportForm.type} onChange={(e) => setCustomReportForm(prev => ({ ...prev, type: e.target.value }))} className="w-full text-sm border-gray-200 rounded-lg bg-gray-50 py-2.5">
                                        <option value="">Select report type</option>
                                        <option value="Payroll">Payroll</option>
                                        <option value="Attendance">Attendance</option>
                                        <option value="Employee">Employee</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Date Range</label>
                                    <select value={customReportForm.dateRange} onChange={(e) => setCustomReportForm(prev => ({ ...prev, dateRange: e.target.value }))} className="w-full text-sm border-gray-200 rounded-lg bg-gray-50 py-2.5">
                                        <option value="">Select period</option>
                                        <option value="Current Month">Current Month</option>
                                        <option value="Last Quarter">Last Quarter</option>
                                        <option value="Last Financial Year">Last Financial Year</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-3">Include Data Points</label>
                                <div className="grid grid-cols-2 gap-y-3 gap-x-8">
                                    {['Employee Details','Allowances','Gross Salary','Attendance','Leave Balance','Designation','Basic Salary','Deductions','Net Salary','Overtime','Department','Joining Date'].map(item => (
                                        <label key={item} className="flex items-center space-x-3 cursor-pointer">
                                            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600"
                                                checked={customReportForm.dataPoints.includes(item)}
                                                onChange={(e) => setCustomReportForm(prev => ({
                                                    ...prev,
                                                    dataPoints: e.target.checked ? [...prev.dataPoints, item] : prev.dataPoints.filter(p => p !== item)
                                                }))} />
                                            <span className="text-sm font-medium text-gray-600">{item}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Department Filter</label>
                                    <select value={customReportForm.department} onChange={(e) => setCustomReportForm(prev => ({ ...prev, department: e.target.value }))} className="w-full text-sm border-gray-200 rounded-lg bg-gray-50 py-2.5">
                                        <option value="">All departments</option>
                                        {departmentData.map(dept => <option key={dept.name} value={dept.name}>{dept.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Output Format</label>
                                    <select value={customReportForm.format} onChange={(e) => setCustomReportForm(prev => ({ ...prev, format: e.target.value }))} className="w-full text-sm border-gray-200 rounded-lg bg-gray-50 py-2.5">
                                        <option value="">Select format</option>
                                        <option value="PDF">PDF</option>
                                        <option value="CSV">CSV</option>
                                        <option value="Excel">Excel</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end items-center gap-3 bg-gray-50/50">
                            <button onClick={() => setShowCustomReportModal(false)} className="px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                            <button onClick={handleGenerateCustomReport} className="px-5 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200">Generate Custom Report</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
