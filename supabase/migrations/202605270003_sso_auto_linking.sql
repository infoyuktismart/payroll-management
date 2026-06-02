-- Upgrade handle_new_user trigger to support seamless SSO / Google OAuth auto-linking.
begin;

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_employee_role text;
  v_employee_id uuid;
begin
  -- Search for an existing active employee record with the same email
  select id, role
  into v_employee_id, v_employee_role
  from public.employees
  where lower(trim(email)) = lower(trim(new.email))
    and status = 'active'
  limit 1;

  -- If an employee record exists and is not linked yet, link it
  if v_employee_id is not null then
    update public.employees
    set user_id = new.id,
        updated_at = timezone('utc'::text, now())
    where id = v_employee_id
      and user_id is null;
  end if;

  -- Insert profile, defaulting role to the employee's role if found
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(v_employee_role, 'employee')
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;

commit;
