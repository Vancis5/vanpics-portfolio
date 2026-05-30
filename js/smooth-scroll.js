import { APP_CONFIG } from './app/config.js';
import { state } from './app/state.js';

export function initSmoothScroll(options = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const smoothScrollConfig = APP_CONFIG.smoothScroll;
  const lenis = new Lenis({
    lerp: smoothScrollConfig.lerp,
    smoothWheel: true,
    wheelMultiplier: smoothScrollConfig.wheelMultiplier,
    infinite: false,
    autoResize: false
  });
  window.lenis = lenis;

  function syncLenisToReality() {
    if (!window.lenis || window._scrollbarDragging) return;
    const pos = document.documentElement.scrollTop || 0;
    const delta = Math.abs(window.lenis.animatedScroll - pos);
    if (delta > smoothScrollConfig.desyncThreshold) {
      window.lenis.animatedScroll = pos;
      window.lenis.targetScroll = pos;
      window.lenis.velocity = 0;
      window.lenis.isScrolling = false;
      if (window.lenis.animate) window.lenis.animate.stop();
    }
  }

  window.addEventListener('scroll', syncLenisToReality, { passive: true });
  window.addEventListener('wheel', syncLenisToReality, { capture: true, passive: true });
  window.addEventListener('pageshow', function () {
    requestAnimationFrame(syncLenisToReality);
  });

  const filmstripEl = document.getElementById('filmstrip');
  if (filmstripEl) {
    window.fsLenis = new Lenis({
      wrapper: filmstripEl,
      content: filmstripEl,
      orientation: 'horizontal',
      gestureOrientation: 'both',
      smoothWheel: true,
      lerp: smoothScrollConfig.lerp,
      autoResize: false
    });

    let fsResizeTimer;
    new ResizeObserver(function () {
      clearTimeout(fsResizeTimer);
      fsResizeTimer = setTimeout(function () {
        if (window.fsLenis) window.fsLenis.resize();
      }, smoothScrollConfig.resizeDebounce);
    }).observe(filmstripEl);
  }

  const updateStickyHeaderSurface = options.updateStickyHeaderSurface || function () {};
  const updateCustomScrollbar = options.updateCustomScrollbar || function () {};

  function updateScrollDrivenUi(scroll) {
    const scrollPos = (typeof scroll === 'number') ? scroll : (window.scrollY || 0);
    state.heroScrollY = scrollPos;
    updateStickyHeaderSurface();
    updateCustomScrollbar();
  }

  window.addEventListener('scroll', function () {
    updateScrollDrivenUi();
  }, { passive: true });

  function lenisRaf(time) {
    if (window.lenis) {
      if (window._scrollbarDragging) {
        window.lenis.time = time;
      } else {
        window.lenis.raf(time);
      }
    }
    if (window.fsLenis) window.fsLenis.raf(time);
    requestAnimationFrame(lenisRaf);
  }
  requestAnimationFrame(lenisRaf);

  lenis.on('scroll', function (event) {
    updateScrollDrivenUi(event.scroll);
  });

  window.addEventListener('lightbox-open', function () {
    if (window.lenis) window.lenis.stop();
  });

  const lenisStyle = document.createElement('style');
  lenisStyle.textContent = 'html.lenis,html.lenis body{height:auto}html.lenis,html.lenis-scrolling{overflow-x:clip!important;overflow-y:auto!important}html.lenis-stopped{overflow:auto!important}';
  document.head.appendChild(lenisStyle);
}
