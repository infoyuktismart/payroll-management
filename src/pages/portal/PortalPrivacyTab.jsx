import { useState, useEffect } from 'react'
import { Shield, Download, Trash2, CheckCircle, AlertTriangle, ShieldAlert, Key, Clipboard, HelpCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { applyCompanyFilter, withCompanyScope } from '../../services/tenantScope'

export default function PortalPrivacyTab({
    currentEmployee,
    viewAsId,
    isAdmin,
    toast
}) {
    const [hasConsent, setHasConsent] = useState(false)
    const [consentRecord, setConsentRecord] = useState(null)
    const [consentLoading, setConsentLoading] = useState(true)
    const [acceptingConsent, setAcceptingConsent] = useState(false)
    const [downloading, setDownloading] = useState(false)
    const [anonymizing, setAnonymizing] = useState(false)
    const [showAnonymizeModal, setShowAnonymizeModal] = useState(false)
    const [userIp, setUserIp] = useState('Detecting...')
    const [acceptedCheckbox, setAcceptedCheckbox] = useState(false)

    // Detect user IP
    const detectIp = async () => {
        try {
            const res = await fetch('https://api.ipify.org?format=json')
            const data = await res.json()
            setUserIp(data.ip || '127.0.0.1')
        } catch (err) {
            console.error('IP detection failed:', err)
            setUserIp('127.0.0.1')
        }
    }

    // Check existing consent record
    const checkConsent = async () => {
        if (!viewAsId) return
        setConsentLoading(true)
        try {
            const { data, error } = await applyCompanyFilter(
                supabase
                    .from('privacy_consents')
                    .select('*')
            )
                .eq('employee_id', viewAsId)
                .order('accepted_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (error) throw error

            if (data) {
                setHasConsent(true)
                setConsentRecord(data)
            } else {
                setHasConsent(false)
                setConsentRecord(null)
            }
        } catch (err) {
            console.error('Error fetching privacy consent:', err)
        } finally {
            setConsentLoading(false)
        }
    }

    useEffect(() => {
        detectIp()
        checkConsent()
    }, [viewAsId])

    const handleAcceptConsent = async () => {
        if (!acceptedCheckbox) {
            toast.warning('Please confirm that you have read and agree to the privacy policy terms.')
            return
        }
        if (!viewAsId || !currentEmployee) return

        setAcceptingConsent(true)
        try {
            const payload = withCompanyScope({
                employee_id: viewAsId,
                consent_version: '1.0',
                ip_address: userIp,
                accepted_at: new Date().toISOString(),
                metadata: {
                    browser: navigator.userAgent,
                    platform: navigator.platform,
                    compliance_frameworks: ['GDPR', 'DPDP_INDIA_2023']
                }
            })

            const { data, error } = await supabase
                .from('privacy_consents')
                .insert([payload])
                .select('*')
                .single()

            if (error) throw error

            setHasConsent(true)
            setConsentRecord(data)
            toast.success('Thank you! Your privacy consent has been securely recorded for audit compliance.')
        } catch (err) {
            console.error('Consent error:', err)
            toast.error('Failed to log consent: ' + err.message)
        } finally {
            setAcceptingConsent(false)
        }
    }

    const handleDownloadData = async () => {
        if (!viewAsId) return
        setDownloading(true)
        toast.info('Compiling your personal data registry package. This might take a few seconds...')

        try {
            // Concurrent execution to compile all PII tables
            const [
                empRes,
                attRes,
                leaveRes,
                taxRes,
                payrollRes,
                consentsRes
            ] = await Promise.all([
                supabase.from('employees').select('*').eq('id', viewAsId).single(),
                applyCompanyFilter(supabase.from('attendance').select('*')).eq('employee_id', viewAsId).order('date', { ascending: false }),
                applyCompanyFilter(supabase.from('leaves').select('*')).eq('employee_id', viewAsId).order('start_date', { ascending: false }),
                applyCompanyFilter(supabase.from('tax_declarations').select('*')).eq('employee_id', viewAsId),
                applyCompanyFilter(supabase.from('payroll_items').select('*')).eq('employee_id', viewAsId).order('created_at', { ascending: false }),
                applyCompanyFilter(supabase.from('privacy_consents').select('*')).eq('employee_id', viewAsId).order('accepted_at', { ascending: false })
            ])

            if (empRes.error) throw empRes.error

            const exportData = {
                metadata: {
                    compliance_regulatory_standard: 'GDPR / India Digital Personal Data Protection (DPDP) Act 2023',
                    export_timestamp: new Date().toISOString(),
                    exported_by_id: viewAsId,
                    data_subject_name: `${empRes.data.first_name} ${empRes.data.last_name}`,
                    tenant_company_id: empRes.data.company_id
                },
                profile: {
                    employee_id: empRes.data.employee_id,
                    first_name: empRes.data.first_name,
                    last_name: empRes.data.last_name,
                    email: empRes.data.email,
                    phone: empRes.data.phone,
                    role: empRes.data.role,
                    designation: empRes.data.designation,
                    department: empRes.data.department,
                    joining_date: empRes.data.joining_date,
                    emergency_contact: {
                        name: empRes.data.emergency_contact_person,
                        phone: empRes.data.emergency_contact_number,
                        relationship: empRes.data.emergency_contact_relationship
                    },
                    current_address: empRes.data.current_address,
                    permanent_address: empRes.data.permanent_address,
                    status: empRes.data.status
                },
                attendance_records: (attRes.data || []).map(r => ({
                    date: r.date,
                    status: r.status,
                    check_in: r.check_in,
                    check_out: r.check_out,
                    remarks: r.remarks
                })),
                leave_records: (leaveRes.data || []).map(r => ({
                    leave_type: r.leave_type,
                    start_date: r.start_date,
                    end_date: r.end_date,
                    days: r.days,
                    status: r.status,
                    reason: r.reason
                })),
                tax_declarations: (taxRes.data || []).map(r => ({
                    financial_year: r.financial_year,
                    regime: r.regime,
                    section_80c: r.section_80c,
                    section_80d: r.section_80d,
                    hra_exemption: r.hra_exemption,
                    home_loan_interest: r.home_loan_interest,
                    other_deductions: r.other_deductions,
                    other_income: r.other_income,
                    status: r.status
                })),
                payroll_slips_aggregates: (payrollRes.data || []).map(r => ({
                    id: r.id,
                    basic_salary: r.basic_salary,
                    net_salary: r.net_salary,
                    total_allowances: r.total_allowances,
                    total_deductions: r.total_deductions,
                    attendance_days: r.attendance_days,
                    created_at: r.created_at
                })),
                logged_consents: (consentsRes.data || []).map(r => ({
                    consent_version: r.consent_version,
                    accepted_at: r.accepted_at,
                    ip_address: r.ip_address,
                    metadata: r.metadata
                }))
            }

            const jsonString = JSON.stringify(exportData, null, 4)
            const blob = new Blob([jsonString], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `personal_data_export_${empRes.data.employee_id || viewAsId}_${new Date().toISOString().split('T')[0]}.json`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)

            toast.success('Your comprehensive data package has been successfully downloaded.')
        } catch (err) {
            console.error('Data download error:', err)
            toast.error('Failed to compile data package: ' + err.message)
        } finally {
            setDownloading(false)
        }
    }

    const handleAnonymizeProfile = async () => {
        if (!isAdmin) {
            toast.error('Unauthorized: Only HR or Administrators are permitted to purge employee data.')
            return
        }
        if (!viewAsId) return

        setAnonymizing(true)
        try {
            const { error } = await supabase.rpc('anonymize_employee_profile', {
                p_employee_id: viewAsId
            })

            if (error) throw error

            toast.success('Employee profile has been successfully anonymized and detached from corporate login systems.')
            setShowAnonymizeModal(false)

            // Force refresh workspace
            setTimeout(() => {
                window.location.reload()
            }, 1500)
        } catch (err) {
            console.error('Anonymization error:', err)
            toast.error('Purge transaction failed: ' + err.message)
        } finally {
            setAnonymizing(false)
        }
    }

    if (consentLoading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto"></div>
                <p className="text-sm font-bold text-gray-500 mt-4">Verifying statutory compliance records...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header Pane */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-6 shadow-md border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="space-y-2 max-w-2xl relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/20">
                        <Shield className="w-3.5 h-3.5" /> GDPR & DPDP Act 2023 Compliant
                    </div>
                    <h3 className="text-2xl font-black tracking-tight Outfit">Privacy Control & Trust Center</h3>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">
                        Manage your data subject rights, consent declarations, and information privacy settings in compliance with international and regional privacy laws.
                    </p>
                </div>
                <div className="shrink-0 flex items-center gap-4 relative z-10">
                    {hasConsent ? (
                        <div className="flex items-center gap-2.5 bg-emerald-500/20 border border-emerald-400/30 px-5 py-3 rounded-xl">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                            <div className="text-left">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 leading-none">Status</p>
                                <p className="text-sm font-black text-white mt-1">Consent Version 1.0 Active</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2.5 bg-amber-500/20 border border-amber-400/30 px-5 py-3 rounded-xl">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></div>
                            <div className="text-left">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 leading-none">Action Required</p>
                                <p className="text-sm font-black text-white mt-1">Accept Privacy Policy</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Grid for Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left panel: Consent check or accepted status */}
                <div className="lg:col-span-2 space-y-6">
                    {!hasConsent ? (
                        <div className="bg-white rounded-2xl border-2 border-amber-200 overflow-hidden shadow-md animate-in slide-in-from-bottom duration-300">
                            <div className="bg-amber-50 px-6 py-4 border-b border-amber-200 flex items-center gap-3">
                                <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
                                <div>
                                    <h4 className="text-md font-bold text-amber-800">Statutory Consent Needed</h4>
                                    <p className="text-xs text-amber-700/80 font-medium">India's Digital Personal Data Protection (DPDP) Act & GDPR mandate explicit user consent.</p>
                                </div>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                    Please review our information processing policies below. By checking the consent box, you grant the organization permission to securely compute and store your salary structure, attendance coordinates, and tax declarations.
                                </p>

                                <div className="h-64 overflow-y-auto border border-gray-200 rounded-xl p-4 bg-slate-50 text-xs font-semibold text-gray-600 leading-relaxed space-y-3 font-mono">
                                    <p className="font-bold text-slate-800 text-sm">PRIVACY STATEMENT & DATA PROCESSING AGREEMENT (V1.0)</p>
                                    <p>1. PURPOSE: We process your name, contact details, identification tags (Aadhaar/PAN), bank coordinates, and attendance metrics strictly for the purpose of managing legal payroll computation, tax compliance filing (TDS/PF/ESI), and professional execution of employment duties.</p>
                                    <p>2. SHARING: Your payroll numeric summaries are securely dispatched to statutory government portals, banking clearing systems, and tax auditing bodies only. Third-party commercial sharing is strictly prohibited.</p>
                                    <p>3. RIGHTS: Under GDPR and the DPDP Act 2023, you hold the right to obtain data transcripts (Download My Data), request core corrections, or request deletion (Right to Be Forgotten/Anonymization) upon formal exit or termination of services.</p>
                                    <p>4. SECURITY: All sensitive variables (PAN, bank accounts) are stored inside the database under AES-256 equivalent standard hashing frameworks. Connection profiles utilize TLS encryption boundaries.</p>
                                </div>

                                <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                                    <input
                                        type="checkbox"
                                        id="consent_check"
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5 cursor-pointer"
                                        checked={acceptedCheckbox}
                                        onChange={(e) => setAcceptedCheckbox(e.target.checked)}
                                    />
                                    <label htmlFor="consent_check" className="text-xs font-bold text-slate-700 leading-tight cursor-pointer">
                                        I hereby declare that I have read the privacy terms, and I explicitly consent to the collection, hosting, processing, and mandatory audit distribution of my statutory work logs and employee details.
                                    </label>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <div className="text-xs text-gray-500">
                                        Logging acceptance from IP: <span className="font-bold font-mono text-slate-800">{userIp}</span>
                                    </div>
                                    <button
                                        onClick={handleAcceptConsent}
                                        disabled={acceptingConsent || !acceptedCheckbox}
                                        className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm flex items-center gap-2 ${
                                            acceptedCheckbox
                                                ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                                                : 'bg-gray-300 cursor-not-allowed'
                                        }`}
                                    >
                                        {acceptingConsent ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                Recording...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="w-4 h-4" /> Accept & Authorize
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center gap-3">
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                                <h4 className="text-md font-bold text-slate-800">Consent Log Verification</h4>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 space-y-4">
                                    <p className="text-sm font-bold text-slate-700">
                                        Your legal agreement to processing coordinates is confirmed and registered with the following security metadata:
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-gray-600">
                                        <div className="p-3 bg-white rounded-lg border border-gray-100">
                                            <p className="text-gray-400 text-[10px] uppercase font-bold">Consent Version</p>
                                            <p className="text-slate-800 font-bold text-sm mt-0.5">{consentRecord.consent_version}</p>
                                        </div>
                                        <div className="p-3 bg-white rounded-lg border border-gray-100">
                                            <p className="text-gray-400 text-[10px] uppercase font-bold">Registered Timestamp</p>
                                            <p className="text-slate-800 font-bold text-sm mt-0.5">{new Date(consentRecord.accepted_at).toLocaleString()}</p>
                                        </div>
                                        <div className="p-3 bg-white rounded-lg border border-gray-100">
                                            <p className="text-gray-400 text-[10px] uppercase font-bold">Originating IP Address</p>
                                            <p className="text-slate-800 font-bold text-sm mt-0.5 font-mono">{consentRecord.ip_address || 'N/A'}</p>
                                        </div>
                                        <div className="p-3 bg-white rounded-lg border border-gray-100">
                                            <p className="text-gray-400 text-[10px] uppercase font-bold">Regulatory Frameworks</p>
                                            <p className="text-slate-800 font-bold text-sm mt-0.5">{consentRecord.metadata?.compliance_frameworks?.join(', ') || 'GDPR / DPDP'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500 leading-relaxed font-semibold bg-blue-50/50 p-3.5 rounded-lg border border-blue-100/50 flex items-start gap-2.5">
                                    <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                    <span>
                                        To withdraw consent or query database retention configurations, you may formalize a request to your corporate Data Protection Officer (DPO) at any time. Processing actions taken prior to withdrawal remain audit-lawful.
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Data Subjects Rights Guidance */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                            <h4 className="text-md font-bold text-slate-800">Your Privacy Rights Quick Reference</h4>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl border border-gray-100 bg-gradient-to-br from-blue-50/20 to-indigo-50/20 space-y-1">
                                <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs inline-block"><Key className="w-4 h-4" /></span>
                                <h5 className="text-sm font-bold text-slate-800 mt-2">Right to Portability</h5>
                                <p className="text-xs text-gray-500 leading-relaxed font-medium">Export a machine-readable JSON copy of all personal telemetry and employment metadata at your convenience.</p>
                            </div>
                            <div className="p-4 rounded-xl border border-gray-100 bg-gradient-to-br from-emerald-50/20 to-teal-50/20 space-y-1">
                                <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs inline-block"><Clipboard className="w-4 h-4" /></span>
                                <h5 className="text-sm font-bold text-slate-800 mt-2">Right of Correction</h5>
                                <p className="text-xs text-gray-500 leading-relaxed font-medium">Maintain fully accurate records. You may update address templates, contact details, or request document changes via the personal profile panel.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right panel: Download Data & Forgotten actions */}
                <div className="space-y-6">
                    {/* Download Package Card */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                            <h4 className="text-md font-bold text-slate-800">Data Portability</h4>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                                Receive a complete consolidated package containing your profile credentials, leave parameters, attendance punch timestamps, tax declarations, and payslip variables.
                            </p>
                            <button
                                onClick={handleDownloadData}
                                disabled={downloading}
                                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                            >
                                {downloading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Compiling Package...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4" /> Download My Data (JSON)
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Right to be Forgotten / Anonymize Profile */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                            <h4 className="text-md font-bold text-slate-800">Right to Be Forgotten</h4>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                                Request full permanent erasure of your personal records and system credentials. Under statutory employment auditing rules, numeric totals are retained for corporate accounting logs.
                            </p>

                            {isAdmin ? (
                                <div className="space-y-3">
                                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-xs font-bold text-red-700">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>ADMIN PRIVILEGE ENABLED: You can instantly trigger anonymization of this profile. This action is permanent.</span>
                                    </div>
                                    <button
                                        onClick={() => setShowAnonymizeModal(true)}
                                        className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                                    >
                                        <Trash2 className="w-4 h-4" /> Anonymize Employee Profile
                                    </button>
                                </div>
                            ) : (
                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs font-bold text-slate-600">
                                    <HelpCircle className="w-4 h-4 mx-auto mb-2 text-gray-400" />
                                    <span>To request data scrubbing, please contact your registered company Data Protection Officer (DPO).</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Anonymize Confirmation Modal */}
            {showAnonymizeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-red-100 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center gap-3">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                            <h3 className="text-lg font-black text-red-900">Irreversible Action Warning</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm font-bold text-slate-700 leading-relaxed">
                                You are about to permanently scrub all personal identifiers (PII) for employee <span className="font-extrabold text-slate-900">"{currentEmployee?.first_name} {currentEmployee?.last_name}"</span>.
                            </p>
                            
                            <ul className="text-xs font-semibold text-slate-500 space-y-2 list-disc list-inside bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <li>All names, emails, phones, and addresses will be permanently set to anonymous tags.</li>
                                <li>Aadhaar, PAN, and UAN identifiers will be deleted.</li>
                                <li>The employee will be detached from auth logs and cannot sign in.</li>
                                <li className="font-bold text-red-700">Audit-mandated statutory payroll records and numeric ledger sums will be preserved.</li>
                            </ul>

                            <p className="text-xs text-red-600 font-bold">
                                This action is legally binding, transactional, and CANNOT BE UNDONE. Are you absolutely sure you wish to execute the purge?
                            </p>

                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={() => setShowAnonymizeModal(false)}
                                    disabled={anonymizing}
                                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAnonymizeProfile}
                                    disabled={anonymizing}
                                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:bg-red-400"
                                >
                                    {anonymizing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Purging...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="w-4 h-4" /> Purge and Anonymize
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
