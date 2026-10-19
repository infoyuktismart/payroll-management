import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import { useCompany } from '../context/CompanyContext'
import { logger } from '../lib/devLogger'
import {
    useReportData,
    useStatutoryData,
    useSaveGeneratedReport,
    useCustomReportMutation,
    useForm16DataMutation
} from '../hooks/useReportsData'
import { downloadBlob, formatCurrency } from '../lib/payrollUtils'
import { generateForm16PDF } from '../lib/form16Generator'
import { getESICSummary } from '../lib/esicGenerator'
import { getIndianFinancialYear } from '../lib/taxUtils'
import { downloadTallyJournalXML, downloadTallyJournalCSV } from '../lib/tallyExporter'
import { PageHeaderSkeleton, CardSkeleton, TableSkeleton } from '../components/ui/SkeletonLoader'
import { Download, FileBarChart, ShieldCheck, Settings } from 'lucide-react'

// Subcomponents
import ReportFilterBar from '../components/reports/ReportFilterBar'
import ReportVisualizations from '../components/reports/ReportVisualizations'
import ReportListTable from '../components/reports/ReportListTable'
import StatutoryComplianceExports from '../components/reports/StatutoryComplianceExports'
import { ComplianceDashboardModal, CustomReportBuilderModal } from '../components/reports/ReportModals'

export default function Reports() {
    const navigate = useNavigate()
    const toast = useToast()
    const { activeCompanyId, selectedBranch } = useCompany()
    
    // Page state
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
    const { data: reportData = {}, isLoading: loadingReportData } = useReportData(activeCompanyId, selectedBranch)
    const { data: statutoryData = {}, isLoading: loadingStatutory } = useStatutoryData(statutoryMonth, activeCompanyId, selectedBranch)

    const loading = loadingReportData || loadingStatutory

    // React Query Mutations
    const saveReportMutation = useSaveGeneratedReport()
    const customReportMutation = useCustomReportMutation()
    const form16DataMutation = useForm16DataMutation()

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

    // Header Action: Export All Reports
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

    // Grid Row Action: Download Single Report
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

        import('jspdf').then(({ default: jsPDFLib }) => {
            const pdf = new jsPDFLib()
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
        }).catch(err => {
            console.error('Error importing jspdf:', err)
            toast.error('Failed to export as PDF: jspdf library error')
        })
    }, [toast])

    // Generate Custom Report
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

            // ── 2. Fetch real data using mutation hook ──
            const data = await customReportMutation.mutateAsync({ type, fromDate, department })

            let rows = []
            let headers = []

            if (type === 'Employee') {
                const emps = data || []
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
                rows = emps.map(e => [
                    e.employee_id || '',
                    ...dataPoints.flatMap(dp => colMap[dp] ? colMap[dp](e) : [''])
                ])
            } else if (type === 'Payroll') {
                const filteredItems = data || []
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
                const filteredAttData = data || []
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
                const { default: jsPDFLib } = await import('jspdf')
                const pdf = new jsPDFLib({ orientation: rows.length > 0 && headers.length > 6 ? 'landscape' : 'portrait' })
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
                payload: {
                    title: `Custom ${type} Report - ${dateRange}`,
                    report_type: type,
                    description: `Custom report for ${department || 'All Departments'} (${format}) — ${rows.length} records`,
                    status: 'available',
                    metadata: { ...customReportForm, record_count: rows.length },
                    generated_date: new Date().toISOString()
                },
                activeCompanyId
            })

            setShowCustomReportModal(false)
            setCustomReportForm({ type: '', dateRange: '', department: '', format: '', dataPoints: [] })
            toast.success(`Custom ${type} report exported as ${format} with ${rows.length} records.`)

        } catch (error) {
            logger.error('Error generating custom report:', error)
            toast.error('Failed to generate report: ' + (error.message || 'Unknown error'))
        }
    }

    // Generate Form 16 PDF
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
            
            // 2. Fetch tax declarations and completed payroll items via mutation hook
            const fyStart = `${fy.split('-')[0]}-04-01`
            const fyEnd = `${Number(fy.split('-')[0]) + 1}-03-31`

            const { declarations, payrollItems: dbItems } = await form16DataMutation.mutateAsync({
                employeeId: selectedForm16EmployeeId,
                financialYear: fy,
                startMonth: fyStart,
                endMonth: fyEnd
            })
            
            // Find approved first, or default to any, or empty
            const declaration = declarations?.find(d => d.status === 'approved') || declarations?.[0] || { regime: 'new' }
            
            if (!dbItems || dbItems.length === 0) {
                toast.warning(`No completed payroll records found for ${emp.first_name} ${emp.last_name} in the selected financial year ${fy}. Please select a payroll month within a financial year that has completed runs (e.g., select March 2026 for FY 2025-26).`)
                setGeneratingForm16(false)
                return
            }
            
            // 3. Map db items to structure expected by generateForm16PDF
            const payrollRuns = dbItems.map(item => {
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
            
            // 4. Build employee and company objects
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
            
            // 5. Generate and download pdf
            await generateForm16PDF({
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

    // Tally Journal Export
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

    // Filtered reports search criteria
    const filteredReports = useMemo(() => {
        return reports.filter(r =>
            r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.type.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [reports, searchTerm])

    const totalPages = Math.max(1, Math.ceil(filteredReports.length / reportsPerPage))

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
            {/* Filter Bar with Tabs & Header Actions */}
            <ReportFilterBar
                activeReportTab={activeReportTab}
                setActiveReportTab={setActiveReportTab}
                exportAllReports={exportAllReports}
            />

            {/* Visualizations & Charts Grid */}
            <ReportVisualizations
                activeReportTab={activeReportTab}
                payrollTrendData={payrollTrendData}
                departmentData={departmentData}
                attendanceData={attendanceData}
                metrics={metrics}
                formatCurrency={formatCurrency}
            />

            {/* Reports List Table Grid */}
            <ReportListTable
                activeReportTab={activeReportTab}
                reports={filteredReports}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalPages={totalPages}
                reportsPerPage={reportsPerPage}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                handleDownload={handleDownload}
            />

            {/* Statutory Compliance Export Dashboard Cards */}
            <StatutoryComplianceExports
                activeReportTab={activeReportTab}
                statutoryMonth={statutoryMonth}
                setStatutoryMonth={setStatutoryMonth}
                payrollEmployees={payrollEmployees}
                esicSummary={esicSummary}
                activeEmployees={activeEmployees}
                selectedForm16EmployeeId={selectedForm16EmployeeId}
                setSelectedForm16EmployeeId={setSelectedForm16EmployeeId}
                generatingForm16={generatingForm16}
                handleGenerateForm16={handleGenerateForm16}
                complianceState={complianceState}
                setComplianceState={setComplianceState}
                debitAccount={debitAccount}
                setDebitAccount={setDebitAccount}
                selectedQuarter={selectedQuarter}
                setSelectedQuarter={setSelectedQuarter}
                handleTallyExport={handleTallyExport}
                companySettings={companySettings}
                formatCurrency={formatCurrency}
                toast={toast}
                navigate={navigate}
            />

            {/* Quick Actions / Navigation Cards Footer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div 
                    onClick={() => navigate('/payroll-processing')} 
                    className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group border-l-[6px] border-l-blue-600 hover:scale-[1.02] ${
                        activeReportTab !== 'payroll' ? 'hidden' : ''
                    }`}
                >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <FileBarChart className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">Quick Payroll Report</h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">Generate current month payroll summary instantly</p>
                    <button 
                        onClick={(e) => { e.stopPropagation(); navigate('/payroll-processing') }} 
                        className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                    >
                        Generate Report
                    </button>
                </div>

                <div 
                    onClick={() => setShowComplianceModal(true)} 
                    className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group border-l-[6px] border-l-emerald-600 hover:scale-[1.02] ${
                        activeReportTab !== 'compliance' ? 'hidden' : ''
                    }`}
                >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">Compliance Dashboard</h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">View all compliance reports in one place</p>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowComplianceModal(true) }} 
                        className="mt-4 w-full py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors"
                    >
                        View Dashboard
                    </button>
                </div>

                <div 
                    onClick={() => setShowCustomReportModal(true)} 
                    className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group border-l-[6px] border-l-violet-600 hover:scale-[1.02] ${
                        activeReportTab !== 'custom' ? 'hidden' : ''
                    }`}
                >
                    <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Settings className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">Custom Report Builder</h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">Create custom reports with specific parameters</p>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowCustomReportModal(true) }} 
                        className="mt-4 w-full py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors"
                    >
                        Build Report
                    </button>
                </div>
            </div>

            {/* Overlays / Modals */}
            <ComplianceDashboardModal
                isOpen={showComplianceModal}
                onClose={() => setShowComplianceModal(false)}
                metrics={metrics}
                esicSummary={esicSummary}
                reports={reports}
            />

            <CustomReportBuilderModal
                isOpen={showCustomReportModal}
                onClose={() => setShowCustomReportModal(false)}
                customReportForm={customReportForm}
                setCustomReportForm={setCustomReportForm}
                departmentData={departmentData}
                onGenerate={handleGenerateCustomReport}
            />
        </div>
    )
}
