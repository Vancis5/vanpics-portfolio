// @ts-check
import { test, expect } from '@playwright/test';

const pageErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) || []).toEqual([]);
});

async function waitForGallery(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#hero-identity h1')).toHaveText('vanpics');
  await page.waitForSelector('.masonry-panel[data-category="all"] .photo-card', { timeout: 15000 });
}

async function expectLightboxPhotoRendered(page) {
  const lightboxImg = page.locator('#lightbox-img');

  await expect(lightboxImg).not.toHaveAttribute('src', '');
  await expect.poll(async () => lightboxImg.evaluate((img) => img.naturalWidth), {
    timeout: 10000
  }).toBeGreaterThan(0);
  await expect(lightboxImg).toHaveJSProperty('complete', true);
  await expect(lightboxImg).toHaveCSS('opacity', '1', { timeout: 10000 });
}

async function expectMobileSlideRendered(page, index) {
  const slideImg = page.locator(`.snap-slide[data-idx="${index}"] img`);

  await expect(slideImg).toHaveJSProperty('complete', true);
  await expect.poll(async () => slideImg.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
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
  await expectLightboxPhotoRendered(page);

  await page.locator('#lightbox-close').click();
  await expect(page.locator('#lightbox')).not.toHaveClass(/open/);
});

test('opens a photo from the hash route', async ({ page }) => {
  await page.goto('/#photographs/depths');

  await expect(page.locator('#lightbox')).toHaveClass(/open/, { timeout: 15000 });
  await expect(page.locator('#lightbox-title')).toHaveText('depths');
  await expectLightboxPhotoRendered(page);
});

test.describe('mobile lightbox', () => {
  test('opens and advances the photo lightbox', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Mobile emulation is only supported for this regression in Chromium.');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        if (query.includes('hover: none')) {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() { return false; }
          };
        }

        if (query.includes('hover: hover') || query.includes('pointer: fine')) {
          return {
            matches: false,
            media: query,
            onchange: null,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() { return false; }
          };
        }

        return originalMatchMedia(query);
      };
    });

    await waitForGallery(page);

    await page.locator('.masonry-panel[data-category="all"] .photo-card').first().click();
    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    await expect(page.locator('#lightbox-title')).toHaveText('collateral');
    await expectMobileSlideRendered(page, 0);

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#lightbox-title')).toHaveText('depths', { timeout: 3000 });
    await expectMobileSlideRendered(page, 1);
  });
});
