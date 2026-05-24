# Testing Strategy

We follow a manual verification strategy for this MVP. Below are the key test cases to ensure the application functionality.

## Unit Testing
- We use ESLint for static code analysis to ensure code quality.
- Future improvements: Integrate `Vitest` and `React Testing Library` for component testing.

## Manual Test Cases

### 1. Authentication
- [ ] **Sign In**: Enter valid credentials -> Redirect to Dashboard.
- [ ] **Invalid Sign In**: Enter wrong credentials -> Show error message.
- [ ] **Sign Out**: Click Sign Out -> Redirect to Login Page.
- [ ] **Protected Routes**: Try to access `/employees` without login -> Redirect to Login.

### 2. Employee Management (Admin)
- [ ] **Add Employee**: Fill form and submit -> New employee appears in list.
- [ ] **List View**: Ensure all added employees are listed with correct status.
- [ ] **Search**: Type name in search bar -> List filters correctly.

### 3. Leave Management
- [ ] **Request Leave (Employee)**: Submit request -> Appears as 'Pending'.
- [ ] **Approve Leave (Admin)**: Click Approve -> Status becomes 'Approved'.
- [ ] **Reject Leave (Admin)**: Click Reject -> Status becomes 'Rejected'.

### 4. Overtime
- [ ] **Request Overtime**: Submit hours and date -> Appears in list.
- [ ] **Process Overtime**: Admin approves/rejects request.

### 5. Salaries
- [ ] **Process Salary**: Select employee, enter amounts -> Net Salary calculates correctly.
- [ ] **View History**: Processed salary appears in the history table.

### 6. Exits
- [ ] **Process Exit**: Select employee, enter date/reason -> Employee status updates to 'Terminated'/'Resigned' in Employees list.

## Debugging
- Use Chrome DevTools > Console for tracking API errors.
- Use Supabase Dashboard to verify data persistence.
