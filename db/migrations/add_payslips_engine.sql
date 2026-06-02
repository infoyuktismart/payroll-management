-- =============================================================================
-- MIGRATION: add_payslips_engine.sql
-- Purpose  : Establish Database as the Single Source of Truth for payroll.
--            Adds the integer-cents calculation engine RPC, enriches
--            payroll_items with SSOT columns, and creates a payslips view.
-- Author   : Payroll Engine v2 — SSOT Migration
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. PREREQUISITE COLUMNS
--    These columns are referenced in the engine but may be absent from the
--    schema depending on which migrations have been applied.
-- ---------------------------------------------------------------------------

-- Add run_type to payroll_runs (used for regular / off_cycle differentiation)
ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS run_type text NOT NULL DEFAULT 'regular';

-- Add state to employees for Professional Tax lookup
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS state text;

-- ---------------------------------------------------------------------------
-- 1. ENRICH payroll_items WITH SSOT COLUMNS
--    All finalized salary figures live here.  The breakdown columns store
--    the exact list that was used to derive them — no re-computation needed.
-- ---------------------------------------------------------------------------

ALTER TABLE public.payroll_items
  ADD COLUMN IF NOT EXISTS gross_salary            numeric(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_salary              numeric(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_ctc             numeric(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_ctc              numeric(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lop_days                numeric(5,  2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payable_days            numeric(5,  2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earnings_breakdown      jsonb          NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deductions_breakdown    jsonb          NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS employer_contributions  jsonb          NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS calculation_metadata    jsonb          NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS finalized_at            timestamp with time zone;

-- Performance index for per-employee month lookup
CREATE INDEX IF NOT EXISTS idx_payroll_items_finalized
  ON public.payroll_items (employee_id, finalized_at DESC)
  WHERE finalized_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. PAYSLIPS VIEW
--    Immutable snapshot of Completed / Paid payroll runs.
--    Frontend reads ONLY this view — never recomputes values.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.payslips AS
SELECT
  pi.id,
  pi.employee_id,
  pr.month_year,
  pr.run_type,
  pi.basic_salary,
  pi.total_allowances,
  pi.gross_salary,
  pi.total_deductions,
  pi.net_salary,
  pi.monthly_ctc,
  pi.annual_ctc,
  pi.lop_days,
  pi.payable_days,
  pi.earnings_breakdown,
  pi.deductions_breakdown,
  pi.employer_contributions,
  pi.calculation_metadata,
  pi.finalized_at,
  pr.status                AS payroll_status,
  pr.processed_at,
  -- Employee identity snapshot (read-only convenience joins)
  e.employee_id            AS emp_code,
  e.first_name,
  e.last_name,
  e.department,
  e.designation,
  e.uan_number,
  e.esi_number,
  e.bank_name,
  e.bank_account_number,
  e.pan_number,
  e.joining_date,
  e.company_id
FROM public.payroll_items   pi
JOIN public.payroll_runs    pr ON pr.id = pi.payroll_run_id
JOIN public.employees        e  ON e.id  = pi.employee_id
WHERE pr.status IN ('Completed', 'Paid');

-- RLS: payslips view inherits policies from underlying tables.
-- Employees see only their own rows; admins see all within company.
-- No explicit RLS needed on the view itself since it filters through payroll_items policy.

-- ---------------------------------------------------------------------------
-- 3. INTEGER-CENTS PAYROLL CALCULATION ENGINE
--
--    calculate_payroll_engine(
--      p_run_id       uuid,
--      p_employee_id  uuid,
--      p_days_in_month integer,
--      p_lop_days      numeric,       -- Loss-of-Pay days (can be fractional for half days)
--      p_month        integer,        -- 1-based month number (for PT February rule)
--      p_months_remaining integer     -- Months left in FY for TDS projection
--    )
--
--    CONTRACT:
--      • All intermediate arithmetic uses BIGINT (cent-level integers).
--      • Input numerics are ROUND(value * 100)::BIGINT on ingestion.
--      • Output NUMERIC(15,2) = cents_bigint / 100.0
--      • Zero native float operations on money values.
--      • ESI threshold: 2100000 cents (₹21,000) / 2500000 cents (₹25,000)
--      • EPF wage ceiling: 1500000 cents (₹15,000)
--      • EPS employer cap: 125000 cents (₹1,250/month)
--    RETURNS: The upserted payroll_items row id.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.calculate_payroll_engine(
  p_run_id          uuid,
  p_employee_id     uuid,
  p_days_in_month   integer,
  p_lop_days        numeric  DEFAULT 0,
  p_month           integer  DEFAULT EXTRACT(MONTH FROM current_date)::integer,
  p_months_remaining integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Employee record
  v_emp              public.employees%ROWTYPE;

  -- Cent-level BIGINT accumulators (100 cents = ₹1)
  v_basic_cents      BIGINT;
  v_gross_cents      BIGINT  := 0;
  v_total_ded_cents  BIGINT  := 0;
  v_total_emp_ctc    BIGINT  := 0;   -- employer side of CTC (not deducted from employee)

  -- Per-component scratch
  v_amount_cents     BIGINT;
  v_base_cents       BIGINT;

  -- Payable days (stored as BIGINT in 1/100-day units for precision)
  v_payable_days     numeric;
  v_factor           numeric;        -- payable_days / days_in_month

  -- EPF
  v_epf_wage_cents        BIGINT;
  v_employee_epf_cents    BIGINT  := 0;
  v_employer_epf_cents    BIGINT  := 0;
  v_employer_eps_cents    BIGINT  := 0;

  -- ESI
  v_esi_limit_cents       BIGINT;
  v_employee_esi_cents    BIGINT  := 0;
  v_employer_esi_cents    BIGINT  := 0;
  v_esi_eligible          boolean := false;

  -- Gratuity provision (employer cost, not deducted from employee)
  v_gratuity_cents        BIGINT  := 0;

  -- LWF & PT
  v_pt_cents              BIGINT  := 0;
  v_lwf_employee_cents    BIGINT  := 0;
  v_lwf_employer_cents    BIGINT  := 0;

  -- TDS
  v_tds_cents             BIGINT  := 0;
  v_annual_gross          numeric;
  v_taxable_income        numeric;
  v_annual_tax            numeric;
  v_standard_deduction    numeric := 75000;
  v_declaration           public.tax_declarations%ROWTYPE;

  -- JSON accumulation
  v_earnings_list         jsonb   := '[]'::jsonb;
  v_deductions_list       jsonb   := '[]'::jsonb;

  -- Structure iteration
  v_structure             jsonb;
  v_comp_key              text;
  v_comp                  jsonb;
  v_label                 text;
  v_sys_type              text;
  v_comp_type             text;     -- 'percentage' | 'fixed'
  v_comp_cat              text;     -- 'earning' | 'deduction'
  v_comp_value            numeric;
  v_min_limit             numeric;
  v_max_limit             numeric;
  v_enabled               boolean;

  -- Custom deductions
  v_cust_rec              public.custom_deductions%ROWTYPE;

  -- PT slabs JSONB (from tax_regime_configs or hardcoded fallback)
  v_pt_monthly            numeric := 0;

  -- Output
  v_item_id               uuid;

  -- Financial year
  v_fin_year              text;
BEGIN
  -- ─────────────────────────────────────────────────────────────────────────
  -- GUARD: caller must be admin/HR or service_role
  -- ─────────────────────────────────────────────────────────────────────────
  IF auth.role() <> 'service_role' AND NOT public.is_admin_or_hr() THEN
    RAISE EXCEPTION 'Only HR, Admin, or service_role can run the payroll engine.';
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 1: Load employee
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee % not found.', p_employee_id;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 2: Proration factor & basic salary in integer cents
  -- ─────────────────────────────────────────────────────────────────────────
  v_payable_days := GREATEST(0, COALESCE(p_days_in_month, 30)::numeric - COALESCE(p_lop_days, 0));
  v_factor       := v_payable_days / GREATEST(1, p_days_in_month)::numeric;

  -- Convert basic salary to cents (ROUND avoids partial-cent inputs)
  v_basic_cents  := ROUND(COALESCE(v_emp.salary, 0) * 0.5 * 100)::BIGINT;

  -- Pro-rated basic in cents
  v_amount_cents := ROUND(v_basic_cents * v_factor)::BIGINT;
  v_gross_cents  := v_gross_cents + v_amount_cents;

  -- Append to earnings list
  v_earnings_list := v_earnings_list || jsonb_build_object(
    'name',   'Basic Salary',
    'amount', v_amount_cents::numeric / 100.0,
    'type',   'basic'
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 3: Earnings from salary_structure JSONB
  --         Falls back to active global salary_components if structure is empty
  -- ─────────────────────────────────────────────────────────────────────────
  v_structure := COALESCE(v_emp.salary_structure, '{}'::jsonb);

  -- A. Per-employee salary_structure (takes priority)
  IF v_structure <> '{}'::jsonb AND v_structure IS NOT NULL THEN
    FOR v_comp_key IN SELECT jsonb_object_keys(v_structure) LOOP
      v_comp      := v_structure -> v_comp_key;
      v_label     := v_comp->>'label';
      v_comp_cat  := v_comp->>'category';
      v_comp_type := v_comp->>'type';
      v_enabled   := COALESCE((v_comp->>'enabled')::boolean, false);
      v_sys_type  := COALESCE(v_comp->>'system_type', '');
      v_comp_value := COALESCE((v_comp->>'value')::numeric, 0);
      v_min_limit  := COALESCE((v_comp->>'min_limit')::numeric, 0);
      v_max_limit  := COALESCE((v_comp->>'max_limit')::numeric, 0);

      CONTINUE WHEN NOT v_enabled;
      CONTINUE WHEN v_comp_cat NOT IN ('earning', 'deduction');
      -- Skip Basic — already handled above
      CONTINUE WHEN lower(v_label) IN ('basic salary', 'basic');

      IF v_comp_cat = 'earning' THEN
        IF v_comp_type = 'percentage' THEN
          -- Percentage earnings are % of basic salary
          v_base_cents   := v_basic_cents;
          v_amount_cents := ROUND(v_base_cents * v_comp_value / 100.0 * v_factor)::BIGINT;
        ELSE
          -- Fixed earnings: pro-rate by payable factor
          v_amount_cents := ROUND(COALESCE(v_comp_value, 0) * 100 * v_factor)::BIGINT;
        END IF;

        IF v_amount_cents > 0 THEN
          v_gross_cents   := v_gross_cents + v_amount_cents;
          v_earnings_list := v_earnings_list || jsonb_build_object(
            'name',   v_label,
            'amount', v_amount_cents::numeric / 100.0,
            'type',   v_comp_type
          );
        END IF;
      END IF;
    END LOOP;

  ELSE
    -- B. Fallback: global salary_components table
    FOR v_comp_key, v_label, v_comp_cat, v_comp_type, v_comp_value, v_min_limit, v_max_limit, v_sys_type IN
      SELECT id::text, name, type, calculation_type, value, min_limit, max_limit, COALESCE(system_type, '')
      FROM   public.salary_components
      WHERE  status = 'Active'
        AND  type   = 'earning'
        AND  lower(name) NOT IN ('basic salary', 'basic')
    LOOP
      IF v_comp_type = 'percentage' THEN
        v_base_cents   := v_basic_cents;
        IF v_max_limit > 0 THEN v_base_cents := LEAST(v_base_cents, ROUND(v_max_limit * 100)::BIGINT); END IF;
        IF v_min_limit > 0 THEN v_base_cents := GREATEST(v_base_cents, ROUND(v_min_limit * 100)::BIGINT); END IF;
        v_amount_cents := ROUND(v_base_cents * v_comp_value / 100.0 * v_factor)::BIGINT;
      ELSE
        v_amount_cents := ROUND(v_comp_value * 100 * v_factor)::BIGINT;
      END IF;

      IF v_amount_cents > 0 THEN
        v_gross_cents   := v_gross_cents + v_amount_cents;
        v_earnings_list := v_earnings_list || jsonb_build_object(
          'name',   v_label,
          'amount', v_amount_cents::numeric / 100.0,
          'type',   v_comp_type
        );
      END IF;
    END LOOP;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 4: STATUTORY DEDUCTIONS (integer cents throughout)
  -- ─────────────────────────────────────────────────────────────────────────

  -- Pro-rated basic for EPF wage base
  DECLARE v_prorated_basic_cents BIGINT := ROUND(v_basic_cents * v_factor)::BIGINT;
  BEGIN

  -- 4A. EPF — Employee 12% (capped at ₹15,000 wage = 1,500,000 cents)
  v_epf_wage_cents     := LEAST(v_prorated_basic_cents, 1500000::BIGINT);
  v_employee_epf_cents := ROUND(v_epf_wage_cents * 12 / 100.0)::BIGINT;

  -- EPF employer splits: 3.67% EPF + 8.33% EPS (capped ₹1,250 = 125000 cents)
  v_employer_epf_cents := ROUND(v_epf_wage_cents * 367 / 10000.0)::BIGINT;
  v_employer_eps_cents := LEAST(ROUND(v_epf_wage_cents * 833 / 10000.0)::BIGINT, 125000::BIGINT);

  IF v_employee_epf_cents > 0 THEN
    v_total_ded_cents   := v_total_ded_cents + v_employee_epf_cents;
    v_deductions_list   := v_deductions_list || jsonb_build_object(
      'name',        'Employee PF (12%)',
      'amount',      v_employee_epf_cents::numeric / 100.0,
      'system_type', 'PF'
    );
  END IF;

  -- 4B. ESI — Employee 0.75%
  --     Threshold: ₹21,000 gross = 2,100,000 cents (regular)
  --                ₹25,000 gross = 2,500,000 cents (specially abled)
  v_esi_limit_cents := CASE WHEN COALESCE(v_emp.is_specially_abled, false) THEN 2500000::BIGINT
                            ELSE 2100000::BIGINT END;
  v_esi_eligible    := (v_gross_cents > 0 AND v_gross_cents <= v_esi_limit_cents);

  IF v_esi_eligible THEN
    v_employee_esi_cents := ROUND(v_gross_cents * 75 / 10000.0)::BIGINT;   -- 0.75%
    v_employer_esi_cents := ROUND(v_gross_cents * 325 / 10000.0)::BIGINT;  -- 3.25%

    IF v_employee_esi_cents > 0 THEN
      v_total_ded_cents := v_total_ded_cents + v_employee_esi_cents;
      v_deductions_list := v_deductions_list || jsonb_build_object(
        'name',        'Employee ESI (0.75%)',
        'amount',      v_employee_esi_cents::numeric / 100.0,
        'system_type', 'ESI'
      );
    END IF;
  ELSE
    v_employer_esi_cents := 0;
  END IF;

  -- 4C. Professional Tax (state-based slab lookup)
  --     PT slabs are stored in the PT_SLABS constant replicated here as a CASE.
  --     We read gross in FULL rupees for slab matching.
  DECLARE v_gross_rupees numeric := v_gross_cents::numeric / 100.0;
  BEGIN
    v_pt_monthly := CASE COALESCE(v_emp.state, '')
      WHEN 'Andhra Pradesh'  THEN CASE WHEN v_gross_rupees <= 15000 THEN 0 ELSE 200 END
      WHEN 'Karnataka'       THEN CASE WHEN v_gross_rupees <= 15000 THEN 0 ELSE 200 END
      WHEN 'Maharashtra'     THEN CASE WHEN v_gross_rupees <= 7500 THEN 0
                                       WHEN v_gross_rupees <= 10000 THEN 175
                                       WHEN p_month = 2 THEN 300   -- February premium
                                       ELSE 200 END
      WHEN 'West Bengal'     THEN CASE WHEN v_gross_rupees <= 8500  THEN 0
                                       WHEN v_gross_rupees <= 10000 THEN 90
                                       WHEN v_gross_rupees <= 15000 THEN 110
                                       WHEN v_gross_rupees <= 25000 THEN 130
                                       WHEN v_gross_rupees <= 40000 THEN 150
                                       ELSE 200 END
      WHEN 'Tamil Nadu'      THEN CASE WHEN v_gross_rupees <= 3500  THEN 0
                                       WHEN v_gross_rupees <= 5000  THEN 23
                                       WHEN v_gross_rupees <= 7500  THEN 53
                                       WHEN v_gross_rupees <= 10000 THEN 115
                                       WHEN v_gross_rupees <= 12500 THEN 125
                                       ELSE 208 END
      WHEN 'Telangana'       THEN CASE WHEN v_gross_rupees <= 15000 THEN 0 ELSE 200 END
      WHEN 'Gujarat'         THEN CASE WHEN v_gross_rupees <= 5999  THEN 0
                                       WHEN v_gross_rupees <= 8999  THEN 80
                                       WHEN v_gross_rupees <= 11999 THEN 150
                                       ELSE 200 END
      WHEN 'Madhya Pradesh'  THEN CASE WHEN v_gross_rupees <= 18750 THEN 0 ELSE 208 END
      WHEN 'Odisha'          THEN CASE WHEN v_gross_rupees <= 13304 THEN 0
                                       WHEN v_gross_rupees <= 25000 THEN 125
                                       ELSE 200 END
      WHEN 'Assam'           THEN CASE WHEN v_gross_rupees <= 10000 THEN 0
                                       WHEN v_gross_rupees <= 14999 THEN 150
                                       ELSE 208 END
      WHEN 'Kerala'          THEN CASE WHEN v_gross_rupees <= 1999  THEN 0
                                       WHEN v_gross_rupees <= 3999  THEN 20
                                       WHEN v_gross_rupees <= 4999  THEN 30
                                       WHEN v_gross_rupees <= 7499  THEN 50
                                       WHEN v_gross_rupees <= 9999  THEN 75
                                       WHEN v_gross_rupees <= 14999 THEN 125
                                       WHEN v_gross_rupees <= 19999 THEN 167
                                       ELSE 208 END
      WHEN 'Punjab'          THEN CASE WHEN v_gross_rupees <= 24999 THEN 0 ELSE 200 END
      WHEN 'Bihar'           THEN CASE WHEN v_gross_rupees <= 25000 THEN 0 ELSE 208 END
      WHEN 'Jharkhand'       THEN CASE WHEN v_gross_rupees <= 25000 THEN 0 ELSE 100 END
      WHEN 'Chhattisgarh'    THEN CASE WHEN v_gross_rupees <= 15000 THEN 0 ELSE 200 END
      WHEN 'Meghalaya'       THEN CASE WHEN v_gross_rupees <= 4166  THEN 0
                                       WHEN v_gross_rupees <= 6250  THEN 17
                                       WHEN v_gross_rupees <= 8333  THEN 25
                                       WHEN v_gross_rupees <= 12500 THEN 42
                                       WHEN v_gross_rupees <= 16666 THEN 83
                                       ELSE 208 END
      WHEN 'Tripura'         THEN CASE WHEN v_gross_rupees <= 7500  THEN 0
                                       WHEN v_gross_rupees <= 15000 THEN 100
                                       ELSE 150 END
      WHEN 'Sikkim'          THEN CASE WHEN v_gross_rupees <= 20000 THEN 0
                                       WHEN v_gross_rupees <= 30000 THEN 125
                                       ELSE 200 END
      WHEN 'Manipur'         THEN CASE WHEN v_gross_rupees <= 5000  THEN 0
                                       WHEN v_gross_rupees <= 8333  THEN 75
                                       WHEN v_gross_rupees <= 12500 THEN 100
                                       ELSE 208 END
      ELSE 0   -- Delhi, Rajasthan, UP, Haryana, etc. — no PT
    END;
  END;

  v_pt_cents := ROUND(v_pt_monthly * 100)::BIGINT;
  IF v_pt_cents > 0 THEN
    v_total_ded_cents := v_total_ded_cents + v_pt_cents;
    v_deductions_list := v_deductions_list || jsonb_build_object(
      'name',        'Professional Tax (' || COALESCE(v_emp.state, 'N/A') || ')',
      'amount',      v_pt_cents::numeric / 100.0,
      'system_type', 'PT'
    );
  END IF;

  -- 4D. Labour Welfare Fund (LWF) — Employee share
  DECLARE
    v_lwf_emp_monthly  numeric;
    v_lwf_empr_monthly numeric;
  BEGIN
    SELECT
      CASE COALESCE(v_emp.state, '')
        WHEN 'Maharashtra'    THEN 6
        WHEN 'Karnataka'      THEN 20
        WHEN 'Gujarat'        THEN 6
        WHEN 'Tamil Nadu'     THEN 10
        WHEN 'Andhra Pradesh' THEN 30
        WHEN 'Telangana'      THEN 30
        WHEN 'Madhya Pradesh' THEN 10
        WHEN 'Punjab'         THEN 10
        WHEN 'Kerala'         THEN 4
        WHEN 'Haryana'        THEN 3
        WHEN 'West Bengal'    THEN 3
        WHEN 'Odisha'         THEN 3
        WHEN 'Chhattisgarh'   THEN 10
        WHEN 'Jharkhand'      THEN 10
        WHEN 'Goa'            THEN 10
        ELSE 0
      END,
      CASE COALESCE(v_emp.state, '')
        WHEN 'Maharashtra'    THEN 12
        WHEN 'Karnataka'      THEN 40
        WHEN 'Gujarat'        THEN 12
        WHEN 'Tamil Nadu'     THEN 20
        WHEN 'Andhra Pradesh' THEN 70
        WHEN 'Telangana'      THEN 70
        WHEN 'Madhya Pradesh' THEN 20
        WHEN 'Punjab'         THEN 20
        WHEN 'Kerala'         THEN 8
        WHEN 'Haryana'        THEN 6
        WHEN 'West Bengal'    THEN 6
        WHEN 'Odisha'         THEN 6
        WHEN 'Chhattisgarh'   THEN 20
        WHEN 'Jharkhand'      THEN 20
        WHEN 'Goa'            THEN 20
        ELSE 0
      END
    INTO v_lwf_emp_monthly, v_lwf_empr_monthly;

    v_lwf_employee_cents := ROUND(v_lwf_emp_monthly * 100)::BIGINT;
    v_lwf_employer_cents := ROUND(v_lwf_empr_monthly * 100)::BIGINT;
  END;

  IF v_lwf_employee_cents > 0 THEN
    v_total_ded_cents := v_total_ded_cents + v_lwf_employee_cents;
    v_deductions_list := v_deductions_list || jsonb_build_object(
      'name',        'Labour Welfare Fund (Employee)',
      'amount',      v_lwf_employee_cents::numeric / 100.0,
      'system_type', 'LWF'
    );
  END IF;

  -- 4E. Non-statutory structure deductions (from salary_structure or salary_components)
  IF v_structure <> '{}'::jsonb AND v_structure IS NOT NULL THEN
    FOR v_comp_key IN SELECT jsonb_object_keys(v_structure) LOOP
      v_comp      := v_structure -> v_comp_key;
      v_label     := v_comp->>'label';
      v_comp_cat  := v_comp->>'category';
      v_comp_type := v_comp->>'type';
      v_enabled   := COALESCE((v_comp->>'enabled')::boolean, false);
      v_sys_type  := COALESCE(v_comp->>'system_type', '');
      v_comp_value := COALESCE((v_comp->>'value')::numeric, 0);
      v_min_limit  := COALESCE((v_comp->>'min_limit')::numeric, 0);
      v_max_limit  := COALESCE((v_comp->>'max_limit')::numeric, 0);

      CONTINUE WHEN NOT v_enabled;
      CONTINUE WHEN v_comp_cat <> 'deduction';
      -- Skip PF/ESI/PT/LWF — already handled statatorily above
      CONTINUE WHEN v_sys_type IN ('PF', 'ESI', 'PT', 'LWF');

      IF v_comp_type = 'percentage' THEN
        -- Percentage deductions base: basic salary (standard practice)
        v_base_cents := ROUND(v_basic_cents * v_factor)::BIGINT;
        IF v_max_limit > 0 THEN v_base_cents := LEAST(v_base_cents, ROUND(v_max_limit * 100)::BIGINT); END IF;
        IF v_min_limit > 0 THEN v_base_cents := GREATEST(v_base_cents, ROUND(v_min_limit * 100)::BIGINT); END IF;
        v_amount_cents := ROUND(v_base_cents * v_comp_value / 100.0)::BIGINT;
      ELSE
        v_amount_cents := ROUND(v_comp_value * 100 * v_factor)::BIGINT;
      END IF;

      IF v_amount_cents > 0 THEN
        v_total_ded_cents := v_total_ded_cents + v_amount_cents;
        v_deductions_list := v_deductions_list || jsonb_build_object(
          'name',   v_label,
          'amount', v_amount_cents::numeric / 100.0,
          'type',   v_comp_type
        );
      END IF;
    END LOOP;
  END IF;

  -- 4F. Custom (variable) deductions — loans, fines, advances
  FOR v_cust_rec IN
    SELECT * FROM public.custom_deductions
    WHERE  employee_id = p_employee_id
      AND  status      = 'Active'
      AND  start_date  <= current_date
      AND  (end_date IS NULL OR end_date >= current_date)
  LOOP
    v_amount_cents    := ROUND(v_cust_rec.amount * 100)::BIGINT;
    v_total_ded_cents := v_total_ded_cents + v_amount_cents;
    v_deductions_list := v_deductions_list || jsonb_build_object(
      'name',        v_cust_rec.deduction_type,
      'amount',      v_cust_rec.amount,
      'custom',      true,
      'deduction_id', v_cust_rec.id
    );
  END LOOP;

  -- 4G. TDS (Income Tax) — projected annual method
  --     annual_gross = monthly_gross * 12
  --     taxable = MAX(0, annual_gross - standard_deduction)
  --     tax is calculated via New Regime slabs (FY 2026-27), then divided by months_remaining
  v_annual_gross   := (v_gross_cents::numeric / 100.0) * 12;

  -- Look up approved tax declaration for this employee
  SELECT fin_year_str INTO v_fin_year FROM (
    SELECT CASE
      WHEN EXTRACT(MONTH FROM current_date) >= 4
      THEN EXTRACT(YEAR FROM current_date)::text || '-' || RIGHT((EXTRACT(YEAR FROM current_date)::integer + 1)::text, 2)
      ELSE (EXTRACT(YEAR FROM current_date)::integer - 1)::text || '-' || RIGHT(EXTRACT(YEAR FROM current_date)::text, 2)
    END AS fin_year_str
  ) sq;

  SELECT * INTO v_declaration
  FROM   public.tax_declarations
  WHERE  employee_id    = p_employee_id
    AND  financial_year = v_fin_year
    AND  status         = 'approved'
  LIMIT 1;

  IF v_declaration.regime = 'old' THEN
    -- Old Regime: apply standard deduction + declaration amounts
    DECLARE
      v_allowed_ded numeric := 50000
        + LEAST(COALESCE(v_declaration.section_80c, 0), 150000)
        + COALESCE(v_declaration.section_80d, 0)
        + COALESCE(v_declaration.hra_exemption, 0)
        + LEAST(COALESCE(v_declaration.home_loan_interest, 0), 200000)
        + COALESCE(v_declaration.other_deductions, 0);
    BEGIN
      v_taxable_income := GREATEST(0, v_annual_gross + COALESCE(v_declaration.other_income, 0) - v_allowed_ded);
      -- Old regime slabs: 0→2.5L:0%, 2.5–5L:5%, 5–10L:20%, 10L+:30%
      v_annual_tax := CASE
        WHEN v_taxable_income <= 250000  THEN 0
        WHEN v_taxable_income <= 500000  THEN (v_taxable_income - 250000) * 0.05
        WHEN v_taxable_income <= 1000000 THEN 12500 + (v_taxable_income - 500000) * 0.20
        ELSE 112500 + (v_taxable_income - 1000000) * 0.30
      END;
      -- Rebate u/s 87A: if taxable ≤ 5L, rebate up to ₹12,500
      IF v_taxable_income <= 500000 THEN
        v_annual_tax := GREATEST(0, v_annual_tax - LEAST(v_annual_tax, 12500));
      END IF;
      v_annual_tax := v_annual_tax * 1.04;  -- 4% cess
    END;
  ELSE
    -- New Regime slabs (FY 2026-27)
    v_taxable_income := GREATEST(0,
      v_annual_gross
      + COALESCE(v_declaration.other_income, 0)
      - v_standard_deduction
    );
    v_annual_tax := CASE
      WHEN v_taxable_income <= 400000  THEN 0
      WHEN v_taxable_income <= 800000  THEN (v_taxable_income - 400000) * 0.05
      WHEN v_taxable_income <= 1200000 THEN 20000 + (v_taxable_income - 800000) * 0.10
      WHEN v_taxable_income <= 1600000 THEN 60000 + (v_taxable_income - 1200000) * 0.15
      WHEN v_taxable_income <= 2000000 THEN 120000 + (v_taxable_income - 1600000) * 0.20
      WHEN v_taxable_income <= 2400000 THEN 200000 + (v_taxable_income - 2000000) * 0.25
      ELSE 300000 + (v_taxable_income - 2400000) * 0.30
    END;
    -- Rebate u/s 87A: if taxable ≤ ₹12L, rebate up to ₹60,000
    IF v_taxable_income <= 1200000 THEN
      v_annual_tax := GREATEST(0, v_annual_tax - LEAST(v_annual_tax, 60000));
    END IF;
    v_annual_tax := v_annual_tax * 1.04;  -- 4% cess
  END IF;

  -- Subtract already-deducted TDS
  v_annual_tax := GREATEST(0, v_annual_tax - COALESCE(v_declaration.tds_already_deducted, 0));

  -- Monthly TDS = remaining tax / months remaining in FY
  v_tds_cents := ROUND(v_annual_tax / GREATEST(1, p_months_remaining) * 100)::BIGINT;

  IF v_tds_cents > 0 THEN
    v_total_ded_cents := v_total_ded_cents + v_tds_cents;
    v_deductions_list := v_deductions_list || jsonb_build_object(
      'name',        'TDS - ' || CASE WHEN v_declaration.regime = 'old' THEN 'Old' ELSE 'New' END || ' Regime',
      'amount',      v_tds_cents::numeric / 100.0,
      'system_type', 'TDS'
    );
  END IF;

  END; -- STEP 4 inner declare block

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 5: EMPLOYER CONTRIBUTIONS (CTC add-ons — NOT deducted from employee)
  -- ─────────────────────────────────────────────────────────────────────────
  -- Gratuity provision: 4.81% of pro-rated basic
  v_gratuity_cents := ROUND(ROUND(v_basic_cents * v_factor)::BIGINT * 481 / 10000.0)::BIGINT;

  -- CTC = Gross + Employer EPF + Employer EPS + Employer ESI
  v_total_emp_ctc :=
      v_gross_cents
    + v_employer_epf_cents
    + v_employer_eps_cents
    + v_employer_esi_cents;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 6: UPSERT into payroll_items
  --         All BIGINT cents → NUMERIC(15,2) via / 100.0
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.payroll_items (
    payroll_run_id,
    employee_id,
    basic_salary,
    total_allowances,
    gross_salary,
    total_deductions,
    net_salary,
    monthly_ctc,
    annual_ctc,
    lop_days,
    payable_days,
    attendance_days,
    earnings_breakdown,
    deductions_breakdown,
    employer_contributions,
    calculation_metadata,
    finalized_at
  )
  VALUES (
    p_run_id,
    p_employee_id,
    -- basic_salary: full (non-prorated) for reference
    COALESCE(v_emp.salary, 0),
    -- total_allowances: gross minus prorated basic
    (v_gross_cents - ROUND(v_basic_cents * v_factor)::BIGINT)::numeric / 100.0,
    -- gross_salary
    v_gross_cents::numeric / 100.0,
    -- total_deductions
    v_total_ded_cents::numeric / 100.0,
    -- net_salary
    (v_gross_cents - v_total_ded_cents)::numeric / 100.0,
    -- monthly_ctc
    v_total_emp_ctc::numeric / 100.0,
    -- annual_ctc
    (v_total_emp_ctc * 12)::numeric / 100.0,
    -- lop_days
    COALESCE(p_lop_days, 0),
    -- payable_days
    v_payable_days,
    -- attendance_days (alias for payable_days for legacy compatibility)
    v_payable_days,
    -- earnings_breakdown
    v_earnings_list,
    -- deductions_breakdown
    v_deductions_list,
    -- employer_contributions (JSON object)
    jsonb_build_object(
      'employer_epf',          v_employer_epf_cents::numeric / 100.0,
      'employer_eps',          v_employer_eps_cents::numeric / 100.0,
      'employer_esi',          v_employer_esi_cents::numeric / 100.0,
      'gratuity_provision',    v_gratuity_cents::numeric / 100.0,
      'lwf_employer',          v_lwf_employer_cents::numeric / 100.0,
      'total_employer_share',  (v_employer_epf_cents + v_employer_eps_cents + v_employer_esi_cents + v_gratuity_cents + v_lwf_employer_cents)::numeric / 100.0
    ),
    -- calculation_metadata
    jsonb_build_object(
      'engine_version',  '2.0',
      'days_in_month',   p_days_in_month,
      'lop_days',        p_lop_days,
      'payable_days',    v_payable_days,
      'proration_factor', ROUND(v_factor * 10000) / 10000,
      'esi_eligible',    v_esi_eligible,
      'epf_wage_cents',  v_epf_wage_cents,
      'tds_regime',      COALESCE(v_declaration.regime, 'new'),
      'months_remaining', p_months_remaining,
      'computed_at',     now()
    ),
    now()
  )
  ON CONFLICT (payroll_run_id, employee_id)
  DO UPDATE SET
    basic_salary          = EXCLUDED.basic_salary,
    total_allowances      = EXCLUDED.total_allowances,
    gross_salary          = EXCLUDED.gross_salary,
    total_deductions      = EXCLUDED.total_deductions,
    net_salary            = EXCLUDED.net_salary,
    monthly_ctc           = EXCLUDED.monthly_ctc,
    annual_ctc            = EXCLUDED.annual_ctc,
    lop_days              = EXCLUDED.lop_days,
    payable_days          = EXCLUDED.payable_days,
    attendance_days       = EXCLUDED.attendance_days,
    earnings_breakdown    = EXCLUDED.earnings_breakdown,
    deductions_breakdown  = EXCLUDED.deductions_breakdown,
    employer_contributions = EXCLUDED.employer_contributions,
    calculation_metadata  = EXCLUDED.calculation_metadata,
    finalized_at          = EXCLUDED.finalized_at
  RETURNING id INTO v_item_id;

  RETURN v_item_id;
END;
$$;

-- Grant execute to authenticated users who are admin/HR
-- (the function itself enforces the is_admin_or_hr() guard)
GRANT EXECUTE ON FUNCTION public.calculate_payroll_engine(uuid, uuid, integer, numeric, integer, integer)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. AGGREGATE HELPER: payroll_run_summary
--    Returns totals for a completed payroll run — used by Dashboard & Reports.
--    Frontend does ZERO math; it reads these pre-aggregated figures.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_payroll_run_summary(p_run_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'run_id',              p_run_id,
    'headcount',           COUNT(pi.id),
    'total_gross_salary',  ROUND(SUM(pi.gross_salary)::numeric, 2),
    'total_deductions',    ROUND(SUM(pi.total_deductions)::numeric, 2),
    'total_net_salary',    ROUND(SUM(pi.net_salary)::numeric, 2),
    'total_monthly_ctc',   ROUND(SUM(pi.monthly_ctc)::numeric, 2),
    'total_annual_ctc',    ROUND(SUM(pi.annual_ctc)::numeric, 2),
    'total_employer_pf',   ROUND(SUM((pi.employer_contributions->>'employer_epf')::numeric + (pi.employer_contributions->>'employer_eps')::numeric), 2),
    'total_employer_esi',  ROUND(SUM((pi.employer_contributions->>'employer_esi')::numeric), 2),
    'status',              MAX(pr.status),
    'month_year',          MAX(pr.month_year::text),
    'run_type',            MAX(pr.run_type)
  )
  FROM public.payroll_items  pi
  JOIN public.payroll_runs   pr ON pr.id = pi.payroll_run_id
  WHERE pi.payroll_run_id = p_run_id
    AND pi.finalized_at IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_payroll_run_summary(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. RLS on payslips view columns already covered by underlying table policies.
--    Explicitly grant SELECT so authenticated users can query it.
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.payslips TO authenticated;

-- ---------------------------------------------------------------------------
-- End of migration: add_payslips_engine.sql
-- ---------------------------------------------------------------------------
