import { HelpCircle, CheckCircle2, AlertCircle } from 'lucide-react'
import { validateCompanyLegalField } from '../../lib/validators'

function FieldStatus({ value, error }) {
    if (!value) return null
    if (error) return <AlertCircle className="w-4 h-4 text-rose-500" />
    return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
}

function ErrorMsg({ text }) {
    if (!text) return null
    return (
        <p className="text-rose-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {text}
        </p>
    )
}

/**
 * Company Legal Compliance Tab — renders statutory registration number fields
 * with real-time NSDL-format validation.
 *
 * Props:
 *   formData     - current form values
 *   handleChange - parent onChange handler (updates formData)
 *   isAdmin      - whether the user can edit
 *   submitting   - whether a save is in progress
 *   errors       - external errors object from CompanySettings (optional)
 *   onValidate   - callback(name, error) so the parent can track validity
 */
export default function CompanyLegalTab({
    formData,
    handleChange,
    isAdmin,
    submitting,
    errors = {},
    onValidate
}) {
    const handleLegalChange = (e) => {
        handleChange(e)
        if (onValidate) {
            const error = validateCompanyLegalField(e.target.name, e.target.value)
            onValidate(e.target.name, error)
        }
    }

    const inputClass = (field) =>
        `w-full px-4 py-3 bg-white border hover:border-slate-300 rounded-xl text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:border-slate-900 focus:outline-none transition-all uppercase placeholder:text-slate-400 pr-9 ${
            errors[field]
                ? 'border-rose-400 focus:ring-rose-500'
                : formData[field] && !errors[field]
                    ? 'border-emerald-400 focus:ring-slate-900'
                    : 'border-slate-200 focus:ring-slate-900'
        }`

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-bold text-slate-800 mb-2">Government Compliance &amp; Legal IDs</h2>
                <p className="text-xs text-gray-600 font-medium">Verify legal parameters required for statutory income tax (TDS), ESIC, EPFO returns, and payslips.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PAN */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label htmlFor="legal-pan-number" className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Company PAN (10 chars)</label>
                        <HelpCircle className="w-3.5 h-3.5 text-gray-300 cursor-help" title="Income Tax permanent account number — e.g., ABCDE1234F" />
                    </div>
                    <div className="relative">
                        <input
                            id="legal-pan-number"
                            type="text"
                            name="pan_number"
                            maxLength={10}
                            value={formData.pan_number}
                            onChange={handleLegalChange}
                            disabled={!isAdmin || submitting}
                            placeholder="e.g. ABCDE1234F"
                            className={inputClass('pan_number')}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                            <FieldStatus value={formData.pan_number} error={errors.pan_number} />
                        </span>
                    </div>
                    <ErrorMsg text={errors.pan_number} />
                </div>

                {/* TAN */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label htmlFor="legal-tan-number" className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Company TAN (10 chars)</label>
                        <HelpCircle className="w-3.5 h-3.5 text-gray-300 cursor-help" title="Tax Deduction Account Number — e.g., DELA12345B" />
                    </div>
                    <div className="relative">
                        <input
                            id="legal-tan-number"
                            type="text"
                            name="tan_number"
                            maxLength={10}
                            value={formData.tan_number}
                            onChange={handleLegalChange}
                            disabled={!isAdmin || submitting}
                            placeholder="e.g. DELA12345B"
                            className={inputClass('tan_number')}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                            <FieldStatus value={formData.tan_number} error={errors.tan_number} />
                        </span>
                    </div>
                    <ErrorMsg text={errors.tan_number} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* GSTIN */}
                <div className="md:col-span-1">
                    <label htmlFor="legal-gst-number" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">GSTIN Identifier (15 chars)</label>
                    <div className="relative">
                        <input
                            id="legal-gst-number"
                            type="text"
                            name="gst_number"
                            maxLength={15}
                            value={formData.gst_number}
                            onChange={handleLegalChange}
                            disabled={!isAdmin || submitting}
                            placeholder="e.g. 07AAAAA1111A1Z1"
                            className={inputClass('gst_number')}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                            <FieldStatus value={formData.gst_number} error={errors.gst_number} />
                        </span>
                    </div>
                    <ErrorMsg text={errors.gst_number} />
                </div>

                {/* EPFO */}
                <div>
                    <label htmlFor="legal-epfo-number" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">EPFO Number (15 chars)</label>
                    <div className="relative">
                        <input
                            id="legal-epfo-number"
                            type="text"
                            name="epfo_number"
                            maxLength={15}
                            value={formData.epfo_number}
                            onChange={handleLegalChange}
                            disabled={!isAdmin || submitting}
                            placeholder="e.g. DLCPM0012345000"
                            className={inputClass('epfo_number')}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                            <FieldStatus value={formData.epfo_number} error={errors.epfo_number} />
                        </span>
                    </div>
                    <ErrorMsg text={errors.epfo_number} />
                </div>

                {/* ESIC */}
                <div>
                    <label htmlFor="legal-esic-number" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">ESIC Number (17 digits)</label>
                    <div className="relative">
                        <input
                            id="legal-esic-number"
                            type="text"
                            name="esic_number"
                            maxLength={17}
                            value={formData.esic_number}
                            onChange={handleLegalChange}
                            disabled={!isAdmin || submitting}
                            placeholder="e.g. 12345678901234567"
                            className={`${inputClass('esic_number')} normal-case`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                            <FieldStatus value={formData.esic_number} error={errors.esic_number} />
                        </span>
                    </div>
                    <ErrorMsg text={errors.esic_number} />
                </div>
            </div>

            <hr className="border-gray-100" />
            <div>
                <h2 className="text-lg font-bold text-slate-800 mb-2">Accounting Period Configuration</h2>
                <p className="text-xs text-gray-600 font-medium">Verify financial bookkeeping terms that orchestrate tax declaration deadlines.</p>
            </div>

            <div>
                <label htmlFor="legal-fy-start" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Financial Year Launch Date</label>
                <input
                    id="legal-fy-start"
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
    )
}
