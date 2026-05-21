// ADVANCED CUSTOM SCROLLBAR CONTROLLER
(function initCustomScrollbar() {
  var track = domRefs.customScrollbar;
  var thumb = domRefs.customScrollbarThumb;
  if (!track || !thumb) return;

  var isDragging = false;
  var startY, startScroll;
  var fadeTimer = null;

  function updateThumb() {
    var winH = window.innerHeight;
    var docH = document.documentElement.scrollHeight;
    var scrollT = window.pageYOffset || document.documentElement.scrollTop;

    if (docH <= winH + 5) {
      track.style.display = 'none';
      return;
    } else {
      track.style.display = 'block';
    }

    var thumbH = Math.max(30, (winH / docH) * winH);
    var maxTrack = winH - thumbH;
    var maxScroll = docH - winH;
    var thumbY = (scrollT / maxScroll) * maxTrack;

    thumb.style.height = thumbH + 'px';
    thumb.style.transform = 'translateY(' + thumbY + 'px)';

    if (isMobile) {
      track.classList.add('moving');
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(function () {
        if (!isDragging) track.classList.remove('moving');
      }, 3000);
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

    var winH = window.innerHeight;
    var docH = document.documentElement.scrollHeight;
    var thumbH = parseFloat(thumb.style.height);
    var maxTrack = winH - thumbH;
    var maxScroll = docH - winH;

    var thumbRect = thumb.getBoundingClientRect();
    var isClickingThumb = e.clientY >= thumbRect.top && e.clientY <= thumbRect.bottom;

    if (!isClickingThumb) {
      var clickY = e.clientY - (thumbH / 2);
      var scrollPos = (clickY / maxTrack) * maxScroll;
      window.scrollTo(0, scrollPos);
    }

    startY = e.clientY;
    startScroll = window.pageYOffset || document.documentElement.scrollTop;

    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  window.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    var deltaY = e.clientY - startY;
    var winH = window.innerHeight;
    var docH = document.documentElement.scrollHeight;
    var thumbH = parseFloat(thumb.style.height);
    var maxTrack = winH - thumbH;
    var maxScroll = docH - winH;

    var scrollDelta = (deltaY / maxTrack) * maxScroll;
    var targetPos = Math.max(0, Math.min(startScroll + scrollDelta, maxScroll));
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
        var pos = document.documentElement.scrollTop;
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
        fadeTimer = setTimeout(function () { track.classList.remove('moving'); }, 3000);
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
