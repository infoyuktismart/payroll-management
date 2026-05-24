import { test, expect } from '@playwright/test';

test.describe('E2E Payroll Processing Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Standard login before running payroll E2E test
    await page.goto('/login');
    const email = process.env.TEST_USER_EMAIL || 'admin@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'Password123';
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should navigate to payroll processing, trigger calculation, and verify output', async ({ page }) => {
    // 1. Navigate to /payroll-processing
    await page.goto('/payroll-processing');

    // 2. Assert the page renders employee list
    // (We will wait for the container or table to be visible)
    const employeeTable = page.locator('table, .employee-list, [data-testid="employee-list"]').first();
    await expect(employeeTable).toBeVisible();

    // 3. Click "Run Payroll" or "Process Payroll" button
    const runPayrollButton = page.locator('button:has-text("Run Payroll"), button:has-text("Process Payroll")').first();
    await expect(runPayrollButton).toBeVisible();
    await runPayrollButton.click();

    // 4. Assert confirmation dialog/alert or steps appear
    // In our custom hook, calculations go through stages (loading step 1..5)
    // Or there is an explicit modal/button confirmation:
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Calculate"), button:has-text("Proceed")').first();
    if (await confirmButton.isVisible()) {
        await confirmButton.click();
    }

    // 5. Assert success toast appears
    const successToast = page.locator('.toast-success, text=Successfully processed, text=processed payroll, .toast').first();
    await expect(successToast).toBeVisible();

    // 6. Assert at least one payslip row appears in the results table
    const resultRow = page.locator('table tbody tr, .payroll-row, [data-testid="payroll-row"]').first();
    await expect(resultRow).toBeVisible();
  });
});
