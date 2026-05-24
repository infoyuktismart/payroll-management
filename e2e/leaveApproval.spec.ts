import { test, expect } from '@playwright/test';

test.describe('E2E Leave Approval Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as admin
    await page.goto('/login');
    const email = process.env.TEST_USER_EMAIL || 'admin@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'Password123';
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should view pending leave and approve it successfully', async ({ page }) => {
    // 1. Navigate to /leaves
    await page.goto('/leaves');

    // 2. Assert a pending leave request is visible
    const pendingRequest = page.locator('text=Pending, .status-pending, td:has-text("Pending")').first();
    await expect(pendingRequest).toBeVisible();

    // 3. Click Approve button
    const approveButton = page.locator('button:has-text("Approve"), [aria-label="Approve"]').first();
    await expect(approveButton).toBeVisible();
    await approveButton.click();

    // 4. Assert status changes to "Approved"
    const approvedStatus = page.locator('text=Approved, .status-approved, td:has-text("Approved")').first();
    await expect(approvedStatus).toBeVisible();
  });
});
