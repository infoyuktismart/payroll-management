-- Fix Setup Wizard RPC signature to handle unauthenticated first-run setup sessions securely
begin;

-- Drop the old signature to avoid PostgreSQL conflicts
drop function if exists public.initialize_master_admin(text, text, text, text, text);

-- Recreate the master admin initialization function with p_user_id
create or replace function public.initialize_master_admin(
  p_company_name text,
  p_company_code text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_employee_id uuid;
begin
  -- 1. Check if first run is active (locks down after any admin account exists)
  if not public.is_first_run() then
    raise exception 'The system has already been initialized.';
  end if;

  if p_user_id is null then
    raise exception 'User ID is required to initialize the system.';
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
    p_user_id,
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
  where id = p_user_id;

  return json_build_object(
    'success', true,
    'company_id', v_company_id,
    'employee_id', v_employee_id
  );
end;
$$;

-- Grant execution permission to anon and authenticated clients for the initial onboarding wizard
grant execute on function public.initialize_master_admin(text, text, text, text, text, uuid) to anon, authenticated;

commit;
