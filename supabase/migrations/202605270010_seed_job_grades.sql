-- Migration 202605270010: Add job_grade to employees and seed default job grades
begin;

-- 1. Add job_grade column to public.employees
alter table public.employees
  add column if not exists job_grade varchar(100);

-- 2. Seed default job grades for any companies that have none
do $$
declare
  comp_record record;
  grade_count integer;
begin
  for comp_record in select id, name from public.companies loop
    select count(*) into grade_count from public.job_grades where company_id = comp_record.id;
    
    if grade_count = 0 then
      raise notice 'Seeding job grades for company: % (%)', comp_record.name, comp_record.id;
      insert into public.job_grades (company_id, grade_code, name, min_salary, max_salary, description)
      values
        (comp_record.id, 'L1_' || substring(comp_record.id::text from 1 for 4), 'L1 - Junior Associate', 10000.00, 40000.00, 'Entry level role'),
        (comp_record.id, 'L2_' || substring(comp_record.id::text from 1 for 4), 'L2 - Associate', 40000.00, 80000.00, 'Intermediate role'),
        (comp_record.id, 'L3_' || substring(comp_record.id::text from 1 for 4), 'L3 - Senior Associate', 80000.00, 150000.00, 'Senior specialist role'),
        (comp_record.id, 'L4_' || substring(comp_record.id::text from 1 for 4), 'L4 - Lead', 150000.00, 300000.00, 'Leadership/Management role'),
        (comp_record.id, 'L5_' || substring(comp_record.id::text from 1 for 4), 'L5 - Principal', 300000.00, 800000.00, 'Director/Principal leadership role');
    end if;
  end loop;
end;
$$;

commit;
