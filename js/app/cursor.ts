import { domRefs } from './dom.js';
import { createMorph } from 'morphicons/dom';
import { SPRING_PRESETS, type IconNode } from 'morphicons';

const circleIcon: IconNode = [
  ['circle', { cx: 12, cy: 12, r: 10.8 }]
];

const zoomInIcon: IconNode = [
  ['circle', { cx: 11, cy: 11, r: 8 }],
  ['line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 }],
  ['line', { x1: 11, y1: 8, x2: 11, y2: 14 }],
  ['line', { x1: 8, y1: 11, x2: 14, y2: 11 }]
];

const zoomOutIcon: IconNode = [
  ['circle', { cx: 11, cy: 11, r: 8 }],
  ['line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 }],
  ['line', { x1: 8, y1: 11, x2: 14, y2: 11 }]
];

const handIcon: IconNode = [
  ['path', { d: 'M18 8a2 2 0 0 1 2 2v4a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15' }],
  ['path', { d: 'M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0' }],
  ['path', { d: 'M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2' }],
  ['path', { d: 'M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8' }]
];

type ZoomMorphMode = 'zoom-in' | 'zoom-out' | 'pan';

function getIconForMode(mode: ZoomMorphMode): IconNode {
  if (mode === 'pan') return handIcon;
  if (mode === 'zoom-out') return zoomOutIcon;
  return zoomInIcon;
}

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

  // Mount morph SVG inside ring
  const svgNS = 'http://www.w3.org/2000/svg';
  const morphSvg = document.createElementNS(svgNS, 'svg');
  morphSvg.setAttribute('id', 'cursor-morph-svg');
  morphSvg.setAttribute('viewBox', '0 0 24 24');
  morphSvg.setAttribute('fill', 'none');
  morphSvg.setAttribute('stroke', 'currentColor');
  morphSvg.setAttribute('stroke-width', '1.2');
  morphSvg.setAttribute('stroke-linecap', 'round');
  morphSvg.setAttribute('stroke-linejoin', 'round');

  const morphPath = document.createElementNS(svgNS, 'path');
  morphSvg.appendChild(morphPath);
  ring.appendChild(morphSvg);

  const morph = createMorph(morphPath, circleIcon);

  // Fade out when cursor leaves the viewport — use both document and documentElement for cross-browser coverage
  let ringScale = 1;
  let isMorphActive = false;
  let morphSettleTimeout: any = null;

  function setZoomMorph(active: boolean, mode: ZoomMorphMode = 'zoom-in') {
    if (!morph) return;
    clearTimeout(morphSettleTimeout);
    if (active) {
      isMorphActive = true;
      ring.classList.add('morph-active');
      cursor.classList.add('morph-hidden');
      morph.morphTo(getIconForMode(mode), SPRING_PRESETS.snappy);
    } else {
      if (!isMorphActive) return;
      isMorphActive = false;
      cursor.style.opacity = '1';
      cursor.classList.remove('morph-hidden');
      morph.morphTo(circleIcon, SPRING_PRESETS.snappy);
      morphSettleTimeout = setTimeout(() => {
        if (!isMorphActive) {
          ring.classList.remove('morph-active');
        }
      }, 280);
    }
  }

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
    if (isMorphActive) return;
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
  }
  function showCursor() {
    if (!isMorphActive) {
      cursor.style.opacity = '1';
    }
    ring.style.opacity = '1';
    if (cursorVisible) return;
    cursorVisible = true;
    startRingAnimation();
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
        if (!isMorphActive) {
          ring.style.borderColor = ringScale > 1 ? 'rgba(221,216,207,0.4)' : 'rgba(221,216,207,0.25)';
        }
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
    mx = e.clientX; my = e.clientY;
    cursor.style.translate = `${mx}px ${my}px`;

    if (isDraggingScrollbar) {
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
  document.addEventListener('mouseenter', showCursor);
  document.documentElement.addEventListener('mouseenter', showCursor);
  document.addEventListener('contextmenu', function () {
    hideCursor();
    cursor.style.scale = '0.6';
  });

  const zoomableSelector = '.zoomable, #lightbox-img';

  // Delegated hover for cursor ring — works on dynamically added cards, carousel imgs, navbar, etc.
  const interactiveSelector = 'button, a, [role="button"], .photo-card, #scroll-hint, .carousel-item, .carousel-row img, .filmstrip-thumb, .lightbox-nav-arrow';
  document.addEventListener('mouseover', function (e) {
    const target = e.target as HTMLElement;
    if (target && target.closest(zoomableSelector)) {
      const img = target.closest(zoomableSelector) as HTMLElement;
      const lb = document.getElementById('lightbox');
      const isZoomed = img.classList.contains('zoomed') || (lb?.classList.contains('zoom-active') ?? false);
      const isPan = isZoomed && img.classList.contains('is-panning');
      const mode: ZoomMorphMode = isPan ? 'pan' : (isZoomed ? 'zoom-out' : 'zoom-in');
      setZoomMorph(true, mode);
      return;
    }
    if (target && target.closest(interactiveSelector)) {
      ringScale = 1.57;
      ring.style.scale = '1.57';
      ring.style.borderColor = 'rgba(221,216,207,0.4)';
    }
  }, { passive: true });

  document.addEventListener('mouseout', function (e) {
    const target = e.target as HTMLElement | null;
    const currentZoomable = target ? target.closest(zoomableSelector) : null;
    if (currentZoomable) {
      const related = e.relatedTarget as Node | null;
      if (related && currentZoomable.contains(related)) {
        return;
      }
      if (related instanceof Element && related.closest(zoomableSelector)) {
        return;
      }
      setZoomMorph(false);
      return;
    }

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

  window.addEventListener('lightbox-cursor-mode', function (e: any) {
    if (isMorphActive) {
      const mode = (e.detail?.mode || 'zoom-in') as ZoomMorphMode;
      morph.morphTo(getIconForMode(mode), SPRING_PRESETS.snappy);
    }
  });

  window.addEventListener('lightbox-zoom-change', function (e: any) {
    if (isMorphActive) {
      const isZoomed = !!e.detail?.isZoomed;
      morph.morphTo(isZoomed ? zoomOutIcon : zoomInIcon, SPRING_PRESETS.snappy);
    }
  });

  // reset ring when lightbox opens or closes — hover context is lost when carousel img is covered
  window.addEventListener('lightbox-open', function () {
    resetFilmstripStretch();
    setZoomMorph(false);
    cursor.style.opacity = '1';
    cursor.classList.remove('morph-hidden');
    ringScale = 1;
    ring.style.scale = '1';
    ring.style.borderColor = 'rgba(221,216,207,0.25)';
  });
  window.addEventListener('lightbox-close', function () {
    resetFilmstripStretch();
    setZoomMorph(false);
    cursor.style.opacity = '1';
    cursor.classList.remove('morph-hidden');
    ringScale = 1;
    ring.style.scale = '1';
    ring.style.borderColor = 'rgba(221,216,207,0.25)';
  });
  window.addEventListener('hide-cursor', hideCursor);
}
