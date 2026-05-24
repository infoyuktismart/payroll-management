-- Create Salary Components Table
create table public.salary_components (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  type text not null check (type in ('earning', 'deduction')),
  calculation_type text not null check (calculation_type in ('percentage', 'fixed')),
  value numeric not null default 0,
  is_taxable boolean default false,
  status text default 'Active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.salary_components enable row level security;

-- Policies
create policy "Enable read access for all authenticated users"
  on public.salary_components for select
  using ( auth.role() = 'authenticated' );

create policy "Enable insert for authenticated users"
  on public.salary_components for insert
  with check ( auth.role() = 'authenticated' );

create policy "Enable update for authenticated users"
  on public.salary_components for update
  using ( auth.role() = 'authenticated' );

create policy "Enable delete for authenticated users"
  on public.salary_components for delete
  using ( auth.role() = 'authenticated' );

-- Insert Default Data
insert into public.salary_components (name, type, calculation_type, value, is_taxable, status) values
('Basic Salary', 'earning', 'fixed', 0, true, 'Active'),
('House Rent Allowance (HRA)', 'earning', 'percentage', 40, true, 'Active'),
('Dearness Allowance (DA)', 'earning', 'percentage', 10, true, 'Active'),
('Medical Allowance', 'earning', 'fixed', 1250, false, 'Active'),
('Conveyance Allowance', 'earning', 'fixed', 800, false, 'Active'),
('Special Allowance', 'earning', 'fixed', 5000, true, 'Active'),
('Provident Fund', 'deduction', 'percentage', 12, false, 'Active'),
('ESI', 'deduction', 'percentage', 0.75, false, 'Active'),
('Professional Tax', 'deduction', 'fixed', 200, false, 'Active');
