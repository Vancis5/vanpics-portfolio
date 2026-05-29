import { APP_CONFIG } from './config.js';
import { domRefs } from './dom.js';
import { state } from './state.js';
import { getInternalCategory } from './media-data.js';
import { openLightbox } from './lightbox.js';
import { rebuildGallery } from './gallery.js';
import { startLoopsIfReady } from './core.js';

// CAROUSEL
let ROW_CONFIG = [{ dir: -1 }, { dir: 1 }, { dir: -1 }, { dir: 1 }];
let CAROUSEL_CONFIG = APP_CONFIG.carousel;
// cruise speed scaled by device — mobile narrower so same px/frame looks faster
let CRUISE_SPEED = state.isMobile
  ? CAROUSEL_CONFIG.cruiseSpeed.mobile
  : (window.innerWidth < CAROUSEL_CONFIG.desktopBreakpoint
    ? CAROUSEL_CONFIG.cruiseSpeed.tablet
    : CAROUSEL_CONFIG.cruiseSpeed.desktop);
let EASE_FRAMES = CAROUSEL_CONFIG.easeFrames;
let START_SPEED_MULT = CAROUSEL_CONFIG.startSpeedMultiplier;
let carouselReadyCallback = function () {};

export function setCarouselReadyCallback(callback) {
  carouselReadyCallback = typeof callback === 'function' ? callback : function () {};
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function getCurrentSpeed(frame) {
  if (frame >= EASE_FRAMES) return CRUISE_SPEED;
  let t = frame / EASE_FRAMES;
  return CRUISE_SPEED * START_SPEED_MULT + (CRUISE_SPEED - CRUISE_SPEED * START_SPEED_MULT) * easeOutCubic(t);
}

let rowState = ROW_CONFIG.map(function (c) { return { dir: c.dir, offset: 0, setWidth: 0 }; });
let easeFrame = 0;

export function buildCarousel() {
  let rows = domRefs.heroRows;

  // show/hide row-3 based on device
  if (state.isMobile) {
    rows[3].style.display = 'flex';
  } else {
    rows[3].style.display = 'none';
  }

  let activeRows = state.isMobile ? rows : rows.slice(0, 3);
  let activeRowCount = activeRows.length;

  if (state.carouselPhotos.length === 0) { startLoopsIfReady(); return; }

  // rows stay visible; eager images handle their own fade-in
  activeRows.forEach(function (r) { r.style.opacity = '1'; });

  let groups = [];
  for (let g = 0; g < activeRowCount; g++) groups.push([]);
  state.carouselPhotos.forEach(function (p, i) { groups[i % activeRowCount].push(p); });

  let eagerImgs = [];

  activeRows.forEach(function (row, ri) {
    let group = groups[ri].length > 0 ? groups[ri] : state.carouselPhotos;
    let copies = Math.max(2, Math.ceil((window.innerWidth * 3) / 220 / group.length));

    for (let c = 0; c < copies * 2; c++) {
      group.forEach(function (p) {
        let img = document.createElement('img');
        let thumbPath = p.src.replace('photos/', 'photos/thumbs/');
        img.src = thumbPath; img.alt = p.title; img.draggable = false;
        if (c === 0) {
          img.loading = 'eager';
          // start invisible — fade in on load so images don't cut in on cold load
          img.style.opacity = '0';
          img.addEventListener('load', function () { img.style.opacity = '1'; });
          img.addEventListener('error', function () { img.style.opacity = '1'; });
          eagerImgs.push(img);
        } else {
          img.loading = 'lazy';
        }
        img.addEventListener('click', function () {
          let targetCat = (p.category === 'figures') ? 'figures' : 'all';
          if (state.currentCategory === targetCat) {
            let idx = state.activePhotos.indexOf(p);
            if (idx >= 0) openLightbox(idx);
          } else {
            rebuildGallery(targetCat, {
              onReady: function () {
                let idx = state.activePhotos.indexOf(p);
                if (idx >= 0) openLightbox(idx);
              }
            });
          }
        });
        row.appendChild(img);
      });
    }
  });

  let loaded = 0;
  let total = eagerImgs.length;

  function onImageReady() {
    if (++loaded < total) return;
    // defer to next paint — Firefox offsetWidth is 0 if read before layout pass
    requestAnimationFrame(function () {
      activeRows.forEach(function (row, ri) {
        let group = groups[ri].length > 0 ? groups[ri] : state.carouselPhotos;
        let copies = Math.max(2, Math.ceil((window.innerWidth * 3) / 220 / group.length));
        let imgs = Array.from(row.querySelectorAll('img'));
        let w = 0;
        for (let i = 0; i < group.length * copies && i < imgs.length; i++) w += (imgs[i].offsetWidth || 220) + 10;
        rowState[ri].setWidth = w > 0 ? w : group.length * copies * 230;
        if (ROW_CONFIG[ri].dir === 1) rowState[ri].offset = -rowState[ri].setWidth;
      });
      activeRows.forEach(function (r) { r.style.opacity = '1'; }); // already visible, belt-and-suspenders
      carouselReadyCallback();
      startLoopsIfReady();
    });
  }

  if (total === 0) { activeRows.forEach(function (r) { r.style.opacity = '1'; }); startLoopsIfReady(); return; }
  eagerImgs.forEach(function (img) {
    let counted = false;
    function countOnce() { if (!counted) { counted = true; onImageReady(); } }
    img.addEventListener('load', countOnce);
    img.addEventListener('error', countOnce);
    if (img.complete) {
      // already cached — decode() waits for pixel decode before resolving
      if (img.decode) {
        img.decode().then(countOnce).catch(countOnce);
      } else {
        // no decode() — nudge src to retrigger load event (cached, no network hit)
        let s = img.src; img.src = ''; img.src = s;
      }
    }
  });
}

export function tick() {
  if (!state.heroVisible || !state.pageVisible) { state.heroRafId = null; return; }
  let rows = state.isMobile ? domRefs.heroRows : domRefs.heroRows.slice(0, 3);
  let speed = getCurrentSpeed(easeFrame);
  if (easeFrame < EASE_FRAMES + 10) easeFrame++;

  let px = [state.heroScrollY * 0.18, -state.heroScrollY * 0.12, state.heroScrollY * 0.22, -state.heroScrollY * 0.15];

  rowState.forEach(function (state, ri) {
    if (ri >= rows.length) return;
    state.offset += speed * state.dir;
    if (state.setWidth > 0) {
      if (state.dir === -1 && state.offset < -state.setWidth) state.offset += state.setWidth;
      if (state.dir === 1 && state.offset > 0) state.offset -= state.setWidth;
    }
    rows[ri].style.transform = 'translateX(' + (state.offset + px[ri]) + 'px)';
  });

  state.heroRafId = requestAnimationFrame(tick);
}
