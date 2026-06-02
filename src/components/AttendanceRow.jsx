import React from 'react'
import { Pencil } from 'lucide-react'

const AttendanceRow = React.memo(function AttendanceRow({ record, isAdmin, isHR, handleEditClick }) {
    return (
        <tr className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{record.employee?.employee_id || '-'}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-bold text-gray-700">{record.employee?.first_name} {record.employee?.last_name}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.employee?.department || '-'}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.date}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.check_in ? new Date(record.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) : '-'}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.check_out ? new Date(record.check_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) : '-'}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {record.check_in && record.check_out ? (() => {
                    const diff = new Date(record.check_out) - new Date(record.check_in);
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    return `${hours} hrs ${minutes} mins`;
                })() : '-'}
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${record.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                    record.status === 'absent' ? 'bg-rose-100 text-rose-700' :
                        record.status === 'half_day' ? 'bg-amber-100 text-amber-700' :
                            record.status === 'weekly_off' ? 'bg-slate-100 text-slate-700' :
                                'bg-amber-100 text-amber-700'
                    }`}>
                    {record.status}
                </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 italic">
                {record.remarks || '-'}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                {(isAdmin || isHR) && (
                    <button
                        onClick={() => handleEditClick(record)}
                        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                        title="Edit Attendance"
                        aria-label="Edit attendance"
                    >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                )}
            </td>
        </tr>
    )
})

export default AttendanceRow
