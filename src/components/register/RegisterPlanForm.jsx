import { ArrowLeft, Sparkles } from 'lucide-react'

export default function RegisterPlanForm({
    plans,
    selectedPlanCode,
    setSelectedPlanCode,
    billingModel,
    setBillingModel,
    currentPlanDetails,
    onSubmit,
    onBack
}) {
    return (
        <form onSubmit={onSubmit} className="space-y-5">
            <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2.5">Choose Plan Tier</label>
                <div className="space-y-2.5">
                    {plans.map(p => (
                        <button 
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPlanCode(p.plan_code)}
                            className={`w-full text-left border rounded-xl p-3.5 flex items-center justify-between transition ${selectedPlanCode === p.plan_code ? 'border-blue-500 bg-blue-50/40 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-300'}`}
                        >
                            <div>
                                <h4 className="font-black text-slate-900 text-sm">{p.name}</h4>
                                <p className="text-[10px] text-slate-500 mt-0.5">{p.description}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-black text-slate-900 text-sm">
                                    INR {p.monthly_price}<span className="text-[10px] text-slate-500">/mo flat</span>
                                </p>
                                <p className="text-[9px] font-bold text-blue-600 mt-0.5">
                                    OR INR {p.price_per_employee}/emp/mo
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2.5">Trial Billing Calculation Model</label>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        type="button" 
                        onClick={() => setBillingModel('per_employee')}
                        className={`border rounded-xl p-3 flex flex-col text-left transition ${billingModel === 'per_employee' ? 'border-blue-500 bg-blue-50/40' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                    >
                        <span className="font-black text-slate-900 text-xs">Per Employee</span>
                        <span className="text-[9px] text-slate-500 mt-0.5">INR {currentPlanDetails?.price_per_employee || 129}/emp/mo. Pay for active headcount.</span>
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setBillingModel('flat')}
                        className={`border rounded-xl p-3 flex flex-col text-left transition ${billingModel === 'flat' ? 'border-blue-500 bg-blue-50/40' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                    >
                        <span className="font-black text-slate-900 text-xs">Flat Monthly</span>
                        <span className="text-[9px] text-slate-500 mt-0.5">INR {currentPlanDetails?.monthly_price || 7999}/mo flat fee regardless.</span>
                    </button>
                </div>
            </div>

            {/* Plan detail preview snippet */}
            {currentPlanDetails && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl text-slate-700 p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between text-slate-500">
                        <span>Activation Plan:</span>
                        <span className="font-bold text-slate-950 uppercase">{currentPlanDetails.name} Tier</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                        <span>Included Trial Days:</span>
                        <span className="font-bold text-slate-950">14 Days Free</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                        <span>Capacity Limit:</span>
                        <span className="font-bold text-slate-950">{currentPlanDetails.max_employees || 'Unlimited'} Employees</span>
                    </div>
                    <div className="border-t border-blue-100 my-1 pt-1.5 flex items-center justify-between font-black text-blue-700">
                        <span>Estimated Cost Post-Trial:</span>
                        <span>
                            {billingModel === 'per_employee' 
                                ? `INR ${currentPlanDetails.price_per_employee}/emp/mo`
                                : `INR ${currentPlanDetails.monthly_price}/mo flat`
                            }
                        </span>
                    </div>
                </div>
            )}

            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                <button 
                    type="button" 
                    onClick={onBack}
                    className="px-4 py-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
                <button 
                    type="submit"
                    className="flex-1 py-3.5 bg-slate-950 hover:bg-black text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-slate-200 flex items-center justify-center space-x-2 uppercase tracking-widest cursor-pointer"
                >
                    <span>Provision Trial Workspace</span>
                    <Sparkles className="w-4 h-4" />
                </button>
            </div>
        </form>
    )
}
