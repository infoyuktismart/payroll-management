import { Pencil } from 'lucide-react'
import { TableRowSkeleton } from '../ui/SkeletonLoader'

export default function AttendanceTable({
    dailyAttendance,
    loading,
    isAdmin,
    profileData,
    onEditClick
}) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">Attendance Records</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50">
                        <tr>
                            {['Employee ID', 'Employee', 'Department', 'Date', 'Check In', 'Check Out', 'Work Hours', 'Status', 'Remarks', 'Actions'].map((h) => (
                                <th key={h} className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <>
                                <TableRowSkeleton cols={10} />
                                <TableRowSkeleton cols={10} />
                                <TableRowSkeleton cols={10} />
                                <TableRowSkeleton cols={10} />
                                <TableRowSkeleton cols={10} />
                            </>
                        ) : dailyAttendance.length > 0 ? (
                            dailyAttendance.map((record) => (
                                <tr key={record.id || `${record.employee_id}-${record.date}`} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{record.employee?.employee_id || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-bold text-gray-700">{record.employee?.first_name} {record.employee?.last_name}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.employee?.department || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {record.check_in ? new Date(record.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {record.check_out ? new Date(record.check_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {record.check_in && record.check_out ? (() => {
                                            const diff = new Date(record.check_out) - new Date(record.check_in);
                                            const hours = Math.floor(diff / (1000 * 60 * 60));
                                            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                            return `${hours} hrs ${minutes} mins`;
                                        })() : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                            record.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                                            record.status === 'absent' ? 'bg-rose-100 text-rose-700' :
                                            record.status === 'half_day' ? 'bg-amber-100 text-amber-700' :
                                            record.status === 'weekly_off' ? 'bg-slate-100 text-slate-700' :
                                            'bg-amber-100 text-amber-700'
                                        }`}>
                                            {record.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 italic">
                                        {record.remarks || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {(isAdmin || profileData?.role === 'HR') && (
                                            <button
                                                onClick={() => onEditClick(record)}
                                                className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                                title="Edit Attendance"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="10" className="px-6 py-20 text-center text-sm font-medium text-gray-400 italic">
                                    No attendance records found for this date.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
