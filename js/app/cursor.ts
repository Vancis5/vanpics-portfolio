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
  function hideCursor() {
    cursor.style.opacity = '0'; ring.style.opacity = '0';
    cursorVisible = false;
    stopRingAnimation();
  }
  function showCursor() {
    if (cursorVisible) return;
    cursorVisible = true;
    cursor.style.opacity = '1'; ring.style.opacity = '1';
    startRingAnimation();
  }
  function animateRing() {
    try {
      rx += (mx - rx) * 0.2;
      ry += (my - ry) * 0.2;
      ring.style.left = rx + 'px';
      ring.style.top = ry + 'px';
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
    // If mouse is idle for 2s, fade out to prevent "stuck" feeling over overlays
    cursorTimeout = setTimeout(hideCursor, 2000);
  }

  document.addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY;
    cursor.style.left = mx + 'px'; cursor.style.top = my + 'px';

    if (isDraggingScrollbar) {
      hideCursor();
    } else {
      resetCursorTimeout();
    }
  });

  // Respond to hold (mousedown)
  window.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    // If clicking near the right edge (scrollbar zone), hide the cursor
    if (e.clientX >= window.innerWidth - 32) {
      isDraggingScrollbar = true;
      hideCursor();
      return;
    }

    cursor.style.transform = 'translate(-50%,-50%) scale(0.65)';
    ring.style.transform = 'translate(-50%,-50%) scale(0.9)';
  });
  window.addEventListener('mouseup', function () {
    isDraggingScrollbar = false;
    showCursor();
    cursor.style.transform = 'translate(-50%,-50%) scale(1)';
    ring.style.transform = 'translate(-50%,-50%) scale(1)';
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
  document.addEventListener('mouseenter', showCursor);
  document.documentElement.addEventListener('mouseenter', showCursor);
  document.addEventListener('contextmenu', function () { hideCursor(); cursor.style.transform = 'translate(-50%,-50%) scale(0.6)'; });
  // Delegated hover for cursor ring — works on dynamically added cards, carousel imgs, navbar, etc.
  const interactiveSelector = 'button, a, [role="button"], .photo-card, #scroll-hint, .carousel-item, .carousel-row img, .filmstrip-thumb, .lightbox-nav-arrow';
  document.addEventListener('mouseover', function (e) {
    const target = e.target as HTMLElement;
    if (target && target.closest(interactiveSelector)) {
      ring.style.transform = 'translate(-50%,-50%) scale(1.57)'; ring.style.borderColor = 'rgba(221,216,207,0.4)';
    }
  });
  document.addEventListener('mouseout', function (e) {
    const target = e.target as HTMLElement;
    if (target && target.closest(interactiveSelector)) {
      ring.style.transform = 'translate(-50%,-50%) scale(1)'; ring.style.borderColor = 'rgba(221,216,207,0.25)';
    }
  });

  // reset ring when lightbox opens — hover context is lost when carousel img is covered
  window.addEventListener('lightbox-open', function () {
    ring.style.transform = 'translate(-50%,-50%) scale(1)'; ring.style.borderColor = 'rgba(221,216,207,0.25)';
  });
  window.addEventListener('hide-cursor', hideCursor);
}
