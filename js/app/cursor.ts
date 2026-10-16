import { domRefs } from './dom.js';

// CURSOR - mouse only
let isMouseDevice = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
if (isMouseDevice) {
  document.documentElement.classList.add('custom-cursor-enabled');
  let cursor = domRefs.cursor;
  let ring = domRefs.cursorRing;
  let mx = 0, my = 0, rx = 0, ry = 0;
  let cursorVisible = false;
  let isDraggingScrollbar = false;
  let ringRafId: number | null = null;

  // Fade out when cursor leaves the viewport — use both document and documentElement for cross-browser coverage
  let ringScale = 1;

  // Filmstrip wheel stretch physics
  let fsStretchVelocity = 0;
  let fsStretchTarget = 0;
  let fsCurrentOffset = 0;
  let fsCurrentWidth = 28;

  function isCursorOverFilmstrip(x = mx, y = my): boolean {
    if (!domRefs.filmstripWrap || !domRefs.filmstripWrap.classList.contains('visible')) {
      return false;
    }
    const rect = domRefs.filmstripWrap.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function resetFilmstripStretch() {
    fsStretchTarget = 0;
    fsStretchVelocity = 0;
    fsCurrentOffset = 0;
    fsCurrentWidth = 28;
    if (ring) {
      ring.style.width = '';
      ring.style.marginLeft = '';
      ring.style.transform = '';
      ring.style.scale = String(ringScale);
    }
  }

  function onFilmstripWheel(e: WheelEvent) {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 0.1) return;

    let normalizedDelta = delta;
    if (e.deltaMode === 1) normalizedDelta *= 25;
    else if (e.deltaMode === 2) normalizedDelta *= 400;

    // Opposite direction
    const dir = normalizedDelta > 0 ? -1 : 1;
    const impulse = Math.min(1, Math.max(0.65, Math.abs(normalizedDelta) / 80));
    fsStretchTarget = dir * impulse;
    fsStretchVelocity = dir * Math.max(Math.abs(fsStretchVelocity), impulse);
  }

  window.addEventListener('wheel', function (e) {
    if (typeof e.clientX === 'number' && typeof e.clientY === 'number' && (e.clientX || e.clientY)) {
      mx = e.clientX;
      my = e.clientY;
      cursor.style.translate = `${mx}px ${my}px`;
      showCursor();
    }
    const target = e.target as HTMLElement | null;
    const overStrip = target ? !!target.closest('#filmstrip-wrap, #filmstrip-lift-zone') : false;
    const overCoord = isCursorOverFilmstrip(e.clientX, e.clientY);
    const wrapVis = domRefs.filmstripWrap && domRefs.filmstripWrap.classList.contains('visible');
    if ((overStrip || overCoord) && wrapVis) {
      onFilmstripWheel(e);
    }
  }, { passive: true, capture: true });

  function hideCursor() {
    cursor.style.opacity = '0'; ring.style.opacity = '0';
    cursorVisible = false;
    resetFilmstripStretch();
    stopRingAnimation();
    window.dispatchEvent(new CustomEvent('cursor-hide'));
  }
  function showCursor() {
    if (cursorVisible) return;
    cursorVisible = true;
    cursor.style.opacity = '1'; ring.style.opacity = '1';
    startRingAnimation();
    window.dispatchEvent(new CustomEvent('cursor-show'));
  }
  function animateRing() {
    try {
      rx += (mx - rx) * 0.2;
      ry += (my - ry) * 0.2;
      ring.style.translate = `${rx}px ${ry}px`;

      const overFilmstrip = isCursorOverFilmstrip();

      fsStretchTarget *= 0.90;
      if (Math.abs(fsStretchTarget) < 0.005) {
        fsStretchTarget = 0;
      }

      if (!overFilmstrip) {
        fsStretchTarget = 0;
      }

      fsStretchVelocity += (fsStretchTarget - fsStretchVelocity) * (overFilmstrip ? 0.25 : 0.35);
      if (!overFilmstrip && Math.abs(fsStretchVelocity) < 0.01) {
        fsStretchVelocity = 0;
      }

      const intensity = Math.min(1, Math.abs(fsStretchVelocity));
      const dir = Math.sign(fsStretchVelocity);

      // Width stretch: stretches from 28px up to 74px with uniform 1px border outline
      const targetWidth = overFilmstrip ? 28 + intensity * 46 : 28;
      const targetOffset = overFilmstrip ? dir * intensity * 24 : 0;

      fsCurrentWidth += (targetWidth - fsCurrentWidth) * 0.22;
      fsCurrentOffset += (targetOffset - fsCurrentOffset) * 0.22;

      const isDeformed = (fsCurrentWidth - 28) > 0.5 || Math.abs(fsCurrentOffset) > 0.2;
      if (isDeformed) {
        ring.style.width = `${fsCurrentWidth.toFixed(1)}px`;
        ring.style.marginLeft = `${(-fsCurrentWidth / 2).toFixed(1)}px`;
        ring.style.transform = `translate3d(${fsCurrentOffset.toFixed(2)}px, 0, 0)`;
        ring.style.scale = '1';
        ring.style.borderColor = 'rgba(221,216,207,0.4)';
      } else if (ring.style.width) {
        ring.style.width = '';
        ring.style.marginLeft = '';
        ring.style.transform = '';
        ring.style.scale = String(ringScale);
        ring.style.borderColor = ringScale > 1 ? 'rgba(221,216,207,0.4)' : 'rgba(221,216,207,0.25)';
        fsCurrentWidth = 28;
        fsCurrentOffset = 0;
      }
    } catch (error) {
      console.error('Error in cursor ring animation loop:', error);
      ringRafId = null;
      return;
    }
    ringRafId = requestAnimationFrame(animateRing);
  }
  function startRingAnimation() {
    if (ringRafId || document.hidden) return;
    ringRafId = requestAnimationFrame(animateRing);
  }
  function stopRingAnimation() {
    if (!ringRafId) return;
    cancelAnimationFrame(ringRafId);
    ringRafId = null;
  }

  let cursorTimeout: any;
  function resetCursorTimeout() {
    showCursor();
    clearTimeout(cursorTimeout);
    cursorTimeout = setTimeout(hideCursor, 2000);
  }

  document.addEventListener('mousemove', function (e) {
    if (e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY <= 0 || e.clientY >= window.innerHeight) {
      hideCursor();
      return;
    }
    mx = e.clientX; my = e.clientY;
    cursor.style.translate = `${mx}px ${my}px`;

    const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
    if (isDraggingScrollbar || isFs) {
      hideCursor();
    } else {
      resetCursorTimeout();
    }
  }, { passive: true });

  // Respond to hold (mousedown)
  window.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    if (e.clientX >= window.innerWidth - 32) {
      isDraggingScrollbar = true;
      hideCursor();
      return;
    }

    cursor.style.scale = '0.65';
    ring.style.scale = '0.9';
  });
  window.addEventListener('mouseup', function () {
    isDraggingScrollbar = false;
    showCursor();
    cursor.style.scale = '1';
    ring.style.scale = String(ringScale);
  });

  window.addEventListener('blur', hideCursor);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopRingAnimation();
    } else if (cursorVisible) {
      startRingAnimation();
    }
  });

  document.addEventListener('mouseleave', hideCursor);
  document.documentElement.addEventListener('mouseleave', hideCursor);
  document.addEventListener('mouseout', function (e: MouseEvent) {
    if (!e.relatedTarget && !(e as any).toElement) {
      hideCursor();
    }
  });
  document.addEventListener('mouseenter', showCursor);
  document.documentElement.addEventListener('mouseenter', showCursor);
  document.addEventListener('contextmenu', function () {
    hideCursor();
    cursor.style.scale = '0.6';
  });

  // Delegated hover for cursor ring — works on dynamically added cards, carousel imgs, navbar, etc.
  const interactiveSelector = 'button, a, [role="button"], .photo-card, #scroll-hint, .carousel-item, .carousel-row img, .filmstrip-thumb, .lightbox-nav-arrow';
  document.addEventListener('mouseover', function (e) {
    const target = e.target as HTMLElement;
    if (target && target.closest(interactiveSelector)) {
      ringScale = 1.57;
      ring.style.scale = '1.57';
      ring.style.borderColor = 'rgba(221,216,207,0.4)';
    }
  }, { passive: true });

  document.addEventListener('mouseout', function (e) {
    const target = e.target as HTMLElement | null;
    const current = target ? target.closest(interactiveSelector) : null;
    if (!current) return;

    const related = e.relatedTarget as Node | null;
    if (related && current.contains(related)) {
      return;
    }
    if (related instanceof Element && related.closest(interactiveSelector)) {
      return;
    }
    if (isCursorOverFilmstrip() && ((fsCurrentWidth - 28) > 0.5 || Math.abs(fsCurrentOffset) > 0.2)) {
      return;
    }

    ringScale = 1;
    ring.style.scale = '1';
    ring.style.borderColor = 'rgba(221,216,207,0.25)';
  }, { passive: true });

  // reset ring when lightbox opens or closes — hover context is lost when carousel img is covered
  window.addEventListener('lightbox-open', function () {
    resetFilmstripStretch();
    ringScale = 1;
    ring.style.scale = '1';
    ring.style.borderColor = 'rgba(221,216,207,0.25)';
  });
  window.addEventListener('lightbox-close', resetFilmstripStretch);
  window.addEventListener('hide-cursor', hideCursor);

  function onFullscreenChange() {
    const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
    if (isFs) {
      document.documentElement.classList.add('in-fullscreen');
      hideCursor();
    } else {
      document.documentElement.classList.remove('in-fullscreen');
      showCursor();
    }
  }
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
}
