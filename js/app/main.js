import './config.js';
import './utils.js';
import './dom.js';
import './media-data.js';
import './motion-markup.js';
import './hero-tagline.js';
import './viewport.js';
import './state.js';
import './core.js';
import './lightbox.js';
import './lightbox-zoom.js';
import './lightbox-swipe.js';
import './gallery.js';
import './hero-carousel.js';
import './cursor.js';
import './filmstrip.js';
import { updateStickyHeaderSurface } from './sticky-header.js';
import { updateCustomScrollbar } from './custom-scrollbar.js';
import './bootstrap.js';
import '../browser-fixes.js';

function loadScript(src, options = {}) {
  return new Promise(function (resolve, reject) {
    const script = document.createElement('script');
    script.src = src;

    if (options.integrity) script.integrity = options.integrity;
    if (options.crossOrigin) script.crossOrigin = options.crossOrigin;

    script.onload = function () { resolve(); };
    script.onerror = function () { reject(new Error('Failed to load script: ' + src)); };

    document.body.appendChild(script);
  });
}

async function loadLenis() {
  if (window.Lenis) return;

  try {
    await loadScript('https://cdn.jsdelivr.net/npm/lenis@1.1.20/dist/lenis.min.js', {
      integrity: 'sha384-eD5ubmuCcvTdCADWuSchJYE7wcj2nzNr0itbrh6w/KJyBiltSZ8w3VFRBSWu5YQ8',
      crossOrigin: 'anonymous'
    });
  } catch (error) {
    await loadScript('/vendor/lenis.min.js');
  }
}

async function bootstrapApp() {
  await loadLenis();
  const { initSmoothScroll } = await import('../smooth-scroll.js');
  initSmoothScroll({ updateStickyHeaderSurface, updateCustomScrollbar });
}

bootstrapApp().catch(function (error) {
  console.error(error);
});
