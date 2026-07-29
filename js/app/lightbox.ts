import { domRefs } from './dom.js';
import { state } from './state.js';
import { getCategorySlug, motionProjects } from './media-data.js';
import { slugify, sanitizeHtml, getPhotoAspectRatio } from './utils.js';
import { hideFilmstripIfReady, showFilmstripIfReady, clearFilmstripHideTimerIfReady, setFilmstripLiftZoneDisplay } from './core.js';
import { resetZoom } from './lightbox-zoom.js';
import { updateFilmstrip } from './filmstrip.js';
import { WebGLBlurRenderer } from './lightbox-blur.js';

import { Photo, Video } from '../types.js';

import { cacheImage, getLightboxBlurPath } from './lightbox-cache.js';
import { resetDynamicTextColor, updateDynamicTextColor } from './lightbox-color.js';
import {
  prepareLightboxPhoto,
  renderVideoInLightbox,
  startUnifiedMotionPlayer,
  clearLightboxPhotoPlaceholder
} from './lightbox-media.js';

// Re-export for public module interface compatibility
export { prepareLightboxPhoto, renderVideoInLightbox, startUnifiedMotionPlayer };

let blurToken = 0;
let blurPreloadTimer: any = null;
let mobileScrollToSlideCallback: ((i: number, immediate: boolean, dir: number) => void) | null = null;
let swipeNeighborsCallback: (() => void) | null = null;
let previouslyFocusedElement: HTMLElement | null = null;

export function preloadLightboxBlurNeighbors(centerIndex: number, range?: number) {
  if (state.currentLightboxIsMotion) return;

  let currentSet = getCurrentLightboxItems();
  let len = currentSet.length;
  if (!len) return;

  let preloadRange = (range !== undefined && Number.isFinite(range)) ? range : 6;
  for (let offset = -preloadRange; offset <= preloadRange; offset++) {
    let p = currentSet[(centerIndex + offset + len) % len];
    if (!p) continue;
    let bSrc = p.thumb || p.src;
    if (bSrc) cacheImage(getLightboxBlurPath(bSrc));
  }
}

function scheduleLightboxBlurNeighborPreload(centerIndex: number, delay?: number) {
  if (blurPreloadTimer) {
    clearTimeout(blurPreloadTimer);
    blurPreloadTimer = null;
  }
  blurPreloadTimer = setTimeout(function () {
    blurPreloadTimer = null;
    if (state.currentLightboxIsMotion || state.cur !== centerIndex) return;
    preloadLightboxBlurNeighbors(centerIndex, 6);
  }, delay || 0);
}

export function setMobileScrollToSlideCallback(callback: ((i: number, immediate: boolean, dir: number) => void) | null) {
  mobileScrollToSlideCallback = typeof callback === 'function' ? callback : null;
}

function refreshLightboxInfoRefs() {
  let info = domRefs.lightboxInfoWrap ? domRefs.lightboxInfoWrap.querySelector('#lightbox-info') as HTMLElement : null;
  if (!info) return null;

  domRefs.lightboxInfo = info;
  domRefs.lightboxTitle = info.querySelector('#lightbox-title') as HTMLElement;
  domRefs.lightboxDescToggle = info.querySelector('#lightbox-desc-toggle') as HTMLElement;
  domRefs.lightboxDesc = info.querySelector('#lightbox-desc') as HTMLElement;
  domRefs.metaLocation = info.querySelector('#meta-location') as HTMLElement;
  domRefs.metaLocationText = info.querySelector('#meta-location-text') as HTMLElement;
  domRefs.metaDate = info.querySelector('#meta-date') as HTMLElement;
  domRefs.metaDateText = info.querySelector('#meta-date-text') as HTMLElement;
  domRefs.metaMusic = info.querySelector('#meta-music') as HTMLElement;
  domRefs.metaMusicText = info.querySelector('#meta-music-text') as HTMLElement;
  return info;
}

let blurRenderer: WebGLBlurRenderer | null = null;

function initBlurRenderer() {
  if (blurRenderer) return;
  let canvas = domRefs.blurCanvas;
  if (!canvas) return;
  blurRenderer = new WebGLBlurRenderer(canvas);
}

export function setLightboxBlur(src: string) {
  if (!src) return;

  initBlurRenderer();
  let blurPath = getLightboxBlurPath(src);
  let token = ++blurToken;

  let cached = cacheImage(blurPath);

  function fadeToBlackFallback() {
    if (blurRenderer) {
      blurRenderer.fadeToBlack();
      requestAnimationFrame(function () {
        if (token !== blurToken) return;
        requestAnimationFrame(function () {
          if (token !== blurToken) return;
          if (domRefs.blurCanvas) {
            domRefs.blurCanvas.classList.add('ready');
            void domRefs.blurCanvas.offsetHeight;
            domRefs.blurCanvas.classList.add('active');
          }
        });
      });
    }
  }

  function doSwap() {
    if (token !== blurToken) return;

    if (blurRenderer && cached && cached.img) {
      blurRenderer.setImage(cached.img);
      requestAnimationFrame(function () {
        if (token !== blurToken) return;
        requestAnimationFrame(function () {
          if (token !== blurToken) return;
          if (domRefs.blurCanvas) {
            domRefs.blurCanvas.classList.add('ready');
            void domRefs.blurCanvas.offsetHeight;
            domRefs.blurCanvas.classList.add('active');
          }
        });
      });
    }
  }

  if (cached && cached.decoded) {
    doSwap();
    return;
  }

  let timer = setTimeout(function () {
    if (token === blurToken) {
      fadeToBlackFallback();
    }
  }, 50);

  if (cached && cached.decodePromise) {
    cached.decodePromise.then(function () {
      if (token !== blurToken) return;
      clearTimeout(timer);
      doSwap();
    });
  } else {
    clearTimeout(timer);
    fadeToBlackFallback();
  }
}

function runDescFlipTransition(options: any) {
  let imgWrap = domRefs.lightboxImgWrap;
  let infoWrap = domRefs.lightboxInfoWrap;
  let applyLayoutChange = options.applyLayoutChange;
  let cleanup = options.cleanup;

  if (!imgWrap || !infoWrap) {
    applyLayoutChange();
    if (cleanup) cleanup();
    return;
  }

  let photoVisual = state.isMobile ? (imgWrap.querySelector(`.snap-slide[data-idx="${state.cur}"] .snap-slide-inner`) as HTMLElement) : imgWrap;
  if (!photoVisual) photoVisual = imgWrap;
  let startImg = options.startImgRect || photoVisual.getBoundingClientRect();
  let startInfo = options.startInfoRect || infoWrap.getBoundingClientRect();

  applyLayoutChange();

  let targetTransform = state.isMobile ? (infoWrap.style.transform || '') : '';
  let endImg = photoVisual.getBoundingClientRect();
  let endInfo = infoWrap.getBoundingClientRect();
  let dImg = startImg.top - endImg.top;
  let dInfo = startInfo.top - endInfo.top;

  const moveImg = Math.abs(dImg) >= 1;

  if (moveImg) {
    photoVisual.style.transition = 'none';
    photoVisual.style.transform = 'translateY(' + dImg + 'px)';
  }
  infoWrap.style.transition = 'none';
  void infoWrap.offsetHeight;

  infoWrap.style.transform = targetTransform ? (targetTransform + ' translateY(' + dInfo + 'px)') : ('translateY(' + dInfo + 'px)');
  if (options.afterInvert) options.afterInvert();

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      if (moveImg) {
        photoVisual.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
        photoVisual.style.transform = '';
      }
      infoWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
      infoWrap.style.transform = targetTransform;
      setTimeout(function () {
        if (moveImg) {
          photoVisual.style.transition = '';
          photoVisual.style.transform = '';
        }
        infoWrap.style.transition = '';
        if (!state.isMobile) infoWrap.style.transform = '';
        if (cleanup) cleanup();
      }, 450);
    });
  });
}

export function setLightboxContent(p: Photo | Video, options?: any) {
  if (!p) return;
  options = options || {};
  refreshLightboxInfoRefs();
  if (options.deferDynamicTextColor) {
    resetDynamicTextColor();
    scheduleAfterMotionFrame(function () {
      updateDynamicTextColor(p as Photo);
    }, 180);
  } else {
    updateDynamicTextColor(p as Photo);
  }

  let safeTitle = p.title || '';
  let safeDesc = p.desc || '';
  let content = domRefs.lightboxContent;
  if (content) {
    let ratio = getPhotoAspectRatio(p) || 1;
    content.style.setProperty('--lightbox-photo-ratio', String(ratio));
  }
  let btn = domRefs.lightboxDescToggle;
  let descEl = domRefs.lightboxDesc;
  let isCollapsingOpenDesc = content && content.classList.contains('desc-open');
  let preSwapImgRect = null;
  let preSwapInfoRect = null;

  if (isCollapsingOpenDesc && state.isMobile) {
    let preSwapImgWrap = domRefs.lightboxImgWrap;
    let preSwapInfoWrap = domRefs.lightboxInfoWrap;
    if (preSwapImgWrap && preSwapInfoWrap) {
      preSwapImgRect = preSwapImgWrap.getBoundingClientRect();
      preSwapInfoRect = preSwapInfoWrap.getBoundingClientRect();
    }
    if (descEl) descEl.style.transition = 'none';
  }

  if (domRefs.lightboxTitle) domRefs.lightboxTitle.textContent = safeTitle;
  if (descEl) descEl.innerHTML = sanitizeHtml(safeDesc);
  let locItem = domRefs.metaLocation;
  if (p.location) {
    if (domRefs.metaLocationText) domRefs.metaLocationText.textContent = p.location;
    if (locItem) locItem.style.display = 'inline-flex';
  } else if (locItem) {
    locItem.style.display = 'none';
  }

  let dateItem = domRefs.metaDate;
  if (p.date) {
    if (domRefs.metaDateText) domRefs.metaDateText.textContent = p.date;
    if (dateItem) dateItem.style.display = 'inline-flex';
  } else if (dateItem) {
    dateItem.style.display = 'none';
  }

  let musicItem = domRefs.metaMusic;
  const music = (p as Video).music;
  if (music) {
    if (domRefs.metaMusicText) domRefs.metaMusicText.textContent = music;
    if (musicItem) musicItem.style.display = 'inline-flex';
  } else if (musicItem) {
    musicItem.style.display = 'none';
  }

  // Deep Link: Automatically update the URL hash dynamically for routing tracking
  let catSlug = getCategorySlug(state.currentCategory);
  let slug = slugify(safeTitle);
  let newHash = '#' + catSlug + '/' + slug;
  if (slug && window.location.hash !== newHash) {
    if (state.isPopState) {
      history.replaceState(null, '', newHash);
    } else if (state.pushNextState) {
      history.pushState(null, '', newHash);
      state.pushNextState = false;
    } else {
      history.replaceState(null, '', newHash);
    }
  }

  // hide the "read" toggle by default; updateLightboxDescPreview will reveal ONLY if text overflows 2 lines
  if (btn) {
    btn.classList.add('no-desc');
  }

  updateLightboxDescPreview();

  if (content && content.classList.contains('desc-open')) {
    runDescFlipTransition({
      startImgRect: state.isMobile ? preSwapImgRect : null,
      startInfoRect: state.isMobile ? preSwapInfoRect : null,
      applyLayoutChange: function () {
        content.classList.remove('desc-open');
        if (btn) btn.textContent = 'read more';
        updateLightboxDescPreview();
        updateMobileImgWrapHeight();
      },
      cleanup: state.isMobile && descEl ? function () { descEl.style.transition = ''; } : null
    });
  } else if (btn) {
    btn.textContent = 'read more';
    updateLightboxDescPreview();
    if (!options.skipHeightUpdate) updateMobileImgWrapHeight();
  }
}

function updateLightboxDescPreview() {
  let desc = domRefs.lightboxDesc;
  let btn = domRefs.lightboxDescToggle;
  let content = domRefs.lightboxContent;
  if (!desc || !btn || !content || !state.isMobile) return;

  let cleanText = (desc.textContent || '').trim();
  desc.classList.toggle('desc-expanded', content.classList.contains('desc-open'));

  if (!cleanText) {
    desc.classList.remove('desc-overflow');
    btn.classList.add('no-desc');
    return;
  }

  // Temporarily disable transitions during measurement to get clean values
  let prevTransition = desc.style.transition;
  let prevMaxHeight = desc.style.maxHeight;
  desc.style.transition = 'none';
  
  // Measure natural uncapped height
  desc.style.maxHeight = 'none';
  let naturalH = desc.offsetHeight;

  // Measure capped height at 2 lines
  desc.style.maxHeight = '3.5em';
  let clampedH = desc.offsetHeight;

  let hasOverflow = naturalH > clampedH + 4;

  // Restore style and trigger layout sync to prevent twitching
  desc.style.maxHeight = prevMaxHeight;
  void desc.offsetHeight;
  desc.style.transition = prevTransition;

  desc.classList.toggle('desc-overflow', hasOverflow);
  btn.classList.toggle('no-desc', !hasOverflow);
}

export function animateInfo(dir: number) {
  if (state.isMobile) return;
  let info = domRefs.lightboxInfo;
  if (!info || !info.parentNode) {
    domRefs.lightboxInfo = (domRefs.lightboxInfoWrap ? domRefs.lightboxInfoWrap.querySelector('#lightbox-info') : null) as HTMLElement;
    info = domRefs.lightboxInfo;
    if (!info || !info.parentNode) return;
  }

  // only animate exit if there's visible content (opacity > 0 means it's shown)
  let hasContent = info && parseFloat(window.getComputedStyle(info).opacity) > 0.05;
  if (hasContent) {
    // create exit ghost — absolutely positioned so it doesn't shift layout
    let ghost = info.cloneNode(true) as HTMLElement;
    ghost.style.position = 'absolute';
    ghost.style.top = info.offsetTop + 'px';
    ghost.style.left = info.offsetLeft + 'px';
    ghost.style.width = info.offsetWidth + 'px';
    ghost.style.pointerEvents = 'none';
    ghost.removeAttribute('onclick'); // prevent stale tap capture on mobile
    let exitDuration = state.isMobile ? '0.35s' : '0.22s';
    ghost.style.animation = `lbInfoOut ${exitDuration} ease forwards`;
    ghost.style.willChange = 'filter, opacity';
    ghost.style.zIndex = '1';
    info.parentNode.appendChild(ghost);
    let removeDelay = state.isMobile ? 380 : 250;
    setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, removeDelay);
  }

  // clone-replace for enter — clean slate, no animation-cancel issues
  let fromX = (state.isMobile || dir === 0) ? 0 : (dir > 0 ? 24 : -24);
  let fromY = (state.isMobile || dir === 0) ? 0 : (dir === 0 ? 16 : 0);
  let clone = info.cloneNode(true) as HTMLElement;
  clone.style.setProperty('--lb-from-x', fromX + 'px');
  clone.style.setProperty('--lb-from-y', fromY + 'px');
  let duration = state.isMobile ? '0.45s' : '0.55s';
  clone.style.animation = `lbInfoIn ${duration} cubic-bezier(0.22,1,0.36,1) forwards`;
  clone.style.willChange = 'filter, opacity, transform';
  // clear any lingering inline transition/filter/opacity/transform from swipe scroll handler
  clone.style.transition = '';
  clone.style.filter = '';
  clone.style.opacity = '';
  clone.style.transform = '';
  info.parentNode.replaceChild(clone, info);
  domRefs.lightboxInfo = clone;
  refreshLightboxInfoRefs();
}

let navGen = 0;

function scheduleAfterMotionFrame(callback: () => void, delay?: number) {
  requestAnimationFrame(function () {
    setTimeout(callback, delay || 0);
  });
}

export function updateMobileImgWrapHeight() {
  if (!state.isMobile) {
    domRefs.lightboxImgWrap?.style.removeProperty('height');
    domRefs.lightboxContent?.style.removeProperty('--lightbox-img-wrap-height');
    domRefs.lightboxInfoWrap?.style.removeProperty('transform');
    return;
  }
  if (state.isUserTouching) return;
  const imgWrap = domRefs.lightboxImgWrap;
  const infoWrap = domRefs.lightboxInfoWrap;
  if (!imgWrap || !infoWrap) return;

  const containerH = imgWrap.clientHeight;
  if (!containerH) return;

  const slide = imgWrap.querySelector(`.snap-slide[data-idx="${state.cur}"] .snap-slide-inner`) as HTMLElement;
  const slideRatio = slide ? parseFloat(slide.style.getPropertyValue('--lightbox-photo-ratio')) : 0;
  const items = getCurrentLightboxItems();
  const fallbackRatio = items[state.cur] ? getPhotoAspectRatio(items[state.cur]) : 1;
  const ratio = Number.isFinite(slideRatio) && slideRatio > 0 ? slideRatio : fallbackRatio;

  const viewportWidth = imgWrap.clientWidth || window.innerWidth;
  const photoDisplayedH = Math.min(containerH, (viewportWidth - 36) / ratio);
  const topShift = window.innerHeight * 0.04;
  const offset = -Math.max(0, (containerH - photoDisplayedH) / 2) - topShift;

  infoWrap.style.transform = `translateY(${offset}px)`;
}

window.addEventListener('resize', function () {
  if (state.isMobile && domRefs.lightbox?.classList.contains('open')) updateMobileImgWrapHeight();
}, { passive: true });

function getCurrentLightboxItems() {
  return state.currentLightboxIsMotion ? motionProjects : state.activePhotos;
}

export function openLightbox(i: number, direction?: number, isMotion?: boolean) {
  let lb = domRefs.lightbox;
  if (lb && !lb.classList.contains('open') && !state.isPopState) {
    state.pushNextState = true;
  }

  state.cur = i;
  state.isManuallyNavigating = true;
  state.currentLightboxIsMotion = !!isMotion;
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
  if (lb.classList.contains('open') && state.isMobile && mobileScrollToSlideCallback && !isMotion) {
    // Fallback to 1 if direction evaluates to 0 or is mathematically missing
    let dir = (typeof direction === 'number' && direction !== 0) ? direction : 1;
    mobileScrollToSlideCallback(i, true, dir);

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

    // exit current media immediately — snappy
    img.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    img.style.opacity = '0';
    img.style.transform = 'translateX(' + exitX + ') scale(0.98)';
    playerShell.style.opacity = '0';

    // hide info panel immediately so old text isn't visible
    let infoEl = domRefs.lightboxInfo;
    if (infoEl) {
      infoEl.style.animation = 'none';
      infoEl.style.opacity = '0';
    }

    // update blur bg immediately (visual polish)
    showFilmstripIfReady();

    let entered = false;

    function doEnter() {
      if (entered || gen !== navGen) return;
      entered = true;

      // blank src, position off-screen, fully invisible — nothing bleeds through
      img.onload = null; img.onerror = null;
      img.src = '';
      img.style.transition = 'none';
      img.style.transform = '';
      img.style.opacity = '0';
      imgWrap.style.transition = 'none';
      imgWrap.style.transform = 'translateX(' + enterX + ') scale(0.98)';
      imgWrap.style.opacity = '0';
      playerShell.innerHTML = '';
      playerShell.style.opacity = '0';

      // Update content & blur immediately so all layout changes (desc show/hide,
      // meta items, etc.) are fully settled before the animation RAF fires.
      // This prevents desc-related layout shifts mid-slide-in.
      let bSrc = isMotion ? (p.thumb || '') : (p.thumb || p.src || '');
      setLightboxBlur(bSrc);
      setLightboxContent(p);
      if (!isMotion) {
        prepareLightboxPhoto(p as Photo);
        loadSwipeNeighbors();
      }

      requestAnimationFrame(function () {
        if (gen !== navGen) return;
        animateInfo(dir);
        void img.offsetWidth; // force reflow

        if (isMotion) {
          renderVideoInLightbox(p as Video);
          playerShell.style.transition = 'opacity 0.35s ease';
          playerShell.style.opacity = '1';
        } else {
          imgWrap.style.transition = 'opacity 0.24s ease, transform 0.34s cubic-bezier(0.16,1,0.3,1)';
          imgWrap.style.opacity = '1';
          imgWrap.style.transform = 'translateX(0) scale(1)';
          img.style.transition = 'opacity 0.24s ease';
          img.style.opacity = '1';
        }
      });
    }

    if (isMotion) {
      doEnter();
    } else {
      setTimeout(doEnter, 70);
    }

  } else {
    // INITIAL OPEN
    let openGen = ++navGen;
    previouslyFocusedElement = document.activeElement as HTMLElement | null;

    // media starts invisible — no content yet
    img.onload = null; img.onerror = null;
    img.src = '';
    img.style.transition = 'none';
    img.style.opacity = '0';
    img.style.transform = '';
    imgWrap.style.transition = '';
    imgWrap.style.opacity = '';
    imgWrap.style.transform = '';
    playerShell.innerHTML = '';
    playerShell.style.opacity = '0';

    // info panel fully hidden — no stale text visible
    let infoEl2 = domRefs.lightboxInfo;
    if (infoEl2) {
      infoEl2.style.animation = 'none';
      infoEl2.style.opacity = '0';
    }

    let header = domRefs.galleryHeader;
    let masonry = domRefs.masonry;
    let headerRect = header ? header.getBoundingClientRect() : null;
    let masonryRect = masonry ? masonry.getBoundingClientRect() : null;

    lb.classList.add('open');
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

    // -- FLIP: Invert --
    if (header && headerRect) {
      let last = header.getBoundingClientRect();
      let dX = headerRect.left - last.left;
      let dY = headerRect.top - last.top;
      header.style.transition = 'none';
      header.style.transform = 'translate(' + dX + 'px, ' + dY + 'px)';
    }
    if (masonry && masonryRect) {
      let lastM = masonry.getBoundingClientRect();
      let dXm = masonryRect.left - lastM.left;
      let dYm = masonryRect.top - lastM.top;
      masonry.style.transition = 'none';
      masonry.style.transform = 'translate(' + dXm + 'px, ' + dYm + 'px)';
    }

    requestAnimationFrame(function () {
      let ease = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
      if (header) {
        header.style.transition = ease;
        header.style.transform = '';
      }
      if (masonry) {
        masonry.style.transition = ease;
        masonry.style.transform = '';
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
      setLightboxContent(p);
      if (!isMotion) loadSwipeNeighbors();

      requestAnimationFrame(function () {
        if (openGen !== navGen) return;
        if (!state.isMobile) {
          animateInfo(0);
        }
        void img.offsetWidth; // force reflow

        if (isMotion) {
          renderVideoInLightbox(p as Video);
          playerShell.style.transition = 'opacity 0.45s ease';
          playerShell.style.opacity = '1';
        } else {
          img.style.transition = 'opacity 0.45s ease';
          img.style.opacity = '1';
        }
      });
    }

    // Start the image immediately; the browser paints it as soon as pixels arrive.
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
  let masonry = domRefs.masonry;
  let headerRect = header ? header.getBoundingClientRect() : null;
  let masonryRect = masonry ? masonry.getBoundingClientRect() : null;

  let img = domRefs.lightboxImg;
  let activeGen = ++navGen; // invalidates all pending callbacks
  lb.classList.remove('open');
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
  hideFilmstripIfReady();
  setFilmstripLiftZoneDisplay('none');

  // -- FLIP: Invert --
  if (header && headerRect) {
    let last = header.getBoundingClientRect();
    let dX = headerRect.left - last.left;
    let dY = headerRect.top - last.top;
    header.style.transition = 'none';
    header.style.transform = 'translate(' + dX + 'px, ' + dY + 'px)';
  }
  if (masonry && masonryRect) {
    let lastM = masonry.getBoundingClientRect();
    let dXm = masonryRect.left - lastM.left;
    let dYm = masonryRect.top - lastM.top;
    masonry.style.transition = 'none';
    masonry.style.transform = 'translate(' + dXm + 'px, ' + dYm + 'px)';
  }

  requestAnimationFrame(function () {
    let ease = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
    if (header) {
      header.style.transition = ease;
      header.style.transform = '';
    }
    if (masonry) {
      masonry.style.transition = ease;
      masonry.style.transform = '';
    }

    // Restart Lenis and sync state once transition has a head start
    setTimeout(function () {
      const lenis = (window as any).lenis;
      if (lenis) {
        lenis.start();
        lenis.animatedScroll = lenis.targetScroll = window.scrollY;
        lenis.emit(); // Force sync of all UI driven by scroll hub
      }
    }, 400);
  });

  let playerShell = domRefs.motionPlayerShell;
  if (playerShell) playerShell.innerHTML = '';

  if (domRefs.blurCanvas) {
    domRefs.blurCanvas.classList.remove('active');
    domRefs.blurCanvas.classList.remove('ready');
  }
  if (blurRenderer) {
    blurRenderer.stopAnimation();
  }
  if (blurPreloadTimer) {
    clearTimeout(blurPreloadTimer);
    blurPreloadTimer = null;
  }
  // Reset hash to category on close
  if (window.location.hash && !state.isPopState) {
    let catSlug = getCategorySlug(state.currentCategory);
    history.pushState(null, '', '#' + catSlug);
  }

  // Delay DOM teardown until the opacity fade finishes
  setTimeout(function () {
    if (activeGen !== navGen) return; // Abort if user reopened lightbox quickly
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

export function toggleLightboxDesc() {
  let content = domRefs.lightboxContent;
  let btn = domRefs.lightboxDescToggle;
  if (!content || !btn || btn.classList.contains('no-desc')) return;

  let desc = domRefs.lightboxDesc;
  let opening = !content.classList.contains('desc-open');

  runDescFlipTransition({
    applyLayoutChange: function () {
      content.classList.toggle('desc-open', opening);
      btn.textContent = opening ? 'read less' : 'read more';
      updateLightboxDescPreview();
      updateMobileImgWrapHeight();
      if (opening) hideFilmstripIfReady();
      else showFilmstripIfReady();
    },
    afterInvert: function () {
      if (desc) void desc.offsetHeight;
    }
  });
}

export function resetDescToggle() {
  let info = domRefs.lightboxInfo;
  let btn = domRefs.lightboxDescToggle;
  if (info) info.classList.remove('desc-open');
  if (btn) btn.textContent = 'read more';
}

export function loadSwipeNeighbors() {
  if (state.currentLightboxIsMotion) return;
  let currentSet = getCurrentLightboxItems();
  let len = currentSet.length;

  // Preload & cache ±2 high-res neighbors (to save bandwidth)
  [-2, -1, 1, 2].forEach(function (offset) {
    let p = currentSet[(state.cur + offset + len) % len];
    if (p && p.src) cacheImage(p.src);
  });

  // Preload & cache ±6 blurred backgrounds (super light)
  [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6].forEach(function (offset) {
    let p = currentSet[(state.cur + offset + len) % len];
    if (p) {
      let bSrc = p.thumb || p.src;
      if (bSrc) {
        cacheImage(getLightboxBlurPath(bSrc));
      }
    }
  });

  if (typeof swipeNeighborsCallback === 'function') {
    swipeNeighborsCallback();
  }
}

export function setLoadSwipeNeighbors(fn: (() => void) | null) {
  swipeNeighborsCallback = fn;
}

export function navigateLightbox(d: number) {
  if (typeof state.lbZoomLevel !== 'undefined' && state.lbZoomLevel > 1) resetZoom();
  let currentSet = getCurrentLightboxItems();
  state.cur = (state.cur + d + currentSet.length) % currentSet.length;
  openLightbox(state.cur, d, state.currentLightboxIsMotion);
}
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
  if (e.key === 'ArrowRight' || key === 'd' || key === 's') navigateLightbox(1);
  if (e.key === 'ArrowLeft' || key === 'a' || key === 'w') navigateLightbox(-1);
});

if (!state.isMobile && domRefs.lightboxBg) domRefs.lightboxBg.addEventListener('click', closeLightbox);

function handleLightboxBlur() {
  if (domRefs.lightbox && domRefs.lightbox.classList.contains('open')) {
    domRefs.lightbox.classList.add('window-blurred');
    
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
