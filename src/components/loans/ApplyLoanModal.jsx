import { Info, XCircle } from 'lucide-react'

export default function ApplyLoanModal({
    isOpen,
    onClose,
    activeEmployees,
    loanForm,
    setLoanForm,
    formatCurrency,
    submitting,
    onSubmit,
    loanTypes
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Apply for Loan / Salary Advance</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Submit a loan setup or variable salary advance request</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close modal">
                        <XCircle className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="loans-select-employee" className="block text-xs font-bold text-gray-700 mb-1.5">Select Employee*</label>
                        <select id="loans-select-employee"
                            required
                            value={loanForm.employee_id}
                            onChange={(e) => setLoanForm(prev => ({ ...prev, employee_id: e.target.value }))}
                            className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-3"
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
                            <label htmlFor="loans-loan-type" className="block text-xs font-bold text-gray-700 mb-1.5">Loan Type</label>
                            <select id="loans-loan-type"
                                value={loanForm.loan_type}
                                onChange={(e) => setLoanForm(prev => ({ ...prev, loan_type: e.target.value }))}
                                className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5"
                            >
                                {loanTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="loans-tenure-months" className="block text-xs font-bold text-gray-700 mb-1.5">Tenure (Months)</label>
                            <select id="loans-tenure-months"
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
                        <label htmlFor="loans-principal-amount" className="block text-xs font-bold text-gray-700 mb-1.5">Principal Amount (₹)*</label>
                        <input id="loans-principal-amount"
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
                        <label htmlFor="loans-remarks" className="block text-xs font-bold text-gray-700 mb-1.5">Remarks / Reason</label>
                        <textarea
                            id="loans-remarks"
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
                            onClick={onClose}
                            className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-650 hover:bg-gray-50 transition-colors"
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
    )
}
