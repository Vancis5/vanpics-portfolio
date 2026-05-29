import '../../data/photos.js';
import '../../data/videos.js';
import './config.js';
import './utils.js';
import './dom.js';
import './media-data.js';
import './motion-markup.js';
import './hero-tagline.js';
import './viewport.js';

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
  const legacyScripts = [
    '/js/app/core.js',
    '/js/app/lightbox.js',
    '/js/app/lightbox-zoom.js',
    '/js/app/lightbox-swipe.js',
    '/js/app/gallery.js',
    '/js/app/hero-carousel.js',
    '/js/app/cursor.js',
    '/js/app/custom-scrollbar.js',
    '/js/app/filmstrip.js',
    '/js/app/bootstrap.js',
    '/js/browser-fixes.js'
  ];

  for (const src of legacyScripts) {
    await loadScript(src);
  }

  await loadLenis();
  await loadScript('/js/smooth-scroll.js');
}

bootstrapApp().catch(function (error) {
  console.error(error);
});
