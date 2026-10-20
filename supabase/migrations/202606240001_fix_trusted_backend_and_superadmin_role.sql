-- Fix trusted backend role check and user role evaluation in Supabase SQL Editor / Direct DB sessions.
-- When running queries in Supabase SQL Editor or Table Editor, the session connects as 'postgres' or 'supabase_admin'.
-- Without these roles in is_trusted_backend_role(), database owners and DBAs are blocked by enforce_profile_self_update().
-- Also, current_user_role() had an issue where request.jwt.claim.role was 'authenticated', which shadowed the profile's role.

begin;

-- 1. Update is_trusted_backend_role to include postgres and supabase_admin
create or replace function public.is_trusted_backend_role()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    or session_user in ('supabase_auth_admin', 'service_role', 'postgres', 'supabase_admin')
    or current_user in ('supabase_auth_admin', 'service_role', 'postgres', 'supabase_admin');
$$;

-- 2. Update current_user_role to handle service_role, DB superuser, and authenticated user profile roles properly
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    case
      when current_setting('request.jwt.claim.role', true) = 'service_role' then 'service_role'
      when session_user in ('postgres', 'supabase_admin') or current_user in ('postgres', 'supabase_admin') then 'superadmin'
      else null
    end,
    nullif((select lower(trim(role)) from public.profiles where id = auth.uid()), ''),
    nullif((select lower(trim(role)) from public.employees where user_id = auth.uid() limit 1), ''),
    'employee'
  );
$$;

-- 3. Update enforce_profile_self_update trigger function
create or replace function public.enforce_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- DB owners, service role, or trusted backend automation can update without restriction
  if public.is_trusted_backend_role() then
    return new;
  end if;

  -- Admin, Superadmin, or HR can update profiles
  if public.is_admin_or_hr() then
    return new;
  end if;

  -- Normal employees cannot change their id, email, or role
  if old.id is distinct from new.id
    or old.email is distinct from new.email
    or old.role is distinct from new.role
  then
    raise exception 'Profile identity and role can only be changed by HR or Admin.';
  end if;

  return new;
end;
$$;

-- 4. Convenient helper function to promote any user to superadmin safely by email
create or replace function public.promote_user_to_superadmin(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  -- Only DB superuser, service role, or existing superadmin may execute this function
  if not (public.is_trusted_backend_role() or public.current_user_role() = 'superadmin') then
    raise exception 'Access denied: Only database administrators or existing SuperAdmins can promote users.';
  end if;

  select id into v_user_id
  from public.profiles
  where lower(trim(email)) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    -- Check auth.users if not found in profiles yet
    select id into v_user_id
    from auth.users
    where lower(trim(email)) = lower(trim(p_email))
    limit 1;

    if v_user_id is null then
      raise exception 'User with email % not found.', p_email;
    end if;

    insert into public.profiles (id, email, role, created_at, updated_at)
    values (v_user_id, lower(trim(p_email)), 'superadmin', now(), now())
    on conflict (id) do update
    set role = 'superadmin', updated_at = now();
  else
    update public.profiles
    set role = 'superadmin', updated_at = now()
    where id = v_user_id;
  end if;

  -- Also update matching employee record if exists
  update public.employees
  set role = 'superadmin', updated_at = now()
  where user_id = v_user_id or lower(trim(email)) = lower(trim(p_email));

  -- Also update auth.users raw_user_meta_data role if present
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'superadmin')
  where id = v_user_id;

  return jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', p_email,
    'role', 'superadmin',
    'message', 'User successfully promoted to superadmin.'
  );
end;
$$;

revoke execute on function public.promote_user_to_superadmin(text) from anon;
grant execute on function public.promote_user_to_superadmin(text) to authenticated, service_role;

commit;
