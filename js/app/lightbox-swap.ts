// Thumb -> full-resolution handoff for the desktop lightbox.
//
// The main <img> shows the grid thumb while the 1600px photo loads and decodes off-DOM. Setting
// img.src to the full photo at that point is a hard cut (soft thumb to sharp photo in one frame).
// crossfadeToFull() instead fades a decoded copy of the full photo in over the thumb and only then
// points the real <img> at it, so the swap is never visible.
//
// Rules that keep the handoff glitch-free:
//  - The caller keeps the wrap's loading box (aspect-ratio sized, img stretched to 100% x 100%)
//    until onSwapped runs, so the thumb never collapses to its tiny natural size mid-fade.
//  - The overlay draws only picture pixels, inset by the real <img>'s border, so the outline is
//    always the real <img>'s own border and can never float away from the photo.
//  - The overlay is a sibling of the <img>, so it cannot follow a transform on the <img> (nav exit,
//    zoom). The moment the <img> gets a transform the swap is committed instantly instead.
// Every failure path falls back to the old direct swap.

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

function hasTransform(img: HTMLElement) {
  const t = img.style.transform;
  return !!t && t !== 'none';
}

// Returns true when a crossfade was started (the caller must NOT set img.src itself and must run
// its "photo is ready" work from onSwapped), false when the caller should do the plain swap.
// `isCurrent` is re-checked after every async step so a navigation mid-fade never writes a stale
// photo into the lightbox.
export function crossfadeToFull(
  wrap: HTMLElement,
  img: HTMLImageElement,
  fullSrc: string,
  isCurrent: () => boolean,
  onSwapped: () => void
): boolean {
  if (typeof img.animate !== 'function' || prefersReducedMotion()) return false;
  if (img.classList.contains('zoomed') || hasTransform(img)) return false;

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

  let observer: MutationObserver | null = null;
  let anim: Animation | null = null;
  let finished = false;

  // Point the real <img> at the photo. Normal finish: hold the overlay at full opacity until the
  // real <img> has decoded (no uncovered frame), then drop it. Interrupted (the <img> got a
  // transform): drop the overlay at once, it cannot follow the <img>.
  const commit = function (interrupted: boolean) {
    if (finished) return;
    finished = true;
    if (observer) { observer.disconnect(); observer = null; }
    if (anim) {
      anim.onfinish = null;
      anim.oncancel = null;
      // finish() keeps the overlay at opacity 1; cancel() would snap it back to 0 mid-handoff.
      if (interrupted) anim.cancel(); else { try { anim.finish(); } catch (e) { /* already finished */ } }
    }
    if (!live()) { overlay.remove(); return; }
    if (interrupted) {
      overlay.remove();
      return;
    }
    img.src = fullSrc;
    const done = function () {
      overlay.remove();
      if (live()) onSwapped();
    };
    if (img.decode) img.decode().then(done, done); else done();
  };

  // Decode before inserting so the first visible frame of the overlay is already painted.
  const ready = overlay.decode ? overlay.decode() : Promise.resolve();
  ready.then(function () {
    if (!live()) { overlay.remove(); return; }
    wrap.appendChild(overlay);
    anim = overlay.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: FADE_MS,
      easing: 'ease-out',
      fill: 'forwards'
    });
    anim.onfinish = function () { commit(false); };
    anim.oncancel = function () { overlay.remove(); };
    // Nav exit / zoom put a transform on the <img> only; commit before the overlay can ghost.
    observer = new MutationObserver(function () { if (hasTransform(img)) commit(true); });
    observer.observe(img, { attributes: true, attributeFilter: ['style', 'class'] });
    if (hasTransform(img) || img.classList.contains('zoomed')) commit(true);
  }, function () {
    // The overlay copy failed to decode: old behaviour (direct swap).
    overlay.remove();
    if (!live()) return;
    img.src = fullSrc;
    onSwapped();
  });
  return true;
}
