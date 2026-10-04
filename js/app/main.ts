import { perfMark, perfMeasure } from './perf.js'; // keep FIRST
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
import './easter-eggs.js';
import { updateStickyHeaderSurface } from './sticky-header.js';
import { updateCustomScrollbar } from './custom-scrollbar.js';
import { updateHeroOverlay } from './hero-carousel.js';
import './bootstrap.js';
import '../browser-fixes.js';
import '../../scripts/firefox-patch.js';
import { warmVideoPlayer } from './video-player-loader.js';

perfMark('imports-done');
perfMeasure('module-eval (all static imports)', 'main-start', 'imports-done');

warmVideoPlayer();

async function bootstrapApp() {
  perfMark('smooth-start');
  const { initSmoothScroll } = await import('../smooth-scroll.js');
  initSmoothScroll({ updateStickyHeaderSurface, updateCustomScrollbar, updateHeroOverlay });
  perfMark('smooth-end');
  perfMeasure('smooth-scroll import+init', 'smooth-start', 'smooth-end');
}

bootstrapApp().catch(function (error) {
  console.error(error);
});
