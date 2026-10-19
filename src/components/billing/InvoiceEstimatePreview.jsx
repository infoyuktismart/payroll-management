import React from 'react'

export default function InvoiceEstimatePreview({
    currentPlan,
    liveEstimate,
    billingModel,
    formatCurrency
}) {
    return (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 text-white p-6 flex flex-col justify-between shadow-lg">
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Live Period Estimate</h3>
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-blue-500 text-white rounded">Preview</span>
                </div>

                <div className="space-y-3.5 mb-6">
                    <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>Plan Tier:</span>
                        <span className="font-bold text-white">{currentPlan?.name || 'Active Plan'}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>Headcount Source:</span>
                        <span className="font-bold text-white">{liveEstimate.empCount} Active Staff</span>
                    </div>

                    <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>Calculation formula:</span>
                        <span className="font-bold text-white">
                            {billingModel === 'per_employee' 
                                ? `${liveEstimate.empCount} × ₹${liveEstimate.rate}` 
                                : `₹${liveEstimate.flat} Flat`
                            }
                        </span>
                    </div>

                    <div className="border-t border-slate-800 my-2 pt-2 flex items-center justify-between text-sm text-slate-300">
                        <span>Subtotal Charge:</span>
                        <span className="font-bold text-white">{formatCurrency(liveEstimate.subtotal)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>Tax amount (18% GST):</span>
                        <span className="font-bold text-white">{formatCurrency(liveEstimate.tax)}</span>
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-800 pt-4 mt-auto">
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Invoice Cost</p>
                        <p className="text-3xl font-black text-blue-400 mt-1">{formatCurrency(liveEstimate.total)}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
