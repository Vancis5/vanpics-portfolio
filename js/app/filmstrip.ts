import { APP_CONFIG } from './config.js';
import { domRefs } from './dom.js';
import { state } from './state.js';
import { motionProjects } from './media-data.js';
import { openLightbox } from './lightbox.js';
import { setFilmstripVisibilityHandlers } from './core.js';
import { setupImagePlaceholderFallback } from './utils.js';

// FILMSTRIP
let filmstripWrap = domRefs.filmstripWrap;
let filmstripEl = domRefs.filmstrip;
let filmstripTrack: HTMLElement | null = null;
let filmstripBuilt = false;
let FILMSTRIP_CONFIG = APP_CONFIG.filmstrip;

function galleryAlreadyHasThumb(thumbPath: string, loadedThumbs: Set<string>) {
  if (!thumbPath || !loadedThumbs) return false;
  return loadedThumbs.has(thumbPath);
}

window.addEventListener('category-change', function () {
  filmstripBuilt = false;
  if (typeof filmstripEl !== 'undefined' && filmstripEl) {
    resetFilmstripTransformScroll();
    getFilmstripTrack().innerHTML = '';
  }
  // Also reset mobile slides if they exist
  let imgWrap = domRefs.lightboxImgWrap;
  if (imgWrap) {
    let slides = imgWrap.querySelectorAll('.snap-slide');
    for (let i = 0; i < slides.length; i++) slides[i].remove();
  }

  // Rebuild filmstrip & slides immediately if lightbox is open to prevent visual cutoff/loss of UI assets
  if (domRefs.lightbox && domRefs.lightbox.classList.contains('open')) {
    window.dispatchEvent(new Event('lightbox-open'));
    showFilmstrip();
  }
});
let liftZone = domRefs.filmstripLiftZone;

export function buildFilmstrip() {
  if (filmstripBuilt) return;
  filmstripBuilt = true;

  // Pre-compile a Set of loaded gallery thumbnails for O(1) checks
  const loadedThumbs = new Set<string>();
  try {
    const existingImages = document.querySelectorAll('.photo-card img') as NodeListOf<HTMLImageElement>;
    existingImages.forEach(img => {
      const src = img.getAttribute('src');
      if (src && (img.classList.contains('media-loaded') || (img.complete && img.naturalWidth > 0))) {
        loadedThumbs.add(src);
        try {
          const absolutePath = new URL(src, window.location.href).href;
          loadedThumbs.add(absolutePath);
        } catch (e) {}
      }
    });
  } catch (err) {}

  let currentSet = state.currentLightboxIsMotion ? motionProjects : state.activePhotos;

  // Photos: 52px thumb + gap, Motion: 78px thumb
  let THUMB_W = state.currentLightboxIsMotion ? (window.innerWidth >= 640 ? 78 : 68) : (window.innerWidth >= 640 ? 62 : 52);
  let pad = (window.innerWidth / 2) - (THUMB_W / 2);
  let track = getFilmstripTrack();
  resetFilmstripTransformScroll();
  track.style.paddingLeft = pad + 'px';
  track.style.paddingRight = pad + 'px';
  track.innerHTML = '';

  currentSet.forEach(function (p, i) {
    let thumb = document.createElement('div');
    thumb.className = 'filmstrip-thumb';
    if (state.currentLightboxIsMotion) thumb.classList.add('mode-motion');
    thumb.dataset.idx = String(i);
    thumb.tabIndex = 0;
    thumb.setAttribute('role', 'button');
    thumb.setAttribute('aria-label', p.title ? `Go to ${p.title}` : 'Go to thumbnail');
    let img = document.createElement('img');
    let thumbPath = state.currentLightboxIsMotion
      ? (p.thumb || '')
      : (p.thumb || (p.src ? p.src.replace('photos/', 'photos/thumbs/') : ''));
    img.src = thumbPath;
    img.alt = p.title || '';
    img.loading = 'eager';
    img.decoding = 'async';
    img.fetchPriority = Math.abs(i - state.cur) <= 8 ? 'high' : 'auto';
      let loaded = false;
      let timer = setTimeout(function () {
        if (!loaded) {
          img.classList.add('fade-in-on-load');
        }
      }, 50);
      function onReveal() {
        loaded = true;
        clearTimeout(timer);
        img.classList.add('media-loaded');
      }

      setupImagePlaceholderFallback(img, onReveal);

      if (galleryAlreadyHasThumb(thumbPath, loadedThumbs) || (img.complete && img.naturalWidth > 0)) {
        onReveal();
      } else {
        img.addEventListener('load', onReveal, { once: true });
        img.addEventListener('error', onReveal, { once: true });
      }
    thumb.appendChild(img);
    thumb.addEventListener('click', (function (idx) {
      return function () {
        if (domRefs.lightbox && domRefs.lightbox.classList.contains('open') && idx === state.cur) {
          return;
        }
        let d = idx === state.cur ? 0 : (idx > state.cur ? 1 : -1);
        state.cur = idx;
        openLightbox(idx, d, state.currentLightboxIsMotion);
      };
    })(i));
    thumb.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        thumb.click();
      }
    });
    track.appendChild(thumb);
  });

  initFilmstripDrag();
}

let fsVelocity = 0;
let fsTarget = 0;
let fsSyncTarget: number | null = null;
let fsSyncRaf: number | null = null;
let fsVisualScroll = 0;
let fsTransformActive = false;
let fsCommitTimer: any = null;
let fsDirectSyncTime = 0;
let fsDirectSyncValue = 0;
let fsDirectVelocity = 0;
let fsSettleTarget: number | null = null;

function getFilmstripTrack() {
  if (filmstripTrack && filmstripTrack.parentNode === filmstripEl) return filmstripTrack;
  filmstripTrack = filmstripEl.querySelector('#filmstrip-track');
  if (!filmstripTrack) {
    filmstripTrack = document.createElement('div');
    filmstripTrack.id = 'filmstrip-track';
    while (filmstripEl.firstChild) filmstripTrack.appendChild(filmstripEl.firstChild);
    filmstripEl.appendChild(filmstripTrack);
  }
  return filmstripTrack;
}

function clampFilmstripScroll(value: number): number {
  let max = Math.max(0, filmstripEl.scrollWidth - filmstripEl.clientWidth);
  return Math.max(0, Math.min(value, max));
}

function beginFilmstripTransformScroll() {
  if (!state.isMobile || fsTransformActive) return;
  fsVisualScroll = filmstripEl.scrollLeft;
  getFilmstripTrack().style.transform = 'translate3d(' + (-fsVisualScroll) + 'px, 0, 0)';
  filmstripEl.scrollLeft = 0;
  fsTransformActive = true;
}

function setFilmstripScroll(value: number) {
  value = clampFilmstripScroll(value);
  if (state.isMobile) {
    clearScheduledFilmstripCommit();
    beginFilmstripTransformScroll();
    fsVisualScroll = value;
    getFilmstripTrack().style.transform = 'translate3d(' + (-value) + 'px, 0, 0)';
  } else {
    filmstripEl.scrollLeft = value;
  }
}

function getFilmstripScroll() {
  return fsTransformActive ? fsVisualScroll : filmstripEl.scrollLeft;
}

function rememberFilmstripDirectVelocity(value: number) {
  let now = performance.now();
  if (fsDirectSyncTime) {
    let dt = now - fsDirectSyncTime;
    if (dt > 0 && dt < 80) {
      let velocity = (value - fsDirectSyncValue) / dt;
      fsDirectVelocity = fsDirectVelocity * 0.45 + velocity * 0.55;
    }
  }
  fsDirectSyncTime = now;
  fsDirectSyncValue = value;
}

let filmstripMetrics: { thumbW: number, gap: number, paddingLeft: number, elWidth: number } | null = null;

function invalidateFilmstripMetrics() {
  filmstripMetrics = null;
}

window.addEventListener('resize', invalidateFilmstripMetrics, { passive: true });
window.addEventListener('orientationchange', invalidateFilmstripMetrics, { passive: true });
window.addEventListener('lightbox-open', invalidateFilmstripMetrics, { passive: true });

function getFilmstripMetrics() {
  if (filmstripMetrics) return filmstripMetrics;

  let thumbs = filmstripEl.querySelectorAll('.filmstrip-thumb') as NodeListOf<HTMLElement>;
  if (thumbs.length < 1) return null;

  let track = getFilmstripTrack();
  let thumbW = thumbs[0].offsetWidth || 62;
  let gap = parseFloat(window.getComputedStyle(track).gap) || 5;
  let paddingLeft = parseFloat(track.style.paddingLeft) || 0;
  let elWidth = filmstripEl.offsetWidth || 300;

  filmstripMetrics = { thumbW, gap, paddingLeft, elWidth };
  return filmstripMetrics;
}

function getFilmstripTargetForPhotoProgress(progress: number): number | null {
  let metrics = getFilmstripMetrics();
  if (!metrics) return null;

  let targetCenter = metrics.paddingLeft + progress * (metrics.thumbW + metrics.gap) + metrics.thumbW / 2;
  return targetCenter - metrics.elWidth / 2;
}

export function syncFilmstripToPhotoProgress(progress: number) {
  if (state.isTouchingFilmstrip) return;
  if (fsSyncRaf) {
    cancelAnimationFrame(fsSyncRaf);
    fsSyncRaf = null;
  }
  fsSyncTarget = null;
  fsSettleTarget = null;
  if (window.fsLenis) window.fsLenis.stop();

  let target = getFilmstripTargetForPhotoProgress(progress);
  if (target !== null) {
    target = clampFilmstripScroll(target);
    rememberFilmstripDirectVelocity(target);
    setFilmstripScroll(target);
  }
}

export function settleFilmstripToPhotoProgress(progress: number) {
  if (state.isTouchingFilmstrip) return;
  let target = getFilmstripTargetForPhotoProgress(progress);
  if (target !== null) startFilmstripSettle(target);
}

export function finishFilmstripPhotoSync(progress?: number | null) {
  if (typeof progress === 'number') {
    settleFilmstripToPhotoProgress(progress);
  } else {
    if (window.fsLenis) window.fsLenis.start();
    scheduleFilmstripNativeCommit(180);
  }
}

function commitFilmstripTransformScroll() {
  if (!fsTransformActive) return;
  clearScheduledFilmstripCommit();
  let value = clampFilmstripScroll(fsVisualScroll);
  filmstripEl.scrollLeft = value;
  getFilmstripTrack().style.transform = '';
  fsTransformActive = false;
  fsVisualScroll = value;
}

function clearScheduledFilmstripCommit() {
  if (!fsCommitTimer) return;
  clearTimeout(fsCommitTimer);
  fsCommitTimer = null;
}

function scheduleFilmstripNativeCommit(delay?: number) {
  if (!state.isMobile || !fsTransformActive) {
    commitFilmstripTransformScroll();
    return;
  }
  clearScheduledFilmstripCommit();
  fsCommitTimer = setTimeout(function () {
    fsCommitTimer = null;
    requestAnimationFrame(function () {
      if (!state.fsRaf && !fsSyncRaf) commitFilmstripTransformScroll();
    });
  }, delay);
}

function resetFilmstripTransformScroll() {
  if (!filmstripEl) return;
  clearScheduledFilmstripCommit();
  fsVisualScroll = 0;
  fsTransformActive = false;
  fsDirectSyncTime = 0;
  fsDirectSyncValue = 0;
  fsDirectVelocity = 0;
  fsSettleTarget = null;
  filmstripEl.scrollLeft = 0;
  getFilmstripTrack().style.transform = '';
}

function startFilmstripSettle(target: number) {
  target = clampFilmstripScroll(target);
  let start = getFilmstripScroll();
  let distance = target - start;
  if (Math.abs(distance) < 0.5) {
    setFilmstripScroll(target);
    scheduleFilmstripNativeCommit(180);
    if (window.fsLenis) window.fsLenis.start();
    fsSettleTarget = null;
    return;
  }

  if (fsSyncRaf && fsSettleTarget !== null && Math.abs(fsSettleTarget - target) < 0.5) return;
  if (fsSyncRaf) {
    cancelAnimationFrame(fsSyncRaf);
    fsSyncRaf = null;
  }
  if (window.fsLenis) window.fsLenis.stop();

  fsSettleTarget = target;
  let startTime = 0;
  let duration = Math.max(300, Math.min(500, 250 + Math.abs(distance) * 0.4));
  let previous = start;

  function settleStep(time: number) {
    if (!startTime) startTime = time;
    let t = Math.min(1, (time - startTime) / duration);
    let ease = 1 - Math.pow(1 - t, 3);
    let next = start + distance * ease;

    if (distance > 0) next = Math.min(target, Math.max(start, next));
    else next = Math.max(target, Math.min(start, next));

    setFilmstripScroll(next);
    previous = next;
    if (t < 1) {
      fsSyncRaf = requestAnimationFrame(settleStep);
      return;
    }

    setFilmstripScroll(target);
    scheduleFilmstripNativeCommit(180);
    if (window.fsLenis) window.fsLenis.start();
    fsSyncRaf = null;
    fsSettleTarget = null;
    fsDirectVelocity = 0;
  }

  fsSyncRaf = requestAnimationFrame(settleStep);
}

// Smooth lerp loop for mobile filmstrip tracking during swipe.
// Uses frame-rate-independent exponential decay so the filmstrip
// chases the target position without jitter or abrupt transitions.
export function startFsSync(target: number) {
  if (window.fsLenis) window.fsLenis.stop();
  fsSettleTarget = null;
  fsSyncTarget = target;
  if (fsSyncRaf) return;
  let prevTime = 0;
  function syncLoop(time: number) {
    if (fsSyncTarget === null) {
      if (window.fsLenis) window.fsLenis.start();
      fsSyncRaf = null;
      return;
    }
    let dt = prevTime ? Math.min(time - prevTime, FILMSTRIP_CONFIG.syncMaxDeltaMs) : FILMSTRIP_CONFIG.syncDefaultDeltaMs;
    prevTime = time;
    let current = getFilmstripScroll();
    let diff = fsSyncTarget - current;
    if (Math.abs(diff) < 0.5) {
      setFilmstripScroll(fsSyncTarget);
      scheduleFilmstripNativeCommit(180);
      if (window.fsLenis) window.fsLenis.start();
      fsSyncRaf = null;
      fsSyncTarget = null;
      return;
    }
    let alpha = 1 - Math.exp(-FILMSTRIP_CONFIG.syncSpring * dt / 1000);
    setFilmstripScroll(current + diff * alpha);
    fsSyncRaf = requestAnimationFrame(syncLoop);
  }
  fsSyncRaf = requestAnimationFrame(syncLoop);
}

export function stopFsSync(options?: any) {
  if (state.fsRaf) { cancelAnimationFrame(state.fsRaf); state.fsRaf = null; }
  if (fsSyncRaf) { cancelAnimationFrame(fsSyncRaf); fsSyncRaf = null; }
  fsSyncTarget = null;
  fsSettleTarget = null;
  if (!options || options.commit !== false) commitFilmstripTransformScroll();
  state.isManuallyNavigating = false;
  if (window.fsLenis) window.fsLenis.start();
}

export function updateFilmstrip() {
  let oldActive = filmstripEl.querySelector('.filmstrip-thumb.active');
  if (oldActive) oldActive.classList.remove('active');

  let active = filmstripEl.querySelector('.filmstrip-thumb[data-idx="' + state.cur + '"]') as HTMLElement | null;
  if (active) {
    active.classList.add('active');
    let wrapW = filmstripEl.offsetWidth;
    let thumbL = active.offsetLeft;
    let thumbW = active.offsetWidth;
    fsTarget = thumbL - wrapW / 2 + thumbW / 2;
    if (!state.isMobile || state.isManuallyNavigating) {
      if (state.fsRaf || fsSyncRaf) {
        // If already animating, drop into lerp mode for smooth continuous chasing
        if (state.fsRaf) {
          cancelAnimationFrame(state.fsRaf);
          state.fsRaf = null;
        }
        startFsSync(fsTarget);
      } else {
        // Cold start: play strict smooth ease-out
        stopFsSync({ commit: false });
        // Stop lenis immediately so it doesn't fight the RAF animation from frame 0
        if (window.fsLenis) window.fsLenis.stop();
        let startPos = getFilmstripScroll();
        // Pre-seed startTime so frame 1 has a real elapsed value (no dead first frame)
        let startTime = performance.now();
        let duration = FILMSTRIP_CONFIG.scrollDuration;

        function step(time: number) {
          let elapsed = time - startTime;
          if (elapsed >= duration) {
            setFilmstripScroll(fsTarget);
            scheduleFilmstripNativeCommit(180);
            if (window.fsLenis) window.fsLenis.start();
            state.fsRaf = null;
            state.isManuallyNavigating = false;
            return;
          }
          // easeOutCubic — no ease-in, starts moving immediately
          let t = Math.min(1, elapsed / duration);
          let ease = 1 - Math.pow(1 - t, 3);
          setFilmstripScroll(startPos + (fsTarget - startPos) * ease);
          state.fsRaf = requestAnimationFrame(step);
        }
        state.fsRaf = requestAnimationFrame(step);
      }
    } else {
      if (!state.isTouchingFilmstrip) startFsSync(fsTarget);
    }
  }
}

let isUserInteracting = false;
domRefs.lightbox.addEventListener('touchstart', function () {
  isUserInteracting = true;
  clearTimeout(state.filmstripHideTimer);
}, { passive: true });
window.addEventListener('touchend', function () {
  isUserInteracting = false;
  state.isTouchingFilmstrip = false;
  if (filmstripWrap.classList.contains('visible')) {
    clearTimeout(state.filmstripHideTimer);
    state.filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.activeHideDelay);
  }
}, { passive: true });

domRefs.lightbox.addEventListener('mousedown', function () {
  isUserInteracting = true;
  clearTimeout(state.filmstripHideTimer);
}, { passive: true });
window.addEventListener('mouseup', function () {
  isUserInteracting = false;
  state.isTouchingFilmstrip = false;
  if (filmstripWrap.classList.contains('visible')) {
    clearTimeout(state.filmstripHideTimer);
    state.filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.activeHideDelay);
  }
}, { passive: true });

export function showFilmstrip() {
  buildFilmstrip();
  updateFilmstrip();
  filmstripWrap.classList.add('visible');
  domRefs.lightbox.classList.add('filmstrip-visible');
  clearTimeout(state.filmstripHideTimer);
  if (!isUserInteracting) {
    state.filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.activeHideDelay);
  }
}

export function hideFilmstrip() {
  // Don't hide if the cursor is still in the wrap or the lift zone
  if (filmstripWrap.matches(':hover') || (liftZone && liftZone.matches(':hover'))) {
    state.filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.hoverRetryDelay);
    return;
  }
  filmstripWrap.classList.remove('visible');
  domRefs.lightbox.classList.remove('filmstrip-visible');
}

// keep filmstrip visible while hovering it
filmstripWrap.addEventListener('mouseenter', function () { clearTimeout(state.filmstripHideTimer); });
filmstripWrap.addEventListener('mouseleave', function () {
  // grace period — prevents flicker and allows cursor to move back in
  state.filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.mouseLeaveDelay);
});
filmstripWrap.addEventListener('touchstart', function () {
  clearTimeout(state.filmstripHideTimer);
  state.isTouchingFilmstrip = true;
  stopFsSync();
}, { passive: true });
filmstripWrap.addEventListener('touchend', function () {
  state.filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.touchHideDelay);
  state.isTouchingFilmstrip = false;
}, { passive: true });

// invisible lift zone — hovering bottom of screen revives hidden filmstrip
if (liftZone) {
  liftZone.addEventListener('mouseenter', function () {
    clearTimeout(state.filmstripHideTimer);
    showFilmstrip();
  });
  liftZone.addEventListener('mouseleave', function () {
    // if mouse left lift zone without entering filmstrip, wait a bit
    state.filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.liftZoneLeaveDelay);
  });
}

// Capture wheel events early to trigger UI logic (scroll handled by fsLenis)
filmstripWrap.addEventListener('wheel', function (e) {
  stopFsSync();
  clearTimeout(state.filmstripHideTimer);
  state.filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.touchHideDelay);
}, { passive: true, capture: true });

// click-drag scroll
function initFilmstripDrag() {
  let isDragging = false;
  let dragStartX = 0;
  let scrollStart = 0;
  let dragMoved = false;

  filmstripEl.addEventListener('mousedown', function (e) {
    isDragging = true;
    dragMoved = false;
    state.isTouchingFilmstrip = true;
    stopFsSync();
    if (window.fsLenis) window.fsLenis.stop();
    dragStartX = e.clientX;
    scrollStart = filmstripEl.scrollLeft;
    filmstripEl.classList.add('dragging');
    clearTimeout(state.filmstripHideTimer);
  });

  document.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    let dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 3) dragMoved = true;
    filmstripEl.scrollLeft = scrollStart - dx;
  });

  document.addEventListener('mouseup', function () {
    if (!isDragging) return;
    isDragging = false;
    filmstripEl.classList.remove('dragging');
    if (window.fsLenis) window.fsLenis.start();
    state.filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.dragHideDelay);
  });

  // suppress click on thumbs if we just dragged
  filmstripEl.addEventListener('click', function (e) {
    if (dragMoved) { e.stopPropagation(); dragMoved = false; }
  }, true);
}

setFilmstripVisibilityHandlers({
  show: showFilmstrip,
  hide: hideFilmstrip
});
