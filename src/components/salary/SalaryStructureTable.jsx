import { Search } from 'lucide-react'
import { CardSkeleton } from '../ui/SkeletonLoader'
import EmployeeSalaryCard from '../EmployeeSalaryCard'

export default function SalaryStructureTable({
    employees,
    loading,
    searchTerm,
    setSearchTerm,
    isAdmin,
    onEditClick,
    formatCurrency
}) {
    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Search */}
            <div className="relative max-w-md mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all placeholder:text-gray-400"
                />
            </div>
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            ) : employees.length > 0 ? (
                employees.map((emp, index) => (
                    <EmployeeSalaryCard
                        key={emp.id}
                        emp={emp}
                        index={index}
                        isAdmin={isAdmin}
                        onEditClick={onEditClick}
                        formatCurrency={formatCurrency}
                    />
                ))
            ) : (
                <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center">
                    <p className="text-gray-400 italic">No employees found matching your search.</p>
                </div>
            )}
        </div>
    )
}
