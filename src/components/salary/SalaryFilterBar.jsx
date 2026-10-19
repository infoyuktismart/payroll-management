import { User, DollarSign, Calculator } from 'lucide-react'

export default function SalaryFilterBar({ activeTab, setActiveTab }) {
  return (
    <div className="inline-flex items-center p-1 bg-white rounded-xl space-x-1 border border-gray-200">
      <button
        onClick={() => setActiveTab('employee_salaries')}
        className={`px-4 py-2 text-[15px] font-semibold rounded-lg transition-all duration-200 flex items-center space-x-2 ${
          activeTab === 'employee_salaries'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'
        }`}
      >
        <User className="w-4 h-4" />
        <span>Employee Salaries</span>
      </button>
      <button
        onClick={() => setActiveTab('salary_components')}
        className={`px-4 py-2 text-[15px] font-semibold rounded-lg transition-all duration-200 flex items-center space-x-2 ${
          activeTab === 'salary_components'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'
        }`}
      >
        <DollarSign className="w-4 h-4" />
        <span>Salary Components</span>
      </button>
      <button
        onClick={() => setActiveTab('deductions')}
        className={`px-4 py-2 text-[15px] font-semibold rounded-lg transition-all duration-200 flex items-center space-x-2 ${
          activeTab === 'deductions'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'
        }`}
      >
        <Calculator className="w-4 h-4" />
        <span>Deductions</span>
      </button>
    </div>
  )
}
