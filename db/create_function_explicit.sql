-- CRITICAL: Create Verification Function
-- You MUST run this script to make Signup work.

-- 1. Drop it first to ensure a clean slate
DROP FUNCTION IF EXISTS verify_signup_eligibility(text, text);

-- 2. Create the function
CREATE OR REPLACE FUNCTION verify_signup_eligibility(
    p_employee_id text, 
    p_email text
) 
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
    v_user_id uuid;
    v_valid boolean;
    v_message text;
BEGIN
    -- Look for specific match (Case Insensitive + Trimmed)
    SELECT status, user_id
    INTO v_status, v_user_id
    FROM employees
    WHERE TRIM(LOWER(employee_id)) = TRIM(LOWER(p_employee_id))
    AND TRIM(LOWER(email)) = TRIM(LOWER(p_email));
    
    -- Evaluate Result
    IF v_status IS NULL THEN
        v_valid := false;
        v_message := 'Invalid ID or Email.';
    ELSIF v_status != 'active' THEN
        v_valid := false;
        v_message := 'Employee is inactive.';
    ELSIF v_user_id IS NOT NULL THEN
        v_valid := false;
        v_message := 'Account already exists.';
    ELSE
        v_valid := true;
        v_message := 'Success';
    END IF;

    RETURN json_build_object('valid', v_valid, 'message', v_message);
END;
$$;

-- 3. Grant permission so `anon` (unauthenticated users) can call it
GRANT EXECUTE ON FUNCTION verify_signup_eligibility(text, text) TO public;
GRANT EXECUTE ON FUNCTION verify_signup_eligibility(text, text) TO anon;
GRANT EXECUTE ON FUNCTION verify_signup_eligibility(text, text) TO authenticated;
