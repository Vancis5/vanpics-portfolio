// SWIPE for lightbox
var lbEl = domRefs.lightbox;
var imgWrap = domRefs.lightboxImgWrap;
var loadSwipeNeighbors = function () { };
var mobileScrollToSlide = null;
var swipeHappened = false;

var lastTapT = 0;

// mobile: tap content area (not interactive elements) to toggle filmstrip
lbEl.addEventListener('click', function (e) {
  if (!isMobile) return;
  if (swipeHappened) { swipeHappened = false; return; }
  if (e.target.closest('button, .filmstrip-thumb, #filmstrip-wrap, #lightbox-info')) return;

  var now = Date.now();
  if (e.target.tagName.toLowerCase() === 'img' && now - lastTapT < 350) {
    // Double tap zoom
    if (lbZoomLevel > 1) {
      resetZoom();
    } else {
      lbZoomLevel = 2.5;
      var img = e.target;
      var rect = img.getBoundingClientRect();
      lbZoomPanX = -(e.clientX - (rect.left + rect.width / 2)) * (lbZoomLevel - 1);
      lbZoomPanY = -(e.clientY - (rect.top + rect.height / 2)) * (lbZoomLevel - 1);
      img.dataset.zoomAnimated = "true";
      updateZoomTransform(img);
      setTimeout(function () {
        delete img.dataset.zoomAnimated;
        img.classList.add('zoomed'); // Disable transition for subsequent panning
      }, 360);
    }
    lastTapT = 0;
  } else {
    lastTapT = now;
    if (filmstripWrap.classList.contains('visible')) {
      hideFilmstrip();
    } else {
      showFilmstrip();
    }
  }
});

// ─── MOBILE SCROLL-SNAP GALLERY ───
// Native scroll container with snap points — browser handles touch physics
if (isMobile) {
  (function () {
    var slidesBuilt = false;
    var snapTimer = null;
    function clearSlides() {
      var slides = imgWrap.querySelectorAll('.snap-slide');
      slides.forEach(function (slide) { slide.remove(); });
      slidesBuilt = false;
      imgWrap.scrollLeft = 0;
    }

    // ── Build slides ──
    function buildSlides() {
      clearSlides();
      if (currentLightboxIsMotion) return;
      if (slidesBuilt) return;
      slidesBuilt = true;
      // Remove old #lightbox-img from flow (CSS hides it, but clear src too)
      var mainImg = domRefs.lightboxImg;
      if (mainImg) { mainImg.removeAttribute('src'); }
      activePhotos.forEach(function (p, i) {
        var slide = document.createElement('div');
        slide.className = 'snap-slide';
        slide.dataset.idx = i;
        var img = document.createElement('img');
        img.alt = p.title || '';
        img.draggable = false;
        img.loading = (Math.abs(i - cur) <= 2) ? 'eager' : 'lazy';
        img.src = p.src;
        img.classList.add('zoomable');
        img.addEventListener('click', toggleImageZoom);
        slide.appendChild(img);
        imgWrap.appendChild(slide);
      });
    }

    function scrollToSlide(idx, smooth, dir) {
      if (currentLightboxIsMotion) return;
      var w = imgWrap.offsetWidth;
      if (!w) return;
      if (smooth) {
        window.isAutoRapidScrolling = true;
        imgWrap.style.scrollSnapType = 'none'; // release OS clamp
        var startPos = imgWrap.scrollLeft;
        var targetPos = idx * w;
        var startTime = performance.now();
        var duration = 380; // mathematically sleek transition (faster than OS default)
        var slideDir = dir || (targetPos > startPos ? 1 : -1);

        var info = domRefs.lightboxInfo;
        // Animate OLD text gracefully exiting and trigger the massive BG blur crossfade immediately
        var finalP = activePhotos[idx];
        setLightboxBlur(finalP.src);

        if (info) {
          info.style.transition = 'opacity 0.18s ease, filter 0.18s ease, transform 0.18s ease';
          info.style.opacity = '0';
          info.style.filter = 'blur(10px)';
          info.style.transform = 'translate3d(' + (-slideDir * 25) + 'px, 0, 0) scale(0.92)';
        }

        function step(time) {
          var elapsed = time - startTime;
          if (elapsed >= duration) {
            imgWrap.scrollTo({ left: targetPos, behavior: 'instant' });
            imgWrap.style.scrollSnapType = ''; // restore OS clamp

            // Allow CSS transition to execute without asynchronous scroll intercepts killing inline physics
            setTimeout(function () { window.isAutoRapidScrolling = false; }, 50);

            setLightboxContent(finalP);
            showFilmstrip();
            if (typeof updateLoading === 'function') updateLoading();

            var info = domRefs.lightboxInfo;
            if (info) {
              // Ensure any previous 'transition: none' styles are flushed from memory before snapping
              info.style.transition = '';
              void info.offsetWidth;

              // Snap inline styles instantly to starting projection position for the new text
              info.style.transition = 'none';
              info.style.opacity = '0';
              info.style.filter = 'blur(12px)';
              info.style.transform = 'translate3d(' + (slideDir * 25) + 'px, 0, 0) scale(0.92)';

              // Fire arrival execution flush to completely eliminate the double-frame stutter delay
              void info.offsetWidth;

              info.style.transition = 'opacity 0.18s ease, filter 0.18s ease, transform 0.22s cubic-bezier(0.22,1,0.36,1)';
              info.style.opacity = '1';
              info.style.filter = '';
              info.style.transform = '';
            }
            return;
          }
          var t = elapsed / duration;
          var ease = 1 - Math.pow(1 - t, 4); // ease-out quart
          imgWrap.scrollTo({ left: startPos + (targetPos - startPos) * ease, behavior: 'instant' });
          requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      } else {
        imgWrap.scrollTo({ left: idx * w, behavior: 'instant' });
      }
    }
    mobileScrollToSlide = scrollToSlide;

    // Over-scroll loop detection bounds
    var wrapTouchX = 0;
    var isUserTouching = false;
    imgWrap.addEventListener('touchstart', function (e) {
      if (currentLightboxIsMotion) return;
      isUserTouching = true;
      if (e.touches.length === 1) wrapTouchX = e.touches[0].clientX;
    }, { passive: true });
    imgWrap.addEventListener('touchend', function (e) {
      if (currentLightboxIsMotion) return;
      isUserTouching = false;
      if (Math.abs(lbZoomLevel) > 1 || e.changedTouches.length !== 1) return;
      var dx = e.changedTouches[0].clientX - wrapTouchX;
      var maxScroll = imgWrap.scrollWidth - imgWrap.offsetWidth;
      if (imgWrap.scrollLeft >= maxScroll - 5 && dx < -45) {
        // Pulled left while on the last slide -> Loop to 0
        openLightbox(0, 1);
      } else if (imgWrap.scrollLeft <= 5 && dx > 45) {
        // Pulled right while on the first slide -> Loop to end
        openLightbox(activePhotos.length - 1, -1);
      } else {
        // Trigger final settle for current position
        onSnapSettle();
      }
    }, { passive: true });

    // ── Eager-load nearby slides ──
    function updateLoading() {
      if (currentLightboxIsMotion) return;
      var imgs = imgWrap.querySelectorAll('.snap-slide img');
      for (var i = 0; i < imgs.length; i++) {
        var shouldEager = (Math.abs(i - cur) <= 2);
        imgs[i].loading = shouldEager ? 'eager' : 'lazy';
        if (shouldEager && imgs[i].decode && !imgs[i].dataset.decoded) {
          (function (img) {
            img.decode().then(function () { img.dataset.decoded = "true"; }).catch(function () { });
          })(imgs[i]);
        }
      }
    }

    // ── Scroll settle — detect new active slide ──
    function onSnapSettle(targetIdx) {
      if (currentLightboxIsMotion) return;
      if (isUserTouching && typeof targetIdx === 'undefined') return;
      isManuallyNavigating = false; // Reset navigation flag on settle
      var w = imgWrap.offsetWidth;
      if (!w) return;
      var rawNearest = Math.round(imgWrap.scrollLeft / w);
      var idx = typeof targetIdx === 'number' ? targetIdx : Math.max(0, Math.min(rawNearest, activePhotos.length - 1));

      if (idx !== cur) {
        var dir = idx > cur ? 1 : -1;
        cur = idx;
        var p = activePhotos[cur];

        // blur bg crossfade immediately
        setLightboxBlur(p.src);

        setLightboxContent(p);
        showFilmstrip();
        updateLoading();
      }

      // enforce visible opacity if this was called by snap-settle completion (no arg)
      if (typeof targetIdx !== 'number') {
        var info = domRefs.lightboxInfo;
        if (info) {
          // clear all lingering inline styles to prevent conflicts
          info.style.animation = 'none';
          info.style.transition = 'opacity 0.3s ease, filter 0.3s ease, transform 0.35s cubic-bezier(0.22,1,0.36,1)';
          info.style.opacity = '1';
          info.style.filter = '';
          info.style.transform = '';
          // clean up inline overrides after transition completes
          setTimeout(function () {
            if (!info.parentNode) return;
            info.style.animation = '';
            info.style.transition = '';
          }, 400);
        }
      }
    }

    // scrollend (Chrome 114+, Firefox 109+, Safari 18+)
    imgWrap.addEventListener('scrollend', function () {
      if (currentLightboxIsMotion) return;
      if (window.isAutoRapidScrolling) return; // Prevent layout snaps during math interpolation
      clearTimeout(snapTimer);
      if (!isManuallyNavigating) onSnapSettle();
    });
    imgWrap.addEventListener('scroll', function () {
      if (currentLightboxIsMotion) return;
      clearTimeout(snapTimer);
      snapTimer = setTimeout(onSnapSettle, 150);
      var w = imgWrap.offsetWidth;
      if (!w) return;
      var f = imgWrap.scrollLeft / w;

      var hint = document.getElementById('swipe-hint');
      if (hint && Math.abs(imgWrap.scrollLeft - cur * w) > 10) {
        hint.classList.remove('visible');
      }

      // smoothly sync filmstrip scrub to native drag
      if (!fsRaf && !isManuallyNavigating && !window.isAutoRapidScrolling && !isTouchingFilmstrip) {
        var thumbs = filmstripEl.querySelectorAll('.filmstrip-thumb');
        if (thumbs.length > 0) {
          var thumbW = thumbs[0].offsetWidth;
          var gap = 5;
          var paddingLeft = parseFloat(filmstripEl.style.paddingLeft) || 0;
          var targetCenter = paddingLeft + f * (thumbW + gap) + thumbW / 2;
          startFsSync(targetCenter - filmstripEl.offsetWidth / 2);
        }
      }

      var nearest = Math.round(f);
      nearest = Math.max(0, Math.min(nearest, activePhotos.length - 1));

      // rapid scroll mode suspends normal text updates to keep transition fluid
      if (window.isAutoRapidScrolling) {
        cur = nearest;
        return;
      }

      // preload text underneath if we cross 50% mark — but ONLY if not currently holding
      if (nearest !== cur && !isUserTouching && !isManuallyNavigating) {
        onSnapSettle(nearest);
      }

      var dist = Math.abs(imgWrap.scrollLeft - nearest * w) / w;
      var info = domRefs.lightboxInfo;
      if (info) {
        info.style.animation = 'none';
        info.style.transition = 'none';
        var swipeDelta = imgWrap.scrollLeft - cur * w;

        if (dist === 0) {
          info.style.opacity = '1';
          info.style.filter = '';
          info.style.transform = '';
        } else {
          // 1:1 physical mapping — fades completely out by 16% scroll distance
          var op = Math.max(0, 1 - dist * 6.25);
          var bl = Math.min(10, dist * 40);
          // Calculate slide direction offset
          var tx = swipeDelta > 0 ? Math.max(-20, -dist * 80) : Math.min(20, dist * 80);

          info.style.opacity = op.toString();
          info.style.filter = 'blur(' + bl + 'px)';
          info.style.transform = 'translateX(' + tx + 'px)';
        }
      }
    }, { passive: true });

    // ── Setup on lightbox open ──
    window.addEventListener('lightbox-open', function () {
      if (currentLightboxIsMotion) {
        clearSlides();
        requestAnimationFrame(function () {
          var motionItem = motionProjects[cur];
          if (motionItem) {
            setLightboxContent(motionItem);
            animateInfo(0);
          }
        });
        return;
      }
      buildSlides();
      requestAnimationFrame(function () {
        scrollToSlide(cur, false);
        updateLoading();
        onSnapSettle(cur);
        var p = activePhotos[cur];
        setLightboxContent(p);
        animateInfo(0);
      });
    });

    // Override loadSwipeNeighbors
    loadSwipeNeighbors = function () { updateLoading(); };

    // Re-align on resize/orientation change
    window.addEventListener('resize', function () {
      if (lbEl.classList.contains('open')) {
        scrollToSlide(cur, false);
      }
    });

    // ─── SWIPE DOWN TO DISMISS & PINCH TO ZOOM ───
    var dStartX = 0, dStartY = 0, dDY = 0;
    var dLocked = false, dChecked = false;
    var dPts = [];
    var isPinching = false, pinchInitDist = 0, pinchInitLevel = 1, pinchInitPanX = 0, pinchInitPanY = 0, pinchInitMx = 0, pinchInitMy = 0, pinchInitCx = 0, pinchInitCy = 0;

    lbEl.addEventListener('touchstart', function (e) {
      if (!lbEl.classList.contains('open')) return;
      // stricter check to prevent interaction fight between filmstrip and dismiss gesture
      if (e.target.closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb')) return;

      if (e.touches.length === 2 && !dLocked) {
        isPinching = true;
        pinchInitDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        pinchInitLevel = lbZoomLevel;
        pinchInitPanX = lbZoomPanX;
        pinchInitPanY = lbZoomPanY;

        var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        pinchInitCx = cx;
        pinchInitCy = cy;
        var mWrap = domRefs.lightboxImgWrap;
        var img = mWrap.querySelector('.snap-slide[data-idx="' + cur + '"] img');
        if (img) {
          var rect = img.getBoundingClientRect();
          pinchInitMx = cx - (rect.left + rect.width / 2);
          pinchInitMy = cy - (rect.top + rect.height / 2);
        }

        if (isMobile) {
          var mWrap = domRefs.lightboxImgWrap;
          var slides = mWrap.querySelectorAll('.snap-slide');
          for (var i = 0; i < slides.length; i++) {
            if (parseInt(slides[i].dataset.idx) !== cur) {
              slides[i].style.transition = 'none';
              slides[i].style.opacity = '0';
            }
          }
        }
        return;
      }

      if (isPinching) return;

      if (lbZoomLevel > 1 && e.touches.length === 1) {
        dStartX = e.touches[0].clientX;
        dStartY = e.touches[0].clientY;
        return;
      }

      dStartX = e.touches[0].clientX;
      dStartY = e.touches[0].clientY;
      dDY = 0;
      dLocked = false;
      dChecked = false;
      dPts = [{ y: dStartY, t: Date.now() }];
    }, { passive: false });

    lbEl.addEventListener('touchmove', function (e) {
      if (e.target.closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb')) return;
      if (isPinching && e.touches.length === 2) {
        e.preventDefault();
        var dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        var ratio = dist / pinchInitDist;
        var newScale = Math.min(Math.max(1, pinchInitLevel * ratio), 6);
        if (newScale === lbZoomLevel) return;

        var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        var dx = cx - pinchInitCx;
        var dy = cy - pinchInitCy;

        lbZoomLevel = newScale;
        lbZoomPanX = pinchInitPanX - pinchInitMx * (newScale / pinchInitLevel - 1) + dx;
        lbZoomPanY = pinchInitPanY - pinchInitMy * (newScale / pinchInitLevel - 1) + dy;

        var mWrap = domRefs.lightboxImgWrap;
        var img = mWrap.querySelector('.snap-slide[data-idx="' + cur + '"] img');
        if (img) updateZoomTransform(img);
        return;
      }

      if (lbZoomLevel > 1 && e.touches.length === 1 && !isPinching) {
        e.preventDefault();
        var dx = e.touches[0].clientX - dStartX;
        var dy = e.touches[0].clientY - dStartY;
        lbZoomPanX += dx;
        lbZoomPanY += dy;
        dStartX = e.touches[0].clientX;
        dStartY = e.touches[0].clientY;
        var mWrap = domRefs.lightboxImgWrap;
        var img = mWrap.querySelector('.snap-slide[data-idx="' + cur + '"] img');
        if (img) updateZoomTransform(img);
        return;
      }

      if (isPinching || e.touches.length !== 1) return;

      if (dChecked && !dLocked) return;
      var dx = e.touches[0].clientX - dStartX;
      var dy = e.touches[0].clientY - dStartY;
      dPts.push({ y: e.touches[0].clientY, t: Date.now() });
      if (dPts.length > 8) dPts.shift();

      if (!dChecked && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        dChecked = true;
        dLocked = dy > 0 && Math.abs(dy) > Math.abs(dx);
      }

      if (dLocked && dy > 0) {
        dDY = dy;
        e.preventDefault();
        var content = domRefs.lightboxContent;
        content.style.transition = 'none';
        var tilt = Math.max(-10, (dy / 400) * -10); // reduced from -25
        content.style.transformOrigin = 'bottom left';
        content.style.transform = 'translateY(' + dy + 'px) rotate(' + tilt + 'deg)';
        content.style.opacity = Math.max(0.15, 1 - dy / 400);

        var info = domRefs.lightboxInfo;
        if (info) {
          var blurVal = Math.min(18, (dy / 300) * 18);
          var txtOpac = Math.max(0, 1 - dy / 180);
          info.style.transition = 'none';
          info.style.filter = 'blur(' + blurVal + 'px)';
          info.style.opacity = txtOpac;
        }
      }
    }, { passive: false });

    lbEl.addEventListener('touchend', function (e) {
      if (e.target.closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb')) return;
      if (e.touches.length < 2) {
        if (isPinching && e.touches.length === 1 && lbZoomLevel > 1) {
          dStartX = e.touches[0].clientX;
          dStartY = e.touches[0].clientY;
        }
        isPinching = false;

        if (lbZoomLevel <= 1 && isMobile) {
          var mWrap = domRefs.lightboxImgWrap;
          var slides = mWrap.querySelectorAll('.snap-slide');
          for (var i = 0; i < slides.length; i++) {
            slides[i].style.transition = '';
            slides[i].style.opacity = '1';
          }
        }
      }

      if (!dLocked) return;
      var vy = 0;
      if (dPts.length >= 2) {
        var a = dPts[Math.max(0, dPts.length - 4)], b = dPts[dPts.length - 1];
        var dt = b.t - a.t;
        if (dt > 0) vy = (b.y - a.y) / dt;
      }
      if (dDY > 100 || vy > 0.35) {
        swipeHappened = true;
        var content = domRefs.lightboxContent;
        content.style.transition = 'transform 0.28s ease-out, opacity 0.28s ease-out';
        content.style.transform = 'translateY(' + window.innerHeight + 'px) rotate(-30deg)';
        content.style.opacity = '0';

        var info = domRefs.lightboxInfo;
        if (info) {
          info.style.transition = 'opacity 0.2s ease, filter 0.2s ease';
          info.style.filter = 'blur(18px)';
          info.style.opacity = '0';
        }

        setTimeout(function () {
          closeLightbox();
        }, 280);
      } else {
        var content = domRefs.lightboxContent;
        content.style.transition = 'transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.35s ease';
        content.style.transform = '';
        content.style.opacity = '1';

        var info = domRefs.lightboxInfo;
        if (info) {
          info.style.transition = 'opacity 0.35s ease, filter 0.35s ease';
          info.style.filter = '';
          info.style.opacity = '1';
        }

        setTimeout(function () {
          if (content) {
            content.style.transition = '';
            content.style.transformOrigin = '';
          }
          if (info) {
            info.style.transition = '';
          }
        }, 360);
      }
      dLocked = false;
      dChecked = false;
    }, { passive: true });

    lbEl.addEventListener('touchend', function (e) {
      if (!lbEl.classList.contains('open') || !currentLightboxIsMotion) return;
      if (isPinching || dLocked || e.changedTouches.length !== 1 || lbZoomLevel > 1) return;
      if (e.target.closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb, button')) return;

      var dx = e.changedTouches[0].clientX - dStartX;
      var dy = e.changedTouches[0].clientY - dStartY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        swipeHappened = true;
        navigateLightbox(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  })();
}
