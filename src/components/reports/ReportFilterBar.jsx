import { Download } from 'lucide-react'

export default function ReportFilterBar({
    activeReportTab,
    setActiveReportTab,
    exportAllReports
}) {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div>
                    <p className="text-gray-500 mt-1">
                        Generate and view payroll, compliance, and analytical reports
                    </p>
                </div>
                <button
                    onClick={exportAllReports}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                >
                    <Download className="w-4 h-4" />
                    <span className="font-semibold text-sm">Export All Reports</span>
                </button>
            </div>
            <div className="mt-5 inline-flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-slate-50 p-1">
                {[
                    { key: 'payroll', label: 'Payroll' },
                    { key: 'compliance', label: 'Compliance' },
                    { key: 'hr', label: 'HR' },
                    { key: 'custom', label: 'Custom' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveReportTab(tab.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                            activeReportTab === tab.key
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'text-gray-600 hover:text-slate-900 hover:bg-white'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    )
}
