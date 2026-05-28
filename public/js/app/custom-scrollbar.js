// ADVANCED CUSTOM SCROLLBAR CONTROLLER
(function initCustomScrollbar() {
  let track = domRefs.customScrollbar;
  let thumb = domRefs.customScrollbarThumb;
  if (!track || !thumb) return;

  let isDragging = false;
  let startY, startScroll;
  let fadeTimer = null;
  let SCROLLBAR_CONFIG = window.APP_CONFIG.scrollbar;

  function updateThumb() {
    let winH = window.innerHeight;
    let docH = document.documentElement.scrollHeight;
    let scrollT = window.pageYOffset || document.documentElement.scrollTop;

    if (docH <= winH + 5) {
      track.style.display = 'none';
      return;
    } else {
      track.style.display = 'block';
    }

    let thumbH = Math.max(30, (winH / docH) * winH);
    let maxTrack = winH - thumbH;
    let maxScroll = docH - winH;
    let thumbY = (scrollT / maxScroll) * maxTrack;

    thumb.style.height = thumbH + 'px';
    thumb.style.transform = 'translateY(' + thumbY + 'px)';

    if (isMobile) {
      track.classList.add('moving');
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(function () {
        if (!isDragging) track.classList.remove('moving');
      }, SCROLLBAR_CONFIG.mobileFadeDelay);
    }
  }

  // Track interaction (click to jump + start dragging)
  track.addEventListener('mousedown', function (e) {
    isDragging = true;
    track.classList.add('dragging');
    document.body.classList.add('is-dragging-scrollbar');
    // Kill any ongoing smooth animation
    if (window.lenis) window.lenis.scrollTo(window.scrollY, { immediate: true });
    window._scrollbarDragging = true;

    let winH = window.innerHeight;
    let docH = document.documentElement.scrollHeight;
    let thumbH = parseFloat(thumb.style.height);
    let maxTrack = winH - thumbH;
    let maxScroll = docH - winH;

    let thumbRect = thumb.getBoundingClientRect();
    let isClickingThumb = e.clientY >= thumbRect.top && e.clientY <= thumbRect.bottom;

    if (!isClickingThumb) {
      let clickY = e.clientY - (thumbH / 2);
      let scrollPos = (clickY / maxTrack) * maxScroll;
      window.scrollTo(0, scrollPos);
    }

    startY = e.clientY;
    startScroll = window.pageYOffset || document.documentElement.scrollTop;

    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  window.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    let deltaY = e.clientY - startY;
    let winH = window.innerHeight;
    let docH = document.documentElement.scrollHeight;
    let thumbH = parseFloat(thumb.style.height);
    let maxTrack = winH - thumbH;
    let maxScroll = docH - winH;

    let scrollDelta = (deltaY / maxTrack) * maxScroll;
    let targetPos = Math.max(0, Math.min(startScroll + scrollDelta, maxScroll));
    document.documentElement.scrollTop = targetPos;
  });

  window.addEventListener('mouseup', function () {
    if (isDragging) {
      isDragging = false;
      track.classList.remove('dragging');
      document.body.classList.remove('is-dragging-scrollbar');
      document.body.style.userSelect = '';

      // Hand off to lenis by directly setting its brain.
      // We CANNOT use scrollTo() because it calls setScroll() internally
      // which uses window.scrollTo() — and the browser blocks that API
      // while lenis CSS is active.
      if (window.lenis) {
        let pos = document.documentElement.scrollTop;
        window.lenis.animatedScroll = pos;
        window.lenis.targetScroll = pos;
        window.lenis.velocity = 0;
        window.lenis.isScrolling = false;
        if (window.lenis.animate) window.lenis.animate.stop();
      }

      // Unblock lenis AFTER state is set
      window._scrollbarDragging = false;

      if (isMobile) {
        clearTimeout(fadeTimer);
        fadeTimer = setTimeout(function () { track.classList.remove('moving'); }, SCROLLBAR_CONFIG.mobileFadeDelay);
      }
    }
  });

  window.addEventListener('resize', updateThumb);
  window.addEventListener('load', updateThumb);

  if (window.ResizeObserver) {
    new ResizeObserver(updateThumb).observe(document.body);
  }

  window.updateCustomScrollbar = updateThumb;
  updateThumb();
})();
