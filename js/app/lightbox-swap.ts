// Thumb -> full-resolution handoff for the desktop lightbox.
//
// The main <img> shows the grid thumb while the 1600px photo loads and decodes off-DOM. Setting
// img.src to the full photo at that point is a hard cut (soft thumb to sharp photo in one frame).
// crossfadeToFull() instead fades a decoded copy of the full photo in over the thumb and only then
// points the real <img> at it, so the swap is never visible. Every failure path falls back to the
// old direct swap.

const OVERLAY_CLASS = 'lightbox-swap-overlay';
const FADE_MS = 220;

// Bumped by every crossfade start and every clear, so an older in-flight fade can tell it was
// superseded even when the caller's own "is this still the current photo" check still passes.
let swapSeq = 0;

export function clearSwapOverlay(wrap: HTMLElement | null) {
  swapSeq++;
  if (!wrap) return;
  wrap.querySelectorAll('.' + OVERLAY_CLASS).forEach(function (el) { el.remove(); });
}

function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// Returns true when a crossfade was started (the caller must NOT set img.src itself), false when
// the caller should do the plain swap. `isCurrent` is re-checked after every async step so a
// navigation mid-fade never writes a stale photo into the lightbox.
export function crossfadeToFull(
  wrap: HTMLElement,
  img: HTMLImageElement,
  fullSrc: string,
  isCurrent: () => boolean,
  onSwapped: () => void
): boolean {
  if (typeof img.animate !== 'function' || prefersReducedMotion()) return false;
  if (img.classList.contains('zoomed')) return false;

  clearSwapOverlay(wrap);
  const mySeq = swapSeq;
  const live = function () { return mySeq === swapSeq && isCurrent(); };
  const overlay = document.createElement('img');
  overlay.className = OVERLAY_CLASS;
  overlay.alt = '';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.draggable = false;
  overlay.style.opacity = '0';
  overlay.src = fullSrc;

  const swapDirect = function () {
    overlay.remove();
    if (!live()) return;
    img.src = fullSrc;
    onSwapped();
  };

  // Decode before inserting so the first visible frame of the overlay is already painted.
  const ready = overlay.decode ? overlay.decode() : Promise.resolve();
  ready.then(function () {
    if (!live()) { overlay.remove(); return; }
    wrap.appendChild(overlay);
    const anim = overlay.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: FADE_MS,
      easing: 'ease-out',
      fill: 'forwards'
    });
    anim.onfinish = function () {
      if (!live()) { overlay.remove(); return; }
      img.src = fullSrc;
      const done = function () {
        overlay.remove();
        if (live()) onSwapped();
      };
      // Keep the overlay up until the real <img> has the photo, so there is no uncovered frame.
      if (img.decode) img.decode().then(done, done); else done();
    };
    anim.oncancel = function () { overlay.remove(); };
  }, swapDirect);
  return true;
}
