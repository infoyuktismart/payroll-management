import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { logger } from '../lib/devLogger'
import { Receipt, FileText, CheckCircle2, XCircle, Search, Plus, Loader2, Image as ImageIcon, ExternalLink, HelpCircle, Upload } from 'lucide-react'
import { TableSkeleton } from '../components/ui/SkeletonLoader'
import { useEmployees } from '../hooks/useEmployees'
import { useReimbursements, useCreateReimbursement, useUpdateReimbursementStatus } from '../hooks/useReimbursementsData'
import Pagination from '../components/Pagination'
import { sanitizeFormData } from '../lib/formUtils'

const CLAIM_TYPES = ['Travel', 'Medical', 'Food', 'Internet', 'Others']

export default function Reimbursements() {
    const toast = useToast()
    const { isAdmin } = useAuth()
    const [submitting, setSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState('all') // 'all', 'pending', 'approved', 'rejected'
    const [searchTerm, setSearchTerm] = useState('')
    const [page, setPage] = useState(0)

    // Form State
    const [showClaimModal, setShowClaimModal] = useState(false)
    const [claimForm, setClaimForm] = useState({
        employee_id: '',
        claim_type: 'Travel',
        amount: '',
        description: '',
        receipt_url: ''
    })

    // Upload Receipt state
    const [uploadingFile, setUploadingFile] = useState(false)
    const [uploadedFileName, setUploadedFileName] = useState(null)
    const [uploadError, setUploadError] = useState(null)
    const [activeReceiptTab, setActiveReceiptTab] = useState('upload') // 'upload' or 'link'

    // React Query Queries
    const { data: claimsResponse, isLoading: loadingClaims } = useReimbursements({ page, pageSize: 50 })
    const claims = useMemo(() => claimsResponse?.data || [], [claimsResponse])
    const totalPages = claimsResponse?.totalPages || 1
    const count = claimsResponse?.count || 0

    const { data: employeesResponse, isLoading: loadingEmployees } = useEmployees({ page: 0, pageSize: 1000 })
    const employees = useMemo(() => employeesResponse?.data || [], [employeesResponse])

    const loading = loadingClaims || loadingEmployees

    // React Query Mutations
    const createClaimMutation = useCreateReimbursement()
    const updateClaimMutation = useUpdateReimbursementStatus()

    // Filter active employees in memory
    const activeEmployees = useMemo(() => {
        return employees.filter(emp => emp.status?.toLowerCase() === 'active')
    }, [employees])

    const handleClaimAction = async (claimId, nextStatus) => {
        try {
            setSubmitting(true)
            const { data: { user } } = await supabase.auth.getUser()

            await updateClaimMutation.mutateAsync({
                id: claimId,
                status: nextStatus,
                reviewerUserId: user.id
            })

            toast.success(`Claim status marked as ${nextStatus}`)
        } catch (error) {
            logger.error('Error updating claim:', error)
            toast.error('Failed to update claim status.')
        } finally {
            setSubmitting(false)
        }
    }

    const closeClaimModal = () => {
        setShowClaimModal(false)
        setClaimForm({
            employee_id: '',
            claim_type: 'Travel',
            amount: '',
            description: '',
            receipt_url: ''
        })
        setUploadedFileName(null)
        setUploadError(null)
        setUploadingFile(false)
        setActiveReceiptTab('upload')
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        if (!claimForm.employee_id) {
            toast.warning('Please select an employee first before uploading a receipt.')
            e.target.value = ''
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size exceeds the 5MB limit.')
            e.target.value = ''
            return
        }

        try {
            setUploadingFile(true)
            setUploadError(null)

            const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const storagePath = `reimbursements/${claimForm.employee_id}/${Date.now()}_${safeFileName}`

            let uploadResult = await supabase
                .storage
                .from('employee-documents')
                .upload(storagePath, file, {
                    contentType: file.type,
                    upsert: false
                })

            if (uploadResult.error && (
                uploadResult.error.message?.toLowerCase().includes('bucket not found') ||
                uploadResult.error.message?.toLowerCase().includes('does not exist')
            )) {
                logger.info("Attempting to auto-create missing 'employee-documents' bucket...")
                const { error: createError } = await supabase.storage.createBucket('employee-documents', {
                    public: true
                })

                if (!createError) {
                    // Retry upload once
                    uploadResult = await supabase
                        .storage
                        .from('employee-documents')
                        .upload(storagePath, file, {
                            contentType: file.type,
                            upsert: false
                        })
                } else {
                    logger.error("Failed to auto-create storage bucket:", createError)
                }
            }

            if (uploadResult.error) throw uploadResult.error

            const { data: publicData } = supabase
                .storage
                .from('employee-documents')
                .getPublicUrl(storagePath)

            if (!publicData?.publicUrl) {
                throw new Error('Failed to retrieve file URL.')
            }

            setClaimForm(prev => ({ ...prev, receipt_url: publicData.publicUrl }))
            setUploadedFileName(file.name)
            toast.success('Receipt uploaded successfully.')
        } catch (error) {
            logger.error('Error uploading receipt:', error)
            setUploadError(error.message || 'Failed to upload receipt.')
            toast.error('Failed to upload receipt.')
        } finally {
            setUploadingFile(false)
            e.target.value = ''
        }
    }

    const handleRemoveUploadedFile = () => {
        setClaimForm(prev => ({ ...prev, receipt_url: '' }))
        setUploadedFileName(null)
        setUploadError(null)
    }

    const handleCreateClaim = async (e) => {
        e.preventDefault()
        const amount = Number(claimForm.amount)

        if (!claimForm.employee_id) {
            toast.warning('Please select an employee.')
            return
        }
        if (isNaN(amount) || amount <= 0) {
            toast.warning('Please enter a valid amount.')
            return
        }

        try {
            setSubmitting(true)
            const payload = {
                employee_id: claimForm.employee_id,
                claim_type: claimForm.claim_type,
                amount,
                description: claimForm.description,
                receipt_url: claimForm.receipt_url,
                status: 'pending'
            }

            await createClaimMutation.mutateAsync(sanitizeFormData(payload, ['receipt_url']))

            toast.success('Reimbursement claim submitted successfully.')
            closeClaimModal()
        } catch (error) {
            logger.error('Error creating claim:', error)
            toast.error('Failed to submit reimbursement claim.')
        } finally {
            setSubmitting(false)
        }
    }

    const filteredClaims = claims.filter(claim => {
        const name = `${claim.employee?.first_name || ''} ${claim.employee?.last_name || ''}`.toLowerCase()
        const empId = (claim.employee?.employee_id || '').toLowerCase()
        const type = claim.claim_type.toLowerCase()
        const matchesSearch = name.includes(searchTerm.toLowerCase()) || empId.includes(searchTerm.toLowerCase()) || type.includes(searchTerm.toLowerCase())
        
        if (activeTab === 'all') return matchesSearch
        return matchesSearch && claim.status === activeTab
    })

    // Calculate quick stats
    const pendingCount = claims.filter(c => c.status === 'pending').length
    const approvedCount = claims.filter(c => c.status === 'approved').length
    const totalApprovedAmount = claims.filter(c => c.status === 'approved').reduce((sum, c) => sum + Number(c.amount), 0)

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(val || 0)
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Reimbursement Claims</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Approve, reject, and monitor employee business expense reimbursement claims</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowClaimModal(true)}
                        className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> New Claim
                    </button>
                )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between border-l-[6px] border-l-amber-500">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Review</p>
                        <p className="text-3xl font-black text-slate-800 mt-1">{pendingCount}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <FileText className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between border-l-[6px] border-l-emerald-500">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Approved Claims</p>
                        <p className="text-3xl font-black text-slate-800 mt-1">{approvedCount}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between border-l-[6px] border-l-indigo-600">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Reimbursed</p>
                        <p className="text-3xl font-black text-slate-800 mt-1">{formatCurrency(totalApprovedAmount)}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Receipt className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Claims Table Section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/40">
                    {/* Status Tabs */}
                    <div className="flex gap-1.5">
                        {['all', 'pending', 'approved', 'rejected'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize ${
                                    activeTab === tab
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'bg-white text-gray-500 hover:text-slate-900 border border-gray-150'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <label htmlFor="auto-id-reimbursements-54" className="sr-only">Input field</label>
                        <input id="auto-id-reimbursements-54"
                            type="text"
                            placeholder="Search employee or claim..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs w-full bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-10">
                            <TableSkeleton rows={5} cols={6} />
                        </div>
                    ) : filteredClaims.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 text-center">
                            <Receipt className="w-12 h-12 text-gray-300 mb-3" />
                            <h3 className="text-base font-bold text-gray-700">No reimbursement records</h3>
                            <p className="text-xs text-gray-600 mt-1">There are no claims filed matching this status filter.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b border-gray-150 font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="p-4">Employee</th>
                                    <th className="p-4">Claim Type</th>
                                    <th className="p-4">Description</th>
                                    <th className="p-4">Amount</th>
                                    <th className="p-4">Receipt Proof</th>
                                    <th className="p-4">Status</th>
                                    {isAdmin && <th className="p-4 text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredClaims.map((claim) => (
                                    <tr key={claim.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                                {claim.employee?.first_name?.[0]}{claim.employee?.last_name?.[0]}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800">{claim.employee?.first_name} {claim.employee?.last_name}</p>
                                                <p className="text-[10px] text-gray-500">{claim.employee?.employee_id} &bull; {claim.employee?.department}</p>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                                claim.claim_type === 'Travel' ? 'bg-blue-50 text-blue-600' :
                                                claim.claim_type === 'Medical' ? 'bg-red-50 text-red-600' :
                                                claim.claim_type === 'Food' ? 'bg-orange-50 text-orange-600' :
                                                claim.claim_type === 'Internet' ? 'bg-violet-50 text-violet-600' :
                                                'bg-gray-50 text-gray-600'
                                            }`}>
                                                {claim.claim_type}
                                            </span>
                                        </td>
                                        <td className="p-4 font-medium text-gray-600 max-w-[200px] truncate" title={claim.description}>
                                            {claim.description || '-'}
                                        </td>
                                        <td className="p-4 font-black text-gray-900">
                                            {formatCurrency(claim.amount)}
                                        </td>
                                        <td className="p-4 font-bold text-gray-500">
                                            {claim.receipt_url ? (
                                                <a
                                                    href={claim.receipt_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline"
                                                >
                                                    <ImageIcon className="w-3.5 h-3.5" /> View Receipt <ExternalLink className="w-2.5 h-2.5" />
                                                </a>
                                            ) : (
                                                <span className="text-gray-600 italic">No receipt attached</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                                claim.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                claim.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                'bg-rose-50 text-rose-600 border border-rose-100'
                                            }`}>
                                                {claim.status}
                                            </span>
                                        </td>
                                        {isAdmin && (
                                            <td className="p-4 text-right">
                                                {claim.status === 'pending' && (
                                                    <div className="flex gap-2 justify-end">
                                                        <button
                                                            onClick={() => handleClaimAction(claim.id, 'approved')}
                                                            disabled={submitting}
                                                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors"
                                                            title="Approve Claim"
                                                            aria-label="Approve claim"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleClaimAction(claim.id, 'rejected')}
                                                            disabled={submitting}
                                                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                                                            title="Reject Claim"
                                                            aria-label="Reject claim"
                                                        >
                                                            <XCircle className="w-4 h-4" aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {filteredClaims.length > 0 && (
                    <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200">
                        <div className="text-sm text-gray-500 font-medium">
                            Showing <span className="font-medium">{page * 50 + 1}</span> to <span className="font-medium">{Math.min((page + 1) * 50, count)}</span> of <span className="font-medium">{count}</span> results
                        </div>
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    </div>
                )}
            </div>

            {/* New Claim Modal */}
            {showClaimModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">File Reimbursement Claim</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Submit business expense claims for administrative review</p>
                            </div>
                            <button onClick={closeClaimModal} className="p-2 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close modal">
                                <XCircle className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateClaim} className="p-6 space-y-4">
                            <div>
                                <label htmlFor="auto-id-reimbursements-55" className="block text-xs font-bold text-gray-700 mb-1.5">Select Employee*</label>
                                <select id="auto-id-reimbursements-55"
                                    required
                                    value={claimForm.employee_id}
                                    onChange={(e) => setClaimForm(prev => ({ ...prev, employee_id: e.target.value }))}
                                    className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-3 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                                >
                                    <option value="">Select Employee</option>
                                    {activeEmployees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.first_name} {emp.last_name} ({emp.employee_id})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="auto-id-reimbursements-56" className="block text-xs font-bold text-gray-700 mb-1.5">Claim Type</label>
                                    <select id="auto-id-reimbursements-56"
                                        value={claimForm.claim_type}
                                        onChange={(e) => setClaimForm(prev => ({ ...prev, claim_type: e.target.value }))}
                                        className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                                    >
                                        {CLAIM_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="auto-id-reimbursements-57" className="block text-xs font-bold text-gray-700 mb-1.5">Claim Amount (₹)*</label>
                                    <input id="auto-id-reimbursements-57"
                                        type="number"
                                        required
                                        min="1"
                                        value={claimForm.amount}
                                        onChange={(e) => setClaimForm(prev => ({ ...prev, amount: e.target.value }))}
                                        placeholder="e.g. 2400"
                                        className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5 font-bold focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="auto-id-reimbursements-textarea" className="block text-xs font-bold text-gray-700 mb-1.5">Description / Purpose*</label>
                                <textarea id="auto-id-reimbursements-textarea"
                                    required
                                    value={claimForm.description}
                                    onChange={(e) => setClaimForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Provide detailed description of the business expense..."
                                    className="w-full text-xs border border-gray-200 rounded-xl p-3 bg-gray-50 min-h-[80px] focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="block text-xs font-bold text-gray-700">Receipt Proof*</span>
                                    <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50">
                                        <button
                                            type="button"
                                            onClick={() => setActiveReceiptTab('upload')}
                                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                                                activeReceiptTab === 'upload'
                                                    ? 'bg-white text-indigo-600 shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-800'
                                            }`}
                                        >
                                            Upload File
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveReceiptTab('link')}
                                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                                                activeReceiptTab === 'link'
                                                    ? 'bg-white text-indigo-600 shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-800'
                                            }`}
                                        >
                                            Link URL
                                        </button>
                                    </div>
                                </div>

                                {activeReceiptTab === 'upload' ? (
                                    <div className="space-y-2">
                                        {!claimForm.receipt_url && !uploadingFile ? (
                                            <div
                                                onClick={() => {
                                                    if (!claimForm.employee_id) {
                                                        toast.warning('Please select an employee first before uploading a receipt.')
                                                    } else {
                                                        document.getElementById('receipt-upload-input').click()
                                                    }
                                                }}
                                                className="border-2 border-dashed border-gray-205 hover:border-indigo-400 rounded-2xl p-6 text-center cursor-pointer transition-all bg-gray-50 hover:bg-indigo-50/20 group flex flex-col items-center justify-center min-h-[110px]"
                                            >
                                                <Upload className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 group-hover:scale-110 transition-all mb-2" />
                                                <p className="text-xs font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">
                                                    Upload receipt image or PDF
                                                </p>
                                                <p className="text-[10px] text-gray-500 mt-1">
                                                    Click to browse (Max 5MB)
                                                </p>
                                                <input
                                                    type="file"
                                                    id="receipt-upload-input"
                                                    accept="image/*,application/pdf"
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                />
                                            </div>
                                        ) : uploadingFile ? (
                                            <div className="border border-gray-200 rounded-2xl p-6 text-center bg-gray-50 flex flex-col items-center justify-center min-h-[110px]">
                                                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
                                                <p className="text-xs font-bold text-indigo-600 animate-pulse">
                                                    Uploading receipt to storage...
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="border border-emerald-100 bg-emerald-50/50 rounded-2xl p-3 flex items-center justify-between animate-in fade-in duration-200">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-9 h-9 rounded-xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center shrink-0">
                                                        {uploadedFileName?.toLowerCase().endsWith('.pdf') ? (
                                                            <FileText className="w-4 h-4" />
                                                        ) : (
                                                            <ImageIcon className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-gray-800 truncate" title={uploadedFileName}>
                                                            {uploadedFileName || 'receipt_file'}
                                                        </p>
                                                        <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" /> Ready to submit
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveUploadedFile}
                                                    className="p-1.5 hover:bg-emerald-100/50 rounded-lg text-emerald-600 hover:text-emerald-800 transition-colors shrink-0 font-bold text-xs"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        )}
                                        {uploadError && (
                                            <p className="text-[10px] text-rose-600 font-bold mt-1">
                                                * Error: {uploadError}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <input
                                            type="url"
                                            value={claimForm.receipt_url}
                                            onChange={(e) => {
                                                setClaimForm(prev => ({ ...prev, receipt_url: e.target.value }))
                                                setUploadedFileName(null)
                                            }}
                                            placeholder="e.g. https://storage.supabase.co/reimbursements/rec.pdf"
                                            className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5 font-semibold text-blue-600 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 p-3.5 bg-blue-50 border border-blue-100 text-blue-800 rounded-2xl">
                                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                                <div className="text-[10px] leading-tight text-blue-700/90">
                                    <strong>Compensation Workflow:</strong> Approved reimbursements are automatically computed as non-taxable earnings and added directly to the employee's next payroll cycle.
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 bg-gray-50/50 -mx-6 -mb-6 p-6">
                                <button
                                    type="button"
                                    onClick={closeClaimModal}
                                    className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || uploadingFile}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploadingFile ? 'Uploading...' : 'File Claim'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
