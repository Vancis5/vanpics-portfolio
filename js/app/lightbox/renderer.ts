import { domRefs } from '../dom.js';
import { state } from '../state.js';
import { getCategorySlug, motionProjects } from '../media-data.js';
import { slugify, sanitizeHtml, getPhotoAspectRatio } from '../utils.js';
import { hideFilmstripIfReady, showFilmstripIfReady } from '../core.js';
import { WebGLBlurRenderer } from '../lightbox-blur.js';
import { cacheImage, getLightboxBlurPath } from '../lightbox-cache.js';
import { resetDynamicTextColor, updateDynamicTextColor } from '../lightbox-color.js';
import type { Photo, Video } from '../../types.js';
import type { LightboxMediaItem, LightboxContentOptions, DescFlipOptions } from './types.js';

let blurToken = 0;
let blurPreloadTimer: any = null;
let blurRenderer: WebGLBlurRenderer | null = null;
let hashTimer: any = null;

export function cancelPendingHashUpdate() {
  if (hashTimer !== null) {
    clearTimeout(hashTimer);
    hashTimer = null;
  }
}

export function getBlurRenderer(): WebGLBlurRenderer | null {
  return blurRenderer;
}

export function getCurrentLightboxItems(): LightboxMediaItem[] {
  return state.currentLightboxIsMotion ? motionProjects : state.activePhotos;
}

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

export function scheduleLightboxBlurNeighborPreload(centerIndex: number, delay?: number) {
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

export function clearBlurPreloadTimer() {
  if (blurPreloadTimer) {
    clearTimeout(blurPreloadTimer);
    blurPreloadTimer = null;
  }
}

export function refreshLightboxInfoRefs(): HTMLElement | null {
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

export function initBlurRenderer() {
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
            domRefs.blurCanvas.classList.add('ready', 'active');
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
            domRefs.blurCanvas.classList.add('ready', 'active');
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
  }, 250);

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

let cachedCollapsedDockHeight = 0;

export function measureCollapsedDockHeight(): number {
  const infoWrap = domRefs.lightboxInfoWrap;
  if (!infoWrap) return cachedCollapsedDockHeight || 180;

  const desc = domRefs.lightboxDesc;
  const content = domRefs.lightboxContent;
  const isDescOpen = content?.classList.contains('desc-open');

  if (desc) {
    const prevDisplay = desc.style.display;
    const prevMaxH = desc.style.maxHeight;
    const prevTransition = desc.style.transition;

    desc.style.display = '';
    desc.style.transition = 'none';
    desc.style.maxHeight = '4.35em';

    const h = Math.round(infoWrap.offsetHeight);

    desc.style.display = prevDisplay;
    desc.style.maxHeight = isDescOpen ? `${desc.scrollHeight}px` : prevMaxH;
    desc.style.transition = prevTransition;

    if (h > 0) {
      cachedCollapsedDockHeight = h;
      return h;
    }
  }

  const h = Math.round(infoWrap.offsetHeight);
  if (h > 0) {
    cachedCollapsedDockHeight = h;
    return h;
  }
  return cachedCollapsedDockHeight || 180;
}

export function cancelDescFlipTransition() {
  let content = domRefs.lightboxContent;
  let desc = domRefs.lightboxDesc;
  let btn = domRefs.lightboxDescToggle;
  if (content) content.classList.remove('desc-open');
  if (btn) {
    btn.textContent = 'read more';
    btn.setAttribute('aria-expanded', 'false');
  }
  if (desc) {
    desc.style.transition = '';
    desc.style.maxHeight = '';
    desc.classList.remove('desc-expanded');
  }
}

export function runDescFlipTransition(options: DescFlipOptions) {
  options.applyLayoutChange();
  if (options.cleanup) options.cleanup();
}

function scheduleAfterMotionFrame(callback: () => void, delay?: number) {
  requestAnimationFrame(function () {
    setTimeout(callback, delay || 0);
  });
}

export function updateLightboxDescPreview() {
  let desc = domRefs.lightboxDesc;
  let btn = domRefs.lightboxDescToggle;
  let content = domRefs.lightboxContent;
  if (!desc || !btn || !content || !state.isMobile) return;

  let cleanText = (desc.textContent || '').trim();
  let isDescOpen = content.classList.contains('desc-open');

  if (!cleanText) {
    desc.classList.add('is-empty');
    desc.classList.remove('desc-overflow', 'desc-expanded');
    btn.classList.add('no-desc');
    btn.setAttribute('aria-expanded', 'false');
    return;
  }

  desc.classList.remove('is-empty');
  desc.classList.toggle('desc-expanded', isDescOpen);

  let prevTransition = desc.style.transition;
  desc.style.transition = 'none';

  desc.style.maxHeight = '4.35em';
  let clampedH = desc.clientHeight;
  let naturalH = desc.scrollHeight;

  let hasOverflow = naturalH > clampedH + 2;

  if (isDescOpen) {
    desc.style.maxHeight = `${naturalH}px`;
  } else {
    desc.style.maxHeight = '';
  }
  void desc.offsetHeight;
  desc.style.transition = prevTransition;

  desc.classList.toggle('desc-overflow', hasOverflow);
  btn.classList.toggle('no-desc', !hasOverflow);
}

export function setLightboxContent(p: LightboxMediaItem, options?: LightboxContentOptions) {
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

  cancelDescFlipTransition();

  if (content && content.classList.contains('desc-open')) {
    content.classList.remove('desc-open');
    if (descEl) {
      descEl.style.maxHeight = '';
      descEl.style.transition = '';
    }
    showFilmstripIfReady();
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

  let catSlug = getCategorySlug(state.currentCategory);
  let slug = slugify(safeTitle);
  let newHash = '#' + catSlug + '/' + slug;
  if (slug && window.location.hash !== newHash) {
    if (state.isPopState) {
      cancelPendingHashUpdate();
      history.replaceState(null, '', newHash);
    } else if (state.pushNextState) {
      cancelPendingHashUpdate();
      history.pushState(null, '', newHash);
      state.pushNextState = false;
      state.lightboxHistoryPushed = true;
    } else {
      cancelPendingHashUpdate();
      hashTimer = setTimeout(() => {
        hashTimer = null;
        if (domRefs.lightbox?.classList.contains('open') && window.location.hash !== newHash) {
          history.replaceState(null, '', newHash);
        }
      }, 150);
    }
  }

  if (btn) {
    btn.textContent = 'read more';
    btn.classList.add('no-desc');
    btn.setAttribute('aria-expanded', 'false');
  }

  updateLightboxDescPreview();
  if (!options.skipHeightUpdate) updateMobileImgWrapHeight();
}

export function animateInfo(dir: number) {
  let info = domRefs.lightboxInfo;
  if (!info || !info.parentNode) {
    domRefs.lightboxInfo = (domRefs.lightboxInfoWrap ? domRefs.lightboxInfoWrap.querySelector('#lightbox-info') : null) as HTMLElement;
    info = domRefs.lightboxInfo;
    if (!info || !info.parentNode) return;
  }

  if (state.isMobile) {
    info.style.animation = 'none';
    info.style.transition = 'opacity 0.28s ease';
    info.style.opacity = '1';
    info.style.filter = '';
    info.style.transform = '';
    return;
  }

  let hasContent = info && parseFloat(window.getComputedStyle(info).opacity) > 0.05;
  if (hasContent) {
    let ghost = info.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('id');
    ghost.querySelectorAll('[id]').forEach(function (el) { el.removeAttribute('id'); });
    ghost.style.position = 'absolute';
    ghost.style.top = info.offsetTop + 'px';
    ghost.style.left = info.offsetLeft + 'px';
    ghost.style.width = info.offsetWidth + 'px';
    ghost.style.pointerEvents = 'none';
    ghost.removeAttribute('onclick');
    let exitDuration = '0.22s';
    ghost.style.animation = `lbInfoOut ${exitDuration} ease forwards`;
    ghost.style.willChange = 'filter, opacity';
    ghost.style.zIndex = '1';
    info.parentNode.appendChild(ghost);
    let removeDelay = 250;
    setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, removeDelay);
  }

  let fromX = dir === 0 ? 0 : (dir > 0 ? 24 : -24);
  let fromY = dir === 0 ? 16 : 0;
  let clone = info.cloneNode(true) as HTMLElement;
  clone.style.setProperty('--lb-from-x', fromX + 'px');
  clone.style.setProperty('--lb-from-y', fromY + 'px');
  let duration = '0.55s';
  clone.style.animation = `lbInfoIn ${duration} cubic-bezier(0.22,1,0.36,1) forwards`;
  clone.style.willChange = 'filter, opacity, transform';
  clone.style.transition = '';
  clone.style.filter = '';
  clone.style.opacity = '';
  clone.style.transform = '';
  info.parentNode.replaceChild(clone, info);
  domRefs.lightboxInfo = clone;
  refreshLightboxInfoRefs();
}

let cachedFilmstripTopOffset = 0;

export function measureFilmstripTopOffset(): number {
  const wrap = domRefs.filmstripWrap;
  const strip = domRefs.filmstrip;
  if (!wrap) return cachedFilmstripTopOffset;

  const wrapH = wrap.offsetHeight;
  if (wrapH > 0) {
    const padTop = strip ? strip.offsetTop : (parseFloat(window.getComputedStyle(wrap).paddingTop) || 0);
    const thumbTopFromBottom = wrapH - padTop;
    const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
    const breathingRoom = rootFontSize * 0.5;
    const offset = Math.round(thumbTopFromBottom + breathingRoom);
    if (offset > 0) {
      cachedFilmstripTopOffset = offset;
      return offset;
    }
  }

  return cachedFilmstripTopOffset;
}

export function updateMobileImgWrapHeight(_force?: boolean) {
  if (!state.isMobile) {
    domRefs.lightboxImgWrap?.style.removeProperty('height');
    domRefs.lightboxContent?.style.removeProperty('--lightbox-dock-collapsed-height');
    domRefs.lightboxContent?.style.removeProperty('--lightbox-filmstrip-top-offset');
    domRefs.lightboxInfoWrap?.style.removeProperty('transform');
    return;
  }

  const collapsedH = measureCollapsedDockHeight();
  if (collapsedH > 0 && domRefs.lightboxContent) {
    domRefs.lightboxContent.style.setProperty('--lightbox-dock-collapsed-height', `${collapsedH}px`);
  }

  const filmstripOffset = measureFilmstripTopOffset();
  if (filmstripOffset > 0 && domRefs.lightboxContent) {
    domRefs.lightboxContent.style.setProperty('--lightbox-filmstrip-top-offset', `${filmstripOffset}px`);
  }
}

// Read more / read less.
//
// The dock stays pinned directly above the filmstrip; only the description
// expands upward over the photo on a gradient scrim. Neither the photo nor the
// bottom row (meta + toggle) shifts or jumps.
export function toggleLightboxDesc() {
  let content = domRefs.lightboxContent;
  let btn = domRefs.lightboxDescToggle;
  let desc = domRefs.lightboxDesc;
  if (!content || !btn || !desc || btn.classList.contains('no-desc')) return;

  let opening = !content.classList.contains('desc-open');

  content.classList.toggle('desc-open', opening);
  btn.textContent = opening ? 'read less' : 'read more';
  btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
  desc.classList.toggle('desc-expanded', opening);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    desc.style.transition = 'none';
    desc.style.maxHeight = opening ? `${desc.scrollHeight}px` : '';
  } else {
    desc.style.transition = 'max-height 0.3s ease';
    if (opening) {
      desc.style.maxHeight = `${desc.scrollHeight}px`;
    } else {
      desc.style.maxHeight = '';
    }
  }

  if (opening) {
    hideFilmstripIfReady();
  } else {
    showFilmstripIfReady();
  }
}

export function resetDescToggle() {
  cancelDescFlipTransition();
  let content = domRefs.lightboxContent;
  let info = domRefs.lightboxInfo;
  let btn = domRefs.lightboxDescToggle;
  let desc = domRefs.lightboxDesc;
  if (content) content.classList.remove('desc-open');
  if (info) info.classList.remove('desc-open');
  if (btn) {
    btn.textContent = 'read more';
    btn.setAttribute('aria-expanded', 'false');
  }
  if (desc) {
    desc.style.maxHeight = '';
    desc.style.clipPath = '';
    desc.style.transition = '';
    desc.classList.remove('desc-expanded');
  }
}

window.addEventListener('resize', function () {
  if (state.isMobile && domRefs.lightbox?.classList.contains('open')) {
    updateLightboxDescPreview();
    updateMobileImgWrapHeight();
  }
}, { passive: true });

window.addEventListener('orientationchange', function () {
  if (state.isMobile && domRefs.lightbox?.classList.contains('open')) {
    updateLightboxDescPreview();
    updateMobileImgWrapHeight();
  }
}, { passive: true });

if (typeof window !== 'undefined' && window.visualViewport) {
  window.visualViewport.addEventListener('resize', function () {
    if (state.isMobile && domRefs.lightbox?.classList.contains('open')) {
      updateLightboxDescPreview();
      updateMobileImgWrapHeight();
    }
  }, { passive: true });
}
