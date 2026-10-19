import { useState } from 'react'
import { Lock, Mail, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { validateRegistrationField } from '../../lib/validators'

function ErrorMsg({ text }) {
    if (!text) return null
    return <p className="text-rose-500 text-[10px] font-bold uppercase mt-1">{text}</p>
}

export default function RegisterUserForm({
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    errors: externalErrors,
    onSubmit
}) {
    // Local real-time validation errors (merged with any parent-level errors)
    const [localErrors, setLocalErrors] = useState({})
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const errors = { ...externalErrors, ...localErrors }

    const validateAndSet = (name, value) => {
        const error = validateRegistrationField(name, value, { password })
        setLocalErrors(prev => {
            const next = { ...prev }
            if (error) next[name] = error
            else delete next[name]
            return next
        })
    }

    // Also re-validate confirmPassword whenever password changes
    const handlePasswordChange = (e) => {
        const val = e.target.value
        setPassword(val)
        const pwErr = validateRegistrationField('password', val)
        const cpErr = confirmPassword ? validateRegistrationField('confirmPassword', confirmPassword, { password: val }) : ''
        setLocalErrors(prev => {
            const next = { ...prev }
            if (pwErr) next.password = pwErr; else delete next.password
            if (cpErr) next.confirmPassword = cpErr; else delete next.confirmPassword
            return next
        })
    }

    const inputClass = (field) =>
        `w-full rounded-xl bg-slate-50 border px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${errors[field] ? 'border-rose-500 focus:ring-rose-500' : 'border-gray-200'}`

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="register-firstname" className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">First Name *</label>
                    <input
                        id="register-firstname"
                        type="text"
                        required
                        placeholder="John"
                        value={firstName}
                        onChange={e => { setFirstName(e.target.value); validateAndSet('firstName', e.target.value) }}
                        onBlur={e => validateAndSet('firstName', e.target.value)}
                        className={inputClass('firstName')}
                    />
                    <ErrorMsg text={errors.firstName} />
                </div>
                <div>
                    <label htmlFor="register-lastname" className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Last Name *</label>
                    <input
                        id="register-lastname"
                        type="text"
                        required
                        placeholder="Doe"
                        value={lastName}
                        onChange={e => { setLastName(e.target.value); validateAndSet('lastName', e.target.value) }}
                        onBlur={e => validateAndSet('lastName', e.target.value)}
                        className={inputClass('lastName')}
                    />
                    <ErrorMsg text={errors.lastName} />
                </div>
            </div>

            <div>
                <label htmlFor="register-email" className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Admin Email Address *</label>
                <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        id="register-email"
                        type="email"
                        required
                        placeholder="e.g., admin@acme.com"
                        value={email}
                        onChange={e => { setEmail(e.target.value); validateAndSet('email', e.target.value) }}
                        onBlur={e => validateAndSet('email', e.target.value)}
                        className={`${inputClass('email')} pl-12`}
                    />
                </div>
                <ErrorMsg text={errors.email} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="register-password" className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Create Password *</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            id="register-password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            placeholder="Min 8 chars"
                            value={password}
                            onChange={handlePasswordChange}
                            onBlur={e => validateAndSet('password', e.target.value)}
                            className={`${inputClass('password')} pl-12 pr-12`}
                        />
                        <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowPassword(p => !p)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    {/* Password strength indicator */}
                    {password && (
                        <div className="mt-1.5 flex gap-1">
                            {[
                                password.length >= 8,
                                /[A-Z]/.test(password),
                                /[0-9]/.test(password),
                                /[^A-Za-z0-9]/.test(password),
                            ].map((met, i) => (
                                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${met ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                            ))}
                        </div>
                    )}
                    <ErrorMsg text={errors.password} />
                </div>
                <div>
                    <label htmlFor="register-confirm-password" className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Confirm Password *</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            id="register-confirm-password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            required
                            placeholder="Confirm password"
                            value={confirmPassword}
                            onChange={e => { setConfirmPassword(e.target.value); validateAndSet('confirmPassword', e.target.value) }}
                            onBlur={e => validateAndSet('confirmPassword', e.target.value)}
                            className={`${inputClass('confirmPassword')} pl-12 pr-12`}
                        />
                        <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowConfirmPassword(p => !p)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <ErrorMsg text={errors.confirmPassword} />
                </div>
            </div>

            <button
                type="submit"
                className="w-full py-3.5 bg-slate-950 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-slate-200 flex items-center justify-center space-x-2 uppercase tracking-widest cursor-pointer mt-6"
            >
                <span>Continue: Workspace Setup</span>
                <ArrowRight className="w-4 h-4" />
            </button>
        </form>
    )
}
