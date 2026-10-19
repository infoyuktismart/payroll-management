import { ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { TableRowSkeleton } from '../ui/SkeletonLoader'

export default function ExitsTable({
    exits = [],
    loading = false,
    employeeMap = {},
    onRowClick,
    getStatusColor
}) {
    return (
        <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-100 mt-6">
            <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/50">
                    <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Dates</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Reason</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                    {loading ? (
                        <>
                            <TableRowSkeleton cols={5} />
                            <TableRowSkeleton cols={5} />
                            <TableRowSkeleton cols={5} />
                            <TableRowSkeleton cols={5} />
                            <TableRowSkeleton cols={5} />
                        </>
                    ) : exits.length === 0 ? (
                        <tr>
                            <td colSpan="5" className="text-center py-12 text-gray-600 font-medium italic">
                                No exit records found
                            </td>
                        </tr>
                    ) : (
                        exits.map((record) => {
                            const emp = employeeMap[record.employee_id] || {}
                            return (
                                <tr
                                    key={record.id}
                                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                    onClick={() => onRowClick(record)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs mr-3">
                                                {emp.first_name?.[0]}{emp.last_name?.[0]}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-900">{emp.first_name} {emp.last_name}</div>
                                                <div className="text-xs text-gray-500">{emp.designation}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-xs text-gray-500">
                                            Resigned: {record.resignation_date ? format(new Date(record.resignation_date), 'MMM d, yyyy') : 'N/A'}
                                        </div>
                                        <div className="text-xs font-bold text-gray-700">
                                            LWD: {record.last_working_day ? format(new Date(record.last_working_day), 'MMM d, yyyy') : 'TBD'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-600 uppercase">
                                            {record.reason}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusColor(record.status)}`}>
                                            {record.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button className="text-slate-400 hover:text-slate-900 cursor-pointer">
                                            <ChevronRight className="h-5 w-5" />
                                        </button>
                                    </td>
                                </tr>
                            )
                        })
                    )}
                </tbody>
            </table>
        </div>
    )
}
