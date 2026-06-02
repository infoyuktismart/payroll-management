-- Phase 8: Per-Employee Monthly Billing (Yukti Smart HRMS)
-- Adds PEPM pricing to plans, billing model selection, and automated invoicing tables.

begin;

-- 1. Add price_per_employee column to subscription_plans
alter table public.subscription_plans
  add column if not exists price_per_employee numeric(10,2) not null default 0;

-- 2. Add billing_model column to company_subscriptions
alter table public.company_subscriptions
  add column if not exists billing_model text not null default 'flat' 
    check (billing_model in ('flat', 'per_employee'));

-- 3. Create billing_invoices table
create table if not exists public.billing_invoices (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  subscription_id uuid references public.company_subscriptions(id) on delete set null,
  invoice_number text not null unique,
  billing_period_start date not null,
  billing_period_end date not null,
  billing_model text not null default 'flat' check (billing_model in ('flat', 'per_employee')),
  employee_count integer not null default 0,
  rate_per_employee numeric(10,2) not null default 0,
  flat_amount numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 18.00,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  currency text not null default 'INR',
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'overdue', 'void', 'waived')),
  due_date date,
  paid_at timestamp with time zone,
  payment_reference text,
  notes text,
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- 4. Create billing_invoice_line_items table
create table if not exists public.billing_invoice_line_items (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.billing_invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- 5. Add indexes
create index if not exists idx_billing_invoices_company_id on public.billing_invoices(company_id);
create index if not exists idx_billing_invoices_status on public.billing_invoices(status);
create index if not exists idx_billing_invoice_line_items_invoice_id on public.billing_invoice_line_items(invoice_id);

-- 6. Enable Row Level Security (RLS)
alter table public.billing_invoices enable row level security;
alter table public.billing_invoice_line_items enable row level security;

-- 7. Drop and recreate RLS policies
drop policy if exists "Invoices read admin or member" on public.billing_invoices;
drop policy if exists "Invoices manage admin" on public.billing_invoices;
drop policy if exists "Invoice line items read admin or member" on public.billing_invoice_line_items;
drop policy if exists "Invoice line items manage admin" on public.billing_invoice_line_items;

create policy "Invoices read admin or member"
  on public.billing_invoices for select
  using (public.is_admin_or_hr() or public.user_has_company_access(company_id));

create policy "Invoices manage admin"
  on public.billing_invoices for all
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create policy "Invoice line items read admin or member"
  on public.billing_invoice_line_items for select
  using (
    exists (
      select 1 from public.billing_invoices bi
      where bi.id = invoice_id
        and (public.is_admin_or_hr() or public.user_has_company_access(bi.company_id))
    )
  );

create policy "Invoice line items manage admin"
  on public.billing_invoice_line_items for all
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

-- 8. Sequential invoice number generator
create or replace function public.next_invoice_number()
returns text
language plpgsql
as $$
declare
  current_year_month text;
  invoice_seq integer;
begin
  current_year_month := to_char(now(), 'YYYYMM');
  select coalesce(count(*), 0) + 1 into invoice_seq
  from public.billing_invoices
  where to_char(created_at, 'YYYYMM') = current_year_month;
  
  return 'INV-' || current_year_month || '-' || lpad(invoice_seq::text, 4, '0');
end;
$$;

-- 9. Auto-updated timestamps for billing tables
drop trigger if exists billing_invoices_touch_updated_at on public.billing_invoices;
create trigger billing_invoices_touch_updated_at
  before update on public.billing_invoices
  for each row execute function public.touch_updated_at();

-- 10. Update existing seed data / plans with default PEPM pricing
update public.subscription_plans set price_per_employee = 149.00 where plan_code = 'starter';
update public.subscription_plans set price_per_employee = 129.00 where plan_code = 'growth';
update public.subscription_plans set price_per_employee = 99.00 where plan_code = 'enterprise';

-- 11. Add audit log triggers if available
do $$
begin
  if exists (select 1 from pg_proc where proname = 'audit_row_change' and pronamespace = 'public'::regnamespace) then
    drop trigger if exists billing_invoices_audit on public.billing_invoices;
    create trigger billing_invoices_audit after insert or update or delete on public.billing_invoices
      for each row execute function public.audit_row_change();

    drop trigger if exists billing_invoice_line_items_audit on public.billing_invoice_line_items;
    create trigger billing_invoice_line_items_audit after insert or update or delete on public.billing_invoice_line_items
      for each row execute function public.audit_row_change();
  end if;
end $$;

commit;
