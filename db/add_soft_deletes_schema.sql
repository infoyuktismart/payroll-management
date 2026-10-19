-- Migration: Add Soft Deletes to employees, leaves, and reimbursements
-- Adds is_deleted and deleted_at columns for standard enterprise soft delete.

begin;

-- 1. Alter employees table
alter table public.employees add column if not exists is_deleted boolean not null default false;
alter table public.employees add column if not exists deleted_at timestamp with time zone;

-- 2. Alter leaves table
alter table public.leaves add column if not exists is_deleted boolean not null default false;
alter table public.leaves add column if not exists deleted_at timestamp with time zone;

-- 3. Alter reimbursements table
alter table public.reimbursements add column if not exists is_deleted boolean not null default false;
alter table public.reimbursements add column if not exists deleted_at timestamp with time zone;

-- 4. Create optimized indexes
create index if not exists idx_employees_is_deleted on public.employees(is_deleted);
create index if not exists idx_leaves_is_deleted on public.leaves(is_deleted);
create index if not exists idx_reimbursements_is_deleted on public.reimbursements(is_deleted);

commit;
