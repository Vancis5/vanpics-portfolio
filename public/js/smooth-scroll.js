if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let SMOOTH_SCROLL_CONFIG = window.APP_CONFIG.smoothScroll;

  let lenis = new Lenis({
    lerp: SMOOTH_SCROLL_CONFIG.lerp,
    smoothWheel: true,
    wheelMultiplier: SMOOTH_SCROLL_CONFIG.wheelMultiplier,
    infinite: false,
    autoResize: false
  });
  window.lenis = lenis;

  // ── DESYNC WATCHER ──
  // Catches browser scroll restoration after refresh, back/forward nav,
  // or any other situation where the real scroll position drifts from
  // what lenis thinks. Runs on every native scroll event.
  function syncLenisToReality() {
    if (!window.lenis || window._scrollbarDragging) return;
    let pos = document.documentElement.scrollTop || 0;
    let delta = Math.abs(window.lenis.animatedScroll - pos);
    if (delta > SMOOTH_SCROLL_CONFIG.desyncThreshold) {
      window.lenis.animatedScroll = pos;
      window.lenis.targetScroll = pos;
      window.lenis.velocity = 0;
      window.lenis.isScrolling = false;
      if (window.lenis.animate) window.lenis.animate.stop();
    }
  }
  window.addEventListener('scroll', syncLenisToReality, { passive: true });
  // Also catch the first wheel event (user might scroll before restoration fires)
  window.addEventListener('wheel', syncLenisToReality, { capture: true, passive: true });
  // And catch late browser restoration
  window.addEventListener('pageshow', function () {
    requestAnimationFrame(syncLenisToReality);
  });

  // ── Filmstrip Lenis ──
  let filmstripEl = document.getElementById('filmstrip');
  if (filmstripEl) {
    window.fsLenis = new Lenis({
      wrapper: filmstripEl,
      content: filmstripEl,
      orientation: 'horizontal',
      gestureOrientation: 'both',
      smoothWheel: true,
      lerp: SMOOTH_SCROLL_CONFIG.lerp,
      autoResize: false
    });

    let _fsResizeTimer;
    new ResizeObserver(function () {
      clearTimeout(_fsResizeTimer);
      _fsResizeTimer = setTimeout(function () {
        if (window.fsLenis) window.fsLenis.resize();
      }, SMOOTH_SCROLL_CONFIG.resizeDebounce);
    }).observe(filmstripEl);
  }

  // ── THE GLOBAL SCROLL HUB ──
  window.globalScrollHub = function(s) {
    let scrollPos = (typeof s === 'number') ? s : (window.scrollY || 0);
    heroScrollY = scrollPos;
    if (window.updateStickyHeaderSurface) window.updateStickyHeaderSurface(scrollPos);
    if (window.updateCustomScrollbar) window.updateCustomScrollbar();
  };

  window.addEventListener('scroll', function() {
    window.globalScrollHub();
  }, { passive: true });


  function lenisRaf(time) {
    if (window.lenis) {
      if (window._scrollbarDragging) {
        // Don't let lenis touch the scroll during manual drag
        window.lenis.time = time;
      } else {
        window.lenis.raf(time);
      }
    }
    if (window.fsLenis) window.fsLenis.raf(time);
    requestAnimationFrame(lenisRaf);
  }
  requestAnimationFrame(lenisRaf);

  lenis.on('scroll', function (e) {
    window.globalScrollHub(e.scroll);
  });

  // Lightbox sync
  window.addEventListener('lightbox-open', function () { if (window.lenis) window.lenis.stop(); });

  // Override Lenis CSS classes that conflict with site overflow rules
  let ls = document.createElement('style');
  ls.textContent = 'html.lenis,html.lenis body{height:auto}html.lenis,html.lenis-scrolling{overflow-x:clip!important;overflow-y:auto!important}html.lenis-stopped{overflow:auto!important}';
  document.head.appendChild(ls);
}
