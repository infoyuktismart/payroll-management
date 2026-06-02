-- Phase 10: Super Admin Central Analytics & Metrics RPC
-- Provides central performance, revenue, and active client statistics securely.

begin;

create or replace function public.get_superadmin_metrics()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_total_companies bigint;
  v_total_employees bigint;
  v_total_trials bigint;
  v_total_active_subs bigint;
  v_total_billed numeric(15,2);
  v_total_outstanding numeric(15,2);
  v_tenants json;
  v_recent_invoices json;
begin
  -- 1. Secure authorization check
  v_caller_role := public.current_user_role();
  if v_caller_role <> 'superadmin' then
    raise exception 'Access Denied: Super Admin permissions are required to view central billing analytics.';
  end if;

  -- 2. Aggregate counts
  select count(*) into v_total_companies from public.companies;
  
  select count(*) into v_total_employees 
  from public.employees 
  where status = 'active';

  select count(*) into v_total_trials 
  from public.company_subscriptions 
  where status = 'trialing';

  select count(*) into v_total_active_subs 
  from public.company_subscriptions 
  where status = 'active';

  -- 3. Revenue stats
  select coalesce(sum(total_amount), 0) into v_total_billed 
  from public.billing_invoices 
  where status = 'paid';

  select coalesce(sum(total_amount), 0) into v_total_outstanding 
  from public.billing_invoices 
  where status in ('issued', 'overdue');

  -- 4. Get active tenant summary list
  select json_agg(t) into v_tenants
  from (
    select 
      c.id,
      c.name as company_name,
      c.code as company_code,
      c.created_at,
      coalesce(cs.status, 'none') as subscription_status,
      coalesce(sp.name, 'No plan') as plan_name,
      coalesce(cs.billing_model, 'flat') as billing_model,
      coalesce(emp.count, 0) as active_employees,
      coalesce(inv.total_billed, 0) as total_billed_amount,
      coalesce(inv.total_outstanding, 0) as outstanding_amount
    from public.companies c
    left join public.company_subscriptions cs on cs.company_id = c.id
    left join public.subscription_plans sp on sp.id = cs.plan_id
    left join lateral (
      select count(*)::integer as count 
      from public.employees e 
      where e.company_id = c.id and e.status = 'active'
    ) emp on true
    left join lateral (
      select 
        coalesce(sum(case when status = 'paid' then total_amount else 0 end), 0) as total_billed,
        coalesce(sum(case when status in ('issued', 'overdue') then total_amount else 0 end), 0) as total_outstanding
      from public.billing_invoices bi 
      where bi.company_id = c.id
    ) inv on true
    order by c.created_at desc
    limit 100
  ) t;

  -- 5. Get recent platform-wide invoices
  select json_agg(r) into v_recent_invoices
  from (
    select 
      bi.id,
      bi.invoice_number,
      c.name as company_name,
      bi.billing_period_start,
      bi.billing_period_end,
      bi.billing_model,
      bi.employee_count,
      bi.total_amount,
      bi.status,
      bi.created_at
    from public.billing_invoices bi
    join public.companies c on c.id = bi.company_id
    order by bi.created_at desc
    limit 50
  ) r;

  return json_build_object(
    'stats', json_build_object(
      'totalCompanies', v_total_companies,
      'totalEmployees', v_total_employees,
      'totalTrials', v_total_trials,
      'totalActiveSubscriptions', v_total_active_subs,
      'totalBilled', v_total_billed,
      'totalOutstanding', v_total_outstanding
    ),
    'tenants', coalesce(v_tenants, '[]'::json),
    'recentInvoices', coalesce(v_recent_invoices, '[]'::json)
  );
end;
$$;

grant execute on function public.get_superadmin_metrics() to authenticated;

commit;
