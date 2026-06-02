-- Migration 202605270008: Add overtime_hours column to attendance table
begin;

-- Add overtime_hours to attendance table
alter table public.attendance
  add column if not exists overtime_hours numeric default 0.00 not null;

commit;
