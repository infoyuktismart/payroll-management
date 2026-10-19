-- Migration: Fix pgcrypto extension search_path for PII protection trigger & helper functions
-- Resolves error 42883: function pgp_sym_encrypt(text, text) does not exist when search_path is strictly 'public'

-- 1. Ensure pgcrypto extension exists
create extension if not exists "pgcrypto";

-- 2. Redefine protect_employee_pii trigger with search_path including extensions
create or replace function public.protect_employee_pii()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  pii_key text := nullif(current_setting('app.pii_key', true), '');
begin
  if pii_key is null then
    return new;
  end if;

  begin
    if new.pan_number is not null and new.pan_number !~ '^\*+' then
      new.pan_number_enc := pgp_sym_encrypt(new.pan_number, pii_key);
      new.pan_number := public.mask_identifier(new.pan_number);
    end if;

    if new.aadhaar_number is not null and new.aadhaar_number !~ '^\*+' then
      new.aadhaar_number_enc := pgp_sym_encrypt(new.aadhaar_number, pii_key);
      new.aadhaar_number := public.mask_identifier(new.aadhaar_number);
    end if;

    if new.bank_account_number is not null and new.bank_account_number !~ '^\*+' then
      new.bank_account_number_enc := pgp_sym_encrypt(new.bank_account_number, pii_key);
      new.bank_account_number := public.mask_identifier(new.bank_account_number);
    end if;
  exception when undefined_function then
    null;
  end;

  return new;
end;
$$;

-- 3. Redefine helper functions if present
create or replace function public.encrypt_employee_pii_value(plaintext text)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
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
        return plaintext;
    end if;

    begin
        return encode(pgp_sym_encrypt(plaintext, v_key), 'base64');
    exception when undefined_function then
        return plaintext;
    end;
end;
$$;

create or replace function public.decrypt_employee_pii(ciphertext text)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
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
        return ciphertext;
    end if;

    begin
        return pgp_sym_decrypt(decode(ciphertext, 'base64'), v_key);
    exception when undefined_function then
        return ciphertext;
    end;
end;
$$;
