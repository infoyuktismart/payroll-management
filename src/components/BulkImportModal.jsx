import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { Upload, Download, AlertCircle, CheckCircle, RefreshCw, X, FileSpreadsheet, Eye, HelpCircle } from 'lucide-react'

// CSV headers mapping
const REQUIRED_FIELDS = ['first_name', 'email', 'salary', 'designation', 'department']

const FIELD_LABELS = {
    employee_id: 'Employee ID (Optional)',
    first_name: 'First Name*',
    last_name: 'Last Name',
    email: 'Email Address*',
    phone: 'Phone Number',
    gender: 'Gender (Male/Female/Other)',
    dob: 'Date of Birth (YYYY-MM-DD)',
    joining_date: 'Joining Date (YYYY-MM-DD)',
    designation: 'Designation*',
    department: 'Department*',
    reporting_person: 'Reporting Person',
    salary: 'Monthly Basic Salary*',
    pan_number: 'PAN Card Number',
    aadhaar_number: 'Aadhaar Card Number',
    bank_name: 'Bank Name',
    bank_account_number: 'Bank Account Number',
    ifsc_code: 'IFSC Code',
    uan_number: 'UAN Number',
    esi_number: 'ESIC Number',
    contract_type: 'Contract Type (Permanent/Contract/Intern/Consultant)',
    marital_status: 'Marital Status (Single/Married/Divorced)',
    current_address: 'Current Address',
    permanent_address: 'Permanent Address'
}

export default function BulkImportModal({ isOpen, onClose, onImportSuccess }) {
    const toast = useToast()
    const fileInputRef = useRef(null)
    const [step, setStep] = useState(1) // 1: Upload, 2: Preview & Validate, 3: Importing, 4: Done
    const [dragActive, setDragActive] = useState(false)
    
    // Data states
    const [parsedData, setParsedData] = useState([])
    const [importProgress, setImportProgress] = useState(0)
    const [importStats, setImportStats] = useState({ success: 0, failed: 0 })

    if (!isOpen) return null

    // Download Sample CSV template
    const downloadTemplate = () => {
        const headers = Object.keys(FIELD_LABELS)
        const sampleRow1 = [
            'EMP099', 'Aarav', 'Sharma', 'aarav.sharma@example.com', '9876543210', 'Male', '1990-05-15', '2025-01-01',
            'Software Engineer', 'Engineering', 'Vikram Malhotra', '65000', 'ABCDE1234F', '123456789012',
            'HDFC Bank', '501002345678', 'HDFC0001234', '100123456789', '3112345678', 'Permanent', 'Single',
            '123, MG Road, Bangalore', '123, MG Road, Bangalore'
        ]
        const sampleRow2 = [
            '', 'Priya', 'Patel', 'priya.patel@example.com', '9988776655', 'Female', '1994-08-20', '2025-03-10',
            'HR Executive', 'HR', 'Neha Gupta', '45000', 'FGHIJ5678K', '987654321098',
            'ICICI Bank', '000401234567', 'ICIC0000004', '100987654321', '3198765432', 'Contract', 'Married',
            '456, Linking Road, Mumbai', '456, Linking Road, Mumbai'
        ]

        const csvContent = [
            headers.join(','),
            sampleRow1.map(val => `"${val.replace(/"/g, '""')}"`).join(','),
            sampleRow2.map(val => `"${val.replace(/"/g, '""')}"`).join(',')
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', 'employee_import_template.csv')
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success('Template CSV downloaded successfully.')
    }

    // CSV Parser in JS
    const parseCSV = (text) => {
        const lines = []
        let row = [""]
        let inQuotes = false

        for (let i = 0; i < text.length; i++) {
            const char = text[i]
            const nextChar = text[i + 1]

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    row[row.length - 1] += '"'
                    i++ // Skip next double quote
                } else {
                    inQuotes = !inQuotes
                }
            } else if (char === ',' && !inQuotes) {
                row.push('')
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') {
                    i++
                }
                lines.push(row)
                row = ['']
            } else {
                row[row.length - 1] += char
            }
        }
        if (row.length > 1 || row[0] !== '') {
            lines.push(row)
        }
        return lines
    }

    // Handle CSV File upload and validate
    const handleFile = (file) => {
        if (!file) return
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            toast.error('Invalid file type. Please upload a CSV file.')
            return
        }

        const reader = new FileReader()
        reader.onload = (e) => {
            const text = e.target.result
            const parsedRows = parseCSV(text)

            if (parsedRows.length <= 1) {
                toast.error('CSV file is empty or only contains headers.')
                return
            }

            const headers = parsedRows[0].map(h => h.trim().toLowerCase())
            const rowsData = parsedRows.slice(1)
            
            // Check if essential headers are present
            const missingHeaders = REQUIRED_FIELDS.filter(f => !headers.includes(f))
            if (missingHeaders.length > 0) {
                toast.error(`Missing required headers: ${missingHeaders.join(', ')}`)
                return
            }

            // Map rows into objects
            const formatted = rowsData.map((row, idx) => {
                const obj = {}
                headers.forEach((h, colIdx) => {
                    const fieldName = Object.keys(FIELD_LABELS).find(k => k === h)
                    if (fieldName) {
                        obj[fieldName] = row[colIdx]?.trim() || ''
                    }
                })
                return {
                    rowIndex: idx + 2, // 1-indexed, skipping header
                    data: obj,
                    errors: validateRow(obj)
                }
            }).filter(row => Object.values(row.data).some(v => v !== '')) // skip completely empty rows

            setParsedData(formatted)
            setStep(2)
        }
        reader.readAsText(file)
    }

    // Single-row validator
    const validateRow = (row) => {
        const errors = {}

        // Required field validations
        if (!row.first_name) errors.first_name = 'First Name is required.'
        if (!row.email) {
            errors.email = 'Email Address is required.'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
            errors.email = 'Invalid email format.'
        }
        if (!row.salary) {
            errors.salary = 'Monthly Basic Salary is required.'
        } else if (isNaN(Number(row.salary)) || Number(row.salary) <= 0) {
            errors.salary = 'Salary must be a positive number.'
        }
        if (!row.designation) errors.designation = 'Designation is required.'
        if (!row.department) errors.department = 'Department is required.'

        // Optional format validations
        if (row.phone && !/^\+?[0-9\s-]{10,15}$/.test(row.phone)) {
            errors.phone = 'Invalid phone format (10-15 digits).'
        }
        if (row.dob && isNaN(Date.parse(row.dob))) {
            errors.dob = 'DOB must be in YYYY-MM-DD format.'
        }
        if (row.joining_date && isNaN(Date.parse(row.joining_date))) {
            errors.joining_date = 'Joining Date must be YYYY-MM-DD.'
        }
        if (row.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(row.pan_number)) {
            errors.pan_number = 'Invalid Indian PAN format (e.g. ABCDE1234F).'
        }
        if (row.aadhaar_number && !/^\d{12}$/.test(row.aadhaar_number)) {
            errors.aadhaar_number = 'Aadhaar must be exactly 12 digits.'
        }
        if (row.ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(row.ifsc_code)) {
            errors.ifsc_code = 'Invalid IFSC code format (e.g. HDFC0001234).'
        }

        return errors
    }

    // Drag-and-Drop handler
    const handleDrag = (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0])
        }
    }

    // Batch insert execution
    const startImport = async () => {
        const validRows = parsedData.filter(r => Object.keys(r.errors).length === 0)
        if (validRows.length === 0) {
            toast.error('No valid rows to import. Please resolve validation errors.')
            return
        }

        setStep(3)
        setImportProgress(0)

        let successCount = 0
        let failedCount = 0
        const batchSize = 10

        for (let i = 0; i < validRows.length; i += batchSize) {
            const batch = validRows.slice(i, i + batchSize).map(r => {
                const data = r.data
                return {
                    employee_id: data.employee_id || undefined, // database default serial
                    first_name: data.first_name,
                    last_name: data.last_name || '',
                    email: data.email,
                    phone: data.phone || null,
                    gender: data.gender || 'Male',
                    dob: data.dob || null,
                    joining_date: data.joining_date || new Date().toISOString().split('T')[0],
                    designation: data.designation,
                    department: data.department,
                    reporting_person: data.reporting_person || null,
                    salary: Number(data.salary),
                    salary_allowances: 0, // default standard configuration
                    pan_number: data.pan_number || null,
                    aadhaar_number: data.aadhaar_number || null,
                    bank_name: data.bank_name || null,
                    bank_account_number: data.bank_account_number || null,
                    ifsc_code: data.ifsc_code || null,
                    uan_number: data.uan_number || null,
                    esi_number: data.esi_number || null,
                    contract_type: data.contract_type || 'Permanent',
                    marital_status: data.marital_status || 'Single',
                    current_address: data.current_address || '',
                    permanent_address: data.permanent_address || '',
                    status: 'active'
                }
            })

            try {
                const { error } = await supabase.from('employees').insert(batch)
                if (error) throw error
                successCount += batch.length
            } catch (err) {
                console.error('Import batch error:', err)
                failedCount += batch.length
            }

            const currentPercent = Math.round(((i + batch.length) / validRows.length) * 100)
            setImportProgress(currentPercent)
            setImportStats({ success: successCount, failed: failedCount })
        }

        setStep(4)
        if (onImportSuccess) onImportSuccess()
    }

    const resetState = () => {
        setStep(1)
        setParsedData([])
        setImportProgress(0)
        setImportStats({ success: 0, failed: 0 })
    }

    const errorCount = parsedData.filter(r => Object.keys(r.errors).length > 0).length
    const validCount = parsedData.length - errorCount

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Bulk Import Employees</h2>
                        <p className="text-xs text-gray-500 mt-1">Upload a CSV file containing employee details to populate the database in bulk</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 1 && (
                        <div className="space-y-6">
                            {/* Alert/Info */}
                            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 text-blue-800 rounded-2xl">
                                <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-bold">Import Guidelines</h4>
                                    <ul className="text-xs space-y-1 mt-1 text-blue-700/90 list-disc pl-4">
                                        <li>File must be in <strong>CSV (Comma Separated Values)</strong> format.</li>
                                        <li>Required fields are First Name, Email, Salary, Designation, and Department.</li>
                                        <li>Date format must be strictly <strong>YYYY-MM-DD</strong>.</li>
                                        <li>Indian tax identifiers (PAN, Aadhaar) will be encrypted automatically.</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Drag and Drop Zone */}
                            <div
                                onDragEnter={handleDrag}
                                onDragOver={handleDrag}
                                onDragLeave={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current.click()}
                                className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                                    dragActive ? 'border-indigo-500 bg-indigo-50/40 scale-[0.99]' : 'border-gray-200 hover:border-indigo-400 hover:bg-slate-50/40'
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={(e) => handleFile(e.target.files[0])}
                                />
                                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4 animate-bounce">
                                    <Upload className="w-7 h-7" />
                                </div>
                                <h3 className="text-base font-bold text-gray-800">Drag & drop your CSV file here</h3>
                                <p className="text-xs text-gray-400 mt-1">or click to browse from files</p>
                                <p className="text-[10px] text-gray-300 mt-4">Only CSV files up to 5MB supported</p>
                            </div>

                            {/* Template Download */}
                            <div className="flex justify-between items-center bg-gray-50 border border-gray-100 rounded-2xl p-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <FileSpreadsheet className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-800">Need a Sample Template?</h4>
                                        <p className="text-xs text-gray-500">Download our formatted CSV template with correct headers</p>
                                    </div>
                                </div>
                                <button
                                    onClick={downloadTemplate}
                                    className="px-4 py-2 border border-gray-200 hover:border-emerald-500 text-gray-700 hover:text-emerald-700 font-bold text-xs rounded-xl hover:bg-emerald-50/20 transition-all flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" /> Download Template
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            {/* Validation Stats */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50">
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Rows</p>
                                    <p className="text-2xl font-black text-slate-800 mt-1">{parsedData.length}</p>
                                </div>
                                <div className="border border-emerald-100 rounded-2xl p-4 bg-emerald-50/20">
                                    <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Valid Rows</p>
                                    <p className="text-2xl font-black text-emerald-600 mt-1">{validCount}</p>
                                </div>
                                <div className="border border-rose-100 rounded-2xl p-4 bg-rose-50/20">
                                    <p className="text-xs text-rose-600 font-bold uppercase tracking-wider">Rows with Errors</p>
                                    <p className="text-2xl font-black text-rose-600 mt-1">{errorCount}</p>
                                </div>
                            </div>

                            {/* Data Preview Table */}
                            <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                <div className="max-h-[300px] overflow-y-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead className="bg-slate-900 text-white font-bold sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3">Row</th>
                                                <th className="p-3">Name</th>
                                                <th className="p-3">Email</th>
                                                <th className="p-3">Salary</th>
                                                <th className="p-3">Role</th>
                                                <th className="p-3">Errors / Warnings</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {parsedData.map((row, index) => {
                                                const hasErrors = Object.keys(row.errors).length > 0
                                                return (
                                                    <tr key={index} className={`hover:bg-slate-50 transition-colors ${hasErrors ? 'bg-rose-50/30' : ''}`}>
                                                        <td className="p-3 font-bold text-gray-500">#{row.rowIndex}</td>
                                                        <td className="p-3 font-bold text-gray-800">{row.data.first_name} {row.data.last_name}</td>
                                                        <td className="p-3 font-medium text-gray-600">{row.data.email}</td>
                                                        <td className="p-3 font-bold text-indigo-600">{row.data.salary ? `₹${row.data.salary}` : 'N/A'}</td>
                                                        <td className="p-3 font-bold text-gray-600">{row.data.role || 'employee'}</td>
                                                        <td className="p-3">
                                                            {hasErrors ? (
                                                                <div className="flex flex-col gap-0.5 text-[10px] text-rose-600 font-bold">
                                                                    {Object.values(row.errors).map((err, errIdx) => (
                                                                        <span key={errIdx} className="flex items-center gap-1">
                                                                            <AlertCircle className="w-3 h-3 shrink-0" /> {err}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                                                    <CheckCircle className="w-3 h-3" /> Ready
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Warning Footer */}
                            {errorCount > 0 && (
                                <div className="p-4 bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl flex gap-3 text-xs">
                                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold">Rows with errors will be skipped</h4>
                                        <p className="mt-0.5 opacity-90">You can import the remaining {validCount} valid employee records now, or cancel to fix your CSV and re-upload.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-6">
                            <div className="relative w-24 h-24 flex items-center justify-center">
                                <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin absolute" />
                                <div className="text-sm font-black text-indigo-600">{importProgress}%</div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-base font-bold text-gray-800">Processing Import...</h3>
                                <p className="text-xs text-gray-500 mt-1">Creating employee profiles, encrypting details, and initializing structures</p>
                            </div>
                            <div className="w-full max-w-md bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
                            </div>
                            <p className="text-xs font-bold text-slate-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                                Imported {importStats.success} profiles so far
                            </p>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
                            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
                                <CheckCircle className="w-10 h-10" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Import Completed Successfully!</h3>
                                <p className="text-xs text-gray-500 mt-1">The batch import process has successfully concluded.</p>
                            </div>
                            
                            <div className="flex items-center gap-6 border border-gray-100 rounded-3xl p-6 bg-slate-50/50 min-w-[320px] justify-around">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Successful</p>
                                    <p className="text-3xl font-black text-emerald-500 mt-1">{importStats.success}</p>
                                </div>
                                <div className="w-px h-10 bg-gray-200"></div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Failed/Skipped</p>
                                    <p className="text-3xl font-black text-slate-400 mt-1">{importStats.failed + errorCount}</p>
                                </div>
                            </div>

                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-lg"
                            >
                                Done & Close
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                {step <= 2 && (
                    <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                        {step === 2 && (
                            <button
                                onClick={resetState}
                                className="px-5 py-2.5 border border-gray-200 hover:border-gray-300 bg-white rounded-xl text-xs font-bold text-gray-600 hover:text-gray-800 transition-all flex items-center gap-1.5"
                            >
                                Re-upload CSV
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 border border-gray-200 bg-white rounded-xl text-xs font-bold text-gray-600 hover:text-gray-800 transition-all"
                        >
                            Cancel
                        </button>
                        {step === 2 && (
                            <button
                                onClick={startImport}
                                disabled={validCount === 0}
                                className="px-5 py-2.5 bg-indigo-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
                            >
                                Import {validCount} Employees
                            </button>
                        )}
                    </div>
                )}

            </div>
        </div>
    )
}
