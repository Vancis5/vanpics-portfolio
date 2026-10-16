// @ts-check
import { test, expect } from '@playwright/test';

function setupApiMocks(page) {
  return Promise.all([
    page.route('**/api/photos*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 1,
              title: 'photo 1-1 long',
              src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23222"%3E%3Crect width="300" height="200"/%3E%3C/svg%3E',
              thumb: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23222"%3E%3Crect width="300" height="200"/%3E%3C/svg%3E',
              aspect_ratio: 1.5,
              category: '',
              location: 'tokyo, japan',
              date: '2026-04-10',
              desc: 'someone crashed their truck onto a wall. lots of people die and crash in this road daily, which is ironic because the highway itself is beautiful. it goes on and on with extra details about the sunset and the mountains in the far distance.',
              hero_slide: true
            },
            {
              id: 2,
              title: 'photo no desc',
              src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23222"%3E%3Crect width="300" height="200"/%3E%3C/svg%3E',
              thumb: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23222"%3E%3Crect width="300" height="200"/%3E%3C/svg%3E',
              aspect_ratio: 1.5,
              category: '',
              location: 'kyoto, japan',
              date: '2026-04-09',
              desc: '',
              hero_slide: true
            }
          ]
        })
      });
    }),
    page.route('**/api/videos*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'motion-1',
              title: 'Motion Project 1',
              aspect_ratio: 1.7777777777777777,
              desc: 'Cinematic reel',
              date: '2026',
              location: 'Tokyo',
              category: 'motion',
              hero_slide: true,
              hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
            }
          ]
        })
      });
    }),
    page.route('**/api/views*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ views: 42 })
      });
    })
  ]);
}

async function waitForGallery(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#hero-identity h1')).toHaveText('vanpics');
  await page.waitForSelector('.masonry-panel[data-category="all"] .photo-card', { timeout: 15000, state: 'attached' });
}

async function openFirstCard(page) {
  await waitForGallery(page);
  const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
  await card.scrollIntoViewIfNeeded();
  await card.click();
}

test.describe('Tablet Portrait Lightbox (iPad Portrait 768x1024)', () => {
  test.setTimeout(60000);
  test.use({
    viewport: { width: 768, height: 1024 },
    hasTouch: true,
    isMobile: true
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await setupApiMocks(page);
  });

  test('1. Lightbox opens in tablet-portrait flow column, close button visible, photo pinned above info', async ({ page }) => {
    await openFirstCard(page);

    const lb = page.locator('#lightbox');
    await expect(lb).toHaveClass(/open/);
    await expect(lb).toHaveAttribute('data-lb-layout', 'tablet-portrait');

    // Close button MUST be visible on tablet
    const closeBtn = page.locator('#lightbox-close');
    await expect(closeBtn).toBeVisible();

    const flexDir = await page.locator('#lightbox-content').evaluate(el => window.getComputedStyle(el).flexDirection);
    expect(flexDir).toBe('column');

    // Photo wrap is in flow and above the info wrap
    const imgWrapBox = await page.locator('#lightbox-img-wrap').boundingBox();
    const infoBox = await page.locator('#lightbox-info-wrap').boundingBox();
    expect(imgWrapBox).not.toBeNull();
    expect(infoBox).not.toBeNull();
    if (imgWrapBox && infoBox) {
      expect(infoBox.y).toBeGreaterThanOrEqual(imgWrapBox.y + imgWrapBox.height - 2);
    }

    // Title is Cormorant Garamond italic
    const title = page.locator('#lightbox-title');
    await expect(title).toBeVisible();
    const fontStyle = await title.evaluate(el => window.getComputedStyle(el).fontStyle);
    expect(fontStyle).toBe('italic');

    // Description has 3-line clamp and more toggle on tablet portrait
    const desc = page.locator('#lightbox-desc');
    await expect(desc).toBeVisible();
    await expect(desc).toHaveClass(/desc-overflow/);

    // Toggle button is visible with 'more' on tablet portrait
    const toggle = page.locator('#lightbox-desc-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText('more');

    // Click toggle expands desc and changes to 'less'
    await toggle.click();
    await expect(desc).toHaveClass(/desc-expanded/);
    await expect(toggle).toHaveText('less');

    // Click toggle collapses desc and changes back to 'more'
    await toggle.click();
    await expect(desc).not.toHaveClass(/desc-expanded/);
    await expect(toggle).toHaveText('more');

    // Meta row is visible
    const meta = page.locator('#lightbox-meta');
    await expect(meta).toBeVisible();

    // Clicking close button dismisses lightbox
    await closeBtn.click();
    await expect(lb).not.toHaveClass(/open/);
  });

  test('2. Photo with no description hides toggle on tablet portrait', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo no desc"]');
    await card.scrollIntoViewIfNeeded();
    await card.click();

    const lb = page.locator('#lightbox');
    await expect(lb).toHaveClass(/open/);
    await expect(lb).toHaveAttribute('data-lb-layout', 'tablet-portrait');

    const toggle = page.locator('#lightbox-desc-toggle');
    await expect(toggle).toBeHidden();
  });

  test('3b. Tapping anywhere in navigation space toggles filmstrip on tablet portrait', async ({ page }) => {
    await openFirstCard(page);

    const lb = page.locator('#lightbox');
    await expect(lb).toHaveClass(/open/);
    const fsWrap = page.locator('#filmstrip-wrap');

    // Wait for initial filmstrip show
    await expect(fsWrap).toHaveClass(/visible/, { timeout: 3000 });

    // 1. Tap on photo image toggles filmstrip off
    const img = page.locator('.snap-slide[data-idx="0"] img:not(.lightbox-swap-overlay)');
    await img.tap();
    await expect(fsWrap).not.toHaveClass(/visible/, { timeout: 2000 });

    // 2. Tap on title toggles filmstrip back on
    const title = page.locator('#lightbox-title');
    await title.tap();
    await expect(fsWrap).toHaveClass(/visible/, { timeout: 2000 });

    // 3. Tap on info dock / meta toggles filmstrip off
    const meta = page.locator('#lightbox-meta');
    await meta.tap();
    await expect(fsWrap).not.toHaveClass(/visible/, { timeout: 2000 });

    // 4. Tap on background toggles filmstrip back on
    await page.touchscreen.tap(100, 100);
    await expect(fsWrap).toHaveClass(/visible/, { timeout: 2000 });
  });

  test('3. Footer on tablet displays brand and bio in balanced 2-column layout', async ({ page }) => {
    await waitForGallery(page);
    const footer = page.locator('#site-footer');
    await footer.scrollIntoViewIfNeeded();

    const cols = page.locator('.footer-columns');
    await expect(cols).toBeVisible();

    const brandBox = await page.locator('.footer-brand').boundingBox();
    const bioBox = await page.locator('.footer-bio').boundingBox();
    expect(brandBox).not.toBeNull();
    expect(bioBox).not.toBeNull();
    if (brandBox && bioBox) {
      expect(Math.abs(brandBox.y - bioBox.y)).toBeLessThan(30);
      expect(bioBox.x).toBeGreaterThan(brandBox.x + brandBox.width);
    }
  });
});

test.describe('Tablet Landscape Lightbox (1024x768)', () => {
  test.setTimeout(60000);
  test.use({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    isMobile: true
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await setupApiMocks(page);
  });

  test('4. Landscape tablet uses 2-column row layout, close button visible, full desc without toggle', async ({ page }) => {
    await openFirstCard(page);

    const lb = page.locator('#lightbox');
    await expect(lb).toHaveClass(/open/);
    await expect(lb).toHaveAttribute('data-lb-layout', 'tablet-landscape');

    const closeBtn = page.locator('#lightbox-close');
    await expect(closeBtn).toBeVisible();

    const flexDir = await page.locator('#lightbox-content').evaluate(el => window.getComputedStyle(el).flexDirection);
    expect(flexDir).toBe('row');

    // Photo on left, info rail on right
    const imgWrapBox = await page.locator('#lightbox-img-wrap').boundingBox();
    const infoWrapBox = await page.locator('#lightbox-info-wrap').boundingBox();
    expect(imgWrapBox).not.toBeNull();
    expect(infoWrapBox).not.toBeNull();
    if (imgWrapBox && infoWrapBox) {
      expect(infoWrapBox.x).toBeGreaterThan(imgWrapBox.x + imgWrapBox.width - 5);
      // Photo width around 60%
      expect(imgWrapBox.width).toBeLessThanOrEqual(1024 * 0.65);
    }

    // Toggle button is hidden in landscape
    const toggle = page.locator('#lightbox-desc-toggle');
    await expect(toggle).toBeHidden();

    // Meta items stacked vertically
    const metaDir = await page.locator('#lightbox-meta').evaluate(el => window.getComputedStyle(el).flexDirection);
    expect(metaDir).toBe('column');
  });

  test('4b. Tapping anywhere in navigation space toggles filmstrip on tablet landscape', async ({ page }) => {
    await openFirstCard(page);

    const lb = page.locator('#lightbox');
    await expect(lb).toHaveClass(/open/);
    const fsWrap = page.locator('#filmstrip-wrap');

    // Wait for initial filmstrip show
    await expect(fsWrap).toHaveClass(/visible/, { timeout: 3000 });

    // 1. Tap on photo image toggles filmstrip off
    const img = page.locator('.snap-slide[data-idx="0"] img:not(.lightbox-swap-overlay)');
    await img.tap();
    await expect(fsWrap).not.toHaveClass(/visible/, { timeout: 2000 });

    // 2. Tap on title in right column toggles filmstrip back on
    const title = page.locator('#lightbox-title');
    await title.tap();
    await expect(fsWrap).toHaveClass(/visible/, { timeout: 2000 });

    // 3. Tap on photo again toggles filmstrip off
    await img.tap();
    await expect(fsWrap).not.toHaveClass(/visible/, { timeout: 2000 });

    // 4. Tap on background toggles filmstrip back on
    await page.touchscreen.tap(100, 100);
    await expect(fsWrap).toHaveClass(/visible/, { timeout: 2000 });
  });
});

test.describe('Orientation switch while lightbox open', () => {
  test.setTimeout(60000);
  test.use({
    viewport: { width: 768, height: 1024 },
    hasTouch: true,
    isMobile: true
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await setupApiMocks(page);
  });

  test('5. Rotating from portrait to landscape and back dynamically updates layout mode', async ({ page }) => {
    await openFirstCard(page);

    const lb = page.locator('#lightbox');
    await expect(lb).toHaveAttribute('data-lb-layout', 'tablet-portrait');
    await expect(page.locator('#lightbox-desc-toggle')).toBeVisible();

    // Rotate to landscape
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(lb).toHaveAttribute('data-lb-layout', 'tablet-landscape');
    await expect(page.locator('#lightbox-desc-toggle')).toBeHidden();

    // Rotate back to portrait
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(lb).toHaveAttribute('data-lb-layout', 'tablet-portrait');
    await expect(page.locator('#lightbox-desc-toggle')).toBeVisible();
  });
});

test.describe('Phone unchanged (390x844 touch)', () => {
  test.setTimeout(60000);
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await setupApiMocks(page);
  });

  test('6. Phone keeps phone layout mode and read more / read less toggle', async ({ page }) => {
    await openFirstCard(page);

    const lb = page.locator('#lightbox');
    await expect(lb).toHaveAttribute('data-lb-layout', 'phone');

    const toggle = page.locator('#lightbox-desc-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText('read more');

    await toggle.click();
    await expect(toggle).toHaveText('read less');
  });
});

test.describe('Desktop unchanged (1440x900 non-touch)', () => {
  test.setTimeout(60000);
  test.use({
    viewport: { width: 1440, height: 900 },
    hasTouch: false,
    isMobile: false
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await setupApiMocks(page);
  });

  test('7. Desktop keeps desktop layout mode and row layout', async ({ page }) => {
    await openFirstCard(page);

    const lb = page.locator('#lightbox');
    await expect(lb).toHaveAttribute('data-lb-layout', 'desktop');

    const flexDir = await page.locator('#lightbox-content').evaluate(el => window.getComputedStyle(el).flexDirection);
    expect(flexDir).toBe('row');

    const toggle = page.locator('#lightbox-desc-toggle');
    await expect(toggle).toBeHidden();
  });
});
