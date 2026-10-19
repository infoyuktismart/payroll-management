-- =============================================================================
-- 202606230001_enterprise_license_keys.sql
-- Migration: Enterprise License Key & Offline Voucher Activation Engine
--
-- Features:
--   1. Secure license key issuance for enterprise offline contracts & renewals.
--   2. Atomic redemption RPC (redeem_license_key) extending current_period_end.
--   3. Auto-creation of paid audit receipt in billing_invoices.
--   4. RLS security: Only superadmins can generate/revoke; companies can redeem.
-- =============================================================================

begin;

-- 1. Create license_keys table
create table if not exists public.license_keys (
  id uuid primary key default uuid_generate_v4(),
  license_key text not null unique,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  billing_cycle text not null default 'annual' check (billing_cycle in ('monthly', 'quarterly', 'semi_annual', 'annual', 'multi_year')),
  duration_days integer not null default 365 check (duration_days > 0),
  max_employees integer,
  max_branches integer,
  status text not null default 'active' check (status in ('active', 'redeemed', 'revoked', 'expired')),
  assigned_to_company_id uuid references public.companies(id) on delete set null,
  redeemed_by_company_id uuid references public.companies(id) on delete set null,
  redeemed_by_user_id uuid references auth.users(id) on delete set null,
  redeemed_at timestamp with time zone,
  valid_until timestamp with time zone,
  created_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- 2. Indexes for fast lookup and redemption
create index if not exists idx_license_keys_key on public.license_keys(license_key);
create index if not exists idx_license_keys_status on public.license_keys(status);
create index if not exists idx_license_keys_redeemed_company on public.license_keys(redeemed_by_company_id);

-- 3. Row Level Security (RLS)
alter table public.license_keys enable row level security;

drop policy if exists "Superadmins manage all license keys" on public.license_keys;
drop policy if exists "Companies view their own redeemed license keys" on public.license_keys;

-- Superadmins have full control
create policy "Superadmins manage all license keys"
  on public.license_keys
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'superadmin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'superadmin'
    )
  );

-- Companies can only read license keys they have successfully redeemed
create policy "Companies view their own redeemed license keys"
  on public.license_keys
  for select
  using (
    redeemed_by_company_id is not null
    and public.user_has_company_access(redeemed_by_company_id)
  );

-- 4. RPC: Atomic License Key Redemption
create or replace function public.redeem_license_key(
  p_license_key text,
  p_company_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_license record;
  v_plan record;
  v_company record;
  v_user_id uuid;
  v_current_sub record;
  v_period_start timestamp with time zone;
  v_period_end timestamp with time zone;
  v_new_sub_id uuid;
  v_invoice_num text;
  v_sanitized_key text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  -- Verify user has permission to manage the target company
  if not (public.is_admin_or_hr() or public.user_has_company_access(p_company_id)) then
    return jsonb_build_object('success', false, 'error', 'Unauthorized to manage company subscription');
  end if;

  -- Clean key string
  v_sanitized_key := upper(trim(p_license_key));
  if length(v_sanitized_key) < 6 then
    return jsonb_build_object('success', false, 'error', 'Invalid license key format');
  end if;

  -- Lock license record for update to prevent double redemption race condition
  select * into v_license
  from public.license_keys
  where license_key = v_sanitized_key
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'License key not found');
  end if;

  if v_license.status = 'redeemed' then
    return jsonb_build_object('success', false, 'error', 'This license key has already been redeemed');
  end if;

  if v_license.status = 'revoked' then
    return jsonb_build_object('success', false, 'error', 'This license key has been revoked');
  end if;

  if v_license.valid_until is not null and v_license.valid_until < timezone('utc'::text, now()) then
    return jsonb_build_object('success', false, 'error', 'This license key has expired');
  end if;

  -- If pre-assigned to a specific company
  if v_license.assigned_to_company_id is not null and v_license.assigned_to_company_id <> p_company_id then
    return jsonb_build_object('success', false, 'error', 'This license key is issued to another organization');
  end if;

  -- Fetch plan details
  select * into v_plan from public.subscription_plans where id = v_license.plan_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Associated subscription plan not found');
  end if;

  -- Fetch current subscription of company
  select * into v_current_sub
  from public.company_subscriptions
  where company_id = p_company_id
  order by created_at desc
  limit 1
  for update;

  -- Calculate new subscription period
  -- If currently active and period has not expired, extend from existing current_period_end
  if v_current_sub.id is not null and v_current_sub.status = 'active' and v_current_sub.current_period_end > timezone('utc'::text, now()) then
    v_period_start := v_current_sub.current_period_start;
    v_period_end := v_current_sub.current_period_end + (v_license.duration_days || ' days')::interval;
  else
    v_period_start := timezone('utc'::text, now());
    v_period_end := timezone('utc'::text, now()) + (v_license.duration_days || ' days')::interval;
  end if;

  -- Update or insert company subscription
  if v_current_sub.id is not null then
    update public.company_subscriptions
    set
      plan_id = v_license.plan_id,
      status = 'active',
      billing_cycle = v_license.billing_cycle,
      current_period_start = v_period_start,
      current_period_end = v_period_end,
      updated_at = timezone('utc'::text, now())
    where id = v_current_sub.id;
    v_new_sub_id := v_current_sub.id;
  else
    insert into public.company_subscriptions (
      company_id,
      plan_id,
      status,
      billing_cycle,
      billing_model,
      current_period_start,
      current_period_end
    ) values (
      p_company_id,
      v_license.plan_id,
      'active',
      v_license.billing_cycle,
      'flat',
      v_period_start,
      v_period_end
    )
    returning id into v_new_sub_id;
  end if;

  -- Mark license key as redeemed
  update public.license_keys
  set
    status = 'redeemed',
    redeemed_by_company_id = p_company_id,
    redeemed_by_user_id = v_user_id,
    redeemed_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
  where id = v_license.id;

  -- Auto-generate official zero-balance audit receipt invoice
  v_invoice_num := 'LIC-' || to_char(now(), 'YYYYMM') || '-' || lpad(floor(random()*9000 + 1000)::text, 4, '0');
  insert into public.billing_invoices (
    company_id,
    subscription_id,
    invoice_number,
    billing_period_start,
    billing_period_end,
    billing_model,
    employee_count,
    rate_per_employee,
    flat_amount,
    subtotal,
    tax_rate,
    tax_amount,
    total_amount,
    status,
    paid_at,
    payment_reference,
    notes,
    generated_by
  ) values (
    p_company_id,
    v_new_sub_id,
    v_invoice_num,
    v_period_start::date,
    v_period_end::date,
    'flat',
    coalesce(v_license.max_employees, v_plan.max_employees, 0),
    0,
    0,
    0,
    0,
    0,
    0,
    'paid',
    timezone('utc'::text, now()),
    'LICENSE:' || v_sanitized_key,
    'Redeemed via Enterprise License Key: ' || v_sanitized_key || ' (' || v_license.duration_days || ' Days)',
    v_user_id
  );

  return jsonb_build_object(
    'success', true,
    'message', 'License key redeemed successfully!',
    'plan_name', v_plan.name,
    'plan_code', v_plan.plan_code,
    'duration_days', v_license.duration_days,
    'billing_cycle', v_license.billing_cycle,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'license_key', v_sanitized_key
  );
end;
$$;

grant execute on function public.redeem_license_key(text, uuid) to authenticated;

-- 5. RPC: Superadmin License Key Generator
create or replace function public.admin_create_license_key(
  p_plan_id uuid,
  p_duration_days integer,
  p_billing_cycle text default 'annual',
  p_max_employees integer default null,
  p_max_branches integer default null,
  p_assigned_to_company_id uuid default null,
  p_notes text default null,
  p_valid_until timestamp with time zone default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan record;
  v_new_key text;
  v_random_chunk1 text;
  v_random_chunk2 text;
  v_random_chunk3 text;
  v_license_id uuid;
begin
  -- Enforce Superadmin access
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'superadmin'
  ) then
    return jsonb_build_object('success', false, 'error', 'Superadmin privileges required');
  end if;

  select * into v_plan from public.subscription_plans where id = p_plan_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid plan ID');
  end if;

  -- Generate readable cryptographic format: YUKTI-<PLAN_PREFIX>-XXXX-XXXX-XXXX
  v_random_chunk1 := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));
  v_random_chunk2 := upper(substring(md5(random()::text || clock_timestamp()::text) from 5 for 4));
  v_random_chunk3 := upper(substring(md5(random()::text || clock_timestamp()::text) from 9 for 4));

  v_new_key := 'YUKTI-' || upper(substring(v_plan.plan_code from 1 for 4)) || '-' || v_random_chunk1 || '-' || v_random_chunk2 || '-' || v_random_chunk3;

  insert into public.license_keys (
    license_key,
    plan_id,
    duration_days,
    billing_cycle,
    max_employees,
    max_branches,
    assigned_to_company_id,
    notes,
    valid_until,
    created_by
  ) values (
    v_new_key,
    p_plan_id,
    coalesce(p_duration_days, 365),
    coalesce(p_billing_cycle, 'annual'),
    p_max_employees,
    p_max_branches,
    p_assigned_to_company_id,
    p_notes,
    p_valid_until,
    auth.uid()
  )
  returning id into v_license_id;

  return jsonb_build_object(
    'success', true,
    'id', v_license_id,
    'license_key', v_new_key,
    'plan_name', v_plan.name,
    'duration_days', coalesce(p_duration_days, 365)
  );
end;
$$;

grant execute on function public.admin_create_license_key to authenticated;

commit;
