import { domRefs } from '../dom.js';
import { state } from '../state.js';
import { getCategorySlug } from '../media-data.js';
import { hideFilmstripIfReady, showFilmstripIfReady, clearFilmstripHideTimerIfReady, setFilmstripLiftZoneDisplay } from '../core.js';
import { resetZoom } from '../lightbox-zoom.js';
import { updateFilmstrip, stopFsSync } from '../filmstrip.js';
import { resetLightboxMouseNav, startNavAnimationLoop, hideLightboxNavImmediately } from '../lightbox-nav.js';
import { cacheImage, getLightboxBlurPath } from '../lightbox-cache.js';
import {
  prepareLightboxPhoto,
  renderVideoInLightbox,
  startUnifiedMotionPlayer,
  clearLightboxPhotoPlaceholder
} from '../lightbox-media.js';
import {
  getCurrentLightboxItems,
  setLightboxBlur,
  setLightboxContent,
  animateInfo,
  scheduleLightboxBlurNeighborPreload,
  clearBlurPreloadTimer,
  getBlurRenderer,
  cancelPendingHashUpdate
} from './renderer.js';
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

  if (typeof cancelIdleCallback === 'function' && preloadIdleId !== null) {
    cancelIdleCallback(preloadIdleId);
    preloadIdleId = null;
  }
  if (preloadTimer !== null) {
    clearTimeout(preloadTimer);
    preloadTimer = null;
  }

  const run = () => {
    preloadIdleId = null;
    preloadTimer = null;
    let currentSet = getCurrentLightboxItems();
    let len = currentSet.length;
    if (!len) return;

    // Preload & eagerly decode ±1 immediate neighbor off-thread for instant 60fps transitions
    [-1, 1].forEach(function (offset) {
      let p = currentSet[(state.cur + offset + len) % len];
      if (p && p.src) cacheImage(p.src, true);
    });

    // Preload & cache ±2 high-res neighbors (standard network cache)
    [-2, 2].forEach(function (offset) {
      let p = currentSet[(state.cur + offset + len) % len];
      if (p && p.src) cacheImage(p.src, false);
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
    preloadIdleId = requestIdleCallback(run, { timeout: 700 });
  } else {
    preloadTimer = setTimeout(run, 380);
  }
}

export function openLightbox(i: number, direction?: number, isMotion?: boolean) {
  let lb = domRefs.lightbox;
  if (lb && !lb.classList.contains('open') && !state.isPopState) {
    state.pushNextState = true;
  }

  state.cur = i;
  state.isManuallyNavigating = true;
  state.currentLightboxIsMotion = !!isMotion;
  resetZoom();
  let p = getCurrentLightboxItems()[i];

  if (!p) return;
  if (!isMotion) scheduleLightboxBlurNeighborPreload(i, lb && lb.classList.contains('open') ? 80 : 300);
  let img = domRefs.lightboxImg;
  let imgWrap = domRefs.lightboxImgWrap;
  let playerShell = domRefs.motionPlayerShell;

  if (isMotion) lb.classList.add('mode-motion');
  else lb.classList.remove('mode-motion');
  if (isMotion) clearLightboxPhotoPlaceholder();

  // Mobile: already open — natively smooth scroll
  if (lb.classList.contains('open') && state.isMobile && !isMotion) {
    let dir = (typeof direction === 'number' && direction !== 0) ? direction : 1;
    if (mobileScrollHandler) {
      mobileScrollHandler(i, true, dir);
    } else {
      window.dispatchEvent(new CustomEvent('lightbox-scroll-to', {
        detail: { index: i, smooth: true, direction: dir }
      }));
    }

    state.cur = i;
    if (p) {
      setLightboxBlur(p.thumb || p.src);
      setLightboxContent(p);
    }
    updateFilmstrip();
    return;
  }

  if (lb.classList.contains('open')) {
    let dir = (typeof direction === 'number' && direction !== 0) ? direction : 1;
    let exitX = dir > 0 ? '-6%' : '6%';
    let enterX = dir > 0 ? '6%' : '-6%';
    let gen = ++navGen;

    img.style.transition = 'opacity 0.16s ease, transform 0.16s cubic-bezier(0.16, 1, 0.3, 1)';
    img.style.opacity = '0';
    img.style.transform = 'translateX(' + exitX + ') scale(0.992)';
    playerShell.style.transition = 'opacity 0.16s ease';
    playerShell.style.opacity = '0';

    let infoEl = domRefs.lightboxInfo;
    if (infoEl) {
      infoEl.style.animation = 'none';
      infoEl.style.opacity = '0';
    }

    showFilmstripIfReady();

    let entered = false;

    function doEnter() {
      if (entered || gen !== navGen) return;
      entered = true;

      img.onload = null; img.onerror = null;
      img.style.transition = 'none';
      img.style.transform = '';
      img.style.opacity = '0';
      imgWrap.style.transition = 'none';
      imgWrap.style.transform = 'translateX(' + enterX + ') scale(0.992)';
      imgWrap.style.opacity = '0';
      playerShell.innerHTML = '';
      playerShell.style.opacity = '0';

      let bSrc = isMotion ? (p.thumb || '') : (p.thumb || p.src || '');
      setLightboxBlur(bSrc);
      setLightboxContent(p, { deferDynamicTextColor: true });
      if (!isMotion) {
        prepareLightboxPhoto(p as Photo);
        loadSwipeNeighbors();
      }

      requestAnimationFrame(function () {
        if (gen !== navGen) return;
        animateInfo(dir);

        if (isMotion) {
          renderVideoInLightbox(p as Video);
          playerShell.style.transition = 'opacity 0.3s ease';
          playerShell.style.opacity = '1';
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
    let headerRect = header ? header.getBoundingClientRect() : null;

    lb.classList.add('open');
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
    document.body.style.overflow = 'hidden';

    // FLIP: Invert header only
    if (header && headerRect) {
      let last = header.getBoundingClientRect();
      let dX = headerRect.left - last.left;
      let dY = headerRect.top - last.top;
      header.style.transition = 'none';
      header.style.transform = 'translate(' + dX + 'px, ' + dY + 'px)';
    }

    requestAnimationFrame(function () {
      let ease = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
      if (header) {
        header.style.transition = ease;
        header.style.transform = '';
      }
    });

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
      setLightboxContent(p, { deferDynamicTextColor: true });
      if (!isMotion) loadSwipeNeighbors();

      requestAnimationFrame(function () {
        if (openGen !== navGen) return;
        animateInfo(0);
        void img.offsetWidth;

        if (isMotion) {
          renderVideoInLightbox(p as Video);
          playerShell.style.transition = 'opacity 0.35s ease';
          playerShell.style.opacity = '1';
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
        prepareLightboxPhoto(p as Photo);
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

  let img = domRefs.lightboxImg;
  let activeGen = ++navGen;
  stopFsSync({ commit: false });
  window.dispatchEvent(new Event('lightbox-close'));
  lb.classList.remove('open');
  lb.classList.remove('mode-motion');
  if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
    let el = previouslyFocusedElement;
    if (!(isKeyboard || state.lastInputType === 'keyboard')) {
      el.classList.add('prevent-focus-ring');
      el.addEventListener('blur', function removePFR() {
        el.classList.remove('prevent-focus-ring');
        el.removeEventListener('blur', removePFR);
      });
    }
    el.focus();
  }
  previouslyFocusedElement = null;
  document.body.classList.remove('lightbox-open');
  document.body.style.overflow = '';
  clearFilmstripHideTimerIfReady();
  hideFilmstripIfReady(true);
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
    infoInner.style.transition = '';
    infoInner.style.transform = '';
    infoInner.style.transformOrigin = '';
  }

  if (header && headerRect) {
    let last = header.getBoundingClientRect();
    let dX = headerRect.left - last.left;
    let dY = headerRect.top - last.top;
    header.style.transition = 'none';
    header.style.transform = 'translate(' + dX + 'px, ' + dY + 'px)';
  }

  requestAnimationFrame(function () {
    let ease = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
    if (header) {
      header.style.transition = ease;
      header.style.transform = '';
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

  let playerShell = domRefs.motionPlayerShell;
  if (playerShell) playerShell.innerHTML = '';

  if (domRefs.blurCanvas) {
    domRefs.blurCanvas.classList.remove('active');
    domRefs.blurCanvas.classList.remove('ready');
  }
  let blurRenderer = getBlurRenderer();
  if (blurRenderer) {
    blurRenderer.stopAnimation();
  }
  clearBlurPreloadTimer();
  cancelPendingHashUpdate();

  if (window.location.hash) {
    let catSlug = getCategorySlug(state.currentCategory);
    history.replaceState(null, '', '#' + catSlug);
  }

  setTimeout(function () {
    if (activeGen !== navGen) return;
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
    let lb = domRefs.lightbox;
    if (lb) lb.classList.remove('zoom-active');

    if (state.isMobile) {
      let mWrap = domRefs.lightboxImgWrap;
      if (mWrap) {
        mWrap.style.transform = '';
        mWrap.style.overflowX = '';
        mWrap.style.overflowY = '';
      }
      state.lbZoomLevel = 1;
      state.lbZoomPanX = 0;
      state.lbZoomPanY = 0;
      let slides = mWrap ? mWrap.querySelectorAll('.snap-slide') as NodeListOf<HTMLElement> : [];
      for (let si = 0; si < slides.length; si++) {
        slides[si].style.opacity = '';
        slides[si].style.transition = '';
        let slideImg = slides[si].querySelector('img');
        if (slideImg) {
          slideImg.classList.remove('zoomed');
          slideImg.style.transform = '';
          slideImg.style.position = '';
          slideImg.style.zIndex = '';
          slideImg.style.cursor = '';
          delete slideImg.dataset.zoomAnimated;
        }
      }
    }

    let dark = domRefs.lightboxZoomDarken;
    if (dark) dark.style.opacity = '0';
  }, 400);
}

export function navigateLightbox(d: number) {
  if (typeof state.lbZoomLevel !== 'undefined' && state.lbZoomLevel > 1) resetZoom();
  let currentSet = getCurrentLightboxItems();
  if (!currentSet || currentSet.length <= 1) return;
  state.cur = (state.cur + d + currentSet.length) % currentSet.length;
  openLightbox(state.cur, d, state.currentLightboxIsMotion);
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

if (!state.isMobile && domRefs.lightboxBg) domRefs.lightboxBg.addEventListener('click', closeLightbox);

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
