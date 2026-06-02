import { useState, useEffect } from 'react'
import { Upload, FileText, Image as ImageIcon, Eye, Download, Trash2, X, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { generateForm16PDF } from '../../lib/form16Generator'
import { getIndianFinancialYear } from '../../lib/taxUtils'
import { applyCompanyFilter, withCompanyScope } from '../../services/tenantScope'

const formatDateSafe = (value, options = { month: 'short', day: '2-digit', year: 'numeric' }, fallback = 'N/A') => {
    if (!value) return fallback
    const d = new Date(value)
    return isNaN(d.getTime()) ? fallback : d.toLocaleDateString('en-US', options)
}

export default function PortalDocumentsTab({
    currentEmployee,
    viewAsId,
    toast
}) {
    const [documentCategory, setDocumentCategory] = useState('tax') // 'tax', 'company', 'personal'
    const [documents, setDocuments] = useState([])
    const [documentsTotal, setDocumentsTotal] = useState(0)
    const [docCurrentPage, setDocCurrentPage] = useState(1)
    const [loading, setLoading] = useState(false) // eslint-disable-line no-unused-vars

    // Upload modal states
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [uploadCategory, setUploadCategory] = useState('')
    const [stagedFiles, setStagedFiles] = useState([])
    const [isDragActive, setIsDragActive] = useState(false)
    const [uploadingDocument, setUploadingDocument] = useState(false)

    // Delete modal state
    const [documentToDelete, setDocumentToDelete] = useState(null)

    // Form 16 & HRA Rent receipt states
    const [hraExemption, setHraExemption] = useState(0)
    const [hasRentReceipt, setHasRentReceipt] = useState(false)
    const [generatingForm16, setGeneratingForm16] = useState(false)

    // LTA States
    const [ltaClaims, setLtaClaims] = useState([])
    const [submittingLta, setSubmittingLta] = useState(false)
    const [ltaForm, setLtaForm] = useState({
        amount: '',
        year: getIndianFinancialYear()
    })

    const fetchLtaClaims = async () => {
        if (!viewAsId) return
        try {
            const { data } = await applyCompanyFilter(supabase.from('lta_claims').select('*')).eq('employee_id', viewAsId).order('created_at', { ascending: false })
            setLtaClaims(data || [])
        } catch (err) {
            console.error('Error fetching LTA claims:', err)
        }
    }

    const handleSubmitLtaClaim = async (e) => {
        e.preventDefault()
        if (!viewAsId || !ltaForm.amount || Number(ltaForm.amount) <= 0) {
            toast.warning('Please enter a valid claimed amount.')
            return
        }
        setSubmittingLta(true)
        try {
            const { error } = await supabase.from('lta_claims').insert([withCompanyScope({
                employee_id: viewAsId,
                financial_year: ltaForm.year,
                amount_claimed: parseFloat(ltaForm.amount),
                status: 'pending'
            })])
            if (error) throw error
            toast.success('LTA travel claim submitted for exemption!')
            setLtaForm({ amount: '', year: getIndianFinancialYear() })
            await fetchLtaClaims()
        } catch (err) {
            toast.error('Failed to submit claim: ' + err.message)
        } finally {
            setSubmittingLta(false)
        }
    }

    useEffect(() => {
        fetchLtaClaims()
    }, [viewAsId])

    useEffect(() => {
        const checkHraAndReceipts = async () => {
            if (!viewAsId) return
            const fy = getIndianFinancialYear()
            try {
                // Fetch tax declarations
                const { data: decl } = await applyCompanyFilter(supabase
                    .from('tax_declarations')
                    .select('hra_exemption'))
                    .eq('employee_id', viewAsId)
                    .eq('financial_year', fy)
                    .maybeSingle()

                if (decl) {
                    setHraExemption(Number(decl.hra_exemption) || 0)
                } else {
                    setHraExemption(0)
                }

                // Check documents for category 'Rent Receipt'
                const { data: docs } = await applyCompanyFilter(supabase
                    .from('employee_documents')
                    .select('id'))
                    .eq('employee_id', viewAsId)
                    .eq('category', 'Rent Receipt')
                    .limit(1)

                setHasRentReceipt(docs && docs.length > 0)
            } catch (err) {
                console.error('Error fetching tax declaration for HRA validation:', err)
            }
        }
        checkHraAndReceipts()
    }, [viewAsId, documents])


    const fetchDocumentsPage = async (employeeId, page, section, fallbackEmployee = currentEmployee) => {
        if (!employeeId) return
        const start = (page - 1) * 4
        const end = start + 3
        setLoading(true)
        try {
            const { data, error, count } = await applyCompanyFilter(supabase
                .from('employee_documents')
                .select('*', { count: 'exact' }))
                .eq('employee_id', employeeId)
                .eq('section', section)
                .order('created_at', { ascending: false })
                .range(start, end)

            if (error) throw error
            setDocuments(data || [])
            setDocumentsTotal(count || 0)
        } catch {
            const fallbackDocs = []
            if (fallbackEmployee?.id_proof_url && section === 'personal') {
                fallbackDocs.push({
                    id: `id-${employeeId}`,
                    file_name: fallbackEmployee.id_proof_url.split('/').pop() || 'ID_Proof',
                    category: 'Identification',
                    section: 'personal',
                    status: 'verified',
                    uploaded_at: fallbackEmployee.updated_at || fallbackEmployee.created_at,
                    file_size_mb: null,
                    file_url: fallbackEmployee.id_proof_url
                })
            }
            if (fallbackEmployee?.address_proof_url && section === 'personal') {
                fallbackDocs.push({
                    id: `address-${employeeId}`,
                    file_name: fallbackEmployee.address_proof_url.split('/').pop() || 'Address_Proof',
                    category: 'Personal Record',
                    section: 'personal',
                    status: 'pending',
                    uploaded_at: fallbackEmployee.updated_at || fallbackEmployee.created_at,
                    file_size_mb: null,
                    file_url: fallbackEmployee.address_proof_url
                })
            }
            setDocuments(fallbackDocs)
            setDocumentsTotal(fallbackDocs.length)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (viewAsId) {
            fetchDocumentsPage(viewAsId, docCurrentPage, documentCategory)
        }
     
    }, [viewAsId, docCurrentPage, documentCategory])

    useEffect(() => {
        setDocCurrentPage(1)
    }, [documentCategory, viewAsId])

    const getDefaultCategoryBySection = (section) => {
        const map = {
            tax: 'Tax Form',
            company: 'Company Form',
            personal: 'Personal Record'
        }
        return map[section] || 'Personal Record'
    }

    const handleOpenUploadModal = () => {
        setUploadCategory(getDefaultCategoryBySection(documentCategory))
        setStagedFiles([])
        setShowUploadModal(true)
    }

    const handleStageFiles = (filesList) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png']
        const maxBytes = 10 * 1024 * 1024

        const incoming = Array.from(filesList || [])
        if (incoming.length === 0) return

        const newItems = []
        incoming.forEach((file) => {
            if (!allowedTypes.includes(file.type)) {
                toast.error(`${file.name}: only PDF, JPG, PNG allowed.`)
                return
            }
            if (file.size > maxBytes) {
                toast.error(`${file.name}: file exceeds 10MB limit.`)
                return
            }

            newItems.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                file,
                progress: 0,
                status: 'ready',
                error: ''
            })
        })

        if (newItems.length > 0) {
            setStagedFiles((prev) => [...prev, ...newItems])
        }
    }

    const handleRetryStagedFile = (fileId) => {
        setStagedFiles((prev) => prev.map((file) => (
            file.id === fileId ? { ...file, status: 'ready', progress: 0, error: '' } : file
        )))
    }

    const getFileVisual = (docOrFile) => {
        const mime = (docOrFile?.mime_type || docOrFile?.file?.type || '').toLowerCase()
        const name = (docOrFile?.file_name || docOrFile?.file?.name || '').toLowerCase()
        const isPdf = mime.includes('pdf') || name.endsWith('.pdf')
        const isImage = mime.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/.test(name)

        if (isPdf) {
            return {
                icon: FileText,
                wrapper: 'bg-rose-50 text-rose-600 border border-rose-100',
            }
        }

        if (isImage) {
            return {
                icon: ImageIcon,
                wrapper: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
            }
        }

        return {
            icon: FileText,
            wrapper: 'bg-blue-50 text-blue-600 border border-blue-100',
        }
    }

    const handleUploadDocumentBatch = async () => {
        if (!viewAsId || stagedFiles.length === 0 || !uploadCategory) return
        setUploadingDocument(true)

        const sectionToCategory = {
            tax: 'Tax Form',
            company: 'Company Form',
            personal: 'Personal Record'
        }
        const normalizedCategory = uploadCategory || sectionToCategory[documentCategory]
        const bucketName = 'employee-documents'
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

        let successCount = 0
        const queue = stagedFiles.filter((item) => item.status !== 'completed')
        for (const item of queue) {
            setStagedFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'uploading', progress: 20 } : f))
            await delay(120)
            setStagedFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, progress: 60 } : f))

            try {
                const safeFileName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
                const storagePath = `${viewAsId}/${Date.now()}_${safeFileName}`

                const { error: uploadError } = await supabase
                    .storage
                    .from(bucketName)
                    .upload(storagePath, item.file, {
                        contentType: item.file.type,
                        upsert: false
                    })

                if (uploadError) throw uploadError

                const { data: publicData } = supabase
                    .storage
                    .from(bucketName)
                    .getPublicUrl(storagePath)

                const payload = {
                    employee_id: viewAsId,
                    file_name: item.file.name,
                    category: normalizedCategory,
                    section: documentCategory,
                    status: 'pending',
                    file_size_mb: Number((item.file.size / (1024 * 1024)).toFixed(2)),
                    uploaded_at: new Date().toISOString(),
                    mime_type: item.file.type,
                    storage_path: storagePath,
                    file_url: publicData?.publicUrl || null
                }

                const { error } = await supabase
                    .from('employee_documents')
                    .insert(withCompanyScope(payload))
                    .select('*')
                    .single()

                if (error) throw error

                successCount += 1
                setStagedFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'completed', progress: 100 } : f))
            } catch (error) {
                setStagedFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'failed', error: error.message || 'Upload failed' } : f))
            }
        }

        setUploadingDocument(false)
        if (successCount > 0) {
            await fetchDocumentsPage(viewAsId, docCurrentPage, documentCategory)
            toast.success(`${successCount} document(s) uploaded successfully.`)
            setTimeout(() => {
                setShowUploadModal(false)
                setStagedFiles([])
            }, 700)
        } else {
            toast.error('No documents were uploaded.')
        }
    }

    const handleDeleteDocument = async () => {
        if (!documentToDelete?.id) return
        try {
            if (documentToDelete.storage_path) {
                await supabase.storage.from('employee-documents').remove([documentToDelete.storage_path])
            }
            const { error } = await applyCompanyFilter(supabase
                .from('employee_documents')
                .delete())
                .eq('id', documentToDelete.id)
            if (error) throw error
            await fetchDocumentsPage(viewAsId, docCurrentPage, documentCategory)
            toast.success('Document removed successfully.')
        } catch (error) {
            toast.error(error.message || 'Failed to remove document.')
        } finally {
            setDocumentToDelete(null)
        }
    }

    const handleViewDocument = async (doc) => {
        if (doc.file_url) {
            window.open(doc.file_url, '_blank', 'noopener,noreferrer')
            return
        }
        if (doc.storage_path) {
            const { data, error } = await supabase.storage.from('employee-documents').createSignedUrl(doc.storage_path, 120)
            if (!error && data?.signedUrl) {
                window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
                return
            }
        }
        toast.error('No file URL found for this document.')
    }

    const handleDownloadDocument = async (doc) => {
        let fileUrl = doc.file_url
        if (!fileUrl && doc.storage_path) {
            const { data, error } = await supabase
                .storage
                .from('employee-documents')
                .createSignedUrl(doc.storage_path, 120, { download: doc.file_name || 'document' })
            if (!error && data?.signedUrl) fileUrl = data.signedUrl
        }
        if (!fileUrl) {
            toast.error('No downloadable file found.')
            return
        }
        const link = document.createElement('a')
        link.href = fileUrl
        link.download = doc.file_name || 'document'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleDownloadForm16 = async () => {
        if (!viewAsId) return
        setGeneratingForm16(true)
        try {
            const fy = getIndianFinancialYear()
            
            // 1. Fetch employee details
            const { data: emp, error: empErr } = await applyCompanyFilter(supabase
                .from('employees')
                .select('*'))
                .eq('id', viewAsId)
                .single()
            if (empErr) throw empErr

            // 2. Fetch tax declaration
            const { data: declarations, error: declError } = await applyCompanyFilter(supabase
                .from('tax_declarations')
                .select('*'))
                .eq('employee_id', viewAsId)
                .eq('financial_year', fy)
            if (declError) throw declError
            const declaration = declarations?.find(d => d.status === 'approved') || declarations?.[0] || { regime: 'new' }

            // 3. Fetch payroll items / runs
            const fyStart = `${fy.split('-')[0]}-04-01`
            const fyEnd = `${Number(fy.split('-')[0]) + 1}-03-31`
            
            const { data: dbItems, error: itemsError } = await applyCompanyFilter(supabase
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
                `))
                .eq('employee_id', viewAsId)
                .eq('payroll_runs.status', 'Completed')
                .gte('payroll_runs.month_year', fyStart)
                .lte('payroll_runs.month_year', fyEnd)

            if (itemsError) throw itemsError
            if (!dbItems || dbItems.length === 0) {
                toast.warning(`No completed payroll records found for you in the financial year ${fy}. Form 16 requires completed payroll runs.`)
                setGeneratingForm16(false)
                return
            }

            // 4. Fetch company settings
            const { data: settings, error: settingsError } = await applyCompanyFilter(supabase
                .from('company_settings')
                .select('*'))
                .limit(1)
            
            if (settingsError) throw settingsError
            
            const companySettings = (settings && settings[0]) || {}

            // 5. Map db items to structure expected by generateForm16PDF
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
            
            generateForm16PDF({
                employee: mappedEmployee,
                company: mappedCompany,
                declaration,
                payrollRuns,
                financialYear: fy,
                download: true
            })
            
            toast.success('Form 16 generated successfully.')
        } catch (error) {
            console.error('Error generating Form 16:', error)
            toast.error('Failed to generate Form 16: ' + (error.message || 'Unknown error'))
        } finally {
            setGeneratingForm16(false)
        }
    }

    const documentsPerPage = 4
    const totalDocumentPages = Math.max(1, Math.ceil((documentsTotal || 0) / documentsPerPage))

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Documents</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Manage official records and employment documents</p>
                </div>
                <button
                    onClick={handleOpenUploadModal}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow"
                >
                    <Upload className="w-4 h-4" /> Upload Document
                </button>
            </div>

            <div className="inline-flex items-center space-x-1 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                {[
                    { key: 'tax', label: 'Tax Forms' },
                    { key: 'company', label: 'Company Forms' },
                    { key: 'personal', label: 'Personal Records' }
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setDocumentCategory(tab.key)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${documentCategory === tab.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-550 hover:bg-slate-50'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {documentCategory === 'tax' && (
                <div className="space-y-4">
                    {/* HRA Exemption Validation Warning */}
                    {hraExemption > 0 && !hasRentReceipt && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-xs font-bold text-amber-800">Rent Receipt Proof Required</h4>
                                <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                                    You have declared an HRA exemption of <span className="font-bold">₹{hraExemption.toLocaleString('en-IN')}</span> for the current financial year. Please upload your monthly rent receipts (category: "Rent Receipt") to validate your claim and avoid additional TDS deductions.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Form 16 Card */}
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-750 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-1">
                            <span className="bg-blue-600/25 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                Statutory Compliance
                            </span>
                            <h3 className="text-lg font-bold">Form 16 Tax Certificate</h3>
                            <p className="text-xs text-slate-300 max-w-lg leading-relaxed">
                                Download your digitally generated Form 16 (Part A & Part B) containing your salary breakdown, tax calculations, and TDS deductions for the current financial year.
                            </p>
                        </div>
                        <button
                            onClick={handleDownloadForm16}
                            disabled={generatingForm16}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs px-5 py-3 rounded-xl transition shadow shrink-0 flex items-center gap-2 self-start md:self-auto"
                        >
                            {generatingForm16 ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" /> Download Form 16 PDF
                                </>
                            )}
                        </button>
                    </div>

                    {/* LTA Travel claims and Tax exemption section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-250 p-6 shadow-sm space-y-4">
                            <h4 className="text-base font-bold text-slate-800">Leave Travel Allowance (LTA) Exemption Claims</h4>
                            <p className="text-xs text-gray-550">Statutory tax exemptions for domestic travel claims. Verify status and upload travel ticket bills below.</p>
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-gray-150 text-gray-500 font-bold uppercase tracking-wider">
                                        <th className="pb-2">Financial Year</th>
                                        <th className="pb-2">Amount Claimed</th>
                                        <th className="pb-2">Status</th>
                                        <th className="pb-2">Date Submitted</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ltaClaims.length > 0 ? (
                                        ltaClaims.map((claim) => (
                                            <tr key={claim.id} className="border-b border-gray-50 hover:bg-slate-50/20">
                                                <td className="py-3 font-bold text-slate-700">{claim.financial_year}</td>
                                                <td className="py-3 font-black text-slate-800">₹{Number(claim.amount_claimed).toLocaleString()}</td>
                                                <td className="py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                        claim.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                        claim.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                                                        'bg-amber-100 text-amber-700'
                                                    }`}>
                                                        {claim.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-gray-500 font-semibold">{new Date(claim.created_at).toLocaleDateString()}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="4" className="text-center py-6 text-gray-500 italic">No LTA claims submitted yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Submit LTA claim */}
                        <div className="bg-white rounded-2xl border border-gray-250 p-6 shadow-sm">
                            <h4 className="text-base font-bold text-slate-850 mb-3">Submit LTA Claim</h4>
                            <form onSubmit={handleSubmitLtaClaim} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">Financial Year</label>
                                    <select 
                                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 bg-white"
                                        value={ltaForm.year}
                                        onChange={(e) => setLtaForm({...ltaForm, year: e.target.value})}
                                    >
                                        <option value="2025-2026">2025-2026</option>
                                        <option value="2026-2027">2026-2027</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">Claimed Amount (INR)</label>
                                    <input 
                                        type="number"
                                        required
                                        placeholder="e.g. 25000"
                                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 bg-white"
                                        value={ltaForm.amount}
                                        onChange={(e) => setLtaForm({...ltaForm, amount: e.target.value})}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={submittingLta}
                                    className="w-full px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow transition-all disabled:opacity-50"
                                >
                                    {submittingLta ? 'Submitting...' : 'Submit Claim'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-gray-150">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider">Document Name</th>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider">Upload Date</th>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {documents.map((doc) => {
                                const status = (doc.status || 'pending').toLowerCase()
                                const statusClass = status === 'verified'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : status === 'expired'
                                        ? 'bg-rose-100 text-rose-700'
                                        : 'bg-amber-100 text-amber-700'
                                const uploadedDate = doc.uploaded_at || doc.created_at

                                return (
                                    <tr key={doc.id} className="hover:bg-slate-50/50 transition">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getFileVisual(doc).wrapper}`}>
                                                    {(() => {
                                                        const Icon = getFileVisual(doc).icon
                                                        return <Icon className="w-5 h-5" />
                                                    })()}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900">{doc.file_name || doc.name || 'Untitled document'}</p>
                                                    <p className="text-[10px] text-gray-600 mt-0.5">{doc.file_size_mb ? `${doc.file_size_mb} MB` : 'Size unavailable'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-medium text-gray-700">{doc.category || 'General'}</td>
                                        <td className="px-6 py-4 text-xs font-medium text-gray-700">
                                            {uploadedDate ? formatDateSafe(uploadedDate, { month: 'short', day: '2-digit', year: 'numeric' }) : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusClass}`}>{status}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2.5">
                                                <button onClick={() => handleViewDocument(doc)} className="text-gray-600 hover:text-blue-600 transition" aria-label="View document">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDownloadDocument(doc)} className="text-gray-600 hover:text-blue-600 transition" aria-label="Download document">
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setDocumentToDelete(doc)} className="text-gray-600 hover:text-rose-600 transition" aria-label="Delete document">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}

                            {documents.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-14 text-center">
                                        <p className="text-xs text-gray-600 italic">No documents found in this category.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-4 border-t border-gray-150 text-xs text-gray-600 flex items-center justify-between">
                    <span>Showing {documents.length} of {documentsTotal} document(s)</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setDocCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={docCurrentPage === 1}
                            className="px-3 py-1 rounded-lg border border-gray-250 text-[10px] font-bold text-gray-650 disabled:opacity-50 hover:bg-slate-50 transition"
                        >
                            Previous
                        </button>
                        <span className="px-2 py-1 text-xs font-bold text-blue-600">{docCurrentPage}</span>
                        <button
                            onClick={() => setDocCurrentPage((p) => Math.min(totalDocumentPages, p + 1))}
                            disabled={docCurrentPage >= totalDocumentPages}
                            className="px-3 py-1 rounded-lg border border-gray-255 text-[10px] font-bold text-gray-650 disabled:opacity-50 hover:bg-slate-50 transition"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Upload Document Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h2 className="text-base font-bold text-slate-800">Upload Document</h2>
                            <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">Document Category</label>
                                <select
                                    value={uploadCategory}
                                    onChange={(e) => setUploadCategory(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 bg-white"
                                >
                                    <option value="">Select category...</option>
                                    <option value="Tax Form">Tax Form</option>
                                    <option value="Company Form">Company Form</option>
                                    <option value="Personal Record">Personal Record</option>
                                    <option value="Rent Receipt">Rent Receipt</option>
                                    <option value="Contract">Contract</option>
                                    <option value="Education">Education</option>
                                    <option value="Identification">Identification</option>
                                </select>
                            </div>

                            <div
                                className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${isDragActive ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 bg-slate-50/50'}`}
                                onDragOver={(e) => {
                                    e.preventDefault()
                                    setIsDragActive(true)
                                }}
                                onDragLeave={() => setIsDragActive(false)}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    setIsDragActive(false)
                                    handleStageFiles(e.dataTransfer.files)
                                }}
                            >
                                <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                                    <Upload className="w-5 h-5" />
                                </div>
                                <p className="text-sm font-bold text-slate-800">Click to upload or drag and drop</p>
                                <p className="text-xs text-gray-600 mt-0.5">PDF, JPG, or PNG (max. 10MB)</p>
                                <label className="inline-flex mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer shadow">
                                    Select Files
                                    <input
                                        type="file"
                                        multiple
                                        className="hidden"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={(e) => {
                                            handleStageFiles(e.target.files)
                                            e.target.value = ''
                                        }}
                                    />
                                </label>
                            </div>

                            <div>
                                <h4 className="text-xs font-bold text-gray-450 uppercase tracking-wider mb-2.5">Selected Files</h4>
                                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                    {stagedFiles.map((item) => (
                                        <div key={item.id} className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex items-start gap-3">
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${getFileVisual(item).wrapper}`}>
                                                        {(() => {
                                                            const Icon = getFileVisual(item).icon
                                                            return <Icon className="w-4 h-4" />
                                                        })()}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-900 truncate">{item.file.name}</p>
                                                        <p className="text-[10px] text-gray-600 mt-0.5">{Number((item.file.size / (1024 * 1024)).toFixed(2))} MB</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {item.status === 'failed' && (
                                                        <button
                                                            onClick={() => handleRetryStagedFile(item.id)}
                                                            className="text-blue-600 hover:text-blue-700 text-xs font-bold"
                                                            disabled={uploadingDocument}
                                                        >
                                                            Retry
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setStagedFiles((prev) => prev.filter((f) => f.id !== item.id))}
                                                        className="text-rose-500 hover:text-rose-700 text-[10px] font-bold"
                                                        disabled={uploadingDocument}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-2.5 h-1.5 rounded-full bg-slate-50 border border-slate-100 overflow-hidden">
                                                <div
                                                    className={`${item.status === 'failed' ? 'bg-rose-500' : item.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-600'} h-full transition-all duration-300`}
                                                    style={{ width: `${item.progress}%` }}
                                                ></div>
                                            </div>
                                            <div className="mt-1.5 text-[9px] font-bold">
                                                {item.status === 'completed' && <span className="text-emerald-600">Completed</span>}
                                                {item.status === 'failed' && <span className="text-rose-600">{item.error || 'Upload failed'}</span>}
                                                {(item.status === 'uploading' || item.status === 'ready') && <span className="text-blue-600">{item.progress}%</span>}
                                            </div>
                                        </div>
                                    ))}
                                    {stagedFiles.length === 0 && (
                                        <p className="text-xs text-gray-600 italic text-center py-4">No files selected.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-150 flex justify-end gap-3 bg-gray-50/50">
                            <button
                                onClick={() => setShowUploadModal(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 bg-white border border-gray-250 transition"
                                disabled={uploadingDocument}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadDocumentBatch}
                                disabled={uploadingDocument || stagedFiles.length === 0 || !uploadCategory}
                                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow"
                            >
                                {uploadingDocument ? 'Uploading...' : 'Upload Document'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Document Confirmation */}
            {documentToDelete && (
                <div className="fixed inset-0 bg-black/35 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-sm font-bold text-slate-900">Delete document?</h3>
                        <p className="text-xs text-gray-500 mt-2">Are you sure you want to remove <span className="font-bold text-slate-800">{documentToDelete.file_name || 'this document'}</span>? This action cannot be undone.</p>
                        <div className="mt-5 flex justify-end gap-2.5">
                            <button onClick={() => setDocumentToDelete(null)} className="px-4 py-2 rounded-xl border border-gray-250 text-xs font-bold text-gray-600 hover:bg-gray-50 bg-white">Cancel</button>
                            <button onClick={handleDeleteDocument} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition shadow">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
