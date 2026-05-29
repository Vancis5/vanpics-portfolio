// FILMSTRIP
let filmstripWrap = domRefs.filmstripWrap;
let filmstripEl = domRefs.filmstrip;
let filmstripTrack = null;
let filmstripHideTimer = null;
let filmstripBuilt = false;
let FILMSTRIP_CONFIG = window.APP_CONFIG.filmstrip;
window.addEventListener('category-change', function () {
  filmstripBuilt = false;
  if (typeof filmstripEl !== 'undefined' && filmstripEl) {
    getFilmstripTrack().innerHTML = '';
  }
  // Also reset mobile slides if they exist
  let imgWrap = domRefs.lightboxImgWrap;
  if (imgWrap) {
    let slides = imgWrap.querySelectorAll('.snap-slide');
    for (let i = 0; i < slides.length; i++) slides[i].remove();
  }
});
let liftZone = domRefs.filmstripLiftZone;

function buildFilmstrip() {
  if (filmstripBuilt) return;
  filmstripBuilt = true;

  let currentSet = currentLightboxIsMotion ? motionProjects : activePhotos;

  // Photos: 52px thumb + gap, Motion: 78px thumb
  let THUMB_W = currentLightboxIsMotion ? (window.innerWidth >= 640 ? 78 : 68) : (window.innerWidth >= 640 ? 62 : 52);
  let pad = (window.innerWidth / 2) - (THUMB_W / 2);
  let track = getFilmstripTrack();
  track.style.paddingLeft = pad + 'px';
  track.style.paddingRight = pad + 'px';
  track.innerHTML = '';

  currentSet.forEach(function (p, i) {
    let thumb = document.createElement('div');
    thumb.className = 'filmstrip-thumb';
    if (currentLightboxIsMotion) thumb.classList.add('mode-motion');
    thumb.dataset.idx = i;
    let img = document.createElement('img');
    let thumbPath = currentLightboxIsMotion ? p.thumb : p.src.replace('photos/', 'photos/thumbs/');
    img.src = thumbPath;
    img.alt = p.title;
    img.loading = 'lazy';
    thumb.appendChild(img);
    thumb.addEventListener('click', (function (idx) {
      return function () {
        let d = idx === cur ? 0 : (idx > cur ? 1 : -1);
        cur = idx;
        openLightbox(idx, d, currentLightboxIsMotion);
      };
    })(i));
    track.appendChild(thumb);
  });

  initFilmstripDrag();
}

let fsRaf = null;
let fsVelocity = 0;
let fsTarget = 0;
let isManuallyNavigating = false;
let isTouchingFilmstrip = false;
let fsSyncTarget = null;
let fsSyncRaf = null;
let fsVisualScroll = 0;
let fsTransformActive = false;

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

function clampFilmstripScroll(value) {
  let max = Math.max(0, filmstripEl.scrollWidth - filmstripEl.clientWidth);
  return Math.max(0, Math.min(value, max));
}

function beginFilmstripTransformScroll() {
  if (!isMobile || fsTransformActive) return;
  fsVisualScroll = filmstripEl.scrollLeft;
  getFilmstripTrack().style.transform = 'translate3d(' + (-fsVisualScroll) + 'px, 0, 0)';
  filmstripEl.scrollLeft = 0;
  fsTransformActive = true;
}

function setFilmstripScroll(value) {
  value = clampFilmstripScroll(value);
  if (isMobile) {
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

function commitFilmstripTransformScroll() {
  if (!fsTransformActive) return;
  let value = clampFilmstripScroll(fsVisualScroll);
  filmstripEl.scrollLeft = value;
  getFilmstripTrack().style.transform = '';
  fsTransformActive = false;
  fsVisualScroll = value;
}

// Smooth lerp loop for mobile filmstrip tracking during swipe.
// Uses frame-rate-independent exponential decay so the filmstrip
// chases the target position without jitter or abrupt transitions.
function startFsSync(target) {
  if (window.fsLenis) window.fsLenis.stop();
  fsSyncTarget = target;
  if (fsSyncRaf) return;
  let prevTime = 0;
  function syncLoop(time) {
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
      commitFilmstripTransformScroll();
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

function stopFsSync() {
  if (fsRaf) { cancelAnimationFrame(fsRaf); fsRaf = null; }
  if (fsSyncRaf) { cancelAnimationFrame(fsSyncRaf); fsSyncRaf = null; }
  fsSyncTarget = null;
  commitFilmstripTransformScroll();
  isManuallyNavigating = false;
  if (window.fsLenis) window.fsLenis.start();
}

function updateFilmstrip() {
  let oldActive = filmstripEl.querySelector('.filmstrip-thumb.active');
  if (oldActive) oldActive.classList.remove('active');

  let active = filmstripEl.querySelector('.filmstrip-thumb[data-idx="' + cur + '"]');
  if (active) {
    active.classList.add('active');
    let wrapW = filmstripEl.offsetWidth;
    let thumbL = active.offsetLeft;
    let thumbW = active.offsetWidth;
    fsTarget = thumbL - wrapW / 2 + thumbW / 2;
    if (!isMobile || isManuallyNavigating) {
      if (fsRaf || fsSyncRaf) {
        // If already animating, drop into lerp mode for smooth continuous chasing
        if (fsRaf) {
          cancelAnimationFrame(fsRaf);
          fsRaf = null;
        }
        startFsSync(fsTarget);
      } else {
        // Cold start: play strict smooth cubic ease 
        stopFsSync();
        let startPos = getFilmstripScroll();
        let startTime = null;
        let duration = FILMSTRIP_CONFIG.scrollDuration;

        function step(time) {
          if (!startTime) {
            startTime = time;
            if (window.fsLenis) window.fsLenis.stop();
          }
          let elapsed = time - startTime;
          if (elapsed >= duration) {
            setFilmstripScroll(fsTarget);
            commitFilmstripTransformScroll();
            if (window.fsLenis) window.fsLenis.start();
            fsRaf = null;
            isManuallyNavigating = false;
            return;
          }
          let t = Math.min(1, elapsed / duration);
          let ease = 1 - Math.pow(1 - t, 4);
          setFilmstripScroll(startPos + (fsTarget - startPos) * ease);
          fsRaf = requestAnimationFrame(step);
        }
        fsRaf = requestAnimationFrame(step);
      }
    } else {
      if (!isTouchingFilmstrip) startFsSync(fsTarget);
    }
  }
}

let isUserInteracting = false;
domRefs.lightbox.addEventListener('touchstart', function () {
  isUserInteracting = true;
  clearTimeout(filmstripHideTimer);
}, { passive: true });
window.addEventListener('touchend', function () {
  isUserInteracting = false;
  isTouchingFilmstrip = false;
  if (filmstripWrap.classList.contains('visible')) {
    clearTimeout(filmstripHideTimer);
    filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.activeHideDelay);
  }
}, { passive: true });

domRefs.lightbox.addEventListener('mousedown', function () {
  isUserInteracting = true;
  clearTimeout(filmstripHideTimer);
}, { passive: true });
window.addEventListener('mouseup', function () {
  isUserInteracting = false;
  isTouchingFilmstrip = false;
  if (filmstripWrap.classList.contains('visible')) {
    clearTimeout(filmstripHideTimer);
    filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.activeHideDelay);
  }
}, { passive: true });

function showFilmstrip() {
  buildFilmstrip();
  updateFilmstrip();
  filmstripWrap.classList.add('visible');
  domRefs.lightbox.classList.add('filmstrip-visible');
  clearTimeout(filmstripHideTimer);
  if (!isUserInteracting) {
    filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.activeHideDelay);
  }
}

function hideFilmstrip() {
  // Don't hide if the cursor is still in the wrap or the lift zone
  if (filmstripWrap.matches(':hover') || (liftZone && liftZone.matches(':hover'))) {
    filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.hoverRetryDelay);
    return;
  }
  filmstripWrap.classList.remove('visible');
  domRefs.lightbox.classList.remove('filmstrip-visible');
}

// keep filmstrip visible while hovering it
filmstripWrap.addEventListener('mouseenter', function () { clearTimeout(filmstripHideTimer); });
filmstripWrap.addEventListener('mouseleave', function () {
  // grace period — prevents flicker and allows cursor to move back in
  filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.mouseLeaveDelay);
});
filmstripWrap.addEventListener('touchstart', function () {
  clearTimeout(filmstripHideTimer);
  isTouchingFilmstrip = true;
  stopFsSync();
}, { passive: true });
filmstripWrap.addEventListener('touchend', function () {
  filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.touchHideDelay);
  isTouchingFilmstrip = false;
}, { passive: true });

// invisible lift zone — hovering bottom of screen revives hidden filmstrip
if (liftZone) {
  liftZone.addEventListener('mouseenter', function () {
    clearTimeout(filmstripHideTimer);
    showFilmstrip();
  });
  liftZone.addEventListener('mouseleave', function () {
    // if mouse left lift zone without entering filmstrip, wait a bit
    filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.liftZoneLeaveDelay);
  });
}

// Capture wheel events early to trigger UI logic (scroll handled by fsLenis)
filmstripWrap.addEventListener('wheel', function (e) {
  stopFsSync();
  clearTimeout(filmstripHideTimer);
  filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.touchHideDelay);
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
    isTouchingFilmstrip = true;
    stopFsSync();
    if (window.fsLenis) window.fsLenis.stop();
    dragStartX = e.clientX;
    scrollStart = filmstripEl.scrollLeft;
    filmstripEl.classList.add('dragging');
    clearTimeout(filmstripHideTimer);
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
    filmstripHideTimer = setTimeout(hideFilmstrip, FILMSTRIP_CONFIG.dragHideDelay);
  });

  // suppress click on thumbs if we just dragged
  filmstripEl.addEventListener('click', function (e) {
    if (dragMoved) { e.stopPropagation(); dragMoved = false; }
  }, true);
}
