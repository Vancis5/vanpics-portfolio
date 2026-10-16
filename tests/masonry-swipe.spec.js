// @ts-check
import { test, expect } from '@playwright/test';

async function setupApiMocks(page) {
  await page.route('**/*googletagmanager*', (route) => route.abort());

  await page.route('**/api/photos*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 1,
            title: 'photo 1',
            src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23222"%3E%3Crect width="300" height="200"/%3E%3C/svg%3E',
            thumb: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="100" fill="%23222"%3E%3Crect width="150" height="100"/%3E%3C/svg%3E',
            aspect_ratio: 1.5,
            category: '',
            location: 'test city',
            date: '2025-12-28',
          },
          {
            id: 2,
            title: 'photo 2',
            src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23333"%3E%3Crect width="300" height="200"/%3E%3C/svg%3E',
            thumb: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="100" fill="%23333"%3E%3Crect width="150" height="100"/%3E%3C/svg%3E',
            aspect_ratio: 1.5,
            category: 'figures',
            location: 'test city',
            date: '2025-12-28',
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
            title: 'motion project 1',
            thumb: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23444"%3E%3Crect width="300" height="200"/%3E%3C/svg%3E',
            src: 'https://example.com/test.mp4',
            category: 'motion',
            date: '2025-12-28',
            aspectRatio: 1.777
          }
        ]
      })
    });
  });

  await page.route('**/api/views*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ views: 5113 })
    });
  });
}

async function waitForGallery(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#hero-identity h1')).toHaveText('vanpics');
  await page.waitForSelector('.masonry-panel[data-category="all"] .photo-card', { timeout: 15000, state: 'attached' });
}

/**
 * Dispatch a touch swipe gesture using CDP or TouchEvent dispatch on an element
 */
/**
 * Dispatch a touch swipe gesture on an element
 */
async function swipeElement(page, selector, { deltaX, deltaY = 0, offsetY = 0 }) {
  await page.evaluate(({ sel, dX, dY, oY }) => {
    const target = document.querySelector(sel);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + (oY || Math.min(rect.height / 2, 180));
    const endX = startX + dX;
    const endY = startY + dY;

    function dispatchTouch(type, touches, changedTouches) {
      const evt = new CustomEvent(type, { bubbles: true, cancelable: true });
      evt.touches = touches;
      evt.targetTouches = touches;
      evt.changedTouches = changedTouches;
      target.dispatchEvent(evt);
    }

    const tStart = { clientX: startX, clientY: startY, identifier: 1, target };
    dispatchTouch('touchstart', [tStart], [tStart]);

    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const curX = startX + (endX - startX) * (i / steps);
      const curY = startY + (endY - startY) * (i / steps);
      const tMove = { clientX: curX, clientY: curY, identifier: 1, target };
      dispatchTouch('touchmove', [tMove], [tMove]);
    }

    const tEnd = { clientX: endX, clientY: endY, identifier: 1, target };
    dispatchTouch('touchend', [], [tEnd]);
  }, { sel: selector, dX: deltaX, dY: deltaY, oY: offsetY });
}

test.describe('Mobile Masonry Swipe Subnav (390x844)', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });

  test.beforeEach(async ({ page, browserName }) => {
    test.setTimeout(60000);
    test.skip(browserName !== 'chromium', 'Mobile touch swipe emulation runs in Chromium.');
    await setupApiMocks(page);
  });

  test('swiping left and right on masonry toggles subnav categories without opening lightbox', async ({ page }) => {
    await waitForGallery(page);

    // Initial state: photographs (category 'all')
    const photoBtn = page.locator('#gallery-header .photographs-btn');
    const figuresBtn = page.locator('#gallery-header .figures-btn');
    const motionBtn = page.locator('#gallery-header .motion-btn');

    await expect(photoBtn).toHaveClass(/active/);
    await expect(figuresBtn).toHaveClass(/inactive/);

    // Swipe LEFT on masonry: advances to 'figures'
    await swipeElement(page, '#masonry', { deltaX: -100 });
    await expect(figuresBtn).toHaveClass(/active/, { timeout: 4000 });
    await expect(photoBtn).toHaveClass(/inactive/);
    await expect(page).toHaveURL(/#figures$/);

    // Ensure lightbox did NOT open on swipe
    await expect(page.locator('#lightbox')).not.toHaveClass(/open/);

    // Swipe LEFT on masonry again: advances to 'motion'
    await swipeElement(page, '#masonry', { deltaX: -100 });
    await expect(motionBtn).toHaveClass(/active/, { timeout: 4000 });
    await expect(figuresBtn).toHaveClass(/inactive/);
    await expect(page).toHaveURL(/#motion$/);
    await expect(page.locator('#lightbox')).not.toHaveClass(/open/);

    // Verify figures button is inactive and dimmed, not highlighted
    await expect.poll(async () => {
      const figuresColor = await figuresBtn.evaluate(el => window.getComputedStyle(el).color);
      const activeMotionColor = await motionBtn.evaluate(el => window.getComputedStyle(el).color);
      return figuresColor !== activeMotionColor;
    }, { timeout: 3000 }).toBe(true);

    // Test swiping LEFT directly from the motion tab (even in lower screen area) -> wraps to photographs
    await swipeElement(page, '#gallery-section', { deltaX: -100, offsetY: 350 });
    await expect(photoBtn).toHaveClass(/active/, { timeout: 4000 });
    await expect(motionBtn).toHaveClass(/inactive/);
    await expect(figuresBtn).toHaveClass(/inactive/);
    await expect(page).toHaveURL(/#photographs$/);

    // Swipe RIGHT from photographs -> wraps to motion
    await swipeElement(page, '#gallery-section', { deltaX: 100 });
    await expect(motionBtn).toHaveClass(/active/, { timeout: 4000 });
    await expect(photoBtn).toHaveClass(/inactive/);
    await expect(figuresBtn).toHaveClass(/inactive/);

    // Swipe RIGHT on motion: returns to 'figures'
    await swipeElement(page, '#gallery-section', { deltaX: 100, offsetY: 350 });
    await expect(figuresBtn).toHaveClass(/active/, { timeout: 4000 });
    await expect(motionBtn).toHaveClass(/inactive/);
    await expect(page).toHaveURL(/#figures$/);
    await expect(page.locator('#lightbox')).not.toHaveClass(/open/);

    // Swipe RIGHT on figures: returns to 'photographs'
    await swipeElement(page, '#masonry', { deltaX: 100 });
    await expect(photoBtn).toHaveClass(/active/, { timeout: 4000 });
    await expect(figuresBtn).toHaveClass(/inactive/);
    await expect(page).toHaveURL(/#photographs$/);
    await expect(page.locator('#lightbox')).not.toHaveClass(/open/);
  });

  test('predominantly vertical scroll does not switch subnav', async ({ page }) => {
    await waitForGallery(page);

    const photoBtn = page.locator('#gallery-header .photographs-btn');
    await expect(photoBtn).toHaveClass(/active/);

    // Drag mostly vertically (e.g. deltaX: -20, deltaY: -150)
    await swipeElement(page, '#masonry', { deltaX: -20, deltaY: -150 });

    // Should stay on photographs
    await expect(photoBtn).toHaveClass(/active/);
    const figuresBtn = page.locator('#gallery-header .figures-btn');
    await expect(figuresBtn).toHaveClass(/inactive/);
  });

  test('swiping in lightbox and during swipe-down dismiss does not switch subnav categories', async ({ page }) => {
    await waitForGallery(page);

    const photoBtn = page.locator('#gallery-header .photographs-btn');
    const figuresBtn = page.locator('#gallery-header .figures-btn');
    await expect(photoBtn).toHaveClass(/active/);

    // Open first photo card
    const firstCard = page.locator('.masonry-panel[data-category="all"] .photo-card').first();
    await firstCard.click();

    const lb = page.locator('#lightbox');
    await expect(lb).toHaveClass(/open/, { timeout: 4000 });

    // Swiping horizontally inside open lightbox does NOT switch subnav
    await swipeElement(page, '#lightbox', { deltaX: -150 });
    await expect(photoBtn).toHaveClass(/active/);
    await expect(figuresBtn).toHaveClass(/inactive/);

    // Swipe down to dismiss lightbox (with minor horizontal drift)
    await swipeElement(page, '#lightbox', { deltaX: 25, deltaY: 260, offsetY: 120 });

    // Wait for lightbox to completely close and finish transitioning
    await expect(lb).not.toHaveClass(/open/, { timeout: 5000 });
    await expect(lb).not.toHaveClass(/is-closing/, { timeout: 5000 });

    // Verify subnav is still on photographs and figures was NOT switched or highlighted
    await expect(photoBtn).toHaveClass(/active/);
    await expect(figuresBtn).toHaveClass(/inactive/);
    await expect(page).toHaveURL(/(#photographs)?$/);
  });

  test('swiping on gallery header does not switch subnav categories', async ({ page }) => {
    await waitForGallery(page);

    const photoBtn = page.locator('#gallery-header .photographs-btn');
    const figuresBtn = page.locator('#gallery-header .figures-btn');
    await expect(photoBtn).toHaveClass(/active/);

    // Swipe directly on header
    await swipeElement(page, '#gallery-header', { deltaX: -100 });
    await expect(photoBtn).toHaveClass(/active/);
    await expect(figuresBtn).toHaveClass(/inactive/);
  });

  test('swiping down a motion video to dismiss does not switch to figures', async ({ page }) => {
    await waitForGallery(page);

    const motionBtn = page.locator('#gallery-header .motion-btn');
    const figuresBtn = page.locator('#gallery-header .figures-btn');
    await motionBtn.click();
    await expect(motionBtn).toHaveClass(/active/);

    const motionCard = page.locator('.masonry-panel[data-category="motion"] .photo-card').first();
    await motionCard.click();

    const lb = page.locator('#lightbox');
    await expect(lb).toHaveClass(/open/, { timeout: 4000 });
    await expect(lb).toHaveClass(/mode-motion/);

    // Swipe down to dismiss motion video (with slight natural right-hand curve deltaX: 40, deltaY: 260)
    await swipeElement(page, '#motion-player-shell', { deltaX: 40, deltaY: 260, offsetY: 100 });

    // Wait for lightbox to completely close
    await expect(lb).not.toHaveClass(/open/, { timeout: 5000 });
    await expect(lb).not.toHaveClass(/is-closing/, { timeout: 5000 });

    // Assert that we are still in motion and NEVER switched to figures!
    await expect(motionBtn).toHaveClass(/active/);
    await expect(figuresBtn).toHaveClass(/inactive/);
    await expect(page).toHaveURL(/#motion$/);
  });

  test('swiping subnav from figures to motion, opening video, and swiping down to dismiss stays on motion', async ({ page }) => {
    await waitForGallery(page);

    const figuresBtn = page.locator('#gallery-header .figures-btn');
    const motionBtn = page.locator('#gallery-header .motion-btn');

    // Swipe left from photographs -> figures
    await swipeElement(page, '#masonry', { deltaX: -120 });
    await expect(figuresBtn).toHaveClass(/active/, { timeout: 4000 });

    // Swipe left from figures -> motion
    await swipeElement(page, '#masonry', { deltaX: -120 });
    await expect(motionBtn).toHaveClass(/active/, { timeout: 4000 });

    // Open video
    const motionCard = page.locator('.masonry-panel[data-category="motion"] .photo-card').first();
    await motionCard.click();

    const lb = page.locator('#lightbox');
    await expect(lb).toHaveClass(/open/, { timeout: 4000 });
    await expect(lb).toHaveClass(/mode-motion/);

    // Swipe down to dismiss motion video
    await swipeElement(page, '#motion-player-shell', { deltaX: 30, deltaY: 280, offsetY: 100 });

    // Wait for lightbox to completely close
    await expect(lb).not.toHaveClass(/open/, { timeout: 5000 });
    await expect(lb).not.toHaveClass(/is-closing/, { timeout: 5000 });

    // Category MUST still be motion and NOT teleport back to figures
    await expect(motionBtn).toHaveClass(/active/);
    await expect(figuresBtn).toHaveClass(/inactive/);
    await expect(page).toHaveURL(/#motion$/);
  });
});

test.describe('Tablet Masonry Swipe Subnav (768x1024)', () => {
  test.use({
    viewport: { width: 768, height: 1024 },
    hasTouch: true,
    isMobile: true
  });

  test.beforeEach(async ({ page, browserName }) => {
    test.setTimeout(60000);
    test.skip(browserName !== 'chromium', 'Tablet touch swipe emulation runs in Chromium.');
    await setupApiMocks(page);
  });

  test('swiping on tablet toggles subnav categories', async ({ page }) => {
    await waitForGallery(page);

    const photoBtn = page.locator('#gallery-header .photographs-btn');
    const figuresBtn = page.locator('#gallery-header .figures-btn');

    await expect(photoBtn).toHaveClass(/active/);

    // Swipe left
    await swipeElement(page, '#masonry', { deltaX: -120 });
    await expect(figuresBtn).toHaveClass(/active/, { timeout: 4000 });
    await expect(photoBtn).toHaveClass(/inactive/);

    // Swipe right
    await swipeElement(page, '#masonry', { deltaX: 120 });
    await expect(photoBtn).toHaveClass(/active/, { timeout: 4000 });
    await expect(figuresBtn).toHaveClass(/inactive/);
  });
});
