export default function AttendanceCalendar({
    employees,
    dateFilter,
    setDateFilter,
    selectedEmployee,
    setSelectedEmployee,
    calendarAttendance,
    calendarLoading,
    holidays,
    onDayClick
}) {
    const renderCalendarGrid = () => {
        if (!dateFilter || !selectedEmployee) return null

        const [year, month] = dateFilter.split('-').map(Number)
        const firstDayIndex = new Date(year, month - 1, 1).getDay()
        const totalDays = new Date(year, month, 0).getDate()

        const days = []
        for (let i = 0; i < firstDayIndex; i++) {
            days.push({ blank: true, key: `blank-${i}` })
        }

        for (let day = 1; day <= totalDays; day++) {
            const dateStr = `${dateFilter}-${day.toString().padStart(2, '0')}`
            const record = calendarAttendance.find(a => a.date === dateStr)
            const dateObj = new Date(year, month - 1, day)
            const isSunday = dateObj.getDay() === 0
            const isHoliday = holidays.some(h => h.date === dateStr)
            const holidayInfo = holidays.find(h => h.date === dateStr)

            days.push({
                blank: false,
                day,
                dateStr,
                record,
                isSunday,
                isHoliday,
                holidayName: holidayInfo?.name,
                key: `day-${day}`
            })
        }

        return (
            <div className="grid grid-cols-7 gap-2 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-xs font-bold text-gray-400 uppercase tracking-wider py-2 bg-slate-50 rounded-lg">{d}</div>
                ))}
                
                {days.map((cell) => {
                    if (cell.blank) {
                        return <div key={cell.key} className="aspect-square bg-slate-50/30 border border-transparent rounded-xl"></div>
                    }

                    const { dateStr, record, isSunday, isHoliday, holidayName, day } = cell
                    let status = record?.status
                    
                    if (!status) {
                        if (isSunday) status = 'weekly_off'
                        else if (isHoliday) status = 'on_leave'
                    }

                    let statusClass = 'border-gray-100 hover:border-blue-400 bg-white text-slate-800'
                    let label = ''

                    if (status === 'present') {
                        statusClass = 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 hover:border-emerald-400'
                        label = 'Present'
                    } else if (status === 'absent') {
                        statusClass = 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 hover:border-rose-400'
                        label = 'Absent'
                    } else if (status === 'half_day') {
                        statusClass = 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 hover:border-amber-400'
                        label = 'Half Day'
                    } else if (status === 'weekly_off') {
                        statusClass = 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200 hover:border-slate-300'
                        label = 'Weekly Off'
                    } else if (status === 'on_leave') {
                        statusClass = 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-400'
                        label = isHoliday ? `Holiday: ${holidayName || 'Off'}` : 'On Leave'
                    }

                    return (
                        <div
                            key={cell.key}
                            onClick={() => onDayClick(dateStr, record)}
                            className={`aspect-square border p-2 rounded-xl flex flex-col justify-between items-start cursor-pointer transition-all duration-200 hover:scale-[1.03] hover:shadow-sm ${statusClass}`}
                        >
                            <span className="text-xs font-bold">{day}</span>
                            <div className="w-full text-left">
                                {label && (
                                    <span className="text-[8px] font-bold uppercase tracking-wider block truncate max-w-full">
                                        {label}
                                    </span>
                                )}
                                {record?.check_in && (
                                    <span className="text-[7px] font-medium opacity-70 block">
                                        {new Date(record.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false })}
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Select Employee</label>
                        <select
                            className="px-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                        >
                            <option value="">Choose Employee</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Month</label>
                        <input
                            type="month"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="px-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                    </div>
                </div>

                {/* Color Code Legend */}
                <div className="flex items-center gap-4 flex-wrap">
                    {[
                        { status: 'present', label: 'Present', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                        { status: 'absent', label: 'Absent', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
                        { status: 'half_day', label: 'Half Day', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
                        { status: 'weekly_off', label: 'Weekly Off', bg: 'bg-slate-100 text-slate-500 border-slate-200' },
                        { status: 'on_leave', label: 'On Leave', bg: 'bg-blue-50 text-blue-700 border-blue-200' }
                    ].map((item) => (
                        <div key={item.status} className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold ${item.bg}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            {item.label}
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-6">
                {calendarLoading ? (
                    <div className="flex justify-center items-center h-96">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : selectedEmployee ? (
                    renderCalendarGrid()
                ) : (
                    <div className="text-center py-20 text-sm font-medium text-gray-400 italic">
                        Please select an employee to view their attendance calendar.
                    </div>
                )}
            </div>
        </div>
    )
}
