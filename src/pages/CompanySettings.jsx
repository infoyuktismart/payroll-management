import { useState, useEffect } from 'react'
import { useCompany } from '../context/CompanyContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Mail, Phone, MapPin, Save, AlertTriangle } from 'lucide-react'
import { companyService } from '../services/companyService'
import { sanitizeFormData } from '../lib/formUtils'
import { logger } from '../lib/devLogger'
import { usePlanEntitlements } from '../hooks/usePlanEntitlements'
import { validateCompanyLegalField } from '../lib/validators'

// Subcomponents
import CompanySettingsHeader from '../components/company/CompanySettingsHeader'
import CompanyProfileTab from '../components/company/CompanyProfileTab'
import CompanyLegalTab from '../components/company/CompanyLegalTab'
import CompanyBrandingTab from '../components/company/CompanyBrandingTab'

export default function CompanySettings() {
    const { isAdmin } = useAuth()
    const { company, loading: contextLoading, updateCompany } = useCompany()
    const { canUseFeature, loading: entitlementLoading } = usePlanEntitlements()
    const toast = useToast()
    const canWhiteLabel = entitlementLoading || canUseFeature('white_labeling')

    const [activeTab, setActiveTab] = useState('profile')
    const [submitting, setSubmitting] = useState(false)
    const [logoUploading, setLogoUploading] = useState(false)
    const [legalErrors, setLegalErrors] = useState({})
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

    // Receives real-time validation results from CompanyLegalTab
    const handleLegalValidate = (name, error) => {
        setLegalErrors(prev => {
            const next = { ...prev }
            if (error) next[name] = error
            else delete next[name]
            return next
        })
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
            const publicUrl = await companyService.uploadLogo({ file })
            setFormData(prev => ({ ...prev, logo_url: publicUrl }))
            toast.success('Logo uploaded successfully!')
        } catch (error) {
            logger.error('Error uploading logo:', error)
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

        // Block save if any legal field has a format error
        if (activeTab === 'legal' && Object.keys(legalErrors).length > 0) {
            toast.error('Please fix the highlighted statutory ID errors before saving.')
            return
        }

        // Run a full legal field validation sweep on the current formData before submitting
        if (activeTab === 'legal') {
            const legalFields = ['pan_number', 'tan_number', 'gst_number', 'epfo_number', 'esic_number']
            const freshErrors = {}
            legalFields.forEach(field => {
                const err = validateCompanyLegalField(field, formData[field])
                if (err) freshErrors[field] = err
            })
            if (Object.keys(freshErrors).length > 0) {
                setLegalErrors(freshErrors)
                toast.error('Please fix the highlighted statutory ID errors before saving.')
                return
            }
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
        <div className="space-y-6">
            <CompanySettingsHeader
                logoUrl={formData.logo_url}
                companyName={formData.name}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                canWhiteLabel={canWhiteLabel}
            />

            {/* Quick stats contacts and office location cards */}
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

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-8">
                {activeTab === 'profile' && (
                    <CompanyProfileTab
                        formData={formData}
                        handleChange={handleChange}
                        logoUploading={logoUploading}
                        handleLogoUpload={handleLogoUpload}
                        isAdmin={isAdmin}
                        submitting={submitting}
                    />
                )}

                {activeTab === 'legal' && (
                    <CompanyLegalTab
                        formData={formData}
                        handleChange={handleChange}
                        isAdmin={isAdmin}
                        submitting={submitting}
                        errors={legalErrors}
                        onValidate={handleLegalValidate}
                    />
                )}

                {activeTab === 'branding' && (
                    <CompanyBrandingTab
                        formData={formData}
                        handleChange={handleChange}
                        isAdmin={isAdmin}
                        submitting={submitting}
                    />
                )}

                {/* Footer Save Button */}
                {isAdmin && (
                    <div className="flex justify-end items-center gap-4 pt-4 border-t border-gray-50">
                        {activeTab === 'legal' && Object.keys(legalErrors).length > 0 && (
                            <p className="text-xs font-bold text-rose-500 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Fix {Object.keys(legalErrors).length} statutory ID error{Object.keys(legalErrors).length > 1 ? 's' : ''} before saving
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={submitting || (activeTab === 'legal' && Object.keys(legalErrors).length > 0)}
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
