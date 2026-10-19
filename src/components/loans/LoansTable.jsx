import { Search, Banknote, CheckCircle2, XCircle } from 'lucide-react'
import { TableSkeleton } from '../ui/SkeletonLoader'
import Pagination from '../Pagination'

export default function LoansTable({
  loading,
  filteredLoans,
  activeTab,
  setActiveTab,
  searchTerm,
  setSearchTerm,
  formatCurrency,
  isAdmin,
  submitting,
  handleLoanAction,
  page,
  totalPages,
  count,
  setPage,
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/40">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {['all', 'pending', 'active', 'closed', 'rejected'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-[15px] font-semibold transition-all capitalize ${
                activeTab === tab
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:text-slate-900 border border-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <label htmlFor="loans-search-input" className="sr-only">
            Search loans
          </label>
          <input
            id="loans-search-input"
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
            <TableSkeleton rows={5} cols={7} />
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <Banknote className="w-12 h-12 text-gray-300 mb-3" />
            <h3 className="text-base font-bold text-gray-700">No loan records found</h3>
            <p className="text-xs text-gray-600 mt-1">
              There are no loan requests matching the selected category.
            </p>
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
                      {loan.employee?.first_name?.[0]}
                      {loan.employee?.last_name?.[0]}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">
                        {loan.employee?.first_name} {loan.employee?.last_name}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {loan.employee?.employee_id} &bull; {loan.employee?.department}
                      </p>
                    </div>
                  </td>
                  <td className="p-4 font-bold text-gray-700">{loan.loan_type}</td>
                  <td className="p-4 font-black text-gray-900">{formatCurrency(loan.amount)}</td>
                  <td className="p-4">
                    <p className="font-bold text-slate-700">{loan.tenure_months} Months</p>
                    <p className="text-[10px] text-gray-600">
                      {formatCurrency(loan.emi_amount)} / month
                    </p>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        loan.status === 'active'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          : loan.status === 'pending'
                            ? 'bg-amber-50 text-amber-600 border border-amber-100'
                            : loan.status === 'closed'
                              ? 'bg-gray-50 text-gray-600 border border-gray-100'
                              : 'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}
                    >
                      {loan.status}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-gray-500">{loan.disbursement_date || '-'}</td>
                  {isAdmin && (
                    <td className="p-4 text-right">
                      {loan.status === 'pending' && (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleLoanAction(loan.id, 'active')}
                            disabled={submitting}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors"
                            title="Approve & Disburse"
                            aria-label="Approve and disburse loan"
                          >
                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => handleLoanAction(loan.id, 'rejected')}
                            disabled={submitting}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                            title="Reject Application"
                            aria-label="Reject loan request"
                          >
                            <XCircle className="w-4 h-4" aria-hidden="true" />
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

      {filteredLoans.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200">
          <div className="text-sm text-gray-500 font-medium">
            Showing <span className="font-medium">{page * 50 + 1}</span> to{' '}
            <span className="font-medium">{Math.min((page + 1) * 50, count)}</span> of{' '}
            <span className="font-medium">{count}</span> results
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}
