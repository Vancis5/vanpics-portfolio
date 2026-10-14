// SWIPE for lightbox
import { domRefs } from './dom.js';
import { state } from './state.js';
import { animateInfo, closeLightbox, openLightbox, navigateLightbox, setLightboxBlur, setLightboxContent, setMobileScrollHandler, updateMobileImgWrapHeight, cancelDescFlipTransition, updateLightboxDescPreview } from './lightbox.js';
import { resetZoom, updateZoomTransform, checkAutoZoomOut } from './lightbox-zoom.js';
import { finishFilmstripPhotoSync, settleFilmstripToPhotoProgress, syncFilmstripToPhotoProgress } from './filmstrip.js';
import { hideFilmstripIfReady, showFilmstripIfReady } from './core.js';
import { getPhotoAspectRatio, saveRatioToCache, fadeInWhenReady } from './utils.js';
import { pauseMotionVideo } from './lightbox-media.js';
import { motionProjects } from './media-data.js';
import { isLbSrcUrl, lightboxSrc, markLbSrcFailed } from './lightbox-cache.js';

let lbEl = domRefs.lightbox;
let imgWrap = domRefs.lightboxImgWrap;
let swipeHappened = false;

let lastTapT = 0;

// mobile: tap content area (not interactive elements) to toggle filmstrip
lbEl.addEventListener('click', function (e) {
  if (!state.isMobile || state.currentLightboxIsMotion) return;
  if (swipeHappened) { swipeHappened = false; return; }
  if ((e.target as HTMLElement).closest('button, .filmstrip-thumb, #filmstrip-wrap, #lightbox-info, video-player, #motion-player-shell')) return;

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
    let snapTimer: any = null;
    function clearSlides() {
      state.isManuallyNavigating = true;
      let slides = imgWrap.querySelectorAll('.snap-slide');
      slides.forEach(function (slide) { slide.remove(); });
      slidesBuilt = false;
      imgWrap.scrollLeft = 0;
      setTimeout(function () {
        state.isManuallyNavigating = false;
      }, 50);
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
      state.activePhotos.forEach(function (p: any, i: number) {
        let slide = document.createElement('div');
        slide.className = 'snap-slide';
        slide.dataset.idx = String(i);

        let inner = document.createElement('div');
        inner.className = 'snap-slide-inner photo-loading photo-placeholder-visible';
        let ratio = getPhotoAspectRatio(p);
        inner.style.setProperty('--lightbox-photo-ratio', String(ratio));

        let img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.alt = p.title || '';
        img.draggable = false;
        let shouldLoad = (Math.abs(i - state.cur) <= 2);
        img.loading = shouldLoad ? 'eager' : 'lazy';
        img.classList.add('zoomable');

        if (shouldLoad) {
          img.src = lightboxSrc(p);
          fadeInWhenReady(img).then(() => {
            inner.classList.remove('photo-loading', 'photo-placeholder-visible');
            inner.classList.add('photo-loaded');
            if (img.naturalWidth && img.naturalHeight) {
              let r = img.naturalWidth / img.naturalHeight;
              inner.style.setProperty('--lightbox-photo-ratio', String(r));
              saveRatioToCache(p.src, img.naturalWidth, img.naturalHeight);
            }
          });
        }

        let attemptedFallback = false;
        img.onerror = function () {
          if (!attemptedFallback && isLbSrcUrl(p, img.getAttribute('src'))) {
            attemptedFallback = true;
            markLbSrcFailed(p.lbSrc);
            img.src = p.src;
            fadeInWhenReady(img).then(() => {
              if (inner) {
                inner.classList.remove('photo-loading', 'photo-placeholder-visible');
                inner.classList.add('photo-loaded');
                if (img.naturalWidth && img.naturalHeight) {
                  let r = img.naturalWidth / img.naturalHeight;
                  inner.style.setProperty('--lightbox-photo-ratio', String(r));
                  saveRatioToCache(p.src, img.naturalWidth, img.naturalHeight);
                }
              }
            });
            return;
          }
          inner.classList.remove('photo-loading', 'photo-placeholder-visible');
          inner.classList.add('photo-error');
        };

        inner.appendChild(img);
        slide.appendChild(inner);
        imgWrap.appendChild(slide);
      });
    }

    function scrollToSlide(idx: number, smooth = true) {
      if (state.currentLightboxIsMotion) return;
      let slide = imgWrap.querySelector('.snap-slide[data-idx="' + idx + '"]') as HTMLElement;
      let w = imgWrap.offsetWidth || window.innerWidth;
      let targetLeft = (slide && slide.offsetLeft > 0) ? slide.offsetLeft : (idx * w);
      clearTimeout(snapTimer);
      state.isManuallyNavigating = true;
      imgWrap.style.scrollSnapType = 'none';
      if (slide) {
        imgWrap.scrollTo({
          left: targetLeft,
          behavior: smooth ? 'smooth' : 'instant'
        });
      } else {
        imgWrap.scrollLeft = targetLeft;
      }
      let currentIdx = Math.round(imgWrap.scrollLeft / (w || 1));
      let dist = Math.abs(idx - currentIdx);
      let settleDelay = smooth ? Math.min(600, Math.max(300, dist * 70)) : 50;
      updateLoading(idx);
      snapTimer = setTimeout(function () {
        imgWrap.style.scrollSnapType = '';
        if (Math.abs(imgWrap.scrollLeft - targetLeft) > 5) {
          imgWrap.scrollLeft = targetLeft;
        }
        onSnapSettle(idx);
      }, settleDelay);
    }
    setMobileScrollHandler(scrollToSlide);
    window.addEventListener('lightbox-scroll-to', function (e: any) {
      if (e && e.detail) {
        scrollToSlide(e.detail.index, e.detail.smooth);
      }
    });

    let wrapTouchX = 0;
    let filmstripReleaseFollowUntil = 0;
    const FILMSTRIP_RELEASE_FOLLOW_MS = 300;

    imgWrap.addEventListener('touchstart', function (e) {
      if (state.currentLightboxIsMotion) return;
      filmstripReleaseFollowUntil = 0;
      if (e.touches.length === 1) wrapTouchX = e.touches[0].clientX;

      let content = domRefs.lightboxContent;
      if (content && content.classList.contains('desc-open')) {
        cancelDescFlipTransition();
        updateLightboxDescPreview();
        updateMobileImgWrapHeight(true);
      }
      state.isUserTouching = true;
    }, { passive: true });

    imgWrap.addEventListener('touchend', function (e) {
      if (state.currentLightboxIsMotion) return;
      state.isUserTouching = false;
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
        }, FILMSTRIP_RELEASE_FOLLOW_MS);

        // Snap-back: apply spring ease-out to slide imgs immediately on release
        // so blur/scale settle smoothly alongside native scroll snap physics
        let slideImgs = imgWrap.querySelectorAll('.snap-slide img') as NodeListOf<HTMLElement>;
        slideImgs.forEach(function (s) {
          s.style.transition = 'filter 0.55s cubic-bezier(0.22, 1, 0.36, 1), transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
          s.style.filter = '';
          s.style.transform = '';
          setTimeout(function () { s.style.transition = ''; }, 580);
        });
      }
    }, { passive: true });

    imgWrap.addEventListener('touchcancel', function () {
      state.isUserTouching = false;
    }, { passive: true });

    // Slides currently holding a will-change layer; released together once the
    // swipe is at rest so reversals / multi-slide flicks can't strand one.
    const fxLayerSlides = new Set<HTMLElement>();
    function releaseFxLayers() {
      fxLayerSlides.forEach(function (el) {
        el.style.willChange = '';
      });
      fxLayerSlides.clear();
    }

    // ── Eager-load nearby slides with windowed loading ──
    function updateLoading(targetIdx: number = state.cur) {
      if (state.currentLightboxIsMotion) return;
      let slides = imgWrap.querySelectorAll('.snap-slide');
      for (let i = 0; i < slides.length; i++) {
        let shouldEager = (Math.abs(i - targetIdx) <= 2);
        let img = slides[i].querySelector('img') as HTMLImageElement | null;
        if (!img) continue;
        let p = state.activePhotos[i];
        if (shouldEager) {
          if (!img.getAttribute('src') && p) {
            img.src = lightboxSrc(p);
            let inner = slides[i].querySelector('.snap-slide-inner') as HTMLElement | null;
            fadeInWhenReady(img).then(() => {
              if (inner) {
                inner.classList.remove('photo-loading', 'photo-placeholder-visible');
                inner.classList.add('photo-loaded');
                if (img.naturalWidth && img.naturalHeight) {
                  let r = img.naturalWidth / img.naturalHeight;
                  inner.style.setProperty('--lightbox-photo-ratio', String(r));
                  saveRatioToCache(p.src, img.naturalWidth, img.naturalHeight);
                }
              }
            });
          }
          img.loading = 'eager';
          if (typeof img.decode === 'function' && !img.dataset.decoded && img.complete) {
            img.decode().then(function () { img.dataset.decoded = "true"; }).catch(function () { });
          }
        } else if (Math.abs(i - state.cur) > 4 && img.getAttribute('src')) {
          img.removeAttribute('src');
          img.removeAttribute('data-decoded');
          let inner = slides[i].querySelector('.snap-slide-inner') as HTMLElement | null;
          if (inner) {
            inner.classList.remove('photo-loaded');
            inner.classList.add('photo-loading', 'photo-placeholder-visible');
          }
        }
      }
    }

    // ── Scroll settle — detect new active slide ──
    function onSnapSettle(targetIdx?: number) {
      if (state.currentLightboxIsMotion || state.lbZoomLevel > 1 || window.isAutoRapidScrolling) return;
      if (state.isUserTouching && typeof targetIdx === 'undefined') return;
      let w = imgWrap.offsetWidth || window.innerWidth;
      if (!w) return;

      // Only force scrollLeft if explicitly opening or programmatically navigating
      if (typeof targetIdx === 'number' && (!lbEl.classList.contains('open') || state.isManuallyNavigating)) {
        let expectedLeft = targetIdx * w;
        if (Math.abs(imgWrap.scrollLeft - expectedLeft) > 5) {
          imgWrap.scrollLeft = expectedLeft;
        }
      }
      state.isManuallyNavigating = false;

      let rawNearest = Math.round(imgWrap.scrollLeft / w);
      let idx = typeof targetIdx === 'number' ? targetIdx : Math.max(0, Math.min(rawNearest, state.activePhotos.length - 1));

      if (idx !== state.cur) {
        let dir = idx > state.cur ? 1 : -1;
        state.cur = idx;
        let p = state.activePhotos[state.cur];
        if (p) {
          setLightboxBlur(p.thumb || p.src);
          setLightboxContent(p);
        }
        showFilmstripIfReady();
        updateLoading();
      }
      if (typeof finishFilmstripPhotoSync === 'function') finishFilmstripPhotoSync(idx);

      updateMobileImgWrapHeight();

      if (!state.isUserTouching) {
        let info = domRefs.lightboxInfo || document.getElementById('lightbox-info');
        if (info) {
          info.style.animation = 'none';
          info.style.transition = 'opacity 0.2s ease, filter 0.2s ease';
          info.style.opacity = '1';
          info.style.filter = '';
          info.style.transform = '';
          setTimeout(function () {
            if (!info.parentNode) return;
            info.style.animation = '';
            info.style.transition = '';
          }, 250);
        }
      }

      let fsWrap = domRefs.filmstripWrap;
      if (fsWrap) {
        fsWrap.style.transition = 'filter 0.35s ease, opacity 0.35s ease';
        fsWrap.style.filter = '';
        fsWrap.style.opacity = '';
        setTimeout(function () {
          if (!fsWrap.parentNode) return;
          fsWrap.style.transition = '';
        }, 400);
      }

      let imgWrapEl = domRefs.lightboxImgWrap;
      if (imgWrapEl) {
        imgWrapEl.style.transition = 'filter 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
        imgWrapEl.style.filter = '';
        setTimeout(function () {
          if (!imgWrapEl.parentNode) return;
          imgWrapEl.style.transition = '';
        }, 580);
      }

      let slideImgs = imgWrap.querySelectorAll('.snap-slide img') as NodeListOf<HTMLElement>;
      slideImgs.forEach(function (s) {
        s.style.transition = 'filter 0.55s cubic-bezier(0.22, 1, 0.36, 1), transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
        s.style.filter = '';
        s.style.transform = '';
        setTimeout(function () { s.style.transition = ''; }, 580);
      });
      releaseFxLayers();
    }

    // scrollend (Chrome 114+, Firefox 109+, Safari 18+)
    imgWrap.addEventListener('scrollend', function () {
      if (!lbEl.classList.contains('open')) return;
      if (state.currentLightboxIsMotion || state.lbZoomLevel > 1) return;
      if (window.isAutoRapidScrolling) return; // Prevent layout snaps during math interpolation
      clearTimeout(snapTimer);
      if (!state.isManuallyNavigating) onSnapSettle();
    });

    imgWrap.addEventListener('scroll', function () {
      if (!lbEl.classList.contains('open')) return;
      if (state.currentLightboxIsMotion || state.lbZoomLevel > 1) return;
      if (state.isManuallyNavigating) return;
      clearTimeout(snapTimer);
      snapTimer = setTimeout(onSnapSettle, 80);
      let w = imgWrap.offsetWidth;
      if (!w) return;
      let f = imgWrap.scrollLeft / w;

      let nearest = Math.round(f);
      nearest = Math.max(0, Math.min(nearest, state.activePhotos.length - 1));

      let hint = document.getElementById('swipe-hint');
      if (hint && Math.abs(imgWrap.scrollLeft - state.cur * w) > 10) {
        hint.classList.remove('visible');
      }

      let isFilmstripDirectPhase = state.isUserTouching || performance.now() < filmstripReleaseFollowUntil;

      if (!state.fsRaf && !state.isManuallyNavigating && !window.isAutoRapidScrolling && !state.isTouchingFilmstrip) {
        if (isFilmstripDirectPhase && typeof syncFilmstripToPhotoProgress === 'function') {
          syncFilmstripToPhotoProgress(f);
        } else if (!isFilmstripDirectPhase && typeof settleFilmstripToPhotoProgress === 'function') {
          settleFilmstripToPhotoProgress(nearest);
        }
      }

      if (window.isAutoRapidScrolling) {
        state.cur = nearest;
        return;
      }

      if (nearest !== state.cur && !state.isUserTouching && !state.isManuallyNavigating) {
        onSnapSettle(nearest);
      }

      let swipeDelta = imgWrap.scrollLeft - state.cur * w;
      let distFromStart = Math.abs(swipeDelta) / w;

      let info = domRefs.lightboxInfo || document.getElementById('lightbox-info');
      if (info) {
        info.style.animation = 'none';
        info.style.transition = 'none';

        const isFF = document.documentElement.classList.contains('is-firefox');
        if (distFromStart === 0) {
          info.style.opacity = '1';
          info.style.filter = '';
          info.style.transform = '';
        } else {
          // 1:1 physical mapping relative to active slide — fades out by 16% drag distance and stays at 0 while dragging away
          let op = Math.max(0, 1 - distFromStart * 6.25);
          let bl = isFF ? 0 : Math.min(10, distFromStart * 40);
          let tx = swipeDelta > 0 ? Math.max(-20, -distFromStart * 80) : Math.min(20, distFromStart * 80);

          info.style.opacity = op.toString();
          info.style.filter = bl > 0.1 ? `blur(${bl.toFixed(1)}px)` : '';
          info.style.transform = `translateX(${tx.toFixed(1)}px)`;
        }
      }

      // Mobile photo swipe depth effect:
      // Outgoing photo zooms IN slightly (1.0 -> 1.22), blurs, and darkens (1.0 -> 0.65 brightness) as it exits.
      // Incoming photo starts 1.22 zoomed, blurred, and darker (0.65 brightness), then brightens (0.65 -> 1.0), sharpens, and fits exact scale as user commits.
      if (state.isMobile && !state.currentLightboxIsMotion) {
        const isFF = document.documentElement.classList.contains('is-firefox');
        let curSlide = imgWrap.querySelector(`.snap-slide[data-idx="${state.cur}"] img`) as HTMLElement | null;
        let targetIdx = swipeDelta > 0 ? state.cur + 1 : state.cur - 1;
        let targetSlide = (targetIdx >= 0 && targetIdx < state.activePhotos.length)
          ? (imgWrap.querySelector(`.snap-slide[data-idx="${targetIdx}"] img`) as HTMLElement | null)
          : null;

        if (distFromStart > 0.01) {
          let easeFactor = 0.5 - 0.5 * Math.cos(Math.min(1, distFromStart) * Math.PI);
          let curBlur = isFF ? 0 : easeFactor * 14;
          let curScale = 1.0 + easeFactor * 0.22;
          let curBright = 1.0 - easeFactor * 0.35;
          if (curSlide) {
            curSlide.style.willChange = 'transform, filter';
            fxLayerSlides.add(curSlide);
            curSlide.style.transition = 'none';
            curSlide.style.filter = isFF ? (curBright < 0.99 ? `brightness(${curBright.toFixed(2)})` : '') : `blur(${curBlur.toFixed(1)}px) brightness(${curBright.toFixed(2)})`;
            curSlide.style.transform = `scale(${curScale.toFixed(3)})`;
          }
          if (targetSlide) {
            let peekEase = 0.5 - 0.5 * Math.cos((1 - Math.min(1, distFromStart)) * Math.PI);
            let peekBlur = isFF ? 0 : peekEase * 14;
            let peekScale = 1.0 + peekEase * 0.22;
            let peekBright = 1.0 - peekEase * 0.35;
            targetSlide.style.willChange = 'transform, filter';
            fxLayerSlides.add(targetSlide);
            targetSlide.style.transition = 'none';
            targetSlide.style.filter = isFF ? (peekBright < 0.99 ? `brightness(${peekBright.toFixed(2)})` : '') : `blur(${peekBlur.toFixed(1)}px) brightness(${peekBright.toFixed(2)})`;
            targetSlide.style.transform = `scale(${peekScale.toFixed(3)})`;
          }
        } else {
          if (curSlide) {
            curSlide.style.filter = '';
            curSlide.style.transform = '';
          }
          if (targetSlide) {
            targetSlide.style.filter = '';
            targetSlide.style.transform = '';
          }
          releaseFxLayers();
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
      void imgWrap.offsetWidth;
      scrollToSlide(state.cur, false);

      requestAnimationFrame(function () {
        void imgWrap.offsetWidth;
        scrollToSlide(state.cur, false);
        updateLoading();
        onSnapSettle(state.cur);
        let p = state.activePhotos[state.cur];
        if (p) setLightboxContent(p);
        animateInfo(0);
      });
    });

    window.addEventListener('lightbox-close', function () {
      setTimeout(clearSlides, 400);
    });

    window.addEventListener('lightbox-preload-neighbors', function () {
      updateLoading();
    });

    // Re-align on resize/orientation change
    let resizeTimer: any;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        if (lbEl.classList.contains('open')) {
          scrollToSlide(state.cur, false);
        }
      }, 150);
    });

    // ─── SWIPE DOWN TO DISMISS & PINCH TO ZOOM ───
    let dStartX = 0, dStartY = 0, dDY = 0;
    let dLocked = false, dChecked = false;
    let dPts: Array<{ y: number; t: number }> = [];
    let isPinching = false, wasPinchingOrZooming = false, pinchInitDist = 0, pinchInitLevel = 1, pinchInitPanX = 0, pinchInitPanY = 0, pinchInitMx = 0, pinchInitMy = 0, pinchInitCx = 0, pinchInitCy = 0;
    let dismissTiltSign = -1;
    let dismissMaxTilt = 8;
    let dismissTiltOrigin = 'bottom left';
    let dismissExitTilt = -24;

    function seedDismissTilt(preferredSign?: number) {
      dismissTiltSign = preferredSign !== undefined ? preferredSign : (Math.random() < 0.5 ? -1 : 1);
      dismissMaxTilt = 5.5 + Math.random() * 4.0; // 5.5° to 9.5° realistic tilt
      dismissTiltOrigin = dismissTiltSign < 0 ? 'bottom left' : 'bottom right';
      dismissExitTilt = dismissTiltSign * (18 + Math.random() * 10); // 18° to 28° exit angle
    }

    lbEl.addEventListener('touchstart', function (e) {
      if (!lbEl.classList.contains('open')) return;
      // stricter check to prevent interaction fight between controls/dock and dismiss gesture
      if ((e.target as HTMLElement).closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb, #lightbox-desc-toggle, #lightbox-info-wrap')) return;

      if (state.currentLightboxIsMotion) {
        if (e.touches.length >= 2) {
          e.preventDefault();
          return;
        }
        dStartX = e.touches[0].clientX;
        dStartY = e.touches[0].clientY;
        dDY = 0;
        dLocked = false;
        dChecked = false;
        dPts = [{ y: dStartY, t: Date.now() }];
        seedDismissTilt();
        return;
      }

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
            const idxStr = slides[i].dataset.idx;
            if (idxStr !== undefined && parseInt(idxStr) !== state.cur) {
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
      seedDismissTilt();
    }, { passive: false });

    lbEl.addEventListener('touchmove', function (e) {
      if (!dLocked && !isPinching && (e.target as HTMLElement).closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb, #lightbox-desc-toggle, #lightbox-info-wrap')) return;
      if (state.currentLightboxIsMotion && e.touches.length >= 2) {
        e.preventDefault();
        return;
      }
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
        if (img) updateZoomTransform(img, false);
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
        if (img) updateZoomTransform(img, false);
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
        if (dLocked) {
          if (dx > 8) {
            seedDismissTilt(1);
          } else if (dx < -8) {
            seedDismissTilt(-1);
          }
        }
      }

      if (dLocked && dy > 0) {
        if (state.currentLightboxIsMotion) {
          pauseMotionVideo();
        }
        dDY = dy;
        e.preventDefault();

        let isFF = document.documentElement.classList.contains('is-firefox');
        let swipeProgress = Math.min(1, Math.max(0, dy / 300));
        let blurVal = isFF ? 0 : Math.pow(swipeProgress, 2.4) * 18;

        // Apply translation and natural randomized tilt strictly to the photo/video wrap, keeping info dock stationary
        let imgWrapEl = domRefs.lightboxImgWrap;
        if (imgWrapEl) {
          let dragTilt = dismissTiltSign * Math.min(dismissMaxTilt, (dy / 380) * dismissMaxTilt);
          imgWrapEl.style.transition = 'none';
          imgWrapEl.style.transformOrigin = dismissTiltOrigin;
          imgWrapEl.style.transform = 'translateY(' + dy + 'px) rotate(' + dragTilt.toFixed(2) + 'deg)';
          imgWrapEl.style.opacity = String(Math.max(0.15, 1 - dy / 400));
          imgWrapEl.style.filter = blurVal > 0.1 ? 'blur(' + blurVal.toFixed(1) + 'px)' : '';
        }

        let bgOpac = Math.max(0, 1 - dy / 400);
        if (domRefs.lightboxBg) domRefs.lightboxBg.style.opacity = String(bgOpac);
        if (domRefs.blurCanvas) domRefs.blurCanvas.style.opacity = String(bgOpac);
        lbEl.style.backgroundColor = `rgba(13, 12, 12, ${bgOpac})`;

        let info = domRefs.lightboxInfo || document.getElementById('lightbox-info');
        if (info) {
          let txtOpac = Math.max(0, 1 - dy / 180);
          info.style.animation = 'none';
          info.style.transition = 'none';
          info.style.filter = blurVal > 0.1 ? 'blur(' + blurVal.toFixed(1) + 'px)' : '';
          info.style.opacity = String(txtOpac);
        }

        let activeImg = imgWrapEl ? imgWrapEl.querySelector('.snap-slide[data-idx="' + state.cur + '"] img') as HTMLElement : null;
        if (activeImg) {
          activeImg.style.transition = 'none';
          activeImg.style.filter = '';
          activeImg.style.transform = '';
        }

        let fsWrap = domRefs.filmstripWrap;
        if (fsWrap) {
          let fsOpac = Math.max(0, 1 - dy / 250);
          fsWrap.style.transition = 'none';
          fsWrap.style.filter = blurVal > 0.1 ? 'blur(' + blurVal.toFixed(1) + 'px)' : '';
          fsWrap.style.opacity = String(fsOpac);
        }
      }
    }, { passive: false });

    lbEl.addEventListener('touchend', function (e) {
      if (!dLocked && !isPinching && (e.target as HTMLElement).closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb, #lightbox-desc-toggle, #lightbox-info-wrap')) return;
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
        let isFF = document.documentElement.classList.contains('is-firefox');
        let imgWrapEl = domRefs.lightboxImgWrap;
        if (imgWrapEl) {
          imgWrapEl.style.transition = isFF
            ? 'transform 0.28s ease-out, opacity 0.28s ease-out'
            : 'transform 0.28s ease-out, opacity 0.28s ease-out, filter 0.2s ease';
          imgWrapEl.style.transformOrigin = dismissTiltOrigin;
          imgWrapEl.style.transform = 'translateY(' + window.innerHeight + 'px) rotate(' + dismissExitTilt.toFixed(2) + 'deg)';
          imgWrapEl.style.opacity = '0';
          if (!isFF) imgWrapEl.style.filter = 'blur(18px)';
        }

        if (domRefs.lightboxBg) {
          domRefs.lightboxBg.style.transition = 'opacity 0.28s ease-out';
          domRefs.lightboxBg.style.opacity = '0';
        }
        if (domRefs.blurCanvas) {
          domRefs.blurCanvas.style.transition = 'opacity 0.28s ease-out';
          domRefs.blurCanvas.style.opacity = '0';
        }
        lbEl.style.transition = 'background-color 0.28s ease-out';
        lbEl.style.backgroundColor = 'rgba(13, 12, 12, 0)';

        let info = domRefs.lightboxInfo || document.getElementById('lightbox-info');
        if (info) {
          info.style.transition = isFF ? 'opacity 0.2s ease' : 'opacity 0.2s ease, filter 0.2s ease';
          info.style.filter = isFF ? '' : 'blur(18px)';
          info.style.opacity = '0';
        }

        let activeImg = imgWrapEl ? imgWrapEl.querySelector('.snap-slide[data-idx="' + state.cur + '"] img') as HTMLElement : null;
        if (activeImg) {
          activeImg.style.transition = 'none';
          activeImg.style.filter = '';
          activeImg.style.transform = '';
        }

        let fsWrap = domRefs.filmstripWrap;
        if (fsWrap) {
          fsWrap.style.transition = isFF ? 'opacity 0.2s ease' : 'opacity 0.2s ease, filter 0.2s ease';
          fsWrap.style.filter = isFF ? '' : 'blur(18px)';
          fsWrap.style.opacity = '0';
        }

        setTimeout(function () {
          closeLightbox();
        }, 280);
      } else {
        let imgWrapEl = domRefs.lightboxImgWrap;
        if (imgWrapEl) {
          imgWrapEl.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1), filter 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
          imgWrapEl.style.transform = '';
          imgWrapEl.style.opacity = '1';
          imgWrapEl.style.filter = '';
        }

        if (domRefs.lightboxBg) {
          domRefs.lightboxBg.style.transition = 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
          domRefs.lightboxBg.style.opacity = '1';
        }
        if (domRefs.blurCanvas) {
          domRefs.blurCanvas.style.transition = 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
          domRefs.blurCanvas.style.opacity = '1';
        }
        lbEl.style.transition = 'background-color 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
        lbEl.style.backgroundColor = '';

        let info = domRefs.lightboxInfo || document.getElementById('lightbox-info');
        if (info) {
          info.style.transition = 'opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1), filter 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
          info.style.filter = '';
          info.style.opacity = '1';
        }

        let activeImg = imgWrapEl ? imgWrapEl.querySelector('.snap-slide[data-idx="' + state.cur + '"] img') as HTMLElement : null;
        if (activeImg) {
          activeImg.style.transition = 'filter 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
          activeImg.style.filter = '';
          activeImg.style.transform = '';
          setTimeout(function () {
            if (activeImg) activeImg.style.transition = '';
          }, 620);
        }

        let fsWrap = domRefs.filmstripWrap;
        if (fsWrap) {
          fsWrap.style.transition = 'opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1), filter 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
          fsWrap.style.filter = '';
          fsWrap.style.opacity = '';
        }

        setTimeout(function () {
          let content = domRefs.lightboxContent;
          if (content) {
            content.style.transition = '';
            content.style.transformOrigin = '';
            content.style.transform = '';
            content.style.opacity = '';
          }
          if (info) {
            info.style.transition = '';
            info.style.opacity = '';
            info.style.filter = '';
          }
          if (imgWrapEl) {
            imgWrapEl.style.transition = '';
            imgWrapEl.style.transformOrigin = '';
            imgWrapEl.style.transform = '';
            imgWrapEl.style.opacity = '';
            imgWrapEl.style.filter = '';
          }
          if (fsWrap) {
            fsWrap.style.transition = '';
            fsWrap.style.filter = '';
            fsWrap.style.opacity = '';
          }
          if (domRefs.lightboxBg) {
            domRefs.lightboxBg.style.transition = '';
            domRefs.lightboxBg.style.opacity = '';
          }
          if (domRefs.blurCanvas) {
            domRefs.blurCanvas.style.transition = '';
            domRefs.blurCanvas.style.opacity = '';
          }
          lbEl.style.transition = '';
          lbEl.style.backgroundColor = '';
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
