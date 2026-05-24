-- Harden employee self-signup by moving eligibility and account linking into DB RPCs.

begin;

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
create policy "Signup audit admin read"
  on public.signup_audit_logs for select
  using (public.is_admin_or_hr());

create or replace function public.verify_signup_eligibility(
  p_employee_id text,
  p_email text
)
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

create or replace function public.complete_employee_signup(
  p_employee_id text,
  p_email text
)
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

commit;
