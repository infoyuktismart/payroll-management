import { Search, Filter } from 'lucide-react'
import ReportRow from '../ReportRow'
import Pagination from '../Pagination'

export default function ReportListTable({
    activeReportTab,
    reports,
    currentPage,
    setCurrentPage,
    totalPages,
    reportsPerPage,
    searchTerm,
    setSearchTerm,
    handleDownload
}) {
    const startIndex = (currentPage - 1) * reportsPerPage
    const currentReports = reports.slice(startIndex, startIndex + reportsPerPage)

    return (
        <div
            id="reports-table"
            className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${
                activeReportTab !== 'payroll' && activeReportTab !== 'custom' ? 'hidden' : ''
            }`}
        >
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold text-gray-800">Available Reports</h2>
                    <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">
                        {reports.length}
                    </span>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search reports..."
                            className="pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-medium text-gray-700 w-full sm:w-64 focus:ring-2 focus:ring-blue-100 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                        <Filter className="w-4 h-4" />
                        Filter
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100">
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Report Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Last Generated</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {reports.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center py-8 text-gray-500 text-sm">
                                    No reports found
                                </td>
                            </tr>
                        ) : (
                            currentReports.map((report) => (
                                <ReportRow key={report.id} report={report} handleDownload={handleDownload} />
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {reports.length > reportsPerPage && (
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                    <span>
                        Page {currentPage} of {totalPages}
                    </span>
                    <Pagination
                        page={currentPage - 1}
                        totalPages={totalPages}
                        onPageChange={(p) => setCurrentPage(p + 1)}
                    />
                </div>
            )}
        </div>
    )
}

