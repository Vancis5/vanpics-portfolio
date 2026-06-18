import { test, expect } from '@playwright/test';

test.describe('Vanpics Portfolio CMS Admin Portal Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Mock the admin verification API call
    await page.route('**/api/admin/verify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    // Navigate to main site first to allow setting localStorage on correct origin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('vanpics_admin_token', 'test-token');
    });

    // Navigate to local admin panel (served by Vite)
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
  });

  test('Page loads successfully with branding and styling', async ({ page }) => {
    // Assert heading title
    await expect(page.locator('header h1')).toHaveText('vanpics');
    await expect(page.locator('header p')).toHaveText('darkroom');
    
    // Assert the cataloging card is visible
    await expect(page.locator('.modal-title').first()).toContainText('catalog new media');
  });

  test('Form submission is locked until image is dropped/uploaded', async ({ page }) => {
    const submitBtn = page.locator('#submit-btn');
    // Button should be disabled initially
    await expect(submitBtn).toBeDisabled();
  });

  test('Inputs validate and exist correctly', async ({ page }) => {
    // Check all form inputs are in place
    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('#date')).toBeVisible();
    await expect(page.locator('#location')).toBeVisible();
    await expect(page.locator('#category')).toBeVisible();
    await expect(page.locator('#desc')).toBeVisible();
    await expect(page.locator('#hero-slide')).toBeAttached();
    await expect(page.locator('#secret-token')).toBeVisible();
  });

  test('Access token starts empty', async ({ page }) => {
    const secretInput = page.locator('#secret-token');
    await expect(secretInput).toHaveValue('');
  });
});
