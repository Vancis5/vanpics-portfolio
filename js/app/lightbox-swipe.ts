// SWIPE for lightbox
import { domRefs } from './dom.js';
import { state } from './state.js';
import { motionProjects } from './media-data.js';
import { animateInfo, closeLightbox, openLightbox, navigateLightbox, setLightboxBlur, setLightboxContent, setLoadSwipeNeighbors, setMobileScrollToSlideCallback, updateMobileImgWrapHeight } from './lightbox.js';
import { resetZoom, toggleImageZoom, updateZoomTransform, checkAutoZoomOut } from './lightbox-zoom.js';
import { finishFilmstripPhotoSync, settleFilmstripToPhotoProgress, syncFilmstripToPhotoProgress } from './filmstrip.js';
import { hideFilmstripIfReady, showFilmstripIfReady } from './core.js';
import { getPhotoAspectRatio, saveRatioToCache, sanitizeHtml } from './utils.js';
import { pauseMotionVideo } from './lightbox-media.js';

let lbEl = domRefs.lightbox;
let imgWrap = domRefs.lightboxImgWrap;
let mobileScrollToSlide = null;
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

    function scrollToSlide(idx: number, smooth = true) {
      if (state.currentLightboxIsMotion) return;
      let slide = imgWrap.querySelector('.snap-slide[data-idx="' + idx + '"]') as HTMLElement;
      let w = imgWrap.offsetWidth || window.innerWidth;
      let targetLeft = (slide && slide.offsetLeft > 0) ? slide.offsetLeft : (idx * w);
      imgWrap.scrollLeft = targetLeft;
      if (slide) {
        imgWrap.scrollTo({
          left: targetLeft,
          behavior: smooth ? 'smooth' : 'instant'
        });
      }
    }
    setMobileScrollToSlideCallback(scrollToSlide);

    let wrapTouchX = 0;
    let filmstripReleaseFollowUntil = 0;
    const FILMSTRIP_RELEASE_FOLLOW_MS = 300;

    imgWrap.addEventListener('touchstart', function (e) {
      if (state.currentLightboxIsMotion) return;
      state.isUserTouching = true;
      filmstripReleaseFollowUntil = 0;
      if (e.touches.length === 1) wrapTouchX = e.touches[0].clientX;
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

    // ── Eager-load nearby slides ──
    function updateLoading() {
      if (state.currentLightboxIsMotion) return;
      let imgs = imgWrap.querySelectorAll('.snap-slide img') as NodeListOf<HTMLImageElement>;
      for (let i = 0; i < imgs.length; i++) {
        let shouldEager = (Math.abs(i - state.cur) <= 2);
        imgs[i].loading = shouldEager ? 'eager' : 'lazy';
        if (shouldEager && typeof imgs[i].decode === 'function' && !imgs[i].dataset.decoded) {
          (function (img) {
            img.decode().then(function () { img.dataset.decoded = "true"; }).catch(function () { });
          })(imgs[i]);
        }
      }
    }

    // ── Scroll settle — detect new active slide ──
    function onSnapSettle(targetIdx?: number) {
      if (state.currentLightboxIsMotion || state.lbZoomLevel > 1 || window.isAutoRapidScrolling) return;
      if (state.isUserTouching && typeof targetIdx === 'undefined') return;
      state.isManuallyNavigating = false;
      let w = imgWrap.offsetWidth || window.innerWidth;
      if (!w) return;

      // Only force scrollLeft if explicitly opening or programmatically navigating
      if (typeof targetIdx === 'number' && (!lbEl.classList.contains('open') || state.isManuallyNavigating)) {
        let expectedLeft = targetIdx * w;
        if (Math.abs(imgWrap.scrollLeft - expectedLeft) > 5) {
          imgWrap.scrollLeft = expectedLeft;
        }
      }

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
        let info = domRefs.lightboxInfo;
        if (info) {
          info.style.animation = 'none';
          info.style.transition = 'opacity 0.35s ease, filter 0.35s ease';
          info.style.opacity = '1';
          info.style.filter = '';
          info.style.transform = '';
          setTimeout(function () {
            if (!info.parentNode) return;
            info.style.animation = '';
            info.style.transition = '';
          }, 400);
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
    }

    // scrollend (Chrome 114+, Firefox 109+, Safari 18+)
    imgWrap.addEventListener('scrollend', function () {
      if (state.currentLightboxIsMotion || state.lbZoomLevel > 1) return;
      if (window.isAutoRapidScrolling) return; // Prevent layout snaps during math interpolation
      clearTimeout(snapTimer);
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

      if (nearest !== state.cur && !isFilmstripDirectPhase && !state.isManuallyNavigating) {
        onSnapSettle(nearest);
      }

      let swipeDelta = imgWrap.scrollLeft - state.cur * w;
      let distFromStart = Math.abs(swipeDelta) / w;

      let info = domRefs.lightboxInfo;
      if (info) {
        info.style.animation = 'none';
        info.style.transition = 'none';

        if (distFromStart === 0) {
          info.style.opacity = '1';
          info.style.filter = '';
          info.style.transform = '';
        } else {
          // 1:1 physical mapping relative to active slide — fades out by 16% drag distance and stays at 0 while dragging away
          let op = Math.max(0, 1 - distFromStart * 6.25);
          let bl = Math.min(10, distFromStart * 40);
          let tx = swipeDelta > 0 ? Math.max(-20, -distFromStart * 80) : Math.min(20, distFromStart * 80);

          info.style.opacity = op.toString();
          info.style.filter = bl > 0.1 ? `blur(${bl.toFixed(1)}px)` : '';
          info.style.transform = `translateX(${tx.toFixed(1)}px)`;
        }
      }

      // Mobile photo swipe depth effect:
      // Outgoing photo zooms IN slightly (1.0 -> 1.08), blurs, and darkens (1.0 -> 0.65 brightness) as it exits.
      // Incoming photo starts 1.08 zoomed, blurred, and darker (0.65 brightness), then brightens (0.65 -> 1.0), sharpens, and fits exact scale as user commits.
      if (state.isMobile && !state.currentLightboxIsMotion) {
        let slides = imgWrap.querySelectorAll('.snap-slide');
        let targetIdx = swipeDelta > 0 ? state.cur + 1 : state.cur - 1;

        slides.forEach(function (slideEl) {
          let sIdxStr = (slideEl as HTMLElement).dataset.idx;
          if (sIdxStr !== undefined) {
            let sIdx = parseInt(sIdxStr, 10);
            let img = slideEl.querySelector('img') as HTMLElement;
            if (img) {
              if (sIdx === state.cur && distFromStart > 0.01) {
                // Smooth ease-in-out factor for depth response
                let easeFactor = 0.5 - 0.5 * Math.cos(Math.min(1, distFromStart) * Math.PI);
                let curBlur = easeFactor * 14;
                let curScale = 1.0 + easeFactor * 0.22; // dramatic 22% zoom expansion inside grid
                let curBright = 1.0 - easeFactor * 0.35; // darkens down to 0.65
                img.style.transition = 'none';
                img.style.filter = `blur(${curBlur.toFixed(1)}px) brightness(${curBright.toFixed(2)})`;
                img.style.transform = `scale(${curScale.toFixed(3)})`;
              } else if (sIdx === targetIdx && distFromStart > 0.01) {
                // Incoming photo starts 1.22 zoomed & blurred, dramatically scales down to 1.0 & sharpens as user commits
                let easeFactor = 0.5 - 0.5 * Math.cos((1 - Math.min(1, distFromStart)) * Math.PI);
                let peekBlur = easeFactor * 14;
                let peekScale = 1.0 + easeFactor * 0.22;
                let peekBright = 1.0 - easeFactor * 0.35; // brightens up to 1.0
                img.style.transition = 'none';
                img.style.filter = `blur(${peekBlur.toFixed(1)}px) brightness(${peekBright.toFixed(2)})`;
                img.style.transform = `scale(${peekScale.toFixed(3)})`;
              } else {
                img.style.transition = 'none';
                img.style.filter = '';
                img.style.transform = '';
              }
            }
          }
        });
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
      clearSlides();
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
    let dPts: Array<{ y: number; t: number }> = [];
    let isPinching = false, wasPinchingOrZooming = false, pinchInitDist = 0, pinchInitLevel = 1, pinchInitPanX = 0, pinchInitPanY = 0, pinchInitMx = 0, pinchInitMy = 0, pinchInitCx = 0, pinchInitCy = 0;

    lbEl.addEventListener('touchstart', function (e) {
      if (!lbEl.classList.contains('open')) return;
      // stricter check to prevent interaction fight between filmstrip and dismiss gesture
      if ((e.target as HTMLElement).closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb')) return;

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
    }, { passive: false });

    lbEl.addEventListener('touchmove', function (e) {
      if ((e.target as HTMLElement).closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb')) return;
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
        if (state.currentLightboxIsMotion) {
          pauseMotionVideo();
        }
        dDY = dy;
        e.preventDefault();
        let content = domRefs.lightboxContent;
        content.style.transition = 'none';
        let tilt = Math.max(-10, (dy / 400) * -10); // reduced from -25
        content.style.transformOrigin = 'bottom left';
        content.style.transform = 'translateY(' + dy + 'px) rotate(' + tilt + 'deg)';
        content.style.opacity = String(Math.max(0.15, 1 - dy / 400));

        let swipeProgress = Math.min(1, Math.max(0, dy / 300));
        let blurVal = Math.pow(swipeProgress, 2.4) * 18;

        let info = domRefs.lightboxInfo;
        if (info) {
          let txtOpac = Math.max(0, 1 - dy / 180);
          info.style.transition = 'none';
          info.style.filter = blurVal > 0.1 ? 'blur(' + blurVal.toFixed(1) + 'px)' : '';
          info.style.opacity = String(txtOpac);
        }

        // Swipe down exit: blur the entire photo container including its outline border
        let imgWrapEl = domRefs.lightboxImgWrap;
        if (imgWrapEl) {
          imgWrapEl.style.transition = 'none';
          imgWrapEl.style.filter = blurVal > 0.1 ? 'blur(' + blurVal.toFixed(1) + 'px)' : '';
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

        let imgWrapEl = domRefs.lightboxImgWrap;
        if (imgWrapEl) {
          imgWrapEl.style.transition = 'filter 0.2s ease';
          imgWrapEl.style.filter = 'blur(18px)';
        }

        let activeImg = imgWrapEl ? imgWrapEl.querySelector('.snap-slide[data-idx="' + state.cur + '"] img') as HTMLElement : null;
        if (activeImg) {
          activeImg.style.transition = 'none';
          activeImg.style.filter = '';
          activeImg.style.transform = '';
        }

        let fsWrap = domRefs.filmstripWrap;
        if (fsWrap) {
          fsWrap.style.transition = 'opacity 0.2s ease, filter 0.2s ease';
          fsWrap.style.filter = 'blur(18px)';
          fsWrap.style.opacity = '0';
        }

        setTimeout(function () {
          closeLightbox();
        }, 280);
      } else {
        let content = domRefs.lightboxContent;
        content.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
        content.style.transform = '';
        content.style.opacity = '1';

        let info = domRefs.lightboxInfo;
        if (info) {
          info.style.transition = 'opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1), filter 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
          info.style.filter = '';
          info.style.opacity = '1';
        }

        let imgWrapEl = domRefs.lightboxImgWrap;
        if (imgWrapEl) {
          imgWrapEl.style.transition = 'filter 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
          imgWrapEl.style.filter = '';
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
          if (content) {
            content.style.transition = '';
            content.style.transformOrigin = '';
          }
          if (info) {
            info.style.transition = '';
          }
          if (imgWrapEl) {
            imgWrapEl.style.transition = '';
            imgWrapEl.style.filter = '';
          }
          if (fsWrap) {
            fsWrap.style.transition = '';
            fsWrap.style.filter = '';
            fsWrap.style.opacity = '';
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
