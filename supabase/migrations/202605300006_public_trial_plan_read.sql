-- Public registration needs to display active trial plans before login.

begin;

drop policy if exists "Subscription plans read public active" on public.subscription_plans;
create policy "Subscription plans read public active"
  on public.subscription_plans for select
  using (is_active = true);

insert into public.subscription_plans
  (plan_code, name, description, monthly_price, annual_price, price_per_employee, max_employees, max_companies, max_branches, features, is_active, sort_order)
values
  ('starter', 'Starter', 'Core payroll and HR for small teams.', 2999, 29990, 149, 50, 1, 2, '["Payroll processing", "Attendance", "Employee portal", "Statutory reports"]'::jsonb, true, 10),
  ('growth', 'Growth', 'Multi-branch payroll with analytics and integrations.', 7999, 79990, 129, 250, 3, 10, '["Everything in Starter", "Multi-company", "Analytics", "Biometric import"]'::jsonb, true, 20),
  ('enterprise', 'Enterprise', 'Advanced controls for larger organizations.', 19999, 199990, 99, null, null, null, '["Everything in Growth", "2FA controls", "Audit logs", "System health", "Priority support"]'::jsonb, true, 30)
on conflict (plan_code) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_price = excluded.monthly_price,
  annual_price = excluded.annual_price,
  price_per_employee = excluded.price_per_employee,
  max_employees = excluded.max_employees,
  max_companies = excluded.max_companies,
  max_branches = excluded.max_branches,
  features = excluded.features,
  is_active = true,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc'::text, now());

commit;
