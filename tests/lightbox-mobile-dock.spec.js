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

const makeSvg = (w, h, fill = '%23222') =>
  `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" fill="${fill}"%3E%3Crect width="${w}" height="${h}"/%3E%3C/svg%3E`;

const SVG_1_1 = makeSvg(300, 300);
const SVG_4_5 = makeSvg(240, 300);
const SVG_3_2 = makeSvg(300, 200);
const SVG_16_9 = makeSvg(320, 180);
const SVG_9_16 = makeSvg(180, 320);
const SVG_BRIGHT = makeSvg(300, 200, '%23ffffff');

const mockPhotos = [
  // 1:1 Aspect Ratio
  {
    id: 1,
    title: 'photo 1-1 long',
    src: SVG_1_1,
    thumb: SVG_1_1,
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
    src: SVG_1_1,
    thumb: SVG_1_1,
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
    src: SVG_1_1,
    thumb: SVG_1_1,
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
    src: SVG_1_1,
    thumb: SVG_1_1,
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
    src: SVG_4_5,
    thumb: SVG_4_5,
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
    src: SVG_4_5,
    thumb: SVG_4_5,
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
    src: SVG_4_5,
    thumb: SVG_4_5,
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
    src: SVG_4_5,
    thumb: SVG_4_5,
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
    src: SVG_16_9,
    thumb: SVG_16_9,
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
    src: SVG_16_9,
    thumb: SVG_16_9,
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
    src: SVG_16_9,
    thumb: SVG_16_9,
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
    src: SVG_16_9,
    thumb: SVG_16_9,
    aspect_ratio: 1.7777777777777777,
    category: '',
    location: 'jeju, korea',
    date: '2026-03-30',
    desc: '',
    hero_slide: true
  },

  // 3:2 Aspect Ratio (1.5)
  {
    id: 13,
    title: 'photo 3-2 long',
    src: SVG_3_2,
    thumb: SVG_3_2,
    aspect_ratio: 1.5,
    category: '',
    location: 'kyoto, japan',
    date: '2026-03-29',
    desc: LONG_DESC,
    hero_slide: true
  },
  {
    id: 14,
    title: 'photo 3-2 one-liner',
    src: SVG_3_2,
    thumb: SVG_3_2,
    aspect_ratio: 1.5,
    category: '',
    location: 'kobe, japan',
    date: '2026-03-28',
    desc: 'standard landscape 3:2 view.',
    hero_slide: true
  },

  // 9:16 Tall Portrait (0.5625)
  {
    id: 15,
    title: 'photo 9-16 long',
    src: SVG_9_16,
    thumb: SVG_9_16,
    aspect_ratio: 0.5625,
    category: '',
    location: 'sapporo, japan',
    date: '2026-03-27',
    desc: LONG_DESC,
    hero_slide: true
  },

  // Bright mostly-white image for human review screenshot
  {
    id: 16,
    title: 'photo bright long',
    src: SVG_BRIGHT,
    thumb: SVG_BRIGHT,
    aspect_ratio: 1.3333,
    category: '',
    location: 'snow peak',
    date: '2026-03-26',
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
 * photo, slideInner, img, imgWrap, title, toggle, meta, infoWrap, filmstrip, and bottomRow.
 */
async function getElementsRects(page, slideIdx = 0) {
  return await page.evaluate((idx) => {
    const isMobile = window.matchMedia('(hover: none)').matches;
    const activeThumb = document.querySelector('.filmstrip-thumb.active');
    const activeIdx = activeThumb ? parseInt(activeThumb.dataset.idx, 10) : idx;
    let slideInnerEl = null;
    let imgEl = null;
    let photoEl = null;

    if (isMobile) {
      slideInnerEl = document.querySelector(`.snap-slide[data-idx="${activeIdx}"] .snap-slide-inner`);
      imgEl = document.querySelector(`.snap-slide[data-idx="${activeIdx}"] img`);
      photoEl = slideInnerEl || imgEl || document.getElementById('lightbox-img');
    } else {
      photoEl = document.getElementById('lightbox-img');
      imgEl = document.getElementById('lightbox-img');
    }
    const imgWrapEl = document.getElementById('lightbox-img-wrap');
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
      slideInner: toRect(slideInnerEl),
      img: toRect(imgEl),
      imgWrap: toRect(imgWrapEl),
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
        beforeContent: beforeStyle.content
      };
    });

    expect(scrimStyles.wrapBgImage).toBe('none');
    expect(scrimStyles.beforeContent).toBe('none');
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
    await page.waitForTimeout(400);

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
    await page.waitForTimeout(400);

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

  test('10. Photo frame sizing, centering, and clearance across aspect ratios (1:1, 4:5, 3:2, 16:9, 9:16)', async ({ page }) => {
    await waitForGallery(page);

    const testPhotos = [
      { label: 'View photo 1-1 long', name: '1:1', idx: 0 },
      { label: 'View photo 4-5 long', name: '4:5', idx: 4 },
      { label: 'View photo 3-2 long', name: '3:2', idx: 12 },
      { label: 'View photo 16-9 long', name: '16:9', idx: 8 },
      { label: 'View photo 9-16 long', name: '9:16', idx: 14 }
    ];

    for (const item of testPhotos) {
      const card = page.locator(`.masonry-panel[data-category="all"] .photo-card[aria-label="${item.label}"]`);
      await card.scrollIntoViewIfNeeded();
      await card.tap();

      await expect(page.locator('#lightbox')).toHaveClass(/open/);
      await expect(page.locator('#lightbox-title')).toBeVisible();
      await page.waitForFunction(() => document.fonts ? document.fonts.ready.then(() => true) : true);
      await page.waitForTimeout(200);

      const rects = await getElementsRects(page, item.idx);
      const vp = page.viewportSize();

      // 1. Photo area bottom edge is above the info block top edge (at least 8px clearance)
      const clearance = rects.infoWrap.top - rects.imgWrap.bottom;
      expect(clearance).toBeGreaterThanOrEqual(7.9);
      expect(rects.infoWrap.top - rects.photo.bottom).toBeGreaterThanOrEqual(7.9);

      // 2. Photo is vertically centered in the photo area:
      // |photo.top - area.top - (area.bottom - photo.bottom)| < 8px
      const topGap = rects.photo.top - rects.imgWrap.top;
      const bottomGap = rects.imgWrap.bottom - rects.photo.bottom;
      const verticalGapDiff = Math.abs(topGap - bottomGap);
      expect(verticalGapDiff).toBeLessThan(8);

      // 3. Photo is horizontally centered in the viewport
      const photoCenterX = (rects.photo.left + rects.photo.right) / 2;
      const vpCenterX = vp.width / 2;
      expect(Math.abs(photoCenterX - vpCenterX)).toBeLessThan(2);

      // 4. .snap-slide-inner's bounding box matches visible photo's bounding box within 2px on all sides (no ghost frame)
      expect(Math.abs(rects.slideInner.top - rects.img.top)).toBeLessThanOrEqual(2);
      expect(Math.abs(rects.slideInner.bottom - rects.img.bottom)).toBeLessThanOrEqual(2);
      expect(Math.abs(rects.slideInner.left - rects.img.left)).toBeLessThanOrEqual(2);
      expect(Math.abs(rects.slideInner.right - rects.img.right)).toBeLessThanOrEqual(2);

      // 5. Photo never exceeds photo area on either axis
      expect(rects.photo.top).toBeGreaterThanOrEqual(rects.imgWrap.top - 0.5);
      expect(rects.photo.bottom).toBeLessThanOrEqual(rects.imgWrap.bottom + 0.5);
      expect(rects.photo.width).toBeLessThanOrEqual(rects.imgWrap.width);

      // Close lightbox
      await page.keyboard.press('Escape');
      await expect(page.locator('#lightbox')).not.toHaveClass(/open/);
    }
  });

  test('11. Photo frame and centering verified after navigating between photos and document.fonts.ready', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 3-2 long"]');
    await card.scrollIntoViewIfNeeded();
    await card.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    await page.waitForFunction(() => document.fonts ? document.fonts.ready.then(() => true) : true);

    // Navigate to next photo
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);

    const rectsAfterNav = await getElementsRects(page);
    expect(rectsAfterNav.infoWrap.top - rectsAfterNav.imgWrap.bottom).toBeGreaterThanOrEqual(7.9);
    expect(Math.abs((rectsAfterNav.photo.top - rectsAfterNav.imgWrap.top) - (rectsAfterNav.imgWrap.bottom - rectsAfterNav.photo.bottom))).toBeLessThan(8);
    expect(Math.abs(rectsAfterNav.slideInner.bottom - rectsAfterNav.img.bottom)).toBeLessThanOrEqual(2);
  });

  test('Screenshots for human review (dark and bright images, collapsed & expanded, 3:2 and 16:9)', async ({ page }) => {
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

    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).not.toHaveClass(/open/);

    // 3. Mobile viewport screenshots (iPhone 14 Pro 393x852) for 3:2 and 16:9
    await page.setViewportSize({ width: 393, height: 852 });
    await page.waitForTimeout(150);

    const card32 = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 3-2 long"]');
    await card32.scrollIntoViewIfNeeded();
    await card32.tap();
    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outputDir, 'mobile-3-2.png') });

    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).not.toHaveClass(/open/);

    const card169 = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 16-9 long"]');
    await card169.scrollIntoViewIfNeeded();
    await card169.tap();
    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outputDir, 'mobile-16-9.png') });
  });

  test('14. Mobile double-tap zoom: double tap zooms in directly at tapped coordinate without shift, second double tap resets zoom', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await card.scrollIntoViewIfNeeded();
    await card.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    const imgLocator = page.locator('.snap-slide[data-idx="0"] img');
    await expect(imgLocator).toBeVisible();

    const box = await imgLocator.boundingBox();
    expect(box).toBeTruthy();
    const wrapBoxBefore = await page.locator('#lightbox-img-wrap').boundingBox();
    expect(wrapBoxBefore).toBeTruthy();

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // Tap off-center (e.g. 40px left, 30px up from center)
    const tapX = cx - 40;
    const tapY = cy - 30;

    // Relative fraction on unzoomed image
    const u = (tapX - box.x) / box.width;
    const v = (tapY - box.y) / box.height;

    // Filmstrip starts hidden or visible; remember state
    const fsVisibleBefore = await page.locator('#filmstrip-wrap').evaluate(el => el.classList.contains('visible'));

    // Wait for open navigation buffer (400ms) to clear
    await page.waitForTimeout(500);

    // Double tap off-center
    await page.touchscreen.tap(tapX, tapY);
    await page.waitForTimeout(50);
    await page.touchscreen.tap(tapX, tapY);

    await expect(page.locator('#lightbox')).toHaveClass(/zoom-active/);

    // Filmstrip should NOT have toggled from the double-tap
    const fsVisibleDuring = await page.locator('#filmstrip-wrap').evaluate(el => el.classList.contains('visible'));
    expect(fsVisibleDuring).toBe(false);

    // Wait for zoom transition to settle
    await page.waitForTimeout(400);

    // Verify info wrap blurs during zoom instead of disappearing
    const infoFilterZoomed = await page.locator('#lightbox-info-wrap').evaluate(el => el.style.filter);
    expect(infoFilterZoomed.includes('blur')).toBe(true);
    const infoOpacityZoomed = await page.locator('#lightbox-info-wrap').evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(infoOpacityZoomed)).toBeGreaterThan(0.5);

    const wrapBoxZoomed = await page.locator('#lightbox-img-wrap').boundingBox();
    // Wrap geometry must remain identical (no layout jump or expansion)
    expect(Math.abs(wrapBoxZoomed.y - wrapBoxBefore.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(wrapBoxZoomed.height - wrapBoxBefore.height)).toBeLessThanOrEqual(1);

    // Verify tapped point remains directly under the finger (within 2px)
    const zoomedBox = await imgLocator.boundingBox();
    expect(zoomedBox).toBeTruthy();
    const pointXAfter = zoomedBox.x + u * zoomedBox.width;
    const pointYAfter = zoomedBox.y + v * zoomedBox.height;
    expect(Math.abs(pointXAfter - tapX)).toBeLessThanOrEqual(2);
    expect(Math.abs(pointYAfter - tapY)).toBeLessThanOrEqual(2);

    // Second double tap to zoom out
    await page.touchscreen.tap(tapX, tapY);
    await page.waitForTimeout(50);
    await page.touchscreen.tap(tapX, tapY);

    await expect(page.locator('#lightbox')).not.toHaveClass(/zoom-active/, { timeout: 4000 });
    await page.waitForTimeout(400);

    const infoFilterAfter = await page.locator('#lightbox-info-wrap').evaluate(el => el.style.filter);
    expect(infoFilterAfter === '' || infoFilterAfter === 'none').toBe(true);

    const wrapBoxAfter = await page.locator('#lightbox-img-wrap').boundingBox();
    expect(Math.abs(wrapBoxAfter.y - wrapBoxBefore.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(wrapBoxAfter.height - wrapBoxBefore.height)).toBeLessThanOrEqual(1);
  });

  test('15. Mobile pinch zoom via CDP: two touches pinching outward activates zoom', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await card.scrollIntoViewIfNeeded();
    await card.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    const imgLocator = page.locator('.snap-slide[data-idx="0"] img');
    await expect(imgLocator).toBeVisible();

    const client = await page.context().newCDPSession(page);
    const box = await imgLocator.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: cx - 20, y: cy, id: 0 },
        { x: cx + 20, y: cy, id: 1 }
      ]
    });

    for (let step = 1; step <= 5; step++) {
      const spread = 20 + step * 25;
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: cx - spread, y: cy, id: 0 },
          { x: cx + spread, y: cy, id: 1 }
        ]
      });
      await page.waitForTimeout(20);
    }

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });

    await expect(page.locator('#lightbox')).toHaveClass(/zoom-active/);
    const transform = await imgLocator.evaluate((el) => el.style.transform);
    expect(transform).toContain('scale(');
  });

  test('16. Pull-down to dismiss via CDP: drag down on photo past threshold dismisses lightbox and keeps dock stationary', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await card.scrollIntoViewIfNeeded();
    await card.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    const client = await page.context().newCDPSession(page);
    const img = page.locator('.snap-slide[data-idx="0"] img');
    const box = await img.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    const initialDockBox = await page.locator('#lightbox-info').boundingBox();

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY, id: 0 }]
    });

    for (let dy = 20; dy <= 160; dy += 20) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: startX, y: startY + dy, id: 0 }]
      });
      await page.waitForTimeout(16);
    }

    const imgWrapTransform = await page.locator('#lightbox-img-wrap').evaluate(el => el.style.transform);
    expect(imgWrapTransform).toContain('translateY(');
    expect(imgWrapTransform).toContain('rotate(');

    // Verify info dock text has NOT moved
    const infoTransform = await page.locator('#lightbox-info-wrap').evaluate(el => el.style.transform);
    expect(infoTransform === '' || infoTransform === 'none').toBe(true);
    const contentTransform = await page.locator('#lightbox-content').evaluate(el => el.style.transform);
    expect(contentTransform === '' || contentTransform === 'none').toBe(true);

    const currentDockBox = await page.locator('#lightbox-info').boundingBox();
    expect(Math.abs(currentDockBox.y - initialDockBox.y)).toBeLessThan(1);

    const rotateMatch = imgWrapTransform.match(/rotate\(([-\d.]+)deg\)/);
    expect(rotateMatch).not.toBeNull();
    const rotDeg = Math.abs(parseFloat(rotateMatch[1]));
    expect(rotDeg).toBeGreaterThan(1);
    expect(rotDeg).toBeLessThan(15);

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });

    await expect(page.locator('#lightbox')).not.toHaveClass(/open/, { timeout: 4000 });
  });

  test('17. Pull-down under threshold snaps back via CDP', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await card.scrollIntoViewIfNeeded();
    await card.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    const client = await page.context().newCDPSession(page);
    const img = page.locator('.snap-slide[data-idx="0"] img');
    const box = await img.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY, id: 0 }]
    });

    for (let dy = 5; dy <= 30; dy += 5) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: startX, y: startY + dy, id: 0 }]
      });
      await page.waitForTimeout(30);
    }

    // Hold at 30px so velocity drops to 0 before release
    await page.waitForTimeout(150);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: startX, y: startY + 30, id: 0 }]
    });
    await page.waitForTimeout(50);

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });

    await page.waitForTimeout(650);
    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    const imgWrapTransformAfterSnap = await page.locator('#lightbox-img-wrap').evaluate(el => el.style.transform);
    expect(imgWrapTransformAfterSnap === '' || imgWrapTransformAfterSnap === 'none').toBe(true);

    // Text and visible filmstrip must both be restored and visible
    const infoOpacity = await page.locator('#lightbox-info').evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(infoOpacity)).toBeGreaterThan(0.95);
    const fsOpacity = await page.locator('#filmstrip-wrap').evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(fsOpacity)).toBeGreaterThan(0.95);

    // Now test snap-back when filmstrip was initially hidden
    await page.evaluate(() => {
      document.getElementById('filmstrip-wrap')?.classList.remove('visible');
    });
    await page.waitForTimeout(100);

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY, id: 0 }]
    });

    for (let dy = 5; dy <= 30; dy += 5) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: startX, y: startY + dy, id: 0 }]
      });
      await page.waitForTimeout(20);
    }

    // Verify filmstrip did NOT pop into view during drag
    const fsOpacityDuringDrag = await page.locator('#filmstrip-wrap').evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(fsOpacityDuringDrag)).toBe(0);

    // Release and snap back
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
    await page.waitForTimeout(650);

    // Info text must remain visible, and filmstrip must remain hidden
    const infoOpacityAfterSnap = await page.locator('#lightbox-info').evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(infoOpacityAfterSnap)).toBeGreaterThan(0.95);
    const fsOpacityAfterSnap = await page.locator('#filmstrip-wrap').evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(fsOpacityAfterSnap)).toBe(0);
  });

  test('18. Touch drag starting on dock does not trigger dismiss', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await card.scrollIntoViewIfNeeded();
    await card.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    const client = await page.context().newCDPSession(page);
    const dock = page.locator('#lightbox-info');
    const box = await dock.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY, id: 0 }]
    });

    for (let dy = 20; dy <= 120; dy += 20) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: startX, y: startY + dy, id: 0 }]
      });
      await page.waitForTimeout(16);
    }

    const imgWrapTransform = await page.locator('#lightbox-img-wrap').evaluate(el => el.style.transform);
    expect(imgWrapTransform).toBe('');
    const contentTransform = await page.locator('#lightbox-content').evaluate(el => el.style.transform);
    expect(contentTransform).toBe('');

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });

    await page.waitForTimeout(300);
    await expect(page.locator('#lightbox')).toHaveClass(/open/);
  });

  test('19. Layout independence: dock reserved height and photo area top/bottom remain constant across 1:1, 4:5, 3:2, 16:9, and no-desc', async ({ page }) => {
    await waitForGallery(page);

    const testPhotos = [
      { label: 'View photo 1-1 long', name: '1:1-long', idx: 0 },
      { label: 'View photo 1-1 no-desc', name: '1:1-no-desc', idx: 3 },
      { label: 'View photo 4-5 long', name: '4:5-long', idx: 4 },
      { label: 'View photo 3-2 long', name: '3:2-long', idx: 12 },
      { label: 'View photo 16-9 no-desc', name: '16:9-no-desc', idx: 11 }
    ];

    let baselineImgWrapRect = null;
    let baselineDockCollapsedH = null;

    for (const item of testPhotos) {
      const card = page.locator(`.masonry-panel[data-category="all"] .photo-card[aria-label="${item.label}"]`);
      await card.scrollIntoViewIfNeeded();
      await card.tap();

      await expect(page.locator('#lightbox')).toHaveClass(/open/);
      await expect(page.locator('#lightbox-title')).toBeVisible();

      const rects = await getElementsRects(page, item.idx);
      const dockH = await page.locator('#lightbox-content').evaluate(el => el.style.getPropertyValue('--lightbox-dock-collapsed-height'));

      if (!baselineImgWrapRect) {
        baselineImgWrapRect = rects.imgWrap;
        baselineDockCollapsedH = dockH;
      } else {
        expect(rects.imgWrap.top).toBeCloseTo(baselineImgWrapRect.top, 1);
        expect(rects.imgWrap.bottom).toBeCloseTo(baselineImgWrapRect.bottom, 1);
        expect(rects.imgWrap.height).toBeCloseTo(baselineImgWrapRect.height, 1);
        expect(dockH).toBe(baselineDockCollapsedH);
      }

      await page.keyboard.press('Escape');
      await expect(page.locator('#lightbox')).not.toHaveClass(/open/);
    }
  });

  test('20. Pull-down rotation variation: multiple pulls exhibit randomized varied tilts', async ({ page }) => {
    await waitForGallery(page);
    const card = page.locator('.masonry-panel[data-category="all"] .photo-card[aria-label="View photo 1-1 long"]');
    await card.scrollIntoViewIfNeeded();
    await card.tap();

    await expect(page.locator('#lightbox')).toHaveClass(/open/);
    const client = await page.context().newCDPSession(page);
    const img = page.locator('.snap-slide[data-idx="0"] img');
    const box = await img.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    const observedTilts = [];

    for (let pull = 0; pull < 5; pull++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: startX, y: startY, id: 0 }]
      });

      for (let dy = 10; dy <= 50; dy += 10) {
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: startX, y: startY + dy, id: 0 }]
        });
        await page.waitForTimeout(16);
      }

      const imgWrapTransform = await page.locator('#lightbox-img-wrap').evaluate(el => el.style.transform);
      const match = imgWrapTransform.match(/rotate\(([-\d.]+)deg\)/);
      if (match) {
        observedTilts.push(parseFloat(match[1]));
      }

      // Snap back
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
      });
      await page.waitForTimeout(400);
    }

    expect(observedTilts.length).toBe(5);
    for (const tilt of observedTilts) {
      expect(Math.abs(tilt)).toBeGreaterThan(0.3);
      expect(Math.abs(tilt)).toBeLessThan(12);
    }
    const uniqueTilts = new Set(observedTilts.map(t => t.toFixed(2)));
    expect(uniqueTilts.size).toBeGreaterThan(1);
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

  test('12. Desktop layout unchanged: info-wrap not position: absolute pinned to bottom, toggle not displayed', async ({ page }) => {
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
