import { Download, Landmark, Building2, ShieldCheck, BookOpen, Receipt, Database } from 'lucide-react'
import { downloadECR, downloadECRSummary } from '../../lib/ecrGenerator'
import { downloadESIC } from '../../lib/esicGenerator'
import { downloadSalaryRegister } from '../../lib/salaryRegister'
import { downloadGenericNEFT, downloadHDFCBulk, downloadSBISFMS } from '../../lib/neftGenerator'
import { downloadPTChallan, downloadLWFStatement } from '../../lib/ptChallanGenerator'
import { generate24QText, deriveQuarterFromMonth } from '../../lib/tdsReturnGenerator'
import { downloadBlob } from '../../lib/payrollUtils'

export default function StatutoryComplianceExports({
    activeReportTab,
    statutoryMonth,
    setStatutoryMonth,
    payrollEmployees,
    esicSummary,
    activeEmployees,
    selectedForm16EmployeeId,
    setSelectedForm16EmployeeId,
    generatingForm16,
    handleGenerateForm16,
    complianceState,
    setComplianceState,
    debitAccount,
    setDebitAccount,
    selectedQuarter,
    setSelectedQuarter,
    handleTallyExport,
    companySettings,
    formatCurrency,
    toast,
    navigate
}) {
    return (
        <div
            className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${
                activeReportTab !== 'compliance' ? 'hidden' : ''
            }`}
        >
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
                        <Landmark className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Statutory Compliance Exports</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Generate EPFO ECR, ESIC, Salary Register &amp; Form 16 for any payroll month
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-gray-600">Payroll Month</label>
                    <input
                        type="month"
                        value={statutoryMonth}
                        onChange={(e) => setStatutoryMonth(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                    />
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                        {payrollEmployees.length} employees
                    </span>
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* EPFO ECR 2.0 */}
                <div className="border border-gray-100 rounded-2xl p-5 hover:border-blue-200 hover:shadow-md transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Building2 className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">EPFO ECR 2.0</h3>
                    <p className="text-xs text-gray-500 mt-1 mb-4">Electronic Challan cum Return for PF deposit to EPFO portal</p>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => {
                                if (!payrollEmployees.length) {
                                    toast.warning('No payroll data for selected month.')
                                    return
                                }
                                downloadECR(payrollEmployees, statutoryMonth, companySettings.pf_reg_no || '')
                                toast.success('ECR text file downloaded.')
                            }}
                            className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Download className="w-3.5 h-3.5" /> ECR Text File
                        </button>
                        <button
                            onClick={() => {
                                if (!payrollEmployees.length) {
                                    toast.warning('No payroll data for selected month.')
                                    return
                                }
                                downloadECRSummary(payrollEmployees, statutoryMonth)
                                toast.success('ECR summary CSV downloaded.')
                            }}
                            className="w-full py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <Download className="w-3.5 h-3.5" /> Summary CSV
                        </button>
                    </div>
                </div>

                {/* ESIC Monthly Return */}
                <div className="border border-gray-100 rounded-2xl p-5 hover:border-emerald-200 hover:shadow-md transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">ESIC Monthly Return</h3>
                    <p className="text-xs text-gray-500 mt-1 mb-1">Employee State Insurance contribution file</p>
                    <p className="text-xs font-bold text-emerald-600 mb-4">
                        {esicSummary.eligibleCount} eligible &middot; {formatCurrency(esicSummary.totalContribution)} total
                    </p>
                    <button
                        onClick={() => {
                            if (!payrollEmployees.length) {
                                toast.warning('No payroll data for selected month.')
                                    return
                            }
                            downloadESIC(payrollEmployees, statutoryMonth, companySettings.esic_reg_no || '')
                            toast.success('ESIC CSV downloaded.')
                        }}
                        className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Download className="w-3.5 h-3.5" /> Download CSV
                    </button>
                </div>

                {/* Salary Register */}
                <div className="border border-gray-100 rounded-2xl p-5 hover:border-violet-200 hover:shadow-md transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <BookOpen className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">Salary Register</h3>
                    <p className="text-xs text-gray-500 mt-1 mb-4">
                        Statutory register with earnings, deductions &amp; net pay for all employees
                    </p>
                    <button
                        onClick={() => {
                            if (!payrollEmployees.length) {
                                toast.warning('No payroll data for selected month.')
                                    return
                            }
                            downloadSalaryRegister(payrollEmployees, statutoryMonth, {
                                name: companySettings.company_name,
                                pan: companySettings.pan_number,
                                tan: companySettings.tan_number,
                                pf_reg_no: companySettings.pf_reg_no,
                                esic_reg_no: companySettings.esic_reg_no
                            })
                            toast.success('Salary Register CSV downloaded.')
                        }}
                        className="w-full py-2 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Download className="w-3.5 h-3.5" /> Download Register
                    </button>
                </div>

                {/* Form 16 */}
                <div className="border border-gray-100 rounded-2xl p-5 hover:border-amber-200 hover:shadow-md transition-all group flex flex-col justify-between">
                    <div>
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <FileBadgeIcon />
                        </div>
                        <h3 className="text-sm font-bold text-gray-800">Form 16</h3>
                        <p className="text-xs text-gray-500 mt-1 mb-4">
                            TDS certificate (Part A + B) generated per employee from Tax Declarations
                        </p>
                    </div>
                    <div className="space-y-3">
                        <div className="relative">
                            <label htmlFor="form16-employee-select" className="sr-only">Select Employee</label>
                            <select
                                id="form16-employee-select"
                                value={selectedForm16EmployeeId}
                                onChange={(e) => setSelectedForm16EmployeeId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-gray-50 focus:ring-2 focus:ring-amber-100 focus:border-amber-400 transition-all focus:outline-none"
                            >
                                <option value="">Select Employee</option>
                                {activeEmployees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={handleGenerateForm16}
                            disabled={!selectedForm16EmployeeId || generatingForm16}
                            className="w-full py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-100"
                        >
                            {generatingForm16 ? (
                                <>
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/50 border-t-white" />
                                    <span>Generating...</span>
                                </>
                            ) : (
                                <>
                                    <Receipt className="w-3.5 h-3.5" /> Generate Form 16
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => navigate('/tax-declarations')}
                            className="w-full py-1 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-1.5 text-[10px] font-bold"
                        >
                            Go to Tax Declarations
                        </button>
                    </div>
                </div>

                {/* Bank Transfer (NEFT) */}
                <div className="border border-gray-100 rounded-2xl p-5 hover:border-slate-300 hover:shadow-md transition-all group flex flex-col justify-between">
                    <div>
                        <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Landmark className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-800">Bank Transfer (NEFT)</h3>
                        <p className="text-xs text-gray-500 mt-1 mb-4">
                            Generate bulk payment upload sheets for Indian corporate banking platforms
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Company Debit Account No (SBI)"
                                value={debitAccount}
                                onChange={(e) => setDebitAccount(e.target.value)}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-gray-50 focus:ring-2 focus:ring-slate-100 focus:border-slate-400 focus:outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                            <button
                                onClick={() => {
                                    if (!payrollEmployees.length) {
                                        toast.warning('No payroll data.')
                                        return
                                    }
                                    downloadGenericNEFT(payrollEmployees, statutoryMonth)
                                    toast.success('Generic NEFT CSV downloaded.')
                                }}
                                className="py-1.5 bg-slate-800 text-white rounded-lg text-[10px] font-bold hover:bg-slate-900 transition-colors"
                            >
                                Generic
                            </button>
                            <button
                                onClick={() => {
                                    if (!payrollEmployees.length) {
                                        toast.warning('No payroll data.')
                                        return
                                    }
                                    downloadHDFCBulk(payrollEmployees, statutoryMonth)
                                    toast.success('HDFC Bulk CSV downloaded.')
                                }}
                                className="py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-colors"
                            >
                                HDFC
                            </button>
                            <button
                                onClick={() => {
                                    if (!payrollEmployees.length) {
                                        toast.warning('No payroll data.')
                                        return
                                    }
                                    if (!debitAccount.trim()) {
                                        toast.warning('SBI requires debit account number.')
                                        return
                                    }
                                    downloadSBISFMS(payrollEmployees, statutoryMonth, debitAccount)
                                    toast.success('SBI SFMS file downloaded.')
                                }}
                                className="py-1.5 bg-green-600 text-white rounded-lg text-[10px] font-bold hover:bg-green-700 transition-colors"
                            >
                                SBI
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tally ERP Export */}
                <div className="border border-gray-100 rounded-2xl p-5 hover:border-purple-200 hover:shadow-md transition-all group flex flex-col justify-between">
                    <div>
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Database className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-800">Tally ERP Export</h3>
                        <p className="text-xs text-gray-500 mt-1 mb-4">
                            Export monthly payroll journal entries as XML or CSV for direct import into Tally ERP
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => handleTallyExport('xml')}
                            className="w-full py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-100"
                        >
                            <Download className="w-3.5 h-3.5" /> Download XML
                        </button>
                        <button
                            onClick={() => handleTallyExport('csv')}
                            className="w-full py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <Download className="w-3.5 h-3.5" /> Download CSV
                        </button>
                    </div>
                </div>

                {/* State PT & LWF */}
                <div className="border border-gray-100 rounded-2xl p-5 hover:border-teal-200 hover:shadow-md transition-all group flex flex-col justify-between">
                    <div>
                        <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Receipt className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-800">State PT & LWF</h3>
                        <p className="text-xs text-gray-500 mt-1 mb-4">
                            Download Professional Tax and Labour Welfare Fund reconciliation statements
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div>
                            <select
                                value={complianceState}
                                onChange={(e) => setComplianceState(e.target.value)}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-gray-50 focus:ring-2 focus:ring-teal-100 focus:border-teal-400 focus:outline-none"
                            >
                                {[
                                    'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
                                    'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
                                    'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
                                    'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
                                    'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
                                    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
                                ].map(state => (
                                    <option key={state} value={state}>
                                        {state}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            <button
                                onClick={() => {
                                    if (!payrollEmployees.length) {
                                        toast.warning('No payroll data.')
                                        return
                                    }
                                    downloadPTChallan(payrollEmployees, complianceState, statutoryMonth)
                                    toast.success(`${complianceState} PT Statement downloaded.`)
                                }}
                                className="py-1.5 bg-teal-600 text-white rounded-lg text-[10px] font-bold hover:bg-teal-700 transition-colors"
                            >
                                PT Statement
                            </button>
                            <button
                                onClick={() => {
                                    if (!payrollEmployees.length) {
                                        toast.warning('No payroll data.')
                                        return
                                    }
                                    downloadLWFStatement(payrollEmployees, complianceState, statutoryMonth)
                                    toast.success(`${complianceState} LWF Statement downloaded.`)
                                }}
                                className="py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-colors"
                            >
                                LWF Statement
                            </button>
                        </div>
                    </div>
                </div>

                {/* NSDL 24Q TDS Return */}
                <div className="border border-gray-100 rounded-2xl p-5 hover:border-orange-200 hover:shadow-md transition-all group flex flex-col justify-between">
                    <div>
                        <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Receipt className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-800">NSDL 24Q TDS Return</h3>
                        <p className="text-xs text-gray-500 mt-1 mb-4">
                            Export government-compliant quarterly plain-text return file for Section 192 TDS filing
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="relative mb-2">
                            <label htmlFor="tds-quarter-select" className="sr-only">TDS Quarter Override</label>
                            <select
                                id="tds-quarter-select"
                                value={selectedQuarter}
                                onChange={e => setSelectedQuarter(e.target.value)}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-gray-50 focus:ring-2 focus:ring-orange-100 focus:border-orange-400 focus:outline-none"
                            >
                                <option value="">Auto-detect from Month</option>
                                <option value="Q1">Q1 (Apr–Jun)</option>
                                <option value="Q2">Q2 (Jul–Sep)</option>
                                <option value="Q3">Q3 (Oct–Dec)</option>
                                <option value="Q4">Q4 (Jan–Mar)</option>
                            </select>
                        </div>
                        <button
                            onClick={() => {
                                if (!payrollEmployees.length) {
                                    toast.warning('No payroll data.')
                                    return
                                }
                                const monthPart = statutoryMonth.split('-')[1]
                                const monthNum = parseInt(monthPart, 10)
                                const derivedQ = deriveQuarterFromMonth(monthNum)
                                const quarter = selectedQuarter || derivedQ

                                const text = generate24QText(companySettings, payrollEmployees, quarter)
                                const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' })
                                downloadBlob(blob, `TDS_24Q_${quarter}_${statutoryMonth}.txt`)
                                toast.success(`NSDL 24Q TDS return file downloaded for ${quarter}.`)
                            }}
                            className="w-full py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-100"
                        >
                            <Download className="w-3.5 h-3.5" /> Export 24Q TDS (.txt)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Inline fallback SVG component since lucide-react doesn't export FileBadge directly
function FileBadgeIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-file-badge"
        >
            <path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h8l6 6v10c0 .5-.2 1-.6 1.4-.4.4-.9.6-1.4.6H4" />
            <path d="M14 2v6h6" />
            <circle cx="12" cy="14" r="3" />
            <path d="M12 17v4l2-1 2 1v-4" />
        </svg>
    )
}
