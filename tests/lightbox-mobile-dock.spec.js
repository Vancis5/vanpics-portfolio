// @ts-check
import { test, expect, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Mock photo dataset with items covering:
// - no description
// - a one-liner
// - a two-liner
// - a ~271 character description
// across 1:1, 4:5, and 16:9 ratios, plus a bright white photo for visual scrim inspection.
const LONG_DESC = "someone crashed their truck onto a wall. lots of people die and crash in this road daily, which is ironic because the highway itself is beautiful <br> <br> taken by <a href='https://www.facebook.com/share/p/1aePoJX4dk/' target='_blank' rel='noopener noreferrer'>JohnB</a>";

const SVG_DARK = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23222"%3E%3Crect width="300" height="200"/%3E%3C/svg%3E';
const SVG_BRIGHT = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23ffffff"%3E%3Crect width="300" height="200"/%3E%3C/svg%3E';

const mockPhotos = [
  // 1:1 Aspect Ratio
  {
    id: 1,
    title: 'photo 1-1 long',
    src: SVG_DARK,
    thumb: SVG_DARK,
    aspect_ratio: 1.0,
    category: '',
    location: 'tokyo, japan',
    date: '2026-04-10',
    desc: LONG_DESC,
    hero_slide: true
  },
  {
    id: 2,
    title: 'photo 1-1 two-liner',
    src: SVG_DARK,
    thumb: SVG_DARK,
    aspect_ratio: 1.0,
    category: '',
    location: 'osaka, japan',
    date: '2026-04-09',
    desc: 'first line of text here.<br>second line wraps slightly longer.',
    hero_slide: true
  },
  {
    id: 3,
    title: 'photo 1-1 one-liner',
    src: SVG_DARK,
    thumb: SVG_DARK,
    aspect_ratio: 1.0,
    category: '',
    location: 'kyoto, japan',
    date: '2026-04-08',
    desc: 'short single line description.',
    hero_slide: true
  },
  {
    id: 4,
    title: 'photo 1-1 no-desc',
    src: SVG_DARK,
    thumb: SVG_DARK,
    aspect_ratio: 1.0,
    category: '',
    location: 'nara, japan',
    date: '2026-04-07',
    desc: '',
    hero_slide: true
  },

  // 4:5 Aspect Ratio (0.8)
  {
    id: 5,
    title: 'photo 4-5 long',
    src: SVG_DARK,
    thumb: SVG_DARK,
    aspect_ratio: 0.8,
    category: '',
    location: 'cebu, philippines',
    date: '2026-04-06',
    desc: LONG_DESC,
    hero_slide: true
  },
  {
    id: 6,
    title: 'photo 4-5 two-liner',
    src: SVG_DARK,
    thumb: SVG_DARK,
    aspect_ratio: 0.8,
    category: '',
    location: 'manila, philippines',
    date: '2026-04-05',
    desc: 'tall portrait view showing two lines of caption.<br>and here is line two.',
    hero_slide: true
  },
  {
    id: 7,
    title: 'photo 4-5 one-liner',
    src: SVG_DARK,
    thumb: SVG_DARK,
    aspect_ratio: 0.8,
    category: '',
    location: 'bohol, philippines',
    date: '2026-04-04',
    desc: 'one line portrait caption.',
    hero_slide: true
  },
  {
    id: 8,
    title: 'photo 4-5 no-desc',
    src: SVG_DARK,
    thumb: SVG_DARK,
    aspect_ratio: 0.8,
    category: '',
    location: 'siargao, philippines',
    date: '2026-04-03',
    desc: '',
    hero_slide: true
  },

  // 16:9 Aspect Ratio (1.777)
  {
    id: 9,
    title: 'photo 16-9 long',
    src: SVG_DARK,
    thumb: SVG_DARK,
    aspect_ratio: 1.7777777777777777,
    category: '',
    location: 'seoul, korea',
    date: '2026-04-02',
    desc: LONG_DESC,
    hero_slide: true
  },
  {
    id: 10,
    title: 'photo 16-9 two-liner',
    src: SVG_DARK,
    thumb: SVG_DARK,
    aspect_ratio: 1.7777777777777777,
    category: '',
    location: 'busan, korea',
    date: '2026-04-01',
    desc: 'wide screen cinematic image caption.<br>line two accompanies the shot.',
    hero_slide: true
  },
  {
    id: 11,
    title: 'photo 16-9 one-liner',
    src: SVG_DARK,
    thumb: SVG_DARK,
    aspect_ratio: 1.7777777777777777,
    category: '',
    location: 'incheon, korea',
    date: '2026-03-31',
    desc: 'wide single line caption.',
    hero_slide: true
  },
  {
    id: 12,
    title: 'photo 16-9 no-desc',
    src: SVG_DARK,
    thumb: SVG_DARK,
    aspect_ratio: 1.7777777777777777,
    category: '',
    location: 'jeju, korea',
    date: '2026-03-30',
    desc: '',
    hero_slide: true
  },

  // Bright mostly-white image for human review screenshot
  {
    id: 13,
    title: 'photo bright long',
    src: SVG_BRIGHT,
    thumb: SVG_BRIGHT,
    aspect_ratio: 1.3333,
    category: '',
    location: 'snow peak',
    date: '2026-03-29',
    desc: LONG_DESC,
    hero_slide: true
  }
];

function setupApiMocks(page) {
  return Promise.all([
    page.route('**/api/photos*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: mockPhotos })
      });
    }),
    page.route('**/api/videos*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] })
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
  await page.waitForSelector('.masonry-panel[data-category="all"] .photo-card', { timeout: 15000 });
}

/**
 * Helper that returns getBoundingClientRect() for key elements:
 * photo, title, toggle, meta, infoWrap, filmstrip, and bottomRow.
 */
async function getElementsRects(page, slideIdx = 0) {
  return await page.evaluate((idx) => {
    const isMobile = window.matchMedia('(hover: none)').matches;
    let photoEl = null;
    if (isMobile) {
      const activeIdx = (window.state && typeof window.state.cur === 'number') ? window.state.cur : idx;
      photoEl = document.querySelector(`.snap-slide[data-idx="${activeIdx}"] .snap-slide-inner`) ||
                document.querySelector(`.snap-slide[data-idx="${activeIdx}"] img`) ||
                document.getElementById('lightbox-img');
    } else {
      photoEl = document.getElementById('lightbox-img');
    }
    const titleEl = document.getElementById('lightbox-title');
    const toggleEl = document.getElementById('lightbox-desc-toggle');
    const metaEl = document.getElementById('lightbox-meta');
    const infoWrapEl = document.getElementById('lightbox-info-wrap');
    const filmstripEl = document.getElementById('filmstrip');
    const bottomRowEl = document.getElementById('lightbox-bottom-row');

    const toRect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        width: r.width,
        height: r.height
      };
    };

    return {
      photo: toRect(photoEl),
      title: toRect(titleEl),
      toggle: toRect(toggleEl),
      meta: toRect(metaEl),
      infoWrap: toRect(infoWrapEl),
      filmstrip: toRect(filmstripEl),
      bottomRow: toRect(bottomRowEl)
    };
  }, slideIdx);
}

const pixel5 = devices['Pixel 5'];

test.describe('Mobile Lightbox Info Dock Redesign', () => {
  test.setTimeout(60000);
  test.use({
    viewport: pixel5.viewport,
    userAgent: pixel5.userAgent,
    deviceScaleFactor: pixel5.deviceScaleFactor,
    isMobile: true,
    hasTouch: true
  });

  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Pixel 5 mobile emulation runs in Chromium.');
    await setupApiMocks(page);
  });

  test('1. No scrim when collapsed', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await card.scrollIntoViewIfNeeded();
    await card.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    await expect(page.locator('#lightbox-title')).toHaveText('photo 1-1 long');

    const scrimStyles = await page.evaluate(() => {
      const wrap = document.getElementById('lightbox-info-wrap');
      if (!wrap) return null;
      const wrapStyle = window.getComputedStyle(wrap);
      const beforeStyle = window.getComputedStyle(wrap, '::before');
      return {
        wrapBgImage: wrapStyle.backgroundImage,
        beforeOpacity: beforeStyle.opacity
      };
    });

    expect(scrimStyles.wrapBgImage).toBe('none');
    expect(scrimStyles.beforeOpacity).toBe('0');
  });

  test('2. No gap above the filmstrip', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await card.scrollIntoViewIfNeeded();
    await card.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    await expect(page.locator('#filmstrip-wrap')).toHaveClass(/visible/);

    const rects = await getElementsRects(page, 0);
    expect(rects.bottomRow).not.toBeNull();
    expect(rects.filmstrip).not.toBeNull();

    // The bottom edge of #lightbox-bottom-row is within 24px of the top edge of filmstrip thumbs
    const gap = rects.filmstrip.top - rects.bottomRow.bottom;
    expect(Math.abs(gap)).toBeLessThanOrEqual(24);
  });

  test('3. Expand is stable: photo, toggle, and meta rects identical collapsed vs expanded', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await card.scrollIntoViewIfNeeded();
    await card.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    const toggle = page.locator('#lightbox-desc-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText('read more');

    const collapsedRects = await getElementsRects(page, 0);

    // Tap toggle to expand
    await toggle.tap();
    await expect(toggle).toHaveText('read less');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#lightbox-content')).toHaveClass(/desc-open/);

    // Wait for transition to settle
    await page.waitForTimeout(450);

    const expandedRects = await getElementsRects(page, 0);

    // Photo rect identical (tolerance 1px)
    expect(expandedRects.photo.x).toBeCloseTo(collapsedRects.photo.x, 1);
    expect(expandedRects.photo.y).toBeCloseTo(collapsedRects.photo.y, 1);
    expect(expandedRects.photo.width).toBeCloseTo(collapsedRects.photo.width, 1);
    expect(expandedRects.photo.height).toBeCloseTo(collapsedRects.photo.height, 1);

    // Toggle rect identical (tolerance 1px)
    expect(expandedRects.toggle.x).toBeCloseTo(collapsedRects.toggle.x, 1);
    expect(expandedRects.toggle.y).toBeCloseTo(collapsedRects.toggle.y, 1);

    // Meta rect identical (tolerance 1px)
    expect(expandedRects.meta.x).toBeCloseTo(collapsedRects.meta.x, 1);
    expect(expandedRects.meta.y).toBeCloseTo(collapsedRects.meta.y, 1);

    // Scrim ::before opacity is 1
    const beforeOpacity = await page.evaluate(() => {
      const wrap = document.getElementById('lightbox-info-wrap');
      return window.getComputedStyle(wrap, '::before').opacity;
    });
    expect(beforeOpacity).toBe('1');

    // Filmstrip wrap no longer has visible class
    await expect(page.locator('#filmstrip-wrap')).not.toHaveClass(/visible/);
  });

  test('4. Stable DURING the transition (sampling every animation frame for 600ms)', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await card.scrollIntoViewIfNeeded();
    await card.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    const toggle = page.locator('#lightbox-desc-toggle');
    await expect(toggle).toBeVisible();

    // Sample toggle rect and photo rect every animation frame for 600ms
    const samples = await page.evaluate(async (idx) => {
      const btn = document.getElementById('lightbox-desc-toggle');
      const activeIdx = (window.state && typeof window.state.cur === 'number') ? window.state.cur : idx;
      const photo = document.querySelector(`.snap-slide[data-idx="${activeIdx}"] .snap-slide-inner`) ||
                    document.querySelector(`.snap-slide[data-idx="${activeIdx}"] img`);

      const initialToggleY = btn ? btn.getBoundingClientRect().y : 0;
      const initialPhotoY = photo ? photo.getBoundingClientRect().y : 0;

      // Tap toggle to trigger expand
      btn.click();

      const records = [];
      const startTime = performance.now();

      return new Promise((resolve) => {
        function sampleFrame() {
          const now = performance.now();
          const tr = btn ? btn.getBoundingClientRect() : { y: 0 };
          const pr = photo ? photo.getBoundingClientRect() : { y: 0 };

          records.push({
            time: Math.round(now - startTime),
            diffToggle: Math.abs(tr.y - initialToggleY),
            diffPhoto: Math.abs(pr.y - initialPhotoY)
          });

          if (now - startTime < 600) {
            requestAnimationFrame(sampleFrame);
            setTimeout(sampleFrame, 16);
          } else {
            resolve(records);
          }
        }
        requestAnimationFrame(sampleFrame);
      });
    }, 0);

    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      expect(sample.diffToggle, `Toggle shifted at ${sample.time}ms`).toBeLessThanOrEqual(1);
      expect(sample.diffPhoto, `Photo shifted at ${sample.time}ms`).toBeLessThanOrEqual(1);
    }
  });

  test('5. Collapse reverses: rects return to originals, scrim opacity returns to 0, filmstrip returns', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await card.scrollIntoViewIfNeeded();
    await card.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    const toggle = page.locator('#lightbox-desc-toggle');
    await expect(toggle).toBeVisible();

    const initialRects = await getElementsRects(page, 0);

    // Expand
    await toggle.tap();
    await expect(toggle).toHaveText('read less');
    await page.waitForTimeout(400);

    // Collapse
    await toggle.tap();
    await expect(toggle).toHaveText('read more');
    await page.waitForTimeout(400);

    const reCollapsedRects = await getElementsRects(page, 0);

    expect(reCollapsedRects.photo.y).toBeCloseTo(initialRects.photo.y, 1);
    expect(reCollapsedRects.toggle.y).toBeCloseTo(initialRects.toggle.y, 1);

    const beforeOpacity = await page.evaluate(() => {
      const wrap = document.getElementById('lightbox-info-wrap');
      return window.getComputedStyle(wrap, '::before').opacity;
    });
    expect(beforeOpacity).toBe('0');

    await expect(page.locator('#filmstrip-wrap')).toHaveClass(/visible/);
  });

  test('6. Toggle only on overflow: no-desc and one-liner photos hide toggle, long photo shows toggle', async ({ page }) => {
    await waitForGallery(page);

    // One-liner photo
    const oneLinerCard = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 one-liner"]');
    await oneLinerCard.scrollIntoViewIfNeeded();
    await oneLinerCard.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    await expect(page.locator('#lightbox-title')).toHaveText('photo 1-1 one-liner');
    await expect(page.locator('#lightbox-desc-toggle')).toHaveClass(/no-desc/);
    await expect(page.locator('#lightbox-desc-toggle')).not.toBeVisible();

    // Close lightbox via Escape key
    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).not.toHaveClass(/open/);

    // No-desc photo
    const noDescCard = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 no-desc"]');
    await noDescCard.scrollIntoViewIfNeeded();
    await noDescCard.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    await expect(page.locator('#lightbox-title')).toHaveText('photo 1-1 no-desc');
    await expect(page.locator('#lightbox-desc')).toHaveClass(/is-empty/);
    await expect(page.locator('#lightbox-desc-toggle')).toHaveClass(/no-desc/);
    await expect(page.locator('#lightbox-desc-toggle')).not.toBeVisible();

    // Close lightbox via Escape key
    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).not.toHaveClass(/open/);

    // Long photo
    const longCard = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await longCard.scrollIntoViewIfNeeded();
    await longCard.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    await expect(page.locator('#lightbox-desc-toggle')).not.toHaveClass(/no-desc/);
    await expect(page.locator('#lightbox-desc-toggle')).toBeVisible();
  });

  test('7. Reset on swipe or navigation', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await card.scrollIntoViewIfNeeded();
    await card.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    const toggle = page.locator('#lightbox-desc-toggle');
    await toggle.tap();
    await expect(page.locator('#lightbox-content')).toHaveClass(/desc-open/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // Navigate to next photo
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#lightbox-title')).toHaveText('photo 1-1 two-liner', { timeout: 3000 });

    // The new photo must be collapsed with aria-expanded="false" and no desc-open class
    await expect(page.locator('#lightbox-content')).not.toHaveClass(/desc-open/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('8. Aspect ratios stability: 1:1, 4:5, and 16:9', async ({ page }) => {
    await waitForGallery(page);

    const testPhotos = [
      { label: 'View photo 1-1 long', idx: 0 },
      { label: 'View photo 4-5 long', idx: 4 },
      { label: 'View photo 16-9 long', idx: 8 }
    ];

    for (const item of testPhotos) {
      const card = page.locator(`.masonry-panel[data-category="all"] .photo-card[aria-label="${item.label}"]`);
      await card.scrollIntoViewIfNeeded();
      await card.tap();

      await expect(page.locator('#lightbox')).toHaveClass(/open/);
      const toggle = page.locator('#lightbox-desc-toggle');
      await expect(toggle).toBeVisible();

      const beforeRects = await getElementsRects(page, item.idx);

      // Expand
      await toggle.tap();
      await expect(toggle).toHaveText('read less');
      await page.waitForTimeout(400);

      const afterRects = await getElementsRects(page, item.idx);

      expect(afterRects.photo.x).toBeCloseTo(beforeRects.photo.x, 1);
      expect(afterRects.photo.y).toBeCloseTo(beforeRects.photo.y, 1);
      expect(afterRects.photo.width).toBeCloseTo(beforeRects.photo.width, 1);
      expect(afterRects.photo.height).toBeCloseTo(beforeRects.photo.height, 1);

      expect(afterRects.toggle.y).toBeCloseTo(beforeRects.toggle.y, 1);
      expect(afterRects.meta.y).toBeCloseTo(beforeRects.meta.y, 1);

      // Close lightbox via Escape key
      await page.keyboard.press('Escape');
      await expect(page.locator('#lightbox')).not.toHaveClass(/open/);
    }
  });

  test('9. Viewport changes (different height, then 844x390 landscape)', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await card.scrollIntoViewIfNeeded();
    await card.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);

    // 1. Change viewport height
    await page.setViewportSize({ width: 390, height: 720 });
    await page.waitForTimeout(200);

    let rects = await getElementsRects(page, 0);
    let gap = rects.filmstrip.top - rects.bottomRow.bottom;
    expect(Math.abs(gap)).toBeLessThanOrEqual(24);
    expect(rects.toggle.bottom).toBeLessThanOrEqual(720);
    expect(rects.toggle.top).toBeGreaterThanOrEqual(0);

    // 2. Change viewport to 844x390 landscape
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(200);

    rects = await getElementsRects(page, 0);
    gap = rects.filmstrip.top - rects.bottomRow.bottom;
    expect(Math.abs(gap)).toBeLessThanOrEqual(24);
    expect(rects.toggle.bottom).toBeLessThanOrEqual(390);
    expect(rects.toggle.top).toBeGreaterThanOrEqual(0);
  });

  test('Screenshots for human review (dark and bright images, collapsed & expanded)', async ({ page }) => {
    const outputDir = path.resolve(process.cwd(), 'test-results/lightbox-dock');
    fs.mkdirSync(outputDir, { recursive: true });

    await waitForGallery(page);

    // 1. Dark photo screenshots
    const darkCard = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await darkCard.scrollIntoViewIfNeeded();
    await darkCard.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    const toggle = page.locator('#lightbox-desc-toggle');
    await expect(toggle).toBeVisible();

    await page.screenshot({ path: path.join(outputDir, 'collapsed-dark.png') });

    await toggle.tap();
    await expect(toggle).toHaveText('read less');
    await page.waitForTimeout(400);

    await page.screenshot({ path: path.join(outputDir, 'expanded-dark.png') });

    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).not.toHaveClass(/open/);

    // 2. Bright photo screenshots
    const brightCard = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo bright long"]');
    await brightCard.scrollIntoViewIfNeeded();
    await brightCard.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    const brightToggle = page.locator('#lightbox-desc-toggle');
    await expect(brightToggle).toBeVisible();

    await page.screenshot({ path: path.join(outputDir, 'collapsed-bright.png') });

    await brightToggle.tap();
    await expect(brightToggle).toHaveText('read less');
    await page.waitForTimeout(400);

    await page.screenshot({ path: path.join(outputDir, 'expanded-bright.png') });
  });
});

test.describe('Desktop unchanged', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    hasTouch: false,
    isMobile: false
  });

  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Desktop check runs in Chromium.');
    await setupApiMocks(page);
  });

  test('10. Desktop layout unchanged: info-wrap not position: absolute pinned to bottom, toggle not displayed', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await card.scrollIntoViewIfNeeded();
    await card.click();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    await expect(page.locator('#lightbox-title')).toHaveText('photo 1-1 long');

    // Toggle not displayed on desktop
    const toggle = page.locator('#lightbox-desc-toggle');
    await expect(toggle).not.toBeVisible();

    // info-wrap is NOT position: absolute pinned to bottom
    const infoWrapPosition = await page.evaluate(() => {
      const el = document.getElementById('lightbox-info-wrap');
      return window.getComputedStyle(el).position;
    });
    expect(infoWrapPosition).not.toBe('absolute');

    // Content is row layout on desktop
    const contentDirection = await page.evaluate(() => {
      const el = document.getElementById('lightbox-content');
      return window.getComputedStyle(el).flexDirection;
    });
    expect(contentDirection).toBe('row');
  });
});
