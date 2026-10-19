import { Receipt, Search, Image as ImageIcon, ExternalLink, CheckCircle2, XCircle } from 'lucide-react'
import { TableSkeleton } from '../ui/SkeletonLoader'
import Pagination from '../Pagination'

export default function ReimbursementsTable({
    claims = [],
    loading = false,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    isAdmin = false,
    submitting = false,
    onClaimAction,
    formatCurrency,
    page = 0,
    totalPages = 1,
    count = 0,
    onPageChange
}) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/40">
                {/* Status Tabs */}
                <div className="flex gap-1.5 flex-wrap">
                    {['all', 'pending', 'approved', 'rejected'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => {
                                setActiveTab(tab)
                                onPageChange(0) // reset page on filter change
                            }}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer ${
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
                    <label htmlFor="reimbursements-search-input" className="sr-only">Search claims</label>
                    <input
                        id="reimbursements-search-input"
                        type="text"
                        placeholder="Search employee or claim..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value)
                            onPageChange(0) // reset page on search
                        }}
                        className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs w-full bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                {loading ? (
                    <div className="p-10">
                        <TableSkeleton rows={5} cols={7} />
                    </div>
                ) : claims.length === 0 ? (
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
                            {claims.map((claim) => (
                                <tr key={claim.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
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
                                    <td className="p-4 font-medium text-gray-600 max-w-50 truncate" title={claim.description}>
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
                                                        onClick={() => onClaimAction(claim.id, 'approved')}
                                                        disabled={submitting}
                                                        className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors cursor-pointer"
                                                        title="Approve Claim"
                                                        aria-label="Approve claim"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                                                    </button>
                                                    <button
                                                        onClick={() => onClaimAction(claim.id, 'rejected')}
                                                        disabled={submitting}
                                                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
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

            {claims.length > 0 && (
                <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200">
                    <div className="text-xs text-gray-500 font-medium">
                        Showing <span className="font-semibold">{page * 50 + 1}</span> to <span className="font-semibold">{Math.min((page + 1) * 50, count)}</span> of <span className="font-semibold">{count}</span> results
                    </div>
                    <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
                </div>
            )}
        </div>
    )
}
