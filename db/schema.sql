-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create profiles table
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  role text default 'employee', -- 'admin' or 'employee'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Create function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'employee');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
-- Note: If this fails with permission errors, you may need to create profiles manually in your app logic
-- or run this part as a superuser if possible. However, in standard Supabase projects, this usually works.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Create Employees Table
create table public.employees (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users, -- Link to auth user if they have login access
  employee_id text unique,
  first_name text not null,
  last_name text not null,
  email text not null,
  gender text,
  marital_status text,
  dob date,
  joining_date date,
  phone text,
  emergency_contact_person text,
  emergency_contact_number text,
  designation text,
  current_address text,
  permanent_address text,
  department text,
  reporting_person text,
  salary numeric,
  role text,
  pan_number text,
  aadhaar_number text,
  bank_name text,
  bank_account_number text,
  ifsc_code text,
  salary_allowances numeric default 0,
  salary_deductions numeric default 0,
  salary_structure jsonb default '{}'::jsonb,
  salary_effective_date date,
  probation_period text,
  uan_number text,
  esi_number text,
  id_proof_url text,
  address_proof_url text,
  status text default 'active', -- 'active', 'on_leave', 'terminated', 'resigned'
  created_by uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Leaves Table
create table public.leaves (
  id uuid default uuid_generate_v4() primary key,
  employee_id uuid references public.employees not null,
  leave_type text not null, -- 'sick', 'vacation', 'casual'
  start_date date not null,
  end_date date not null,
  reason text,
  status text default 'pending', -- 'pending', 'approved', 'rejected'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Overtime Table
create table public.overtime (
  id uuid default uuid_generate_v4() primary key,
  employee_id uuid references public.employees not null,
  date date not null,
  hours numeric not null,
  reason text,
  status text default 'pending', -- 'pending', 'approved', 'rejected'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Salaries Table (History of payments)
create table public.salaries (
  id uuid default uuid_generate_v4() primary key,
  employee_id uuid references public.employees not null,
  month date not null, -- Store as first day of month e.g., 2023-10-01
  basic_salary numeric not null,
  allowances numeric default 0,
  deductions numeric default 0,
  net_salary numeric generated always as (basic_salary + allowances - deductions) stored,
  payment_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Exits Table
create table public.exits (
  id uuid default uuid_generate_v4() primary key,
  employee_id uuid references public.employees not null,
  exit_date date not null,
  reason text,
  interview_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies

-- Profiles
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

create policy "Users can insert their own profile"
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- Employees
alter table public.employees enable row level security;

create policy "Enable read access for all authenticated users"
  on employees for select
  using ( auth.role() = 'authenticated' );

create policy "Enable insert for authenticated users" 
  on employees for insert 
  with check ( auth.role() = 'authenticated' ); 

create policy "Enable update for authenticated users" 
  on employees for update 
  using ( auth.role() = 'authenticated' );

-- Leaves
alter table public.leaves enable row level security;
create policy "Enable all access for all authenticated users" on public.leaves for all using (auth.role() = 'authenticated');

-- Overtime
alter table public.overtime enable row level security;
create policy "Enable all access for all authenticated users" on public.overtime for all using (auth.role() = 'authenticated');

-- Salaries
alter table public.salaries enable row level security;
create policy "Enable all access for all authenticated users" on public.salaries for all using (auth.role() = 'authenticated');

-- Exits
alter table public.exits enable row level security;
create policy "Enable all access for all authenticated users" on public.exits for all using (auth.role() = 'authenticated');
-- Create Attendance Table
create table public.attendance (
  id uuid default uuid_generate_v4() primary key,
  employee_id uuid references public.employees not null,
  date date default current_date not null,
  check_in timestamp with time zone,
  check_out timestamp with time zone,
  status text default 'present', -- 'present', 'absent', 'late'
  remarks text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(employee_id, date)
);

alter table public.attendance enable row level security;
create policy "Enable all access for all authenticated users" on public.attendance for all using (auth.role() = 'authenticated');

-- Create Salary Components Table
create table public.salary_components (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  code text,
  system_type text, -- 'PF', 'ESI', 'PT', etc.
  type text not null check (type in ('earning', 'deduction')),
  calculation_type text not null check (calculation_type in ('percentage', 'fixed')),
  value numeric not null default 0,
  min_limit numeric default 0,
  max_limit numeric default 0,
  is_taxable boolean default false,
  is_statutory boolean default false,
  status text default 'Active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Salary Components
alter table public.salary_components enable row level security;
create policy "Enable all access for all authenticated users" on public.salary_components for all using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Production hardening and schema parity
-- This section keeps schema.sql aligned with the application modules and
-- replaces the permissive bootstrap policies above with role-aware policies.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists updated_at timestamp with time zone;

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    nullif((select lower(trim(role)) from public.profiles where id = auth.uid()), ''),
    nullif((select lower(trim(role)) from public.employees where user_id = auth.uid() limit 1), ''),
    'employee'
  );
$$;

create or replace function public.is_admin_or_hr()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_user_role() in (
    'admin',
    'administrator',
    'superadmin',
    'hr',
    'hr_manager',
    'hr manager',
    'hr-admin',
    'hr_admin',
    'hr_admin_manager',
    'hr administrator',
    'hr_head',
    'hr_executive',
    'human resources'
  );
$$;

alter table public.employees add column if not exists registration_id text unique;
alter table public.employees add column if not exists profile_photo_url text;
alter table public.employees add column if not exists leave_balance numeric default 20;
alter table public.employees add column if not exists is_specially_abled boolean default false;
alter table public.employees add column if not exists notice_period_days integer default 30;
alter table public.employees add column if not exists updated_at timestamp with time zone;
alter table public.employees add column if not exists pan_number_enc bytea;
alter table public.employees add column if not exists aadhaar_number_enc bytea;
alter table public.employees add column if not exists bank_account_number_enc bytea;

comment on column public.employees.pan_number is 'Legacy plaintext field retained for compatibility. New deployments should write encrypted PAN data to pan_number_enc.';
comment on column public.employees.aadhaar_number is 'Legacy plaintext field retained for compatibility. New deployments should write encrypted Aadhaar data to aadhaar_number_enc.';
comment on column public.employees.bank_account_number is 'Legacy plaintext field retained for compatibility. New deployments should write encrypted bank account data to bank_account_number_enc.';

alter table public.leaves add column if not exists updated_at timestamp with time zone;
alter table public.leaves add column if not exists days numeric default 0;
alter table public.leaves add column if not exists balance_deducted numeric default 0;
alter table public.leaves add column if not exists policy_year integer default extract(year from current_date)::integer;
alter table public.leaves add column if not exists approved_at timestamp with time zone;
alter table public.leaves add column if not exists approved_by uuid references auth.users;
alter table public.leaves add column if not exists rejected_at timestamp with time zone;
alter table public.leaves add column if not exists rejected_by uuid references auth.users;
alter table public.overtime add column if not exists updated_at timestamp with time zone;
alter table public.attendance add column if not exists updated_at timestamp with time zone;

alter table public.exits add column if not exists resignation_date date default current_date;
alter table public.exits add column if not exists last_working_day date;
alter table public.exits add column if not exists status text default 'pending';
alter table public.exits add column if not exists it_clearance boolean default false;
alter table public.exits add column if not exists it_clearance_notes text;
alter table public.exits add column if not exists it_clearance_by uuid references auth.users;
alter table public.exits add column if not exists finance_clearance boolean default false;
alter table public.exits add column if not exists finance_clearance_notes text;
alter table public.exits add column if not exists finance_clearance_by uuid references auth.users;
alter table public.exits add column if not exists hr_clearance boolean default false;
alter table public.exits add column if not exists hr_clearance_notes text;
alter table public.exits add column if not exists hr_clearance_by uuid references auth.users;
alter table public.exits add column if not exists admin_clearance boolean default false;
alter table public.exits add column if not exists admin_clearance_notes text;
alter table public.exits add column if not exists admin_clearance_by uuid references auth.users;
alter table public.exits add column if not exists settlement_details jsonb default '{}'::jsonb;
alter table public.exits add column if not exists settlement_amount numeric default 0;
alter table public.exits add column if not exists settlement_date date;

create table if not exists public.departments (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  description text,
  status text default 'Active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.leave_policies (
  id uuid default uuid_generate_v4() primary key,
  leave_type text not null unique,
  annual_balance numeric not null default 0,
  carry_forward boolean default false,
  status text default 'Active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.leave_balances (
  id uuid default uuid_generate_v4() primary key,
  employee_id uuid references public.employees(id) on delete cascade not null,
  leave_type text not null,
  balance numeric not null default 0,
  year integer not null default extract(year from current_date)::integer,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(employee_id, leave_type, year)
);

create table if not exists public.employee_documents (
  id uuid default uuid_generate_v4() primary key,
  employee_id uuid references public.employees(id) on delete cascade not null,
  document_type text not null,
  file_name text,
  file_url text not null,
  uploaded_by uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.holidays (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  date date not null unique,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.generated_reports (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  title text not null,
  report_type text not null,
  description text,
  status text default 'available' check (status in ('available', 'pending', 'processing', 'failed')),
  file_url text,
  metadata jsonb default '{}'::jsonb,
  generated_date date default current_date
);

create table if not exists public.payroll_runs (
  id uuid default uuid_generate_v4() primary key,
  month_year date not null unique,
  total_amount numeric(15, 2) default 0,
  status text check (status in ('Draft', 'Completed', 'Paid')) default 'Draft',
  total_employees integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  processed_at timestamp with time zone,
  processed_by uuid references auth.users
);

create table if not exists public.payroll_items (
  id uuid default uuid_generate_v4() primary key,
  payroll_run_id uuid references public.payroll_runs(id) on delete cascade not null,
  employee_id uuid references public.employees(id) not null,
  basic_salary numeric(15, 2) default 0,
  total_allowances numeric(15, 2) default 0,
  total_deductions numeric(15, 2) default 0,
  net_salary numeric(15, 2) default 0,
  attendance_days numeric(5, 2) default 0,
  breakdown jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(payroll_run_id, employee_id)
);

create table if not exists public.custom_deductions (
  id uuid default uuid_generate_v4() primary key,
  employee_id uuid references public.employees(id) on delete cascade not null,
  deduction_type text not null,
  amount numeric(15, 2) not null default 0,
  reason text,
  is_recurring boolean default false,
  start_date date not null default current_date,
  end_date date,
  status text default 'Active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.audit_logs (
  id uuid default uuid_generate_v4() primary key,
  actor_id uuid references auth.users,
  table_name text not null,
  record_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.notification_logs (
  id uuid default gen_random_uuid() primary key,
  channel text not null default 'email',
  notification_type text not null,
  recipient_email text not null,
  subject text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider text,
  provider_message_id text,
  error_message text,
  metadata jsonb default '{}'::jsonb,
  created_by uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  sent_at timestamp with time zone
);

create table if not exists public.tax_declarations (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references public.employees(id) on delete cascade not null,
  financial_year text not null,
  regime text not null default 'new' check (regime in ('old', 'new')),
  section_80c numeric(15, 2) default 0,
  section_80d numeric(15, 2) default 0,
  hra_exemption numeric(15, 2) default 0,
  home_loan_interest numeric(15, 2) default 0,
  other_deductions numeric(15, 2) default 0,
  other_income numeric(15, 2) default 0,
  tds_already_deducted numeric(15, 2) default 0,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  notes text,
  reviewed_by uuid references auth.users,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(employee_id, financial_year)
);

create table if not exists public.tax_regime_configs (
  id uuid default gen_random_uuid() primary key,
  financial_year text not null unique,
  config jsonb not null default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_employees_user_id on public.employees(user_id);
create index if not exists idx_attendance_employee_date on public.attendance(employee_id, date);
create index if not exists idx_leaves_employee_dates on public.leaves(employee_id, start_date, end_date);
create index if not exists idx_overtime_employee_date on public.overtime(employee_id, date);
create index if not exists idx_payroll_runs_month_year on public.payroll_runs(month_year);
create index if not exists idx_payroll_items_employee_id on public.payroll_items(employee_id);
create index if not exists idx_custom_deductions_employee_id on public.custom_deductions(employee_id);
create index if not exists idx_leave_balances_employee_type_year on public.leave_balances(employee_id, lower(leave_type), year);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_table_record on public.audit_logs(table_name, record_id);
create index if not exists idx_notification_logs_created_at on public.notification_logs(created_at desc);
create index if not exists idx_notification_logs_recipient on public.notification_logs(recipient_email);
create index if not exists idx_notification_logs_type_status on public.notification_logs(notification_type, status);
create index if not exists idx_tax_declarations_employee_year on public.tax_declarations(employee_id, financial_year);
create index if not exists idx_tax_declarations_status on public.tax_declarations(status);

alter table public.departments enable row level security;
alter table public.leave_policies enable row level security;
alter table public.leave_balances enable row level security;
alter table public.employee_documents enable row level security;
alter table public.holidays enable row level security;
alter table public.generated_reports enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_items enable row level security;
alter table public.custom_deductions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notification_logs enable row level security;
alter table public.tax_declarations enable row level security;
alter table public.tax_regime_configs enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Enable read access for all authenticated users" on public.employees;
drop policy if exists "Enable insert for authenticated users" on public.employees;
drop policy if exists "Enable update for authenticated users" on public.employees;
drop policy if exists "Enable all access for all authenticated users" on public.leaves;
drop policy if exists "Enable all access for all authenticated users" on public.overtime;
drop policy if exists "Enable all access for all authenticated users" on public.salaries;
drop policy if exists "Enable all access for all authenticated users" on public.exits;
drop policy if exists "Enable all access for all authenticated users" on public.attendance;
drop policy if exists "Enable all access for all authenticated users" on public.salary_components;
drop policy if exists "Profiles view own or admin" on public.profiles;
drop policy if exists "Profiles update own or admin" on public.profiles;
drop policy if exists "Employees select own or admin" on public.employees;
drop policy if exists "Employees insert admin" on public.employees;
drop policy if exists "Employees update own limited or admin" on public.employees;
drop policy if exists "Employees delete admin" on public.employees;
drop policy if exists "Attendance select own or admin" on public.attendance;
drop policy if exists "Attendance manage admin" on public.attendance;
drop policy if exists "Leaves select own or admin" on public.leaves;
drop policy if exists "Leaves insert own or admin" on public.leaves;
drop policy if exists "Leaves update admin" on public.leaves;
drop policy if exists "Overtime select own or admin" on public.overtime;
drop policy if exists "Overtime insert own or admin" on public.overtime;
drop policy if exists "Overtime update admin" on public.overtime;
drop policy if exists "Salaries select own or admin" on public.salaries;
drop policy if exists "Salaries manage admin" on public.salaries;
drop policy if exists "Exits select own or admin" on public.exits;
drop policy if exists "Exits insert own or admin" on public.exits;
drop policy if exists "Exits update admin" on public.exits;
drop policy if exists "Salary components read authenticated" on public.salary_components;
drop policy if exists "Salary components manage admin" on public.salary_components;
drop policy if exists "Departments read authenticated" on public.departments;
drop policy if exists "Departments manage admin" on public.departments;
drop policy if exists "Leave policies read authenticated" on public.leave_policies;
drop policy if exists "Leave policies manage admin" on public.leave_policies;
drop policy if exists "Leave balances select own or admin" on public.leave_balances;
drop policy if exists "Leave balances manage admin" on public.leave_balances;
drop policy if exists "Documents select own or admin" on public.employee_documents;
drop policy if exists "Documents manage own or admin" on public.employee_documents;
drop policy if exists "Holidays read authenticated" on public.holidays;
drop policy if exists "Holidays manage admin" on public.holidays;
drop policy if exists "Reports select admin" on public.generated_reports;
drop policy if exists "Reports manage admin" on public.generated_reports;
drop policy if exists "Payroll runs select admin" on public.payroll_runs;
drop policy if exists "Payroll runs manage admin" on public.payroll_runs;
drop policy if exists "Payroll items select own or admin" on public.payroll_items;
drop policy if exists "Payroll items manage admin" on public.payroll_items;
drop policy if exists "Custom deductions select own or admin" on public.custom_deductions;
drop policy if exists "Custom deductions manage admin" on public.custom_deductions;
drop policy if exists "Audit logs select admin" on public.audit_logs;
drop policy if exists "Audit logs insert authenticated" on public.audit_logs;
drop policy if exists "Notification logs select admin" on public.notification_logs;
drop policy if exists "Notification logs insert authenticated" on public.notification_logs;
drop policy if exists "Notification logs update service" on public.notification_logs;
drop policy if exists "Tax declarations select own or admin" on public.tax_declarations;
drop policy if exists "Tax declarations insert own or admin" on public.tax_declarations;
drop policy if exists "Tax declarations update own draft or admin" on public.tax_declarations;
drop policy if exists "Tax declarations delete admin" on public.tax_declarations;
drop policy if exists "Tax configs read authenticated" on public.tax_regime_configs;
drop policy if exists "Tax configs manage admin" on public.tax_regime_configs;

create policy "Profiles view own or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin_or_hr());

create policy "Profiles update own or admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin_or_hr())
  with check (auth.uid() = id or public.is_admin_or_hr());

create policy "Employees select own or admin"
  on public.employees for select
  using (user_id = auth.uid() or public.is_admin_or_hr());

create policy "Employees insert admin"
  on public.employees for insert
  with check (public.is_admin_or_hr());

create policy "Employees update own limited or admin"
  on public.employees for update
  using (user_id = auth.uid() or public.is_admin_or_hr())
  with check (user_id = auth.uid() or public.is_admin_or_hr());

create policy "Employees delete admin"
  on public.employees for delete
  using (public.is_admin_or_hr());

create policy "Attendance select own or admin" on public.attendance for select
  using (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = attendance.employee_id and e.user_id = auth.uid()));
create policy "Attendance manage admin" on public.attendance for all using (public.is_admin_or_hr()) with check (public.is_admin_or_hr());

create policy "Leaves select own or admin" on public.leaves for select
  using (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = leaves.employee_id and e.user_id = auth.uid()));
create policy "Leaves insert own or admin" on public.leaves for insert
  with check (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = leaves.employee_id and e.user_id = auth.uid()));
create policy "Leaves update admin" on public.leaves for update using (public.is_admin_or_hr()) with check (public.is_admin_or_hr());

create policy "Overtime select own or admin" on public.overtime for select
  using (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = overtime.employee_id and e.user_id = auth.uid()));
create policy "Overtime insert own or admin" on public.overtime for insert
  with check (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = overtime.employee_id and e.user_id = auth.uid()));
create policy "Overtime update admin" on public.overtime for update using (public.is_admin_or_hr()) with check (public.is_admin_or_hr());

create policy "Salaries select own or admin" on public.salaries for select
  using (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = salaries.employee_id and e.user_id = auth.uid()));
create policy "Salaries manage admin" on public.salaries for all using (public.is_admin_or_hr()) with check (public.is_admin_or_hr());

create policy "Exits select own or admin" on public.exits for select
  using (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = exits.employee_id and e.user_id = auth.uid()));
create policy "Exits insert own or admin" on public.exits for insert
  with check (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = exits.employee_id and e.user_id = auth.uid()));
create policy "Exits update admin" on public.exits for update using (public.is_admin_or_hr()) with check (public.is_admin_or_hr());

create policy "Salary components read authenticated" on public.salary_components for select using (auth.role() = 'authenticated');
create policy "Salary components manage admin" on public.salary_components for all using (public.is_admin_or_hr()) with check (public.is_admin_or_hr());

create policy "Departments read authenticated" on public.departments for select using (auth.role() = 'authenticated');
create policy "Departments manage admin" on public.departments for all using (public.is_admin_or_hr()) with check (public.is_admin_or_hr());

create policy "Leave policies read authenticated" on public.leave_policies for select using (auth.role() = 'authenticated');
create policy "Leave policies manage admin" on public.leave_policies for all using (public.is_admin_or_hr()) with check (public.is_admin_or_hr());

create policy "Leave balances select own or admin" on public.leave_balances for select
  using (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = leave_balances.employee_id and e.user_id = auth.uid()));
create policy "Leave balances manage admin" on public.leave_balances for all using (public.is_admin_or_hr()) with check (public.is_admin_or_hr());

create policy "Documents select own or admin" on public.employee_documents for select
  using (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = employee_documents.employee_id and e.user_id = auth.uid()));
create policy "Documents manage own or admin" on public.employee_documents for all
  using (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = employee_documents.employee_id and e.user_id = auth.uid()))
  with check (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = employee_documents.employee_id and e.user_id = auth.uid()));

create policy "Holidays read authenticated" on public.holidays for select using (auth.role() = 'authenticated');
create policy "Holidays manage admin" on public.holidays for all using (public.is_admin_or_hr()) with check (public.is_admin_or_hr());

create policy "Reports select admin" on public.generated_reports for select using (public.is_admin_or_hr());
create policy "Reports manage admin" on public.generated_reports for all using (public.is_admin_or_hr()) with check (public.is_admin_or_hr());

create policy "Payroll runs select admin" on public.payroll_runs for select using (public.is_admin_or_hr());
create policy "Payroll runs manage admin" on public.payroll_runs for all using (public.is_admin_or_hr()) with check (public.is_admin_or_hr());

create policy "Payroll items select own or admin" on public.payroll_items for select
  using (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = payroll_items.employee_id and e.user_id = auth.uid()));
create policy "Payroll items manage admin" on public.payroll_items for all using (public.is_admin_or_hr()) with check (public.is_admin_or_hr());

create policy "Custom deductions select own or admin" on public.custom_deductions for select
  using (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = custom_deductions.employee_id and e.user_id = auth.uid()));
create policy "Custom deductions manage admin" on public.custom_deductions for all using (public.is_admin_or_hr()) with check (public.is_admin_or_hr());

create policy "Audit logs select admin" on public.audit_logs for select using (public.is_admin_or_hr());
create policy "Audit logs insert authenticated" on public.audit_logs for insert with check (auth.role() = 'authenticated');

create policy "Notification logs select admin" on public.notification_logs for select using (public.is_admin_or_hr());
create policy "Notification logs insert authenticated" on public.notification_logs for insert with check (auth.role() = 'authenticated' or auth.role() = 'service_role');
create policy "Notification logs update service" on public.notification_logs for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "Tax declarations select own or admin" on public.tax_declarations for select
  using (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = tax_declarations.employee_id and e.user_id = auth.uid()));
create policy "Tax declarations insert own or admin" on public.tax_declarations for insert
  with check (public.is_admin_or_hr() or exists (select 1 from public.employees e where e.id = tax_declarations.employee_id and e.user_id = auth.uid()));
create policy "Tax declarations update own draft or admin" on public.tax_declarations for update
  using (public.is_admin_or_hr() or (status in ('draft', 'rejected') and exists (select 1 from public.employees e where e.id = tax_declarations.employee_id and e.user_id = auth.uid())))
  with check (public.is_admin_or_hr() or (status in ('draft', 'submitted') and exists (select 1 from public.employees e where e.id = tax_declarations.employee_id and e.user_id = auth.uid())));
create policy "Tax declarations delete admin" on public.tax_declarations for delete using (public.is_admin_or_hr());
create policy "Tax configs read authenticated" on public.tax_regime_configs for select using (auth.role() = 'authenticated');
create policy "Tax configs manage admin" on public.tax_regime_configs for all using (public.is_admin_or_hr()) with check (public.is_admin_or_hr());

create table if not exists public.signup_audit_logs (
  id uuid default gen_random_uuid() primary key,
  employee_id text,
  email text,
  action text not null,
  success boolean not null default false,
  message text,
  user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.signup_audit_logs enable row level security;
drop policy if exists "Signup audit admin read" on public.signup_audit_logs;
create policy "Signup audit admin read" on public.signup_audit_logs for select using (public.is_admin_or_hr());

create or replace function public.verify_signup_eligibility(p_employee_id text, p_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_user_id uuid;
  v_message text := 'If the employee ID and email match an active employee record, a verification code will be sent.';
  v_valid boolean := false;
begin
  select status, user_id
  into v_status, v_user_id
  from public.employees
  where trim(lower(employee_id)) = trim(lower(p_employee_id))
    and trim(lower(email)) = trim(lower(p_email))
  limit 1;

  v_valid := coalesce(v_status = 'active' and v_user_id is null, false);

  insert into public.signup_audit_logs (employee_id, email, action, success, message)
  values (p_employee_id, p_email, 'eligibility_check', v_valid, v_message);

  return json_build_object('valid', v_valid, 'message', v_message);
end;
$$;

create or replace function public.complete_employee_signup(p_employee_id text, p_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user uuid := auth.uid();
  v_auth_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_employee_id uuid;
  v_existing_user_id uuid;
  v_status text;
begin
  if v_auth_user is null then
    raise exception 'Authentication is required to complete signup.';
  end if;

  if v_auth_email = '' or v_auth_email <> lower(trim(p_email)) then
    raise exception 'Verified email does not match signup email.';
  end if;

  select id, user_id, status
  into v_employee_id, v_existing_user_id, v_status
  from public.employees
  where trim(lower(employee_id)) = trim(lower(p_employee_id))
    and trim(lower(email)) = lower(trim(p_email))
  limit 1;

  if v_employee_id is null or v_status <> 'active' then
    insert into public.signup_audit_logs (employee_id, email, action, success, message, user_id)
    values (p_employee_id, p_email, 'complete_signup', false, 'Employee record not active or not found.', v_auth_user);
    raise exception 'Unable to complete signup. Please contact HR.';
  end if;

  if v_existing_user_id is not null and v_existing_user_id <> v_auth_user then
    insert into public.signup_audit_logs (employee_id, email, action, success, message, user_id)
    values (p_employee_id, p_email, 'complete_signup', false, 'Employee already linked to another user.', v_auth_user);
    raise exception 'Account already exists for this employee.';
  end if;

  update public.employees
  set user_id = v_auth_user,
      updated_at = timezone('utc'::text, now())
  where id = v_employee_id
    and (user_id is null or user_id = v_auth_user);

  update public.profiles
  set updated_at = timezone('utc'::text, now())
  where id = v_auth_user;

  insert into public.signup_audit_logs (employee_id, email, action, success, message, user_id)
  values (p_employee_id, p_email, 'complete_signup', true, 'Employee account linked.', v_auth_user);

  return json_build_object('success', true, 'employee_id', v_employee_id);
end;
$$;

grant execute on function public.verify_signup_eligibility(text, text) to anon, authenticated;
grant execute on function public.complete_employee_signup(text, text) to authenticated;

create or replace function public.enforce_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin_or_hr() then
    return new;
  end if;

  if old.id is distinct from new.id
    or old.email is distinct from new.email
    or old.role is distinct from new.role
  then
    raise exception 'Profile identity and role can only be changed by HR or Admin.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_self_update_guard on public.profiles;
create trigger profiles_self_update_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_self_update();

create or replace function public.audit_sanitize(payload jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when payload is null then null
    else payload
      - 'pan_number'
      - 'aadhaar_number'
      - 'bank_account_number'
      - 'pan_number_enc'
      - 'aadhaar_number_enc'
      - 'bank_account_number_enc'
      - 'salary_structure'
      - 'breakdown'
      || case when payload ? 'pan_number' then jsonb_build_object('pan_number', '[REDACTED]') else '{}'::jsonb end
      || case when payload ? 'aadhaar_number' then jsonb_build_object('aadhaar_number', '[REDACTED]') else '{}'::jsonb end
      || case when payload ? 'bank_account_number' then jsonb_build_object('bank_account_number', '[REDACTED]') else '{}'::jsonb end
      || case when payload ? 'pan_number_enc' then jsonb_build_object('pan_number_enc', '[ENCRYPTED]') else '{}'::jsonb end
      || case when payload ? 'aadhaar_number_enc' then jsonb_build_object('aadhaar_number_enc', '[ENCRYPTED]') else '{}'::jsonb end
      || case when payload ? 'bank_account_number_enc' then jsonb_build_object('bank_account_number_enc', '[ENCRYPTED]') else '{}'::jsonb end
      || case when payload ? 'salary_structure' then jsonb_build_object('salary_structure', '[REDACTED]') else '{}'::jsonb end
      || case when payload ? 'breakdown' then jsonb_build_object('breakdown', '[REDACTED]') else '{}'::jsonb end
  end;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  record_uuid uuid;
begin
  record_uuid := coalesce(
    case when tg_op = 'DELETE' then old.id else new.id end,
    null
  );

  insert into public.audit_logs (
    actor_id,
    table_name,
    record_id,
    action,
    old_data,
    new_data
  )
  values (
    auth.uid(),
    tg_table_name,
    record_uuid,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then public.audit_sanitize(to_jsonb(old)) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then public.audit_sanitize(to_jsonb(new)) else null end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.enforce_employee_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin_or_hr() then
    return new;
  end if;

  if old.user_id is distinct from auth.uid() then
    raise exception 'Employees can only update their own profile.';
  end if;

  if old.employee_id is distinct from new.employee_id
    or old.user_id is distinct from new.user_id
    or old.role is distinct from new.role
    or old.department is distinct from new.department
    or old.designation is distinct from new.designation
    or old.reporting_person is distinct from new.reporting_person
    or old.salary is distinct from new.salary
    or old.salary_allowances is distinct from new.salary_allowances
    or old.salary_deductions is distinct from new.salary_deductions
    or old.salary_structure is distinct from new.salary_structure
    or old.salary_effective_date is distinct from new.salary_effective_date
    or old.pan_number is distinct from new.pan_number
    or old.aadhaar_number is distinct from new.aadhaar_number
    or old.bank_account_number is distinct from new.bank_account_number
    or old.pan_number_enc is distinct from new.pan_number_enc
    or old.aadhaar_number_enc is distinct from new.aadhaar_number_enc
    or old.bank_account_number_enc is distinct from new.bank_account_number_enc
    or old.leave_balance is distinct from new.leave_balance
    or old.status is distinct from new.status
    or old.created_by is distinct from new.created_by
  then
    raise exception 'This profile field can only be changed by HR or Admin.';
  end if;

  return new;
end;
$$;

create or replace function public.mask_identifier(value text)
returns text
language sql
immutable
as $$
  select case
    when value is null or length(value) <= 4 then value
    else repeat('*', greatest(length(value) - 4, 0)) || right(value, 4)
  end;
$$;

create or replace function public.protect_employee_pii()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pii_key text := nullif(current_setting('app.pii_key', true), '');
begin
  if pii_key is null then
    return new;
  end if;

  if new.pan_number is not null and new.pan_number !~ '^\*+' then
    new.pan_number_enc := pgp_sym_encrypt(new.pan_number, pii_key);
    new.pan_number := public.mask_identifier(new.pan_number);
  end if;

  if new.aadhaar_number is not null and new.aadhaar_number !~ '^\*+' then
    new.aadhaar_number_enc := pgp_sym_encrypt(new.aadhaar_number, pii_key);
    new.aadhaar_number := public.mask_identifier(new.aadhaar_number);
  end if;

  if new.bank_account_number is not null and new.bank_account_number !~ '^\*+' then
    new.bank_account_number_enc := pgp_sym_encrypt(new.bank_account_number, pii_key);
    new.bank_account_number := public.mask_identifier(new.bank_account_number);
  end if;

  return new;
end;
$$;

drop trigger if exists employees_pii_protection on public.employees;
create trigger employees_pii_protection
  before insert or update on public.employees
  for each row execute function public.protect_employee_pii();

drop trigger if exists employees_self_update_guard on public.employees;
create trigger employees_self_update_guard
  before update on public.employees
  for each row execute function public.enforce_employee_self_update();

drop trigger if exists employees_audit on public.employees;
create trigger employees_audit after insert or update or delete on public.employees
  for each row execute function public.audit_row_change();

drop trigger if exists attendance_audit on public.attendance;
create trigger attendance_audit after insert or update or delete on public.attendance
  for each row execute function public.audit_row_change();

drop trigger if exists leaves_audit on public.leaves;
create trigger leaves_audit after insert or update or delete on public.leaves
  for each row execute function public.audit_row_change();

drop trigger if exists overtime_audit on public.overtime;
create trigger overtime_audit after insert or update or delete on public.overtime
  for each row execute function public.audit_row_change();

drop trigger if exists salaries_audit on public.salaries;
create trigger salaries_audit after insert or update or delete on public.salaries
  for each row execute function public.audit_row_change();

drop trigger if exists salary_components_audit on public.salary_components;
create trigger salary_components_audit after insert or update or delete on public.salary_components
  for each row execute function public.audit_row_change();

drop trigger if exists custom_deductions_audit on public.custom_deductions;
create trigger custom_deductions_audit after insert or update or delete on public.custom_deductions
  for each row execute function public.audit_row_change();

drop trigger if exists payroll_runs_audit on public.payroll_runs;
create trigger payroll_runs_audit after insert or update or delete on public.payroll_runs
  for each row execute function public.audit_row_change();

drop trigger if exists payroll_items_audit on public.payroll_items;
create trigger payroll_items_audit after insert or update or delete on public.payroll_items
  for each row execute function public.audit_row_change();

drop trigger if exists exits_audit on public.exits;
create trigger exits_audit after insert or update or delete on public.exits
  for each row execute function public.audit_row_change();

drop trigger if exists departments_audit on public.departments;
create trigger departments_audit after insert or update or delete on public.departments
  for each row execute function public.audit_row_change();

drop trigger if exists leave_policies_audit on public.leave_policies;
create trigger leave_policies_audit after insert or update or delete on public.leave_policies
  for each row execute function public.audit_row_change();

drop trigger if exists leave_balances_audit on public.leave_balances;
create trigger leave_balances_audit after insert or update or delete on public.leave_balances
  for each row execute function public.audit_row_change();

drop trigger if exists employee_documents_audit on public.employee_documents;
create trigger employee_documents_audit after insert or update or delete on public.employee_documents
  for each row execute function public.audit_row_change();

drop trigger if exists holidays_audit on public.holidays;
create trigger holidays_audit after insert or update or delete on public.holidays
  for each row execute function public.audit_row_change();

drop trigger if exists generated_reports_audit on public.generated_reports;
create trigger generated_reports_audit after insert or update or delete on public.generated_reports
  for each row execute function public.audit_row_change();

drop trigger if exists notification_logs_audit on public.notification_logs;
create trigger notification_logs_audit after insert or update or delete on public.notification_logs
  for each row execute function public.audit_row_change();

drop trigger if exists tax_declarations_audit on public.tax_declarations;
create trigger tax_declarations_audit after insert or update or delete on public.tax_declarations
  for each row execute function public.audit_row_change();

drop trigger if exists tax_regime_configs_audit on public.tax_regime_configs;
create trigger tax_regime_configs_audit after insert or update or delete on public.tax_regime_configs
  for each row execute function public.audit_row_change();

create or replace function public.normalize_leave_type(value text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(value, ''), '[^a-z0-9]+', '', 'g'));
$$;

create or replace function public.calculate_leave_days(start_date date, end_date date)
returns numeric
language sql
stable
as $$
  select coalesce(count(*)::numeric, 0)
  from generate_series(start_date, end_date, interval '1 day') as day(value)
  where extract(dow from day.value) <> 0
    and not exists (select 1 from public.holidays h where h.date = day.value::date);
$$;

create or replace function public.resolve_leave_policy_name(requested_type text)
returns text
language sql
stable
as $$
  select coalesce(
    (
      select lp.leave_type
      from public.leave_policies lp
      where public.normalize_leave_type(lp.leave_type) = public.normalize_leave_type(requested_type)
        and coalesce(lp.status, 'Active') = 'Active'
      limit 1
    ),
    requested_type
  );
$$;

create or replace function public.ensure_leave_balance(p_employee_id uuid, p_leave_type text, p_year integer)
returns public.leave_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  policy_balance numeric := 0;
  resolved_type text := public.resolve_leave_policy_name(p_leave_type);
  balance_row public.leave_balances;
begin
  select coalesce(annual_balance, 0)
  into policy_balance
  from public.leave_policies
  where public.normalize_leave_type(leave_type) = public.normalize_leave_type(resolved_type)
    and coalesce(status, 'Active') = 'Active'
  limit 1;

  insert into public.leave_balances (employee_id, leave_type, balance, year)
  values (p_employee_id, resolved_type, coalesce(policy_balance, 0), p_year)
  on conflict (employee_id, leave_type, year) do nothing;

  select *
  into balance_row
  from public.leave_balances
  where employee_id = p_employee_id
    and public.normalize_leave_type(leave_type) = public.normalize_leave_type(resolved_type)
    and year = p_year
  limit 1;

  return balance_row;
end;
$$;

create or replace function public.sync_employee_leave_balance(p_employee_id uuid, p_year integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.employees e
  set leave_balance = coalesce((
    select sum(balance)
    from public.leave_balances lb
    where lb.employee_id = p_employee_id and lb.year = p_year
  ), e.leave_balance)
  where e.id = p_employee_id;
$$;

create or replace function public.sync_leave_attendance(p_leave_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  leave_row public.leaves;
  current_day date;
  fallback_status text;
begin
  select * into leave_row from public.leaves where id = p_leave_id;
  if not found then raise exception 'Leave request not found.'; end if;

  current_day := leave_row.start_date;
  while current_day <= leave_row.end_date loop
    if p_status = 'approved' then
      if extract(dow from current_day) <> 0 and not exists (select 1 from public.holidays h where h.date = current_day) then
        insert into public.attendance (employee_id, date, status, remarks)
        values (leave_row.employee_id, current_day, 'on_leave', 'Approved Leave: ' || leave_row.leave_type)
        on conflict (employee_id, date) do update
          set status = 'on_leave', remarks = excluded.remarks, updated_at = timezone('utc'::text, now());
      end if;
    elsif p_status = 'rejected' then
      fallback_status := case
        when extract(dow from current_day) = 0 then 'weekly_off'
        when exists (select 1 from public.holidays h where h.date = current_day) then 'on_leave'
        else 'absent'
      end;
      insert into public.attendance (employee_id, date, status, remarks)
      values (leave_row.employee_id, current_day, fallback_status, 'Leave Request Rejected')
      on conflict (employee_id, date) do update
        set status = case when public.attendance.status = 'on_leave' then excluded.status else public.attendance.status end,
            remarks = 'Leave Request Rejected',
            updated_at = timezone('utc'::text, now());
    end if;
    current_day := current_day + 1;
  end loop;
end;
$$;

create or replace function public.approve_leave_request(p_leave_id uuid)
returns public.leaves
language plpgsql
security definer
set search_path = public
as $$
declare
  leave_row public.leaves;
  balance_row public.leave_balances;
  leave_days numeric;
  resolved_type text;
  target_year integer;
begin
  if not public.is_admin_or_hr() then raise exception 'Only HR or Admin can approve leave.'; end if;
  select * into leave_row from public.leaves where id = p_leave_id for update;
  if not found then raise exception 'Leave request not found.'; end if;
  if leave_row.status = 'approved' then return leave_row; end if;

  target_year := extract(year from leave_row.start_date)::integer;
  resolved_type := public.resolve_leave_policy_name(leave_row.leave_type);
  leave_days := public.calculate_leave_days(leave_row.start_date, leave_row.end_date);
  if leave_days <= 0 then raise exception 'Selected dates do not contain payable leave days.'; end if;

  balance_row := public.ensure_leave_balance(leave_row.employee_id, resolved_type, target_year);
  if balance_row.balance < leave_days then
    raise exception 'Insufficient % balance. Available: %, requested: %', resolved_type, balance_row.balance, leave_days;
  end if;

  update public.leave_balances set balance = balance - leave_days, updated_at = timezone('utc'::text, now()) where id = balance_row.id;
  update public.leaves
  set status = 'approved', leave_type = resolved_type, days = leave_days, balance_deducted = leave_days,
      policy_year = target_year, approved_at = timezone('utc'::text, now()), approved_by = auth.uid(),
      rejected_at = null, rejected_by = null, updated_at = timezone('utc'::text, now())
  where id = p_leave_id returning * into leave_row;

  perform public.sync_employee_leave_balance(leave_row.employee_id, target_year);
  perform public.sync_leave_attendance(p_leave_id, 'approved');
  return leave_row;
end;
$$;

create or replace function public.reject_leave_request(p_leave_id uuid)
returns public.leaves
language plpgsql
security definer
set search_path = public
as $$
declare
  leave_row public.leaves;
  target_year integer;
begin
  if not public.is_admin_or_hr() then raise exception 'Only HR or Admin can reject leave.'; end if;
  select * into leave_row from public.leaves where id = p_leave_id for update;
  if not found then raise exception 'Leave request not found.'; end if;
  target_year := coalesce(leave_row.policy_year, extract(year from leave_row.start_date)::integer);

  if leave_row.status = 'approved' and coalesce(leave_row.balance_deducted, 0) > 0 then
    update public.leave_balances
    set balance = balance + leave_row.balance_deducted, updated_at = timezone('utc'::text, now())
    where employee_id = leave_row.employee_id
      and public.normalize_leave_type(leave_type) = public.normalize_leave_type(leave_row.leave_type)
      and year = target_year;
  end if;

  update public.leaves
  set status = 'rejected', rejected_at = timezone('utc'::text, now()), rejected_by = auth.uid(),
      approved_at = null, approved_by = null, balance_deducted = 0, updated_at = timezone('utc'::text, now())
  where id = p_leave_id returning * into leave_row;

  perform public.sync_employee_leave_balance(leave_row.employee_id, target_year);
  perform public.sync_leave_attendance(p_leave_id, 'rejected');
  return leave_row;
end;
$$;

create or replace function public.initialize_leave_balances(p_year integer default extract(year from current_date)::integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_hr() then raise exception 'Only HR or Admin can initialize leave balances.'; end if;
  insert into public.leave_balances (employee_id, leave_type, balance, year)
  select e.id, lp.leave_type, lp.annual_balance, p_year
  from public.employees e
  cross join public.leave_policies lp
  where coalesce(e.status, 'active') = 'active' and coalesce(lp.status, 'Active') = 'Active'
  on conflict (employee_id, leave_type, year) do nothing;
end;
$$;

create or replace function public.initialize_employee_leave_balances()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_year integer := extract(year from coalesce(new.joining_date, current_date))::integer;
begin
  insert into public.leave_balances (employee_id, leave_type, balance, year)
  select new.id, lp.leave_type, lp.annual_balance, target_year
  from public.leave_policies lp
  where coalesce(lp.status, 'Active') = 'Active'
  on conflict (employee_id, leave_type, year) do nothing;

  perform public.sync_employee_leave_balance(new.id, target_year);
  return new;
end;
$$;

drop trigger if exists employees_initialize_leave_balances on public.employees;
create trigger employees_initialize_leave_balances
  after insert on public.employees
  for each row execute function public.initialize_employee_leave_balances();

insert into public.departments (name)
values ('Engineering'), ('HR'), ('Sales'), ('Marketing'), ('Finance'), ('Operations')
on conflict (name) do nothing;

insert into public.leave_policies (leave_type, annual_balance)
values ('Casual Leave', 8), ('Sick Leave', 12), ('Earned Leave', 15)
on conflict (leave_type) do nothing;

insert into public.tax_regime_configs (financial_year, config, is_active)
values (
  '2026-27',
  '{"standardDeductionNew":75000,"standardDeductionOld":50000,"rebateLimitNew":1200000,"rebateLimitOld":500000,"rebateAmountNew":60000,"rebateAmountOld":12500,"cessRate":0.04}'::jsonb,
  true
)
on conflict (financial_year) do nothing;
