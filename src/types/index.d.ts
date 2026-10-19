export interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  gender?: string;
  marital_status?: string;
  dob?: string;
  joining_date?: string;
  phone: string;
  designation?: string;
  department?: string;
  salary?: number;
  role?: 'admin' | 'employee' | 'hr' | 'manager';
  pan_number?: string;
  aadhaar_number?: string;
  status: 'active' | 'terminated' | 'resigned' | 'on_leave';
  company_id?: string;
  branch_id?: string;
  created_at: string;
}

export interface PayrollRun {
  id: string;
  month: string; // YYYY-MM
  status: 'draft' | 'processing' | 'finalized' | 'paid';
  company_id?: string;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: 'Sick Leave' | 'Casual Leave' | 'Privilege Leave' | 'Unpaid Leave' | string;
  start_date: string;
  end_date: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  company_id?: string;
  created_at: string;
}

export interface LoanRecord {
  id: string;
  employee_id: string;
  amount: number;
  emi: number;
  outstanding: number;
  tenure_months: number;
  status: 'pending' | 'approved' | 'disbursed' | 'closed';
  company_id?: string;
  created_at: string;
}

export interface SalaryStructure {
  id: string;
  employee_id: string;
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary?: number;
  payment_date?: string;
  company_id?: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  status: 'present' | 'absent' | 'half_day' | 'work_from_home' | 'holiday' | 'leave';
  check_in?: string;
  check_out?: string;
  company_id?: string;
}
