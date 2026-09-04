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

  // Mock API calls to ensure stable, hermetic test environment independent of production data
  await page.route('**/api/photos*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 1,
            title: 'collateral',
            src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23222"%3E%3Crect width="300" height="200"/%3E%3C/svg%3E',
            thumb: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="100" fill="%23222"%3E%3Crect width="150" height="100"/%3E%3C/svg%3E',
            aspect_ratio: 1.5,
            category: 'landscape',
            location: 'tokyo, japan',
            date: '2025-12-28',
            desc: 'collateral desc',
            hero_slide: true,
            created_at: '2025-12-28T00:00:00Z'
          },
          {
            id: 2,
            title: 'depths',
            src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23222"%3E%3Crect width="300" height="200"/%3E%3C/svg%3E',
            thumb: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="100" fill="%23222"%3E%3Crect width="150" height="100"/%3E%3C/svg%3E',
            aspect_ratio: 1.5,
            category: 'landscape',
            location: 'kyoto, japan',
            date: '2025-12-27',
            desc: 'depths desc',
            hero_slide: true,
            created_at: '2025-12-27T00:00:00Z'
          }
        ]
      })
    });
  });

  await page.route('**/api/videos*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 10,
            title: 'motion video',
            src: 'https://example.com/video.mp4',
            poster: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23222"%3E%3Crect width="300" height="200"/%3E%3C/svg%3E',
            aspect_ratio: 1.777,
            location: 'osaka, japan',
            date: '2025-12-30',
            desc: 'motion desc',
            music: 'ambient track',
            created_at: '2025-12-30T00:00:00Z'
          }
        ]
      })
    });
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

test('navigates lightbox using keyboard arrow keys', async ({ page }) => {
  await waitForGallery(page);

  // Open the first photo (collateral)
  await page.locator('.masonry-panel[data-category="all"] .photo-card').first().click();
  await expect(page.locator('#lightbox')).toHaveClass(/open/);
  await expect(page.locator('#lightbox-title')).toHaveText('collateral');

  // Press ArrowRight to go to the next photo (depths)
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#lightbox-title')).toHaveText('depths');

  // Press ArrowLeft to go back to the first photo (collateral)
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#lightbox-title')).toHaveText('collateral');
});

test('fades out scroll hint when scrolled down', async ({ page }) => {
  await waitForGallery(page);
  const scrollHint = page.locator('#scroll-hint');
  await expect(scrollHint).not.toHaveClass(/faded-out/);

  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await expect(scrollHint).toHaveClass(/faded-out/);
});

test('expands custom cursor ring when hovering over lightbox side buttons', async ({ page }) => {
  await waitForGallery(page);
  await page.locator('.masonry-panel[data-category="all"] .photo-card').first().click();
  await expect(page.locator('#lightbox')).toHaveClass(/open/);

  const leftArrow = page.locator('#lightbox-nav-arrow-left');
  await leftArrow.hover({ force: true });

  const cursorRing = page.locator('#cursor-ring');
  await expect(cursorRing).toHaveCSS('transform', /(?:scale\(1\.57\)|matrix\(1\.(?:5[4-9]|6))/);
});



