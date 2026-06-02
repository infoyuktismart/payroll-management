-- Migration 202605270006: GDPR & India DPDP Privacy Compliance
begin;

-- 1. Create public.privacy_consents table
create table if not exists public.privacy_consents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  consent_version varchar(20) default '1.0' not null,
  accepted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ip_address text,
  metadata jsonb default '{}'::jsonb
);

-- Create index for quick lookup of employee consents
create index if not exists idx_privacy_consents_employee on public.privacy_consents(employee_id);
create index if not exists idx_privacy_consents_company on public.privacy_consents(company_id);

-- Enable RLS
alter table public.privacy_consents enable row level security;

-- 2. Configure RLS Policies for privacy_consents
drop policy if exists "Users can view own consents" on public.privacy_consents;
create policy "Users can view own consents"
  on public.privacy_consents for select
  using (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own consents" on public.privacy_consents;
create policy "Users can insert own consents"
  on public.privacy_consents for insert
  with check (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

drop policy if exists "Admins can view all consents" on public.privacy_consents;
create policy "Admins can view all consents"
  on public.privacy_consents for select
  using (public.is_admin_or_hr());

-- 3. Atomic "Right to be Forgotten" Anonymization Database Engine
create or replace function public.anonymize_employee_profile(p_employee_id uuid)
returns void
language plpgsql
security definer -- Runs with elevated privileges to bypass standard employee updates restrictions
as $$
declare
  v_caller_role text;
begin
  -- 1. Safety Check: Verify the execution context is triggered by an Admin or HR user
  if not public.is_admin_or_hr() then
    raise exception 'Unauthorized: Only HR or admin accounts can anonymize employee records.';
  end if;

  -- 2. Detach employee from auth and permanently scrub all personal PII identifiers
  update public.employees
  set 
    user_id = null, -- Detaches auth user completely
    first_name = 'Anonymized',
    last_name = 'Employee',
    email = p_employee_id::text || '@anonymized.local',
    phone = '0000000000',
    emergency_contact_person = null,
    emergency_contact_number = null,
    current_address = 'Anonymized address',
    permanent_address = 'Anonymized address',
    pan_number = null,
    aadhaar_number = null,
    pan_number_enc = null,
    aadhaar_number_enc = null,
    bank_account_number = null,
    bank_account_number_enc = null,
    uan_number = null,
    esi_number = null,
    profile_photo_url = null,
    id_proof_url = null,
    address_proof_url = null,
    registration_id = null,
    dob = null,
    status = 'terminated',
    leave_balance = 0
  where id = p_employee_id;

  -- 3. Clear nominee details
  delete from public.employee_nominees
  where employee_id = p_employee_id;

  -- NOTE: Numeric totals in payroll_items / payroll_runs are strictly preserved
  -- for corporate ledger audit trails and statutory tax records.
end;
$$;

commit;
