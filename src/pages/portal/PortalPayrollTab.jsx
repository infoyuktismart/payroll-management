import { useState } from 'react'
import { WalletCards, Calendar, PiggyBank, Landmark, FileText, Eye, Calculator, Loader2, Shield, Download, X, Printer } from 'lucide-react'
import { useCompany } from '../../context/CompanyContext'

export default function PortalPayrollTab({
    currentEmployee,
    isAdmin: _isAdmin,
    monthlySalary,
    annualSalary,
    payFrequency,
    nextPayDate,
    ytdEarnings,
    taxDeclaration,
    taxForm,
    updateTaxForm,
    canEditTaxDeclaration,
    maskedIdentifier,
    taxFinancialYear,
    taxPreview,
    monthlyTdsPreview,
    savingTaxDeclaration,
    saveTaxDeclaration,
    benefitRows,
    totalBenefitDeduction,
    latestPayslips,
    formatMonthYearSafe,
    formatCurrency,
    toast
}) {
    const { company } = useCompany()
    const [selectedSlip, setSelectedSlip] = useState(null)
    const [downloading, setDownloading] = useState(false)

    // Admin payslip overlay helper
    const [showPayslipOverlay, setShowPayslipOverlay] = useState(false)
    const [overlaySelectedSlip, setOverlaySelectedSlip] = useState(null)

    const openPayslipOverlay = () => {
        if (!latestPayslips.length) {
            toast.error('No payslips available for this employee.')
            return
        }
        setOverlaySelectedSlip(latestPayslips[0])
        setShowPayslipOverlay(true)
    }

    const handleOverlayPrint = (slip) => {
        if (!slip) return
        setSelectedSlip(slip)
        setTimeout(() => window.print(), 450)
    }

    const handleOverlayDownload = (slip) => {
        if (!slip) return
        setSelectedSlip(slip)
        setTimeout(() => {
            handleDownloadPDF(slip)
        }, 500)
    }

    const handleDownloadPDF = async (slip = selectedSlip) => {
        if (!slip) return
        setDownloading(true)
        const element = document.getElementById('payslip-content')
        try {
            const [{ default: jsPDFLib }, { default: html2canvasLib }] = await Promise.all([
                import('jspdf'),
                import('html2canvas')
            ])
            
            const canvas = await html2canvasLib(element, {
                scale: 1.5,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    const clonedRoot = clonedDoc.getElementById('payslip-content');
                    if (clonedRoot) {
                        const styles = clonedDoc.getElementsByTagName('style');
                        const links = clonedDoc.getElementsByTagName('link');
                        while (styles.length > 0) styles[0].parentNode.removeChild(styles[0]);
                        while (links.length > 0) links[0].parentNode.removeChild(links[0]);

                        const stripClasses = (el) => {
                            el.removeAttribute('class');
                            [...el.children].forEach(stripClasses);
                        };
                        stripClasses(clonedRoot);

                        clonedRoot.style.width = '794px';
                        clonedRoot.style.maxWidth = 'none';
                        clonedRoot.style.minHeight = '1123px';
                        clonedRoot.style.margin = '0 auto';
                        clonedRoot.style.padding = '40px';
                        clonedRoot.style.backgroundColor = '#ffffff';
                        clonedRoot.style.position = 'static';
                        clonedRoot.style.overflow = 'visible';
                    }
                }
            })

            const imgData = canvas.toDataURL('image/jpeg', 0.95)
            if (!imgData || imgData.length < 500) {
                throw new Error('Image capture failed - rendered content is empty')
            }

            const pdf = new jsPDFLib('p', 'mm', 'a4')
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)

            const monthName = slip.payroll_run
                ? formatMonthYearSafe(slip.payroll_run.month_year, 'Payslip')
                : 'Payslip'
            const sanitizedName = `${currentEmployee.first_name}_${currentEmployee.last_name}`.replace(/[^a-z0-9]/gi, '_')
            const sanitizedID = (currentEmployee.employee_id || 'ID').toString().replace(/[^a-z0-9]/gi, '_')
            const sanitizedMonth = monthName.replace(/[^a-z0-9]/gi, '_')
            const fileName = `Payslip_${sanitizedName}_${sanitizedID}_${sanitizedMonth}.pdf`

            const pdfBlob = pdf.output('blob')
            const url = window.URL.createObjectURL(pdfBlob)
            const link = document.createElement('a')
            link.style.display = 'none'
            link.href = url
            link.setAttribute('download', fileName)
            document.body.appendChild(link)
            link.click()

            setTimeout(() => {
                document.body.removeChild(link)
                window.URL.revokeObjectURL(url)
            }, 2000)
        } catch (error) {
            console.error('PDF Error:', error)
            toast.error('Failed to generate PDF: ' + (error.message || 'Unknown error'))
        } finally {
            setDownloading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Payroll & Benefits</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Monthly salary, tax profile, benefits, and recent payslips</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={openPayslipOverlay}
                        className="px-4 py-2 rounded-xl border border-gray-250 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition"
                    >
                        View All Payslips
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Monthly Salary</p>
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100"><WalletCards className="w-5 h-5" /></div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-3">{formatCurrency(monthlySalary)}</p>
                    <p className="text-xs font-bold text-emerald-600 mt-1">Annual CTC: {formatCurrency(annualSalary)}</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pay Frequency</p>
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100"><Calendar className="w-5 h-5" /></div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-3">{payFrequency}</p>
                    <p className="text-xs text-gray-505 mt-1">Next pay date: {nextPayDate}</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">YTD Earnings</p>
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100"><PiggyBank className="w-5 h-5" /></div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-3">{formatCurrency(ytdEarnings)}</p>
                    <p className="text-xs text-gray-505 mt-1">Total net pay this financial year</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-150 flex items-center justify-between bg-gray-50/50">
                            <h4 className="text-base font-bold text-slate-800 inline-flex items-center gap-2"><Landmark className="w-4.5 h-4.5 text-blue-600" /> Bank Details</h4>
                            <span className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold">100% Deposit</span>
                        </div>
                        <div className="p-6">
                            <div>
                                <p className="text-sm font-bold text-slate-800">Primary Salary Account</p>
                                <p className="text-xs text-gray-500 mt-1 font-medium">{currentEmployee.bank_name || 'Bank name not set'} • Account No: •••• {String(currentEmployee.bank_account_number || '0000').slice(-4)}</p>
                                <p className="text-xs text-gray-500 font-medium">IFSC: {currentEmployee.ifsc_code || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-150 flex items-center justify-between bg-gray-50/50">
                            <h4 className="text-base font-bold text-slate-800 inline-flex items-center gap-2"><FileText className="w-4.5 h-4.5 text-blue-600" /> Tax Information</h4>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${taxDeclaration?.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : taxDeclaration?.status === 'rejected' ? 'bg-rose-100 text-rose-700' : taxDeclaration?.status === 'submitted' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-650'}`}>
                                {taxDeclaration?.status || 'Not submitted'}
                            </span>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tax Regime</p>
                                <select
                                    value={taxForm.regime}
                                    onChange={(e) => updateTaxForm('regime', e.target.value)}
                                    disabled={!canEditTaxDeclaration}
                                    className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-bold text-slate-800 disabled:bg-slate-50 disabled:text-gray-500"
                                >
                                    <option value="new">New Regime</option>
                                    <option value="old">Old Regime</option>
                                </select>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">PAN Number</p>
                                <p className="text-sm font-bold text-slate-850 mt-2">{currentEmployee.pan_number || 'Not provided'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Aadhaar</p>
                                <p className="text-sm font-bold text-slate-850 mt-2">{maskedIdentifier}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">UAN / PF Number</p>
                                <p className="text-sm font-bold text-slate-850 mt-2">{currentEmployee.uan_number || 'Not provided'}</p>
                            </div>
                        </div>
                        <div className="border-t border-gray-150 p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    ['section_80c', 'Section 80C', 'Max: ₹1,50,000'],
                                    ['section_80d', 'Section 80D', 'Medical insurance'],
                                    ['hra_exemption', 'HRA Exemption', 'Old regime only'],
                                    ['home_loan_interest', 'Home Loan Interest', 'Max: ₹2,00,000'],
                                    ['other_deductions', 'Other Deductions', 'Approved deductions'],
                                    ['other_income', 'Other Income', 'Interest, Rent, etc.'],
                                    ['tds_already_deducted', 'TDS Already Deducted', 'Tax deducted YTD']
                                ].map(([field, label, hint]) => (
                                    <label key={field} className="block">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={taxForm[field]}
                                            onChange={(e) => updateTaxForm(field, e.target.value)}
                                            disabled={!canEditTaxDeclaration}
                                            className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-slate-800 disabled:bg-slate-50 disabled:text-gray-550"
                                        />
                                        <span className="text-[10px] text-gray-400 mt-1 block">{hint}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">FY</p>
                                    <p className="text-sm font-black text-slate-800 mt-1">{taxFinancialYear}</p>
                                </div>
                                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                                    <p className="text-[10px] font-bold text-blue-600 uppercase">Projected Tax</p>
                                    <p className="text-sm font-black text-blue-900 mt-1">{formatCurrency(taxPreview.totalTax)}</p>
                                </div>
                                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Monthly TDS</p>
                                    <p className="text-sm font-black text-emerald-900 mt-1">{formatCurrency(monthlyTdsPreview.monthlyTds)}</p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                                <p className="text-[10px] text-gray-400 leading-normal max-w-sm">
                                    Admin/HR approval is required before payroll processes utilize this declaration.
                                </p>
                                <button
                                    onClick={saveTaxDeclaration}
                                    disabled={!canEditTaxDeclaration || savingTaxDeclaration}
                                    className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                                >
                                    {savingTaxDeclaration ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                                    Submit Declaration
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-150 bg-gray-50/50">
                            <h4 className="text-base font-bold text-slate-800 inline-flex items-center gap-2"><Shield className="w-4.5 h-4.5 text-blue-600" /> Enrolled Benefits</h4>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {benefitRows.length > 0 ? benefitRows.map((item, idx) => (
                                <div key={`${item.name}-${idx}`} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.iconBg}`}><Shield className="w-4.5 h-4.5 text-slate-700" /></div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{item.name}</p>
                                            <p className="text-xs text-gray-500">{item.plan}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-black text-slate-800">{item.value}</p>
                                </div>
                            )) : (
                                <div className="px-6 py-8 text-xs text-gray-400 italic">No enrolled benefits found in payroll records.</div>
                            )}
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 text-xs text-slate-650 font-bold">
                            Total Benefit Deduction: <span className="text-slate-900 font-extrabold">{formatCurrency(totalBenefitDeduction)}</span> per pay period
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-150 bg-gray-50/50">
                            <h4 className="text-base font-bold text-slate-800">Recent Payslips</h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-gray-150">
                                    <tr>
                                        <th className="px-6 py-3.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payroll Period</th>
                                        <th className="px-6 py-3.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Net Amount</th>
                                        <th className="px-6 py-3.5 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {latestPayslips.length > 0 ? latestPayslips.map((slip) => {
                                        const period = slip.payroll_run?.month_year
                                        return (
                                            <tr key={slip.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 text-xs font-bold text-slate-800">{formatMonthYearSafe(period, 'Current Period')}</td>
                                                <td className="px-6 py-4 text-sm font-black text-slate-800">{formatCurrency(Number(slip.net_salary) || 0)}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => setSelectedSlip(slip)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition" aria-label="View payslip details">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    }) : (
                                        <tr>
                                            <td colSpan="3" className="px-6 py-12 text-center text-xs text-gray-400 italic">No payslip records available.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payslip View Modal */}
            {selectedSlip && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print-container-root animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[92vh] border border-slate-200 animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-gray-150 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h2 className="text-base font-extrabold text-slate-800">
                                    Payslip - {selectedSlip.payroll_run
                                        ? formatMonthYearSafe(selectedSlip.payroll_run.month_year, 'Current Period')
                                        : 'Current Period'}
                                </h2>
                                <p className="text-xs text-gray-500 font-medium mt-0.5">{currentEmployee.first_name} {currentEmployee.last_name} ({currentEmployee.employee_id})</p>
                            </div>
                            <button onClick={() => setSelectedSlip(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div id="payslip-content" style={{ flexGrow: 1, overflowY: 'auto', backgroundColor: '#ffffff', color: '#111827', width: '100%', padding: '2rem 2.5rem 4rem 2.5rem', position: 'relative' }}>
                            {/* Company Branding */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                <div>
                                    <h1 style={{ fontSize: '1.5rem', fontWeight: '900', fontStyle: 'italic', color: '#0f172a', margin: 0, letterSpacing: '-0.05em' }}>
                                        {company?.name || 'YUKTI SMART AUTOMATION'}
                                    </h1>
                                    {company?.address && (
                                        <p style={{ fontSize: '0.675rem', color: '#64748b', margin: '4px 0 0 0' }}>
                                            {company.address}, {company.city}, {company.state} - {company.pincode}
                                        </p>
                                    )}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '0.875rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>PAYSLIP CONFIDENTIAL</p>
                                    <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', margin: '4px 0 0 0' }}>
                                        {selectedSlip.payroll_run
                                            ? formatMonthYearSafe(selectedSlip.payroll_run.month_year)
                                            : formatMonthYearSafe(new Date())}
                                    </p>
                                </div>
                            </div>

                            {/* Company & Employee Identity Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                                {/* Company Info */}
                                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1rem' }}>
                                    <p style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Company Information</p>
                                    <p style={{ fontSize: '0.75rem', margin: '4px 0', color: '#334155' }}><b>PAN:</b> {company?.pan_number || 'N/A'}</p>
                                    <p style={{ fontSize: '0.75rem', margin: '4px 0', color: '#334155' }}><b>TAN:</b> {company?.tan_number || 'N/A'}</p>
                                    <p style={{ fontSize: '0.75rem', margin: '4px 0', color: '#334155' }}><b>ESI No:</b> {company?.esic_number || 'N/A'}</p>
                                    <p style={{ fontSize: '0.75rem', margin: '4px 0', color: '#334155' }}><b>PF No:</b> {company?.epfo_number || 'N/A'}</p>
                                </div>

                                {/* Employee Info */}
                                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1rem' }}>
                                    <p style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Employee Information</p>
                                    <p style={{ fontSize: '0.75rem', margin: '4px 0', color: '#334155' }}><b>Name:</b> {currentEmployee.first_name} {currentEmployee.last_name}</p>
                                    <p style={{ fontSize: '0.75rem', margin: '4px 0', color: '#334155' }}><b>ID:</b> {currentEmployee.employee_id}</p>
                                    <p style={{ fontSize: '0.75rem', margin: '4px 0', color: '#334155' }}><b>PAN:</b> {currentEmployee.pan_number || 'N/A'}</p>
                                    <p style={{ fontSize: '0.75rem', margin: '4px 0', color: '#334155' }}><b>UAN (PF):</b> {currentEmployee.uan_number || 'N/A'}</p>
                                    <p style={{ fontSize: '0.75rem', margin: '4px 0', color: '#334155' }}><b>ESI IP No:</b> {currentEmployee.esi_number || 'N/A'}</p>
                                </div>
                            </div>

                            {/* Attendance Summary */}
                            <div style={{ marginBottom: '2rem' }}>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: '900', color: '#0f172a', marginBottom: '0.75rem' }}>Attendance Summary</h3>
                                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                                    <div style={{ textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>{selectedSlip.breakdown?.totalDays || 30}</p>
                                        <p style={{ fontSize: '8px', fontWeight: '805', color: '#94a3b8', textTransform: 'uppercase', marginTop: '4px' }}>Total Days</p>
                                    </div>
                                    <div style={{ textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: '#059669', margin: 0 }}>{selectedSlip.attendance_days}</p>
                                        <p style={{ fontSize: '8px', fontWeight: '805', color: '#94a3b8', textTransform: 'uppercase', marginTop: '4px' }}>Payable Days</p>
                                    </div>
                                    <div style={{ textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: '#dc2626', margin: 0 }}>{((selectedSlip.breakdown?.totalDays || 30) - selectedSlip.attendance_days).toFixed(1)}</p>
                                        <p style={{ fontSize: '8px', fontWeight: '805', color: '#94a3b8', textTransform: 'uppercase', marginTop: '4px' }}>LOP Days</p>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: '#2563eb', margin: 0 }}>{selectedSlip.breakdown?.leaveDays || 0}</p>
                                        <p style={{ fontSize: '8px', fontWeight: '805', color: '#94a3b8', textTransform: 'uppercase', marginTop: '4px' }}>Paid Leaves</p>
                                    </div>
                                </div>
                            </div>

                            {/* Earnings & Deductions Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', marginBottom: '2rem' }}>
                                {/* Earnings */}
                                <div>
                                    <h3 style={{ fontSize: '0.875rem', fontWeight: '900', color: '#059669', marginBottom: '0.75rem', borderBottom: '1px solid #ecfdf5', paddingBottom: '0.5rem' }}>Earnings</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        {selectedSlip.breakdown?.earnings?.map((earn, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContext: 'space-between', fontSize: '0.75rem' }}>
                                                <span style={{ color: '#64748b', flexGrow: 1 }}>{earn.name}</span>
                                                <span style={{ color: '#1e293b', fontWeight: '700', textAlign: 'right' }}>{formatCurrency(earn.amount)}</span>
                                            </div>
                                        ))}
                                        <div style={{ display: 'flex', justifyContext: 'space-between', borderTop: '2px solid #f1f5f9', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                                            <span style={{ color: '#0f172a', fontWeight: '900', fontSize: '0.75rem', flexGrow: 1 }}>Gross Earnings</span>
                                            <span style={{ color: '#0f172a', fontWeight: '900', fontSize: '0.75rem', textAlign: 'right' }}>{formatCurrency(selectedSlip.basic_salary + selectedSlip.total_allowances)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Deductions */}
                                <div>
                                    <h3 style={{ fontSize: '0.875rem', fontWeight: '900', color: '#dc2626', marginBottom: '0.75rem', borderBottom: '1px solid #fef2f2', paddingBottom: '0.5rem' }}>Deductions</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        {selectedSlip.breakdown?.deductions?.map((ded, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContext: 'space-between', fontSize: '0.75rem' }}>
                                                <span style={{ color: '#64748b', flexGrow: 1 }}>{ded.name}</span>
                                                <span style={{ color: '#1e293b', fontWeight: '700', textAlign: 'right' }}>{formatCurrency(ded.amount)}</span>
                                            </div>
                                        ))}
                                        {selectedSlip.breakdown?.deductions?.length === 0 && <p style={{ fontSize: '0.7rem', fontStyle: 'italic', color: '#94a3b8', margin: 0 }}>No deductions</p>}
                                        <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
                                            <div style={{ display: 'flex', justifyContext: 'space-between', borderTop: '2px solid #f1f5f9', paddingTop: '0.5rem' }}>
                                                <span style={{ color: '#0f172a', fontWeight: '900', fontSize: '0.75rem', flexGrow: 1 }}>Total Deductions</span>
                                                <span style={{ color: '#0f172a', fontWeight: '900', fontSize: '0.75rem', textAlign: 'right' }}>{formatCurrency(selectedSlip.total_deductions)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Net Salary Box */}
                            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '1rem', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '905', color: '#166534', margin: 0 }}>Net Salary</h3>
                                    <p style={{ fontSize: '8px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Amount Credited to Account</p>
                                </div>
                                <p style={{ fontSize: '1.75rem', fontWeight: '900', color: '#15803d', margin: 0 }}>{formatCurrency(selectedSlip.net_salary)}</p>
                            </div>

                            {/* Footer Disclaimer */}
                            <div style={{ marginTop: '3rem', textAlign: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: '1.5rem' }}>
                                <p style={{ fontSize: '9px', fontWeight: '600', fontStyle: 'italic', color: '#94a3b8', margin: 0 }}>This is a system-generated document and does not require a signature.</p>
                                <p style={{ fontSize: '8px', fontWeight: '500', color: '#cbd5e1', marginTop: '0.5rem' }}>© {new Date().getFullYear()} {company?.name || 'YUKTI SMART AUTOMATION'}</p>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="px-6 py-4 border-t border-gray-150 flex justify-end gap-3 bg-gray-50/50 rounded-b-3xl">
                            <button
                                onClick={() => window.print()}
                                className="px-4 py-2 border border-gray-250 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition flex items-center gap-1.5"
                            >
                                <Printer className="w-4 h-4" />
                                <span>Print</span>
                            </button>
                            <button onClick={() => setSelectedSlip(null)} className="px-4 py-2 border border-gray-250 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition">
                                Close
                            </button>
                            <button
                                onClick={() => handleDownloadPDF(selectedSlip)}
                                disabled={downloading}
                                className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow hover:bg-slate-800 transition disabled:opacity-75"
                            >
                                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                <span>{downloading ? 'Generating...' : 'Download PDF'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Payslip Overlay Modal */}
            {showPayslipOverlay && (
                <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Payslip History Records</h3>
                                <p className="text-xs text-gray-500 mt-0.5">{currentEmployee?.first_name} {currentEmployee?.last_name} ({currentEmployee?.employee_id})</p>
                            </div>
                            <button onClick={() => setShowPayslipOverlay(false)} className="p-2 rounded-full hover:bg-gray-150 transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="overflow-auto flex-1">
                            <table className="w-full">
                                <thead className="bg-slate-100 border-b border-gray-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-550 uppercase">Period</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-550 uppercase">Gross Earnings</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-bold text-rose-500 uppercase">Deductions</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-900 uppercase">Net Salary</th>
                                        <th className="px-6 py-3.5 text-right text-xs font-bold text-gray-550 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {latestPayslips.map((slip) => {
                                        const periodDate = slip.payroll_run?.month_year ? new Date(`${slip.payroll_run.month_year}-01`) : new Date()
                                        const gross = (Number(slip.basic_salary) || 0) + (Number(slip.total_allowances) || 0)
                                        const isSelected = overlaySelectedSlip?.id === slip.id
                                        return (
                                            <tr key={slip.id} className={`hover:bg-slate-50/50 transition cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''}`} onClick={() => setOverlaySelectedSlip(slip)}>
                                                <td className="px-6 py-4 text-xs font-bold text-slate-800">{formatMonthYearSafe(periodDate)}</td>
                                                <td className="px-6 py-4 text-xs font-medium text-slate-800">{formatCurrency(gross)}</td>
                                                <td className="px-6 py-4 text-xs font-bold text-rose-600">{formatCurrency(Number(slip.total_deductions) || 0)}</td>
                                                <td className="px-6 py-4 text-xs font-black text-slate-900">{formatCurrency(Number(slip.net_salary) || 0)}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={(e) => { e.stopPropagation(); setSelectedSlip(slip) }} className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-gray-250 text-slate-700 bg-white hover:bg-slate-50 transition">Open</button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-150 bg-gray-50/50 flex items-center justify-between">
                            <p className="text-xs text-gray-500">Selected: <span className="font-bold text-slate-750">{overlaySelectedSlip ? formatMonthYearSafe(overlaySelectedSlip.payroll_run?.month_year, 'N/A') : 'None'}</span></p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleOverlayPrint(overlaySelectedSlip)}
                                    disabled={!overlaySelectedSlip}
                                    className="px-4 py-2 rounded-xl border border-gray-250 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition flex items-center gap-1.5"
                                >
                                    <Printer className="w-4 h-4" /> Print
                                </button>
                                <button
                                    onClick={() => handleOverlayDownload(overlaySelectedSlip)}
                                    disabled={!overlaySelectedSlip}
                                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1.5 shadow"
                                >
                                    <Download className="w-4 h-4" /> Download PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        {/* Print Styles */}
        <style dangerouslySetInnerHTML={{
            __html: `
            @media print {
                @page {
                    size: A4 portrait;
                    margin: 0;
                }
                body {
                    visibility: hidden !important;
                    background: white !important;
                }
                .print-container-root {
                    visibility: visible !important;
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    width: 100% !important;
                    max-width: 210mm !important;
                    margin: 0 auto !important;
                    height: auto !important;
                    z-index: 99999 !important;
                    background: white !important;
                    display: block !important;
                    padding: 10mm !important;
                }
                .print-container-root * {
                    visibility: visible !important;
                }
                .print-container-root > div {
                    box-shadow: none !important;
                    border: none !important;
                    border-radius: 0 !important;
                    width: 100% !important;
                    max-width: none !important;
                    height: auto !important;
                    position: static !important;
                    transform: none !important;
                    margin: 0 !important;
                }
                .print-container-root > div > div:first-child,
                .print-container-root > div > div:nth-child(3) {
                    display: none !important;
                }
                #payslip-content {
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: visible !important;
                }
            }
        `}} />
        </div>
    )
}
