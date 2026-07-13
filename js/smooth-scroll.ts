import Lenis from 'lenis';
import { APP_CONFIG } from './app/config.js';
import { state } from './app/state.js';
import type { CustomLenis } from './types.js';

export function initSmoothScroll(options: any = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const updateStickyHeaderSurface = options.updateStickyHeaderSurface || function () {};
  const updateCustomScrollbar = options.updateCustomScrollbar || function () {};

  function updateScrollDrivenUi(scroll?: number) {
    const scrollPos = (typeof scroll === 'number') ? scroll : (window.scrollY || 0);
    state.heroScrollY = scrollPos;
    updateStickyHeaderSurface();
    updateCustomScrollbar();
  }

  if (window.matchMedia('(hover: none)').matches) {
    window.addEventListener('scroll', function () {
      updateScrollDrivenUi();
    }, { passive: true });
    updateScrollDrivenUi();
    return;
  }

  const smoothScrollConfig = APP_CONFIG.smoothScroll;
  const lenis = new Lenis({
    lerp: smoothScrollConfig.lerp,
    smoothWheel: true,
    wheelMultiplier: smoothScrollConfig.wheelMultiplier,
    infinite: false,
    autoResize: false
  });
  (window as any).lenis = lenis;

  function syncLenisToReality() {
    const mainLenis = (window as any).lenis;
    if (!mainLenis || window._scrollbarDragging) return;
    const pos = document.documentElement.scrollTop || 0;
    const delta = Math.abs(mainLenis.animatedScroll - pos);
    if (delta > smoothScrollConfig.desyncThreshold) {
      mainLenis.animatedScroll = pos;
      mainLenis.targetScroll = pos;
      mainLenis.velocity = 0;
      mainLenis.isScrolling = false;
      if (mainLenis.animate) mainLenis.animate.stop();
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
    }) as unknown as CustomLenis;

    let fsResizeTimer: any;
    new ResizeObserver(function () {
      clearTimeout(fsResizeTimer);
      fsResizeTimer = setTimeout(function () {
        if (window.fsLenis) window.fsLenis.resize();
      }, smoothScrollConfig.resizeDebounce);
    }).observe(filmstripEl);
  }

  window.addEventListener('scroll', function () {
    updateScrollDrivenUi();
  }, { passive: true });

  function lenisRaf(time: number) {
    if (document.hidden) {
      requestAnimationFrame(lenisRaf);
      return;
    }
    
    const mainLenis = (window as any).lenis;
    if (mainLenis) {
      if (window._scrollbarDragging) {
        mainLenis.time = time;
      } else {
        mainLenis.raf(time);
      }
    }
    // Only tick fsLenis when filmstrip is visible — saves full RAF work when hidden
    const fsWrap = document.getElementById('filmstrip-wrap');
    if (window.fsLenis && fsWrap && fsWrap.classList.contains('visible')) {
      window.fsLenis.raf(time);
    }
    requestAnimationFrame(lenisRaf);
  }
  requestAnimationFrame(lenisRaf);

  lenis.on('scroll', function (event: any) {
    updateScrollDrivenUi(event.scroll);
  });

  window.addEventListener('lightbox-open', function () {
    const mainLenis = (window as any).lenis;
    if (mainLenis) mainLenis.stop();
  });

  const lenisStyle = document.createElement('style');
  lenisStyle.textContent = 'html.lenis,html.lenis body{height:auto}html.lenis,html.lenis-scrolling{overflow-x:clip!important;overflow-y:auto!important}html.lenis-stopped{overflow:auto!important}';
  document.head.appendChild(lenisStyle);
}
