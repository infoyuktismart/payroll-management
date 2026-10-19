import { XCircle, Upload, Loader2, FileText, Image as ImageIcon, CheckCircle2, HelpCircle } from 'lucide-react'

const CLAIM_TYPES = ['Travel', 'Medical', 'Food', 'Internet', 'Others']

export default function ReimbursementClaimModal({
    isOpen = false,
    onClose,
    activeEmployees = [],
    claimForm,
    setClaimForm,
    onSubmit,
    submitting = false,
    uploadingFile = false,
    uploadedFileName = null,
    uploadError = null,
    activeReceiptTab = 'upload',
    setActiveReceiptTab,
    onFileUpload,
    onRemoveFile
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">File Reimbursement Claim</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Submit business expense claims for administrative review</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-150 rounded-full transition-colors cursor-pointer" aria-label="Close modal">
                        <XCircle className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="reimbursements-employee-select" className="block text-xs font-bold text-gray-700 mb-1.5">Select Employee*</label>
                        <select
                            id="reimbursements-employee-select"
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
                            <label htmlFor="reimbursements-claim-type" className="block text-xs font-bold text-gray-700 mb-1.5">Claim Type</label>
                            <select
                                id="reimbursements-claim-type"
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
                            <label htmlFor="reimbursements-claim-amount" className="block text-xs font-bold text-gray-700 mb-1.5">Claim Amount (₹)*</label>
                            <input
                                id="reimbursements-claim-amount"
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
                        <label htmlFor="reimbursements-description" className="block text-xs font-bold text-gray-700 mb-1.5">Description / Purpose*</label>
                        <textarea
                            id="reimbursements-description"
                            required
                            value={claimForm.description}
                            onChange={(e) => setClaimForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Provide detailed description of the business expense..."
                            className="w-full text-xs border border-gray-200 rounded-xl p-3 bg-gray-50 min-h-20 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="block text-xs font-bold text-gray-700">Receipt Proof*</span>
                            <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50">
                                <button
                                    type="button"
                                    onClick={() => setActiveReceiptTab('upload')}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
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
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
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
                                            document.getElementById('receipt-upload-input').click()
                                        }}
                                        className="border-2 border-dashed border-gray-200 hover:border-indigo-400 rounded-2xl p-6 text-center cursor-pointer transition-all bg-gray-50 hover:bg-indigo-50/20 group flex flex-col items-center justify-center min-h-27.5"
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
                                            onChange={onFileUpload}
                                            className="hidden"
                                        />
                                    </div>
                                ) : uploadingFile ? (
                                    <div className="border border-gray-200 rounded-2xl p-6 text-center bg-gray-50 flex flex-col items-center justify-center min-h-27.5">
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
                                            onClick={onRemoveFile}
                                            className="p-1.5 hover:bg-emerald-100/50 rounded-lg text-emerald-600 hover:text-emerald-800 transition-colors shrink-0 font-bold text-xs cursor-pointer"
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
                                <label htmlFor="reimbursements-receipt-url" className="sr-only">Receipt URL</label>
                                <input
                                    id="reimbursements-receipt-url"
                                    type="url"
                                    value={claimForm.receipt_url}
                                    onChange={(e) => {
                                        setClaimForm(prev => ({ ...prev, receipt_url: e.target.value }))
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
                            onClick={onClose}
                            className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || uploadingFile}
                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {uploadingFile ? 'Uploading...' : 'File Claim'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
