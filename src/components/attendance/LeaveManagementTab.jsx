import { Plus, Check, X } from 'lucide-react'
import { TableRowSkeleton } from '../ui/SkeletonLoader'

export default function LeaveManagementTab({
    loading,
    leaveApplications,
    isAdmin,
    onStatusChange,
    onApplyClick
}) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-50 mb-6">
                <h3 className="text-lg font-bold text-gray-800">Leave Applications</h3>
                <button
                    onClick={onApplyClick}
                    className="bg-black text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center space-x-2 hover:bg-gray-800 transition-colors cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    <span>Apply for Leave</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50">
                        <tr>
                            {['Employee', 'Leave Type', 'Duration', 'Applied Date', 'Status', 'Actions'].map((h) => (
                                <th key={h} className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <>
                                <TableRowSkeleton cols={6} />
                                <TableRowSkeleton cols={6} />
                                <TableRowSkeleton cols={6} />
                                <TableRowSkeleton cols={6} />
                                <TableRowSkeleton cols={6} />
                            </>
                        ) : leaveApplications.length > 0 ? (
                            leaveApplications.map((leave) => (
                                <tr key={leave.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-bold text-gray-700">{leave.employee?.first_name} {leave.employee?.last_name}</div>
                                        <div className="text-xs text-gray-400">{leave.employee?.department}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">{leave.leave_type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{leave.start_date} to {leave.end_date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(leave.created_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                            leave.status === 'approved' ? 'bg-green-100 text-green-700' :
                                            leave.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                            'bg-rose-100 text-rose-700'
                                        }`}>
                                            {leave.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 italic">
                                        {isAdmin && leave.status === 'pending' ? (
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => onStatusChange(leave.id, 'approved')}
                                                    className="p-1 rounded bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 transition-colors cursor-pointer"
                                                    title="Approve"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => onStatusChange(leave.id, 'rejected')}
                                                    className="p-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-colors cursor-pointer"
                                                    title="Reject"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <span>-</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className="px-6 py-20 text-center text-sm font-medium text-gray-400 italic">
                                    No leave applications found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
