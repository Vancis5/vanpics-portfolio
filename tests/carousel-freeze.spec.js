// @ts-check
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*googletagmanager*', (route) => route.abort());
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
      body: JSON.stringify({ items: [] })
    });
  });

  await page.route('**/api/views*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ views: 5113 })
    });
  });
});

test.describe('Hero carousel movement after interactions', () => {
  test('carousel resumes movement after dragging a row', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#hero-identity h1')).toHaveText('vanpics');

    const row0 = page.locator('#row-0');
    await expect(row0).toBeVisible();

    const getTransform = async () => {
      return await row0.evaluate((el) => el.style.transform);
    };

    // Wait until carousel is moving initially
    await page.waitForTimeout(600);
    const initialTransform1 = await getTransform();
    await page.waitForTimeout(400);
    const initialTransform2 = await getTransform();
    expect(initialTransform1).not.toBe(initialTransform2);

    // Click and drag on an actual carousel item in row 0
    const item = row0.locator('.carousel-item').first();
    const box = await item.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 5 });
      await page.mouse.up();
    }

    // After releasing drag and waiting for momentum to settle, carousel MUST continue moving
    await page.waitForTimeout(2500);
    const postDrag1 = await getTransform();
    await page.waitForTimeout(400);
    const postDrag2 = await getTransform();

    expect(postDrag1).not.toBe(postDrag2);
  });

  test('carousel resumes movement after opening photo from carousel and closing lightbox', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#hero-identity h1')).toHaveText('vanpics');

    const row0 = page.locator('#row-0');
    const firstCarouselItem = row0.locator('.carousel-item').first();
    await expect(firstCarouselItem).toBeVisible();

    const getTransform = async () => {
      return await row0.evaluate((el) => el.style.transform);
    };

    // Open lightbox by clicking the carousel item (force: true because carousel is animating)
    await firstCarouselItem.click({ force: true });
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toHaveClass(/open/);

    // Close lightbox via close button
    const closeBtn = page.locator('#lightbox-close');
    await closeBtn.click();
    await expect(lightbox).not.toHaveClass(/open/);

    // After closing lightbox, carousel MUST continue moving
    await page.waitForTimeout(1000);
    const postClose1 = await getTransform();
    await page.waitForTimeout(400);
    const postClose2 = await getTransform();

    expect(postClose1).not.toBe(postClose2);
  });

  test('carousel resumes movement after opening photo from carousel and closing lightbox with Escape', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#hero-identity h1')).toHaveText('vanpics');

    const row0 = page.locator('#row-0');
    const firstCarouselItem = row0.locator('.carousel-item').first();
    await expect(firstCarouselItem).toBeVisible();

    const getTransform = async () => {
      return await row0.evaluate((el) => el.style.transform);
    };

    // Open lightbox via keyboard
    await firstCarouselItem.focus();
    await page.keyboard.press('Enter');
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toHaveClass(/open/);

    // Close lightbox via Escape key
    await page.keyboard.press('Escape');
    await expect(lightbox).not.toHaveClass(/open/);

    // After closing lightbox, carousel MUST continue moving
    await page.waitForTimeout(1000);
    const postClose1 = await getTransform();
    await page.waitForTimeout(400);
    const postClose2 = await getTransform();

    expect(postClose1).not.toBe(postClose2);
  });
});
