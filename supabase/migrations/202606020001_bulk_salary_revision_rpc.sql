-- Trusted bulk salary revision writer for the bulk-salary-revision Edge Function.
-- Direct PostgREST updates can still trip employee self-update triggers; this RPC
-- sets the existing system-update flag in the same DB context as the writes.

begin;

create or replace function public.bulk_update_employee_salary_revisions(p_updates jsonb)
returns table(updated_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_update jsonb;
  v_employee_id uuid;
  v_salary_structure jsonb;
  v_effective_date date;
  v_updated_count integer := 0;
begin
  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    raise exception 'p_updates must be a JSON array.';
  end if;

  perform set_config('app.allow_employee_system_update', 'true', true);

  for v_update in
    select value from jsonb_array_elements(p_updates)
  loop
    v_employee_id := nullif(v_update ->> 'id', '')::uuid;
    v_salary_structure := v_update -> 'salary_structure';
    v_effective_date := coalesce(nullif(v_update ->> 'salary_effective_date', '')::date, current_date);

    if v_employee_id is null then
      raise exception 'Every salary revision update must include an employee id.';
    end if;

    if v_salary_structure is null or v_salary_structure = 'null'::jsonb then
      raise exception 'Every salary revision update must include salary_structure.';
    end if;

    update public.employees
    set salary_structure = v_salary_structure,
        salary_effective_date = v_effective_date,
        updated_at = timezone('utc'::text, now())
    where id = v_employee_id;

    if not found then
      raise exception 'Employee % was not found for salary revision.', v_employee_id;
    end if;

    v_updated_count := v_updated_count + 1;
  end loop;

  return query select v_updated_count;
end;
$$;

revoke all on function public.bulk_update_employee_salary_revisions(jsonb) from public;
revoke all on function public.bulk_update_employee_salary_revisions(jsonb) from anon;
revoke all on function public.bulk_update_employee_salary_revisions(jsonb) from authenticated;
grant execute on function public.bulk_update_employee_salary_revisions(jsonb) to service_role;

commit;
