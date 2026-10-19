import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useEmployees } from '../hooks/useEmployees'
import { useLoans, useCreateLoan, useUpdateLoanStatus } from '../hooks/useLoansData'
import { sanitizeFormData } from '../lib/formUtils'
import { logger } from '../lib/devLogger'

// Subcomponents
import LoansHeader from '../components/loans/LoansHeader'
import LoansStats from '../components/loans/LoansStats'
import LoansTable from '../components/loans/LoansTable'
import ApplyLoanModal from '../components/loans/ApplyLoanModal'

const LOAN_TYPES = ['Advance Salary', 'Home Loan', 'Personal Loan', 'Education Loan']

export default function Loans() {
    const toast = useToast()
    const { isAdmin } = useAuth()
    const [submitting, setSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState('all') // 'all', 'pending', 'active', 'closed'
    const [searchTerm, setSearchTerm] = useState('')
    const [page, setPage] = useState(0)

    // Loan Form State
    const [showApplyModal, setShowApplyModal] = useState(false)
    const [loanForm, setLoanForm] = useState({
        employee_id: '',
        loan_type: 'Advance Salary',
        amount: '',
        tenure_months: 6,
        remarks: ''
    })

    // React Query Queries
    const { data: loansResponse, isLoading: loadingLoans } = useLoans({ page, pageSize: 50 })
    const loans = useMemo(() => loansResponse?.data || [], [loansResponse])
    const totalPages = loansResponse?.totalPages || 1
    const count = loansResponse?.count || 0

    const { data: employeesResponse, isLoading: loadingEmployees } = useEmployees({ page: 0, pageSize: 1000 })
    const employees = useMemo(() => employeesResponse?.data || [], [employeesResponse])

    const loading = loadingLoans || loadingEmployees

    // React Query Mutations
    const createLoanMutation = useCreateLoan()
    const updateLoanMutation = useUpdateLoanStatus()

    // Filter active employees in memory
    const activeEmployees = useMemo(() => {
        return employees.filter(emp => emp.status?.toLowerCase() === 'active')
    }, [employees])

    const handleLoanAction = async (loanId, nextStatus) => {
        try {
            setSubmitting(true)
            await updateLoanMutation.mutateAsync({ id: loanId, status: nextStatus })
            toast.success(`Loan status updated to ${nextStatus}`)
        } catch (error) {
            logger.error('Error updating loan status:', error)
            toast.error('Failed to update loan status.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleCreateLoan = async (e) => {
        if (e) e.preventDefault()
        const amount = Number(loanForm.amount)
        const tenure = Number(loanForm.tenure_months)

        if (!loanForm.employee_id) {
            toast.warning('Please select an employee.')
            return
        }
        if (isNaN(amount) || amount <= 0) {
            toast.warning('Please enter a valid amount.')
            return
        }

        try {
            setSubmitting(true)
            const emi = Math.round(amount / tenure)
            const payload = {
                employee_id: loanForm.employee_id,
                loan_type: loanForm.loan_type,
                amount,
                tenure_months: tenure,
                emi_amount: emi,
                status: 'pending',
                remarks: loanForm.remarks
            }

            await createLoanMutation.mutateAsync(sanitizeFormData(payload))

            toast.success('Loan application submitted successfully.')
            setShowApplyModal(false)
            setLoanForm({
                employee_id: '',
                loan_type: 'Advance Salary',
                amount: '',
                tenure_months: 6,
                remarks: ''
            })
        } catch (error) {
            logger.error('Error submitting loan:', error)
            toast.error('Failed to submit loan application.')
        } finally {
            setSubmitting(false)
        }
    }

    const filteredLoans = useMemo(() => {
        return loans.filter(loan => {
            const name = `${loan.employee?.first_name || ''} ${loan.employee?.last_name || ''}`.toLowerCase()
            const empId = (loan.employee?.employee_id || '').toLowerCase()
            const type = loan.loan_type.toLowerCase()
            const matchesSearch = name.includes(searchTerm.toLowerCase()) || empId.includes(searchTerm.toLowerCase()) || type.includes(searchTerm.toLowerCase())
            
            if (activeTab === 'all') return matchesSearch
            return matchesSearch && loan.status === activeTab
        })
    }, [loans, searchTerm, activeTab])

    // Calculate quick stats
    const pendingCount = useMemo(() => loans.filter(l => l.status === 'pending').length, [loans])
    const activeCount = useMemo(() => loans.filter(l => l.status === 'active').length, [loans])
    const totalActiveAmount = useMemo(() => {
        return loans.filter(l => l.status === 'active').reduce((sum, l) => sum + Number(l.amount), 0)
    }, [loans])

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(val || 0)
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <LoansHeader
                isAdmin={isAdmin}
                onApplyClick={() => setShowApplyModal(true)}
            />

            <LoansStats
                pendingCount={pendingCount}
                activeCount={activeCount}
                totalActiveAmount={totalActiveAmount}
                formatCurrency={formatCurrency}
            />

            <LoansTable
                loading={loading}
                filteredLoans={filteredLoans}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                formatCurrency={formatCurrency}
                isAdmin={isAdmin}
                submitting={submitting}
                handleLoanAction={handleLoanAction}
                page={page}
                totalPages={totalPages}
                count={count}
                setPage={setPage}
            />

            <ApplyLoanModal
                isOpen={showApplyModal}
                onClose={() => setShowApplyModal(false)}
                activeEmployees={activeEmployees}
                loanForm={loanForm}
                setLoanForm={setLoanForm}
                formatCurrency={formatCurrency}
                submitting={submitting}
                onSubmit={handleCreateLoan}
                loanTypes={LOAN_TYPES}
            />
        </div>
    )
}
