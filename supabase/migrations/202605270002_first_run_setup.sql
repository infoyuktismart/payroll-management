-- Migration to allow secure initial setup when no admin profile exists.
begin;

create or replace function public.is_first_run()
returns boolean
language plpgsql
security definer
as $$
begin
  return not exists (
    select 1 from public.profiles 
    where role in ('admin', 'administrator', 'superadmin')
  );
end;
$$;

-- Allow executing is_first_run by anyone
grant execute on function public.is_first_run() to anon, authenticated;

-- Create secure initial setup RPC
create or replace function public.initialize_master_admin(
  p_company_name text,
  p_company_code text,
  p_first_name text,
  p_last_name text,
  p_email text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user uuid := auth.uid();
  v_company_id uuid;
  v_employee_id uuid;
begin
  -- 1. Check if first run is active
  if not public.is_first_run() then
    raise exception 'The system has already been initialized.';
  end if;

  if v_auth_user is null then
    raise exception 'Authentication is required to initialize the system.';
  end if;

  -- 2. Create the Company
  insert into public.companies (name, code)
  values (p_company_name, p_company_code)
  returning id into v_company_id;

  -- 3. Create the Employee record as Admin
  insert into public.employees (
    user_id,
    company_id,
    employee_id,
    first_name,
    last_name,
    email,
    designation,
    department,
    status,
    role,
    joining_date,
    salary
  ) values (
    v_auth_user,
    v_company_id,
    'EMP001',
    p_first_name,
    p_last_name,
    p_email,
    'Administrator',
    'IT',
    'active',
    'admin',
    current_date,
    50000
  )
  returning id into v_employee_id;

  -- 4. Update the user profile to Admin
  update public.profiles
  set role = 'admin'
  where id = v_auth_user;

  return json_build_object(
    'success', true,
    'company_id', v_company_id,
    'employee_id', v_employee_id
  );
end;
$$;

grant execute on function public.initialize_master_admin(text, text, text, text, text) to authenticated;

commit;
