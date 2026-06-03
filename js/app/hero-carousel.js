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

function waitForDecodedImage(img, timeoutMs) {
  return new Promise(resolve => {
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

let rowState = ROW_CONFIG.map(function (c) { return { dir: c.dir, offset: 0, setWidth: 0 }; });
let easeFrame = 0;

// Drag states
let isDragging = false;
let dragRowIndex = -1;
let dragStartX = 0;
let dragStartY = 0;
let dragStartOffset = 0;
let globalHasDragged = false;

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

  if (state.carouselPhotos.length === 0) { carouselReadyCallback(); startLoopsIfReady(); return; }

  // rows stay visible; eager images handle their own fade-in
  activeRows.forEach(function (r) { r.style.opacity = '1'; });

  let groups = [];
  for (let g = 0; g < activeRowCount; g++) groups.push([]);
  state.carouselPhotos.forEach(function (p, i) { groups[i % activeRowCount].push(p); });

  let eagerImgs = [];

  activeRows.forEach(function (row, ri) {
    // Add event listeners for mouse/touch down
    row.addEventListener('mousedown', function (e) {
      isDragging = true;
      dragRowIndex = ri;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartOffset = rowState[ri].offset;
      globalHasDragged = false;
    });

    row.addEventListener('touchstart', function (e) {
      if (e.touches.length > 0) {
        isDragging = true;
        dragRowIndex = ri;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        dragStartOffset = rowState[ri].offset;
        globalHasDragged = false;
      }
    }, { passive: true });

    let group = groups[ri].length > 0 ? groups[ri] : state.carouselPhotos;
    let copies = Math.max(2, Math.ceil((window.innerWidth * 3) / 220 / group.length));

    for (let c = 0; c < copies * 2; c++) {
      group.forEach(function (p) {
        let img = document.createElement('img');
        let thumbPath = p.thumb || p.src.replace('photos/', 'photos/thumbs/');
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
        img.addEventListener('click', function (e) {
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
        row.appendChild(img);
      });
    }
  });

  let total = eagerImgs.length;

  function finishCarouselReady() {
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

  if (total === 0) {
    activeRows.forEach(function (r) { r.style.opacity = '1'; });
    carouselReadyCallback();
    startLoopsIfReady();
    return;
  }

  Promise.all(eagerImgs.map(function (img) {
    return waitForDecodedImage(img, 1800);
  })).then(finishCarouselReady);
}

export function tick() {
  if (!state.heroVisible || !state.pageVisible) { state.heroRafId = null; return; }
  let rows = state.isMobile ? domRefs.heroRows : domRefs.heroRows.slice(0, 3);

  const isLifting = !domRefs.loader || domRefs.loader.classList.contains('lifting') || domRefs.loader.style.display === 'none';
  let speed = isLifting ? getCurrentSpeed(easeFrame) : 0;
  if (isLifting && easeFrame < EASE_FRAMES + 10) easeFrame++;

  let px = [state.heroScrollY * 0.18, -state.heroScrollY * 0.12, state.heroScrollY * 0.22, -state.heroScrollY * 0.15];

  rowState.forEach(function (state, ri) {
    if (ri >= rows.length) return;
    if (isDragging && dragRowIndex === ri) {
      rows[ri].style.transform = 'translateX(' + (state.offset + px[ri]) + 'px)';
      return;
    }
    state.offset += speed * state.dir;
    if (state.setWidth > 0) {
      if (state.dir === -1 && state.offset < -state.setWidth) state.offset += state.setWidth;
      if (state.dir === 1 && state.offset > 0) state.offset -= state.setWidth;
    }
    rows[ri].style.transform = 'translateX(' + (state.offset + px[ri]) + 'px)';
  });

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
  let newOffset = dragStartOffset + dx;
  let setWidth = rowState[ri].setWidth;
  if (setWidth > 0) {
    if (newOffset < -setWidth) {
      newOffset += setWidth;
      dragStartX -= setWidth;
      dragStartOffset += setWidth;
    } else if (newOffset > 0) {
      newOffset -= setWidth;
      dragStartX += setWidth;
      dragStartOffset -= setWidth;
    }
  }
  rowState[ri].offset = newOffset;
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
  let newOffset = dragStartOffset + dx;
  let setWidth = rowState[ri].setWidth;
  if (setWidth > 0) {
    if (newOffset < -setWidth) {
      newOffset += setWidth;
      dragStartX -= setWidth;
      dragStartOffset += setWidth;
    } else if (newOffset > 0) {
      newOffset -= setWidth;
      dragStartX += setWidth;
      dragStartOffset -= setWidth;
    }
  }
  rowState[ri].offset = newOffset;
}, { passive: false });

function endDrag() {
  isDragging = false;
  dragRowIndex = -1;
}

window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);
