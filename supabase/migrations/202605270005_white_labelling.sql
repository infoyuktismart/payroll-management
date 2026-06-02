-- Migration 202605270005: Dynamic White-Labelling & Themes
begin;

-- 1. Add color variables and subdomain scoping fields on the companies table
alter table public.companies 
  add column if not exists primary_color varchar(20),
  add column if not exists secondary_color varchar(20),
  add column if not exists tenant_subdomain varchar(100) unique;

-- 2. Add an index for quick lookups on subdomains during bootstrap scoping
create index if not exists idx_companies_tenant_subdomain on public.companies(tenant_subdomain);

commit;
