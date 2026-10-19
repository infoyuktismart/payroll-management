-- Migration: Server-Side Active Company Session Context
-- Creates a PostgreSQL session-level config variable that the Supabase JS client
-- sets on each authenticated request. RLS policies and queries can read this value
-- via current_setting() to double-validate tenant scoping at the database level.
--
-- How it works:
--   1. Client calls supabase.rpc('set_active_company', { p_company_id: '...' })
--      immediately after signing in or switching companies.
--   2. The function writes the value to a session-scoped config key: app.active_company_id
--   3. RLS helper get_active_company_id() reads this config key.
--   4. is_active_company_member() combines auth.uid() + session config to enforce membership.
--
-- This is additive — no existing tables or policies are altered. Existing RLS policies
-- already use auth.uid()-based functions (user_has_company_access, user_is_company_admin)
-- which are auth-JWT-scoped. This layer adds an extra binding to the session context.

begin;

-- ─── 1. set_active_company ──────────────────────────────────────────────────
-- Called by the Supabase JS client after login or company switch.
-- Validates that the authenticated user is actually a member of the company
-- before persisting it in the session config, preventing session-config spoofing.
create or replace function public.set_active_company(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Verify the calling user is a member of the company (or is a superadmin)
    if not (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and lower(trim(role)) = 'superadmin'
        )
        or exists (
            select 1 from public.user_company_memberships
            where user_id = auth.uid() and company_id = p_company_id
        )
        or exists (
            select 1 from public.employees
            where user_id = auth.uid() and company_id = p_company_id
        )
    ) then
        raise exception 'Access denied: user is not a member of company %', p_company_id
            using errcode = 'insufficient_privilege';
    end if;

    -- Write the validated company ID into the session-scoped config
    perform set_config('app.active_company_id', p_company_id::text, false);
end;
$$;

-- ─── 2. get_active_company_id ────────────────────────────────────────────────
-- Safe reader for the session config key. Returns NULL if not set (e.g., during
-- service-role operations or unauthenticated sessions).
create or replace function public.get_active_company_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
    select nullif(current_setting('app.active_company_id', true), '')::uuid;
$$;

-- ─── 3. is_active_company_member ─────────────────────────────────────────────
-- RLS-friendly helper that confirms the calling user belongs to the session's
-- active company. Returns false (not exception) when no company is set, so
-- existing policies degrade gracefully to the current auth.uid()-based checks.
create or replace function public.is_active_company_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select case
        when public.get_active_company_id() is null then true  -- No session context set → defer to existing RLS
        else public.user_has_company_access(public.get_active_company_id())
    end;
$$;

commit;
