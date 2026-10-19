-- Fix SQL-owned Supabase security linter warnings.
-- Some Auth dashboard settings, such as leaked password protection, are not
-- controlled by database migrations.

begin;

-- Stable function search paths.
alter function public.normalize_leave_type(text) set search_path = public, pg_temp;
alter function public.calculate_leave_days(date, date) set search_path = public, pg_temp;
alter function public.resolve_leave_policy_name(text) set search_path = public, pg_temp;
alter function public.audit_sanitize(jsonb) set search_path = public, pg_temp;
alter function public.mask_identifier(text) set search_path = public, pg_temp;
alter function public.touch_updated_at() set search_path = public, pg_temp;
alter function public.anonymize_employee_profile(uuid) set search_path = public, pg_temp;
alter function public.is_first_run() set search_path = public, pg_temp;
alter function public.next_invoice_number() set search_path = public, pg_temp;

-- Replace placeholder permissive RLS policies with scoped predicates.
drop policy if exists "Users can view attendance policies for their company" on public.attendance_policies;
drop policy if exists "Admins can manage attendance policies" on public.attendance_policies;

create policy "Users can view attendance policies for their company"
  on public.attendance_policies
  for select
  using (
    auth.role() = 'authenticated'
    and public.user_has_company_access(company_id)
  );

create policy "Admins can manage attendance policies"
  on public.attendance_policies
  for all
  using (
    public.is_admin_or_hr()
    and public.user_has_company_access(company_id)
  )
  with check (
    public.is_admin_or_hr()
    and public.user_has_company_access(company_id)
  );

drop policy if exists "Users can view job grades" on public.job_grades;
drop policy if exists "Admins can manage job grades" on public.job_grades;

create policy "Users can view job grades"
  on public.job_grades
  for select
  using (
    auth.role() = 'authenticated'
    and public.user_has_company_access(company_id)
  );

create policy "Admins can manage job grades"
  on public.job_grades
  for all
  using (
    public.is_admin_or_hr()
    and public.user_has_company_access(company_id)
  )
  with check (
    public.is_admin_or_hr()
    and public.user_has_company_access(company_id)
  );

drop policy if exists "Users can view own nominees" on public.employee_nominees;
drop policy if exists "Users can manage own nominees" on public.employee_nominees;

create policy "Users can view own nominees"
  on public.employee_nominees
  for select
  using (
    exists (
      select 1
      from public.employees e
      where e.id = employee_nominees.employee_id
        and (
          e.user_id = auth.uid()
          or (
            public.is_admin_or_hr()
            and public.user_has_company_access(e.company_id)
          )
        )
    )
  );

create policy "Users can manage own nominees"
  on public.employee_nominees
  for all
  using (
    exists (
      select 1
      from public.employees e
      where e.id = employee_nominees.employee_id
        and (
          e.user_id = auth.uid()
          or (
            public.is_admin_or_hr()
            and public.user_has_company_access(e.company_id)
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.employees e
      where e.id = employee_nominees.employee_id
        and (
          e.user_id = auth.uid()
          or (
            public.is_admin_or_hr()
            and public.user_has_company_access(e.company_id)
          )
        )
    )
  );

drop policy if exists "Users can view arrears logs for their company" on public.salary_arrears_logs;
drop policy if exists "Admins can insert/update arrears logs" on public.salary_arrears_logs;

create policy "Users can view arrears logs for their company"
  on public.salary_arrears_logs
  for select
  using (
    public.user_has_company_access(company_id)
    or exists (
      select 1
      from public.employees e
      where e.id = salary_arrears_logs.employee_id
        and e.user_id = auth.uid()
    )
  );

create policy "Admins can insert/update arrears logs"
  on public.salary_arrears_logs
  for all
  using (
    public.is_admin_or_hr()
    and public.user_has_company_access(company_id)
  )
  with check (
    public.is_admin_or_hr()
    and public.user_has_company_access(company_id)
  );

-- Public buckets do not need a broad storage.objects SELECT policy for public
-- object URLs, and broad listing exposes object names.
drop policy if exists "Allow public read access 75ydll_0" on storage.objects;

-- Remove anonymous RPC access to SECURITY DEFINER functions unless deliberately
-- exposed through a safer edge-function boundary.
revoke execute on function public.anonymize_employee_profile(uuid) from anon;
revoke execute on function public.approve_leave_request(uuid) from anon;
revoke execute on function public.assert_company_plan_feature(uuid, text) from anon;
revoke execute on function public.audit_row_change() from anon;
revoke execute on function public.calculate_payroll_engine(uuid, uuid, integer, numeric, integer, integer) from anon;
revoke execute on function public.company_plan_allows_feature(uuid, text) from anon;
revoke execute on function public.complete_employee_signup(text, text) from anon;
revoke execute on function public.current_user_role() from anon;
revoke execute on function public.decrypt_employee_pii(text) from anon;
revoke execute on function public.employees_encrypt_pii() from anon;
revoke execute on function public.encrypt_employee_pii_value(text) from anon;
revoke execute on function public.enforce_company_branch_limit() from anon;
revoke execute on function public.enforce_company_employee_limit() from anon;
revoke execute on function public.enforce_employee_self_update() from anon;
revoke execute on function public.enforce_profile_self_update() from anon;
revoke execute on function public.ensure_leave_balance(uuid, text, integer) from anon;
revoke execute on function public.get_active_company_id() from anon;
revoke execute on function public.get_company_subscription_entitlements(uuid) from anon;
revoke execute on function public.get_payroll_run_summary(uuid) from anon;
revoke execute on function public.get_superadmin_metrics() from anon;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.initialize_employee_leave_balances() from anon;
revoke execute on function public.initialize_leave_balances(integer) from anon;
revoke execute on function public.initialize_master_admin(text, text, text, text, text, uuid) from anon;
revoke execute on function public.is_active_company_member() from anon;
revoke execute on function public.is_admin_or_hr() from anon;
revoke execute on function public.is_first_run() from anon;
revoke execute on function public.is_trusted_backend_role() from anon;
revoke execute on function public.log_employee_history_change() from anon;
revoke execute on function public.process_attendance_regularization() from anon;
revoke execute on function public.register_new_tenant(text, text, text, text, text, text, text) from anon;
revoke execute on function public.reject_leave_request(uuid) from anon;
revoke execute on function public.set_active_company(uuid) from anon;
revoke execute on function public.set_first_run_auth_trigger_enabled(boolean) from anon;
revoke execute on function public.set_first_run_public_trigger_enabled(regclass, text, boolean) from anon;
revoke execute on function public.setup_first_run_workspace(text, text, text, text, text, uuid) from anon;
revoke execute on function public.setup_trial_workspace(text, text, text, text, text, uuid, text, text) from anon;
revoke execute on function public.sync_employee_leave_balance(uuid, integer) from anon;
revoke execute on function public.sync_leave_attendance(uuid, text) from anon;
revoke execute on function public.user_has_company_access(uuid) from anon;
revoke execute on function public.verify_signup_eligibility(text, text) from anon;

-- Internal/service-only functions should not be directly callable by signed-in users.
revoke execute on function public.assert_company_plan_feature(uuid, text) from authenticated;
revoke execute on function public.audit_row_change() from authenticated;
revoke execute on function public.calculate_payroll_engine(uuid, uuid, integer, numeric, integer, integer) from authenticated;
revoke execute on function public.company_plan_allows_feature(uuid, text) from authenticated;
revoke execute on function public.employees_encrypt_pii() from authenticated;
revoke execute on function public.encrypt_employee_pii_value(text) from authenticated;
revoke execute on function public.enforce_company_branch_limit() from authenticated;
revoke execute on function public.enforce_company_employee_limit() from authenticated;
revoke execute on function public.enforce_employee_self_update() from authenticated;
revoke execute on function public.enforce_profile_self_update() from authenticated;
revoke execute on function public.ensure_leave_balance(uuid, text, integer) from authenticated;
revoke execute on function public.get_company_subscription_entitlements(uuid) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.initialize_employee_leave_balances() from authenticated;
revoke execute on function public.initialize_master_admin(text, text, text, text, text, uuid) from authenticated;
revoke execute on function public.is_trusted_backend_role() from authenticated;
revoke execute on function public.log_employee_history_change() from authenticated;
revoke execute on function public.process_attendance_regularization() from authenticated;
revoke execute on function public.register_new_tenant(text, text, text, text, text, text, text) from authenticated;
revoke execute on function public.set_first_run_auth_trigger_enabled(boolean) from authenticated;
revoke execute on function public.set_first_run_public_trigger_enabled(regclass, text, boolean) from authenticated;
revoke execute on function public.setup_first_run_workspace(text, text, text, text, text, uuid) from authenticated;
revoke execute on function public.setup_trial_workspace(text, text, text, text, text, uuid, text, text) from authenticated;
revoke execute on function public.sync_employee_leave_balance(uuid, integer) from authenticated;
revoke execute on function public.sync_leave_attendance(uuid, text) from authenticated;

commit;
