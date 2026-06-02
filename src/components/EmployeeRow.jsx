import React from 'react'
import { Edit, Trash2 } from 'lucide-react'

const EmployeeRow = React.memo(function EmployeeRow({ emp, isAdmin, startEditing, handleDeleteClick, toggleStatus }) {
    return (
        <tr className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{emp.employee_id}</td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                    <div className="h-10 w-10 shrink-0">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {emp.profile_photo_url ? (
                                <img src={emp.profile_photo_url} alt={`${emp.first_name} ${emp.last_name}`} className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                                <>{emp.first_name?.[0]}{emp.last_name?.[0]}</>
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
                        if (!emp.probation_period || !emp.joining_date || emp.probation_period === '0') return null;
                        
                        const joiningDate = new Date(emp.joining_date);
                        const probationMonths = parseInt(emp.probation_period, 10);
                        const probationEndDate = new Date(joiningDate.setMonth(joiningDate.getMonth() + probationMonths));
                        const today = new Date();
                        
                        if (today > probationEndDate) {
                            return <span className="inline-flex w-max items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">Confirmed</span>;
                        }
                        
                        const daysLeft = Math.ceil((probationEndDate - today) / (1000 * 60 * 60 * 24));
                        if (daysLeft <= 30) {
                            return <span className="inline-flex w-max items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 animate-pulse">Probation ends in {daysLeft} days</span>;
                        }
                        
                        return <span className="inline-flex w-max items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">On Probation ({daysLeft} days left)</span>;
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
                        <Edit className="h-4 w-4 inline" aria-hidden="true" />
                    </button>
                    <button
                        onClick={() => handleDeleteClick(emp)}
                        className="text-red-600 hover:text-red-900 mr-4 cursor-pointer"
                        title="Delete"
                        aria-label="Delete employee"
                    >
                        <Trash2 className="h-4 w-4 inline" aria-hidden="true" />
                    </button>
                    <button
                        onClick={() => toggleStatus(emp)}
                        className={`cursor-pointer ${emp.status === 'active' ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}`}
                        title={emp.status === 'active' ? 'Mark Inactive' : 'Mark Active'}
                    >
                        {emp.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                </td>
            )}
        </tr>
    )
})

export default EmployeeRow
