-- Migration 202605270009: Add probation_end_date and medical_document_url columns
begin;

-- Add probation_end_date to employees table
alter table public.employees
  add column if not exists probation_end_date date;

-- Add medical_document_url to leaves table
alter table public.leaves
  add column if not exists medical_document_url text;

commit;
