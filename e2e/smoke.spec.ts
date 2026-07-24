import { test, expect } from '@playwright/test';

test.describe('smoke: home + auth flow', () => {
  test('home page loads with 200', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/.+/);
  });

  test('protected API rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/users');
    expect([401, 403, 307, 308]).toContain(res.status());
  });

  test('login as passenger redirects away from /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('name@example.com').fill('passenger@bus.et');
    await page.getByPlaceholder('Enter your password').fill('bus@12345');
    await page.getByRole('button', { name: /sign in|login|log in/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });
    expect(page.url()).not.toMatch(/\/login/);
  });
});
