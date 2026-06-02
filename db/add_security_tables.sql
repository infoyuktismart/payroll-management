-- Phase 2: Enterprise Security & Auth
-- Adds email OTP 2FA enrollment state, session logs, and security policy metadata.

begin;

create extension if not exists "uuid-ossp";

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

create table if not exists public.user_2fa_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  method text not null default 'email_otp' check (method in ('email_otp')),
  enabled boolean not null default false,
  enrolled_at timestamp with time zone,
  last_verified_at timestamp with time zone,
  recovery_email text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (user_id, method)
);

create table if not exists public.security_session_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'password_login',
    '2fa_challenge_sent',
    '2fa_verified',
    '2fa_failed',
    '2fa_enabled',
    '2fa_disabled',
    'logout',
    'global_logout'
  )),
  ip_address text,
  user_agent text,
  device_type text,
  browser text,
  os text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.security_policies (
  id uuid primary key default uuid_generate_v4(),
  policy_key text not null unique,
  policy_value jsonb not null default '{}'::jsonb,
  description text,
  is_enforced boolean not null default true,
  updated_by uuid references auth.users,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists idx_user_2fa_settings_user_id on public.user_2fa_settings(user_id);
create index if not exists idx_security_session_logs_user_id_created_at on public.security_session_logs(user_id, created_at desc);
create index if not exists idx_security_session_logs_event_created_at on public.security_session_logs(event_type, created_at desc);

alter table public.user_2fa_settings enable row level security;
alter table public.security_session_logs enable row level security;
alter table public.security_policies enable row level security;

drop policy if exists "2FA settings select own or admin" on public.user_2fa_settings;
drop policy if exists "2FA settings insert own or admin" on public.user_2fa_settings;
drop policy if exists "2FA settings update own or admin" on public.user_2fa_settings;
drop policy if exists "2FA settings delete admin" on public.user_2fa_settings;
drop policy if exists "Session logs select own or admin" on public.security_session_logs;
drop policy if exists "Session logs insert authenticated" on public.security_session_logs;
drop policy if exists "Security policies select admin" on public.security_policies;
drop policy if exists "Security policies manage admin" on public.security_policies;

create policy "2FA settings select own or admin"
  on public.user_2fa_settings for select
  using (user_id = auth.uid() or public.is_admin_or_hr());

create policy "2FA settings insert own or admin"
  on public.user_2fa_settings for insert
  with check (user_id = auth.uid() or public.is_admin_or_hr());

create policy "2FA settings update own or admin"
  on public.user_2fa_settings for update
  using (user_id = auth.uid() or public.is_admin_or_hr())
  with check (user_id = auth.uid() or public.is_admin_or_hr());

create policy "2FA settings delete admin"
  on public.user_2fa_settings for delete
  using (public.is_admin_or_hr());

create policy "Session logs select own or admin"
  on public.security_session_logs for select
  using (user_id = auth.uid() or public.is_admin_or_hr());

create policy "Session logs insert authenticated"
  on public.security_session_logs for insert
  with check (auth.role() = 'authenticated');

create policy "Security policies select admin"
  on public.security_policies for select
  using (public.is_admin_or_hr());

create policy "Security policies manage admin"
  on public.security_policies for all
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists user_2fa_settings_touch_updated_at on public.user_2fa_settings;
create trigger user_2fa_settings_touch_updated_at
  before update on public.user_2fa_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists security_policies_touch_updated_at on public.security_policies;
create trigger security_policies_touch_updated_at
  before update on public.security_policies
  for each row execute function public.touch_updated_at();

insert into public.security_policies (policy_key, policy_value, description)
values
  ('two_factor_required_for_admins', '{"enabled": true}'::jsonb, 'Require email OTP after password login for Admin and HR roles when enrolled.'),
  ('session_timeout_minutes', '{"minutes": 480}'::jsonb, 'Recommended maximum authenticated session age for enterprise installs.'),
  ('failed_login_lockout', '{"max_attempts": 5, "window_minutes": 15, "lock_minutes": 30}'::jsonb, 'Client-visible lockout policy metadata for sign-in risk controls.')
on conflict (policy_key) do update set
  policy_value = excluded.policy_value,
  description = excluded.description,
  updated_at = timezone('utc'::text, now());

commit;
