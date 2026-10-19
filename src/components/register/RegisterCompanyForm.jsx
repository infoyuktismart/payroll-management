import { useState } from 'react'
import { Building, Shield, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { validateRegistrationField } from '../../lib/validators'

function ErrorMsg({ text }) {
    if (!text) return null
    return <p className="text-rose-500 text-[10px] font-bold uppercase mt-1">{text}</p>
}

export default function RegisterCompanyForm({
    companyName,
    setCompanyName,
    companyCode,
    setCompanyCode,
    errors: externalErrors,
    onSubmit,
    onBack
}) {
    const [localErrors, setLocalErrors] = useState({})

    const errors = { ...externalErrors, ...localErrors }

    const validateAndSet = (name, value) => {
        const error = validateRegistrationField(name, value)
        setLocalErrors(prev => {
            const next = { ...prev }
            if (error) next[name] = error
            else delete next[name]
            return next
        })
    }

    const handleCompanyCodeChange = (e) => {
        // Auto-uppercase, strip non-alphanumeric
        const raw = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
        setCompanyCode(raw)
        validateAndSet('companyCode', raw)
    }

    const inputClass = (field) =>
        `w-full rounded-xl bg-slate-50 border pl-12 pr-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${errors[field] ? 'border-rose-500 focus:ring-rose-500' : 'border-gray-200'}`

    // Live preview: show a valid badge when the code format passes
    const codeIsValid = companyCode.length >= 2 && companyCode.length <= 10 && !localErrors.companyCode

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div>
                <label htmlFor="register-company-name" className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Legal Company Name *</label>
                <div className="relative">
                    <Building className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        id="register-company-name"
                        type="text"
                        required
                        placeholder="e.g., Acme Technologies Pvt Ltd"
                        value={companyName}
                        onChange={e => { setCompanyName(e.target.value); validateAndSet('companyName', e.target.value) }}
                        onBlur={e => validateAndSet('companyName', e.target.value)}
                        className={inputClass('companyName')}
                    />
                </div>
                <ErrorMsg text={errors.companyName} />
            </div>

            <div>
                <label htmlFor="register-company-code" className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Workspace Unique Code *</label>
                <div className="relative">
                    <Shield className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        id="register-company-code"
                        type="text"
                        required
                        maxLength={10}
                        placeholder="e.g., ACME"
                        value={companyCode}
                        onChange={handleCompanyCodeChange}
                        onBlur={e => validateAndSet('companyCode', e.target.value)}
                        className={`${inputClass('companyCode')} uppercase pr-10`}
                    />
                    {codeIsValid && (
                        <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                    )}
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5">
                    Short code for company login subdomains &amp; compliance forms
                </p>
                <ErrorMsg text={errors.companyCode} />
            </div>

            <div className="flex gap-2 justify-end pt-4">
                <button
                    type="button"
                    onClick={onBack}
                    className="px-4 py-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
                <button
                    type="submit"
                    className="flex-1 py-3.5 bg-slate-950 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-slate-200 flex items-center justify-center space-x-2 uppercase tracking-widest cursor-pointer"
                >
                    <span>Select Free Plan</span>
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </form>
    )
}
