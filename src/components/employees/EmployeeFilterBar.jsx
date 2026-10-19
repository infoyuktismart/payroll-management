import { Search, Plus, Upload } from 'lucide-react'

export default function EmployeeFilterBar({
    searchTerm,
    setSearchTerm,
    startAddingEmployee,
    openBulkImport,
    isAdmin
}) {
    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div></div>
            <div className="flex w-full sm:w-auto gap-4">
                <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                        type="text"
                        placeholder="Search employees..."
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-blue-500 focus:border-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={startAddingEmployee}
                    className="flex items-center space-x-2 bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition shadow-sm font-bold text-sm cursor-pointer"
                >
                    <Plus className="h-4 w-4" />
                    <span>Add Employee</span>
                </button>
                {isAdmin && (
                    <button
                        onClick={openBulkImport}
                        className="flex items-center space-x-2 border border-gray-300 bg-white text-gray-700 px-6 py-2 rounded-lg hover:bg-slate-50 transition shadow-sm font-bold text-sm cursor-pointer"
                    >
                        <Upload className="h-4 w-4 text-indigo-600 animate-pulse" />
                        <span>Import CSV</span>
                    </button>
                )}
            </div>
        </div>
    )
}
