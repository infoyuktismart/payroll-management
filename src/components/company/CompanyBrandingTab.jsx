export default function CompanyBrandingTab({
    formData,
    handleChange,
    isAdmin,
    submitting
}) {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-bold text-slate-800 mb-2">Enterprise White-Labelling & Themes</h2>
                <p className="text-xs text-gray-600 font-medium">Customize your platform styling, color palettes, and configure custom subdomains for tenant isolation.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="auto-id-companysettings-brand-1" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Primary Theme Color</label>
                    <div className="flex items-center gap-3">
                        <input id="auto-id-companysettings-brand-1"
                            type="color"
                            name="primary_color"
                            value={formData.primary_color || '#2563eb'}
                            onChange={handleChange}
                            disabled={!isAdmin || submitting}
                            className="w-12 h-12 bg-transparent border-0 cursor-pointer rounded"
                        />
                        <input
                            type="text"
                            name="primary_color"
                            maxLength={7}
                            value={formData.primary_color}
                            onChange={handleChange}
                            disabled={!isAdmin || submitting}
                            placeholder="#2563eb"
                            className="flex-1 px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-semibold text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all placeholder:text-slate-400"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="auto-id-companysettings-brand-2" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Secondary Theme Color</label>
                    <div className="flex items-center gap-3">
                        <input id="auto-id-companysettings-brand-2"
                            type="color"
                            name="secondary_color"
                            value={formData.secondary_color || '#4f46e5'}
                            onChange={handleChange}
                            disabled={!isAdmin || submitting}
                            className="w-12 h-12 bg-transparent border-0 cursor-pointer rounded"
                        />
                        <input
                            type="text"
                            name="secondary_color"
                            maxLength={7}
                            value={formData.secondary_color}
                            onChange={handleChange}
                            disabled={!isAdmin || submitting}
                            placeholder="#4f46e5"
                            className="flex-1 px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-semibold text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </div>

            <div>
                <label htmlFor="auto-id-companysettings-brand-3" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tenant Subdomain Scoping</label>
                <div className="relative flex items-center">
                    <input id="auto-id-companysettings-brand-3"
                        type="text"
                        name="tenant_subdomain"
                        value={formData.tenant_subdomain}
                        onChange={handleChange}
                        disabled={!isAdmin || submitting}
                        placeholder="e.g. acme"
                        className="w-full pl-4 pr-32 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-semibold text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all placeholder:text-slate-400"
                    />
                    <span className="absolute right-4 text-sm font-bold text-slate-400 select-none pointer-events-none">
                        .ourpayroll.com
                    </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium mt-2 leading-relaxed">
                    * Sets up routing scoping. Standard users visiting this subdomain will strictly view and authenticate with this tenant's workspace boundary. Local testing supports <code className="bg-slate-50 border border-gray-200 px-1 py-0.2 rounded font-mono text-xs">?tenant=subdomain</code> parameter simulation.
                </p>
            </div>
        </div>
    )
}
