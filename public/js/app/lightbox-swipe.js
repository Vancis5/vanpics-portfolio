// SWIPE for lightbox
let lbEl = domRefs.lightbox;
let imgWrap = domRefs.lightboxImgWrap;
let loadSwipeNeighbors = function () { };
let mobileScrollToSlide = null;
let swipeHappened = false;

let lastTapT = 0;

// mobile: tap content area (not interactive elements) to toggle filmstrip
lbEl.addEventListener('click', function (e) {
  if (!isMobile) return;
  if (swipeHappened) { swipeHappened = false; return; }
  if (e.target.closest('button, .filmstrip-thumb, #filmstrip-wrap, #lightbox-info')) return;

  let now = Date.now();
  if (e.target.tagName.toLowerCase() === 'img' && now - lastTapT < 350) {
    // Double tap zoom
    if (lbZoomLevel > 1) {
      resetZoom();
    } else {
      lbZoomLevel = 2.5;
      let img = e.target;
      let rect = img.getBoundingClientRect();
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
    if (domRefs.filmstripWrap.classList.contains('visible')) {
      hideFilmstripIfReady();
    } else {
      showFilmstripIfReady();
    }
  }
});

// ─── MOBILE SCROLL-SNAP GALLERY ───
// Native scroll container with snap points — browser handles touch physics
if (isMobile) {
  (function () {
    let slidesBuilt = false;
    let snapTimer = null;
    function clearSlides() {
      let slides = imgWrap.querySelectorAll('.snap-slide');
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
      let mainImg = domRefs.lightboxImg;
      if (mainImg) { mainImg.removeAttribute('src'); }
      activePhotos.forEach(function (p, i) {
        let slide = document.createElement('div');
        slide.className = 'snap-slide';
        slide.dataset.idx = i;
        let img = document.createElement('img');
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
      let w = imgWrap.offsetWidth;
      if (!w) return;
      if (smooth) {
        window.isAutoRapidScrolling = true;
        imgWrap.style.scrollSnapType = 'none'; // release OS clamp
        let startPos = imgWrap.scrollLeft;
        let targetPos = idx * w;
        let startTime = performance.now();
        let duration = 380; // mathematically sleek transition (faster than OS default)
        let slideDir = dir || (targetPos > startPos ? 1 : -1);

        let info = domRefs.lightboxInfo;
        // Animate OLD text gracefully exiting and trigger the massive BG blur crossfade immediately
        let finalP = activePhotos[idx];
        setLightboxBlur(finalP.src);

        if (info) {
          info.style.transition = 'opacity 0.18s ease, filter 0.18s ease, transform 0.18s ease';
          info.style.opacity = '0';
          info.style.filter = 'blur(10px)';
          info.style.transform = 'translate3d(' + (-slideDir * 25) + 'px, 0, 0) scale(0.92)';
        }

        function step(time) {
          let elapsed = time - startTime;
          if (elapsed >= duration) {
            imgWrap.scrollTo({ left: targetPos, behavior: 'instant' });
            imgWrap.style.scrollSnapType = ''; // restore OS clamp

            // Allow CSS transition to execute without asynchronous scroll intercepts killing inline physics
            setTimeout(function () { window.isAutoRapidScrolling = false; }, 50);

            setLightboxContent(finalP);
            showFilmstripIfReady();
            if (typeof updateLoading === 'function') updateLoading();

            let info = domRefs.lightboxInfo;
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
          let t = elapsed / duration;
          let ease = 1 - Math.pow(1 - t, 4); // ease-out quart
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
    let wrapTouchX = 0;
    let isUserTouching = false;
    imgWrap.addEventListener('touchstart', function (e) {
      if (currentLightboxIsMotion) return;
      isUserTouching = true;
      if (e.touches.length === 1) wrapTouchX = e.touches[0].clientX;
    }, { passive: true });
    imgWrap.addEventListener('touchend', function (e) {
      if (currentLightboxIsMotion) return;
      isUserTouching = false;
      if (Math.abs(lbZoomLevel) > 1 || e.changedTouches.length !== 1) return;
      let dx = e.changedTouches[0].clientX - wrapTouchX;
      let maxScroll = imgWrap.scrollWidth - imgWrap.offsetWidth;
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
      let imgs = imgWrap.querySelectorAll('.snap-slide img');
      for (let i = 0; i < imgs.length; i++) {
        let shouldEager = (Math.abs(i - cur) <= 2);
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
      let w = imgWrap.offsetWidth;
      if (!w) return;
      let rawNearest = Math.round(imgWrap.scrollLeft / w);
      let idx = typeof targetIdx === 'number' ? targetIdx : Math.max(0, Math.min(rawNearest, activePhotos.length - 1));

      if (idx !== cur) {
        let dir = idx > cur ? 1 : -1;
        cur = idx;
        let p = activePhotos[cur];

        // blur bg crossfade immediately
        setLightboxBlur(p.src);

        setLightboxContent(p);
        showFilmstripIfReady();
        updateLoading();
      }

      // enforce visible opacity if this was called by snap-settle completion (no arg)
      if (typeof targetIdx !== 'number') {
        let info = domRefs.lightboxInfo;
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
      let w = imgWrap.offsetWidth;
      if (!w) return;
      let f = imgWrap.scrollLeft / w;

      let hint = document.getElementById('swipe-hint');
      if (hint && Math.abs(imgWrap.scrollLeft - cur * w) > 10) {
        hint.classList.remove('visible');
      }

      // smoothly sync filmstrip scrub to native drag
      if (!fsRaf && !isManuallyNavigating && !window.isAutoRapidScrolling && !isTouchingFilmstrip) {
        let thumbs = filmstripEl.querySelectorAll('.filmstrip-thumb');
        if (thumbs.length > 0) {
          let thumbW = thumbs[0].offsetWidth;
          let gap = 5;
          let paddingLeft = parseFloat(filmstripEl.style.paddingLeft) || 0;
          let targetCenter = paddingLeft + f * (thumbW + gap) + thumbW / 2;
          startFsSync(targetCenter - filmstripEl.offsetWidth / 2);
        }
      }

      let nearest = Math.round(f);
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

      let dist = Math.abs(imgWrap.scrollLeft - nearest * w) / w;
      let info = domRefs.lightboxInfo;
      if (info) {
        info.style.animation = 'none';
        info.style.transition = 'none';
        let swipeDelta = imgWrap.scrollLeft - cur * w;

        if (dist === 0) {
          info.style.opacity = '1';
          info.style.filter = '';
          info.style.transform = '';
        } else {
          // 1:1 physical mapping — fades completely out by 16% scroll distance
          let op = Math.max(0, 1 - dist * 6.25);
          let bl = Math.min(10, dist * 40);
          // Calculate slide direction offset
          let tx = swipeDelta > 0 ? Math.max(-20, -dist * 80) : Math.min(20, dist * 80);

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
          let motionItem = motionProjects[cur];
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
        let p = activePhotos[cur];
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
    let dStartX = 0, dStartY = 0, dDY = 0;
    let dLocked = false, dChecked = false;
    let dPts = [];
    let isPinching = false, pinchInitDist = 0, pinchInitLevel = 1, pinchInitPanX = 0, pinchInitPanY = 0, pinchInitMx = 0, pinchInitMy = 0, pinchInitCx = 0, pinchInitCy = 0;

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

        let cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        let cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        pinchInitCx = cx;
        pinchInitCy = cy;
        let mWrap = domRefs.lightboxImgWrap;
        let img = mWrap.querySelector('.snap-slide[data-idx="' + cur + '"] img');
        if (img) {
          let rect = img.getBoundingClientRect();
          pinchInitMx = cx - (rect.left + rect.width / 2);
          pinchInitMy = cy - (rect.top + rect.height / 2);
        }

        if (isMobile) {
          let mWrap = domRefs.lightboxImgWrap;
          let slides = mWrap.querySelectorAll('.snap-slide');
          for (let i = 0; i < slides.length; i++) {
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
        let dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        let ratio = dist / pinchInitDist;
        let newScale = Math.min(Math.max(1, pinchInitLevel * ratio), 6);
        if (newScale === lbZoomLevel) return;

        let cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        let cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        let dx = cx - pinchInitCx;
        let dy = cy - pinchInitCy;

        lbZoomLevel = newScale;
        lbZoomPanX = pinchInitPanX - pinchInitMx * (newScale / pinchInitLevel - 1) + dx;
        lbZoomPanY = pinchInitPanY - pinchInitMy * (newScale / pinchInitLevel - 1) + dy;

        let mWrap = domRefs.lightboxImgWrap;
        let img = mWrap.querySelector('.snap-slide[data-idx="' + cur + '"] img');
        if (img) updateZoomTransform(img);
        return;
      }

      if (lbZoomLevel > 1 && e.touches.length === 1 && !isPinching) {
        e.preventDefault();
        let dx = e.touches[0].clientX - dStartX;
        let dy = e.touches[0].clientY - dStartY;
        lbZoomPanX += dx;
        lbZoomPanY += dy;
        dStartX = e.touches[0].clientX;
        dStartY = e.touches[0].clientY;
        let mWrap = domRefs.lightboxImgWrap;
        let img = mWrap.querySelector('.snap-slide[data-idx="' + cur + '"] img');
        if (img) updateZoomTransform(img);
        return;
      }

      if (isPinching || e.touches.length !== 1) return;

      if (dChecked && !dLocked) return;
      let dx = e.touches[0].clientX - dStartX;
      let dy = e.touches[0].clientY - dStartY;
      dPts.push({ y: e.touches[0].clientY, t: Date.now() });
      if (dPts.length > 8) dPts.shift();

      if (!dChecked && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        dChecked = true;
        dLocked = dy > 0 && Math.abs(dy) > Math.abs(dx);
      }

      if (dLocked && dy > 0) {
        dDY = dy;
        e.preventDefault();
        let content = domRefs.lightboxContent;
        content.style.transition = 'none';
        let tilt = Math.max(-10, (dy / 400) * -10); // reduced from -25
        content.style.transformOrigin = 'bottom left';
        content.style.transform = 'translateY(' + dy + 'px) rotate(' + tilt + 'deg)';
        content.style.opacity = Math.max(0.15, 1 - dy / 400);

        let info = domRefs.lightboxInfo;
        if (info) {
          let blurVal = Math.min(18, (dy / 300) * 18);
          let txtOpac = Math.max(0, 1 - dy / 180);
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
          let mWrap = domRefs.lightboxImgWrap;
          let slides = mWrap.querySelectorAll('.snap-slide');
          for (let i = 0; i < slides.length; i++) {
            slides[i].style.transition = '';
            slides[i].style.opacity = '1';
          }
        }
      }

      if (!dLocked) return;
      let vy = 0;
      if (dPts.length >= 2) {
        let a = dPts[Math.max(0, dPts.length - 4)], b = dPts[dPts.length - 1];
        let dt = b.t - a.t;
        if (dt > 0) vy = (b.y - a.y) / dt;
      }
      if (dDY > 100 || vy > 0.35) {
        swipeHappened = true;
        let content = domRefs.lightboxContent;
        content.style.transition = 'transform 0.28s ease-out, opacity 0.28s ease-out';
        content.style.transform = 'translateY(' + window.innerHeight + 'px) rotate(-30deg)';
        content.style.opacity = '0';

        let info = domRefs.lightboxInfo;
        if (info) {
          info.style.transition = 'opacity 0.2s ease, filter 0.2s ease';
          info.style.filter = 'blur(18px)';
          info.style.opacity = '0';
        }

        setTimeout(function () {
          closeLightbox();
        }, 280);
      } else {
        let content = domRefs.lightboxContent;
        content.style.transition = 'transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.35s ease';
        content.style.transform = '';
        content.style.opacity = '1';

        let info = domRefs.lightboxInfo;
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

      let dx = e.changedTouches[0].clientX - dStartX;
      let dy = e.changedTouches[0].clientY - dStartY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        swipeHappened = true;
        navigateLightbox(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  })();
}
