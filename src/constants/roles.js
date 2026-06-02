export const ROLES = {
  ADMIN:       'admin',
  HR:          'hr',
  HR_MANAGER:  'hr_manager',
  HR_ADMIN:    'hr_admin',
  EMPLOYEE:    'employee',
  MANAGER:     'manager',
  PAYROLL:     'payroll_manager',
}

export const ADMIN_ROLES = [
  ROLES.ADMIN,
  ROLES.HR,
  ROLES.HR_MANAGER,
  ROLES.HR_ADMIN,
  'hr manager',
  'hr-admin',
  'hr-manager',
  'hr_admin_manager',
  'hr administrator',
  'administrator',
  'superadmin',
  'hr_head',
  'hr_executive',
  'human resources'
]

export const isAdminRole = (role) => {
  const normalized = role?.toLowerCase()?.trim()
  return ADMIN_ROLES.includes(normalized)
}
