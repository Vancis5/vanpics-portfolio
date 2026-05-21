// PARALLAX
var scrollY = 0;

// CAROUSEL
var ROW_CONFIG = [{ dir: -1 }, { dir: 1 }, { dir: -1 }, { dir: 1 }];
// cruise speed scaled by device — mobile narrower so same px/frame looks faster
var CRUISE_SPEED = isMobile ? 0.28 : (window.innerWidth < 1024 ? 0.36 : 0.45);
var EASE_FRAMES = 120;
var START_SPEED_MULT = 8.0;

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function getCurrentSpeed(frame) {
  if (frame >= EASE_FRAMES) return CRUISE_SPEED;
  var t = frame / EASE_FRAMES;
  return CRUISE_SPEED * START_SPEED_MULT + (CRUISE_SPEED - CRUISE_SPEED * START_SPEED_MULT) * easeOutCubic(t);
}

var rowState = ROW_CONFIG.map(function (c) { return { dir: c.dir, offset: 0, setWidth: 0 }; });
var easeFrame = 0;

function buildCarousel() {
  var rowIds = ['row-0', 'row-1', 'row-2', 'row-3'];
  var rows = rowIds.map(function (id) { return document.getElementById(id); });

  // show/hide row-3 based on device
  if (isMobile) {
    rows[3].style.display = 'flex';
  } else {
    rows[3].style.display = 'none';
  }

  var activeRows = isMobile ? rows : rows.slice(0, 3);
  var activeRowCount = activeRows.length;

  if (carouselPhotos.length === 0) { startLoops(); return; }

  // rows stay visible; eager images handle their own fade-in
  activeRows.forEach(function (r) { r.style.opacity = '1'; });

  var groups = [];
  for (var g = 0; g < activeRowCount; g++) groups.push([]);
  carouselPhotos.forEach(function (p, i) { groups[i % activeRowCount].push(p); });

  var eagerImgs = [];

  activeRows.forEach(function (row, ri) {
    var group = groups[ri].length > 0 ? groups[ri] : carouselPhotos;
    var copies = Math.max(2, Math.ceil((window.innerWidth * 3) / 220 / group.length));

    for (var c = 0; c < copies * 2; c++) {
      group.forEach(function (p) {
        var img = document.createElement('img');
        var thumbPath = p.src.replace('photos/', 'photos/thumbs/');
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
          var targetCat = (p.category === 'figures') ? 'figures' : 'all';
          if (currentCategory === targetCat) {
            var idx = activePhotos.indexOf(p);
            if (idx >= 0) openLightbox(idx);
          } else {
            rebuildGallery(targetCat, {
              onReady: function () {
                var idx = activePhotos.indexOf(p);
                if (idx >= 0) openLightbox(idx);
              }
            });
          }
        });
        row.appendChild(img);
      });
    }
  });

  var loaded = 0;
  var total = eagerImgs.length;

  function onImageReady() {
    if (++loaded < total) return;
    // defer to next paint — Firefox offsetWidth is 0 if read before layout pass
    requestAnimationFrame(function () {
      activeRows.forEach(function (row, ri) {
        var group = groups[ri].length > 0 ? groups[ri] : carouselPhotos;
        var copies = Math.max(2, Math.ceil((window.innerWidth * 3) / 220 / group.length));
        var imgs = Array.from(row.querySelectorAll('img'));
        var w = 0;
        for (var i = 0; i < group.length * copies && i < imgs.length; i++) w += (imgs[i].offsetWidth || 220) + 10;
        rowState[ri].setWidth = w > 0 ? w : group.length * copies * 230;
        if (ROW_CONFIG[ri].dir === 1) rowState[ri].offset = -rowState[ri].setWidth;
      });
      activeRows.forEach(function (r) { r.style.opacity = '1'; }); // already visible, belt-and-suspenders
      if (window.__onCarouselReady) window.__onCarouselReady();
      startLoops();
    });
  }

  if (total === 0) { activeRows.forEach(function (r) { r.style.opacity = '1'; }); startLoops(); return; }
  eagerImgs.forEach(function (img) {
    var counted = false;
    function countOnce() { if (!counted) { counted = true; onImageReady(); } }
    img.addEventListener('load', countOnce);
    img.addEventListener('error', countOnce);
    if (img.complete) {
      // already cached — decode() waits for pixel decode before resolving
      if (img.decode) {
        img.decode().then(countOnce).catch(countOnce);
      } else {
        // no decode() — nudge src to retrigger load event (cached, no network hit)
        var s = img.src; img.src = ''; img.src = s;
      }
    }
  });
}

function tick() {
  if (!heroVisible || !pageVisible) { heroRafId = null; return; }
  var rowIds = isMobile ? ['row-0', 'row-1', 'row-2', 'row-3'] : ['row-0', 'row-1', 'row-2'];
  var rows = rowIds.map(function (id) { return document.getElementById(id); });
  var speed = getCurrentSpeed(easeFrame);
  if (easeFrame < EASE_FRAMES + 10) easeFrame++;

  var px = [scrollY * 0.18, -scrollY * 0.12, scrollY * 0.22, -scrollY * 0.15];

  rowState.forEach(function (state, ri) {
    if (ri >= rows.length) return;
    state.offset += speed * state.dir;
    if (state.setWidth > 0) {
      if (state.dir === -1 && state.offset < -state.setWidth) state.offset += state.setWidth;
      if (state.dir === 1 && state.offset > 0) state.offset -= state.setWidth;
    }
    rows[ri].style.transform = 'translateX(' + (state.offset + px[ri]) + 'px)';
  });

  heroRafId = requestAnimationFrame(tick);
}
