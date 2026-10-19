import { Building, Upload, Globe, Mail, Phone, MapPin } from 'lucide-react'
import SearchableSelect from '../ui/SearchableSelect'

const STATE_OPTIONS = [
    {
        label: 'States',
        options: [
            'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 
            'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 
            'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
            'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 
            'Uttarakhand', 'West Bengal'
        ]
    },
    {
        label: 'Union Territories',
        options: [
            'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
            'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
        ]
    }
]

export default function CompanyProfileTab({
    formData,
    handleChange,
    logoUploading,
    handleLogoUpload,
    isAdmin,
    submitting
}) {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-bold text-slate-800 mb-2">Corporate Identity</h2>
                <p className="text-xs text-gray-600 font-medium">Specify your corporate branding name and upload assets used in payslips and certificates.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                {/* Logo upload card */}
                <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center space-y-4 hover:border-slate-300 transition-all group w-full">
                    <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto border border-gray-100 overflow-hidden relative">
                        {formData.logo_url ? (
                            <img src={formData.logo_url} alt="Logo Preview" className="w-full h-full object-cover" />
                        ) : (
                            <Building className="w-8 h-8 text-gray-300 group-hover:scale-110 transition-transform" />
                        )}
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-800">Corporate Logo</p>
                        <p className="text-[10px] text-gray-600 mt-1">SVG, PNG or JPG (Max 500KB)</p>
                    </div>
                    {isAdmin && (
                        <label className="inline-flex items-center gap-2 bg-slate-50 border border-gray-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer hover:bg-slate-100 active:scale-95 transition-all">
                            <Upload className="w-3.5 h-3.5" />
                            <span>{logoUploading ? 'Uploading...' : 'Choose File'}</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
                        </label>
                    )}
                </div>

                {/* Core Inputs */}
                <div className="md:col-span-2 space-y-6">
                    <div>
                        <label htmlFor="auto-id-companysettings-59" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Company Name *</label>
                        <input id="auto-id-companysettings-59"
                            type="text"
                            required
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            disabled={!isAdmin || submitting}
                            placeholder="e.g. Acme Solutions Private Limited"
                            className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all placeholder:text-slate-400"
                        />
                    </div>

                    <div>
                        <label htmlFor="auto-id-companysettings-60" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Website URL</label>
                        <div className="relative">
                            <Globe className="w-4 h-4 text-gray-300 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input id="auto-id-companysettings-60"
                                type="url"
                                name="website"
                                value={formData.website}
                                onChange={handleChange}
                                disabled={!isAdmin || submitting}
                                placeholder="e.g. https://acme.com"
                                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Contacts & Address */}
            <hr className="border-gray-100" />
            <div>
                <h2 className="text-lg font-bold text-slate-800 mb-2">Communication & Office Location</h2>
                <p className="text-xs text-gray-600 font-medium">Used for tax invoice declarations, billing details, and government registry compliance.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="auto-id-companysettings-61" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Corporate Email</label>
                    <div className="relative">
                        <Mail className="w-4 h-4 text-gray-300 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input id="auto-id-companysettings-61"
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            disabled={!isAdmin || submitting}
                            placeholder="e.g. accounting@acme.com"
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all placeholder:text-slate-400"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="auto-id-companysettings-62" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Office Phone Number</label>
                    <div className="relative">
                        <Phone className="w-4 h-4 text-gray-300 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input id="auto-id-companysettings-62"
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            disabled={!isAdmin || submitting}
                            placeholder="e.g. +91 11 4321 8765"
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Registered Office Address</label>
                <div className="relative">
                    <MapPin className="w-4 h-4 text-gray-300 absolute left-4 top-4" />
                    <textarea
                        name="address"
                        rows={3}
                        value={formData.address}
                        onChange={handleChange}
                        disabled={!isAdmin || submitting}
                        placeholder="House No, Building, Industrial Area, Sector..."
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all placeholder:text-slate-400 resize-none"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label htmlFor="auto-id-companysettings-63" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">City</label>
                    <input id="auto-id-companysettings-63"
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        disabled={!isAdmin || submitting}
                        placeholder="e.g. New Delhi"
                        className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all placeholder:text-slate-400"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">State / Union Territory</label>
                    <SearchableSelect
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        disabled={!isAdmin || submitting}
                        options={STATE_OPTIONS}
                        placeholder="Select State / UT"
                    />
                </div>

                <div>
                    <label htmlFor="auto-id-companysettings-65" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">PIN Code</label>
                    <input id="auto-id-companysettings-65"
                        type="text"
                        name="pincode"
                        value={formData.pincode}
                        onChange={handleChange}
                        disabled={!isAdmin || submitting}
                        placeholder="e.g. 110001"
                        className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all placeholder:text-slate-400"
                    />
                </div>
            </div>
        </div>
    )
}
