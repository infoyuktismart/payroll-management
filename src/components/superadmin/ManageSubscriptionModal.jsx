import React from 'react'
import { X, Check } from 'lucide-react'

export default function ManageSubscriptionModal({
    isOpen,
    onClose,
    tenant,
    plansList,
    editForm,
    setEditForm,
    onSave,
    saving
}) {
    if (!isOpen || !tenant) return null

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave(e)
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <div>
                        <h3 className="font-black text-slate-900 text-lg">Manage Plan Limits</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Workspace: <span className="font-bold text-slate-700">{tenant.company_name}</span></p>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Assign Subscription Tier</label>
                        <select 
                            value={editForm.plan_id} 
                            onChange={e => setEditForm(p => ({ ...p, plan_id: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-900"
                        >
                            {plansList.map(plan => (
                                <option key={plan.id} value={plan.id}>
                                    {plan.name} Tier (₹{plan.monthly_price}/mo flat, ₹{plan.price_per_employee}/emp)
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Billing Status</label>
                        <select 
                            value={editForm.status} 
                            onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-900"
                        >
                            <option value="trialing">trialing (14-Day Free Trial)</option>
                            <option value="active">active (Paid Subscribed)</option>
                            <option value="past_due">past_due (Late Suspension Grace)</option>
                            <option value="paused">paused (Temporary Freeze)</option>
                            <option value="cancelled">cancelled (Manual Termination)</option>
                            <option value="expired">expired (Term Expired)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Billing Model</label>
                            <select 
                                value={editForm.billing_model} 
                                onChange={e => setEditForm(p => ({ ...p, billing_model: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-900"
                            >
                                <option value="per_employee">Per Employee</option>
                                <option value="flat">Flat Price</option>
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Billing Cycle</label>
                            <select 
                                value={editForm.billing_cycle} 
                                onChange={e => setEditForm(p => ({ ...p, billing_cycle: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-900"
                            >
                                <option value="monthly">monthly</option>
                                <option value="annual">annual</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={saving}
                            className="px-4 py-2 text-sm font-black text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                        >
                            <Check className="w-4 h-4" />
                            {saving ? 'Overriding...' : 'Override Limits'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
