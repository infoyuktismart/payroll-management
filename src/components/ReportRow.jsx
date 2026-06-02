import React from 'react'
import { FileText, Download } from 'lucide-react'

const ReportRow = React.memo(function ReportRow({ report, handleDownload }) {
    return (
        <tr className="hover:bg-gray-50/80 transition-colors group">
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                        <FileText className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{report.name}</p>
                        <p className="text-xs text-gray-600 font-medium">{report.id}</p>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                    {report.type}
                </span>
            </td>
            <td className="px-6 py-4">
                <p className="text-sm text-gray-500 font-medium truncate max-w-xs">{report.description}</p>
            </td>
            <td className="px-6 py-4">
                <p className="text-sm text-gray-600 font-semibold">{report.date}</p>
            </td>
            <td className="px-6 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize
                    ${report.status === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {report.status}
                </span>
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => handleDownload(report)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                        title="Download Report"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </td>
        </tr>
    )
})

export default ReportRow
