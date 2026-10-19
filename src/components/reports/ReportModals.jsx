import React from 'react'
import { X } from 'lucide-react'

export function ComplianceDashboardModal({ isOpen, onClose, metrics, esicSummary, reports }) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Compliance Dashboard</h2>
                        <p className="text-sm text-gray-500 mt-1">View all compliance reports and status in one centralized location</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                <div className="p-6 space-y-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="border border-gray-100 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-gray-600 mb-3">PF Compliance</p>
                            <p className="text-2xl font-black text-emerald-500">{metrics.complianceScore.toFixed(1)}%</p>
                            <p className="text-[10px] text-gray-600 mt-1">{metrics.activeEmployees}/{metrics.totalEmployees} employees</p>
                        </div>
                        <div className="border border-gray-100 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-gray-600 mb-3">ESI Eligible</p>
                            <p className="text-2xl font-black text-emerald-500">{esicSummary.eligibleCount}</p>
                            <p className="text-[10px] text-gray-600 mt-1">employees this month</p>
                        </div>
                        <div className="border border-gray-100 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-gray-600 mb-3">PT Compliance</p>
                            <p className="text-2xl font-black text-amber-500">{metrics.complianceScore.toFixed(1)}%</p>
                            <p className="text-[10px] text-gray-600 mt-1">Derived from enabled rules</p>
                        </div>
                        <div className="border border-gray-100 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-gray-600 mb-3">TDS Compliance</p>
                            <p className="text-2xl font-black text-emerald-500">{metrics.complianceScore.toFixed(1)}%</p>
                            <p className="text-[10px] text-gray-600 mt-1">TDS enabled in payroll</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-4">Recent Compliance Activities</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                                <div>
                                    <p className="text-sm font-bold text-gray-800">Latest Payroll Reports</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{reports.filter(r => r.type === 'Payroll').length} payroll report(s) available</p>
                                </div>
                                <span className="bg-slate-900 text-white text-[10px] font-bold px-3 py-1 rounded-full">Completed</span>
                            </div>
                            <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                                <div>
                                    <p className="text-sm font-bold text-gray-800">Statutory Coverage</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{metrics.complianceScore.toFixed(1)}% of active employees have statutory deductions configured</p>
                                </div>
                                <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-3 py-1 rounded-full">Pending</span>
                            </div>
                            <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                                <div>
                                    <p className="text-sm font-bold text-gray-800">Attendance Basis</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{metrics.attendanceRate.toFixed(1)}% present rate in the last 6 months</p>
                                </div>
                                <span className="bg-slate-900 text-white text-[10px] font-bold px-3 py-1 rounded-full">Completed</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function CustomReportBuilderModal({
    isOpen,
    onClose,
    customReportForm,
    setCustomReportForm,
    departmentData,
    onGenerate
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Custom Report Builder</h2>
                        <p className="text-sm text-gray-500 mt-1">Create custom reports by selecting specific parameters and data points</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Report Type</label>
                            <select
                                value={customReportForm.type}
                                onChange={(e) => setCustomReportForm(prev => ({ ...prev, type: e.target.value }))}
                                className="w-full text-sm border-gray-200 rounded-lg bg-gray-50 py-2.5"
                            >
                                <option value="">Select report type</option>
                                <option value="Payroll">Payroll</option>
                                <option value="Attendance">Attendance</option>
                                <option value="Employee">Employee</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Date Range</label>
                            <select
                                value={customReportForm.dateRange}
                                onChange={(e) => setCustomReportForm(prev => ({ ...prev, dateRange: e.target.value }))}
                                className="w-full text-sm border-gray-200 rounded-lg bg-gray-50 py-2.5"
                            >
                                <option value="">Select period</option>
                                <option value="Current Month">Current Month</option>
                                <option value="Last Quarter">Last Quarter</option>
                                <option value="Last Financial Year">Last Financial Year</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-3">Include Data Points</label>
                        <div className="grid grid-cols-2 gap-y-3 gap-x-8">
                            {[
                                'Employee Details',
                                'Allowances',
                                'Gross Salary',
                                'Attendance',
                                'Leave Balance',
                                'Designation',
                                'Basic Salary',
                                'Deductions',
                                'Net Salary',
                                'Overtime',
                                'Department',
                                'Joining Date'
                            ].map(item => (
                                <label key={item} className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                                        checked={customReportForm.dataPoints.includes(item)}
                                        onChange={(e) => setCustomReportForm(prev => ({
                                            ...prev,
                                            dataPoints: e.target.checked
                                                ? [...prev.dataPoints, item]
                                                : prev.dataPoints.filter(p => p !== item)
                                        }))}
                                    />
                                    <span className="text-sm font-medium text-gray-600">{item}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Department Filter</label>
                            <select
                                value={customReportForm.department}
                                onChange={(e) => setCustomReportForm(prev => ({ ...prev, department: e.target.value }))}
                                className="w-full text-sm border-gray-200 rounded-lg bg-gray-50 py-2.5"
                            >
                                <option value="">All departments</option>
                                {departmentData.map(dept => (
                                    <option key={dept.name} value={dept.name}>{dept.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Output Format</label>
                            <select
                                value={customReportForm.format}
                                onChange={(e) => setCustomReportForm(prev => ({ ...prev, format: e.target.value }))}
                                className="w-full text-sm border-gray-200 rounded-lg bg-gray-50 py-2.5"
                            >
                                <option value="">Select format</option>
                                <option value="PDF">PDF</option>
                                <option value="CSV">CSV</option>
                                <option value="Excel">Excel</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t border-gray-100 flex justify-end items-center gap-3 bg-gray-50/50">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onGenerate}
                        className="px-5 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200"
                    >
                        Generate Custom Report
                    </button>
                </div>
            </div>
        </div>
    )
}
