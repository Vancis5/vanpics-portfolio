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

let flipTimer: any = null;

export function getMobileInfoBaseOffset(): number {
  const imgWrap = domRefs.lightboxImgWrap;
  if (!imgWrap) return 0;
  const containerH = imgWrap.clientHeight;
  if (!containerH) return 0;

  let photoDisplayedH = containerH;
  if (state.currentLightboxIsMotion) {
    const shell = domRefs.motionPlayerShell;
    const items = getCurrentLightboxItems();
    const fallbackRatio = items[state.cur] ? getPhotoAspectRatio(items[state.cur]) : (16 / 9);
    const viewportWidth = imgWrap.clientWidth || window.innerWidth;
    const shellRect = shell ? shell.getBoundingClientRect() : null;
    photoDisplayedH = shellRect && shellRect.height > 0 ? shellRect.height : Math.min(containerH, (viewportWidth - 32) / fallbackRatio);
  } else {
    const slide = imgWrap.querySelector(`.snap-slide[data-idx="${state.cur}"] .snap-slide-inner`) as HTMLElement;
    const slideRatio = slide ? parseFloat(slide.style.getPropertyValue('--lightbox-photo-ratio')) : 0;
    const items = getCurrentLightboxItems();
    const fallbackRatio = items[state.cur] ? getPhotoAspectRatio(items[state.cur]) : 1;
    const ratio = Number.isFinite(slideRatio) && slideRatio > 0 ? slideRatio : fallbackRatio;
    const viewportWidth = imgWrap.clientWidth || window.innerWidth;
    photoDisplayedH = Math.min(containerH, (viewportWidth - 36) / ratio);
  }

  const topShift = window.innerHeight * 0.04;
  return -Math.max(0, (containerH - photoDisplayedH) / 2) - topShift;
}

export function getDescExpansionDiff(): number {
  let desc = domRefs.lightboxDesc;
  if (!desc || !state.isMobile) return 0;
  let prevTransition = desc.style.transition;
  let prevMaxH = desc.style.maxHeight;

  desc.style.transition = 'none';
  desc.style.maxHeight = '3.5em';
  let collapsedH = desc.offsetHeight;

  desc.style.maxHeight = 'none';
  let expandedH = desc.offsetHeight;

  desc.style.maxHeight = prevMaxH;
  desc.style.transition = prevTransition;

  return Math.max(0, expandedH - collapsedH);
}

export function cancelDescFlipTransition() {
  if (flipTimer) {
    clearTimeout(flipTimer);
    flipTimer = null;
  }
  let imgWrap = domRefs.lightboxImgWrap;
  let infoWrap = domRefs.lightboxInfoWrap;
  let photoVisual = state.currentLightboxIsMotion
    ? domRefs.motionPlayerShell
    : (imgWrap?.querySelector(`.snap-slide[data-idx="${state.cur}"] .snap-slide-inner`) as HTMLElement);
  if (photoVisual) {
    photoVisual.style.transition = '';
    photoVisual.style.transform = '';
  }
  if (infoWrap) {
    infoWrap.style.transition = '';
    infoWrap.style.transform = '';
  }
  let desc = domRefs.lightboxDesc;
  if (desc) {
    desc.style.transition = '';
    desc.style.maxHeight = '';
    desc.style.clipPath = '';
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
  desc.classList.toggle('desc-expanded', content.classList.contains('desc-open'));

  if (!cleanText) {
    desc.classList.remove('desc-overflow');
    btn.classList.add('no-desc');
    btn.setAttribute('aria-expanded', 'false');
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

export function updateMobileImgWrapHeight(force?: boolean) {
  if (!state.isMobile) {
    domRefs.lightboxImgWrap?.style.removeProperty('height');
    domRefs.lightboxContent?.style.removeProperty('--lightbox-img-wrap-height');
    domRefs.lightboxInfoWrap?.style.removeProperty('transform');
    return;
  }
  if ((state.isUserTouching || flipTimer !== null) && !force) return;
  const imgWrap = domRefs.lightboxImgWrap;
  const infoWrap = domRefs.lightboxInfoWrap;
  if (!imgWrap || !infoWrap) return;

  const baseOffset = getMobileInfoBaseOffset();
  const isDescOpen = domRefs.lightboxContent?.classList.contains('desc-open');
  const shift = isDescOpen ? Math.round(getDescExpansionDiff() / 2) : 0;

  let photoVisual = state.currentLightboxIsMotion
    ? domRefs.motionPlayerShell
    : (imgWrap.querySelector(`.snap-slide[data-idx="${state.cur}"] .snap-slide-inner`) as HTMLElement);

  if (photoVisual) {
    photoVisual.style.transform = shift > 0 ? `translateY(calc(-4dvh - ${shift}px))` : '';
  }

  infoWrap.style.transform = shift > 0
    ? `translateY(calc(${baseOffset}px - ${shift}px))`
    : `translateY(${baseOffset}px)`;
}

export function toggleLightboxDesc() {
  let content = domRefs.lightboxContent;
  let btn = domRefs.lightboxDescToggle;
  if (!content || !btn || btn.classList.contains('no-desc')) return;
  if (flipTimer !== null) return;

  let imgWrap = domRefs.lightboxImgWrap;
  let infoWrap = domRefs.lightboxInfoWrap;
  let desc = domRefs.lightboxDesc;
  if (!imgWrap || !infoWrap || !desc) return;

  let photoVisual = state.currentLightboxIsMotion
    ? domRefs.motionPlayerShell
    : (imgWrap.querySelector(`.snap-slide[data-idx="${state.cur}"] .snap-slide-inner`) as HTMLElement);
  if (!photoVisual) photoVisual = imgWrap;

  let opening = !content.classList.contains('desc-open');

  // 1. FIRST: measure exact dynamic current positions (including in-flight)
  photoVisual.style.transition = 'none';
  infoWrap.style.transition = 'none';
  desc.style.transition = 'none';

  let startPhotoRect = photoVisual.getBoundingClientRect();
  let startInfoRect = infoWrap.getBoundingClientRect();
  let startDescH = desc.offsetHeight;

  // Measure dynamic collapsed vs expanded heights
  let prevMaxH = desc.style.maxHeight;
  let prevTransition = desc.style.transition;
  desc.style.transition = 'none';
  desc.style.maxHeight = '3.5em';
  let collapsedDescH = desc.offsetHeight;
  desc.style.maxHeight = 'none';
  let expandedDescH = desc.offsetHeight;
  desc.style.maxHeight = prevMaxH;
  desc.style.transition = prevTransition;

  let diff = Math.max(0, expandedDescH - collapsedDescH);
  if (diff === 0) return;
  let shift = Math.round(diff / 2);
  let baseOffset = getMobileInfoBaseOffset();

  // 2. LAST: set target layout in DOM
  content.classList.toggle('desc-open', opening);
  btn.textContent = opening ? 'read less' : 'read more';
  btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
  updateLightboxDescPreview();

  if (opening) hideFilmstripIfReady();
  else showFilmstripIfReady();

  let targetShift = opening ? shift : 0;
  let targetPhotoTransform = targetShift > 0 ? `translateY(calc(-4dvh - ${targetShift}px))` : '';
  let targetInfoTransform = targetShift > 0 ? `translateY(calc(${baseOffset}px - ${targetShift}px))` : `translateY(${baseOffset}px)`;
  let targetDescH = opening ? expandedDescH : collapsedDescH;

  photoVisual.style.transform = targetPhotoTransform;
  infoWrap.style.transform = targetInfoTransform;
  desc.style.maxHeight = targetDescH + 'px';

  let endPhotoRect = photoVisual.getBoundingClientRect();
  let endInfoRect = infoWrap.getBoundingClientRect();
  let endDescH = desc.offsetHeight;

  // 3. INVERT: calculate exact delta from dynamic start to end
  let dPhoto = startPhotoRect.top - endPhotoRect.top;
  let dInfo = startInfoRect.top - endInfoRect.top;

  let invertPhotoTransform = targetPhotoTransform
    ? `${targetPhotoTransform} translateY(${dPhoto}px)`
    : `translateY(calc(-4dvh + ${dPhoto}px))`;
  let invertInfoTransform = targetInfoTransform
    ? `${targetInfoTransform} translateY(${dInfo}px)`
    : `translateY(calc(${baseOffset}px + ${dInfo}px))`;

  photoVisual.style.transform = invertPhotoTransform;
  infoWrap.style.transform = invertInfoTransform;
  desc.style.maxHeight = startDescH + 'px';

  // Force reflow
  void infoWrap.offsetHeight;

  // 4. PLAY: animate smoothly to target positions
  requestAnimationFrame(function () {
    const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const dur = '0.38s';

    photoVisual.style.transition = `transform ${dur} ${ease}`;
    photoVisual.style.transform = targetPhotoTransform;

    infoWrap.style.transition = `transform ${dur} ${ease}`;
    infoWrap.style.transform = targetInfoTransform;

    desc.style.transition = `max-height ${dur} ${ease}, opacity ${dur} ease`;
    desc.style.maxHeight = endDescH + 'px';

    flipTimer = setTimeout(function () {
      photoVisual.style.transition = '';
      infoWrap.style.transition = '';
      desc.style.transition = '';
      if (opening) {
        desc.style.maxHeight = 'none';
      } else {
        desc.style.maxHeight = '';
      }
      flipTimer = null;
    }, 400);
  });
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
  }
}

window.addEventListener('resize', function () {
  if (state.isMobile && domRefs.lightbox?.classList.contains('open')) updateMobileImgWrapHeight();
}, { passive: true });
