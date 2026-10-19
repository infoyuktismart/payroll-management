import { Link } from 'react-router-dom'
import { Sparkles, Shield, Mail, Phone, MapPin } from 'lucide-react'

export default function LandingFooter() {
  return (
    <footer
      id="main-landing-footer"
      className="border-t border-slate-200 bg-slate-950 text-slate-300"
    >
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="inline-flex items-center gap-3 text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-500/30">
                <Sparkles className="h-5 w-5 text-white" />
              </span>
              <span className="text-base font-black uppercase tracking-[0.18em]">
                Yukti Smart HRMS
              </span>
            </Link>
            <p className="max-w-sm text-xs font-medium leading-relaxed text-slate-400">
              Enterprise-grade payroll automation, multi-branch attendance, biometric
              synchronization, and Indian statutory compliance in one multi-tenant SaaS workspace.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs font-bold text-slate-400">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>ISO/IEC 27001 Readiness & Bank-Grade SSL Encryption</span>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-white">Product</p>
            <ul className="space-y-2 text-xs font-semibold text-slate-400">
              <li>
                <a href="#pricing-section" className="hover:text-white transition">
                  Pricing Calculator
                </a>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition">
                  Client Workspace
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-white transition">
                  14-Day Free Trial
                </Link>
              </li>
              <li>
                <span className="text-slate-600">Biometric Hardware Sync</span>
              </li>
              <li>
                <span className="text-slate-600">Automated Form 16 / TDS</span>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance (Razorpay Merchant Standard) */}
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-white">
              Compliance & Legal
            </p>
            <ul className="space-y-2 text-xs font-semibold text-slate-400">
              <li>
                <span className="hover:text-white cursor-pointer transition">Privacy Policy</span>
              </li>
              <li>
                <span className="hover:text-white cursor-pointer transition">Terms of Service</span>
              </li>
              <li>
                <span className="hover:text-white cursor-pointer transition">
                  Refund & Cancellation
                </span>
              </li>
              <li>
                <span className="hover:text-white cursor-pointer transition">
                  EPF / ESI Disclaimer
                </span>
              </li>
              <li>
                <span className="hover:text-white cursor-pointer transition">
                  Data Security & RLS
                </span>
              </li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-white">
              Contact & Support
            </p>
            <ul className="space-y-2.5 text-xs font-medium text-slate-400">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-400 shrink-0" />
                <span>support@infoyukti.com</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-400 shrink-0" />
                <span>+91 80 4567 8900</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <span>InfoYukti Smart Solutions Pvt Ltd, Bengaluru, India</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-500">
          <p>
            © {new Date().getFullYear()} InfoYukti Solutions. All rights reserved. GST Registered.
          </p>
          <p className="flex items-center gap-2">
            <span>Secured Online Payments powered by</span>
            <span className="font-black text-slate-300">Razorpay</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
