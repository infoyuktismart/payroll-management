/**
 * Skeleton Loader Components
 * Reusable animated placeholders for loading states across all pages.
 */

// ─── Base pulse block ──────────────────────────────────────────────────────
const Pulse = ({ className = '' }) => (
    <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
)

// ─── Stat Card Skeleton (Dashboard, Exits) ─────────────────────────────────
export const StatCardSkeleton = () => (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div className="space-y-2 flex-1">
            <Pulse className="h-3 w-24" />
            <Pulse className="h-8 w-16" />
        </div>
        <Pulse className="w-12 h-12 rounded-xl" />
    </div>
)

// ─── Table Row Skeleton ────────────────────────────────────────────────────
export const TableRowSkeleton = ({ cols = 6 }) => (
    <tr>
        {Array.from({ length: cols }).map((_, i) => (
            <td key={i} className="px-6 py-4">
                <Pulse className={`h-4 ${i === 0 ? 'w-32' : i === 1 ? 'w-24' : 'w-16'}`} />
            </td>
        ))}
    </tr>
)

// ─── Table Skeleton (wraps multiple rows) ──────────────────────────────────
export const TableSkeleton = ({ rows = 5, cols = 6 }) => (
    <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        {Array.from({ length: cols }).map((_, i) => (
                            <th key={i} className="px-6 py-3">
                                <Pulse className="h-3 w-20" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                    {Array.from({ length: rows }).map((_, i) => (
                        <TableRowSkeleton key={i} cols={cols} />
                    ))}
                </tbody>
            </table>
        </div>
    </div>
)

// ─── Card Skeleton (generic) ───────────────────────────────────────────────
export const CardSkeleton = ({ lines = 3, className = '' }) => (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${className}`}>
        <Pulse className="h-5 w-40 mb-4" />
        {Array.from({ length: lines }).map((_, i) => (
            <Pulse key={i} className={`h-4 mb-3 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} />
        ))}
    </div>
)

// ─── Employee Row Skeleton ─────────────────────────────────────────────────
export const EmployeeRowSkeleton = () => (
    <tr>
        <td className="px-6 py-4"><Pulse className="h-4 w-16" /></td>
        <td className="px-6 py-4">
            <div className="flex items-center">
                <Pulse className="w-10 h-10 rounded-full mr-4 shrink-0" />
                <div className="space-y-1">
                    <Pulse className="h-4 w-28" />
                    <Pulse className="h-3 w-36" />
                </div>
            </div>
        </td>
        <td className="px-6 py-4"><Pulse className="h-4 w-24" /></td>
        <td className="px-6 py-4"><Pulse className="h-4 w-20" /></td>
        <td className="px-6 py-4"><Pulse className="h-4 w-24" /></td>
        <td className="px-6 py-4"><Pulse className="h-6 w-16 rounded-full" /></td>
        <td className="px-6 py-4"><Pulse className="h-4 w-20" /></td>
        <td className="px-6 py-4 text-right"><Pulse className="h-4 w-16 ml-auto" /></td>
    </tr>
)

// ─── Payroll Processing Skeleton ───────────────────────────────────────────
export const PayrollRowSkeleton = () => (
    <tr>
        <td className="px-6 py-4">
            <div className="space-y-1">
                <Pulse className="h-4 w-28" />
                <Pulse className="h-3 w-20" />
            </div>
        </td>
        <td className="px-6 py-4"><Pulse className="h-4 w-16" /></td>
        <td className="px-6 py-4"><Pulse className="h-4 w-20" /></td>
        <td className="px-6 py-4"><Pulse className="h-4 w-20" /></td>
        <td className="px-6 py-4"><Pulse className="h-4 w-20" /></td>
        <td className="px-6 py-4"><Pulse className="h-4 w-24 font-bold" /></td>
        <td className="px-6 py-4"><Pulse className="h-6 w-16 rounded-full" /></td>
        <td className="px-6 py-4"><Pulse className="h-8 w-16 rounded-lg" /></td>
    </tr>
)

// ─── Report Card Skeleton ──────────────────────────────────────────────────
export const ReportRowSkeleton = () => (
    <tr>
        <td className="px-6 py-4">
            <div className="flex items-center gap-3">
                <Pulse className="w-8 h-8 rounded-lg shrink-0" />
                <div className="space-y-1">
                    <Pulse className="h-4 w-36" />
                    <Pulse className="h-3 w-20" />
                </div>
            </div>
        </td>
        <td className="px-6 py-4"><Pulse className="h-5 w-16 rounded-md" /></td>
        <td className="px-6 py-4"><Pulse className="h-4 w-40" /></td>
        <td className="px-6 py-4"><Pulse className="h-4 w-24" /></td>
        <td className="px-6 py-4"><Pulse className="h-5 w-16 rounded-full" /></td>
        <td className="px-6 py-4 text-right"><Pulse className="h-7 w-7 rounded-lg ml-auto" /></td>
    </tr>
)

// ─── Chart Skeleton ────────────────────────────────────────────────────────
export const ChartSkeleton = ({ height = 'h-64' }) => (
    <div className={`${height} bg-gray-50 rounded-xl flex items-end gap-2 px-4 pb-4 pt-8`}>
        {[60, 80, 50, 90, 70, 85, 55].map((h, i) => (
            <div key={i} className="flex-1 animate-pulse bg-gray-200 rounded-t-lg" style={{ height: `${h}%` }} />
        ))}
    </div>
)

// ─── Portal Profile Skeleton ───────────────────────────────────────────────
export const ProfileSkeleton = () => (
    <div className="space-y-6">
        <div className="flex items-center gap-6 p-6 bg-white rounded-2xl border border-gray-100">
            <Pulse className="w-20 h-20 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
                <Pulse className="h-6 w-48" />
                <Pulse className="h-4 w-32" />
                <Pulse className="h-3 w-24" />
            </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
                    <Pulse className="h-3 w-20" />
                    <Pulse className="h-5 w-32" />
                </div>
            ))}
        </div>
    </div>
)

// ─── Page Header Skeleton ──────────────────────────────────────────────────
export const PageHeaderSkeleton = () => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex justify-between items-center mb-6">
        <div className="space-y-2">
            <Pulse className="h-6 w-48" />
            <Pulse className="h-4 w-64" />
        </div>
        <Pulse className="h-10 w-32 rounded-lg" />
    </div>
)
