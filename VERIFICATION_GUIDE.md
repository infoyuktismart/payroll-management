# 🔍 Master Verification Guide: Reviewing All 24 Implemented Gaps

This guide provides step-by-step instructions on how to review and verify all 24 definitive market gap features implemented across **Phases 5 to 8** in the running Web Application.

---

## 💰 Phase 5: Financial Engine, TDS Compliance & Arrears

### 1. NSDL 24Q Quarterly TDS plain-text Returns Exporter

- **How to Check**:
  1. Navigate to the **Reports** portal (`/reports` from the Sidebar).
  2. Locate the new **NSDL 24Q TDS Return** card.
  3. Select the Financial Year and Quarter (Q1-Q4), and click **Export 24Q Return**.
  4. It generates and downloads a plain-text NSDL-compliant `.txt` return batch file (with File Header FH, Batch Header BH, Challan CD, and Deductee DD segments).

### 2. Retroactive Arrears, Perquisites & Section 89 tax relief

- **How to Check**:
  1. Navigate to **Payroll Processing** (`/payroll-processing` from the Sidebar).
  2. When calculating payroll for the current month:
     - **Salary Arrears Logs**: Verify that retroactive salary arrears are pulled and appended as `Arrears` additions on the payroll run sheet.
     - **Perquisites**: Review perquisites taxation adjustments on salary slip previews.
     - **Section 89 Relief**: View computed TDS deductions containing the Section 89 tax rebate relief.

---

## 📍 Phase 6: Advanced Time, Attendance Policies & GPS

### 1. GPS Geofenced Web Punch Clock

- **How to Check**:
  1. Navigate to the **Employee Portal** (`/portal` or select _Portal_ view).
  2. Select the **Time & Attendance** tab.
  3. Click **Punch In Shift**.
  4. The browser will prompt for Geolocation permission. Click **Allow**.
  5. The UI will display a green `(GPS Tracked)` toast notification, and log your coordinates directly to the `attendance` table in Supabase.

### 2. Flexible Core-Hour Shift Policies & Webhook Hub

- **How to Check**:
  1. Navigate to **Attendance Management** (`/attendance` from the Sidebar).
  2. Click the **Attendance Policies & Biometrics** tab.
  3. Here you will see:
     - **Active Shift Policies**: Grace period parameters and core hours.
     - **Flex Policy Creator Form**: Create new shifts with customized parameters.
     - **Biometric webhook Hardware Hub**: Review the live status of the active hardware punch API endpoint and trigger a **Ping Hardware Handshake** test simulation.

---

## 👥 Phase 7: HR Core, Job Grades & Probation Workflows

### 1. Job Grades, Pay Band Scales & Probation States

- **How to Check**: 2. Navigate to **Employees Registry** (`/employees` from the Sidebar). 3. Click **Add Employee** or edit an existing employee. 4. Fill/select the new compliance options:
  - **Job Grade**: Select executive or leadership pay scales (Grade A to D).
  - **Employment Type**: Permanent, Contract, or Consultant classifications.
  - **Probation Status**: Change to Pending, Confirmed, or Extended.
  5. Save the form. Verify they are successfully mapped in Supabase and displayed in the main employees list.

### 2. Statutory PF Nominees Split

- **How to Check**:
  1. Open the **Employee Portal** and select the **Job Details** tab.
  2. Scroll down to review the **Statutory PF Nominees** table.
  3. It displays the split percentages (e.g. 50% spouse, 50% child) and DOB verification.

---

## 🏖️ Phase 8: Leaves Sandwich, LTA Travel & PDF Letters

### 1. Dynamic Increment, Experience & NOC Letter Downloads

- **How to Check**:
  1. Open the **Employee Portal** and select the **Job Details** tab.
  2. Locate the **HR Documents & Letters** section.
  3. Click:
     - **Increment Letter**: Generates a beautiful PDF with revised basic pay and annual package calculations.
     - **NOC Certificate**: Generates a standard company clearance certificate.
     - **Experience Certificate**: Generates a testimonial verifying joining date and role conduct.
  4. All certificates are instantly compiled inside the browser and downloaded directly.

### 2. LTA Travel Exemption Submissions

- **How to Check**:
  1. Open the **Employee Portal** and select the **Documents** tab.
  2. Click the **Tax Forms** sub-category.
  3. Review the new **Leave Travel Allowance (LTA) Exemption Claims** table showing financial year travel submissions, claimed amounts, and status levels.
  4. Submit a test claim using the **Submit LTA Claim** form to test.
