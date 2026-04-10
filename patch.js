// patch.js — applies all index.html edits in one pass
const fs = require('fs');
const filePath = 'c:\\Users\\Administrator\\Documents\\Code\\HTML-CSS\\vanpics-portfolio-v20\\index.html';
let c = fs.readFileSync(filePath, 'utf8');
const lines = c.split('\n');

// ── Grab exact old content by line ranges BEFORE any edits ──
const swipeVarsOld = lines.slice(504, 522).join('\n');   // lines 505-522
const swipeFnOld   = lines.slice(523, 626).join('\n');   // lines 524-626

// ═══ 1. Remove inline nav-hide CSS ═══
c = c.replace(
  '  /* hide nav buttons on mobile */\n  #lightbox-nav { display: none; }\n',
  ''
);

// ═══ 2. Remove nav buttons HTML ═══
c = c.replace(
  '  <div id="lightbox-nav">\n    <button class="lb-nav-btn" onclick="navigateLightbox(-1)">prev</button>\n    <button class="lb-nav-btn" onclick="navigateLightbox(1)">next</button>\n  </div>\n',
  ''
);

// ═══ 3. Add visibility tracking after isMobile ═══
c = c.replace(
  "var isMobile = window.matchMedia('(hover: none)').matches;",
  `var isMobile = window.matchMedia('(hover: none)').matches;
var heroVisible = true, pageVisible = true;
var heroObs = new IntersectionObserver(function(entries) { heroVisible = entries[0].isIntersecting; }, { threshold: 0 });
heroObs.observe(document.getElementById('hero'));
document.addEventListener('visibilitychange', function() { pageVisible = !document.hidden; });`
);

// ═══ 4. Scope mousemove to hero visibility ═══
c = c.replace(
  "  document.addEventListener('mousemove', function(e) {\n    var rect = hero.getBoundingClientRect();",
  "  document.addEventListener('mousemove', function(e) {\n    if (!heroVisible) return;\n    var rect = hero.getBoundingClientRect();"
);

// ═══ 5a. loadSwipeNeighbors in afterLoad (navigate path — 8-space indent) ═══
c = c.replace(
  '        setLightboxContent(p);\n        requestAnimationFrame(function() {\n          if (gen !== navGen) return;',
  '        setLightboxContent(p);\n        loadSwipeNeighbors();\n        requestAnimationFrame(function() {\n          if (gen !== navGen) return;'
);

// ═══ 5b. loadSwipeNeighbors in afterOpenLoad (6-space indent) ═══
c = c.replace(
  '      setLightboxContent(p);\n      requestAnimationFrame(function() {\n        if (openGen !== navGen) return;',
  '      setLightboxContent(p);\n      loadSwipeNeighbors();\n      requestAnimationFrame(function() {\n        if (openGen !== navGen) return;'
);

// ═══ 6. Replace swipe vars + click handler (505-522) ═══
const swipeVarsNew = `// SWIPE for lightbox
var lbEl = document.getElementById('lightbox');
var imgWrap = document.getElementById('lightbox-img-wrap');
var loadSwipeNeighbors = function() {};
var swipeHappened = false;

// mobile: tap content area (not interactive elements) to toggle filmstrip
lbEl.addEventListener('click', function(e) {
  if (!isMobile) return;
  if (swipeHappened) { swipeHappened = false; return; }
  if (e.target.closest('button, .filmstrip-thumb, #filmstrip-wrap')) return;
  if (filmstripWrap.classList.contains('visible')) {
    hideFilmstrip();
  } else {
    showFilmstrip();
  }
});`;
c = c.replace(swipeVarsOld, swipeVarsNew);

// ═══ 7. Replace swipeNavigate + touch handlers (524-626) with gallery swipe IIFE ═══
const swipeFnNew = `// ─── MOBILE GALLERY SWIPE ───
// Gallery-app swiping: 1:1 tracking, adjacent images peek in, velocity commit
// Swipe down to dismiss lightbox on mobile
if (isMobile) {
  (function() {
    var GAP = 16;
    var VEL_COMMIT = 0.3;
    var DISP_COMMIT = 0.28;
    var DISMISS_DIST = 100;
    var DISMISS_VEL = 0.35;

    var prevWrap = document.createElement('div');
    var nextWrap = document.createElement('div');
    prevWrap.className = 'swipe-neighbor';
    nextWrap.className = 'swipe-neighbor';
    var prevImg = document.createElement('img');
    var nextImg = document.createElement('img');
    prevImg.draggable = false; nextImg.draggable = false;
    prevImg.setAttribute('aria-hidden', 'true');
    nextImg.setAttribute('aria-hidden', 'true');
    prevWrap.appendChild(prevImg);
    nextWrap.appendChild(nextImg);
    imgWrap.appendChild(prevWrap);
    imgWrap.appendChild(nextWrap);
    prevWrap.style.transform = 'translateX(-200%)';
    nextWrap.style.transform = 'translateX(200%)';

    var sActive = false, sAxis = null;
    var sX = 0, sY = 0, dX = 0, dY = 0;
    var pts = [];
    var wW = 0;

    function loadNeighbors() {
      var pi = (cur - 1 + activePhotos.length) % activePhotos.length;
      var ni = (cur + 1) % activePhotos.length;
      prevImg.src = activePhotos[pi].src;
      nextImg.src = activePhotos[ni].src;
      prevWrap.style.transition = 'none';
      nextWrap.style.transition = 'none';
      prevWrap.style.transform = 'translateX(-200%)';
      nextWrap.style.transform = 'translateX(200%)';
    }
    loadSwipeNeighbors = loadNeighbors;

    // reset neighbors when lightbox opens (before content loads)
    window.addEventListener('lightbox-open', function() {
      prevWrap.style.transition = 'none';
      nextWrap.style.transition = 'none';
      prevWrap.style.transform = 'translateX(-200%)';
      nextWrap.style.transform = 'translateX(200%)';
    });

    function setTrack(dx) {
      var img = document.getElementById('lightbox-img');
      img.style.transition = 'none';
      img.style.transform = 'translateX(' + dx + 'px)';
      prevWrap.style.transition = 'none';
      nextWrap.style.transition = 'none';
      prevWrap.style.transform = 'translateX(' + (dx - wW - GAP) + 'px)';
      nextWrap.style.transform = 'translateX(' + (dx + wW + GAP) + 'px)';
    }

    function vx() {
      if (pts.length < 2) return 0;
      var a = pts[Math.max(0, pts.length - 4)], b = pts[pts.length - 1];
      var dt = b.t - a.t; return dt > 0 ? (b.x - a.x) / dt : 0;
    }
    function vy() {
      if (pts.length < 2) return 0;
      var a = pts[Math.max(0, pts.length - 4)], b = pts[pts.length - 1];
      var dt = b.t - a.t; return dt > 0 ? (b.y - a.y) / dt : 0;
    }

    function slideTo(x, dur, ease, cb) {
      var img = document.getElementById('lightbox-img');
      var tr = 'transform ' + dur + 's ' + ease;
      img.style.transition = tr;
      prevWrap.style.transition = tr;
      nextWrap.style.transition = tr;
      img.style.transform = 'translateX(' + x + 'px)';
      prevWrap.style.transform = 'translateX(' + (x - wW - GAP) + 'px)';
      nextWrap.style.transform = 'translateX(' + (x + wW + GAP) + 'px)';
      setTimeout(cb, dur * 1000 + 30);
    }

    function commitSwipe(dir) {
      var newIdx = (cur + dir + activePhotos.length) % activePhotos.length;
      if (newIdx === cur) { cancelSwipe(); return; }

      var target = dir > 0 ? -(wW + GAP) : (wW + GAP);
      var stayWrap = dir > 0 ? nextWrap : prevWrap;

      // fade info during slide
      var info = document.getElementById('lightbox-info');
      info.style.animation = 'none';
      info.style.transition = 'opacity 0.12s ease';
      info.style.opacity = '0';

      slideTo(target, 0.28, 'cubic-bezier(0.25,1,0.5,1)', function() {
        cur = newIdx;
        var p = activePhotos[cur];
        var gen = ++navGen;

        // blur bg crossfade
        var inc = blurActive === 'a' ? 'b' : 'a';
        document.getElementById('lightbox-bg-blur-' + inc + '-inner').style.backgroundImage = 'url(' + p.src + ')';
        document.getElementById('lightbox-bg-blur-' + inc).classList.add('active');
        document.getElementById('lightbox-bg-blur-' + blurActive).classList.remove('active');
        blurActive = inc;

        // reset main image to center, invisible
        var img = document.getElementById('lightbox-img');
        img.style.transition = 'none';
        img.style.transform = 'translateX(0)';
        img.style.opacity = '0';

        var done = false;
        function reveal() {
          if (done || gen !== navGen) return;
          done = true;
          img.onload = null; img.onerror = null;
          setLightboxContent(p);
          showFilmstrip();
          requestAnimationFrame(function() {
            if (gen !== navGen) return;
            animateInfo(dir);
            void img.offsetWidth;
            img.style.transition = 'opacity 0.18s ease';
            img.style.opacity = '1';
            // hide stay-wrap after main image fades in, then load new neighbors
            setTimeout(function() {
              stayWrap.style.transition = 'none';
              stayWrap.style.transform = 'translateX(' + (dir > 0 ? '200%' : '-200%') + ')';
              loadNeighbors();
            }, 220);
          });
        }
        requestAnimationFrame(function() {
          if (gen !== navGen) return;
          img.onload = reveal; img.onerror = reveal;
          img.src = p.src;
          if (img.decode) img.decode().then(reveal).catch(function(){});
          setTimeout(reveal, 500);
        });
      });
    }

    function cancelSwipe() {
      slideTo(0, 0.3, 'cubic-bezier(0.25,1,0.5,1)', function() {
        prevWrap.style.transition = 'none';
        nextWrap.style.transition = 'none';
        prevWrap.style.transform = 'translateX(-200%)';
        nextWrap.style.transform = 'translateX(200%)';
      });
      var info = document.getElementById('lightbox-info');
      info.style.transition = 'opacity 0.2s ease';
      info.style.opacity = '1';
    }

    function dismissDown() {
      var content = document.getElementById('lightbox-content');
      content.style.transition = 'transform 0.28s ease-out, opacity 0.28s ease-out';
      content.style.transform = 'translateY(' + window.innerHeight + 'px)';
      content.style.opacity = '0';
      setTimeout(function() {
        closeLightbox();
        // delay reset until lightbox fade (0.4s) finishes
        setTimeout(function() {
          content.style.transition = '';
          content.style.transform = '';
          content.style.opacity = '';
        }, 450);
      }, 280);
    }

    function cancelDismiss() {
      var content = document.getElementById('lightbox-content');
      content.style.transition = 'transform 0.3s cubic-bezier(0.25,1,0.5,1), opacity 0.3s ease';
      content.style.transform = '';
      content.style.opacity = '1';
      setTimeout(function() { content.style.transition = ''; }, 320);
    }

    lbEl.addEventListener('touchstart', function(e) {
      if (filmstripWrap.contains(e.target)) return;
      if (!lbEl.classList.contains('open')) return;
      sActive = true; sAxis = null;
      dX = 0; dY = 0;
      sX = e.touches[0].clientX;
      sY = e.touches[0].clientY;
      pts = [{ x: sX, y: sY, t: Date.now() }];
      wW = imgWrap.offsetWidth;
      loadNeighbors();
    }, { passive: true });

    lbEl.addEventListener('touchmove', function(e) {
      if (!sActive) return;
      var cx = e.touches[0].clientX, cy = e.touches[0].clientY;
      dX = cx - sX; dY = cy - sY;
      pts.push({ x: cx, y: cy, t: Date.now() });
      if (pts.length > 8) pts.shift();
      if (!sAxis && (Math.abs(dX) > 8 || Math.abs(dY) > 8)) {
        sAxis = Math.abs(dX) >= Math.abs(dY) ? 'h' : 'v';
      }
      if (sAxis === 'h') {
        e.preventDefault();
        setTrack(dX);
        var fade = 1 - Math.min(1, Math.abs(dX) / (wW * 0.25));
        var info = document.getElementById('lightbox-info');
        info.style.transition = 'none';
        info.style.opacity = fade;
      } else if (sAxis === 'v' && dY > 0) {
        e.preventDefault();
        var content = document.getElementById('lightbox-content');
        content.style.transition = 'none';
        content.style.transform = 'translateY(' + dY + 'px)';
        content.style.opacity = Math.max(0.15, 1 - dY / 350);
      }
    }, { passive: false });

    lbEl.addEventListener('touchend', function() {
      if (!sActive) return;
      sActive = false;
      swipeHappened = (sAxis === 'h') || (sAxis === 'v' && dY > 0);
      if (sAxis === 'h') {
        var v = vx();
        if (Math.abs(dX) > wW * DISP_COMMIT || Math.abs(v) > VEL_COMMIT) {
          var dir = Math.abs(v) > VEL_COMMIT ? (v < 0 ? 1 : -1) : (dX < 0 ? 1 : -1);
          commitSwipe(dir);
        } else {
          cancelSwipe();
        }
      } else if (sAxis === 'v' && dY > 0) {
        var yv = vy();
        if (dY > DISMISS_DIST || yv > DISMISS_VEL) {
          dismissDown();
        } else {
          cancelDismiss();
        }
      }
      sAxis = null;
    }, { passive: true });
  })();
}`;
c = c.replace(swipeFnOld, swipeFnNew);

// ═══ 8. Add visibility check in tick() ═══
c = c.replace(
  "function tick() {\n  var rowIds = isMobile ?",
  "function tick() {\n  if (!heroVisible || !pageVisible) { requestAnimationFrame(tick); return; }\n  var rowIds = isMobile ?"
);

// ── Write result ──
fs.writeFileSync(filePath, c, 'utf8');
console.log('✓ All index.html patches applied');
