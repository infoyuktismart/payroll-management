import React from 'react'
import { Calendar, Plus } from 'lucide-react'

export default function InvoiceGenerator({
    currentPlan,
    genForm,
    setGenForm,
    onSubmit,
    generating
}) {
    const handleSubmit = (e) => {
        e.preventDefault()
        onSubmit(e)
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-slate-500" />
                Monthly Billing Invoice Generator
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Period Start Date</label>
                        <input 
                            type="date" 
                            value={genForm.billingPeriodStart}
                            onChange={e => setGenForm(p => ({ ...p, billingPeriodStart: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-900 bg-slate-50"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Period End Date</label>
                        <input 
                            type="date" 
                            value={genForm.billingPeriodEnd}
                            onChange={e => setGenForm(p => ({ ...p, billingPeriodEnd: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-900 bg-slate-50"
                            required
                        />
                    </div>
                </div>

                <div>
                    <span className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Billing Calculation Model</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className={`border rounded-xl p-4 flex items-start gap-3 cursor-pointer transition ${genForm.billingModel === 'per_employee' ? 'border-blue-500 bg-blue-50/40' : 'border-slate-100 hover:border-slate-300 bg-white'}`}>
                            <input 
                                type="radio" 
                                name="billingModel" 
                                value="per_employee" 
                                checked={genForm.billingModel === 'per_employee'} 
                                onChange={e => setGenForm(p => ({ ...p, billingModel: e.target.value }))}
                                className="mt-1"
                            />
                            <div>
                                <p className="text-sm font-black text-slate-900">Per Employee (Yukti Smart HRMS)</p>
                                <p className="text-xs text-slate-500 mt-1">₹{currentPlan?.price_per_employee || 129}/employee/month based on active headcount.</p>
                            </div>
                        </label>
                        
                        <label className={`border rounded-xl p-4 flex items-start gap-3 cursor-pointer transition ${genForm.billingModel === 'flat' ? 'border-blue-500 bg-blue-50/40' : 'border-slate-100 hover:border-slate-300 bg-white'}`}>
                            <input 
                                type="radio" 
                                name="billingModel" 
                                value="flat" 
                                checked={genForm.billingModel === 'flat'} 
                                onChange={e => setGenForm(p => ({ ...p, billingModel: e.target.value }))}
                                className="mt-1"
                            />
                            <div>
                                <p className="text-sm font-black text-slate-900">Flat Monthly Plan</p>
                                <p className="text-xs text-slate-500 mt-1">₹{currentPlan?.monthly_price || 7999}/mo fixed rate regardless of employee cap.</p>
                            </div>
                        </label>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Invoice Notes / Internal Comments (Optional)</label>
                    <textarea 
                        value={genForm.notes}
                        onChange={e => setGenForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="E.g., Special discount applied, manual adjustments"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50 min-h-15"
                    />
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={generating || !currentPlan}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm px-6 py-3 cursor-pointer disabled:opacity-50"
                    >
                        <Plus className="w-4 h-4" />
                        {generating ? 'Generating...' : 'Generate Draft Invoice'}
                    </button>
                </div>
            </form>
        </div>
    )
}
