// @ts-check
import { test, expect } from '@playwright/test';

async function waitForGallery(page) {
  await page.goto('/');
  await expect(page.locator('#hero-identity h1')).toHaveText('vanpics');
  await page.waitForSelector('.masonry-panel[data-category="all"] .photo-card', { timeout: 15000 });
}

test('loads the portfolio gallery', async ({ page }) => {
  await waitForGallery(page);

  await expect(page).toHaveTitle(/vanpics/);
  await expect(page.locator('#gallery-header .photographs-btn')).toHaveClass(/active/);
  await expect(page.locator('.masonry-panel[data-category="all"] .photo-card').first()).toBeAttached();
});

test('switches gallery categories', async ({ page }) => {
  await waitForGallery(page);

  await page.locator('#gallery-header .figures-btn').click();
  await expect(page.locator('#gallery-header .figures-btn')).toHaveClass(/active/);
  await expect(page).toHaveURL(/#figures$/);

  await page.locator('#gallery-header .motion-btn').click();
  await expect(page.locator('#gallery-header .motion-btn')).toHaveClass(/active/);
  await expect(page).toHaveURL(/#motion$/);
  await expect(page.locator('.masonry-panel[data-category="motion"] .motion-card').first()).toBeAttached();
});

test('opens and closes a photo lightbox', async ({ page }) => {
  await waitForGallery(page);

  await page.locator('.masonry-panel[data-category="all"] .photo-card').first().click();
  await expect(page.locator('#lightbox')).toHaveClass(/open/);
  await expect(page.locator('#lightbox-title')).not.toBeEmpty();

  await page.locator('#lightbox-close').click();
  await expect(page.locator('#lightbox')).not.toHaveClass(/open/);
});

test('opens a photo from the hash route', async ({ page }) => {
  await page.goto('/#photographs/depths');

  await expect(page.locator('#lightbox')).toHaveClass(/open/, { timeout: 15000 });
  await expect(page.locator('#lightbox-title')).toHaveText('depths');
});
