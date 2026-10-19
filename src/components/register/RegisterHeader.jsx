import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

export default function RegisterHeader() {
    return (
        <>
            <div className="absolute inset-x-0 top-0 h-80 border-b border-slate-200 bg-white/80 backdrop-blur">
                <div className="max-w-7xl mx-auto px-4 py-8 flex justify-between items-center text-slate-500">
                    <Link to="/" className="text-lg font-black text-slate-950 tracking-widest uppercase">Yukti Smart HRMS</Link>
                    <div className="flex items-center gap-4">
                        <Link to="/" className="text-xs font-bold text-slate-600 hover:text-slate-950 uppercase tracking-wider">Home</Link>
                        <Link to="/login" className="text-xs font-bold text-blue-700 hover:text-blue-900 uppercase tracking-wider">Sign In</Link>
                    </div>
                </div>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 pt-4">
                <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 px-4 py-1.5 rounded-full text-blue-700 text-xs font-black uppercase tracking-widest mb-4">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Free 14-Day Corporate Trial</span>
                </div>
                <h1 className="text-3xl font-black text-slate-950 tracking-tight sm:text-4xl">Register Your Enterprise</h1>
                <p className="mt-2 text-sm font-medium text-slate-600">Launch a multi-company dynamic payroll workspace for your organization in seconds.</p>
            </div>
        </>
    )
}
