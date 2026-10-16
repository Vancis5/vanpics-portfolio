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

test('desktop lightbox close button hides on idle and reappears on cursor move, and side glow fades on viewport leave', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit on Linux reports hover: none');
  await waitForGallery(page);
  await page.locator('.masonry-panel[data-category="all"] .photo-card').first().click();
  await expect(page.locator('#lightbox')).toHaveClass(/open/);

  const closeBtn = page.locator('#lightbox-close');
  await page.mouse.move(400, 300);
  await expect(closeBtn).not.toHaveClass(/idle-hidden/);

  // After idle delay (2800ms without cursor movement), close button hides
  await expect(closeBtn).toHaveClass(/idle-hidden/, { timeout: 6000 });

  // Move cursor around, close button should reappear
  await page.mouse.move(450, 350);
  await expect(closeBtn).not.toHaveClass(/idle-hidden/);

  // Test side glow near left edge
  await page.mouse.move(50, 400);
  const glowLeft = page.locator('#lightbox-glow-left');
  await expect.poll(async () => {
    return parseFloat(await glowLeft.evaluate(el => el.style.opacity || '0'));
  }, { timeout: 3000 }).toBeGreaterThan(0.05);

  // Move cursor outside the viewport
  await page.mouse.move(-10, -10);

  // Side glow should fade to 0
  await expect.poll(async () => {
    return parseFloat(await glowLeft.evaluate(el => el.style.opacity || '0'));
  }, { timeout: 1500 }).toBeLessThan(0.02);

  // Close lightbox
  await page.keyboard.press('Escape');
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
  await expect(cursorRing).toHaveCSS('scale', /(?:1\.57|1\.(?:5[4-9]|6))/);
});

test('stretches and shifts cursor ring in direction of filmstrip mouse wheel scroll', async ({ page }) => {
  await waitForGallery(page);
  await page.locator('.masonry-panel[data-category="all"] .photo-card').first().click();
  await expect(page.locator('#lightbox')).toHaveClass(/open/);

  const filmstripWrap = page.locator('#filmstrip-wrap');
  await filmstripWrap.hover();
  await expect(filmstripWrap).toHaveClass(/visible/);

  const cursorRing = page.locator('#cursor-ring');

  // Scroll mouse wheel DOWN (opposite direction -> shifts negative/left and stretches width)
  await page.mouse.wheel(0, 120);

  await expect.poll(async () => {
    return await cursorRing.evaluate(el => {
      const w = parseFloat(el.style.width || '28');
      const match = (el.style.transform || '').match(/translate3d\(-([0-9.]+)px/);
      if (!match) return false;
      const x = parseFloat(match[1]);
      const cs = window.getComputedStyle(el);
      const uniformBorder = cs.borderTopWidth === cs.borderLeftWidth && cs.borderTopWidth === cs.borderBottomWidth;
      return w > 32 && x > 2 && uniformBorder;
    });
  }, { timeout: 3000 }).toBe(true);

  // Scroll mouse wheel UP (opposite direction -> shifts positive/right and stretches width)
  await page.mouse.wheel(0, -140);

  await expect.poll(async () => {
    return await cursorRing.evaluate(el => {
      const w = parseFloat(el.style.width || '28');
      const match = (el.style.transform || '').match(/translate3d\(([0-9.]+)px/);
      if (!match) return false;
      const x = parseFloat(match[1]);
      const cs = window.getComputedStyle(el);
      const uniformBorder = cs.borderTopWidth === cs.borderLeftWidth && cs.borderTopWidth === cs.borderBottomWidth;
      return w > 32 && x > 2 && uniformBorder;
    });
  }, { timeout: 3000 }).toBe(true);

  // Returns smoothly to neutral circular ring when wheel stops
  await expect.poll(async () => {
    return await cursorRing.evaluate(el => el.style.transform || '');
  }, { timeout: 3000 }).toBe('');

  // Programmatic scroll (e.g. filmstrip resetting/drifting back) must NOT stretch the cursor
  await page.evaluate(() => {
    const fs = document.getElementById('filmstrip');
    if (fs) fs.scrollLeft = 200;
  });
  await page.waitForTimeout(100);
  expect(await cursorRing.evaluate(el => el.style.transform || '')).toBe('');
  expect(await cursorRing.evaluate(el => el.style.width || '')).toBe('');
});

test('subnav maintains sticky alignment without shifting on tab click', async ({ page }) => {
  await waitForGallery(page);

  // Scroll down so gallery is stuck
  await page.evaluate(() => {
    const lenis = window.lenis;
    if (lenis) lenis.scrollTo(1200, { immediate: true });
    else window.scrollTo(0, 1200);
  });
  await page.waitForTimeout(300);

  const getSubnavTop = async () => {
    return await page.evaluate(() => {
      const h = document.querySelector('#gallery-header');
      return h ? h.getBoundingClientRect().top : -1;
    });
  };

  expect(Math.abs(await getSubnavTop())).toBeLessThanOrEqual(1);

  // Click figures button
  await page.locator('#gallery-header .figures-btn').click();
  await page.waitForTimeout(200);
  expect(Math.abs(await getSubnavTop())).toBeLessThanOrEqual(1);

  // Click motion button
  await page.locator('#gallery-header .motion-btn').click();
  await page.waitForTimeout(200);
  expect(Math.abs(await getSubnavTop())).toBeLessThanOrEqual(1);

  // Click photographs button
  await page.locator('#gallery-header .photographs-btn').click();
  await page.waitForTimeout(200);
  expect(Math.abs(await getSubnavTop())).toBeLessThanOrEqual(1);
});
