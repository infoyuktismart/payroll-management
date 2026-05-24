import { test, expect } from '@playwright/test';

test.describe('E2E Authentication Flow', () => {
  test('should log in successfully with test credentials and redirect to dashboard', async ({ page }) => {
    // 1. Navigate to /login
    await page.goto('/login');

    // 2. Fill email and password from environment
    const email = process.env.TEST_USER_EMAIL || 'admin@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'Password123';

    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);

    // 3. Click submit
    await page.locator('button[type="submit"]').click();

    // 4. Assert URL becomes /dashboard
    await expect(page).toHaveURL(/.*dashboard/);

    // 5. Assert dashboard heading or core layout element is visible
    const dashboardHeading = page.locator('h1, h2, [data-testid="dashboard-title"]').first();
    await expect(dashboardHeading).toBeVisible();
  });
});
