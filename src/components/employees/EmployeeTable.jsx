import { Edit, Trash2, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { EmployeeRowSkeleton } from '../ui/SkeletonLoader'

export default function EmployeeTable({
    loading,
    currentEmployees,
    filteredEmployees,
    currentPage,
    setCurrentPage,
    employeesPerPage,
    isAdmin,
    startEditing,
    handleDeleteClick,
    toggleStatus,
    getProbationInfo,
    isProbationActionable,
    openExtendProbation,
    handleConfirmEmployee,
    probationActionLoading
}) {
    const totalPages = Math.ceil(filteredEmployees.length / employeesPerPage)
    const indexOfLastEmployee = currentPage * employeesPerPage
    const indexOfFirstEmployee = indexOfLastEmployee - employeesPerPage

    return (
        <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                            {isAdmin && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <>
                                <EmployeeRowSkeleton />
                                <EmployeeRowSkeleton />
                                <EmployeeRowSkeleton />
                                <EmployeeRowSkeleton />
                                <EmployeeRowSkeleton />
                            </>
                        ) : filteredEmployees.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="text-center py-12">
                                    <div className="flex flex-col items-center">
                                        <Users className="w-12 h-12 text-gray-300 mb-3" />
                                        <p className="text-gray-500 font-medium">No employees found</p>
                                        <p className="text-gray-400 text-sm">Try adjusting your search criteria</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            currentEmployees.map((emp) => (
                                <tr key={emp.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{emp.employee_id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 shrink-0">
                                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                                    {emp.profile_photo_url ? (
                                                        <img src={emp.profile_photo_url} alt={`${emp.first_name} ${emp.last_name}`} className="h-10 w-10 rounded-full object-cover" />
                                                    ) : (
                                                        <>{emp.first_name?.[0] || ''}{emp.last_name?.[0] || ''}</>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</div>
                                                <div className="text-sm text-gray-500">{emp.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex flex-col gap-1">
                                            <span>{emp.designation}</span>
                                            {(() => {
                                                const probation = getProbationInfo(emp)

                                                if (!emp.probation_period || !emp.joining_date || probation.months === 0 || emp.probation_status === 'confirmed') return null;

                                                if (!probation.active) {
                                                    return <span className="inline-flex w-max items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">Confirmed</span>;
                                                }

                                                if (probation.daysLeft <= 30) {
                                                    return <span className="inline-flex w-max items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 animate-pulse">Probation ends in {probation.daysLeft} days</span>;
                                                }

                                                return <span className="inline-flex w-max items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">On Probation ({probation.daysLeft} days left)</span>;
                                            })()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.department}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.phone}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${emp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {emp.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.joining_date}</td>
                                    {isAdmin && (
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => startEditing(emp)}
                                                className="text-blue-600 hover:text-blue-900 mr-4 cursor-pointer"
                                                title="Edit"
                                                aria-label="Edit employee"
                                            >
                                                <Edit className="h-4 w-4 inline" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(emp)}
                                                className="text-red-600 hover:text-red-900 mr-4 cursor-pointer"
                                                title="Delete"
                                                aria-label="Delete employee"
                                            >
                                                <Trash2 className="h-4 w-4 inline" />
                                            </button>
                                            <button
                                                onClick={() => toggleStatus(emp)}
                                                className={`cursor-pointer ${emp.status === 'active' ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}`}
                                                title={emp.status === 'active' ? 'Mark Inactive' : 'Mark Active'}
                                            >
                                                {emp.status === 'active' ? 'Deactivate' : 'Activate'}
                                            </button>
                                            {isProbationActionable(emp) && (
                                                <div className="mt-3 flex justify-end gap-3">
                                                    <button
                                                        onClick={() => openExtendProbation(emp)}
                                                        className="text-amber-600 hover:text-amber-900 cursor-pointer"
                                                        title="Extend Probation"
                                                        disabled={probationActionLoading}
                                                    >
                                                        Extend Probation
                                                    </button>
                                                    <button
                                                        onClick={() => handleConfirmEmployee(emp)}
                                                        className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
                                                        title="Confirm Employee"
                                                        disabled={probationActionLoading}
                                                    >
                                                        Confirm Employee
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {filteredEmployees.length > 0 && (
                <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                        Showing <span className="font-semibold">{indexOfFirstEmployee + 1}</span> to{' '}
                        <span className="font-semibold">
                            {Math.min(indexOfLastEmployee, filteredEmployees.length)}
                        </span>{' '}
                        of <span className="font-semibold">{filteredEmployees.length}</span> entries
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-2 border border-gray-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                aria-label="Previous page"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-semibold text-slate-700">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="p-2 border border-gray-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                aria-label="Next page"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
