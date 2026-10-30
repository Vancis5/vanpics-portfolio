import { test, expect } from '@playwright/test';

function setupApiMocks(page) {
  return Promise.all([
    page.route('**/*googletagmanager*', (route) => route.abort()),
    page.route('**/api/photos*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 1,
              title: 'photo 1',
              src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23222"%3E%3Crect width="300" height="200"/%3E%3C/svg%3E',
              thumb: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23222"%3E%3Crect width="300" height="200"/%3E%3C/svg%3E',
              aspect_ratio: 1.5,
              category: '',
              location: 'tokyo, japan',
              date: '2026-04-10',
              desc: 'test desc',
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
        body: JSON.stringify({ items: [] })
      });
    }),
    page.route('**/api/views*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ views: 10 })
      });
    })
  ]);
}

test('masonry does not shift on desktop lightbox open and close (1440px)', async ({ page }) => {
  await setupApiMocks(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.masonry-panel[data-category="all"] .photo-card');

  // Scroll down so gallery header is stuck
  await page.evaluate(() => {
    window.scrollTo(0, 1000);
  });
  await page.waitForTimeout(400);

  const beforeOpen = await page.evaluate(() => {
    const masonry = document.getElementById('masonry');
    return masonry.getBoundingClientRect().top;
  });

  // Open lightbox
  await page.evaluate(() => {
    const card = document.querySelector('.masonry-panel[data-category="all"] .photo-card');
    card.click();
  });
  await page.waitForTimeout(100);

  const duringOpen = await page.evaluate(() => {
    const masonry = document.getElementById('masonry');
    return masonry.getBoundingClientRect().top;
  });

  console.log(`1440px: beforeOpen=${beforeOpen}, duringOpen=${duringOpen}, diff=${Math.abs(duringOpen - beforeOpen)}`);
  expect(Math.abs(duringOpen - beforeOpen)).toBeLessThan(0.5);

  // Close lightbox
  await page.evaluate(() => {
    const closeBtn = document.getElementById('lightbox-close');
    closeBtn.click();
  });
  await page.waitForTimeout(500);

  const afterClose = await page.evaluate(() => {
    const masonry = document.getElementById('masonry');
    return masonry.getBoundingClientRect().top;
  });

  console.log(`1440px: afterClose=${afterClose}, diff=${Math.abs(afterClose - beforeOpen)}`);
  expect(Math.abs(afterClose - beforeOpen)).toBeLessThan(0.5);
});

test('masonry does not shift on desktop lightbox open (1024px)', async ({ page }) => {
  await setupApiMocks(page);
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.masonry-panel[data-category="all"] .photo-card');

  await page.evaluate(() => {
    window.scrollTo(0, 1000);
  });
  await page.waitForTimeout(400);

  const beforeOpen = await page.evaluate(() => {
    const masonry = document.getElementById('masonry');
    return masonry.getBoundingClientRect().top;
  });

  await page.evaluate(() => {
    const card = document.querySelector('.masonry-panel[data-category="all"] .photo-card');
    card.click();
  });
  await page.waitForTimeout(100);

  const duringOpen = await page.evaluate(() => {
    const masonry = document.getElementById('masonry');
    return masonry.getBoundingClientRect().top;
  });

  console.log(`1024px: beforeOpen=${beforeOpen}, duringOpen=${duringOpen}, diff=${Math.abs(duringOpen - beforeOpen)}`);
  expect(Math.abs(duringOpen - beforeOpen)).toBeLessThan(0.5);
});
