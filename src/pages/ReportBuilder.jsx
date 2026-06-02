import { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { Download, FileSpreadsheet, Save } from 'lucide-react'
import { analyticsService } from '../services/analyticsService'
import { downloadBlob } from '../lib/payrollUtils'
import { useToast } from '../context/ToastContext'

const FIELD_SETS = {
    employee: ['employee_id', 'first_name', 'last_name', 'email', 'department', 'designation', 'joining_date', 'status', 'salary'],
    payroll: ['employee_id', 'employee_name', 'department', 'month_year', 'basic_salary', 'total_allowances', 'total_deductions', 'net_salary', 'attendance_days'],
    attendance: ['employee_id', 'employee_name', 'department', 'date', 'status', 'check_in', 'check_out', 'remarks']
}

export default function ReportBuilder() {
    const toast = useToast()
    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState([])
    const [form, setForm] = useState({
        type: 'employee',
        department: '',
        fromDate: '',
        toDate: '',
        format: 'CSV',
        fields: FIELD_SETS.employee.slice(0, 6)
    })

    const availableFields = FIELD_SETS[form.type] || []
    const previewRows = rows.slice(0, 8)

    const title = useMemo(() => {
        const date = new Date().toISOString().split('T')[0]
        return `${form.type}_custom_report_${date}`
    }, [form.type])

    const updateForm = (field, value) => {
        setForm(prev => {
            const next = { ...prev, [field]: value }
            if (field === 'type') {
                next.fields = FIELD_SETS[value].slice(0, 6)
            }
            return next
        })
        setRows([])
    }

    const toggleField = (field) => {
        setForm(prev => ({
            ...prev,
            fields: prev.fields.includes(field)
                ? prev.fields.filter(item => item !== field)
                : [...prev.fields, field]
        }))
    }

    const generate = async () => {
        if (form.fields.length === 0) {
            toast.warning('Select at least one field.')
            return
        }
        setLoading(true)
        try {
            const result = await analyticsService.buildCustomReport(form)
            setRows(result)
            toast.success(`Generated ${result.length} row${result.length === 1 ? '' : 's'}.`)
        } catch (error) {
            toast.error(error.message || 'Unable to generate report.')
        } finally {
            setLoading(false)
        }
    }

    const exportRows = async () => {
        if (rows.length === 0) {
            toast.warning('Generate a report first.')
            return
        }

        if (form.format === 'Excel') {
            const XLSX = await import('xlsx')
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Report')
            XLSX.writeFile(wb, `${title}.xlsx`)
        } else if (form.format === 'PDF') {
            const pdf = new jsPDF({ orientation: form.fields.length > 6 ? 'landscape' : 'portrait' })
            pdf.setFontSize(16)
            pdf.text(title.replace(/_/g, ' '), 14, 18)
            pdf.setFontSize(8)
            rows.slice(0, 30).forEach((row, index) => {
                pdf.text(Object.values(row).join(' | ').slice(0, 180), 14, 30 + (index * 6))
            })
            pdf.save(`${title}.pdf`)
        } else {
            const csv = [
                form.fields.join(','),
                ...rows.map(row => form.fields.map(field => `"${String(row[field] ?? '').replace(/"/g, '""')}"`).join(','))
            ].join('\n')
            downloadBlob(csv, `${title}.csv`)
        }

        await analyticsService.saveReportDefinition({
            title: title.replace(/_/g, ' '),
            report_type: 'Custom',
            description: `${form.type} report with ${form.fields.length} fields`,
            status: 'available',
            metadata: {
                type: form.type,
                format: form.format,
                fields: form.fields,
                row_count: rows.length
            },
            generated_date: new Date().toISOString().split('T')[0]
        })
        toast.success(`${form.format} report exported and saved to reports.`)
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h1 className="text-2xl font-black text-slate-900">Report Builder</h1>
                <p className="text-sm text-gray-500 mt-1">Build tenant-scoped employee, payroll, and attendance reports with selected fields.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
                <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 h-fit">
                    <div className="space-y-5">
                        <label className="block">
                            <span className="text-xs font-bold text-gray-600 uppercase">Report Type</span>
                            <select value={form.type} onChange={(e) => updateForm('type', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold">
                                <option value="employee">Employee</option>
                                <option value="payroll">Payroll</option>
                                <option value="attendance">Attendance</option>
                            </select>
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className="text-xs font-bold text-gray-600 uppercase">From</span>
                                <input type="date" value={form.fromDate} onChange={(e) => updateForm('fromDate', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                            </label>
                            <label className="block">
                                <span className="text-xs font-bold text-gray-600 uppercase">To</span>
                                <input type="date" value={form.toDate} onChange={(e) => updateForm('toDate', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                            </label>
                        </div>

                        <label className="block">
                            <span className="text-xs font-bold text-gray-600 uppercase">Department</span>
                            <input value={form.department} onChange={(e) => updateForm('department', e.target.value)} placeholder="Optional exact department" className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                        </label>

                        <label className="block">
                            <span className="text-xs font-bold text-gray-600 uppercase">Output</span>
                            <select value={form.format} onChange={(e) => updateForm('format', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold">
                                <option value="CSV">CSV</option>
                                <option value="Excel">Excel</option>
                                <option value="PDF">PDF</option>
                            </select>
                        </label>

                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase mb-3">Fields</p>
                            <div className="grid grid-cols-1 gap-2">
                                {availableFields.map(field => (
                                    <label key={field} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2 hover:bg-slate-50">
                                        <input type="checkbox" checked={form.fields.includes(field)} onChange={() => toggleField(field)} className="rounded border-gray-300 text-blue-600" />
                                        <span className="text-sm font-bold text-slate-700">{field.replace(/_/g, ' ')}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button onClick={generate} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                                <FileSpreadsheet className="w-4 h-4" />
                                {loading ? 'Generating...' : 'Generate'}
                            </button>
                            <button onClick={exportRows} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-black text-slate-900">Preview</h2>
                            <p className="text-xs text-gray-500 mt-0.5">{rows.length} rows generated</p>
                        </div>
                        <Save className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-gray-100">
                                <tr>
                                    {form.fields.map(field => (
                                        <th key={field} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">{field.replace(/_/g, ' ')}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {previewRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={Math.max(1, form.fields.length)} className="px-4 py-12 text-center text-sm text-gray-500">Generate a report to preview rows.</td>
                                    </tr>
                                ) : previewRows.map((row, index) => (
                                    <tr key={index} className="hover:bg-slate-50">
                                        {form.fields.map(field => (
                                            <td key={field} className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{String(row[field] ?? '')}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    )
}
