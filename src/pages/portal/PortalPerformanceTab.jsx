import { Star, Target, TrendingUp, Download, ExternalLink } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function PortalPerformanceTab({
    currentEmployee,
    overallRating,
    goalsCompletion,
    quarterlyGrowth,
    performanceGoals,
    competencies,
    reviewHistory,
    toast
}) {
    const [goals, setGoals] = useState([])
    const [loadingGoals, setLoadingGoals] = useState(true)

    useEffect(() => {
        const fetchGoals = async () => {
            if (!currentEmployee?.id) return
            setLoadingGoals(true)
            try {
                const { data, error } = await supabase
                    .from('performance_goals')
                    .select('*')
                    .eq('employee_id', currentEmployee.id)
                    .order('target_date', { ascending: false })
                if (error) throw error
                setGoals(data || [])
            } catch (error) {
                console.error('Error fetching performance goals:', error)
                toast?.error('Failed to load performance goals: ' + error.message)
            } finally {
                setLoadingGoals(false)
            }
        }
        fetchGoals()
    }, [currentEmployee?.id])

    const getQuarterFromDate = (dateStr) => {
        if (!dateStr) return 'N/A'
        const date = new Date(dateStr)
        const month = date.getMonth()
        const quarter = Math.floor(month / 3) + 1
        return `Q${quarter} ${date.getFullYear()}`
    }

    const handleDownloadPerformancePDF = async () => {
        try {
            const { default: jsPDFLib } = await import('jspdf')
            const pdf = new jsPDFLib('p', 'mm', 'a4')

            const name = `${currentEmployee?.first_name || ''} ${currentEmployee?.last_name || ''}`.trim()
            let y = 16
            pdf.setFontSize(16)
            pdf.text('Performance Dashboard Report', 14, y)
            y += 8

            pdf.setFontSize(10)
            pdf.text(`${name} | ${currentEmployee?.designation || 'Employee'} | ${new Date().toLocaleDateString()}`, 14, y)
            y += 10

            pdf.setFontSize(12)
            pdf.text(`Overall Rating: ${overallRating} / 5.0`, 14, y)
            y += 7
            pdf.text(`Goals Completion: ${goalsCompletion}%`, 14, y)
            y += 7
            pdf.text(`Quarterly Growth: +${quarterlyGrowth}%`, 14, y)
            y += 10

            pdf.setFontSize(13)
            pdf.text('Current Goals', 14, y)
            y += 7
            pdf.setFontSize(10)

            const goalsList = goals.length > 0 ? goals : performanceGoals.map(g => ({
                title: g.title,
                status: g.status === 'Completed' ? 'completed' : g.status === 'On Track' ? 'in_progress' : 'pending'
            }))

            goalsList.forEach((goal) => {
                const statusLabel = goal.status === 'completed' ? 'Achieved' : goal.status === 'cancelled' ? 'Missed' : 'Pending'
                pdf.text(`- ${goal.title} (${statusLabel})`, 14, y)
                y += 6
            })

            y += 4
            pdf.setFontSize(13)
            pdf.text('Core Competencies', 14, y)
            y += 7
            pdf.setFontSize(10)
            competencies.forEach((c) => {
                pdf.text(`- ${c.label}: ${c.score.toFixed(1)}/5.0`, 14, y)
                y += 6
            })

            const fileName = `Performance_${(name || 'Employee').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
            pdf.save(fileName)
            toast.success('Performance PDF downloaded successfully.')
        } catch (error) {
            toast.error(error.message || 'Failed to generate performance PDF.')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Performance Dashboard</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{currentEmployee?.first_name} {currentEmployee?.last_name} • {currentEmployee?.designation || 'Employee'} • {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleDownloadPerformancePDF} className="px-4 py-2 rounded-xl border border-gray-250 text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 bg-white">
                        <Download className="w-4 h-4" /> Download PDF Report
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Overall Rating</p>
                        <Star className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-3xl font-black text-slate-900 mt-3">{overallRating}<span className="text-lg font-medium text-gray-600"> / 5.0</span></p>
                    <p className="text-xs font-bold text-emerald-600 mt-2">+0.2 since last quarter</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Goals Completion</p>
                        <Target className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-3xl font-black text-slate-900 mt-3">{goalsCompletion}%</p>
                    <p className="text-xs font-bold text-emerald-600 mt-2">+5% vs target</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Quarterly Growth</p>
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-3xl font-black text-slate-900 mt-3">+{quarterlyGrowth}%</p>
                    <p className="text-xs font-bold text-emerald-600 mt-2">Top 10% of team</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <h4 className="text-base font-bold text-slate-900">Current Goals & OKRs</h4>
                    </div>
                    {loadingGoals ? (
                        <div className="flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-gray-200">
                                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Quarter</th>
                                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Goal Name</th>
                                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {goals.length > 0 ? (
                                        goals.map((goal) => {
                                            const quarter = getQuarterFromDate(goal.target_date)
                                            const mappedStatus = goal.status === 'completed' ? 'Achieved' : goal.status === 'cancelled' ? 'Missed' : 'Pending'
                                            const badgeColor = 
                                                mappedStatus === 'Achieved' ? 'bg-emerald-100 text-emerald-800' :
                                                mappedStatus === 'Missed' ? 'bg-rose-100 text-rose-800' :
                                                'bg-amber-100 text-amber-800'
                                            return (
                                                <tr key={goal.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 text-xs font-bold text-slate-700">{quarter}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-xs font-bold text-slate-800">{goal.title}</div>
                                                        {goal.description && <div className="text-[10px] text-gray-500 mt-0.5">{goal.description}</div>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${badgeColor}`}>
                                                            {mappedStatus}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="3" className="px-4 py-8 text-center text-xs text-gray-400 italic">
                                                No performance goals found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <h4 className="text-base font-bold text-slate-900">Core Competencies</h4>
                    </div>
                    <div className="space-y-5">
                        {competencies.map((item, idx) => {
                            const fullStars = Math.floor(item.score)
                            return (
                                <div key={`${item.label}-${idx}`} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs font-bold text-slate-800">{item.label}</p>
                                        <p className="text-xs font-black text-slate-900">{item.score.toFixed(1)}</p>
                                    </div>
                                    <div className="flex items-center gap-0.5 mt-1.5">
                                        {Array.from({ length: 5 }).map((_, starIdx) => (
                                            <Star key={starIdx} className={`w-3.5 h-3.5 ${starIdx < fullStars ? 'fill-blue-600 text-blue-600' : 'text-gray-200'}`} />
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-150 bg-gray-50/50">
                    <h4 className="text-base font-bold text-slate-900">Review History</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Review Period</th>
                                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Reviewer</th>
                                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Performance Score</th>
                                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {reviewHistory.length > 0 ? reviewHistory.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="text-xs font-bold text-slate-900">{item.periodLabel}</p>
                                        <p className="text-[10px] text-gray-600 mt-0.5">{item.rangeLabel}</p>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-medium text-gray-700">{item.reviewer}</td>
                                    <td className="px-6 py-4"><span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-bold">{item.score} / 5.0</span></td>
                                    <td className="px-6 py-4"><span className="text-xs font-bold text-emerald-600">Finalized</span></td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="inline-flex items-center gap-1 text-xs font-bold text-blue-650 hover:text-blue-700">View Report <ExternalLink className="w-3.5 h-3.5" /></button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-14 text-center text-xs text-gray-600 italic">No review records available.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
