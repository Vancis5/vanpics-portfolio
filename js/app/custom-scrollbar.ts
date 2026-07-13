import { APP_CONFIG } from './config.js';
import { domRefs } from './dom.js';
import { state } from './state.js';

export let updateCustomScrollbar = function () {};

// ADVANCED CUSTOM SCROLLBAR CONTROLLER
(function initCustomScrollbar() {
  let track = domRefs.customScrollbar;
  let thumb = domRefs.customScrollbarThumb;
  if (!track || !thumb) return;

  let isDragging = false;
  let startY: number, startScroll: number;
  let fadeTimer: any = null;
  let SCROLLBAR_CONFIG = APP_CONFIG.scrollbar;
  let cachedYearOffsets: Array<{ absTop: number; year: string }> | null = null;
  let cachedDocH: number | null = null;
  let cachedWinH: number | null = null;

  // Create and inject the year tag
  let yearTag = document.createElement('div');
  yearTag.id = 'custom-scrollbar-year';
  yearTag.className = 'custom-scrollbar-year';
  track.appendChild(yearTag);

  function getAbsoluteOffsetTop(element: Element): number {
    let top = 0;
    let curr = element as HTMLElement | null;
    while (curr) {
      top += curr.offsetTop;
      curr = curr.offsetParent as HTMLElement | null;
    }
    return top;
  }

  function updateYearTag(thumbY: number, thumbH: number, targetScrollPos: number) {
    let winH = cachedWinH !== null ? cachedWinH : window.innerHeight;
    let activeYear = null;

    if (!cachedYearOffsets) {
      cachedYearOffsets = [];
      let activePanel = document.querySelector('.masonry-panel.is-active');
      if (activePanel) {
        let yearSections = activePanel.querySelectorAll('.masonry-year');
        for (let i = 0; i < yearSections.length; i++) {
          let section = yearSections[i];
          let absTop = getAbsoluteOffsetTop(section);
          let header = section.querySelector('.date-header');
          let year = header && header.textContent ? header.textContent.trim() : null;
          if (year && year !== 'undated') {
            cachedYearOffsets.push({ absTop, year });
          }
        }
      }
    }

    let triggerLine = targetScrollPos + winH * 0.4;
    for (let i = 0; i < cachedYearOffsets.length; i++) {
      let item = cachedYearOffsets[i];
      if (item.absTop <= triggerLine) {
        activeYear = item.year;
      }
    }

    if (activeYear) {
      yearTag.textContent = activeYear;
      yearTag.classList.add('visible');
      let yearTagH = 22; // Fixed height of the year tag badge to avoid reading offsetHeight
      let tagY = thumbY + (thumbH - yearTagH) / 2;
      tagY = Math.max(8, Math.min(tagY, winH - yearTagH - 8));
      yearTag.style.setProperty('--scrollbar-year-y', tagY + 'px');
    } else {
      yearTag.classList.remove('visible');
    }
  }

  function updateThumb() {
    if (cachedWinH === null) {
      cachedWinH = window.innerHeight;
    }
    if (cachedDocH === null) {
      cachedDocH = document.documentElement.scrollHeight;
    }

    let winH = cachedWinH;
    let docH = cachedDocH;
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

    if (state.isMobile) {
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
    const lenis = (window as any).lenis;
    if (lenis) lenis.scrollTo(window.scrollY, { immediate: true });
    (window as any)._scrollbarDragging = true;

    // Invalidate caches on drag start to guarantee fresh measurements
    cachedYearOffsets = null;
    cachedDocH = document.documentElement.scrollHeight;
    cachedWinH = window.innerHeight;

    let winH = cachedWinH;
    let docH = cachedDocH;
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

    // Show year tag immediately on drag start
    let currentThumbY = parseFloat(thumb.style.transform.replace('translateY(', '').replace('px)', '')) || 0;
    let dragStartScroll = window.pageYOffset || document.documentElement.scrollTop;
    updateYearTag(currentThumbY, thumbH, dragStartScroll);

    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  window.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    let deltaY = e.clientY - startY;

    if (cachedWinH === null) cachedWinH = window.innerHeight;
    if (cachedDocH === null) cachedDocH = document.documentElement.scrollHeight;
    let winH = cachedWinH;
    let docH = cachedDocH;
    let thumbH = parseFloat(thumb.style.height);
    let maxTrack = winH - thumbH;
    let maxScroll = docH - winH;

    let scrollDelta = (deltaY / maxTrack) * maxScroll;
    let targetPos = Math.max(0, Math.min(startScroll + scrollDelta, maxScroll));
    document.documentElement.scrollTop = targetPos;

    // Update year tag position while dragging
    let thumbY = (targetPos / maxScroll) * maxTrack;
    updateYearTag(thumbY, thumbH, targetPos);
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
      const lenis = (window as any).lenis;
      if (lenis) {
        let pos = document.documentElement.scrollTop;
        lenis.animatedScroll = pos;
        lenis.targetScroll = pos;
        lenis.velocity = 0;
        lenis.isScrolling = false;
        if (lenis.animate) lenis.animate.stop();
      }

      // Unblock lenis AFTER state is set
      (window as any)._scrollbarDragging = false;

      // Hide year tag immediately when drag ends
      yearTag.classList.remove('visible');


      if (state.isMobile) {
        clearTimeout(fadeTimer);
        fadeTimer = setTimeout(function () { track.classList.remove('moving'); }, SCROLLBAR_CONFIG.mobileFadeDelay);
      }
    }
  });

  function invalidateSizeCache() {
    cachedDocH = null;
    cachedWinH = null;
    cachedYearOffsets = null;
    updateThumb();
  }

  window.addEventListener('resize', invalidateSizeCache);
  window.addEventListener('load', invalidateSizeCache);

  if (window.ResizeObserver) {
    new ResizeObserver(invalidateSizeCache).observe(document.body);
  }

  updateCustomScrollbar = updateThumb;
  updateThumb();
})();
