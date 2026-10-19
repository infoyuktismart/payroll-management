import { Calendar, Search } from 'lucide-react'

export default function PayrollFilterBar({
  selectedDate,
  setSelectedDate,
  selectedDepartment,
  setSelectedDepartment,
  employeeSearch,
  setEmployeeSearch,
  runType,
  setRunType,
  departments,
  activeTab,
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-gray-600">Period</label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="month"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-gray-600">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-gray-500">Run Type</span>
          <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border border-gray-200">
            {[
              { key: 'regular', label: 'Regular' },
              { key: 'bonus', label: 'Bonus' },
              { key: 'off_cycle', label: 'Off-Cycle' },
            ].map((type) => (
              <button
                key={type.key}
                type="button"
                onClick={() => setRunType(type.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  runType === type.key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-gray-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'current_period' && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search calculated payroll items by employee name..."
            className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 w-full focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
