-- Migration 202605270004: WhatsApp Payslip Delivery Extensions
begin;

-- 1. Add phone verification and WhatsApp notification preferences to public.employees
alter table public.employees 
  add column if not exists phone_verified boolean default false not null,
  add column if not exists whatsapp_enabled boolean default false not null;

-- 2. Add recipient_phone column to public.notification_logs to log WhatsApp notifications
alter table public.notification_logs
  add column if not exists recipient_phone text;

-- 3. Add an index for quick lookups on phone numbers in notification logs
create index if not exists idx_notification_logs_recipient_phone on public.notification_logs(recipient_phone);

commit;
