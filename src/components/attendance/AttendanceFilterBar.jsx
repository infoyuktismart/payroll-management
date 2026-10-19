import { Search, RotateCcw } from 'lucide-react'

export default function AttendanceFilterBar({
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    statusFilter,
    setStatusFilter,
    deptFilter,
    setDeptFilter,
    clearFilters
}) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search employee..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <input
                type="month"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-48 px-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-medium"
            />
            <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-48 px-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-600"
            >
                <option>All Status</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="half_day">Half Day</option>
                <option value="weekly_off">Weekly Off</option>
                <option value="late">Late</option>
            </select>
            <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-48 px-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-600"
            >
                <option>All Departments</option>
                <option>HR</option>
                <option>Engineering</option>
                <option>Sales</option>
                <option>Management</option>
            </select>
            <button
                onClick={clearFilters}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm font-medium text-gray-600 transition-colors border border-gray-100"
            >
                <RotateCcw className="w-4 h-4" />
                <span>Clear Filters</span>
            </button>
        </div>
    )
}
