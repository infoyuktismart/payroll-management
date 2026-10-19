import { Check, X } from 'lucide-react'

export default function RegularizationTab({
    regularizationRequests,
    onStatusChange
}) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
                <div className="p-6 border-b border-gray-50">
                    <h3 className="text-lg font-bold text-gray-800">Regularization Requests</h3>
                    <p className="text-xs text-gray-400 font-medium mt-1">Review and approve changes requested by employees for past attendance.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                {['Employee', 'Department', 'Date', 'Requested Status', 'Reason', 'Status', 'Actions'].map((h) => (
                                    <th key={h} className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {regularizationRequests.length > 0 ? (
                                regularizationRequests.map((req) => (
                                    <tr key={req.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-gray-700">
                                                {req.employee?.first_name} {req.employee?.last_name}
                                            </div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                                {req.employee?.employee_id || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {req.employee?.department || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {req.date}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-slate-800">{req.requested_status}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={req.reason}>
                                            {req.reason}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                                req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                req.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                                                'bg-amber-100 text-amber-700'
                                            }`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            {req.status === 'pending' ? (
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={() => onStatusChange(req.id, 'approved')}
                                                        className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center space-x-1 cursor-pointer"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>Approve</span>
                                                    </button>
                                                    <button
                                                        onClick={() => onStatusChange(req.id, 'rejected')}
                                                        className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center space-x-1 cursor-pointer"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                        <span>Reject</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic font-semibold">Reviewed by {req.reviewed_by || '-'}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="7" className="px-6 py-20 text-center text-sm font-medium text-gray-400 italic">
                                        No regularization requests found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
