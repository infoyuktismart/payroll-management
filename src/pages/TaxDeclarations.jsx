import { useEffect, useState } from 'react'
import { Check, X, Calculator, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { calculateAnnualTax, getIndianFinancialYear } from '../lib/taxUtils'
import { formatCurrency } from '../lib/payrollUtils'

export default function TaxDeclarations() {
    const [declarations, setDeclarations] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [message, setMessage] = useState('')
    const financialYear = getIndianFinancialYear()

    const fetchDeclarations = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('tax_declarations')
            .select('*, employee:employees(id, first_name, last_name, employee_id, salary, salary_allowances)')
            .order('updated_at', { ascending: false })
        if (!error) setDeclarations(data || [])
        setLoading(false)
    }

    useEffect(() => {
        fetchDeclarations()
    }, [])

    const reviewDeclaration = async (id, status) => {
        const { data: userData } = await supabase.auth.getUser()
        const { error } = await supabase
            .from('tax_declarations')
            .update({
                status,
                reviewed_by: userData?.user?.id,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', id)
        if (error) {
            setMessage(error.message)
            return
        }
        setMessage(`Declaration ${status}.`)
        fetchDeclarations()
        setTimeout(() => setMessage(''), 3000)
    }

    const filtered = declarations.filter(item => {
        const haystack = `${item.employee?.first_name || ''} ${item.employee?.last_name || ''} ${item.employee?.employee_id || ''} ${item.financial_year} ${item.status}`.toLowerCase()
        return haystack.includes(search.toLowerCase())
    })

    const getProjection = (item) => {
        const monthlyGross = Number(item.employee?.salary || 0) + Number(item.employee?.salary_allowances || 0)
        return calculateAnnualTax({
            annualGross: monthlyGross * 12 + Number(item.other_income || 0),
            regime: item.regime,
            declaration: item
        })
    }

    return (
        <div className="space-y-6">
            {message && <div className="fixed top-4 right-4 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-lg z-50 text-sm font-bold">{message}</div>}

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <p className="text-sm text-gray-500">Review employee tax declarations, regimes, and projected annual TDS.</p>
                    </div>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search declarations..."
                            className="pl-9 pr-4 py-2 rounded-lg bg-slate-50 border border-gray-200 text-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['submitted', 'approved', 'rejected'].map(status => (
                    <div key={status} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <p className="text-xs font-bold text-gray-500 uppercase">{status}</p>
                        <p className="text-3xl font-black text-slate-900 mt-2">{declarations.filter(item => item.status === status).length}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Employee</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">FY</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Regime</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Deductions</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Projected Tax</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan="7" className="py-10 text-center text-gray-500">Loading...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="7" className="py-10 text-center text-gray-500">No tax declarations found for {financialYear}.</td></tr>
                        ) : filtered.map(item => {
                            const projection = getProjection(item)
                            const deductions = Number(item.section_80c || 0) + Number(item.section_80d || 0) + Number(item.hra_exemption || 0) + Number(item.home_loan_interest || 0) + Number(item.other_deductions || 0)
                            return (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-slate-900">{item.employee?.first_name} {item.employee?.last_name}</p>
                                        <p className="text-xs text-gray-500">{item.employee?.employee_id}</p>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{item.financial_year}</td>
                                    <td className="px-6 py-4 text-sm font-bold capitalize text-slate-800">{item.regime}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{formatCurrency(deductions)}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-blue-700 inline-flex items-center gap-2"><Calculator className="w-4 h-4" />{formatCurrency(projection.totalTax)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-md text-xs font-black capitalize ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : item.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {item.status === 'submitted' && (
                                            <div className="inline-flex gap-2">
                                                <button onClick={() => reviewDeclaration(item.id, 'approved')} className="p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><Check className="w-4 h-4" /></button>
                                                <button onClick={() => reviewDeclaration(item.id, 'rejected')} className="p-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100"><X className="w-4 h-4" /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
