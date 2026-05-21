// CURSOR - mouse only
var isMouseDevice = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
if (isMouseDevice) {
  var cursor = document.getElementById('cursor');
  var ring = document.getElementById('cursor-ring');
  var mx = 0, my = 0, rx = 0, ry = 0;
  var cursorVisible = false;
  var isDraggingScrollbar = false;

  // Fade out when cursor leaves the viewport — use both document and documentElement for cross-browser coverage
  function hideCursor() {
    cursor.style.opacity = '0'; ring.style.opacity = '0';
    cursorVisible = false;
  }
  function showCursor() {
    if (cursorVisible) return;
    cursorVisible = true;
    cursor.style.opacity = '1'; ring.style.opacity = '1';
  }

  var cursorTimeout;
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

  // the thin ring that follows the dot around
  (function animateRing() { rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2; ring.style.left = rx + 'px'; ring.style.top = ry + 'px'; requestAnimationFrame(animateRing); })();

  // Respond to hold (mousedown)
  window.addEventListener('mousedown', function (e) {
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

  document.addEventListener('mouseleave', hideCursor);
  document.documentElement.addEventListener('mouseleave', hideCursor);
  document.addEventListener('mouseenter', showCursor);
  document.documentElement.addEventListener('mouseenter', showCursor);
  document.addEventListener('contextmenu', function () { hideCursor(); cursor.style.transform = 'translate(-50%,-50%) scale(0.6)'; });
  // Delegated hover for cursor ring — works on dynamically added cards and carousel imgs
  var interactiveSelector = 'button, .photo-card, #scroll-hint, .carousel-row img, .footer-instagram';
  document.addEventListener('mouseover', function (e) {
    if (e.target.matches(interactiveSelector) || e.target.closest('.photo-card, #scroll-hint, .footer-instagram')) {
      ring.style.width = '44px'; ring.style.height = '44px'; ring.style.borderColor = 'rgba(221,216,207,0.4)';
    }
  });
  document.addEventListener('mouseout', function (e) {
    if (e.target.matches(interactiveSelector) || e.target.closest('.photo-card, #scroll-hint, .footer-instagram')) {
      ring.style.width = '28px'; ring.style.height = '28px'; ring.style.borderColor = 'rgba(221,216,207,0.25)';
    }
  });

  // reset ring when lightbox opens — hover context is lost when carousel img is covered
  window.addEventListener('lightbox-open', function () {
    ring.style.width = '28px'; ring.style.height = '28px'; ring.style.borderColor = 'rgba(221,216,207,0.25)';
  });
}
