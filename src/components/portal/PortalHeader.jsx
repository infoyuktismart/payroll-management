import { FileText, Mail, MoreHorizontal } from 'lucide-react'
import EmployeeCombobox from './EmployeeCombobox'
import PortalNotificationsDropdown from './PortalNotificationsDropdown'

export default function PortalHeader({
    currentEmployee,
    isAdmin,
    employees = [],
    viewAsId,
    setViewAsId,
    unreadNotifications = [],
    onMarkNotificationAsRead,
    isMarkingRead,
    activeTab,
    setActiveTab,
    onEditProfile
}) {
    if (!currentEmployee) return null

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="h-24 bg-linear-to-r from-blue-600 to-blue-400 rounded-t-2xl"></div>
            <div className="px-6 pb-5 -mt-10">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="w-24 h-24 rounded-xl border-4 border-white shadow-md bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-700 overflow-hidden shrink-0">
                            {currentEmployee.profile_photo_url ? (
                                <img src={currentEmployee.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <>{currentEmployee.first_name?.[0] || ''}{currentEmployee.last_name?.[0] || ''}</>
                            )}
                        </div>
                        <div className="pt-12 lg:pt-10">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h2 className="text-3xl font-bold text-slate-900 leading-none">{currentEmployee.first_name} {currentEmployee.last_name}</h2>
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Active</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-2">
                                {currentEmployee.designation || 'Employee'} • Employee ID: #{currentEmployee.employee_id}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 self-end lg:self-auto lg:pt-10 shrink-0">
                        {isAdmin && employees.length > 0 && (
                            <EmployeeCombobox
                                employees={employees}
                                selectedId={viewAsId}
                                onChange={setViewAsId}
                            />
                        )}

                        <PortalNotificationsDropdown
                            unreadNotifications={unreadNotifications}
                            onMarkAsRead={onMarkNotificationAsRead}
                            isMarkingRead={isMarkingRead}
                        />

                        <button onClick={onEditProfile} className="h-11 px-4 rounded-lg border border-gray-200 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors inline-flex items-center gap-2 cursor-pointer">
                            <FileText className="w-4 h-4" /> Edit Profile
                        </button>
                        <button className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors inline-flex items-center gap-2 cursor-pointer">
                            <Mail className="w-4 h-4" /> Message
                        </button>
                        <button className="h-11 w-11 rounded-lg border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors inline-flex items-center justify-center cursor-pointer">
                            <MoreHorizontal className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="mt-6 border-t border-gray-200 pt-3">
                    <div className="inline-flex items-center space-x-1 bg-white p-1 rounded-xl w-fit border border-gray-200 flex-wrap gap-y-1">
                        {[
                            { key: 'personal', label: 'Personal Info' },
                            { key: 'job', label: 'Job Details' },
                            { key: 'payroll', label: 'Payroll & Benefits' },
                            { key: 'timeoff', label: 'Time & Attendance' },
                            { key: 'performance', label: 'Performance' },
                            { key: 'documents', label: 'Documents' },
                            { key: 'exit', label: 'Exit Process' },
                            { key: 'privacy', label: 'Privacy & Data' }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
