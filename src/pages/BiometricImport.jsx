import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileUp, Fingerprint, Loader2, Upload } from 'lucide-react'
import { attendanceService } from '../services/attendanceService'
import { employeeService } from '../services/employeeService'
import { buildBiometricAttendanceRows, parseBiometricCsv } from '../lib/biometricImporter'
import { downloadBlob } from '../lib/payrollUtils'
import { useToast } from '../context/ToastContext'

const vendorOptions = [
    { value: 'auto', label: 'Auto Detect' },
    { value: 'essl', label: 'ESSL' },
    { value: 'zk', label: 'ZK / ZKTeco' }
]

const emptyStats = { totalPunches: 0, matchedRows: 0, unmatchedRows: 0, importedRows: 0, failedRows: 0 }

export default function BiometricImport() {
    const toast = useToast()
    const [vendor, setVendor] = useState('auto')
    const [fileName, setFileName] = useState('')
    const [punches, setPunches] = useState([])
    const [employees, setEmployees] = useState([])
    const [errors, setErrors] = useState([])
    const [overrides, setOverrides] = useState({})
    const [stats, setStats] = useState(emptyStats)
    const [loading, setLoading] = useState(false)
    const [importing, setImporting] = useState(false)

    const attendanceRows = useMemo(() => buildBiometricAttendanceRows(punches, employees, overrides), [punches, employees, overrides])
    const matchedRows = attendanceRows.filter(row => row.employee)
    const unmatchedRows = attendanceRows.filter(row => !row.employee)

    const handleFile = async (event) => {
        const file = event.target.files?.[0]
        if (!file) return

        setLoading(true)
        setFileName(file.name)
        setPunches([])
        setErrors([])
        setStats(emptyStats)

        try {
            const text = await file.text()
            const [employeeRows, parsed] = await Promise.all([
                employeeService.getAllEmployees(),
                Promise.resolve(parseBiometricCsv(text, vendor))
            ])
            const activeEmployees = (employeeRows || []).filter(employee => employee.status !== 'inactive')
            const rows = buildBiometricAttendanceRows(parsed.punches, activeEmployees, overrides)

            setEmployees(activeEmployees)
            setPunches(parsed.punches)
            setErrors(parsed.errors || [])
            setStats({
                ...emptyStats,
                totalPunches: parsed.punches.length,
                matchedRows: rows.filter(row => row.employee).length,
                unmatchedRows: rows.filter(row => !row.employee).length
            })

            if (parsed.punches.length === 0) {
                toast.warning('No valid biometric punches found in the file.')
            } else {
                toast.success(`Parsed ${parsed.punches.length} punch(es).`)
            }
        } catch (error) {
            toast.error(`Biometric import failed: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    const handleOverride = (employeeCode, employeeId) => {
        setOverrides(current => ({ ...current, [employeeCode]: employeeId }))
    }

    const handleImport = async () => {
        if (matchedRows.length === 0) {
            toast.warning('No matched attendance rows are ready to import.')
            return
        }

        setImporting(true)
        const importStats = { importedRows: 0, failedRows: 0 }
        const failed = []

        for (const row of matchedRows) {
            try {
                await attendanceService.upsertAttendance({
                    employee_id: row.employee.id,
                    date: row.date,
                    status: row.status,
                    check_in: row.check_in,
                    check_out: row.check_out,
                    remarks: `${row.remarks}${row.device ? ` from ${row.device}` : ''}`,
                    created_at: new Date().toISOString()
                })
                importStats.importedRows += 1
            } catch (error) {
                importStats.failedRows += 1
                failed.push(`${row.employeeCode} ${row.date}: ${error.message}`)
            }
        }

        setStats({
            totalPunches: punches.length,
            matchedRows: matchedRows.length,
            unmatchedRows: unmatchedRows.length,
            ...importStats
        })
        setErrors(current => [...current, ...failed])
        setImporting(false)

        if (importStats.failedRows > 0) {
            toast.error(`${importStats.failedRows} attendance row(s) failed. Review issue list.`)
        } else {
            toast.success(`${importStats.importedRows} attendance row(s) imported.`)
        }
    }

    const downloadTemplate = () => {
        downloadBlob(
            [
                'Employee Code,Employee Name,DateTime,Status,Device',
                'EMP001,Aarav Sharma,2026-05-26 09:05:00,In,Main Gate',
                'EMP001,Aarav Sharma,2026-05-26 18:12:00,Out,Main Gate'
            ].join('\n'),
            'biometric_import_template.csv'
        )
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                            <Fingerprint className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900">Biometric Import</h1>
                            <p className="text-sm text-slate-500">Upload ESSL or ZK punch CSVs and reconcile them into daily attendance.</p>
                        </div>
                    </div>
                    <button onClick={downloadTemplate} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">
                        <Download className="w-4 h-4" />
                        Template
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 mt-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Vendor Format</label>
                            <select
                                value={vendor}
                                onChange={(event) => setVendor(event.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-slate-400"
                            >
                                {vendorOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </div>
                        <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center hover:border-blue-400 hover:bg-blue-50/40 transition-colors">
                            <input type="file" accept=".csv,text/csv" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer" />
                            {loading ? <Loader2 className="w-10 h-10 mx-auto text-blue-600 animate-spin" /> : <FileUp className="w-10 h-10 mx-auto text-slate-400" />}
                            <p className="mt-3 text-sm font-black text-slate-800">{fileName || 'Upload punch CSV'}</p>
                            <p className="text-xs text-slate-500 mt-1">ESSL, ZK, or standard punch files</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <Stat label="Punches" value={stats.totalPunches || punches.length} />
                        <Stat label="Matched" value={matchedRows.length} tone="emerald" />
                        <Stat label="Unmatched" value={unmatchedRows.length} tone="amber" />
                        <Stat label="Imported" value={stats.importedRows} tone="blue" />
                        <Stat label="Failed" value={stats.failedRows} tone="rose" />
                    </div>
                </div>
            </div>

            {attendanceRows.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-black text-slate-900">Attendance Preview</h2>
                            <p className="text-sm text-slate-500">Rows are grouped by employee and date before import.</p>
                        </div>
                        <button
                            onClick={handleImport}
                            disabled={importing || matchedRows.length === 0}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-black hover:bg-blue-700 disabled:opacity-60"
                        >
                            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Import Matched Rows
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    {['Employee', 'Code', 'Date', 'Check In', 'Check Out', 'Punches', 'Status', 'Match'].map(header => (
                                        <th key={header} className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {attendanceRows.map(row => (
                                    <tr key={`${row.employeeCode}-${row.date}`} className="hover:bg-slate-50">
                                        <td className="px-5 py-3">
                                            <div className="font-bold text-slate-900">{row.employee ? `${row.employee.first_name} ${row.employee.last_name}` : row.employeeName || 'Unmatched'}</div>
                                            {!row.employee && (
                                                <select
                                                    value={overrides[row.employeeCode] || ''}
                                                    onChange={(event) => handleOverride(row.employeeCode, event.target.value)}
                                                    className="mt-2 w-56 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-bold text-slate-700"
                                                >
                                                    <option value="">Resolve employee</option>
                                                    {employees.map(employee => (
                                                        <option key={employee.id} value={employee.id}>{employee.employee_id} - {employee.first_name} {employee.last_name}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-slate-600">{row.employeeCode}</td>
                                        <td className="px-5 py-3 text-sm font-bold text-slate-700">{row.date}</td>
                                        <td className="px-5 py-3 text-sm text-slate-600">{row.check_in?.slice(11, 16) || '-'}</td>
                                        <td className="px-5 py-3 text-sm text-slate-600">{row.check_out?.slice(11, 16) || '-'}</td>
                                        <td className="px-5 py-3 text-sm text-slate-600">{row.punchCount}</td>
                                        <td className="px-5 py-3 text-sm font-bold text-slate-700">{row.status}</td>
                                        <td className="px-5 py-3">
                                            {row.employee ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Matched
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-black">
                                                    <AlertTriangle className="w-3.5 h-3.5" /> Review
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {errors.length > 0 && (
                <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <h2 className="font-black text-amber-900">Import Issues</h2>
                    </div>
                    <div className="p-5 space-y-2 max-h-64 overflow-y-auto">
                        {errors.map((error, index) => (
                            <p key={`${error}-${index}`} className="text-sm font-medium text-slate-700">{error}</p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

const Stat = ({ label, value, tone = 'slate' }) => {
    const tones = {
        slate: 'bg-slate-50 text-slate-900 border-slate-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        rose: 'bg-rose-50 text-rose-700 border-rose-100'
    }

    return (
        <div className={`rounded-xl border p-4 ${tones[tone]}`}>
            <p className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</p>
            <p className="mt-1 text-2xl font-black">{value}</p>
        </div>
    )
}
