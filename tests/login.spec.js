import { test, expect } from '@playwright/test';

test.describe('Login Page Security & UX Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Clear storage to prevent auto-redirect
    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/login.html', { waitUntil: 'domcontentloaded' });
  });

  test('Input has correct accessibility attributes and starts with no error', async ({ page }) => {
    const input = page.locator('#login-secret-token');
    const errorMsg = page.locator('#login-error-msg');
    const inputWrapper = page.locator('.login-input-wrapper');

    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'password');
    await expect(input).toHaveAttribute('autocomplete', 'current-password');
    await expect(input).toHaveAttribute('aria-describedby', 'login-error-msg');
    await expect(input).toHaveAttribute('aria-invalid', 'false');
    await expect(errorMsg).toHaveAttribute('role', 'alert');
    await expect(inputWrapper).not.toHaveClass(/has-error/);
  });

  test('Password toggle switches input type and aria-label', async ({ page }) => {
    const input = page.locator('#login-secret-token');
    const toggleBtn = page.locator('#login-toggle-password-btn');

    await expect(input).toHaveAttribute('type', 'password');
    await expect(toggleBtn).toHaveAttribute('aria-label', 'Show password');

    await toggleBtn.click();
    await expect(input).toHaveAttribute('type', 'text');
    await expect(toggleBtn).toHaveAttribute('aria-label', 'Hide password');

    await toggleBtn.click();
    await expect(input).toHaveAttribute('type', 'password');
    await expect(toggleBtn).toHaveAttribute('aria-label', 'Show password');
  });

  test('Handles 401 invalid token with error styling and clears error on typing', async ({ page }) => {
    await page.route('**/api/admin/verify*', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unauthorized: invalid admin token' })
      });
    });

    const input = page.locator('#login-secret-token');
    const inputWrapper = page.locator('.login-input-wrapper');
    const submitBtn = page.locator('#btn-login-submit');
    const errorMsg = page.locator('#login-error-msg');

    await input.fill('wrong-token');
    await submitBtn.click();

    await expect(errorMsg).toHaveText('unauthorized: invalid admin token');
    await expect(inputWrapper).toHaveClass(/has-error/);
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    // Typing new character should clear the error state immediately
    await input.press('Backspace');
    await expect(errorMsg).toHaveText('');
    await expect(inputWrapper).not.toHaveClass(/has-error/);
    await expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  test('Handles 429 rate limit with live countdown lockout', async ({ page }) => {
    await page.route('**/api/admin/verify*', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'too many login attempts. security lockout active for 2 seconds.' })
      });
    });

    const input = page.locator('#login-secret-token');
    const inputWrapper = page.locator('.login-input-wrapper');
    const submitBtn = page.locator('#btn-login-submit');
    const errorMsg = page.locator('#login-error-msg');

    await input.fill('brute-force');
    await submitBtn.click();

    // Lockout countdown starts
    await expect(errorMsg).toContainText('security lockout active: retry in');
    await expect(inputWrapper).toHaveClass(/has-error/);
    await expect(submitBtn).toBeDisabled();

    // Wait for lockout timer (2s) to expire
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await expect(errorMsg).toHaveText('');
    await expect(inputWrapper).not.toHaveClass(/has-error/);
  });

  test('Passes remember header and saves token to localStorage when checked', async ({ page }) => {
    let requestedUrl = '';
    let requestHeaders: Record<string, string> = {};

    await page.route('**/api/admin/verify*', async (route) => {
      requestedUrl = route.request().url();
      requestHeaders = route.request().headers();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, token: 'mock-jwt-token' })
      });
    });

    const input = page.locator('#login-secret-token');
    const rememberCheckbox = page.locator('#login-remember-token');
    const submitBtn = page.locator('#btn-login-submit');

    await input.fill('correct-token');
    await rememberCheckbox.check();
    await submitBtn.click();

    // Verify remember flag was sent to worker
    expect(requestedUrl).toContain('remember=true');
    expect(requestHeaders['x-remember']).toBe('true');

    // Wait for redirect to admin.html
    await expect(page).toHaveURL(/admin\.html/);

    // Verify token stored in localStorage
    const savedToken = await page.evaluate(() => localStorage.getItem('vanpics_admin_token'));
    expect(savedToken).toBe('mock-jwt-token');
  });

});
