import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Vanpics Portfolio CMS Admin Portal Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to local admin panel (served by Vite)
    await page.goto('http://localhost:5173/admin.html');
  });

  test('Page loads successfully with branding and styling', async ({ page }) => {
    // Assert heading title
    await expect(page.locator('header h1')).toHaveText('vanpics');
    await expect(page.locator('header p')).toHaveText('media archives cms');
    
    // Assert the cataloging card is visible
    await expect(page.locator('.panel-title').first()).toContainText('catalog new media');
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
