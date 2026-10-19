-- Migration: PII Column Encryption for employees table using pgcrypto & Supabase Vault
-- Encrypts: pan_number, aadhaar_number, bank_account_number
--
-- Prerequisites:
--   • supabase_vault and pgcrypto extensions must be enabled (enabled by default in Supabase).
--
-- What this migration does:
--   1. Creates/retrieves a secure symmetric encryption key in Supabase Vault (vault.secrets).
--   2. Adds helper functions encrypt_employee_pii_value() and decrypt_employee_pii()
--      defined as SECURITY DEFINER to securely access the Vault key and do pgcrypto operations.
--   3. Adds three encrypted shadow columns (_enc suffix) to the employees table.
--   4. Copies + encrypts existing plaintext values into the new columns.
--   5. Drops the original plaintext columns and renames the encrypted ones.
--   6. Creates a row-level-secured decryption view `employees_readable` that
--      exposes decrypted values only to authenticated users who pass RLS checks.
--   7. Creates BEFORE INSERT/UPDATE trigger to auto-encrypt incoming plaintext values.
--   8. Redefines dependent triggers/procedures/views to remove *_enc references.

begin;

-- Disable the employee self-update trigger guard during the migration transaction
set local app.allow_employee_system_update = 'true';

-- ─── 1. Enable required extensions ────────────────────────────────────────
-- pgcrypto and supabase_vault are pre-enabled in Supabase.


-- ─── 2. Create a dedicated Vault key for employee PII ─────────────────────
-- Store the symmetric key in Supabase Vault so it is secure and managed.
do $$
declare
    v_key text;
begin
    -- Check if already exists in the Vault
    select decrypted_secret into v_key
    from vault.decrypted_secrets
    where name = 'employees_pii'
    limit 1;

    if v_key is null then
        -- Generate a secure random 256-bit key in hex format and store in Vault
        perform vault.create_secret(
            encode(gen_random_bytes(32), 'hex'),
            'employees_pii',
            'Employee PII encryption key'
        );
    end if;
end;
$$;

-- ─── 3. Helper Functions for Encryption & Decryption ──────────────────────
-- These run as SECURITY DEFINER so they can access vault.decrypted_secrets.
create or replace function public.encrypt_employee_pii_value(plaintext text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_key text;
begin
    if plaintext is null or plaintext = '' then
        return null;
    end if;

    select decrypted_secret into v_key
    from vault.decrypted_secrets
    where name = 'employees_pii'
    limit 1;

    if v_key is null then
        raise exception 'PII encryption key not found in Vault';
    end if;

    return encode(pgp_sym_encrypt(plaintext, v_key), 'base64');
end;
$$;

create or replace function public.decrypt_employee_pii(ciphertext text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_key text;
begin
    if ciphertext is null or ciphertext = '' then
        return null;
    end if;

    select decrypted_secret into v_key
    from vault.decrypted_secrets
    where name = 'employees_pii'
    limit 1;

    if v_key is null then
        return null;
    end if;

    begin
        return pgp_sym_decrypt(decode(ciphertext, 'base64'), v_key);
    exception when others then
        return null;
    end;
end;
$$;

grant execute on function public.encrypt_employee_pii_value(text) to authenticated, service_role;
grant execute on function public.decrypt_employee_pii(text) to authenticated, service_role;

-- ─── 4. Add encrypted shadow columns ──────────────────────────────────────
-- Drop dependent views before altering table columns
drop view if exists public.v_compliance_summary;
drop view if exists public.payslips;
drop trigger if exists employees_pii_protection on public.employees;
drop function if exists public.protect_employee_pii();

alter table public.employees
    drop column if exists pan_number_enc,
    drop column if exists aadhaar_number_enc,
    drop column if exists bank_account_number_enc;

alter table public.employees
    add column pan_number_enc          text,
    add column aadhaar_number_enc      text,
    add column bank_account_number_enc text;

-- ─── 5. Migrate existing plaintext data to encrypted columns ──────────────
update public.employees
set
    pan_number_enc          = case when pan_number          is not null and pan_number          <> ''
                                   then public.encrypt_employee_pii_value(pan_number)
                                   else pan_number_enc end,

    aadhaar_number_enc      = case when aadhaar_number      is not null and aadhaar_number      <> ''
                                   then public.encrypt_employee_pii_value(aadhaar_number)
                                   else aadhaar_number_enc end,

    bank_account_number_enc = case when bank_account_number is not null and bank_account_number <> ''
                                   then public.encrypt_employee_pii_value(bank_account_number)
                                   else bank_account_number_enc end;

-- ─── 6. Drop original plaintext columns, rename encrypted ones ─────────────
alter table public.employees
    drop column if exists pan_number,
    drop column if exists aadhaar_number,
    drop column if exists bank_account_number;

alter table public.employees
    rename column pan_number_enc          to pan_number;

alter table public.employees
    rename column aadhaar_number_enc      to aadhaar_number;

alter table public.employees
    rename column bank_account_number_enc to bank_account_number;

-- ─── 7. Create auto-encryption trigger ────────────────────────────────────
create or replace function public.employees_encrypt_pii()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Encrypt PAN if a new plaintext value arrives (not already a base64 ciphertext)
    if NEW.pan_number is not null and NEW.pan_number <> '' and length(NEW.pan_number) <= 10 then
        NEW.pan_number := public.encrypt_employee_pii_value(upper(trim(NEW.pan_number)));
    end if;

    -- Encrypt Aadhaar
    if NEW.aadhaar_number is not null and NEW.aadhaar_number <> '' and length(NEW.aadhaar_number) <= 12 then
        NEW.aadhaar_number := public.encrypt_employee_pii_value(trim(NEW.aadhaar_number));
    end if;

    -- Encrypt Bank Account Number
    if NEW.bank_account_number is not null and NEW.bank_account_number <> '' and length(NEW.bank_account_number) <= 20 then
        NEW.bank_account_number := public.encrypt_employee_pii_value(trim(NEW.bank_account_number));
    end if;

    return NEW;
end;
$$;

drop trigger if exists employees_pii_encrypt_trigger on public.employees;
create trigger employees_pii_encrypt_trigger
    before insert or update of pan_number, aadhaar_number, bank_account_number
    on public.employees
    for each row execute function public.employees_encrypt_pii();

-- ─── 8. Decryption view ───────────────────────────────────────────────────
drop view if exists public.employees_readable;
create view public.employees_readable as
select
    e.*,
    public.decrypt_employee_pii(e.pan_number) as pan_number_plain,
    public.decrypt_employee_pii(e.aadhaar_number) as aadhaar_number_plain,
    public.decrypt_employee_pii(e.bank_account_number) as bank_account_number_plain
from public.employees e;

alter view public.employees_readable set (security_invoker = true);

-- ─── 9. Redefine dependent database triggers/functions/views ──────────────
create or replace function public.enforce_employee_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.allow_employee_system_update', true) = 'true' then
    return new;
  end if;

  if public.is_trusted_backend_role() then
    return new;
  end if;

  if public.is_admin_or_hr() then
    return new;
  end if;

  if old.user_id is distinct from auth.uid() then
    raise exception 'Employees can only update their own profile.';
  end if;

  if old.employee_id is distinct from new.employee_id
    or old.user_id is distinct from new.user_id
    or old.role is distinct from new.role
    or old.department is distinct from new.department
    or old.designation is distinct from new.designation
    or old.reporting_person is distinct from new.reporting_person
    or old.salary is distinct from new.salary
    or old.salary_allowances is distinct from new.salary_allowances
    or old.salary_deductions is distinct from new.salary_deductions
    or old.salary_structure is distinct from new.salary_structure
    or old.salary_effective_date is distinct from new.salary_effective_date
    or old.pan_number is distinct from new.pan_number
    or old.aadhaar_number is distinct from new.aadhaar_number
    or old.bank_account_number is distinct from new.bank_account_number
    or old.leave_balance is distinct from new.leave_balance
    or old.status is distinct from new.status
    or old.created_by is distinct from new.created_by
  then
    raise exception 'This profile field can only be changed by HR or Admin.';
  end if;

  return new;
end;
$$;

create or replace function public.anonymize_employee_profile(p_employee_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_caller_role text;
begin
  if not public.is_admin_or_hr() then
    raise exception 'Unauthorized: Only HR or admin accounts can anonymize employee records.';
  end if;

  update public.employees
  set 
    user_id = null,
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
    bank_account_number = null,
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

  delete from public.employee_nominees
  where employee_id = p_employee_id;
end;
$$;

create or replace view public.v_compliance_summary as
select
  e.company_id,
  count(*) filter (where lower(coalesce(e.status, 'active')) = 'active')::integer as active_employees,
  count(*) filter (where nullif(e.pan_number, '') is not null)::integer as pan_available,
  count(*) filter (where nullif(e.uan_number, '') is not null or nullif(e.epf_member_id, '') is not null)::integer as pf_available,
  count(*) filter (where nullif(e.esi_number, '') is not null or nullif(e.esic_ip_no, '') is not null)::integer as esic_available,
  count(*) filter (where nullif(e.bank_account_number, '') is not null and nullif(e.ifsc_code, '') is not null)::integer as bank_ready,
  case
    when count(*) filter (where lower(coalesce(e.status, 'active')) = 'active') = 0 then 0
    else round((
      (
        count(*) filter (where nullif(e.pan_number, '') is not null)
        + count(*) filter (where nullif(e.uan_number, '') is not null or nullif(e.epf_member_id, '') is not null)
        + count(*) filter (where nullif(e.bank_account_number, '') is not null and nullif(e.ifsc_code, '') is not null)
      )::numeric
      / nullif((count(*) filter (where lower(coalesce(e.status, 'active')) = 'active') * 3), 0)
    ) * 100, 2)
  end as compliance_score
from public.employees e
group by e.company_id;

alter view public.v_compliance_summary set (security_invoker = true);

-- Recreate payslips view with decrypted values
drop view if exists public.payslips;
create or replace view public.payslips as
select
  pi.id,
  pi.employee_id,
  pr.month_year,
  pr.run_type,
  pi.basic_salary,
  pi.total_allowances,
  pi.gross_salary,
  pi.total_deductions,
  pi.net_salary,
  pi.monthly_ctc,
  pi.annual_ctc,
  pi.lop_days,
  pi.payable_days,
  pi.earnings_breakdown,
  pi.deductions_breakdown,
  pi.employer_contributions,
  pi.calculation_metadata,
  pi.finalized_at,
  pr.status as payroll_status,
  pr.processed_at,
  e.employee_id as emp_code,
  e.first_name,
  e.last_name,
  e.department,
  e.designation,
  e.uan_number,
  e.esi_number,
  e.bank_name,
  public.decrypt_employee_pii(e.bank_account_number) as bank_account_number,
  public.decrypt_employee_pii(e.pan_number) as pan_number,
  e.joining_date,
  e.company_id
from public.payroll_items pi
join public.payroll_runs pr on pr.id = pi.payroll_run_id
join public.employees e on e.id = pi.employee_id
where pr.status in ('Completed', 'Paid');

alter view public.payslips set (security_invoker = true);

grant select on public.payslips to authenticated;

-- ─── 10. Grant read access to authenticated role ──────────────────────────
grant select on public.employees_readable to authenticated;
grant select, insert, update, delete on public.employees to authenticated;

commit;
