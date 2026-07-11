// SWIPE for lightbox
import { domRefs } from './dom.js';
import { state } from './state.js';
import { motionProjects } from './media-data.js';
import { animateInfo, closeLightbox, openLightbox, navigateLightbox, setLightboxBlur, setLightboxContent, setLoadSwipeNeighbors, setMobileScrollToSlideCallback } from './lightbox.js';
import { resetZoom, toggleImageZoom, updateZoomTransform, checkAutoZoomOut } from './lightbox-zoom.js';
import { finishFilmstripPhotoSync, settleFilmstripToPhotoProgress, syncFilmstripToPhotoProgress } from './filmstrip.js';
import { hideFilmstripIfReady, showFilmstripIfReady } from './core.js';
import { getPhotoAspectRatio, saveRatioToCache } from './utils.js';

let lbEl = domRefs.lightbox;
let imgWrap = domRefs.lightboxImgWrap;
let mobileScrollToSlide = null;
let swipeHappened = false;

let lastTapT = 0;

// mobile: tap content area (not interactive elements) to toggle filmstrip
lbEl.addEventListener('click', function (e) {
  if (!state.isMobile) return;
  if (swipeHappened) { swipeHappened = false; return; }
  if ((e.target as HTMLElement).closest('button, .filmstrip-thumb, #filmstrip-wrap, #lightbox-info')) return;

  let now = Date.now();
  let img = e.target as HTMLImageElement;
  if (img && img.tagName.toLowerCase() === 'img' && now - lastTapT < 350) {
    // Double tap zoom
    if (state.lbZoomLevel > 1) {
      resetZoom();
    } else {
      state.lbZoomLevel = 2.5;
      let rect = img.getBoundingClientRect();
      state.lbZoomPanX = -(e.clientX - (rect.left + rect.width / 2)) * (state.lbZoomLevel - 1);
      state.lbZoomPanY = -(e.clientY - (rect.top + rect.height / 2)) * (state.lbZoomLevel - 1);
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
if (state.isMobile) {
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
      if (state.currentLightboxIsMotion) return;
      if (slidesBuilt) return;
      slidesBuilt = true;
      // Remove old #lightbox-img from flow (CSS hides it, but clear src too)
      let mainImg = domRefs.lightboxImg;
      if (mainImg) { mainImg.removeAttribute('src'); }
      state.activePhotos.forEach(function (p, i) {
        let slide = document.createElement('div');
        slide.className = 'snap-slide';
        slide.dataset.idx = String(i);

        let inner = document.createElement('div');
        inner.className = 'snap-slide-inner photo-loading';
        let ratio = getPhotoAspectRatio(p);
        inner.style.setProperty('--lightbox-photo-ratio', String(ratio));

        let img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.alt = p.title || '';
        img.draggable = false;
        img.loading = (Math.abs(i - state.cur) <= 2) ? 'eager' : 'lazy';
        
        img.onload = function () {
          const handleSwipeDecode = () => {
            if (img.naturalWidth && img.naturalHeight) {
              let r = img.naturalWidth / img.naturalHeight;
              inner.style.setProperty('--lightbox-photo-ratio', String(r));
              saveRatioToCache(p.src, img.naturalWidth, img.naturalHeight);
            }
            if (inner.classList.contains('photo-loaded')) return;
            inner.classList.add('photo-loaded');
            inner.classList.remove('photo-placeholder-visible');
            setTimeout(function () {
              inner.classList.remove('photo-loading', 'photo-loaded');
            }, 260);
          };
          if (img.decode) {
            img.decode().then(handleSwipeDecode).catch(handleSwipeDecode);
          } else {
            handleSwipeDecode();
          }
        };
        img.onerror = function () {
          inner.classList.remove('photo-loading', 'photo-placeholder-visible');
          inner.classList.add('photo-error');
        };
        img.src = p.src;
        img.classList.add('zoomable');
        img.addEventListener('click', toggleImageZoom);

        if (img.complete && img.naturalWidth > 0) {
          inner.classList.remove('photo-loading', 'photo-placeholder-visible');
          inner.classList.add('photo-loaded');
          let r = img.naturalWidth / img.naturalHeight;
          inner.style.setProperty('--lightbox-photo-ratio', String(r));
          saveRatioToCache(p.src, img.naturalWidth, img.naturalHeight);
        } else {
          requestAnimationFrame(function () {
            if (!inner.classList.contains('photo-loaded') && !inner.classList.contains('photo-error')) {
              inner.classList.add('photo-placeholder-visible');
            }
          });
        }

        inner.appendChild(img);
        slide.appendChild(inner);
        imgWrap.appendChild(slide);
      });
    }

    function scrollToSlide(idx: any, smooth: any, dir?: any) {
      if (state.currentLightboxIsMotion) return;
      let w = imgWrap.offsetWidth;
      if (!w) return;
      if (smooth) {
        let oldIdx = Math.round(imgWrap.scrollLeft / w);
        if (idx === oldIdx) return;

        window.isAutoRapidScrolling = true;
        let slideDir = dir || (idx > oldIdx ? 1 : -1);
        let exitX = slideDir > 0 ? '-6%' : '6%';
        let enterX = slideDir > 0 ? '6%' : '-6%';

        let currentInner = imgWrap.querySelector('.snap-slide[data-idx="' + oldIdx + '"] .snap-slide-inner') as HTMLElement;
        let info = domRefs.lightboxInfo;
        let finalP = state.activePhotos[idx];
        setLightboxBlur(finalP.thumb || finalP.src);

        // Turn off scroll snapping immediately to prevent browser layout snaps during transition
        imgWrap.style.scrollSnapType = 'none';

        if (currentInner) {
          currentInner.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
          currentInner.style.opacity = '0';
          currentInner.style.transform = 'translateX(' + exitX + ') scale(0.98)';
        }
        if (info) {
          info.style.animation = 'none';
          info.style.transition = 'none';
          info.style.opacity = '0';
        }

        setTimeout(function () {
          imgWrap.scrollTo({ left: idx * w, behavior: 'instant' });

          state.cur = idx;
          setLightboxContent(finalP);
          showFilmstripIfReady();
          if (typeof updateLoading === 'function') updateLoading();
          if (typeof finishFilmstripPhotoSync === 'function') finishFilmstripPhotoSync(idx);

          // Animate the details text using the same CSS animation engine as desktop
          animateInfo(slideDir);

          let targetInner = imgWrap.querySelector('.snap-slide[data-idx="' + idx + '"] .snap-slide-inner') as HTMLElement;
          if (targetInner) {
            targetInner.style.transition = 'none';
            targetInner.style.transform = 'translateX(' + enterX + ') scale(0.98)';
            targetInner.style.opacity = '0';
            void targetInner.offsetWidth;
          }

          requestAnimationFrame(function () {
            if (targetInner) {
              targetInner.style.transition = 'opacity 0.22s ease, transform 0.22s cubic-bezier(0.22,1,0.36,1)';
              targetInner.style.opacity = '1';
              targetInner.style.transform = '';
            }
          });

          setTimeout(function () {
            window.isAutoRapidScrolling = false;
            // Restore scroll snapping once transition is complete
            imgWrap.style.scrollSnapType = '';
            if (currentInner) {
              currentInner.style.transition = '';
              currentInner.style.opacity = '';
              currentInner.style.transform = '';
            }
            if (targetInner) {
              targetInner.style.transition = '';
              targetInner.style.opacity = '';
              targetInner.style.transform = '';
            }
          }, 240);
        }, 150);
      } else {
        imgWrap.scrollTo({ left: idx * w, behavior: 'instant' });
      }
    }
    mobileScrollToSlide = scrollToSlide;
    setMobileScrollToSlideCallback(scrollToSlide);

    // Over-scroll loop detection bounds
    let wrapTouchX = 0;
    let isUserTouching = false;
    let filmstripReleaseFollowUntil = 0;
    let FILMSTRIP_RELEASE_FOLLOW_MS = 72;
    imgWrap.addEventListener('touchstart', function (e) {
      if (state.currentLightboxIsMotion) return;
      isUserTouching = true;
      filmstripReleaseFollowUntil = 0;
      if (e.touches.length === 1) wrapTouchX = e.touches[0].clientX;
    }, { passive: true });
    imgWrap.addEventListener('touchend', function (e) {
      if (state.currentLightboxIsMotion) return;
      isUserTouching = false;
      if (wasPinchingOrZooming) {
        if (e.touches.length === 0) {
          wasPinchingOrZooming = false;
        }
        return;
      }
      if (Math.abs(state.lbZoomLevel) > 1 || e.changedTouches.length !== 1) return;
      let dx = e.changedTouches[0].clientX - wrapTouchX;
      let maxScroll = imgWrap.scrollWidth - imgWrap.offsetWidth;
      if (imgWrap.scrollLeft >= maxScroll - 5 && dx < -45) {
        // Pulled left while on the last slide -> Loop to 0
        openLightbox(0, 1);
      } else if (imgWrap.scrollLeft <= 5 && dx > 45) {
        // Pulled right while on the first slide -> Loop to end
        openLightbox(state.activePhotos.length - 1, -1);
      } else {
        filmstripReleaseFollowUntil = performance.now() + FILMSTRIP_RELEASE_FOLLOW_MS;
        setTimeout(function () {
          filmstripReleaseFollowUntil = 0;
          onSnapSettle();
        }, FILMSTRIP_RELEASE_FOLLOW_MS);
      }
    }, { passive: true });

    // ── Eager-load nearby slides ──
    function updateLoading() {
      if (state.currentLightboxIsMotion) return;
      let imgs = imgWrap.querySelectorAll('.snap-slide img') as NodeListOf<HTMLImageElement>;
      for (let i = 0; i < imgs.length; i++) {
        let shouldEager = (Math.abs(i - state.cur) <= 2);
        imgs[i].loading = shouldEager ? 'eager' : 'lazy';
        if (shouldEager && imgs[i].decode && !imgs[i].dataset.decoded) {
          (function (img) {
            img.decode().then(function () { img.dataset.decoded = "true"; }).catch(function () { });
          })(imgs[i]);
        }
      }
    }

    // ── Scroll settle — detect new active slide ──
    function onSnapSettle(targetIdx?: number) {
      if (state.currentLightboxIsMotion || state.lbZoomLevel > 1) return;
      if (isUserTouching && typeof targetIdx === 'undefined') return;
      state.isManuallyNavigating = false; // Reset navigation flag on settle
      let w = imgWrap.offsetWidth;
      if (!w) return;
      let rawNearest = Math.round(imgWrap.scrollLeft / w);
      let idx = typeof targetIdx === 'number' ? targetIdx : Math.max(0, Math.min(rawNearest, state.activePhotos.length - 1));

      if (idx !== state.cur) {
        let dir = idx > state.cur ? 1 : -1;
        state.cur = idx;
        let p = state.activePhotos[state.cur];

        // blur bg crossfade immediately
        setLightboxBlur(p.thumb || p.src);

        setLightboxContent(p);
        showFilmstripIfReady();
        updateLoading();
      }
      if (typeof finishFilmstripPhotoSync === 'function') finishFilmstripPhotoSync(idx);

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
      if (state.currentLightboxIsMotion || state.lbZoomLevel > 1) return;
      if (window.isAutoRapidScrolling) return; // Prevent layout snaps during math interpolation
      clearTimeout(snapTimer);
      if (performance.now() < filmstripReleaseFollowUntil) return;
      if (!state.isManuallyNavigating) onSnapSettle();
    });
    imgWrap.addEventListener('scroll', function () {
      if (state.currentLightboxIsMotion || state.lbZoomLevel > 1) return;
      clearTimeout(snapTimer);
      snapTimer = setTimeout(onSnapSettle, 150);
      let w = imgWrap.offsetWidth;
      if (!w) return;
      let f = imgWrap.scrollLeft / w;
      let nearest = Math.round(f);
      nearest = Math.max(0, Math.min(nearest, state.activePhotos.length - 1));

      let hint = document.getElementById('swipe-hint');
      if (hint && Math.abs(imgWrap.scrollLeft - state.cur * w) > 10) {
        hint.classList.remove('visible');
      }

      let isFilmstripDirectPhase = isUserTouching || performance.now() < filmstripReleaseFollowUntil;

      // Use exact sync while touching and briefly after release, then rAF-settle the final bit.
      if (!state.fsRaf && !state.isManuallyNavigating && !window.isAutoRapidScrolling && !state.isTouchingFilmstrip) {
        if (isFilmstripDirectPhase && typeof syncFilmstripToPhotoProgress === 'function') {
          syncFilmstripToPhotoProgress(f);
        } else if (!isFilmstripDirectPhase && typeof settleFilmstripToPhotoProgress === 'function') {
          settleFilmstripToPhotoProgress(nearest);
        }
      }

      // rapid scroll mode suspends normal text updates to keep transition fluid
      if (window.isAutoRapidScrolling) {
        state.cur = nearest;
        return;
      }

      // preload text underneath if we cross 50% mark — but ONLY if not currently holding
      if (nearest !== state.cur && !isFilmstripDirectPhase && !state.isManuallyNavigating) {
        onSnapSettle(nearest);
      }

      let dist = Math.abs(imgWrap.scrollLeft - nearest * w) / w;
      let info = domRefs.lightboxInfo;
      if (info) {
        info.style.animation = 'none';
        info.style.transition = 'none';
        let swipeDelta = imgWrap.scrollLeft - state.cur * w;

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
      if (state.currentLightboxIsMotion) {
        clearSlides();
        requestAnimationFrame(function () {
          let motionItem = motionProjects[state.cur];
          if (motionItem) {
            setLightboxContent(motionItem);
            animateInfo(0);
          }
        });
        return;
      }
      buildSlides();
      requestAnimationFrame(function () {
        scrollToSlide(state.cur, false);
        updateLoading();
        onSnapSettle(state.cur);
        let p = state.activePhotos[state.cur];
        setLightboxContent(p);
        animateInfo(0);
      });
    });

    setLoadSwipeNeighbors(function () { updateLoading(); });

    // Re-align on resize/orientation change
    window.addEventListener('resize', function () {
      if (lbEl.classList.contains('open')) {
        scrollToSlide(state.cur, false);
      }
    });

    // ─── SWIPE DOWN TO DISMISS & PINCH TO ZOOM ───
    let dStartX = 0, dStartY = 0, dDY = 0;
    let dLocked = false, dChecked = false;
    let dPts = [];
    let isPinching = false, wasPinchingOrZooming = false, pinchInitDist = 0, pinchInitLevel = 1, pinchInitPanX = 0, pinchInitPanY = 0, pinchInitMx = 0, pinchInitMy = 0, pinchInitCx = 0, pinchInitCy = 0;

    lbEl.addEventListener('touchstart', function (e) {
      if (!lbEl.classList.contains('open')) return;
      // stricter check to prevent interaction fight between filmstrip and dismiss gesture
      if ((e.target as HTMLElement).closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb')) return;

      if (e.touches.length === 1) {
        wasPinchingOrZooming = false;
      }

      if (e.touches.length >= 2) {
        wasPinchingOrZooming = true;
      }

      if (e.touches.length === 2 && !dLocked) {
        isPinching = true;
        pinchInitDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        pinchInitLevel = state.lbZoomLevel;
        pinchInitPanX = state.lbZoomPanX;
        pinchInitPanY = state.lbZoomPanY;

        let cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        let cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        pinchInitCx = cx;
        pinchInitCy = cy;
        let mWrap = domRefs.lightboxImgWrap;
        let img = mWrap.querySelector('.snap-slide[data-idx="' + state.cur + '"] img');
        if (img) {
          let rect = img.getBoundingClientRect();
          pinchInitMx = cx - (rect.left + rect.width / 2);
          pinchInitMy = cy - (rect.top + rect.height / 2);
        }

        if (state.isMobile) {
          let mWrap = domRefs.lightboxImgWrap;
          let slides = mWrap.querySelectorAll('.snap-slide') as NodeListOf<HTMLElement>;
          for (let i = 0; i < slides.length; i++) {
            if (parseInt(slides[i].dataset.idx) !== state.cur) {
              slides[i].style.transition = 'none';
              slides[i].style.opacity = '0';
            }
          }
        }
        return;
      }

      if (isPinching) return;

      if (state.lbZoomLevel > 1 && e.touches.length === 1) {
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
      if ((e.target as HTMLElement).closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb')) return;
      if (isPinching && e.touches.length === 2) {
        e.preventDefault();
        let dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        let ratio = dist / pinchInitDist;
        let newScale = Math.min(Math.max(1, pinchInitLevel * ratio), 6);
        if (newScale === state.lbZoomLevel) return;

        let cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        let cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        let dx = cx - pinchInitCx;
        let dy = cy - pinchInitCy;

        state.lbZoomLevel = newScale;
        state.lbZoomPanX = pinchInitPanX - pinchInitMx * (newScale / pinchInitLevel - 1) + dx;
        state.lbZoomPanY = pinchInitPanY - pinchInitMy * (newScale / pinchInitLevel - 1) + dy;

        let mWrap = domRefs.lightboxImgWrap;
        let img = mWrap.querySelector('.snap-slide[data-idx="' + state.cur + '"] img');
        if (img) updateZoomTransform(img);
        return;
      }

      if (state.lbZoomLevel > 1 && e.touches.length === 1 && !isPinching) {
        e.preventDefault();
        let dx = e.touches[0].clientX - dStartX;
        let dy = e.touches[0].clientY - dStartY;
        state.lbZoomPanX += dx;
        state.lbZoomPanY += dy;
        dStartX = e.touches[0].clientX;
        dStartY = e.touches[0].clientY;
        let mWrap = domRefs.lightboxImgWrap;
        let img = mWrap.querySelector('.snap-slide[data-idx="' + state.cur + '"] img');
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
        content.style.opacity = String(Math.max(0.15, 1 - dy / 400));

        let info = domRefs.lightboxInfo;
        if (info) {
          let blurVal = Math.min(18, (dy / 300) * 18);
          let txtOpac = Math.max(0, 1 - dy / 180);
          info.style.transition = 'none';
          info.style.filter = 'blur(' + blurVal + 'px)';
          info.style.opacity = String(txtOpac);
        }
      }
    }, { passive: false });

    lbEl.addEventListener('touchend', function (e) {
      if ((e.target as HTMLElement).closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb')) return;
      if (e.touches.length < 2) {
        if (isPinching && e.touches.length === 1 && state.lbZoomLevel > 1) {
          dStartX = e.touches[0].clientX;
          dStartY = e.touches[0].clientY;
        }
        isPinching = false;

        if (state.lbZoomLevel > 1 && e.touches.length === 0) {
          let mWrap = domRefs.lightboxImgWrap;
          let img = mWrap.querySelector('.snap-slide[data-idx="' + state.cur + '"] img') as HTMLImageElement;
          if (img) {
            checkAutoZoomOut(img);
          }
        }

        if (state.lbZoomLevel <= 1 && state.isMobile) {
          let mWrap = domRefs.lightboxImgWrap;
          let slides = mWrap.querySelectorAll('.snap-slide') as NodeListOf<HTMLElement>;
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
      if (!lbEl.classList.contains('open') || !state.currentLightboxIsMotion) return;
      if (isPinching || dLocked || e.changedTouches.length !== 1 || state.lbZoomLevel > 1) return;
      if ((e.target as HTMLElement).closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb, button')) return;

      let dx = e.changedTouches[0].clientX - dStartX;
      let dy = e.changedTouches[0].clientY - dStartY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        swipeHappened = true;
        navigateLightbox(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  })();
}
