import { domRefs } from '../dom.js';
import { state } from '../state.js';
import { getCategorySlug } from '../media-data.js';
import { hideFilmstripIfReady, showFilmstripIfReady, clearFilmstripHideTimerIfReady, setFilmstripLiftZoneDisplay } from '../core.js';
import { resetZoom } from '../lightbox-zoom.js';
import { updateFilmstrip, stopFsSync } from '../filmstrip.js';
import { resetLightboxMouseNav, startNavAnimationLoop, hideLightboxNavImmediately } from '../lightbox-nav.js';
import { cacheImage, getLightboxBlurPath, lightboxSrc } from '../lightbox-cache.js';
import {
  prepareLightboxPhoto,
  renderVideoInLightbox,
  startUnifiedMotionPlayer,
  clearLightboxPhotoPlaceholder,
  fadeOutAndKillMotionVideo,
  killMotionPlayer
} from '../lightbox-media.js';
import {
  getCurrentLightboxItems,
  setLightboxBlur,
  setLightboxContent,
  animateInfo,
  scheduleLightboxBlurNeighborPreload,
  clearBlurPreloadTimer,
  getBlurRenderer,
  cancelPendingHashUpdate,
  clearLightboxPhotoMask
} from './renderer.js';
import { updateLightboxLayout } from './layout.js';
import { preloadAdjacentPhotoColors, warmUpAllPhotoColors } from '../lightbox-color.js';
import type { Photo, Video } from '../../types.js';

let navGen = 0;
let previouslyFocusedElement: HTMLElement | null = null;

type MobileScrollHandler = (i: number, smooth: boolean, dir: number) => void;
let mobileScrollHandler: MobileScrollHandler | null = null;

export function setMobileScrollHandler(fn: MobileScrollHandler | null) {
  mobileScrollHandler = fn;
}

let preloadTimer: any = null;
let preloadIdleId: any = null;

export function loadSwipeNeighbors() {
  if (state.currentLightboxIsMotion) return;

  let currentSet = getCurrentLightboxItems();
  let len = currentSet.length;
  if (!len) return;

  preloadAdjacentPhotoColors(state.cur, currentSet as Photo[]);

  // Immediately prefetch ±1 immediate neighbor (network cache only, avoid CPU decode contention)
  [-1, 1].forEach(function (offset) {
    let p = currentSet[(state.cur + offset + len) % len];
    if (p && p.src) cacheImage(lightboxSrc(p), false);
  });

  if (typeof cancelIdleCallback === 'function' && preloadIdleId !== null) {
    cancelIdleCallback(preloadIdleId);
    preloadIdleId = null;
  }
  if (preloadTimer !== null) {
    clearTimeout(preloadTimer);
    preloadTimer = null;
  }

  const runIdle = () => {
    preloadIdleId = null;
    preloadTimer = null;

    // Preload & cache ±2 high-res neighbors (standard network cache)
    [-2, 2].forEach(function (offset) {
      let p = currentSet[(state.cur + offset + len) % len];
      if (p && p.src) cacheImage(lightboxSrc(p), false);
    });

    // Preload & cache ±3 blurred backgrounds (super light, avoids network saturation)
    [-3, -2, -1, 1, 2, 3].forEach(function (offset) {
      let p = currentSet[(state.cur + offset + len) % len];
      if (p) {
        let bSrc = p.thumb || p.src;
        if (bSrc) {
          cacheImage(getLightboxBlurPath(bSrc), false);
        }
      }
    });

    window.dispatchEvent(new Event('lightbox-preload-neighbors'));
  };

  if (typeof requestIdleCallback === 'function') {
    preloadIdleId = requestIdleCallback(runIdle, { timeout: 700 });
  } else {
    preloadTimer = setTimeout(runIdle, 380);
  }
}

let closeIdleTimer: any = null;

export function showLightboxClose() {
  if (state.isMobile) return;
  const closeBtn = domRefs.lightboxClose;
  if (!closeBtn) return;
  if (closeBtn.classList.contains('idle-hidden')) {
    closeBtn.classList.remove('idle-hidden');
  }
  resetLightboxCloseIdleTimer();
}

export function hideLightboxClose(force = false) {
  const closeBtn = domRefs.lightboxClose;
  if (!closeBtn) return;
  const isKeyboardFocused = closeBtn.matches(':focus-visible') && !closeBtn.classList.contains('prevent-focus-ring');
  if (isKeyboardFocused) return;
  if (!force && closeBtn.matches(':hover')) {
    resetLightboxCloseIdleTimer(1000);
    return;
  }
  clearTimeout(closeIdleTimer);
  closeIdleTimer = null;
  closeBtn.classList.add('idle-hidden');
}

export function resetLightboxCloseIdleTimer(delay = 2000) {
  clearTimeout(closeIdleTimer);
  const lb = domRefs.lightbox;
  if (!lb || !lb.classList.contains('open') || state.isMobile) return;
  closeIdleTimer = setTimeout(() => hideLightboxClose(), delay);
}

export function openLightbox(i: number, direction?: number, isMotion?: boolean) {
  updateLightboxLayout();
  let lb = domRefs.lightbox;
  if (lb && !lb.classList.contains('open') && !state.isPopState) {
    state.pushNextState = true;
  }

  let oldCur = state.cur;
  state.cur = i;
  state.isManuallyNavigating = true;
  state.currentLightboxIsMotion = !!isMotion;
  resetZoom();
  let p = getCurrentLightboxItems()[i];

  if (!p) return;
  showLightboxClose();
  if (!isMotion) scheduleLightboxBlurNeighborPreload(i, lb && lb.classList.contains('open') ? 80 : 300);
  let img = domRefs.lightboxImg;
  let imgWrap = domRefs.lightboxImgWrap;
  let playerShell = domRefs.motionPlayerShell;

  if (isMotion) lb.classList.add('mode-motion');
  else lb.classList.remove('mode-motion');
  if (isMotion) clearLightboxPhotoPlaceholder();

  if (lb.classList.contains('open') && !state.isLightboxClosing && !state.isLightboxDismissing) {
    let dir = (typeof direction === 'number' && direction !== 0) ? direction : (i > oldCur ? 1 : -1);
    let exitX = dir > 0 ? '-6%' : '6%';
    let enterX = dir > 0 ? '6%' : '-6%';
    let gen = ++navGen;

    let oldSlideInner: HTMLElement | null = null;
    if (state.isMobile && !isMotion && imgWrap) {
      oldSlideInner = imgWrap.querySelector(`.snap-slide[data-idx="${oldCur}"] .snap-slide-inner`) as HTMLElement | null;
      if (oldSlideInner) {
        oldSlideInner.style.transition = 'opacity 0.16s ease, transform 0.16s cubic-bezier(0.16, 1, 0.3, 1), filter 0.16s ease';
        oldSlideInner.style.opacity = '0';
        oldSlideInner.style.transform = `translateX(${exitX}) scale(0.992)`;
        oldSlideInner.style.filter = 'blur(12px)';
      }
    } else {
      img.style.transition = 'opacity 0.16s ease, transform 0.16s cubic-bezier(0.16, 1, 0.3, 1)';
      img.style.opacity = '0';
      img.style.transform = 'translateX(' + exitX + ') scale(0.992)';
    }
    playerShell.style.transition = 'opacity 0.16s ease';
    playerShell.style.opacity = '0';

    let infoEl = domRefs.lightboxInfo;
    if (infoEl) {
      infoEl.style.animation = 'none';
      infoEl.style.transition = 'opacity 0.16s ease, filter 0.16s ease';
      infoEl.style.opacity = '0';
      infoEl.style.filter = 'blur(6px)';
    }

    showFilmstripIfReady();

    let entered = false;

    function doEnter() {
      if (entered || gen !== navGen) return;
      entered = true;

      if (state.isMobile && !isMotion) {
        if (oldSlideInner) {
          oldSlideInner.style.transition = '';
          oldSlideInner.style.opacity = '';
          oldSlideInner.style.transform = '';
          oldSlideInner.style.filter = '';
        }
        if (imgWrap) {
          const inners = imgWrap.querySelectorAll('.snap-slide-inner');
          for (let k = 0; k < inners.length; k++) {
            const el = inners[k] as HTMLElement;
            if (el !== oldSlideInner && (el.style.opacity || el.style.filter || el.style.transform)) {
              el.style.transition = '';
              el.style.opacity = '';
              el.style.transform = '';
              el.style.filter = '';
            }
          }
        }
        if (mobileScrollHandler) {
          mobileScrollHandler(i, false, dir);
        }
        let bSrc = p.thumb || p.src || '';
        setLightboxBlur(bSrc);
        setLightboxContent(p);
        updateFilmstrip();

        let newSlideInner = imgWrap ? (imgWrap.querySelector(`.snap-slide[data-idx="${i}"] .snap-slide-inner`) as HTMLElement | null) : null;
        if (newSlideInner) {
          newSlideInner.style.transition = 'none';
          newSlideInner.style.transform = `translateX(${enterX}) scale(0.992)`;
          newSlideInner.style.opacity = '0';
          newSlideInner.style.filter = 'blur(12px)';
          void newSlideInner.offsetHeight;
        }

        requestAnimationFrame(function () {
          if (gen !== navGen) return;
          animateInfo(dir);
          if (newSlideInner) {
            newSlideInner.style.transition = 'opacity 0.22s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), filter 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
            newSlideInner.style.opacity = '1';
            newSlideInner.style.transform = 'translateX(0) scale(1)';
            newSlideInner.style.filter = 'blur(0px)';
            setTimeout(function () {
              if (gen === navGen && newSlideInner) {
                newSlideInner.style.transition = '';
                newSlideInner.style.transform = '';
                newSlideInner.style.opacity = '';
                newSlideInner.style.filter = '';
              }
            }, 300);
          }
        });
        return;
      }

      img.onload = null; img.onerror = null;
      img.style.transition = 'none';
      img.style.transform = '';
      img.style.opacity = '0';
      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E';
      imgWrap.style.transition = 'none';
      imgWrap.style.transform = 'translateX(' + enterX + ') scale(0.992)';
      imgWrap.style.opacity = '0';
      playerShell.innerHTML = '';
      playerShell.style.opacity = '0';

      let bSrc = isMotion ? (p.thumb || '') : (p.thumb || p.src || '');
      setLightboxBlur(bSrc);
      setLightboxContent(p);
      if (!isMotion && !state.isMobile) {
        prepareLightboxPhoto(p as Photo);
        loadSwipeNeighbors();
      }

      requestAnimationFrame(function () {
        if (gen !== navGen) return;
        animateInfo(dir);

        if (isMotion) {
          renderVideoInLightbox(p as Video);
          requestAnimationFrame(function () {
            playerShell.style.transition = 'opacity 0.35s ease';
            playerShell.style.opacity = '1';
          });
          imgWrap.style.transition = 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
          imgWrap.style.opacity = '1';
          imgWrap.style.transform = 'translateX(0) scale(1)';
        } else {
          imgWrap.style.transition = 'opacity 0.22s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
          imgWrap.style.opacity = '1';
          imgWrap.style.transform = 'translateX(0) scale(1)';
          img.style.transition = 'opacity 0.22s ease';
        }
      });
    }

    if (isMotion) {
      doEnter();
    } else {
      setTimeout(doEnter, 100);
    }

  } else {
    // INITIAL OPEN
    let openGen = ++navGen;
    previouslyFocusedElement = document.activeElement as HTMLElement | null;

    lb.style.transition = '';
    lb.style.backgroundColor = '';
    lb.style.opacity = '';
    lb.style.pointerEvents = '';
    if (domRefs.lightboxBg) {
      domRefs.lightboxBg.style.transition = '';
      domRefs.lightboxBg.style.opacity = '';
    }
    if (domRefs.blurCanvas) {
      domRefs.blurCanvas.style.transition = '';
      domRefs.blurCanvas.style.opacity = '';
    }

    img.onload = null; img.onerror = null;
    img.src = '';
    img.style.transition = 'none';
    img.style.opacity = '0';
    img.style.transform = '';
    img.style.filter = '';
    imgWrap.style.transition = '';
    imgWrap.style.opacity = '';
    imgWrap.style.transform = '';
    imgWrap.style.filter = '';
    playerShell.innerHTML = '';
    playerShell.style.opacity = '0';
    playerShell.style.filter = '';

    let infoEl2 = domRefs.lightboxInfo;
    if (infoEl2) {
      infoEl2.style.animation = 'none';
      infoEl2.style.opacity = '0';
    }

    let header = domRefs.galleryHeader;
    let headerRect = (!state.isMobile && header) ? header.getBoundingClientRect() : null;
    let masonry = domRefs.masonry;
    let masonryRect = (!state.isMobile && masonry) ? masonry.getBoundingClientRect() : null;
    if (header) {
      document.documentElement.style.setProperty('--gallery-header-height', `${header.offsetHeight}px`);
    }
    state.isLightboxClosing = false;
    state.isLightboxDismissing = false;
    lb.classList.remove('is-closing', 'is-dismissing', 'dismiss-committed');
    document.body.classList.remove('lightbox-closing', 'lightbox-dismissing');
    lb.classList.add('open');
    lb.removeAttribute('inert');
    startNavAnimationLoop();
    let closeBtn = document.getElementById('lightbox-close');
    if (closeBtn) {
      if (state.lastInputType !== 'keyboard') {
        closeBtn.classList.add('prevent-focus-ring');
        closeBtn.addEventListener('blur', function removePFR() {
          closeBtn.classList.remove('prevent-focus-ring');
          closeBtn.removeEventListener('blur', removePFR);
        });
      }
      closeBtn.focus();
    }
    document.body.classList.add('lightbox-open');
    lb.scrollTop = 0;
    if (!state.isMobile) {
      document.body.style.overflow = 'hidden';

      // FLIP: Invert header & masonry only on desktop
      if (header && headerRect) {
        let last = header.getBoundingClientRect();
        let dX = headerRect.left - last.left;
        let dY = headerRect.top - last.top;
        header.style.transition = 'none';
        header.style.transform = 'translate(' + dX + 'px, ' + dY + 'px)';
      }
      if (masonry && masonryRect) {
        let lastM = masonry.getBoundingClientRect();
        let dMY = masonryRect.top - lastM.top;
        if (Math.abs(dMY) > 0.5) {
          masonry.style.transition = 'none';
          masonry.style.transform = 'translateY(' + dMY + 'px)';
        }
      }

      requestAnimationFrame(function () {
        let ease = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
        if (header) {
          header.style.transition = ease;
          header.style.transform = '';
        }
        if (masonry && masonry.style.transform) {
          masonry.style.transition = ease;
          masonry.style.transform = '';
          masonry.addEventListener('transitionend', function cleanM() {
            if (masonry) masonry.style.transition = '';
            masonry?.removeEventListener('transitionend', cleanM);
          }, { once: true });
        }
      });
    }

    setFilmstripLiftZoneDisplay('block');
    window.dispatchEvent(new Event('lightbox-open'));
    setTimeout(showFilmstripIfReady, 300);

    let hint = document.getElementById('swipe-hint');
    if (hint) {
      hint.classList.add('visible');
      setTimeout(function () { hint.classList.remove('visible'); }, 2500);
    }

    let openLoadFired = false;
    function afterOpenLoad() {
      if (openLoadFired || openGen !== navGen) return;
      openLoadFired = true;
      if (isMotion) {
        img.onload = null;
        img.onerror = null;
      }

      let bSrc = isMotion ? (p.thumb || '') : (p.thumb || p.src || '');
      setLightboxBlur(bSrc);
      setLightboxContent(p);
      if (!isMotion) {
        loadSwipeNeighbors();
        warmUpAllPhotoColors(getCurrentLightboxItems() as Photo[]);
      }

      requestAnimationFrame(function () {
        if (openGen !== navGen) return;
        animateInfo(0);
        void img.offsetWidth;

        if (isMotion) {
          renderVideoInLightbox(p as Video);
          requestAnimationFrame(function () {
            playerShell.style.transition = 'opacity 0.35s ease';
            playerShell.style.opacity = '1';
          });
          imgWrap.style.transition = 'opacity 0.35s ease';
          imgWrap.style.opacity = '1';
        } else {
          img.style.transition = 'opacity 0.28s ease';
        }
      });
    }

    requestAnimationFrame(function () {
      if (isMotion) {
        afterOpenLoad();
      } else {
        if (!state.isMobile) prepareLightboxPhoto(p as Photo);
        afterOpenLoad();
      }
    });
  }
}

export function closeLightbox(eventOrIsKeyboard: any = false) {
  let isKeyboard = false;
  if (typeof eventOrIsKeyboard === 'boolean') {
    isKeyboard = eventOrIsKeyboard;
  } else if (eventOrIsKeyboard && eventOrIsKeyboard.type === 'click') {
    let e = eventOrIsKeyboard;
    isKeyboard = e.detail === 0 && (!e.pointerType || e.pointerType === '');
  }

  let lb = domRefs.lightbox;
  if (!lb.classList.contains('open')) return;
  lb.classList.remove('window-blurred');

  let header = domRefs.galleryHeader;
  let headerRect = header ? header.getBoundingClientRect() : null;
  let masonry = domRefs.masonry;
  let masonryRect = (!state.isMobile && masonry) ? masonry.getBoundingClientRect() : null;

  let img = domRefs.lightboxImg;
  let activeGen = ++navGen;
  stopFsSync({ commit: false });
  window.dispatchEvent(new Event('lightbox-close'));
  state.isLightboxClosing = true;
  state.isLightboxDismissing = false;
  lb.style.pointerEvents = '';
  lb.classList.remove('open');
  lb.classList.add('is-closing');
  document.body.classList.add('lightbox-closing');
  void fadeOutAndKillMotionVideo(300);
  lb.setAttribute('inert', '');
  let targetToFocus = previouslyFocusedElement;
  if (!targetToFocus || !document.body.contains(targetToFocus)) {
    const currentCard = document.querySelector(`.photo-card[data-idx="${state.cur}"]`) as HTMLElement | null;
    if (currentCard) targetToFocus = currentCard;
  }

  if (!state.isMobile && targetToFocus && typeof targetToFocus.focus === 'function') {
    let el = targetToFocus;
    if (!(isKeyboard || state.lastInputType === 'keyboard')) {
      el.classList.add('prevent-focus-ring');
      el.addEventListener('blur', function removePFR() {
        el.classList.remove('prevent-focus-ring');
        el.removeEventListener('blur', removePFR);
      });
    }
    el.focus({ preventScroll: true });
  }
  previouslyFocusedElement = null;
  document.body.classList.remove('lightbox-open');
  if (!state.isMobile) {
    document.body.style.overflow = '';
  }
  clearFilmstripHideTimerIfReady();
  hideFilmstripIfReady(true);
  clearTimeout(closeIdleTimer);
  closeIdleTimer = null;
  domRefs.lightboxClose?.classList.remove('idle-hidden');
  setFilmstripLiftZoneDisplay('none');
  resetLightboxMouseNav();

  let infoWrap = domRefs.lightboxInfoWrap;
  if (infoWrap) {
    infoWrap.style.transition = '';
    infoWrap.style.filter = '';
    infoWrap.style.transform = '';
    infoWrap.style.transformOrigin = '';
  }
  let infoInner = domRefs.lightboxInfo;
  if (infoInner) {
    infoInner.style.animation = 'none';
    infoInner.style.transition = 'opacity 0.3s ease';
    infoInner.style.opacity = '0';
    infoInner.style.filter = '';
    infoInner.style.transform = '';
  }

  if (!state.isMobile) {
    if (header && headerRect) {
      let last = header.getBoundingClientRect();
      let dX = headerRect.left - last.left;
      let dY = headerRect.top - last.top;
      header.style.transition = 'none';
      header.style.transform = 'translate(' + dX + 'px, ' + dY + 'px)';
    }
    if (masonry && masonryRect) {
      let lastM = masonry.getBoundingClientRect();
      let dMY = masonryRect.top - lastM.top;
      if (Math.abs(dMY) > 0.5) {
        masonry.style.transition = 'none';
        masonry.style.transform = 'translateY(' + dMY + 'px)';
      }
    }

    requestAnimationFrame(function () {
      let ease = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
      if (header) {
        header.style.transition = ease;
        header.style.transform = '';
      }
      if (masonry && masonry.style.transform) {
        masonry.style.transition = ease;
        masonry.style.transform = '';
        masonry.addEventListener('transitionend', function cleanM() {
          if (masonry) masonry.style.transition = '';
          masonry?.removeEventListener('transitionend', cleanM);
        }, { once: true });
      }

      setTimeout(function () {
        const lenis = (window as any).lenis;
        if (lenis) {
          lenis.start();
          lenis.animatedScroll = lenis.targetScroll = window.scrollY;
          lenis.emit();
        }
      }, 400);
    });
  }

  clearBlurPreloadTimer();
  cancelPendingHashUpdate();

  if (state.lightboxHistoryPushed && !state.isPopState) {
    state.lightboxHistoryPushed = false;
    history.back();
  } else if (window.location.hash) {
    state.lightboxHistoryPushed = false;
    let catSlug = getCategorySlug(state.currentCategory);
    history.replaceState(null, '', '#' + catSlug);
  }

  setTimeout(function () {
    if (activeGen !== navGen) return;

    killMotionPlayer();

    if (domRefs.blurCanvas) {
      domRefs.blurCanvas.classList.remove('active');
      domRefs.blurCanvas.classList.remove('ready');
    }
    let blurRenderer = getBlurRenderer();
    if (blurRenderer) {
      blurRenderer.stopAnimation();
    }

    if (img) {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      img.removeAttribute('data-loading-photo');
      clearLightboxPhotoPlaceholder();
      img.classList.remove('zoomed');
      img.style.transition = '';
      img.style.transform = '';
      img.style.transformOrigin = '';
      img.style.opacity = '';
    }
    if (domRefs.lightboxImgWrap) {
      domRefs.lightboxImgWrap.style.transition = '';
      domRefs.lightboxImgWrap.style.transform = '';
      domRefs.lightboxImgWrap.style.transformOrigin = '';
      domRefs.lightboxImgWrap.style.opacity = '';
      domRefs.lightboxImgWrap.style.filter = '';
    }

    if (domRefs.filmstripWrap) {
      domRefs.filmstripWrap.style.transition = '';
      domRefs.filmstripWrap.style.filter = '';
      domRefs.filmstripWrap.style.opacity = '';
    }

    let info = domRefs.lightboxInfo;
    if (info) {
      info.style.animation = 'none';
      info.style.opacity = '0';
      info.style.transition = '';
      info.style.filter = '';
      info.style.transform = '';
    }

    let content = domRefs.lightboxContent;
    if (content) {
      content.classList.remove('desc-open');
      content.style.transition = '';
      content.style.transform = '';
      content.style.transformOrigin = '';
      content.style.opacity = '';
    }
    clearLightboxPhotoMask();
    if (state.isMobile) {
      let mWrap = domRefs.lightboxImgWrap;
      if (mWrap) {
        mWrap.style.transform = '';
        mWrap.style.overflowX = '';
        mWrap.style.overflowY = '';
        mWrap.querySelectorAll('.snap-slide-inner').forEach((el) => {
          const s = (el as HTMLElement).style;
          s.transition = '';
          s.opacity = '';
          s.transform = '';
          s.filter = '';
        });
      }
      state.lbZoomLevel = 1;
      state.lbZoomPanX = 0;
      state.lbZoomPanY = 0;
      if (lb) {
        lb.style.transition = '';
        lb.style.backgroundColor = 'rgba(13, 12, 12, 0)';
        lb.style.opacity = '0';
        lb.classList.remove('zoom-active');
      }
      if (domRefs.lightboxBg) {
        domRefs.lightboxBg.style.transition = '';
        domRefs.lightboxBg.style.opacity = '0';
      }
      if (domRefs.blurCanvas) {
        domRefs.blurCanvas.style.transition = '';
        domRefs.blurCanvas.style.opacity = '0';
      }
    } else {
      let lb = domRefs.lightbox;
      if (lb) {
        lb.style.transition = '';
        lb.style.backgroundColor = '';
        lb.style.opacity = '';
        lb.classList.remove('zoom-active');
      }
      if (domRefs.lightboxBg) {
        domRefs.lightboxBg.style.transition = '';
        domRefs.lightboxBg.style.opacity = '';
      }
      if (domRefs.blurCanvas) {
        domRefs.blurCanvas.style.transition = '';
        domRefs.blurCanvas.style.opacity = '';
      }
    }

    let dark = domRefs.lightboxZoomDarken;
    if (dark) dark.style.opacity = '0';

    state.isLightboxClosing = false;
    state.isLightboxDismissing = false;
    state.lightboxClosedTime = performance.now();
    if (lb) {
      lb.classList.remove('is-closing', 'is-dismissing', 'dismiss-committed', 'mode-motion');
      lb.style.pointerEvents = '';
    }
    document.body.classList.remove('lightbox-closing', 'lightbox-dismissing');
    let catSlug = getCategorySlug(state.currentCategory);
    let curHash = window.location.hash.substring(1);
    if (curHash && curHash !== catSlug && !curHash.startsWith(catSlug + '/')) {
      history.replaceState(null, '', '#' + catSlug);
    }
    window.dispatchEvent(new Event('lightbox-closed'));
  }, 400);
}

export function navigateLightbox(d: number) {
  if (typeof state.lbZoomLevel !== 'undefined' && state.lbZoomLevel > 1) resetZoom();
  let currentSet = getCurrentLightboxItems();
  if (!currentSet || currentSet.length <= 1) return;
  let target = (state.cur + d + currentSet.length) % currentSet.length;
  openLightbox(target, d, state.currentLightboxIsMotion);
}

// ── Event Listeners ──
document.addEventListener('keydown', function (e) {
  let target = e.target as HTMLElement;
  let isTyping = target && (
    target.matches && target.matches('input, textarea, select, [contenteditable="true"]')
  );
  if (isTyping || !domRefs.lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') {
    closeLightbox(true);
    return;
  }

  if (e.key === 'Tab') {
    const focusable = Array.from(domRefs.lightbox.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetParent !== null || el === domRefs.lightboxClose);

    if (focusable.length > 0) {
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !domRefs.lightbox.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !domRefs.lightbox.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    } else {
      e.preventDefault();
    }
    return;
  }
  
  if (e.key === ' ' || e.code === 'Space') {
    if (state.currentLightboxIsMotion) {
      e.preventDefault();
      const prime = document.getElementById('motion-player-instance');
      if (prime) {
        if (!prime.classList.contains('is-started')) {
          startUnifiedMotionPlayer('motion-player-instance');
        } else {
          const video = prime.querySelector('video');
          if (video) {
            if (video.paused) {
              video.play().catch(() => {});
            } else {
              video.pause();
            }
          }
        }
      }
      return;
    }
  }

  let key = e.key.toLowerCase();
  const isNavKey = e.key.startsWith('Arrow') || key === 'd' || key === 'a' || key === 's' || key === 'w';
  if (isNavKey) {
    window.dispatchEvent(new CustomEvent('hide-cursor'));
    hideLightboxNavImmediately();
  }

  if (e.key === 'ArrowRight' || key === 'd' || key === 's') navigateLightbox(1);
  if (e.key === 'ArrowLeft' || key === 'a' || key === 'w') navigateLightbox(-1);
});

if (domRefs.lightboxBg) {
  domRefs.lightboxBg.addEventListener('click', () => {
    if (!state.isMobile) closeLightbox();
  });
}

function handleLightboxCloseViewportLeave() {
  if (!state.isMobile && domRefs.lightbox?.classList.contains('open')) {
    hideLightboxClose(true);
  }
}

window.addEventListener('cursor-hide', () => {
  if (!state.isMobile && domRefs.lightbox?.classList.contains('open')) {
    hideLightboxClose();
  }
});

window.addEventListener('cursor-show', () => {
  if (!state.isMobile && domRefs.lightbox?.classList.contains('open')) {
    showLightboxClose();
  }
});

window.addEventListener('mousemove', (e: MouseEvent) => {
  if (!state.isMobile && domRefs.lightbox?.classList.contains('open')) {
    if (e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY <= 0 || e.clientY >= window.innerHeight) {
      handleLightboxCloseViewportLeave();
      return;
    }
    showLightboxClose();
  }
}, { passive: true });

document.addEventListener('mouseleave', handleLightboxCloseViewportLeave);
document.documentElement.addEventListener('mouseleave', handleLightboxCloseViewportLeave);
document.addEventListener('mouseout', (e: MouseEvent) => {
  if (!e.relatedTarget && !(e as any).toElement) {
    handleLightboxCloseViewportLeave();
  }
});
window.addEventListener('blur', handleLightboxCloseViewportLeave);
document.addEventListener('mouseenter', () => {
  if (!state.isMobile && domRefs.lightbox?.classList.contains('open')) {
    showLightboxClose();
  }
});

if (domRefs.lightboxClose) {
  domRefs.lightboxClose.addEventListener('mouseenter', () => {
    if (!state.isMobile) clearTimeout(closeIdleTimer);
  });
  domRefs.lightboxClose.addEventListener('mouseleave', () => {
    if (!state.isMobile) resetLightboxCloseIdleTimer();
  });
}

function handleLightboxBlur() {
  if (domRefs.lightbox && domRefs.lightbox.classList.contains('open')) {
    domRefs.lightbox.classList.add('window-blurred');
    let blurRenderer = getBlurRenderer();
    if (blurRenderer) {
      blurRenderer.stopAnimation();
    }
    
    let video = domRefs.motionPlayerShell ? domRefs.motionPlayerShell.querySelector('video') : null;
    if (video && !video.paused) {
      video.pause();
      video.dataset.wasPlaying = 'true';
    }
  }
}

function handleLightboxFocus() {
  if (domRefs.lightbox) {
    domRefs.lightbox.classList.remove('window-blurred');
    let blurRenderer = getBlurRenderer();
    if (blurRenderer && domRefs.lightbox.classList.contains('open')) {
      blurRenderer.startAnimation();
    }
    
    let video = domRefs.motionPlayerShell ? domRefs.motionPlayerShell.querySelector('video') : null;
    if (video && video.dataset.wasPlaying === 'true') {
      video.play().catch(function () {});
      delete video.dataset.wasPlaying;
    }
  }
}

window.addEventListener('blur', handleLightboxBlur);
window.addEventListener('focus', handleLightboxFocus);

document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    handleLightboxBlur();
  } else {
    handleLightboxFocus();
  }
});
