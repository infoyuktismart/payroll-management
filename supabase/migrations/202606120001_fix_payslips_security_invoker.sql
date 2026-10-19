-- Ensure the payslips view evaluates permissions and RLS as the querying user.
alter view if exists public.payslips set (security_invoker = true);
