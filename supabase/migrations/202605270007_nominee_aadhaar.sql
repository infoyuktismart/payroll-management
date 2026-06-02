-- Migration 202605270007: Add Aadhaar Number to employee_nominees
begin;

alter table public.employee_nominees
  add column if not exists aadhaar_number varchar(20);

commit;
