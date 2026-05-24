import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Receipt, FileText, Calendar, CheckCircle2, XCircle, Search, Plus, Loader2, Image as ImageIcon, ExternalLink, HelpCircle } from 'lucide-react'
import { TableSkeleton } from '../components/ui/SkeletonLoader'

const CLAIM_TYPES = ['Travel', 'Medical', 'Food', 'Internet', 'Others']

export default function Reimbursements() {
    const toast = useToast()
    const { isAdmin } = useAuth()
    const [claims, setClaims] = useState([])
    const [employees, setEmployees] = useState([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState('all') // 'all', 'pending', 'approved', 'rejected'
    const [searchTerm, setSearchTerm] = useState('')

    // Form State
    const [showClaimModal, setShowClaimModal] = useState(false)
    const [claimForm, setClaimForm] = useState({
        employee_id: '',
        claim_type: 'Travel',
        amount: '',
        description: '',
        receipt_url: ''
    })

    useEffect(() => {
        fetchInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fetchInitialData = async () => {
        try {
            setLoading(true)
            await Promise.all([
                fetchClaims(),
                fetchEmployees()
            ])
        } catch (error) {
            console.error('Error fetching reimbursements:', error)
            toast.error('Failed to load reimbursement claims.')
        } finally {
            setLoading(false)
        }
    }

    const fetchClaims = async () => {
        const { data, error } = await supabase
            .from('reimbursements')
            .select(`
                *,
                employee:employees!employee_id(first_name, last_name, employee_id, designation, department)
            `)
            .order('created_at', { ascending: false })

        if (error) throw error
        setClaims(data || [])
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

    const handleClaimAction = async (claimId, nextStatus) => {
        try {
            setSubmitting(true)
            const { data: { user } } = await supabase.auth.getUser()

            // Fetch current employee ID for the reviewer
            const { data: reviewer } = await supabase
                .from('employees')
                .select('id')
                .eq('user_id', user.id)
                .single()

            const updates = {
                status: nextStatus,
                approved_by: nextStatus === 'approved' ? (reviewer?.id || null) : null,
                approved_at: nextStatus === 'approved' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            }

            const { error } = await supabase
                .from('reimbursements')
                .update(updates)
                .eq('id', claimId)

            if (error) throw error
            toast.success(`Claim status marked as ${nextStatus}`)
            await fetchClaims()
        } catch (error) {
            console.error('Error updating claim:', error)
            toast.error('Failed to update claim status.')
        } finally {
            setSubmitting(false)
        }
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

            const { error } = await supabase
                .from('reimbursements')
                .insert([payload])

            if (error) throw error

            toast.success('Reimbursement claim submitted successfully.')
            setShowClaimModal(false)
            setClaimForm({
                employee_id: '',
                claim_type: 'Travel',
                amount: '',
                description: '',
                receipt_url: ''
            })
            await fetchClaims()
        } catch (error) {
            console.error('Error creating claim:', error)
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
                        <input
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
                            <p className="text-xs text-gray-400 mt-1">There are no claims filed matching this status filter.</p>
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
                                                <span className="text-gray-400 italic">No receipt attached</span>
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
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleClaimAction(claim.id, 'rejected')}
                                                            disabled={submitting}
                                                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                                                            title="Reject Claim"
                                                        >
                                                            <XCircle className="w-4 h-4" />
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
                            <button onClick={() => setShowClaimModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <XCircle className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateClaim} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Select Employee*</label>
                                <select
                                    required
                                    value={claimForm.employee_id}
                                    onChange={(e) => setClaimForm(prev => ({ ...prev, employee_id: e.target.value }))}
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
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Claim Type</label>
                                    <select
                                        value={claimForm.claim_type}
                                        onChange={(e) => setClaimForm(prev => ({ ...prev, claim_type: e.target.value }))}
                                        className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5"
                                    >
                                        {CLAIM_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Claim Amount (₹)*</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={claimForm.amount}
                                        onChange={(e) => setClaimForm(prev => ({ ...prev, amount: e.target.value }))}
                                        placeholder="e.g. 2400"
                                        className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5 font-bold"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Description / Purpose*</label>
                                <textarea
                                    required
                                    value={claimForm.description}
                                    onChange={(e) => setClaimForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Provide detailed description of the business expense..."
                                    className="w-full text-xs border border-gray-200 rounded-xl p-3 bg-gray-50 min-h-[80px]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Receipt Link / URL</label>
                                <input
                                    type="url"
                                    value={claimForm.receipt_url}
                                    onChange={(e) => setClaimForm(prev => ({ ...prev, receipt_url: e.target.value }))}
                                    placeholder="e.g. https://storage.supabase.co/reimbursements/rec.pdf"
                                    className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5 font-semibold text-blue-600"
                                />
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
                                    onClick={() => setShowClaimModal(false)}
                                    className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                                >
                                    File Claim
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
