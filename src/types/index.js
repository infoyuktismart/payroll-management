/**
 * @typedef {Object} Employee
 * @property {string} id - UUID
 * @property {string} name
 * @property {string} email
 * @property {string} department_id
 * @property {string} designation_id
 * @property {string} salary_structure_id
 * @property {'active'|'inactive'|'on_leave'} status
 * @property {string} date_of_joining - ISO date string
 * @property {string} [date_of_exit] - ISO date string, optional
 */

/**
 * @typedef {Object} PayrollRun
 * @property {string} id - UUID
 * @property {number} month - 1-12
 * @property {number} year
 * @property {'draft'|'processing'|'finalized'|'paid'} status
 * @property {number} total_gross
 * @property {number} total_net
 * @property {number} total_deductions
 * @property {number} employee_count
 * @property {string} created_by - Employee UUID
 * @property {string} created_at - ISO datetime
 */

/**
 * @typedef {Object} LeaveRequest
 * @property {string} id - UUID
 * @property {string} employee_id
 * @property {'annual'|'sick'|'casual'|'maternity'|'paternity'|'unpaid'} type
 * @property {string} from_date - ISO date
 * @property {string} to_date - ISO date
 * @property {number} days
 * @property {'pending'|'approved'|'rejected'|'cancelled'} status
 * @property {string} reason
 * @property {string} [remarks] - Approver remarks
 */

/**
 * @typedef {Object} LoanRecord
 * @property {string} id - UUID
 * @property {string} employee_id
 * @property {number} amount - Total loan amount
 * @property {number} emi - Monthly EMI amount
 * @property {number} outstanding - Remaining balance
 * @property {number} tenure_months
 * @property {'pending'|'approved'|'disbursed'|'closed'} status
 */

/**
 * @typedef {Object} SalaryStructure
 * @property {string} id - UUID
 * @property {string} name - e.g. "Senior Engineer Band"
 * @property {number} basic_percent - Percentage of CTC
 * @property {number} hra_percent
 * @property {number} special_allowance_percent
 * @property {boolean} pf_applicable
 * @property {boolean} esi_applicable
 */

/**
 * @typedef {Object} AttendanceRecord
 * @property {string} id - UUID
 * @property {string} employee_id
 * @property {string} date - ISO date
 * @property {'present'|'absent'|'half_day'|'work_from_home'|'holiday'|'leave'} status
 * @property {string} [check_in] - ISO datetime
 * @property {string} [check_out] - ISO datetime
 */
export {}
