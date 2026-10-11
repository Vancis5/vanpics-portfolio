import { test, expect } from '@playwright/test';

test.describe('Video Player Loader Fallback', () => {
  test('falls back to local vendor script when CDN is blocked and defines custom elements', async ({ page }) => {
    let cdnBlocked = false;
    await page.route('**/cdn.jsdelivr.net/**', (route) => {
      cdnBlocked = true;
      route.abort('failed');
    });

    const localVendorRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/vendor/')) {
        localVendorRequests.push(url);
      }
    });

    await page.goto('/');

    const result = await page.evaluate(async () => {
      const module = await import('/js/app/video-player-loader.ts');
      try {
        await module.loadVideoPlayer();
        return {
          success: true,
          hasVideoPlayer: customElements.get('video-player') !== undefined,
          hasMediaContainer: customElements.get('media-container') !== undefined,
          hasMediaPoster: customElements.get('media-poster') !== undefined,
          hasMediaControls: customElements.get('media-controls') !== undefined,
        };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || String(err),
        };
      }
    });

    expect(cdnBlocked).toBe(true);
    expect(result.success).toBe(true);
    expect(result.hasVideoPlayer).toBe(true);
    expect(result.hasMediaContainer).toBe(true);
    expect(result.hasMediaPoster).toBe(true);
    expect(result.hasMediaControls).toBe(true);
    expect(localVendorRequests.some((url) => url.includes('/vendor/video-minimal-ui.js'))).toBe(true);
  });

  test('rejects cleanly if both CDN and local fallback fail', async ({ page }) => {
    await page.route('**/cdn.jsdelivr.net/**', (route) => route.abort('failed'));
    await page.route('**/vendor/video-minimal-ui.js', (route) => route.abort('failed'));

    await page.goto('/');

    const result = await page.evaluate(async () => {
      const module = await import('/js/app/video-player-loader.ts');
      try {
        await module.loadVideoPlayer();
        return { resolved: true };
      } catch (err: any) {
        return { resolved: false, error: err?.message };
      }
    });

    expect(result.resolved).toBe(false);
    expect(result.error).toContain('Failed to load video player from CDN and fallback');
  });
});
