// @ts-check
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
              title: 'collateral',
              src: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
              thumb: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=200',
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
              src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
              thumb: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200',
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

test.describe('Immediate dynamic text color', () => {
  test('text color changes immediately upon opening and navigating', async ({ page }) => {
    await setupApiMocks(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Open first photo (collateral) via hash route
    await page.goto('/#photographs/collateral', { waitUntil: 'domcontentloaded' });

    const lb = page.locator('#lightbox');
    await expect(lb).toHaveClass(/open/, { timeout: 15000 });
    await expect(page.locator('#lightbox-title')).toHaveText('collateral', { timeout: 15000 });

    // Dynamic text color must be extracted and applied
    await expect.poll(async () => {
      return await lb.evaluate(el => el.style.getPropertyValue('--dynamic-text-color'));
    }, { timeout: 5000 }).not.toBe('');

    const prevColor = await lb.evaluate(el => el.style.getPropertyValue('--dynamic-text-color'));

    // Title and desc must not have color transition lag
    const titleTransition = await page.locator('#lightbox-title').evaluate(el => window.getComputedStyle(el).transitionProperty);
    expect(titleTransition).not.toContain('color');

    const descTransition = await page.locator('#lightbox-desc').evaluate(el => window.getComputedStyle(el).transitionProperty);
    expect(descTransition).not.toContain('color');

    // ArrowRight to next photo (depths)
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#lightbox-title')).toHaveText('depths', { timeout: 5000 });

    // Immediately upon navigating, color should update without 1-3s delay to new photo color
    await expect.poll(async () => {
      const nextColor = await lb.evaluate(el => el.style.getPropertyValue('--dynamic-text-color'));
      return nextColor && nextColor !== prevColor;
    }, { timeout: 1000 }).toBe(true);
  });
});
