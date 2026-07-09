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

async function bootstrapApp() {
  const { initSmoothScroll } = await import('../smooth-scroll.js');
  initSmoothScroll({ updateStickyHeaderSurface, updateCustomScrollbar });
}

bootstrapApp().catch(function (error) {
  console.error(error);
});
