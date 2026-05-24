-- Enterprise security and audit migration
-- Apply after the base payroll schema exists.

begin;

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Schema parity columns used by the app and security triggers.
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists updated_at timestamp with time zone;

alter table public.employees add column if not exists registration_id text unique;
alter table public.employees add column if not exists profile_photo_url text;
alter table public.employees add column if not exists leave_balance numeric default 20;
alter table public.employees add column if not exists is_specially_abled boolean default false;
alter table public.employees add column if not exists notice_period_days integer default 30;
alter table public.employees add column if not exists updated_at timestamp with time zone;
alter table public.employees add column if not exists pan_number_enc bytea;
alter table public.employees add column if not exists aadhaar_number_enc bytea;
alter table public.employees add column if not exists bank_account_number_enc bytea;

comment on column public.employees.pan_number is 'Legacy masked/plaintext field. Production writes should be protected by employees_pii_protection.';
comment on column public.employees.aadhaar_number is 'Legacy masked/plaintext field. Production writes should be protected by employees_pii_protection.';
comment on column public.employees.bank_account_number is 'Legacy masked/plaintext field. Production writes should be protected by employees_pii_protection.';

alter table public.leaves add column if not exists updated_at timestamp with time zone;
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

-- App tables that older installs may be missing.
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

create index if not exists idx_employees_user_id on public.employees(user_id);
create index if not exists idx_attendance_employee_date on public.attendance(employee_id, date);
create index if not exists idx_leaves_employee_dates on public.leaves(employee_id, start_date, end_date);
create index if not exists idx_overtime_employee_date on public.overtime(employee_id, date);
create index if not exists idx_payroll_runs_month_year on public.payroll_runs(month_year);
create index if not exists idx_payroll_items_employee_id on public.payroll_items(employee_id);
create index if not exists idx_custom_deductions_employee_id on public.custom_deductions(employee_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_table_record on public.audit_logs(table_name, record_id);

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.leaves enable row level security;
alter table public.overtime enable row level security;
alter table public.salaries enable row level security;
alter table public.exits enable row level security;
alter table public.attendance enable row level security;
alter table public.salary_components enable row level security;
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

-- Replace permissive and previous policies with enterprise policies.
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
  record_uuid := case when tg_op = 'DELETE' then old.id else new.id end;

  insert into public.audit_logs (actor_id, table_name, record_id, action, old_data, new_data)
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

insert into public.departments (name)
values ('Engineering'), ('HR'), ('Sales'), ('Marketing'), ('Finance'), ('Operations')
on conflict (name) do nothing;

insert into public.leave_policies (leave_type, annual_balance)
values ('Casual Leave', 8), ('Sick Leave', 12), ('Earned Leave', 15)
on conflict (leave_type) do nothing;

commit;
