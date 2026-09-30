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

export function runDescFlipTransition(options: DescFlipOptions) {
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
  desc.classList.toggle('desc-expanded', content.classList.contains('desc-open'));

  if (!cleanText) {
    desc.classList.remove('desc-overflow');
    btn.classList.add('no-desc');
    return;
  }

  let prevTransition = desc.style.transition;
  let prevMaxHeight = desc.style.maxHeight;
  desc.style.transition = 'none';
  
  desc.style.maxHeight = 'none';
  let naturalH = desc.offsetHeight;

  desc.style.maxHeight = '3.5em';
  let clampedH = desc.offsetHeight;

  let hasOverflow = naturalH > clampedH + 4;

  desc.style.maxHeight = prevMaxHeight;
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

export function animateInfo(dir: number) {
  let info = domRefs.lightboxInfo;
  if (!info || !info.parentNode) {
    domRefs.lightboxInfo = (domRefs.lightboxInfoWrap ? domRefs.lightboxInfoWrap.querySelector('#lightbox-info') : null) as HTMLElement;
    info = domRefs.lightboxInfo;
    if (!info || !info.parentNode) return;
  }

  if (state.isMobile) {
    info.style.animation = 'none';
    info.style.transition = 'opacity 0.35s ease, filter 0.35s ease';
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
    let exitDuration = state.isMobile ? '0.30s' : '0.22s';
    ghost.style.animation = `lbInfoOut ${exitDuration} ease forwards`;
    ghost.style.willChange = 'filter, opacity';
    ghost.style.zIndex = '1';
    info.parentNode.appendChild(ghost);
    let removeDelay = state.isMobile ? 320 : 250;
    setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, removeDelay);
  }

  let fromX = dir === 0 ? 0 : (dir > 0 ? 24 : -24);
  let fromY = dir === 0 ? 16 : 0;
  let clone = info.cloneNode(true) as HTMLElement;
  clone.style.setProperty('--lb-from-x', fromX + 'px');
  clone.style.setProperty('--lb-from-y', fromY + 'px');
  let duration = state.isMobile ? '0.45s' : '0.55s';
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

  let ratio = 1;
  let photoDisplayedH = containerH;

  if (state.currentLightboxIsMotion) {
    const shell = domRefs.motionPlayerShell;
    const items = getCurrentLightboxItems();
    const fallbackRatio = items[state.cur] ? getPhotoAspectRatio(items[state.cur]) : (16 / 9);
    ratio = fallbackRatio;
    const viewportWidth = imgWrap.clientWidth || window.innerWidth;
    const shellRect = shell ? shell.getBoundingClientRect() : null;
    photoDisplayedH = shellRect && shellRect.height > 0 ? shellRect.height : Math.min(containerH, (viewportWidth - 32) / ratio);
  } else {
    const slide = imgWrap.querySelector(`.snap-slide[data-idx="${state.cur}"] .snap-slide-inner`) as HTMLElement;
    const slideRatio = slide ? parseFloat(slide.style.getPropertyValue('--lightbox-photo-ratio')) : 0;
    const items = getCurrentLightboxItems();
    const fallbackRatio = items[state.cur] ? getPhotoAspectRatio(items[state.cur]) : 1;
    ratio = Number.isFinite(slideRatio) && slideRatio > 0 ? slideRatio : fallbackRatio;
    const viewportWidth = imgWrap.clientWidth || window.innerWidth;
    photoDisplayedH = Math.min(containerH, (viewportWidth - 36) / ratio);
  }

  const topShift = window.innerHeight * 0.04;
  const offset = -Math.max(0, (containerH - photoDisplayedH) / 2) - topShift;

  infoWrap.style.transform = `translateY(${offset}px)`;
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


let rendererResizeTimer: any;
window.addEventListener('resize', function () {
  clearTimeout(rendererResizeTimer);
  rendererResizeTimer = setTimeout(function() {
    if (state.isMobile && domRefs.lightbox?.classList.contains('open')) updateMobileImgWrapHeight();
  }, 150);
}, { passive: true });
