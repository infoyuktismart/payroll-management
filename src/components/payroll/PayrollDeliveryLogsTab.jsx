import React from 'react'
import { FileText, Play } from 'lucide-react'
import { TableSkeleton } from '../ui/SkeletonLoader'

const Badge = ({ children, color = 'bg-slate-100 text-slate-700' }) => (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${color}`}>
        {children}
    </span>
)

export default function PayrollDeliveryLogsTab({
    deliveryLogs,
    logsLoading,
    fetchDeliveryLogs
}) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <FileText className="w-5 h-5 text-slate-700" />
                        <h3 className="text-lg font-bold text-slate-800">Notification & Delivery Logs</h3>
                    </div>
                    <button
                        onClick={fetchDeliveryLogs}
                        disabled={logsLoading}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-900 hover:text-white transition-all font-bold text-xs disabled:opacity-50"
                    >
                        {logsLoading ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-slate-700 border-t-transparent mr-1"></div>
                        ) : (
                            <Play className="w-3 h-3 rotate-90" />
                        )}
                        <span>Refresh Logs</span>
                    </button>
                </div>

                {logsLoading ? (
                    <TableSkeleton rows={5} cols={5} />
                ) : deliveryLogs && deliveryLogs.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Timestamp</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Channel</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Recipient</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Details / Errors</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {deliveryLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge
                                                color={
                                                    log.channel === 'whatsapp'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                        : 'bg-blue-50 text-blue-700 border border-blue-100'
                                                }
                                            >
                                                {log.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-slate-800 text-sm">
                                            {log.channel === 'whatsapp' ? log.recipient_phone : log.recipient_email}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                                            {log.notification_type || 'Custom'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge
                                                color={
                                                    log.status === 'sent'
                                                        ? 'bg-green-50 text-green-700 border border-green-100'
                                                        : log.status === 'pending'
                                                        ? 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                                                        : log.status === 'skipped'
                                                        ? 'bg-gray-100 text-gray-600 border border-gray-200'
                                                        : 'bg-red-50 text-red-700 border border-red-100'
                                                }
                                            >
                                                {log.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate" title={log.error_message || ''}>
                                            {log.error_message || 'None'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-12 text-center text-gray-500 italic">No delivery logs available.</div>
                )}
            </div>
        </div>
    )
}
