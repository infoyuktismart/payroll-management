export default function AttendancePoliciesTab({
    attendancePolicies,
    policyForm,
    setPolicyForm,
    onSubmitPolicy,
    submitting,
    webhookUrl,
    onCopyWebhook,
    onPingHardware
}) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Active Attendance Policies</h3>
                    <div className="space-y-4">
                        {attendancePolicies.map((policy) => (
                            <div key={policy.id} className="p-5 bg-slate-50 border border-gray-100 rounded-xl flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-slate-800">{policy.name}</h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Core hours: {policy.core_start_time} - {policy.core_end_time} | Grace window: {policy.grace_period_mins} mins
                                    </p>
                                    <p className="text-[10px] text-blue-600 font-bold mt-1 uppercase tracking-wider">
                                        Late limit: {policy.late_arrival_limit} arrivals/month
                                    </p>
                                </div>
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase">Active</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Webhook biometrics policy */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 space-y-4">
                    <h3 className="text-lg font-bold text-gray-800">Biometric Webhook Hardware Hub</h3>
                    <p className="text-xs text-gray-600">Securely connect and feed real-time employee check-in logs from external ZK/ESSL IP hardware scanners.</p>
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Endpoint Webhook API URL</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                readOnly 
                                value={webhookUrl}
                                className="flex-1 px-4 py-2 bg-slate-50 border border-gray-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-0 cursor-default"
                            />
                            <button 
                                type="button"
                                onClick={onCopyWebhook}
                                className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                                Copy
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                            <span className="text-xs font-bold text-slate-700">Webhook status: Live & Active</span>
                        </div>
                        <button
                            onClick={onPingHardware}
                            className="px-4 py-2 bg-black text-white hover:bg-gray-800 text-xs font-bold rounded-lg transition-all cursor-pointer"
                        >
                            Ping Hardware Handshake
                        </button>
                    </div>
                </div>
            </div>

            {/* Policy creation form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Create Flex-Time Policy</h3>
                <form onSubmit={onSubmitPolicy} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-750 uppercase block">Policy Name</label>
                        <input 
                            type="text" 
                            required 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-gray-105 rounded-xl text-xs font-bold"
                            placeholder="e.g. Core Night Shift"
                            value={policyForm.name}
                            onChange={(e) => setPolicyForm({...policyForm, name: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-750 uppercase block">Core Start</label>
                            <input 
                                type="time" 
                                required 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-gray-105 rounded-xl text-xs font-bold"
                                value={policyForm.core_start_time}
                                onChange={(e) => setPolicyForm({...policyForm, core_start_time: e.target.value})}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-750 uppercase block">Core End</label>
                            <input 
                                type="time" 
                                required 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-gray-105 rounded-xl text-xs font-bold"
                                value={policyForm.core_end_time}
                                onChange={(e) => setPolicyForm({...policyForm, core_end_time: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-750 uppercase block">Grace Period (Minutes)</label>
                        <input 
                            type="number" 
                            required 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-gray-105 rounded-xl text-xs font-bold"
                            value={policyForm.grace_period_mins}
                            onChange={(e) => setPolicyForm({...policyForm, grace_period_mins: parseInt(e.target.value) || 0})}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-750 uppercase block">Late Limit (Times/Month)</label>
                        <input 
                            type="number" 
                            required 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-gray-105 rounded-xl text-xs font-bold"
                            value={policyForm.late_arrival_limit}
                            onChange={(e) => setPolicyForm({...policyForm, late_arrival_limit: parseInt(e.target.value) || 0})}
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={submitting}
                        className="w-full bg-blue-600 hover:bg-blue-750 text-white font-bold text-xs py-3 rounded-xl transition-all shadow disabled:opacity-50 cursor-pointer"
                    >
                        {submitting ? 'Saving...' : 'Add Flex Policy'}
                    </button>
                </form>
            </div>
        </div>
    )
}
