# InfoYukti Smart HRMS & Payroll Management System

[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-BaaS-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![TanStack Query](https://img.shields.io/badge/TanStack_Query-5.x-FF4154?logo=react-query&logoColor=white)](https://tanstack.com/query)
[![Vitest](https://img.shields.io/badge/Vitest-4.x-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

An enterprise-grade, multi-tenant Human Resource Management System (HRMS) and automated Payroll processing platform engineered for Indian statutory compliance (EPF, ESI, TDS, PT, LWF) and SaaS monetization (Per-Employee Per-Month billing via Razorpay).

---

## Key Features & Functional Modules

### 1. Core HR & Workforce Administration

- **Employee Lifecycle**: Digital employee directory, employment agreements, document vault, department/designation hierarchy, and job grade levels.
- **Onboarding Checklist**: Category-based task assignment (HR, IT Setup, General, Documentation) with due-date tracking and progress reporting.
- **Probation & Promotion History**: Milestone tracking, probation review workflows, and historical compensation/role progression records.
- **Exit & Resignation Management**: Resignation submission, manager approvals, customizable exit interview clearance checklists, and asset recovery.

### 2. Time, Attendance & Biometric Synchronization

- **Web Punch-In / Punch-Out**: Self-service punch logging with automatic IP and geofence verification.
- **Biometric Device Integration**: Direct CSV and USB hardware log parsing for automated shift attendance mapping.
- **Attendance Policies & Regularization**: Configurable late-mark penalties, half-day rules, overtime tracking, and manager regularization approval flows.
- **Sandwich Leave & Shift Engine**: Flexible shift rotations, weekend sandwich policy enforcement, and multi-branch holiday calendars.

### 3. Automated Payroll Processing & Compensation

- **One-Click Payroll Run**: Multi-department monthly payroll computation with automated Lop (Loss of Pay) deductions.
- **Dynamic Salary Structures**: Earnings (Basic, HRA, Conveyance, Special Allowance) and deductions breakdown with gross-to-net calculators.
- **Loans & Salary Advances**: EMI deduction schedules, interest tracking, loan approval lifecycle, and automated monthly balance reduction.
- **Expense Claims & Reimbursements**: Multi-category expense submission (Travel, Food, Medical), receipt attachments, and one-click payroll settlement.

### 4. Indian Statutory Compliance Engine

- **EPFO (Employees' Provident Fund)**: 12% employee + 12% employer statutory computation, wage ceiling enforcement (₹15,000), and automated ECR text generation.
- **ESIC (Employees' State Insurance)**: 0.75% employee + 3.25% employer monthly registers and eligibility monitoring (up to ₹21,000 gross).
- **Income Tax (TDS) & Form 16**: Regime selection (Old vs New), Section 80C, 80D, HRA deductions, Form 24Q quarterly statements, and automated Part B Form 16 PDF generation.
- **State-wise Professional Tax (PT) & LWF**: Built-in PT slab tables for Maharashtra, Karnataka, Telangana, Tamil Nadu, and West Bengal, with Labour Welfare Fund deductions.

### 5. Multi-Tenant SaaS Billing & Razorpay Integration

- **Flexible Billing Models**: Support for Flat Monthly pricing and Per-Employee Per-Month (PEPM) headcount billing.
- **Razorpay Checkout & Webhooks**: Integrated payment gateway with Content Security Policy (CSP) compatibility, modal checkout, and server-to-server webhook reconciliation (`payment.captured`, `order.paid`).
- **Feature Entitlements**: Automated plan gates for **Starter** (₹149/emp), **Growth** (₹129/emp), and **Enterprise** (₹99/emp) tiers.
- **Automated Tax Invoicing**: Sequential invoice generation (`INV-YYYYMM-XXXX`) with 18% GST itemization, payment receipts, and PDF print exports.

### 6. Employee Self-Service (ESS) Portal

- Mobile-responsive portal for staff to view attendance logs, submit leave applications, download digitally signed monthly payslips, declare income tax investments, and review company announcements.

### 7. Enterprise Security, Governance & Whitelabeling

- **Field-Level Encryption**: `pgcrypto` AES encryption for sensitive employee data (PAN, Aadhaar, bank account numbers).
- **Row-Level Security (RLS)**: Strict tenant and branch scoping on every database table preventing cross-tenant leakage.
- **Two-Factor Authentication (2FA)**: Time-based One-Time Password (TOTP) authenticator app integration.
- **Immutable Audit Logging**: Automatic database triggers logging user modifications, before/after snapshots, and client IP addresses.
- **Whitelabeling**: Custom tenant branding, logos, color themes, and multi-company holding workspace switching.

---

## Technology Stack

| Layer                          | Technologies                                                             |
| ------------------------------ | ------------------------------------------------------------------------ |
| **Frontend Framework**         | React 19, Vite 6                                                         |
| **State & Cache Management**   | TanStack React Query v5, Context API                                     |
| **Styling & Design System**    | Tailwind CSS v4, Lucide React Icons, Clsx                                |
| **Backend & Database**         | Supabase (PostgreSQL 15), Row-Level Security (RLS), PL/pgSQL             |
| **Serverless & Edge**          | Supabase Edge Functions (Deno TypeScript)                                |
| **Payment Gateway**            | Razorpay Node/Deno API, Razorpay Checkout SDK, Webhook HMAC Verification |
| **Document & Data Processing** | jsPDF, html2canvas, SheetJS (xlsx), date-fns                             |
| **Testing & Quality**          | Vitest, Testing Library, Playwright (E2E), ESLint 9                      |
| **PWA & Offline**              | Workbox PWA Plugin, Service Worker asset precaching                      |

---

## Directory Architecture

```
Payroll_Management/
├── db/                         # SQL seed files and setup scripts
├── public/                     # Static assets, PWA icons, manifest.json
├── src/
│   ├── components/             # Reusable modular UI components
│   │   ├── attendance/         # Attendance punch, modals, bulk upload
│   │   ├── billing/            # Invoices table, stats, estimators
│   │   ├── company/            # Whitelabel branding, legal compliance
│   │   ├── employees/          # Employee forms, salary sliders, filters
│   │   ├── landing/            # Interactive PEPM pricing slider, footer
│   │   ├── onboarding/         # Checklist table, task assignment modals
│   │   ├── payroll/            # Payroll run cards, salary distribution
│   │   └── reports/            # Compliance charts, Form 16 preview
│   ├── context/                # AuthContext, CompanyContext, ToastContext
│   ├── hooks/                  # Custom React Query & UI hooks
│   ├── layouts/                # DashboardLayout (categorized sidebar, PWA nav)
│   ├── lib/                    # Supabase client, audit service, date/tax utils
│   ├── pages/                  # Route views (Dashboard, Attendance, Payroll, etc.)
│   ├── services/               # API service layer with retry & tenant scoping
│   └── tests/                  # Unit and integration test suites
├── supabase/
│   ├── functions/              # Edge functions (razorpay-checkout, razorpay-webhook)
│   └── migrations/             # Timestamped SQL schema migrations
├── index.html                  # Entry point with hardened CSP policies
├── package.json                # Project dependencies and script runner
└── vite.config.js              # Vite config with manual chunking & PWA setup
```

---

## Getting Started

### 1. Prerequisites

- **Node.js**: v18.0.0 or higher
- **Package Manager**: npm (v9+) or pnpm
- **Supabase Account**: A provisioned Supabase cloud project or local Docker instance

### 2. Installation

```bash
git clone https://github.com/infoyuktismart/payroll-management.git
cd payroll-management
npm install
```

### 3. Environment Configuration

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

For Supabase Edge Functions (`supabase/functions/`):

```env
RAZORPAY_KEY_ID=rzp_live_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### 4. Database Setup & Migrations

Execute the migrations in sequential order using the Supabase CLI or SQL Editor:

```bash
npx supabase migration up
```

_(All migrations are tracked under `supabase/migrations/`)._

### 5. Running the Application

```bash
# Start local development server (Vite on port 5173)
npm run dev

# Run unit & integration test suites (Vitest)
npm run test

# Run linter
npm run lint

# Compile production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## Security & Compliance Architecture

1. **Content Security Policy (CSP)**:
   Strict headers enforced in `index.html` preventing XSS, unauthorized frame embedding, and restricting payment gateway scripts exclusively to `https://checkout.razorpay.com` and `https://api.razorpay.com`.

2. **Statutory Cascade Delete Protection**:
   Foreign keys on historical transactional records (`tax_declarations`, `loans`, `reimbursements`, `payroll_items`) enforce `ON DELETE RESTRICT`. Staff departures utilize soft-deletion (`is_deleted: true, status: 'inactive'`), ensuring 8-year statutory compliance with the Income Tax and EPF Acts.

3. **Tenant & Branch Isolation**:
   Every database query is piped through `withCompanyScope` and validated by Supabase Row-Level Security policies against `auth.uid()` and tenant membership claims.

---

## License

This project is licensed under the MIT License. Copyright © InfoYukti Solutions. All rights reserved.
