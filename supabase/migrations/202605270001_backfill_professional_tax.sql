-- Migration to backfill professional_tax column in payroll_items table
-- Extracts the professional tax amount from the nested breakdown deductions JSONB array for historical items

UPDATE public.payroll_items
SET professional_tax = COALESCE(
  (
    SELECT (elem->>'amount')::numeric
    FROM jsonb_array_elements(breakdown->'deductions') AS elem
    WHERE elem->>'name' ILIKE 'Professional Tax%'
    LIMIT 1
  ),
  0
)
WHERE (professional_tax IS NULL OR professional_tax = 0)
  AND breakdown IS NOT NULL;
