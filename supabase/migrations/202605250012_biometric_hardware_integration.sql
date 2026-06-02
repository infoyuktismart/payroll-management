-- Migration 202605250012: Biometric Hardware Device Integration and Mapping
begin;

-- 1. Add Biometric Card ID mapping to Employees table
alter table public.employees 
add column if not exists biometric_id text unique;

-- 2. Add Biometric Device identifier table for validation and auditing
create table if not exists public.biometric_devices (
    id uuid primary key default gen_random_uuid(),
    device_name text not null,
    serial_number text not null unique,
    location text not null,
    secret_token text not null, -- Machine headers must present this token to authorize writes
    is_active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create high-performance index for webhook mapping speed
create index if not exists idx_employees_biometric_id on public.employees(biometric_id);

-- 4. Enable Row Level Security (RLS) on biometric_devices
alter table public.biometric_devices enable row level security;

-- 5. Set RLS policies for biometric_devices
drop policy if exists "Admin manage biometric devices" on public.biometric_devices;
create policy "Admin manage biometric devices" 
on public.biometric_devices for all to authenticated
using (public.is_admin_or_hr())
with check (public.is_admin_or_hr());

commit;
