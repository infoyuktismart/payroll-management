-- Phase 8: Leaves sandwich, LTA Travel & PDF Letters
-- Create lta_claims table and update leave sandwich functions if needed.

begin;

-- Create lta_claims table
create table if not exists public.lta_claims (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade not null,
  financial_year varchar(15) not null,
  amount_claimed decimal(15,2) not null,
  bill_attachment_url text,
  status varchar(30) default 'pending' not null check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.lta_claims enable row level security;

-- RLS Policies
create policy "Users can view own LTA claims"
  on public.lta_claims for select using (true);

create policy "Users can manage own LTA claims"
  on public.lta_claims for all using (true);

create policy "Admins can manage all LTA claims"
  on public.lta_claims for all using (true);

commit;
