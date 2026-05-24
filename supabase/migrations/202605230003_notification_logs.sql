-- Notification delivery log for email workflows.

begin;

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists public.notification_logs (
  id uuid default gen_random_uuid() primary key,
  channel text not null default 'email',
  notification_type text not null,
  recipient_email text not null,
  subject text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider text,
  provider_message_id text,
  error_message text,
  metadata jsonb default '{}'::jsonb,
  created_by uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  sent_at timestamp with time zone
);

create index if not exists idx_notification_logs_created_at on public.notification_logs(created_at desc);
create index if not exists idx_notification_logs_recipient on public.notification_logs(recipient_email);
create index if not exists idx_notification_logs_type_status on public.notification_logs(notification_type, status);

alter table public.notification_logs enable row level security;

drop policy if exists "Notification logs select admin" on public.notification_logs;
drop policy if exists "Notification logs insert authenticated" on public.notification_logs;
drop policy if exists "Notification logs update service" on public.notification_logs;

create policy "Notification logs select admin"
  on public.notification_logs for select
  using (public.is_admin_or_hr());

create policy "Notification logs insert authenticated"
  on public.notification_logs for insert
  with check (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "Notification logs update service"
  on public.notification_logs for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop trigger if exists notification_logs_audit on public.notification_logs;
create trigger notification_logs_audit after insert or update or delete on public.notification_logs
  for each row execute function public.audit_row_change();

commit;
