import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { logger } from '../lib/devLogger'
import { applyCompanyFilter } from '../services/tenantScope'
import { useReportData, useStatutoryData, useSaveGeneratedReport } from '../hooks/useReportsData'
import Pagination from '../components/Pagination'
import ReportRow from '../components/ReportRow'
import jsPDF from 'jspdf'
import { downloadBlob, formatCurrency } from '../lib/payrollUtils'
import { downloadECR, downloadECRSummary } from '../lib/ecrGenerator'
import { downloadESIC, getESICSummary } from '../lib/esicGenerator'
import { downloadSalaryRegister } from '../lib/salaryRegister'
import { generateForm16PDF } from '../lib/form16Generator'
import { getIndianFinancialYear } from '../lib/taxUtils'
import { downloadGenericNEFT, downloadHDFCBulk, downloadSBISFMS } from '../lib/neftGenerator'
import { downloadPTChallan, downloadLWFStatement } from '../lib/ptChallanGenerator'
import { generate24QText, deriveQuarterFromMonth } from '../lib/tdsReturnGenerator'
import { downloadTallyJournalXML, downloadTallyJournalCSV } from '../lib/tallyExporter'
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
    Download,
    TrendingUp,
    CalendarCheck,
    Filter,
    Search,
    FileBarChart,
    ShieldCheck,
    Settings,
    X,
    Building2,
    Landmark,
    Receipt,
    BookOpen,
    FileBadge,
    Database
} from 'lucide-react'

export default function Reports() {
    const navigate = useNavigate()
    const toast = useToast()
    const [searchTerm, setSearchTerm] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [activeReportTab, setActiveReportTab] = useState('payroll')
    const [showComplianceModal, setShowComplianceModal] = useState(false)
    const [showCustomReportModal, setShowCustomReportModal] = useState(false)
    const [selectedForm16EmployeeId, setSelectedForm16EmployeeId] = useState('')
    const [generatingForm16, setGeneratingForm16] = useState(false)
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
    const [complianceState, setComplianceState] = useState('Maharashtra')
    const [debitAccount, setDebitAccount] = useState('')
    const [selectedQuarter, setSelectedQuarter] = useState('')

    // React Query Queries
    const { data: reportData = {}, isLoading: loadingReportData } = useReportData()
    const { data: statutoryData = {}, isLoading: loadingStatutory } = useStatutoryData(statutoryMonth)

    const loading = loadingReportData || loadingStatutory

    // React Query Mutations
    const saveReportMutation = useSaveGeneratedReport()

    // 1. Process Payroll Trend
    const payrollTrendData = useMemo(() => {
        const runs = reportData.payrollRuns || []
        const trendData = runs.map(run => ({
            month: new Date(run.month_year).toLocaleString('default', { month: 'short' }),
            amount: Number(run.total_amount),
            fullDate: run.month_year
        }))
        return trendData.slice(-6)
    }, [reportData.payrollRuns])

    // 2. Process Department Distribution
    const departmentData = useMemo(() => {
        const employees = reportData.employees || []
        const deptCounts = {}
        employees.forEach(emp => {
            const dept = emp.department || 'Unknown'
            deptCounts[dept] = (deptCounts[dept] || 0) + 1
        })

        const totalEmps = employees.length || 1
        const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f97316', '#8b5cf6', '#ec4899']

        return Object.keys(deptCounts).map((dept, index) => ({
            name: dept,
            value: Math.round((deptCounts[dept] / totalEmps) * 100),
            rawCount: deptCounts[dept],
            color: COLORS[index % COLORS.length]
        }))
    }, [reportData.employees])

    // 3. Process Attendance Trends & Key Metrics
    const { attendanceData, metrics } = useMemo(() => {
        const attendance = reportData.attendance || []
        const employees = reportData.employees || []

        const attMap = {}
        attendance.forEach(record => {
            const month = new Date(record.date).toLocaleString('default', { month: 'short' })
            if (!attMap[month]) attMap[month] = { month, present: 0, absent: 0 }

            if (record.status === 'present') attMap[month].present++
            else if (record.status === 'absent') attMap[month].absent++
        })

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

        return {
            attendanceData: Object.values(attMap),
            metrics: {
                averageSalary,
                retentionRate,
                attendanceRate,
                complianceScore,
                activeEmployees: activeEmployees.length,
                totalEmployees: employees.length || 0
            }
        }
    }, [reportData.attendance, reportData.employees])

    // 4. Combined Reports List
    const reports = useMemo(() => {
        const runs = reportData.payrollRuns || []
        const generatedReports = reportData.generatedReports || []

        const payrollReports = runs.map(run => ({
            id: run.id,
            name: `Payroll Summary - ${new Date(run.month_year).toLocaleString('default', { month: 'long', year: 'numeric' })}`,
            type: 'Payroll',
            description: `Monthly payroll summary for ${run.total_employees} employees`,
            date: new Date(run.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            status: 'available',
            raw_data: run
        }))

        const otherReports = generatedReports.map(report => ({
            id: report.id,
            name: report.title,
            type: report.report_type,
            description: report.description,
            date: new Date(report.generated_date || report.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            status: report.status,
            raw_data: report
        }))

        return [...payrollReports, ...otherReports].sort((a, b) =>
            new Date(b.date.split(' ').reverse().join('-')) - new Date(a.date.split(' ').reverse().join('-'))
        )
    }, [reportData.payrollRuns, reportData.generatedReports])

    // Statutory settings & employees
    const companySettings = statutoryData.companySettings || {}
    const payrollRun = statutoryData.payrollRun || null

    const payrollEmployees = useMemo(() => {
        if (payrollRun?.payroll_items) {
            return payrollRun.payroll_items
        }
        // Fallback: fetch active employees for current month
        const emps = reportData.employees || []
        const active = emps.filter(e => e.status === 'active')
        return active.map(e => ({
            ...e,
            name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
            grossSalary: e.salary,
            basicSalary: Math.round((e.salary || 0) * 0.4),
            uan: e.uan_number,
            esic_number: e.esi_number,
            pan: e.pan_number
        }))
    }, [payrollRun, reportData.employees])

    const activeEmployees = useMemo(() => {
        return (reportData.employees || [])
            .filter(e => e.status === 'active')
            .map(e => ({
                ...e,
                name: `${e.first_name || ''} ${e.last_name || ''}`.trim()
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [reportData.employees])

    const esicSummary = useMemo(() => {
        return getESICSummary(payrollEmployees)
    }, [payrollEmployees])

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
    const handleDownload = useCallback((report) => {
        if (report.raw_data?.metadata?.format === 'Excel') {
            import('xlsx').then((XLSX) => {
                const wb = XLSX.utils.book_new()
                const headers = ['Report', 'Type', 'Description', 'Date', 'Status']
                const rows = [
                    [report.name, report.type, report.description, report.date, report.status]
                ]
                const wsData = [headers, ...rows]
                const ws = XLSX.utils.aoa_to_sheet(wsData)
                XLSX.utils.book_append_sheet(wb, ws, 'Report')
                XLSX.writeFile(wb, `${report.name.replace(/\s+/g, '_')}.xlsx`)
            }).catch(err => {
                console.error('Error importing xlsx:', err)
                toast.error('Failed to export as Excel: xlsx library error')
            })
            return
        }

        if (report.raw_data?.metadata?.format === 'CSV') {
            const csv = [
                ['Report', 'Type', 'Description', 'Date', 'Status'],
                [report.name, report.type, report.description, report.date, report.status]
            ].map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
            downloadBlob(csv, `${report.name.replace(/\s+/g, '_')}.csv`)
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
    }, [])

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

            if (type === 'Employee') {
                let query = applyCompanyFilter(supabase.from('employees').select('*')).eq('status', 'active')
                if (department) query = query.eq('department', department)

                const { data: emps, error } = await query
                if (error) throw error

                // Determine which columns to show
                const colMap = {
                    'Employee Details': (e) => [`${e.first_name} ${e.last_name}`, e.email || '', e.phone || ''],
                    'Basic Salary': (e) => [e.salary || 0],
                    'Gross Salary': (e) => [(Number(e.salary || 0) + Number(e.salary_allowances || 0))],
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
                let query = applyCompanyFilter(
                    supabase
                        .from('payroll_items')
                        .select(`id, basic_salary, total_allowances, total_deductions, net_salary, attendance_days,
                            employees(first_name, last_name, employee_id, department, designation),
                            payroll_runs(month_year)`)
                )
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
                let query = applyCompanyFilter(
                    supabase
                        .from('attendance')
                        .select('date, status, check_in, check_out, remarks, employees(first_name, last_name, employee_id, department)')
                )
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
                const XLSX = await import('xlsx')
                const wb = XLSX.utils.book_new()
                const wsData = [headers, ...rows]
                const ws = XLSX.utils.aoa_to_sheet(wsData)
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
                const pdf = new jsPDF({ orientation: rows.length > 0 && headers.length > 6 ? 'landscape' : 'portrait' })
                pdf.setFontSize(14)
                pdf.text(`${type} Report — ${dateRange}`, 14, 18)
                pdf.setFontSize(8)
                pdf.text(`Generated: ${new Date().toLocaleDateString()} | ${rows.length} records`, 14, 26)
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
            await saveReportMutation.mutateAsync({
                title: `Custom ${type} Report - ${dateRange}`,
                report_type: type,
                description: `Custom report for ${department || 'All Departments'} (${format}) — ${rows.length} records`,
                status: 'available',
                metadata: { ...customReportForm, record_count: rows.length },
                generated_date: new Date().toISOString()
            })

            setShowCustomReportModal(false)
            setCustomReportForm({ type: '', dateRange: '', department: '', format: '', dataPoints: [] })
            toast.success(`Custom ${type} report exported as ${format} with ${rows.length} records.`)

        } catch (error) {
            logger.error('Error generating custom report:', error)
            toast.error('Failed to generate report: ' + (error.message || 'Unknown error'))
        }
    }

    const handleGenerateForm16 = async () => {
        if (!selectedForm16EmployeeId) {
            toast.warning('Please select an employee first.')
            return
        }

        try {
            setGeneratingForm16(true)
            
            // 1. Determine selected employee and financial year
            const emp = reportData.employees?.find(e => e.id === selectedForm16EmployeeId)
            if (!emp) {
                toast.error('Employee not found.')
                return
            }
            
            // Compute financial year from the statutory month selected in UI
            const fy = getIndianFinancialYear(statutoryMonth)
            
            // 2. Fetch tax declaration for the selected employee and financial year
            const { data: declarations, error: declError } = await applyCompanyFilter(
                supabase
                    .from('tax_declarations')
                    .select('*')
            )
                .eq('employee_id', selectedForm16EmployeeId)
                .eq('financial_year', fy)
            
            if (declError) throw declError
            
            // Find approved first, or default to any, or empty
            const declaration = declarations?.find(d => d.status === 'approved') || declarations?.[0] || { regime: 'new' }
            
            // 3. Fetch payroll runs for the employee in the financial year
            const fyStart = `${fy.split('-')[0]}-04-01`
            const fyEnd = `${Number(fy.split('-')[0]) + 1}-03-31`
            
            const { data: dbItems, error: itemsError } = await applyCompanyFilter(
                supabase
                    .from('payroll_items')
                    .select(`
                        basic_salary,
                        total_allowances,
                        total_deductions,
                        net_salary,
                        attendance_days,
                        breakdown,
                        payroll_runs!inner (
                            month_year,
                            status
                        )
                    `)
            )
                .eq('employee_id', selectedForm16EmployeeId)
                .eq('payroll_runs.status', 'Completed')
                .gte('payroll_runs.month_year', fyStart)
                .lte('payroll_runs.month_year', fyEnd)
            
            if (itemsError) throw itemsError
            
            if (!dbItems || dbItems.length === 0) {
                toast.warning(`No completed payroll records found for ${emp.first_name} ${emp.last_name} in the selected financial year ${fy}. Please select a payroll month within a financial year that has completed runs (e.g., select March 2026 for FY 2025-26).`)
                setGeneratingForm16(false)
                return
            }
            
            // 4. Map db items to structure expected by generateForm16PDF
            const payrollRuns = (dbItems || []).map(item => {
                const basic = Number(item.basic_salary) || 0
                const grossSalary = Number(item.breakdown?.gross) || (Number(item.basic_salary) + Number(item.total_allowances)) || 0
                const earnings = item.breakdown?.earnings || []
                
                const findEarning = (keySubstrs) => {
                    const found = earnings.find(e => keySubstrs.some(sub => e.name?.toLowerCase().includes(sub)))
                    return found ? Number(found.amount) || 0 : 0
                }
                
                const hra = findEarning(['house rent', 'hra'])
                const conveyance = findEarning(['conveyance'])
                const medical = findEarning(['medical'])
                const specialAllowance = findEarning(['special'])
                const lta = findEarning(['leave travel', 'lta'])
                
                let otherAllowance = 0
                earnings.forEach(e => {
                    const name = e.name?.toLowerCase() || ''
                    if (name.includes('basic') || name.includes('house rent') || name.includes('hra') || 
                        name.includes('conveyance') || name.includes('medical') || name.includes('special') || 
                        name.includes('leave travel') || name.includes('lta') || name.includes('overtime')) {
                        return
                    }
                    otherAllowance += Number(e.amount) || 0
                })
                
                const deductions = item.breakdown?.deductions || []
                const tdsObj = deductions.find(d => d.name?.toLowerCase().includes('tds') || d.name?.toLowerCase().includes('tax') || d.name?.toLowerCase().includes('income tax'))
                const tds = tdsObj ? Number(tdsObj.amount) || 0 : 0
                
                return {
                    basicSalary: basic,
                    hra,
                    conveyance,
                    medical,
                    specialAllowance,
                    lta,
                    otherAllowance,
                    grossSalary,
                    tds
                }
            })
            
            // 5. Build employee and company objects
            const mappedEmployee = {
                ...emp,
                name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
                pan: emp.pan_number || 'NOT AVAILABLE',
                designation: emp.designation || '',
                joining_date: emp.joining_date || ''
            }
            
            const mappedCompany = {
                name: companySettings.company_name || companySettings.name || 'Acme Solutions',
                pan: companySettings.pan_number || companySettings.pan || 'NOT AVAILABLE',
                tan: companySettings.tan_number || companySettings.tan || 'NOT AVAILABLE',
                address: companySettings.address || [companySettings.city, companySettings.state, companySettings.pincode].filter(Boolean).join(', ') || 'NOT AVAILABLE'
            }
            
            // 6. Generate and download pdf
            generateForm16PDF({
                employee: mappedEmployee,
                company: mappedCompany,
                declaration,
                payrollRuns,
                financialYear: fy,
                download: true
            })
            
            toast.success(`Form 16 generated successfully for ${mappedEmployee.name}.`)
        } catch (error) {
            logger.error('Error generating Form 16:', error)
            toast.error('Failed to generate Form 16: ' + (error.message || 'Unknown error'))
        } finally {
            setGeneratingForm16(false)
        }
    }

    const handleTallyExport = (format = 'xml') => {
        if (!payrollEmployees.length) {
            toast.warning('No payroll data for selected month.')
            return
        }

        try {
            const options = {
                companyName: companySettings.company_name || companySettings.name || '',
                period: statutoryMonth,
                periodLabel: new Date(statutoryMonth).toLocaleString('default', { month: 'long', year: 'numeric' })
            }

            if (format === 'xml') {
                downloadTallyJournalXML(payrollEmployees, options)
                toast.success('Tally XML journal downloaded successfully.')
            } else {
                downloadTallyJournalCSV(payrollEmployees, options)
                toast.success('Tally CSV journal downloaded successfully.')
            }
        } catch (err) {
            logger.error('Tally export failed:', err)
            toast.error('Tally export failed: ' + err.message)
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
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
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
                <div className="mt-5 inline-flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-slate-50 p-1">
                    {[
                        { key: 'payroll', label: 'Payroll' },
                        { key: 'compliance', label: 'Compliance' },
                        { key: 'hr', label: 'HR' },
                        { key: 'custom', label: 'Custom' }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveReportTab(tab.key)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeReportTab === tab.key ? 'bg-slate-900 text-white shadow-sm' : 'text-gray-600 hover:text-slate-900 hover:bg-white'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Charts Grid */}
            <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${activeReportTab === 'compliance' || activeReportTab === 'custom' ? 'hidden' : ''}`}>
                {/* Monthly Payroll Trend */}
                <div className={`col-span-1 lg:col-span-2 min-w-0 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm ${activeReportTab !== 'payroll' ? 'hidden' : ''}`}>
                    <div className="flex items-center space-x-2 mb-6">
                        <TrendingUp className="w-5 h-5 text-gray-400" />
                        <h3 className="font-bold text-gray-800">Monthly Payroll Trend</h3>
                    </div>
                    <div className="h-64 w-full min-w-0 mt-4">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                <div className={`min-w-0 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm ${activeReportTab !== 'hr' ? 'hidden' : ''}`}>
                    <h3 className="font-bold text-gray-800 mb-6">Department-wise Employee Distribution</h3>
                    <div className="h-48 w-full min-w-0 mt-4">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                <div className={`col-span-1 lg:col-span-2 min-w-0 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm ${activeReportTab !== 'hr' ? 'hidden' : ''}`}>
                    <div className="flex items-center space-x-2 mb-6">
                        <CalendarCheck className="w-5 h-5 text-gray-400" />
                        <h3 className="font-bold text-gray-800">Attendance Trends</h3>
                    </div>
                    <div className="h-64 w-full min-w-0 mt-4">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                <div className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between border-l-[6px] border-l-slate-900 group transition-all duration-300 hover:shadow-md ${activeReportTab !== 'hr' ? 'hidden' : ''}`}>
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
                            <span className="text-xs font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded-full">6 mo</span>
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
            <div id="reports-table" className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${activeReportTab !== 'payroll' && activeReportTab !== 'custom' ? 'hidden' : ''}`}>
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
                                    <ReportRow
                                        key={report.id}
                                        report={report}
                                        handleDownload={handleDownload}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {filteredReports.length > reportsPerPage && (
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                        <span>Page {currentPage} of {totalPages}</span>
                        <Pagination page={currentPage - 1} totalPages={totalPages} onPageChange={(p) => setCurrentPage(p + 1)} />
                    </div>
                )}
            </div>

            {/* ── Statutory Compliance Exports ─────────────────────────── */}
            <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${activeReportTab !== 'compliance' ? 'hidden' : ''}`}>
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

                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

                    <div className="border border-gray-100 rounded-2xl p-5 hover:border-amber-200 hover:shadow-md transition-all group flex flex-col justify-between">
                        <div>
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <FileBadge className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-800">Form 16</h3>
                            <p className="text-xs text-gray-500 mt-1 mb-4">TDS certificate (Part A + B) generated per employee from Tax Declarations</p>
                        </div>
                        <div className="space-y-3">
                            <div className="relative">
                                <label htmlFor="form16-employee-select" className="sr-only">Select Employee</label>
                                <select
                                    id="form16-employee-select"
                                    value={selectedForm16EmployeeId}
                                    onChange={(e) => setSelectedForm16EmployeeId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-gray-50 focus:ring-2 focus:ring-amber-100 focus:border-amber-400 transition-all focus:outline-none"
                                >
                                    <option value="">Select Employee</option>
                                    {activeEmployees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={handleGenerateForm16}
                                disabled={!selectedForm16EmployeeId || generatingForm16}
                                className="w-full py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-100"
                            >
                                {generatingForm16 ? (
                                    <>
                                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/50 border-t-white" />
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <Receipt className="w-3.5 h-3.5" /> Generate Form 16
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => navigate('/tax-declarations')}
                                className="w-full py-1 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-1.5 text-[10px] font-bold"
                            >
                                Go to Tax Declarations
                            </button>
                        </div>
                    </div>

                    <div className="border border-gray-100 rounded-2xl p-5 hover:border-slate-300 hover:shadow-md transition-all group flex flex-col justify-between">
                        <div>
                            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Landmark className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-800">Bank Transfer (NEFT)</h3>
                            <p className="text-xs text-gray-500 mt-1 mb-4">Generate bulk payment upload sheets for Indian corporate banking platforms</p>
                        </div>
                        <div className="space-y-2">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Company Debit Account No (SBI)"
                                    value={debitAccount}
                                    onChange={(e) => setDebitAccount(e.target.value)}
                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-gray-50 focus:ring-2 focus:ring-slate-100 focus:border-slate-400 focus:outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                                <button
                                    onClick={() => {
                                        if (!payrollEmployees.length) { toast.warning('No payroll data.'); return }
                                        downloadGenericNEFT(payrollEmployees, statutoryMonth)
                                        toast.success('Generic NEFT CSV downloaded.')
                                    }}
                                    className="py-1.5 bg-slate-800 text-white rounded-lg text-[10px] font-bold hover:bg-slate-900 transition-colors"
                                >
                                    Generic
                                </button>
                                <button
                                    onClick={() => {
                                        if (!payrollEmployees.length) { toast.warning('No payroll data.'); return }
                                        downloadHDFCBulk(payrollEmployees, statutoryMonth)
                                        toast.success('HDFC Bulk CSV downloaded.')
                                    }}
                                    className="py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-colors"
                                >
                                    HDFC
                                </button>
                                <button
                                    onClick={() => {
                                        if (!payrollEmployees.length) { toast.warning('No payroll data.'); return }
                                        if (!debitAccount.trim()) { toast.warning('SBI requires debit account number.'); return }
                                        downloadSBISFMS(payrollEmployees, statutoryMonth, debitAccount)
                                        toast.success('SBI SFMS file downloaded.')
                                    }}
                                    className="py-1.5 bg-green-600 text-white rounded-lg text-[10px] font-bold hover:bg-green-700 transition-colors"
                                >
                                    SBI
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="border border-gray-100 rounded-2xl p-5 hover:border-purple-200 hover:shadow-md transition-all group flex flex-col justify-between">
                        <div>
                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Database className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-800">Tally ERP Export</h3>
                            <p className="text-xs text-gray-500 mt-1 mb-4">Export monthly payroll journal entries as XML or CSV for direct import into Tally ERP</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => handleTallyExport('xml')}
                                className="w-full py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-100"
                            >
                                <Download className="w-3.5 h-3.5" /> Download XML
                            </button>
                            <button
                                onClick={() => handleTallyExport('csv')}
                                className="w-full py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <Download className="w-3.5 h-3.5" /> Download CSV
                            </button>
                        </div>
                    </div>

                    <div className="border border-gray-100 rounded-2xl p-5 hover:border-teal-200 hover:shadow-md transition-all group flex flex-col justify-between">
                        <div>
                            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Receipt className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-800">State PT & LWF</h3>
                            <p className="text-xs text-gray-500 mt-1 mb-4">Download Professional Tax and Labour Welfare Fund reconciliation statements</p>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <select
                                    value={complianceState}
                                    onChange={(e) => setComplianceState(e.target.value)}
                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-gray-50 focus:ring-2 focus:ring-teal-100 focus:border-teal-400 focus:outline-none"
                                >
                                    {['Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'].map(state => (
                                        <option key={state} value={state}>{state}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <button
                                    onClick={() => {
                                        if (!payrollEmployees.length) { toast.warning('No payroll data.'); return }
                                        downloadPTChallan(payrollEmployees, complianceState, statutoryMonth)
                                        toast.success(`${complianceState} PT Statement downloaded.`)
                                    }}
                                    className="py-1.5 bg-teal-600 text-white rounded-lg text-[10px] font-bold hover:bg-teal-700 transition-colors"
                                >
                                    PT Statement
                                </button>
                                <button
                                    onClick={() => {
                                        if (!payrollEmployees.length) { toast.warning('No payroll data.'); return }
                                        downloadLWFStatement(payrollEmployees, complianceState, statutoryMonth)
                                        toast.success(`${complianceState} LWF Statement downloaded.`)
                                    }}
                                    className="py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-colors"
                                >
                                    LWF Statement
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="border border-gray-100 rounded-2xl p-5 hover:border-orange-200 hover:shadow-md transition-all group flex flex-col justify-between">
                        <div>
                            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Receipt className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-800">NSDL 24Q TDS Return</h3>
                            <p className="text-xs text-gray-500 mt-1 mb-4">Export government-compliant quarterly plain-text return file for Section 192 TDS filing</p>
                        </div>
                        <div className="space-y-2">
                            <div className="relative mb-2">
                                <label htmlFor="tds-quarter-select" className="sr-only">TDS Quarter Override</label>
                                <select
                                    id="tds-quarter-select"
                                    value={selectedQuarter}
                                    onChange={e => setSelectedQuarter(e.target.value)}
                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-gray-50 focus:ring-2 focus:ring-orange-100 focus:border-orange-400 focus:outline-none"
                                >
                                    <option value="">Auto-detect from Month</option>
                                    <option value="Q1">Q1 (Apr–Jun)</option>
                                    <option value="Q2">Q2 (Jul–Sep)</option>
                                    <option value="Q3">Q3 (Oct–Dec)</option>
                                    <option value="Q4">Q4 (Jan–Mar)</option>
                                </select>
                            </div>
                            <button
                                onClick={() => {
                                    if (!payrollEmployees.length) { toast.warning('No payroll data.'); return }
                                    const monthPart = statutoryMonth.split('-')[1]
                                    const monthNum = parseInt(monthPart, 10)
                                    const derivedQ = deriveQuarterFromMonth(monthNum)
                                    const quarter = selectedQuarter || derivedQ

                                    const text = generate24QText(companySettings, payrollEmployees, quarter)
                                    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' })
                                    downloadBlob(blob, `TDS_24Q_${quarter}_${statutoryMonth}.txt`)
                                    toast.success(`NSDL 24Q TDS return file downloaded for ${quarter}.`)
                                }}
                                className="w-full py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-100"
                            >
                                <Download className="w-3.5 h-3.5" /> Export 24Q TDS (.txt)
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div onClick={() => navigate('/payroll-processing')} className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group border-l-[6px] border-l-blue-600 hover:scale-[1.02] ${activeReportTab !== 'payroll' ? 'hidden' : ''}`}>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <FileBarChart className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">Quick Payroll Report</h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">Generate current month payroll summary instantly</p>
                    <button onClick={(e) => { e.stopPropagation(); navigate('/payroll-processing') }} className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors">Generate Report</button>
                </div>
                <div onClick={() => setShowComplianceModal(true)} className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group border-l-[6px] border-l-emerald-600 hover:scale-[1.02] ${activeReportTab !== 'compliance' ? 'hidden' : ''}`}>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">Compliance Dashboard</h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">View all compliance reports in one place</p>
                    <button onClick={(e) => { e.stopPropagation(); setShowComplianceModal(true) }} className="mt-4 w-full py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors">View Dashboard</button>
                </div>
                <div onClick={() => navigate('/report-builder')} className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group border-l-[6px] border-l-violet-600 hover:scale-[1.02] ${activeReportTab !== 'custom' ? 'hidden' : ''}`}>
                    <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Settings className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">Custom Report Builder</h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">Create custom reports with specific parameters</p>
                    <button onClick={(e) => { e.stopPropagation(); navigate('/report-builder') }} className="mt-4 w-full py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors">Build Report</button>
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
                                    <p className="text-[10px] text-gray-600 mt-1">{metrics.activeEmployees}/{metrics.totalEmployees} employees</p>
                                </div>
                                <div className="border border-gray-100 rounded-2xl p-4 text-center">
                                    <p className="text-xs font-bold text-gray-600 mb-3">ESI Eligible</p>
                                    <p className="text-2xl font-black text-emerald-500">{esicSummary.eligibleCount}</p>
                                    <p className="text-[10px] text-gray-600 mt-1">employees this month</p>
                                </div>
                                <div className="border border-gray-100 rounded-2xl p-4 text-center">
                                    <p className="text-xs font-bold text-gray-600 mb-3">PT Compliance</p>
                                    <p className="text-2xl font-black text-amber-500">{metrics.complianceScore.toFixed(1)}%</p>
                                    <p className="text-[10px] text-gray-600 mt-1">Derived from enabled rules</p>
                                </div>
                                <div className="border border-gray-100 rounded-2xl p-4 text-center">
                                    <p className="text-xs font-bold text-gray-600 mb-3">TDS Compliance</p>
                                    <p className="text-2xl font-black text-emerald-500">{metrics.complianceScore.toFixed(1)}%</p>
                                    <p className="text-[10px] text-gray-600 mt-1">TDS enabled in payroll</p>
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
