import { APP_CONFIG } from './config.js';
import { domRefs } from './dom.js';
import { state } from './state.js';
import { getInternalCategory } from './media-data.js';
import { openLightbox } from './lightbox.js';
import { rebuildGallery } from './gallery.js';
import { startLoopsIfReady } from './core.js';
import { getPhotoAspectRatio, setupImagePlaceholderFallback } from './utils.js';

// CAROUSEL
let ROW_CONFIG = [{ dir: -1 }, { dir: 1 }, { dir: -1 }];

// Custom horizontal focus points (object-position) for mobile carousel images under the 0.75 ratio clamp.
// Maps photo filename to an object-position value (e.g. '30% center', 'left center', etc.).
const CAROUSEL_FOCUS_POINTS: Record<string, string> = {
  'fog-motorcycle.webp': '30% center',
  // Add other cropped photos here as needed
};

let CAROUSEL_CONFIG = APP_CONFIG.carousel;

function computeCruiseSpeed(): number {
  return state.isMobile
    ? CAROUSEL_CONFIG.cruiseSpeed.mobile
    : (window.innerWidth < CAROUSEL_CONFIG.desktopBreakpoint
      ? CAROUSEL_CONFIG.cruiseSpeed.tablet
      : CAROUSEL_CONFIG.cruiseSpeed.desktop);
}

// cruise speed scaled by device — mobile narrower so same px/frame looks faster
let CRUISE_SPEED = computeCruiseSpeed();
let EASE_FRAMES = CAROUSEL_CONFIG.easeFrames;
let START_SPEED_MULT = CAROUSEL_CONFIG.startSpeedMultiplier;
let carouselReadyCallback = function () { };

export function setCarouselReadyCallback(callback: (() => void) | null) {
  carouselReadyCallback = typeof callback === 'function' ? callback : function () { };
}

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
function getCurrentSpeed(frame: number) {
  if (frame >= EASE_FRAMES) return CRUISE_SPEED;
  let t = frame / EASE_FRAMES;
  return CRUISE_SPEED * START_SPEED_MULT + (CRUISE_SPEED - CRUISE_SPEED * START_SPEED_MULT) * easeOutCubic(t);
}

function waitForDecodedImage(img: HTMLImageElement, timeoutMs: number) {
  return new Promise<void>(resolve => {
    let settled = false;
    const done = function () {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, timeoutMs || 1800);

    function finish() {
      if (img.decode) img.decode().then(done).catch(done);
      else done();
    }

    img.addEventListener('load', finish, { once: true });
    img.addEventListener('error', done, { once: true });
    if (img.complete) finish();
  });
}

let rowState = ROW_CONFIG.map(function (c) {
  return {
    dir: c.dir,
    offset: 0,
    setWidth: 0,
    velocity: 0,
    hasMomentum: false
  };
});
let easeFrame = 0;

// Drag states
let isDragging = false;
let dragRowIndex = -1;
let dragStartX = 0;
let dragStartY = 0;
let dragStartOffset = 0;
let dragWrapAdjust = 0; // cumulative setWidth corrections during a drag
let globalHasDragged = false;
let dragHistory: { x: number; time: number }[] = [];

export function buildCarousel(isRebuild = false) {
  let rows = domRefs.heroRows;

  CRUISE_SPEED = computeCruiseSpeed();

  // Clear existing images before building/rebuilding to avoid duplicates
  rows.forEach(function (r) { r.innerHTML = ''; });

  let activeRows = rows;
  let activeRowCount = activeRows.length;

  if (state.carouselPhotos.length === 0) { carouselReadyCallback(); startLoopsIfReady(); return; }

  // rows stay visible; eager images handle their own fade-in
  activeRows.forEach(function (r) { r.style.opacity = '1'; });

  let groups: any[][] = [];
  for (let g = 0; g < activeRowCount; g++) groups.push([]);
  state.carouselPhotos.forEach(function (p, i) { groups[i % activeRowCount].push(p); });

  let eagerImgs: HTMLImageElement[] = [];
  let criticalImgs: HTMLImageElement[] = [];

  activeRows.forEach(function (row, ri) {
    let group = groups[ri].length > 0 ? groups[ri] : state.carouselPhotos;
    let copies = Math.max(2, Math.ceil((window.innerWidth * 1.5) / 220 / group.length));

    for (let c = 0; c < copies * 2; c++) {
      group.forEach(function (p, pi) {
        let wrapper = document.createElement('div');
        wrapper.className = 'carousel-item';
        let ratio = getPhotoAspectRatio(p);
        if (state.isMobile) {
          ratio = Math.min(ratio, 0.75);
        }
        wrapper.style.setProperty('--carousel-photo-ratio', String(ratio));

        let img = document.createElement('img');
        let thumbPath = p.thumb || p.src.replace('photos/', 'photos/thumbs/');
        img.src = thumbPath; img.alt = p.title; img.draggable = false;

        if (state.isMobile) {
          const filename = p.src.split('/').pop() || '';
          if (CAROUSEL_FOCUS_POINTS[filename]) {
            img.style.objectPosition = CAROUSEL_FOCUS_POINTS[filename];
          }
        }

        function reveal() {
          wrapper.classList.add('photo-loaded');
        }

        setupImagePlaceholderFallback(img, reveal);

        if (isRebuild && img.complete) {
          wrapper.classList.add('no-transition');
          wrapper.classList.add('photo-loaded');
          setTimeout(function () {
            wrapper.classList.remove('no-transition');
          }, 50);
        } else {
          img.addEventListener('error', reveal, { once: true });

          if (c === 0) {
            img.loading = 'eager';
            img.addEventListener('load', reveal);
            eagerImgs.push(img);
            if (pi === 0) {
              criticalImgs.push(img);
            }
          } else {
            img.loading = 'lazy';
            img.addEventListener('load', reveal);
          }

          if (img.complete) {
            reveal();
          }
        }

        wrapper.addEventListener('click', function (e) {
          if (globalHasDragged) return;
          let targetCat = (p.category === 'figures') ? 'figures' : 'all';
          if (state.currentCategory === targetCat) {
            let idx = state.activePhotos.findIndex(item => (item.id && item.id === p.id) || item.src === p.src);
            if (idx >= 0) openLightbox(idx);
          } else {
            rebuildGallery(targetCat, {
              onReady: function () {
                let idx = state.activePhotos.findIndex(item => (item.id && item.id === p.id) || item.src === p.src);
                if (idx >= 0) openLightbox(idx);
              }
            });
          }
        });

        wrapper.appendChild(img);
        row.appendChild(wrapper);
      });
    }
  });

  let total = eagerImgs.length;

  function finishCarouselReady() {
    // defer to next paint — Firefox offsetWidth is 0 if read before layout pass
    requestAnimationFrame(function () {
      activeRows.forEach(function (row, ri) {
        let items = Array.from(row.querySelectorAll('.carousel-item')) as HTMLElement[];
        let halfCount = Math.floor(items.length / 2);
        let w = 0;
        for (let i = 0; i < halfCount; i++) {
          w += (items[i].offsetWidth || 220) + 8;
        }
        rowState[ri].setWidth = w > 0 ? w : halfCount * 230;
        rowState[ri].offset = ROW_CONFIG[ri].dir === 1 ? -rowState[ri].setWidth : 0;
      });
      rowState.forEach(function (st, idx) {
        if (idx >= activeRowCount) {
          st.offset = 0;
          st.setWidth = 0;
        }
      });
      activeRows.forEach(function (r) { r.style.opacity = '1'; }); // already visible, belt-and-suspenders
      carouselReadyCallback();
      startLoopsIfReady();
    });
  }

  if (total === 0) {
    activeRows.forEach(function (r) { r.style.opacity = '1'; });
    carouselReadyCallback();
    startLoopsIfReady();
    return;
  }

  const imgsToWaitFor = eagerImgs.length > 0 ? eagerImgs : criticalImgs;

  Promise.all(imgsToWaitFor.map(function (img) {
    return waitForDecodedImage(img, 2500);
  })).then(finishCarouselReady);
}

let lastTime = 0;

export function tick(timestamp: number) {
  try {
    if (!state.heroVisible || !state.pageVisible) {
      state.heroRafId = null;
      lastTime = 0;
      return;
    }

    if (!timestamp) timestamp = performance.now();
    if (!lastTime) lastTime = timestamp;

    let dt = timestamp - lastTime;
    lastTime = timestamp;

    if (dt > 100) dt = 16.67;
    let frameScale = dt / 16.67;
    let rows = domRefs.heroRows;

    const isLifting = !domRefs.loader || domRefs.loader.classList.contains('lifting') || domRefs.loader.style.display === 'none';
    let targetSpeed = isLifting ? getCurrentSpeed(easeFrame) : 0;
    if (isLifting && easeFrame < EASE_FRAMES + 10) easeFrame += frameScale;

    let px = [state.heroScrollY * 0.18, -state.heroScrollY * 0.12, state.heroScrollY * 0.22];

    let friction = state.isMobile
      ? (CAROUSEL_CONFIG.friction?.mobile ?? 0.985)
      : (CAROUSEL_CONFIG.friction?.desktop ?? 0.93);
    let decayFactor = Math.pow(friction, frameScale);

    rowState.forEach(function (rowSt, ri) {
      if (ri >= rows.length) return;
      if (isDragging && dragRowIndex === ri) {
        rows[ri].style.transform = 'translate3d(' + (rowSt.offset + px[ri]) + 'px, 0, 0)';
        return;
      }

      let targetVel = targetSpeed * rowSt.dir;

      if (rowSt.hasMomentum) {
        rowSt.velocity = targetVel + (rowSt.velocity - targetVel) * decayFactor;
        if (Math.abs(rowSt.velocity - targetVel) < 0.05) {
          rowSt.velocity = targetVel;
          rowSt.hasMomentum = false;
        }
      } else {
        rowSt.velocity = targetVel;
      }

      rowSt.offset += rowSt.velocity * frameScale;

      if (rowSt.setWidth > 0) {
        while (rowSt.offset < -rowSt.setWidth) rowSt.offset += rowSt.setWidth;
        while (rowSt.offset > 0) rowSt.offset -= rowSt.setWidth;
      }
      rows[ri].style.transform = 'translate3d(' + (rowSt.offset + px[ri]) + 'px, 0, 0)';
    });
  } catch (error) {
    console.error('Error in hero carousel tick loop:', error);
    state.heroRafId = null;
    return;
  }

  state.heroRafId = requestAnimationFrame(tick);
}

// Window listeners for moving/releasing drag
window.addEventListener('mousemove', function (e) {
  if (!isDragging || dragRowIndex === -1) return;
  let dx = e.clientX - dragStartX;
  if (Math.abs(dx) > 5) {
    globalHasDragged = true;
  }

  let ri = dragRowIndex;
  let setWidth = rowState[ri].setWidth;
  let rawOffset = dragStartOffset + dragWrapAdjust + dx;
  if (setWidth > 0) {
    while (rawOffset < -setWidth) { rawOffset += setWidth; dragWrapAdjust += setWidth; }
    while (rawOffset > 0) { rawOffset -= setWidth; dragWrapAdjust -= setWidth; }
  }
  rowState[ri].offset = rawOffset;

  let now = performance.now();
  dragHistory.push({ x: e.clientX, time: now });
  dragHistory = dragHistory.filter(item => now - item.time <= 100);
});

window.addEventListener('touchmove', function (e) {
  if (!isDragging || dragRowIndex === -1 || !e.touches || e.touches.length === 0) return;
  let clientX = e.touches[0].clientX;
  let clientY = e.touches[0].clientY;

  let dx = clientX - dragStartX;
  let dy = clientY - dragStartY;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (e.cancelable) e.preventDefault();
  }

  if (Math.abs(dx) > 5) {
    globalHasDragged = true;
  }

  let ri = dragRowIndex;
  let setWidth = rowState[ri].setWidth;
  let rawOffset = dragStartOffset + dragWrapAdjust + dx;
  if (setWidth > 0) {
    while (rawOffset < -setWidth) { rawOffset += setWidth; dragWrapAdjust += setWidth; }
    while (rawOffset > 0) { rawOffset -= setWidth; dragWrapAdjust -= setWidth; }
  }
  rowState[ri].offset = rawOffset;

  let now = performance.now();
  dragHistory.push({ x: clientX, time: now });
  dragHistory = dragHistory.filter(item => now - item.time <= 100);
}, { passive: false });

function endDrag() {
  if (isDragging && dragRowIndex !== -1) {
    let ri = dragRowIndex;
    if (globalHasDragged) {
      let now = performance.now();
      let recentHistory = dragHistory.filter(item => now - item.time <= 100);
      let releaseVelocity = 0;
      if (recentHistory.length >= 2) {
        let first = recentHistory[0];
        let last = recentHistory[recentHistory.length - 1];
        let dt = last.time - first.time;
        let dx = last.x - first.x;
        if (dt > 10) {
          // Convert from pixels/ms to pixels/frame (at 16.67ms per frame)
          releaseVelocity = (dx / dt) * 16.67;
        }
      }
      rowState[ri].velocity = releaseVelocity;
      rowState[ri].hasMomentum = true;
    }
  }
  isDragging = false;
  dragRowIndex = -1;
}

window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);

export function recalculateCarouselLayout() {
  CRUISE_SPEED = computeCruiseSpeed();

  let rows = domRefs.heroRows;
  
  let activeRows = rows;
  let activeRowCount = activeRows.length;

  activeRows.forEach(function (row, ri) {
    let imgs = Array.from(row.querySelectorAll('img'));
    if (imgs.length === 0) return;

    let halfCount = Math.floor(imgs.length / 2);
    let w = 0;
    for (let i = 0; i < halfCount; i++) w += (imgs[i].offsetWidth || 220) + 10;

    let oldSetWidth = rowState[ri].setWidth;
    let newSetWidth = w > 0 ? w : halfCount * 230;

    rowState[ri].setWidth = newSetWidth;

    if (newSetWidth > 0 && oldSetWidth > 0) {
      let pct = rowState[ri].offset / oldSetWidth;
      rowState[ri].offset = pct * newSetWidth;
    } else {
      if (ROW_CONFIG[ri].dir === 1) rowState[ri].offset = -newSetWidth;
    }
  });

  rowState.forEach(function (st, idx) {
    if (idx >= activeRowCount) {
      st.offset = 0;
      st.setWidth = 0;
    }
  });
}

// Bind row drag events once on load
domRefs.heroRows.forEach(function (row, ri) {
  if (!row) return;
  row.addEventListener('mousedown', function (e) {
    isDragging = true;
    dragRowIndex = ri;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartOffset = rowState[ri].offset;
    dragWrapAdjust = 0;
    globalHasDragged = false;
    dragHistory = [{ x: e.clientX, time: performance.now() }];
    rowState[ri].velocity = 0;
    rowState[ri].hasMomentum = false;
  });

  row.addEventListener('dragstart', function (e) {
    e.preventDefault();
  });

  row.addEventListener('touchstart', function (e) {
    if (e.touches.length > 0) {
      isDragging = true;
      dragRowIndex = ri;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      dragStartOffset = rowState[ri].offset;
      dragWrapAdjust = 0;
      globalHasDragged = false;
      dragHistory = [{ x: e.touches[0].clientX, time: performance.now() }];
      rowState[ri].velocity = 0;
      rowState[ri].hasMomentum = false;
    }
  }, { passive: true });
});

/* 
 * SAVED EXPOSURE PULSE IMPLEMENTATION (For future reuse):
 * 
 * export function triggerExposurePulse() {
 *   easeFrame = 0;
 *   const items: { img: HTMLElement; dist: number }[] = [];
 *   let minDist = Infinity;
 *   let maxDist = -Infinity;
 *   const viewWidth = window.innerWidth;
 * 
 *   domRefs.heroRows.forEach((row) => {
 *     if (!row) return;
 *     const children = row.querySelectorAll('.carousel-item');
 *     children.forEach((child) => {
 *       const el = child as HTMLElement;
 *       const img = el.querySelector('img');
 *       if (!img) return;
 *       const rect = el.getBoundingClientRect();
 *       if (rect.right < -150 || rect.left > viewWidth + 150) return;
 *       const dist = Math.max(0, rect.left) + rect.top * 1.1;
 *       if (dist < minDist) minDist = dist;
 *       if (dist > maxDist) maxDist = dist;
 *       items.push({ img: img as HTMLElement, dist });
 *     });
 *   });
 *   if (items.length === 0) return;
 *   const spread = maxDist - minDist || 1;
 *   const startOffset = 170;
 *   const maxDelay = 520;
 *   const animDuration = 1150;
 * 
 *   items.forEach(({ img }) => { img.classList.remove('exposure-pulse'); });
 *   if (items.length > 0) { void items[0].img.offsetWidth; }
 *   items.forEach(({ img, dist }) => {
 *     const norm = Math.max(0, (dist - minDist) / spread);
 *     const delay = startOffset + Math.round(norm * maxDelay);
 *     img.style.animationDelay = `${delay}ms`;
 *     img.classList.add('exposure-pulse');
 *     const cleanUp = () => {
 *       img.removeEventListener('animationend', cleanUp);
 *       img.classList.remove('exposure-pulse');
 *       img.style.animationDelay = '';
 *     };
 *     img.addEventListener('animationend', cleanUp, { once: true });
 *     setTimeout(cleanUp, delay + animDuration + 100);
 *   });
 * }
 */

export function triggerExposurePulse() {
  easeFrame = 0;
}


