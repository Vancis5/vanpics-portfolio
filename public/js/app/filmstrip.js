// FILMSTRIP
var filmstripWrap = domRefs.filmstripWrap;
var filmstripEl = domRefs.filmstrip;
var filmstripHideTimer = null;
var filmstripBuilt = false;
window.addEventListener('category-change', function () {
  filmstripBuilt = false;
  if (typeof filmstripEl !== 'undefined' && filmstripEl) {
    filmstripEl.innerHTML = '';
  }
  // Also reset mobile slides if they exist
  var imgWrap = domRefs.lightboxImgWrap;
  if (imgWrap) {
    var slides = imgWrap.querySelectorAll('.snap-slide');
    for (var i = 0; i < slides.length; i++) slides[i].remove();
  }
});
var liftZone = domRefs.filmstripLiftZone;

function buildFilmstrip() {
  if (filmstripBuilt) return;
  filmstripBuilt = true;

  var currentSet = currentLightboxIsMotion ? motionProjects : activePhotos;

  // Photos: 52px thumb + gap, Motion: 78px thumb
  var THUMB_W = currentLightboxIsMotion ? (window.innerWidth >= 640 ? 78 : 68) : (window.innerWidth >= 640 ? 62 : 52);
  var pad = (window.innerWidth / 2) - (THUMB_W / 2);
  filmstripEl.style.paddingLeft = pad + 'px';
  filmstripEl.style.paddingRight = pad + 'px';
  filmstripEl.innerHTML = '';

  currentSet.forEach(function (p, i) {
    var thumb = document.createElement('div');
    thumb.className = 'filmstrip-thumb';
    if (currentLightboxIsMotion) thumb.classList.add('mode-motion');
    thumb.dataset.idx = i;
    var img = document.createElement('img');
    var thumbPath = currentLightboxIsMotion ? p.thumb : p.src.replace('photos/', 'photos/thumbs/');
    img.src = thumbPath;
    img.alt = p.title;
    img.loading = 'lazy';
    thumb.appendChild(img);
    thumb.addEventListener('click', (function (idx) {
      return function () {
        var d = idx === cur ? 0 : (idx > cur ? 1 : -1);
        cur = idx;
        openLightbox(idx, d, currentLightboxIsMotion);
      };
    })(i));
    filmstripEl.appendChild(thumb);
  });

  initFilmstripDrag();
}

var fsRaf = null;
var fsVelocity = 0;
var fsTarget = 0;
var isManuallyNavigating = false;
var isTouchingFilmstrip = false;
var fsSyncTarget = null;
var fsSyncRaf = null;

// Smooth lerp loop for mobile filmstrip tracking during swipe.
// Uses frame-rate-independent exponential decay so the filmstrip
// chases the target position without jitter or abrupt transitions.
function startFsSync(target) {
  if (window.fsLenis) window.fsLenis.stop();
  fsSyncTarget = target;
  if (fsSyncRaf) return;
  var prevTime = 0;
  function syncLoop(time) {
    if (fsSyncTarget === null) {
      if (window.fsLenis) window.fsLenis.start();
      fsSyncRaf = null;
      return;
    }
    var dt = prevTime ? Math.min(time - prevTime, 33) : 16;
    prevTime = time;
    var current = filmstripEl.scrollLeft;
    var diff = fsSyncTarget - current;
    if (Math.abs(diff) < 0.5) {
      filmstripEl.scrollLeft = fsSyncTarget;
      if (window.fsLenis) window.fsLenis.start();
      fsSyncRaf = null;
      fsSyncTarget = null;
      return;
    }
    var alpha = 1 - Math.exp(-14 * dt / 1000);
    filmstripEl.scrollLeft = current + diff * alpha;
    fsSyncRaf = requestAnimationFrame(syncLoop);
  }
  fsSyncRaf = requestAnimationFrame(syncLoop);
}

function stopFsSync() {
  if (fsRaf) { cancelAnimationFrame(fsRaf); fsRaf = null; }
  if (fsSyncRaf) { cancelAnimationFrame(fsSyncRaf); fsSyncRaf = null; }
  fsSyncTarget = null;
  isManuallyNavigating = false;
  if (window.fsLenis) window.fsLenis.start();
}

function updateFilmstrip() {
  var oldActive = filmstripEl.querySelector('.filmstrip-thumb.active');
  if (oldActive) oldActive.classList.remove('active');

  var active = filmstripEl.querySelector('.filmstrip-thumb[data-idx="' + cur + '"]');
  if (active) {
    active.classList.add('active');
    var wrapW = filmstripEl.offsetWidth;
    var thumbL = active.offsetLeft;
    var thumbW = active.offsetWidth;
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
        var startPos = filmstripEl.scrollLeft;
        var startTime = null;
        var duration = 400; // graceful duration

        function step(time) {
          if (!startTime) {
            startTime = time;
            if (window.fsLenis) window.fsLenis.stop();
          }
          var elapsed = time - startTime;
          if (elapsed >= duration) {
            filmstripEl.scrollLeft = fsTarget;
            if (window.fsLenis) window.fsLenis.start();
            fsRaf = null;
            isManuallyNavigating = false;
            return;
          }
          var t = Math.min(1, elapsed / duration);
          var ease = 1 - Math.pow(1 - t, 4);
          filmstripEl.scrollLeft = startPos + (fsTarget - startPos) * ease;
          fsRaf = requestAnimationFrame(step);
        }
        fsRaf = requestAnimationFrame(step);
      }
    } else {
      if (!isTouchingFilmstrip) startFsSync(fsTarget);
    }
  }
}

var isUserInteracting = false;
domRefs.lightbox.addEventListener('touchstart', function () {
  isUserInteracting = true;
  clearTimeout(filmstripHideTimer);
}, { passive: true });
window.addEventListener('touchend', function () {
  isUserInteracting = false;
  isTouchingFilmstrip = false;
  if (filmstripWrap.classList.contains('visible')) {
    clearTimeout(filmstripHideTimer);
    filmstripHideTimer = setTimeout(hideFilmstrip, 2800);
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
    filmstripHideTimer = setTimeout(hideFilmstrip, 2800);
  }
}, { passive: true });

function showFilmstrip() {
  buildFilmstrip();
  updateFilmstrip();
  filmstripWrap.classList.add('visible');
  domRefs.lightbox.classList.add('filmstrip-visible');
  clearTimeout(filmstripHideTimer);
  if (!isUserInteracting) {
    filmstripHideTimer = setTimeout(hideFilmstrip, 2800);
  }
}

function hideFilmstrip() {
  // Don't hide if the cursor is still in the wrap or the lift zone
  if (filmstripWrap.matches(':hover') || (liftZone && liftZone.matches(':hover'))) {
    filmstripHideTimer = setTimeout(hideFilmstrip, 1000);
    return;
  }
  filmstripWrap.classList.remove('visible');
  domRefs.lightbox.classList.remove('filmstrip-visible');
}

// keep filmstrip visible while hovering it
filmstripWrap.addEventListener('mouseenter', function () { clearTimeout(filmstripHideTimer); });
filmstripWrap.addEventListener('mouseleave', function () {
  // grace period — prevents flicker and allows cursor to move back in
  filmstripHideTimer = setTimeout(hideFilmstrip, 300);
});
filmstripWrap.addEventListener('touchstart', function () {
  clearTimeout(filmstripHideTimer);
  isTouchingFilmstrip = true;
  stopFsSync();
}, { passive: true });
filmstripWrap.addEventListener('touchend', function () {
  filmstripHideTimer = setTimeout(hideFilmstrip, 2000);
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
    filmstripHideTimer = setTimeout(hideFilmstrip, 600);
  });
}

// Capture wheel events early to trigger UI logic (scroll handled by fsLenis)
filmstripWrap.addEventListener('wheel', function (e) {
  stopFsSync();
  clearTimeout(filmstripHideTimer);
  filmstripHideTimer = setTimeout(hideFilmstrip, 2000);
}, { passive: true, capture: true });

// click-drag scroll
function initFilmstripDrag() {
  var isDragging = false;
  var dragStartX = 0;
  var scrollStart = 0;
  var dragMoved = false;

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
    var dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 3) dragMoved = true;
    filmstripEl.scrollLeft = scrollStart - dx;
  });

  document.addEventListener('mouseup', function () {
    if (!isDragging) return;
    isDragging = false;
    filmstripEl.classList.remove('dragging');
    if (window.fsLenis) window.fsLenis.start();
    filmstripHideTimer = setTimeout(hideFilmstrip, 1500);
  });

  // suppress click on thumbs if we just dragged
  filmstripEl.addEventListener('click', function (e) {
    if (dragMoved) { e.stopPropagation(); dragMoved = false; }
  }, true);
}
