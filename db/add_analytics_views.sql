-- Phase 4: Reporting & Analytics Engine
-- Tenant-aware aggregate views for payroll, workforce, attendance, and compliance dashboards.

begin;

create or replace view public.v_payroll_monthly_trend as
select
  pr.company_id,
  date_trunc('month', pr.month_year)::date as month_start,
  to_char(date_trunc('month', pr.month_year), 'Mon YYYY') as month_label,
  count(pr.id)::integer as payroll_runs,
  coalesce(sum(pr.total_amount), 0)::numeric(15,2) as total_payroll,
  coalesce(sum(pr.total_employees), 0)::integer as total_employees,
  coalesce(avg(pr.total_amount), 0)::numeric(15,2) as average_payroll
from public.payroll_runs pr
group by pr.company_id, date_trunc('month', pr.month_year)
order by month_start;

create or replace view public.v_department_headcount as
select
  e.company_id,
  coalesce(nullif(e.department, ''), 'Unassigned') as department,
  count(*)::integer as total_count,
  count(*) filter (where lower(coalesce(e.status, 'active')) = 'active')::integer as active_count,
  count(*) filter (where lower(coalesce(e.status, '')) in ('terminated', 'resigned'))::integer as inactive_count,
  coalesce(avg(nullif(e.salary, 0)), 0)::numeric(15,2) as average_basic_salary
from public.employees e
group by e.company_id, coalesce(nullif(e.department, ''), 'Unassigned')
order by active_count desc, department;

create or replace view public.v_headcount_monthly as
select
  e.company_id,
  date_trunc('month', e.created_at)::date as month_start,
  to_char(date_trunc('month', e.created_at), 'Mon YYYY') as month_label,
  count(*)::integer as hires,
  count(*) filter (where lower(coalesce(e.status, 'active')) = 'active')::integer as active_hires
from public.employees e
group by e.company_id, date_trunc('month', e.created_at)
order by month_start;

create or replace view public.v_attendance_monthly_summary as
select
  a.company_id,
  date_trunc('month', a.date)::date as month_start,
  to_char(date_trunc('month', a.date), 'Mon YYYY') as month_label,
  count(*)::integer as total_records,
  count(*) filter (where lower(a.status) in ('present', 'weekly_off'))::integer as present_records,
  count(*) filter (where lower(a.status) in ('absent'))::integer as absent_records,
  count(*) filter (where lower(a.status) in ('half_day', 'half day'))::integer as half_day_records,
  case
    when count(*) = 0 then 0
    else round((count(*) filter (where lower(a.status) in ('present', 'weekly_off'))::numeric / count(*)) * 100, 2)
  end as attendance_rate
from public.attendance a
group by a.company_id, date_trunc('month', a.date)
order by month_start;

create or replace view public.v_compliance_summary as
select
  e.company_id,
  count(*) filter (where lower(coalesce(e.status, 'active')) = 'active')::integer as active_employees,
  count(*) filter (where e.pan_number_enc is not null or nullif(e.pan_number, '') is not null)::integer as pan_available,
  count(*) filter (where nullif(e.uan_number, '') is not null or nullif(e.epf_member_id, '') is not null)::integer as pf_available,
  count(*) filter (where nullif(e.esi_number, '') is not null or nullif(e.esic_ip_no, '') is not null)::integer as esic_available,
  count(*) filter (where nullif(e.bank_account_number, '') is not null and nullif(e.ifsc_code, '') is not null)::integer as bank_ready,
  case
    when count(*) filter (where lower(coalesce(e.status, 'active')) = 'active') = 0 then 0
    else round((
      (
        count(*) filter (where e.pan_number_enc is not null or nullif(e.pan_number, '') is not null)
        + count(*) filter (where nullif(e.uan_number, '') is not null or nullif(e.epf_member_id, '') is not null)
        + count(*) filter (where nullif(e.bank_account_number, '') is not null and nullif(e.ifsc_code, '') is not null)
      )::numeric
      / nullif((count(*) filter (where lower(coalesce(e.status, 'active')) = 'active') * 3), 0)
    ) * 100, 2)
  end as compliance_score
from public.employees e
group by e.company_id;

alter view public.v_payroll_monthly_trend set (security_invoker = true);
alter view public.v_department_headcount set (security_invoker = true);
alter view public.v_headcount_monthly set (security_invoker = true);
alter view public.v_attendance_monthly_summary set (security_invoker = true);
alter view public.v_compliance_summary set (security_invoker = true);

commit;
