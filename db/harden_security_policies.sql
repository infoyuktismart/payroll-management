-- Migration: Harden Row-Level Security Policies for Multi-Tenancy Scoping
-- Scopes platform-wide is_admin_or_hr role checks to target company memberships.

begin;

-- 1. Redefine user_has_company_access to prevent company-agnostic admin bypass
create or replace function public.user_has_company_access(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
      select 1 
      from public.profiles 
      where id = auth.uid() and lower(trim(role)) = 'superadmin'
    )
    or exists (
      select 1
      from public.user_company_memberships ucm
      where ucm.user_id = auth.uid()
        and ucm.company_id = target_company_id
    )
    or exists (
      select 1
      from public.employees e
      where e.user_id = auth.uid()
        and e.company_id = target_company_id
    );
$$;

-- 2. Define user_is_company_admin to check for admin/HR credentials inside a specific company
create or replace function public.user_is_company_admin(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
      select 1 
      from public.profiles 
      where id = auth.uid() and lower(trim(role)) = 'superadmin'
    )
    or exists (
      select 1
      from public.user_company_memberships ucm
      where ucm.user_id = auth.uid()
        and ucm.company_id = target_company_id
        and lower(trim(ucm.role)) in (
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
        )
    )
    or exists (
      select 1
      from public.employees e
      where e.user_id = auth.uid()
        and e.company_id = target_company_id
        and lower(trim(e.role)) in (
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
        )
    );
$$;

-- 3. Drop existing insecure policies
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

drop policy if exists "Custom deductions select own or admin" on public.custom_deductions;
drop policy if exists "Custom deductions manage admin" on public.custom_deductions;

drop policy if exists "Payroll runs select admin" on public.payroll_runs;
drop policy if exists "Payroll runs manage admin" on public.payroll_runs;

drop policy if exists "Payroll items select own or admin" on public.payroll_items;
drop policy if exists "Payroll items manage admin" on public.payroll_items;

drop policy if exists "Tax declarations select own or admin" on public.tax_declarations;
drop policy if exists "Tax declarations insert own or admin" on public.tax_declarations;
drop policy if exists "Tax declarations update own draft or admin" on public.tax_declarations;
drop policy if exists "Tax declarations delete admin" on public.tax_declarations;

-- 4. Recreate hardened policies enforcing target company access
-- Employees table policies
create policy "Employees select own or admin"
  on public.employees for select
  using (public.user_has_company_access(company_id) and (user_id = auth.uid() or public.user_is_company_admin(company_id)));

create policy "Employees insert admin"
  on public.employees for insert
  with check (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id));

create policy "Employees update own limited or admin"
  on public.employees for update
  using (public.user_has_company_access(company_id) and (user_id = auth.uid() or public.user_is_company_admin(company_id)))
  with check (public.user_has_company_access(company_id) and (user_id = auth.uid() or public.user_is_company_admin(company_id)));

create policy "Employees delete admin"
  on public.employees for delete
  using (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id));

-- Attendance table policies
create policy "Attendance select own or admin"
  on public.attendance for select
  using (public.user_has_company_access(company_id) and (public.user_is_company_admin(company_id) or exists (
    select 1 from public.employees e where e.id = attendance.employee_id and e.user_id = auth.uid()
  )));

create policy "Attendance manage admin"
  on public.attendance for all
  using (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id))
  with check (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id));

-- Leaves table policies
create policy "Leaves select own or admin"
  on public.leaves for select
  using (public.user_has_company_access(company_id) and (public.user_is_company_admin(company_id) or exists (
    select 1 from public.employees e where e.id = leaves.employee_id and e.user_id = auth.uid()
  )));

create policy "Leaves insert own or admin"
  on public.leaves for insert
  with check (public.user_has_company_access(company_id) and (public.user_is_company_admin(company_id) or exists (
    select 1 from public.employees e where e.id = leaves.employee_id and e.user_id = auth.uid()
  )));

create policy "Leaves update admin"
  on public.leaves for update
  using (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id))
  with check (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id));

-- Overtime table policies
create policy "Overtime select own or admin"
  on public.overtime for select
  using (public.user_has_company_access(company_id) and (public.user_is_company_admin(company_id) or exists (
    select 1 from public.employees e where e.id = overtime.employee_id and e.user_id = auth.uid()
  )));

create policy "Overtime insert own or admin"
  on public.overtime for insert
  with check (public.user_has_company_access(company_id) and (public.user_is_company_admin(company_id) or exists (
    select 1 from public.employees e where e.id = overtime.employee_id and e.user_id = auth.uid()
  )));

create policy "Overtime update admin"
  on public.overtime for update
  using (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id))
  with check (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id));

-- Salaries table policies
create policy "Salaries select own or admin"
  on public.salaries for select
  using (public.user_has_company_access(company_id) and (public.user_is_company_admin(company_id) or exists (
    select 1 from public.employees e where e.id = salaries.employee_id and e.user_id = auth.uid()
  )));

create policy "Salaries manage admin"
  on public.salaries for all
  using (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id))
  with check (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id));

-- Exits table policies
create policy "Exits select own or admin"
  on public.exits for select
  using (public.user_has_company_access(company_id) and (public.user_is_company_admin(company_id) or exists (
    select 1 from public.employees e where e.id = exits.employee_id and e.user_id = auth.uid()
  )));

create policy "Exits insert own or admin"
  on public.exits for insert
  with check (public.user_has_company_access(company_id) and (public.user_is_company_admin(company_id) or exists (
    select 1 from public.employees e where e.id = exits.employee_id and e.user_id = auth.uid()
  )));

create policy "Exits update admin"
  on public.exits for update
  using (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id))
  with check (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id));

-- Custom deductions policies
create policy "Custom deductions select own or admin"
  on public.custom_deductions for select
  using (public.user_has_company_access(company_id) and (public.user_is_company_admin(company_id) or exists (
    select 1 from public.employees e where e.id = custom_deductions.employee_id and e.user_id = auth.uid()
  )));

create policy "Custom deductions manage admin"
  on public.custom_deductions for all
  using (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id))
  with check (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id));

-- Payroll runs policies
create policy "Payroll runs select admin"
  on public.payroll_runs for select
  using (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id));

create policy "Payroll runs manage admin"
  on public.payroll_runs for all
  using (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id))
  with check (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id));

-- Payroll items policies
create policy "Payroll items select own or admin"
  on public.payroll_items for select
  using (public.user_has_company_access(company_id) and (public.user_is_company_admin(company_id) or exists (
    select 1 from public.employees e where e.id = payroll_items.employee_id and e.user_id = auth.uid()
  )));

create policy "Payroll items manage admin"
  on public.payroll_items for all
  using (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id))
  with check (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id));

-- Tax declarations policies
create policy "Tax declarations select own or admin"
  on public.tax_declarations for select
  using (public.user_has_company_access(company_id) and (public.user_is_company_admin(company_id) or exists (
    select 1 from public.employees e where e.id = tax_declarations.employee_id and e.user_id = auth.uid()
  )));

create policy "Tax declarations insert own or admin"
  on public.tax_declarations for insert
  with check (public.user_has_company_access(company_id) and (public.user_is_company_admin(company_id) or exists (
    select 1 from public.employees e where e.id = tax_declarations.employee_id and e.user_id = auth.uid()
  )));

create policy "Tax declarations update own draft or admin"
  on public.tax_declarations for update
  using (public.user_has_company_access(company_id) and (public.user_is_company_admin(company_id) or exists (
    select 1 from public.employees e where e.id = tax_declarations.employee_id and e.user_id = auth.uid() and status = 'draft'
  )))
  with check (public.user_has_company_access(company_id) and (public.user_is_company_admin(company_id) or exists (
    select 1 from public.employees e where e.id = tax_declarations.employee_id and e.user_id = auth.uid() and status = 'draft'
  )));

create policy "Tax declarations delete admin"
  on public.tax_declarations for delete
  using (public.user_has_company_access(company_id) and public.user_is_company_admin(company_id));

commit;
