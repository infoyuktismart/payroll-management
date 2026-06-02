import { useState, useEffect } from 'react'
import { useCompany } from '../context/CompanyContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Building, ShieldCheck, Mail, Phone, Globe, MapPin, Upload, Save, HelpCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { sanitizeFormData } from '../lib/formUtils'
import { logger } from '../lib/devLogger'
import SearchableSelect from '../components/ui/SearchableSelect'
import { usePlanEntitlements } from '../hooks/usePlanEntitlements'

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

export default function CompanySettings() {
    const { isAdmin } = useAuth()
    const { company, loading: contextLoading, updateCompany } = useCompany()
    const { canUseFeature, loading: entitlementLoading } = usePlanEntitlements()
    const toast = useToast()
    const canWhiteLabel = entitlementLoading || canUseFeature('white_labeling')

    const [activeTab, setActiveTab] = useState('profile')
    const [submitting, setSubmitting] = useState(false)
    const [logoUploading, setLogoUploading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        logo_url: '',
        address: '',
        pan_number: '',
        tan_number: '',
        gst_number: '',
        esic_number: '',
        epfo_number: '',
        state: '',
        city: '',
        pincode: '',
        phone: '',
        email: '',
        website: '',
        financial_year_start: '2026-04-01',
        primary_color: '',
        secondary_color: '',
        tenant_subdomain: ''
    })
    useEffect(() => {
        if (company) {
            setFormData({
                name: company.name || '',
                logo_url: company.logo_url || '',
                address: company.address || '',
                pan_number: company.pan_number || '',
                tan_number: company.tan_number || '',
                gst_number: company.gst_number || '',
                esic_number: company.esic_number || '',
                epfo_number: company.epfo_number || '',
                state: company.state || '',
                city: company.city || '',
                pincode: company.pincode || '',
                phone: company.phone || '',
                email: company.email || '',
                website: company.website || '',
                financial_year_start: company.financial_year_start || '2026-04-01',
                primary_color: company.primary_color || '',
                secondary_color: company.secondary_color || '',
                tenant_subdomain: company.tenant_subdomain || ''
            })
        }
    }, [company])

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        if (!isAdmin) {
            toast.error('Only administrators can modify company logo.')
            return
        }

        try {
            setLogoUploading(true)
            const fileExt = file.name.split('.').pop()
            const fileName = `logo-${Date.now()}.${fileExt}`
            const filePath = `public/${fileName}`

            // Upload the file to public bucket (create if not exists, fallback to public link on fail)
            const { error: uploadError } = await supabase.storage
                .from('company-assets')
                .upload(filePath, file)

            if (uploadError) {
                // If bucket doesn't exist, we can fallback to storing it as object
                throw uploadError
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('company-assets')
                .getPublicUrl(filePath)

            setFormData(prev => ({ ...prev, logo_url: publicUrl }))
            toast.success('Logo uploaded successfully!')
        } catch (error) {
            logger.error('Error uploading logo:', error)
            // If Supabase Storage is not fully configured, allow user to input direct image URL
            toast.warning('Could not upload file to storage. You can specify a logo image URL directly in the form.')
        } finally {
            setLogoUploading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!isAdmin) {
            toast.error('Access Denied: Only administrators can modify company settings.')
            return
        }

        try {
            setSubmitting(true)
            const sanitized = sanitizeFormData(formData)
            if (!canWhiteLabel) {
                delete sanitized.primary_color
                delete sanitized.secondary_color
                delete sanitized.tenant_subdomain
            }
            const result = await updateCompany(sanitized)
            if (!result.success) throw result.error
        } catch (error) {
            logger.error('Submit error:', error)
        } finally {
            setSubmitting(false)
        }
    }

    if (contextLoading) {
        return (
            <div className="flex justify-center items-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header banner */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-slate-50 rounded-full -z-10 opacity-60" />
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center text-white font-bold text-2xl shadow-xl shadow-slate-100 shrink-0 overflow-hidden border border-slate-800">
                        {formData.logo_url ? (
                            <img src={formData.logo_url} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            <Building className="w-10 h-10" />
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">{formData.name || 'Acme Solutions'}</h1>
                        <p className="text-slate-400 text-sm font-medium mt-1">Manage corporate branding, legal identifier records & state taxation details</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Mail className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Corporate Email</p>
                            <p className="mt-1 truncate text-sm font-bold text-slate-800">{formData.email || 'Not configured'}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <Phone className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Office Phone</p>
                            <p className="mt-1 truncate text-sm font-bold text-slate-800">{formData.phone || 'Not configured'}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                            <MapPin className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Registered Office</p>
                            <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-slate-800">
                                {[formData.address, formData.city, formData.state, formData.pincode].filter(Boolean).join(', ') || 'Not configured'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-100 gap-6">
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`pb-3 font-bold text-sm transition-all border-b-2 px-1 flex items-center gap-2 ${activeTab === 'profile' ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-600 hover:text-slate-800'}`}
                >
                    <Building className="w-4 h-4" />
                    Company Profile
                </button>
                <button
                    onClick={() => setActiveTab('legal')}
                    className={`pb-3 font-bold text-sm transition-all border-b-2 px-1 flex items-center gap-2 ${activeTab === 'legal' ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-600 hover:text-slate-800'}`}
                >
                    <ShieldCheck className="w-4 h-4" />
                    Legal & Compliance
                </button>
                <button
                    onClick={() => {
                        if (!canWhiteLabel) {
                            toast.error('White-labelling is available on the Enterprise plan.')
                            return
                        }
                        setActiveTab('branding')
                    }}
                    className={`pb-3 font-bold text-sm transition-all border-b-2 px-1 flex items-center gap-2 ${activeTab === 'branding' ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-600 hover:text-slate-800'} ${!canWhiteLabel ? 'opacity-50' : ''}`}
                >
                    <Globe className="w-4 h-4" />
                    White-Labelling & Themes
                </button>
            </div>

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-8">
                {activeTab === 'profile' && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 mb-2">Corporate Identity</h2>
                            <p className="text-xs text-gray-600 font-medium">Specify your corporate branding name and upload assets used in payslips and certificates.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                            {/* Logo upload card */}
                            <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center space-y-4 hover:border-slate-300 transition-all group">
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
                )}

                {activeTab === 'legal' && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 mb-2">Government Compliance & Legal IDs</h2>
                            <p className="text-xs text-gray-600 font-medium">Verify legal parameters required for statutory income tax (TDS), ESIC, EPFO returns, and payslips.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label htmlFor="auto-id-companysettings-66" className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Company PAN (10 chars)</label>
                                    <HelpCircle className="w-3.5 h-3.5 text-gray-300 cursor-help" title="Income Tax permanent account number" />
                                </div>
                                <input id="auto-id-companysettings-66"
                                    type="text"
                                    name="pan_number"
                                    maxLength={10}
                                    value={formData.pan_number}
                                    onChange={handleChange}
                                    disabled={!isAdmin || submitting}
                                    placeholder="e.g. ABCDE1234F"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all uppercase placeholder:text-slate-400"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label htmlFor="auto-id-companysettings-67" className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Company TAN (10 chars)</label>
                                    <HelpCircle className="w-3.5 h-3.5 text-gray-300 cursor-help" title="Tax deduction and collection account number" />
                                </div>
                                <input id="auto-id-companysettings-67"
                                    type="text"
                                    name="tan_number"
                                    maxLength={10}
                                    value={formData.tan_number}
                                    onChange={handleChange}
                                    disabled={!isAdmin || submitting}
                                    placeholder="e.g. DELA12345B"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all uppercase placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-1">
                                <label htmlFor="auto-id-companysettings-68" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">GSTIN Identifier</label>
                                <input id="auto-id-companysettings-68"
                                    type="text"
                                    name="gst_number"
                                    maxLength={15}
                                    value={formData.gst_number}
                                    onChange={handleChange}
                                    disabled={!isAdmin || submitting}
                                    placeholder="e.g. 07AAAAA1111A1Z1"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all uppercase placeholder:text-slate-400"
                                />
                            </div>

                            <div>
                                <label htmlFor="auto-id-companysettings-69" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">EPFO Number (15 chars)</label>
                                <input id="auto-id-companysettings-69"
                                    type="text"
                                    name="epfo_number"
                                    maxLength={15}
                                    value={formData.epfo_number}
                                    onChange={handleChange}
                                    disabled={!isAdmin || submitting}
                                    placeholder="e.g. DLCPM0012345000"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all uppercase placeholder:text-slate-400"
                                />
                            </div>

                            <div>
                                <label htmlFor="auto-id-companysettings-70" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">ESIC Number (17 chars)</label>
                                <input id="auto-id-companysettings-70"
                                    type="text"
                                    name="esic_number"
                                    maxLength={17}
                                    value={formData.esic_number}
                                    onChange={handleChange}
                                    disabled={!isAdmin || submitting}
                                    placeholder="e.g. 12345678901234567"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        <hr className="border-gray-100" />
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 mb-2">Accounting Period Configuration</h2>
                            <p className="text-xs text-gray-600 font-medium">Verify financial bookkeeping terms that orchestrate tax declaration deadlines.</p>
                        </div>

                        <div>
                            <label htmlFor="auto-id-companysettings-71" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Financial Year Launch Date</label>
                            <input id="auto-id-companysettings-71"
                                type="date"
                                required
                                name="financial_year_start"
                                value={formData.financial_year_start}
                                onChange={handleChange}
                                disabled={!isAdmin || submitting}
                                className="w-full max-w-sm px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all"
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'branding' && (
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
                )}

                {/* Footer Save Button */}
                {isAdmin && (
                    <div className="flex justify-end pt-4 border-t border-gray-50">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-slate-100 flex items-center gap-2 hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {submitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/50 border-t-white" />
                                    <span>Saving Changes...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>Save Settings</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </form>
        </div>
    )
}
