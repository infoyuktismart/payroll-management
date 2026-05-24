import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { WalletCards, Banknote, Calendar, CheckCircle2, XCircle, Search, Plus, Loader2, Info, Landmark } from 'lucide-react'
import { TableSkeleton } from '../components/ui/SkeletonLoader'

const LOAN_TYPES = ['Advance Salary', 'Home Loan', 'Personal Loan', 'Education Loan']

export default function Loans() {
    const toast = useToast()
    const { isAdmin } = useAuth()
    const [loans, setLoans] = useState([])
    const [employees, setEmployees] = useState([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState('all') // 'all', 'pending', 'active', 'closed'
    const [searchTerm, setSearchTerm] = useState('')

    // Loan Form State
    const [showApplyModal, setShowApplyModal] = useState(false)
    const [loanForm, setLoanForm] = useState({
        employee_id: '',
        loan_type: 'Advance Salary',
        amount: '',
        tenure_months: 6,
        remarks: ''
    })

    useEffect(() => {
        fetchInitialData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fetchInitialData = async () => {
        try {
            setLoading(true)
            await Promise.all([
                fetchLoans(),
                fetchEmployees()
            ])
        } catch (error) {
            console.error('Error fetching loans data:', error)
            toast.error('Failed to load loans data.')
        } finally {
            setLoading(false)
        }
    }

    const fetchLoans = async () => {
        const { data, error } = await supabase
            .from('employee_loans')
            .select(`
                *,
                employee:employees(first_name, last_name, employee_id, designation, department)
            `)
            .order('created_at', { ascending: false })

        if (error) throw error
        setLoans(data || [])
    }

    const fetchEmployees = async () => {
        const { data, error } = await supabase
            .from('employees')
            .select('id, first_name, last_name, employee_id')
            .eq('status', 'active')
            .order('first_name')

        if (error) throw error
        setEmployees(data || [])
    }

    const handleLoanAction = async (loanId, nextStatus) => {
        try {
            setSubmitting(true)
            const updates = {
                status: nextStatus,
                updated_at: new Date().toISOString()
            }
            if (nextStatus === 'active') {
                updates.disbursement_date = new Date().toISOString().split('T')[0]
            }

            const { error } = await supabase
                .from('employee_loans')
                .update(updates)
                .eq('id', loanId)

            if (error) throw error
            toast.success(`Loan status updated to ${nextStatus}`)
            await fetchLoans()
        } catch (error) {
            console.error('Error updating loan status:', error)
            toast.error('Failed to update loan status.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleCreateLoan = async (e) => {
        e.preventDefault()
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

            const { error } = await supabase
                .from('employee_loans')
                .insert([payload])

            if (error) throw error

            toast.success('Loan application submitted successfully.')
            setShowApplyModal(false)
            setLoanForm({
                employee_id: '',
                loan_type: 'Advance Salary',
                amount: '',
                tenure_months: 6,
                remarks: ''
            })
            await fetchLoans()
        } catch (error) {
            console.error('Error submitting loan:', error)
            toast.error('Failed to submit loan application.')
        } finally {
            setSubmitting(false)
        }
    }

    const filteredLoans = loans.filter(loan => {
        const name = `${loan.employee?.first_name || ''} ${loan.employee?.last_name || ''}`.toLowerCase()
        const empId = (loan.employee?.employee_id || '').toLowerCase()
        const type = loan.loan_type.toLowerCase()
        const matchesSearch = name.includes(searchTerm.toLowerCase()) || empId.includes(searchTerm.toLowerCase()) || type.includes(searchTerm.toLowerCase())
        
        if (activeTab === 'all') return matchesSearch
        return matchesSearch && loan.status === activeTab
    })

    // Calculate quick stats
    const pendingCount = loans.filter(l => l.status === 'pending').length
    const activeCount = loans.filter(l => l.status === 'active').length
    const totalActiveAmount = loans.filter(l => l.status === 'active').reduce((sum, l) => sum + Number(l.amount), 0)

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
                    <h2 className="text-2xl font-bold text-gray-900">Loans & Salary Advances</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Manage interest-free salary advances, EMIs, and long-term employee loans</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowApplyModal(true)}
                        className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Apply for Loan
                    </button>
                )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between border-l-[6px] border-l-amber-500">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Requests</p>
                        <p className="text-3xl font-black text-slate-800 mt-1">{pendingCount}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <WalletCards className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between border-l-[6px] border-l-emerald-500">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Loans</p>
                        <p className="text-3xl font-black text-slate-800 mt-1">{activeCount}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between border-l-[6px] border-l-indigo-600">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Disbursed Balance</p>
                        <p className="text-3xl font-black text-slate-800 mt-1">{formatCurrency(totalActiveAmount)}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Landmark className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Controls Bar & Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/40">
                    {/* Status Tabs */}
                    <div className="flex gap-1.5">
                        {['all', 'pending', 'active', 'closed', 'rejected'].map(tab => (
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

                    {/* Search bar */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search employee or type..."
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
                    ) : filteredLoans.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 text-center">
                            <Banknote className="w-12 h-12 text-gray-300 mb-3" />
                            <h3 className="text-base font-bold text-gray-700">No loan records found</h3>
                            <p className="text-xs text-gray-400 mt-1">There are no loan requests matching the selected category.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b border-gray-150 font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="p-4">Employee</th>
                                    <th className="p-4">Loan Type</th>
                                    <th className="p-4">Principal Amount</th>
                                    <th className="p-4">Tenure & EMI</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Disbursed On</th>
                                    {isAdmin && <th className="p-4 text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredLoans.map((loan) => (
                                    <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                                {loan.employee?.first_name?.[0]}{loan.employee?.last_name?.[0]}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800">{loan.employee?.first_name} {loan.employee?.last_name}</p>
                                                <p className="text-[10px] text-gray-500">{loan.employee?.employee_id} &bull; {loan.employee?.department}</p>
                                            </div>
                                        </td>
                                        <td className="p-4 font-bold text-gray-700">
                                            {loan.loan_type}
                                        </td>
                                        <td className="p-4 font-black text-gray-900">
                                            {formatCurrency(loan.amount)}
                                        </td>
                                        <td className="p-4">
                                            <p className="font-bold text-slate-700">{loan.tenure_months} Months</p>
                                            <p className="text-[10px] text-gray-400">{formatCurrency(loan.emi_amount)} / month</p>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                                loan.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                loan.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                loan.status === 'closed' ? 'bg-gray-50 text-gray-600 border border-gray-100' :
                                                'bg-rose-50 text-rose-600 border border-rose-100'
                                            }`}>
                                                {loan.status}
                                            </span>
                                        </td>
                                        <td className="p-4 font-bold text-gray-500">
                                            {loan.disbursement_date || '-'}
                                        </td>
                                        {isAdmin && (
                                            <td className="p-4 text-right">
                                                {loan.status === 'pending' && (
                                                    <div className="flex gap-2 justify-end">
                                                        <button
                                                            onClick={() => handleLoanAction(loan.id, 'active')}
                                                            disabled={submitting}
                                                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors"
                                                            title="Approve & Disburse"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleLoanAction(loan.id, 'rejected')}
                                                            disabled={submitting}
                                                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                                                            title="Reject Application"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                                {loan.status === 'active' && (
                                                    <button
                                                        onClick={() => handleLoanAction(loan.id, 'closed')}
                                                        disabled={submitting}
                                                        className="px-3 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-bold text-[10px]"
                                                    >
                                                        Mark Closed
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Apply Loan Modal */}
            {showApplyModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Apply for Loan / Salary Advance</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Submit a loan setup or variable salary advance request</p>
                            </div>
                            <button onClick={() => setShowApplyModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <XCircle className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateLoan} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Select Employee*</label>
                                <select
                                    required
                                    value={loanForm.employee_id}
                                    onChange={(e) => setLoanForm(prev => ({ ...prev, employee_id: e.target.value }))}
                                    className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-3"
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.first_name} {emp.last_name} ({emp.employee_id})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Loan Type</label>
                                    <select
                                        value={loanForm.loan_type}
                                        onChange={(e) => setLoanForm(prev => ({ ...prev, loan_type: e.target.value }))}
                                        className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5"
                                    >
                                        {LOAN_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Tenure (Months)</label>
                                    <select
                                        value={loanForm.tenure_months}
                                        onChange={(e) => setLoanForm(prev => ({ ...prev, tenure_months: Number(e.target.value) }))}
                                        className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5 font-bold"
                                    >
                                        {[1, 2, 3, 6, 12, 18, 24, 36].map(m => (
                                            <option key={m} value={m}>{m} Months</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Principal Amount (₹)*</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={loanForm.amount}
                                    onChange={(e) => setLoanForm(prev => ({ ...prev, amount: e.target.value }))}
                                    placeholder="e.g. 50000"
                                    className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-3 font-bold"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Remarks / Reason</label>
                                <textarea
                                    value={loanForm.remarks}
                                    onChange={(e) => setLoanForm(prev => ({ ...prev, remarks: e.target.value }))}
                                    placeholder="Add background context or reasons..."
                                    className="w-full text-xs border border-gray-200 rounded-xl p-3 bg-gray-50 min-h-[60px]"
                                />
                            </div>

                            <div className="flex items-center gap-2 p-3.5 bg-blue-50 border border-blue-100 text-blue-800 rounded-2xl">
                                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                                <div className="text-[10px] leading-tight">
                                    <strong>EMI Calculation:</strong> Approving this loan will auto-calculate a monthly deduction of
                                    <span className="font-bold text-indigo-600"> {loanForm.amount ? formatCurrency(Math.round(Number(loanForm.amount) / loanForm.tenure_months)) : '₹0'} </span>
                                    applied directly during payroll processing runs.
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 bg-gray-50/50 -mx-6 -mb-6 p-6">
                                <button
                                    type="button"
                                    onClick={() => setShowApplyModal(false)}
                                    className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                                >
                                    Submit Application
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
