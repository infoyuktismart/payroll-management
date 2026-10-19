import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { logger } from '../lib/devLogger'
import { useEmployees } from '../hooks/useEmployees'
import { useReimbursements, useCreateReimbursement, useUpdateReimbursementStatus } from '../hooks/useReimbursementsData'
import { reimbursementService } from '../services/reimbursementService'
import { sanitizeFormData } from '../lib/formUtils'

// Subcomponents
import ReimbursementStats from '../components/reimbursements/ReimbursementStats'
import ReimbursementsTable from '../components/reimbursements/ReimbursementsTable'
import ReimbursementClaimModal from '../components/reimbursements/ReimbursementClaimModal'

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
            await updateClaimMutation.mutateAsync({
                id: claimId,
                status: nextStatus
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

            const uploadResult = await reimbursementService.uploadReceipt({
                employeeId: claimForm.employee_id,
                file
            })

            setClaimForm(prev => ({ ...prev, receipt_url: uploadResult.publicUrl }))
            setUploadedFileName(uploadResult.fileName)
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
                        className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" /> New Claim
                    </button>
                )}
            </div>

            {/* Quick Stats */}
            <ReimbursementStats
                pendingCount={pendingCount}
                approvedCount={approvedCount}
                totalApprovedAmount={totalApprovedAmount}
                formatCurrency={formatCurrency}
            />

            {/* Claims Table Section */}
            <ReimbursementsTable
                claims={filteredClaims}
                loading={loading}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                isAdmin={isAdmin}
                submitting={submitting}
                onClaimAction={handleClaimAction}
                formatCurrency={formatCurrency}
                page={page}
                totalPages={totalPages}
                count={count}
                onPageChange={setPage}
            />

            {/* New Claim Modal */}
            <ReimbursementClaimModal
                isOpen={showClaimModal}
                onClose={closeClaimModal}
                activeEmployees={activeEmployees}
                claimForm={claimForm}
                setClaimForm={setClaimForm}
                onSubmit={handleCreateClaim}
                submitting={submitting}
                uploadingFile={uploadingFile}
                uploadedFileName={uploadedFileName}
                uploadError={uploadError}
                activeReceiptTab={activeReceiptTab}
                setActiveReceiptTab={setActiveReceiptTab}
                onFileUpload={handleFileUpload}
                onRemoveFile={handleRemoveUploadedFile}
            />
        </div>
    )
}
