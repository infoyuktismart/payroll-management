-- Migration 202605230006: Company Settings Table
begin;

create table if not exists public.company_settings (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  logo_url text,
  address text,
  pan_number text,
  tan_number text,
  gst_number text,
  esic_number text,
  epfo_number text,
  state text,
  city text,
  pincode text,
  phone text,
  email text,
  website text,
  financial_year_start date not null default '2026-04-01',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seed one default company row so there's always a configuration
insert into public.company_settings (id, name, pan_number, tan_number, gst_number, esic_number, epfo_number, state, city, pincode, phone, email, website)
values (
  'd4b00a00-1111-2222-3333-444455556666',
  'Acme Enterprise Solutions Ltd.',
  'ABCDE1234F',
  'DELA12345B',
  '07AAAAA1111A1Z1',
  '12345678901234567',
  'DLCPM0012345000',
  'Delhi',
  'New Delhi',
  '110001',
  '+91 11 4321 8765',
  'info@acme.com',
  'https://acme.com'
) on conflict (id) do nothing;

-- RLS
alter table public.company_settings enable row level security;

-- Admin role can perform all operations
drop policy if exists "Admin full access" on public.company_settings;
create policy "Admin full access" on public.company_settings
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Authenticated users can read the company settings
drop policy if exists "Authenticated users read company settings" on public.company_settings;
create policy "Authenticated users read company settings" on public.company_settings
  for select to authenticated
  using (true);

-- Trigger for audit
drop trigger if exists company_settings_audit on public.company_settings;
create trigger company_settings_audit after insert or update or delete on public.company_settings
  for each row execute function public.audit_row_change();

commit;
