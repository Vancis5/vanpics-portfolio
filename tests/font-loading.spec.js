// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Font Loading Before Display', () => {
  test('all required fonts are loaded and ready before loader lifts or lightbox displays', async ({ page }) => {
    // Delay font requests by 500ms to simulate slow connection
    await page.route('**/fonts/*.woff2', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.continue();
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // While fonts are loading, loader is visible and page content is hidden
    const loader = page.locator('#loader');
    await expect(loader).toBeVisible();

    // Wait until fonts-ready is added to html element
    await expect(page.locator('html')).toHaveClass(/fonts-ready/);

    // Verify all 4 font faces are loaded and checked
    const fontsReady = await page.evaluate(async () => {
      const gNormal = document.fonts.check('400 1em "Cormorant Garamond"');
      const gItalic = document.fonts.check('italic 400 1em "Cormorant Garamond"');
      const mono400 = document.fonts.check('400 1em "DM Mono"');
      const mono300 = document.fonts.check('300 1em "DM Mono"');
      return { gNormal, gItalic, mono400, mono300 };
    });

    expect(fontsReady.gNormal).toBe(true);
    expect(fontsReady.gItalic).toBe(true);
    expect(fontsReady.mono400).toBe(true);
    expect(fontsReady.mono300).toBe(true);

    // Now wait for loader to lift
    await expect(loader).toHaveClass(/lifting/, { timeout: 10000 });
  });

  test('deep link to lightbox on slow font loading waits for fonts before showing lightbox title', async ({ page }) => {
    // Mock API
    await page.route('**/api/photos*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 1,
              title: 'test photo',
              src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect width="300" height="200"/%3E%3C/svg%3E',
              thumb: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="100"%3E%3Crect width="150" height="100"/%3E%3C/svg%3E',
              aspect_ratio: 1.5,
              category: 'landscape',
              location: 'test location',
              date: '2026-04-10',
              desc: 'test desc',
              hero_slide: true,
              created_at: '2026-04-10T00:00:00Z'
            }
          ]
        })
      });
    });
    await page.route('**/api/videos*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }));
    await page.route('**/api/views*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ views: 1 }) }));

    // Delay font requests by 600ms
    await page.route('**/fonts/*.woff2', async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.continue();
    });

    await page.goto('/#landscape/test-photo', { waitUntil: 'domcontentloaded' });

    // Lightbox should open
    await expect(page.locator('#lightbox')).toHaveClass(/open/);

    // Ensure italic font is ready when lightbox title is rendered
    const italicFontCheck = await page.evaluate(() => {
      return document.fonts.check('italic 400 1em "Cormorant Garamond"');
    });
    expect(italicFontCheck).toBe(true);

    const title = page.locator('#lightbox-title');
    await expect(title).toHaveText('test photo');
    await expect(title).toHaveCSS('font-style', 'italic');
  });
});
