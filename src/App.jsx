import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { CompanyProvider } from './context/CompanyContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './layouts/DashboardLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

import Employees from './pages/Employees'
import Attendance from './pages/Attendance'
import Leaves from './pages/Leaves'
import Overtime from './pages/Overtime'
import Salaries from './pages/Salaries'
import SalaryStructure from './pages/SalaryStructure'
// import Deductions from './pages/Deductions'
import PayrollProcessing from './pages/PayrollProcessing'
import Reports from './pages/Reports'
import Exits from './pages/Exits'
import EmployeePortal from './pages/EmployeePortal'
import AdminSettings from './pages/AdminSettings'
import CompanySettings from './pages/CompanySettings'
import TaxDeclarations from './pages/TaxDeclarations'
import Onboarding from './pages/Onboarding'
import Loans from './pages/Loans'
import Reimbursements from './pages/Reimbursements'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <CompanyProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route path="/" element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Dashboard />} />
                  <Route path="employees" element={<Employees />} />
                  <Route path="attendance" element={<Attendance />} />
                  <Route path="leaves" element={<Leaves />} />
                  <Route path="overtime" element={<Overtime />} />
                  <Route path="salary-structure" element={<SalaryStructure />} />
                  {/* <Route path="deductions" element={<Deductions />} /> */}
                  <Route path="payroll-processing" element={<PayrollProcessing />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="salaries" element={<Salaries />} />
                  <Route path="exits" element={<Exits />} />
                  <Route path="tax-declarations" element={<TaxDeclarations />} />
                  <Route path="onboarding" element={<Onboarding />} />
                  <Route path="loans" element={<Loans />} />
                  <Route path="reimbursements" element={<Reimbursements />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="company-settings" element={<CompanySettings />} />
                  <Route path="portal" element={<EmployeePortal />} />
                </Route>
              </Routes>
            </Router>
          </CompanyProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
