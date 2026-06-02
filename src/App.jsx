import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { CompanyProvider } from './context/CompanyContext'
import ErrorBoundary from './components/ErrorBoundary'
import RouteErrorBoundary from './components/RouteErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './layouts/DashboardLayout'
import PageLoader from './components/PageLoader'

const Login = lazy(() => import('./pages/Login'))
const Landing = lazy(() => import('./pages/Landing'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Employees = lazy(() => import('./pages/Employees'))
const Attendance = lazy(() => import('./pages/Attendance'))
const Leaves = lazy(() => import('./pages/Leaves'))
const Overtime = lazy(() => import('./pages/Overtime'))
const Salaries = lazy(() => import('./pages/Salaries'))
const SalaryStructure = lazy(() => import('./pages/SalaryStructure'))
const PayrollProcessing = lazy(() => import('./pages/PayrollProcessing'))
const Reports = lazy(() => import('./pages/Reports'))
const Exits = lazy(() => import('./pages/Exits'))
const EmployeePortal = lazy(() => import('./pages/EmployeePortal'))
const AdminSettings = lazy(() => import('./pages/AdminSettings'))
const CompanySettings = lazy(() => import('./pages/CompanySettings'))
const TaxDeclarations = lazy(() => import('./pages/TaxDeclarations'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Loans = lazy(() => import('./pages/Loans'))
const Reimbursements = lazy(() => import('./pages/Reimbursements'))
const Signup = lazy(() => import('./pages/Signup'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const SetupWizard = lazy(() => import('./pages/SetupWizard'))
const TwoFactorSetup = lazy(() => import('./pages/TwoFactorSetup'))
const SecuritySettings = lazy(() => import('./pages/SecuritySettings'))
const Analytics = lazy(() => import('./pages/Analytics'))
const ReportBuilder = lazy(() => import('./pages/ReportBuilder'))
const BiometricImport = lazy(() => import('./pages/BiometricImport'))
const AuditLogViewer = lazy(() => import('./pages/AuditLogViewer'))
const SubscriptionManagement = lazy(() => import('./pages/SubscriptionManagement'))
const SystemHealth = lazy(() => import('./pages/SystemHealth'))
const BillingInvoices = lazy(() => import('./pages/BillingInvoices'))
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'))

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<RouteErrorBoundary><Landing /></RouteErrorBoundary>} />
                <Route path="/login" element={<RouteErrorBoundary><Login /></RouteErrorBoundary>} />
                <Route path="/signup" element={<RouteErrorBoundary><Signup /></RouteErrorBoundary>} />
                <Route path="/register" element={<RouteErrorBoundary><Register /></RouteErrorBoundary>} />
                <Route path="/setup-wizard" element={<RouteErrorBoundary><SetupWizard /></RouteErrorBoundary>} />
                <Route path="/forgot-password" element={<RouteErrorBoundary><ForgotPassword /></RouteErrorBoundary>} />
                <Route path="/reset-password" element={<RouteErrorBoundary><ResetPassword /></RouteErrorBoundary>} />

                <Route element={
                  <CompanyProvider>
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  </CompanyProvider>
                }>
                    <Route path="dashboard" element={<RouteErrorBoundary><Dashboard /></RouteErrorBoundary>} />
                    <Route path="employees" element={<RouteErrorBoundary><Employees /></RouteErrorBoundary>} />
                    <Route path="attendance" element={<RouteErrorBoundary><Attendance /></RouteErrorBoundary>} />
                    <Route path="leaves" element={<RouteErrorBoundary><Leaves /></RouteErrorBoundary>} />
                    <Route path="overtime" element={<RouteErrorBoundary><Overtime /></RouteErrorBoundary>} />
                    <Route path="salary-structure" element={<RouteErrorBoundary><SalaryStructure /></RouteErrorBoundary>} />
                    {/* <Route path="deductions" element={<Deductions />} /> */}
                    <Route path="payroll-processing" element={<RouteErrorBoundary><PayrollProcessing /></RouteErrorBoundary>} />
                    <Route path="reports" element={<RouteErrorBoundary><Reports /></RouteErrorBoundary>} />
                    <Route path="analytics" element={<RouteErrorBoundary><Analytics /></RouteErrorBoundary>} />
                    <Route path="report-builder" element={<RouteErrorBoundary><ReportBuilder /></RouteErrorBoundary>} />
                    <Route path="biometric-import" element={<RouteErrorBoundary><BiometricImport /></RouteErrorBoundary>} />
                    <Route path="salaries" element={<RouteErrorBoundary><Salaries /></RouteErrorBoundary>} />
                    <Route path="exits" element={<RouteErrorBoundary><Exits /></RouteErrorBoundary>} />
                    <Route path="tax-declarations" element={<RouteErrorBoundary><TaxDeclarations /></RouteErrorBoundary>} />
                    <Route path="onboarding" element={<RouteErrorBoundary><Onboarding /></RouteErrorBoundary>} />
                    <Route path="loans" element={<RouteErrorBoundary><Loans /></RouteErrorBoundary>} />
                    <Route path="reimbursements" element={<RouteErrorBoundary><Reimbursements /></RouteErrorBoundary>} />
                    <Route path="settings" element={<RouteErrorBoundary><AdminSettings /></RouteErrorBoundary>} />
                    <Route path="audit-logs" element={<RouteErrorBoundary><AuditLogViewer /></RouteErrorBoundary>} />
                    <Route path="subscription-management" element={<RouteErrorBoundary><SubscriptionManagement /></RouteErrorBoundary>} />
                    <Route path="billing" element={<RouteErrorBoundary><BillingInvoices /></RouteErrorBoundary>} />
                    <Route path="superadmin" element={<RouteErrorBoundary><SuperAdminDashboard /></RouteErrorBoundary>} />
                    <Route path="system-health" element={<RouteErrorBoundary><SystemHealth /></RouteErrorBoundary>} />
                    <Route path="security-settings" element={<RouteErrorBoundary><SecuritySettings /></RouteErrorBoundary>} />
                    <Route path="security/2fa" element={<RouteErrorBoundary><TwoFactorSetup /></RouteErrorBoundary>} />
                    <Route path="company-settings" element={<RouteErrorBoundary><CompanySettings /></RouteErrorBoundary>} />
                    <Route path="portal" element={<RouteErrorBoundary><EmployeePortal /></RouteErrorBoundary>} />
                </Route>
              </Routes>
            </Suspense>
          </Router>
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
