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
import { getLightboxLayout, updateLightboxLayout, type LbLayout } from './layout.js';

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

export function isStackedLayout(): boolean {
  const layout = getLightboxLayout();
  return layout === 'phone' || layout === 'tablet-portrait';
}

export function getDescToggleLabel(isExpanded: boolean): string {
  if (getLightboxLayout() === 'tablet-portrait') {
    return isExpanded ? 'less' : 'more';
  }
  return isExpanded ? 'read less' : 'read more';
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

export function measureCollapsedDockHeight(force?: boolean): number {
  if (cachedCollapsedDockHeight > 0 && !force) {
    return cachedCollapsedDockHeight;
  }
  if (typeof document === 'undefined') return 165;

  const probe = document.createElement('div');
  probe.id = 'lightbox';
  probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:100vw;visibility:hidden;pointer-events:none;z-index:-9999;';
  probe.innerHTML = `
    <div id="lightbox-info-wrap">
      <div id="lightbox-info">
        <div id="lightbox-title-row">
          <h2 id="lightbox-title">Sample Title</h2>
        </div>
        <div id="lightbox-desc">
          Sample description line 1<br>Sample description line 2<br>Sample description line 3
        </div>
        <div id="lightbox-bottom-row">
          <div id="lightbox-meta">
            <span class="meta-item"><span>Location</span></span>
          </div>
          <button id="lightbox-desc-toggle" type="button">read more</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(probe);
  const wrap = probe.querySelector('#lightbox-info-wrap') as HTMLElement | null;
  const h = wrap ? Math.round(wrap.getBoundingClientRect().height) : 0;
  document.body.removeChild(probe);

  if (h > 0) {
    cachedCollapsedDockHeight = h;
    return h;
  }
  return cachedCollapsedDockHeight || 165;
}

export function cancelDescFlipTransition() {
  if (descCrossfadeTimer !== null) {
    clearTimeout(descCrossfadeTimer);
    descCrossfadeTimer = null;
  }
  clearLightboxPhotoMask();
  let content = domRefs.lightboxContent;
  let desc = domRefs.lightboxDesc;
  let btn = domRefs.lightboxDescToggle;
  if (content) content.classList.remove('desc-open');
  if (btn) {
    btn.textContent = getDescToggleLabel(false);
    btn.setAttribute('aria-expanded', 'false');
  }
  if (desc) {
    desc.style.transition = '';
    desc.style.maxHeight = '';
    desc.classList.remove('desc-expanded');
    if (desc.dataset.clampedDesc) {
      desc.innerHTML = desc.dataset.clampedDesc;
    }
  }
}

export function runDescFlipTransition(options: DescFlipOptions) {
  options.applyLayoutChange();
  if (options.cleanup) options.cleanup();
}

function cleanEndAndAddEllipsis(text: string): string {
  let t = text.replace(/[\s\uFEFF\xA0]+$/, '');
  // If ends with sentence punctuation or ellipsis, strip it so we don't get '....'
  t = t.replace(/[.,!?:;…]+$/, '');
  t = t.replace(/[\s\uFEFF\xA0]+$/, '');
  return t ? t + '...' : '';
}

function getLastTextNode(node: Node | null): Node | null {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) return node;
  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const found = getLastTextNode(node.childNodes[i]);
    if (found) return found;
  }
  return null;
}

export function computeClampedDescHtml(descEl: HTMLElement, fullHtml: string, clampedH: number): string {
  if (typeof document === 'undefined') return fullHtml;
  const probe = document.createElement('div');
  probe.id = 'lightbox-desc';
  const width = descEl.clientWidth || (typeof window !== 'undefined' && window.innerWidth ? Math.max(200, window.innerWidth - 40) : 320);
  const cs = typeof window !== 'undefined' ? window.getComputedStyle(descEl) : null;
  const fontRules = cs
    ? `font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};line-height:${cs.lineHeight};letter-spacing:${cs.letterSpacing};`
    : '';
  const maxLinesHeight = '4.35em';
  probe.style.cssText = `position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;width:${width}px;max-height:${maxLinesHeight};${fontRules}`;
  probe.innerHTML = fullHtml;
  document.body.appendChild(probe);

  const targetH = clampedH || probe.clientHeight || 66;

  // 1. Pop nodes/words from end until it fits within targetH
  while (probe.childNodes.length > 0 && probe.scrollHeight > targetH + 2) {
    const last = probe.lastChild;
    if (!last) break;
    if (last.nodeType === Node.TEXT_NODE) {
      const words = (last.textContent || '').trimEnd().split(/\s+/);
      if (words.length > 1) {
        words.pop();
        last.textContent = words.join(' ') + ' ';
      } else {
        probe.removeChild(last);
      }
    } else if (last.nodeType === Node.ELEMENT_NODE) {
      if ((last as HTMLElement).tagName === 'BR') {
        probe.removeChild(last);
      } else {
        const lastText = getLastTextNode(last);
        if (lastText) {
          const words = (lastText.textContent || '').trimEnd().split(/\s+/);
          if (words.length > 1) {
            words.pop();
            lastText.textContent = words.join(' ') + ' ';
          } else {
            probe.removeChild(last);
          }
        } else {
          probe.removeChild(last);
        }
      }
    }
  }

  // 2. Strip trailing BR elements and empty text nodes so line breaks are handled cleanly
  const stripTrailingBreaks = () => {
    while (probe.lastChild && (
      probe.lastChild.nodeName === 'BR' ||
      (probe.lastChild.nodeType === Node.TEXT_NODE && !(probe.lastChild.textContent || '').trim())
    )) {
      probe.removeChild(probe.lastChild);
    }
  };

  stripTrailingBreaks();

  // 3. Attach ellipsis to the last text node
  const applyEllipsis = () => {
    stripTrailingBreaks();
    const lastText = getLastTextNode(probe);
    if (!lastText) return false;
    lastText.textContent = cleanEndAndAddEllipsis(lastText.textContent || '');
    return true;
  };

  applyEllipsis();

  // 4. If adding '...' caused an overflow line break, trim words until it fits with '...'
  while (probe.scrollHeight > targetH + 2 && probe.childNodes.length > 0) {
    const lastText = getLastTextNode(probe);
    if (lastText) {
      let raw = (lastText.textContent || '').replace(/\.{3}$/, '').trimEnd();
      const words = raw.split(/\s+/);
      if (words.length > 1) {
        words.pop();
        lastText.textContent = words.join(' ');
        applyEllipsis();
      } else {
        const parent = lastText.parentNode;
        if (parent) parent.removeChild(lastText);
        applyEllipsis();
      }
    } else {
      break;
    }
  }

  const clampedHtml = probe.innerHTML;
  probe.style.maxHeight = 'none';
  const clampedHeight = probe.clientHeight || probe.scrollHeight;
  if (descEl && clampedHeight > 0) {
    descEl.dataset.clampedHeight = String(Math.round(clampedHeight));
  }
  document.body.removeChild(probe);
  return clampedHtml;
}

export function updateLightboxDescPreview() {
  let desc = domRefs.lightboxDesc;
  let btn = domRefs.lightboxDescToggle;
  let content = domRefs.lightboxContent;
  if (!desc || !btn || !content) return;

  const fullHtml = desc.dataset.fullDesc ?? desc.innerHTML;
  desc.dataset.fullDesc = fullHtml;

  // Clamping applies to stacked layouts (phone and tablet-portrait).
  // Tablet-landscape and desktop have room in the side rail for full text without a toggle.
  if (!isStackedLayout()) {
    desc.innerHTML = fullHtml;
    desc.style.maxHeight = '';
    desc.classList.remove('desc-overflow', 'desc-expanded');
    btn.classList.add('no-desc');
    btn.setAttribute('aria-expanded', 'false');
    delete desc.dataset.clampedHeight;
    return;
  }

  let cleanText = (desc.textContent || '').trim();
  let isDescOpen = content.classList.contains('desc-open');

  if (!cleanText) {
    desc.classList.add('is-empty');
    desc.classList.remove('desc-overflow', 'desc-expanded');
    btn.classList.add('no-desc');
    btn.setAttribute('aria-expanded', 'false');
    delete desc.dataset.clampedHeight;
    return;
  }

  desc.classList.remove('is-empty');
  desc.classList.toggle('desc-expanded', isDescOpen);

  let prevTransition = desc.style.transition;
  desc.style.transition = 'none';

  // Measure with full content to determine natural height and clamp boundary
  desc.innerHTML = fullHtml;
  desc.style.maxHeight = '4.35em';
  let clampedH = desc.clientHeight;
  let naturalH = desc.scrollHeight;

  let hasOverflow = naturalH > clampedH + 2;

  if (hasOverflow) {
    const clampedHtml = computeClampedDescHtml(desc, fullHtml, clampedH);
    desc.dataset.clampedDesc = clampedHtml;
    if (!isDescOpen) {
      desc.innerHTML = clampedHtml;
      desc.style.maxHeight = '';
      void desc.offsetHeight;
      if (desc.clientHeight > 0) {
        desc.dataset.clampedHeight = String(Math.round(desc.clientHeight));
      }
    }
  } else {
    desc.dataset.clampedDesc = fullHtml;
    delete desc.dataset.clampedHeight;
  }

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
  updateDynamicTextColor(p as Photo);

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
  const sanitizedDesc = sanitizeHtml(safeDesc);
  if (descEl) {
    descEl.dataset.fullDesc = sanitizedDesc;
    descEl.dataset.clampedDesc = '';
    descEl.innerHTML = sanitizedDesc;
  }
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
    btn.textContent = getDescToggleLabel(false);
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

  if (isStackedLayout() || state.isMobile || getLightboxLayout() === 'tablet-landscape') {
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

export function measureFilmstripTopOffset(force?: boolean): number {
  if (cachedFilmstripTopOffset > 0 && !force) return cachedFilmstripTopOffset;
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

export function updateMobileImgWrapHeight(force?: boolean) {
  if (!isStackedLayout()) {
    domRefs.lightboxImgWrap?.style.removeProperty('height');
    domRefs.lightboxContent?.style.removeProperty('--lightbox-dock-collapsed-height');
    domRefs.lightboxContent?.style.removeProperty('--lightbox-filmstrip-top-offset');
    domRefs.lightboxContent?.style.removeProperty('--lightbox-img-wrap-height');
    domRefs.lightboxContent?.style.removeProperty('--lightbox-total-avail-height');
    domRefs.lightboxInfoWrap?.style.removeProperty('transform');
    return;
  }

  const collapsedH = measureCollapsedDockHeight(force);
  if (collapsedH > 0 && domRefs.lightboxContent) {
    domRefs.lightboxContent.style.setProperty('--lightbox-dock-collapsed-height', `${collapsedH}px`);
  }

  const filmstripOffset = measureFilmstripTopOffset(force);
  if (filmstripOffset > 0 && domRefs.lightboxContent) {
    domRefs.lightboxContent.style.setProperty('--lightbox-filmstrip-top-offset', `${filmstripOffset}px`);
  }
}

let photoMaskRafId: number | null = null;
let isDescCollapsing = false;
let descCrossfadeTimer: ReturnType<typeof setTimeout> | null = null;

function setupDescCrossfade(desc: HTMLElement, fullHtml: string, clampedHtml: string, mode: 'expand' | 'collapse') {
  if (descCrossfadeTimer !== null) {
    clearTimeout(descCrossfadeTimer);
    descCrossfadeTimer = null;
  }

  const layerFull = document.createElement('div');
  layerFull.className = 'desc-layer-full';
  layerFull.innerHTML = fullHtml;

  const layerClamped = document.createElement('div');
  layerClamped.className = 'desc-layer-clamped';
  layerClamped.innerHTML = clampedHtml;

  if (mode === 'expand') {
    layerFull.style.cssText = 'position: relative; width: 100%; opacity: 0; transition: opacity 0.22s ease-out;';
    layerClamped.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; opacity: 1; pointer-events: none; transition: opacity 0.22s ease-out;';
  } else {
    layerFull.style.cssText = 'position: relative; width: 100%; opacity: 1; transition: opacity 0.18s ease-out;';
    layerClamped.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; opacity: 0; pointer-events: none; transition: opacity 0.18s ease-out;';
  }

  desc.innerHTML = '';
  desc.appendChild(layerFull);
  desc.appendChild(layerClamped);

  return { layerFull, layerClamped };
}

export function clearLightboxPhotoMask() {
  if (photoMaskRafId !== null) {
    cancelAnimationFrame(photoMaskRafId);
    photoMaskRafId = null;
  }
  if (descCrossfadeTimer !== null) {
    clearTimeout(descCrossfadeTimer);
    descCrossfadeTimer = null;
  }
  isDescCollapsing = false;
  let wrap = domRefs.lightboxImgWrap;
  if (wrap) {
    let imgs = wrap.querySelectorAll('.snap-slide img') as NodeListOf<HTMLElement>;
    for (let i = 0; i < imgs.length; i++) {
      imgs[i].classList.remove('expanded');
      imgs[i].style.removeProperty('--overlap');
    }
  }
  if (domRefs.lightboxImg) {
    domRefs.lightboxImg.classList.remove('expanded');
    domRefs.lightboxImg.style.removeProperty('--overlap');
  }
  let playerShell = domRefs.motionPlayerShell;
  if (playerShell) {
    playerShell.classList.remove('expanded');
    playerShell.style.removeProperty('--overlap');
  }
}

export function getActivePhotoImg(): HTMLElement | null {
  if (state.isMobile) {
    let wrap = domRefs.lightboxImgWrap;
    if (wrap) {
      let activeImg = wrap.querySelector(`.snap-slide[data-idx="${state.cur}"] img`) as HTMLElement | null;
      if (activeImg) return activeImg;
      let firstImg = wrap.querySelector('.snap-slide img') as HTMLElement | null;
      if (firstImg) return firstImg;
    }
  }
  if (state.currentLightboxIsMotion && domRefs.motionPlayerShell) {
    return domRefs.motionPlayerShell;
  }
  return domRefs.lightboxImg;
}

export function updateLightboxPhotoMask() {
  if (getLightboxLayout() !== 'phone') {
    clearLightboxPhotoMask();
    return;
  }

  let content = domRefs.lightboxContent;
  let info = domRefs.lightboxInfo;
  let lb = domRefs.lightbox;
  if (!content || !info || !lb) return;

  let isDescActive = content.classList.contains('desc-open') || isDescCollapsing;
  let isZoomed = lb.classList.contains('zoom-active');

  let imgEl = getActivePhotoImg();
  if (!imgEl || !isDescActive || isZoomed) {
    clearLightboxPhotoMask();
    return;
  }

  let photoRect = imgEl.getBoundingClientRect();
  let infoRect = info.getBoundingClientRect();

  if (photoRect.height <= 0) {
    imgEl.classList.remove('expanded');
    imgEl.style.removeProperty('--overlap');
    return;
  }

  let desc = domRefs.lightboxDesc;
  let clampedHeight = desc?.dataset.clampedHeight
    ? parseFloat(desc.dataset.clampedHeight)
    : 60;
  let currentDescHeight = desc?.clientHeight || 0;
  let expansionRatio = isDescCollapsing
    ? Math.min(1, Math.max(0, (currentDescHeight - clampedHeight) / 30))
    : 1;

  // Borderline clearance: covers even if text doesn't strictly pass the photo
  // but comes close enough to feel cramped (within ~70px of photo bottom).
  const BORDERLINE_BUFFER = 70;
  let effectiveBuffer = BORDERLINE_BUFFER * expansionRatio;
  let rawOverlap = photoRect.bottom - infoRect.top + effectiveBuffer;

  // if text is well below the photo (outside borderline proximity), keep photo unmasked
  if (rawOverlap <= 0) {
    imgEl.classList.remove('expanded');
    imgEl.style.removeProperty('--overlap');
    return;
  }

  // Smoothly ramp lead-in so the mask doesn't jump abruptly on boundary crossing
  const maxLead = 20;
  const blendRange = 65;
  const progress = Math.min(1, rawOverlap / blendRange);
  // Smoothstep easing for silky continuous ramp
  const easeProgress = progress * progress * (3 - 2 * progress);
  const currentLead = maxLead * easeProgress;

  let overlap = Math.min(rawOverlap + currentLead, photoRect.height);
  let fadePx = Math.round(overlap);

  imgEl.style.setProperty('--overlap', `${fadePx}px`);
  imgEl.classList.add('expanded');
}

export function animatePhotoMaskTransition(duration = 340) {
  if (photoMaskRafId !== null) {
    cancelAnimationFrame(photoMaskRafId);
    photoMaskRafId = null;
  }
  const startTime = performance.now();
  function step(now: number) {
    updateLightboxPhotoMask();
    if (now - startTime < duration) {
      photoMaskRafId = requestAnimationFrame(step);
    } else {
      photoMaskRafId = null;
      updateLightboxPhotoMask();
    }
  }
  photoMaskRafId = requestAnimationFrame(step);
}

export function collapseLightboxDesc(animated: boolean = true) {
  let content = domRefs.lightboxContent;
  let btn = domRefs.lightboxDescToggle;
  let desc = domRefs.lightboxDesc;
  if (!content || !desc || (!content.classList.contains('desc-open') && !isDescCollapsing)) return;

  if (descCrossfadeTimer !== null) {
    clearTimeout(descCrossfadeTimer);
    descCrossfadeTimer = null;
  }

  isDescCollapsing = true;
  content.classList.remove('desc-open');
  desc.classList.remove('desc-expanded');
  if (btn) {
    btn.textContent = getDescToggleLabel(false);
    btn.setAttribute('aria-expanded', 'false');
  }

  if (getLightboxLayout() === 'phone') {
    showFilmstripIfReady();
  }

  const fullHtml = desc.dataset.fullDesc || desc.innerHTML;
  const clampedHtml = desc.dataset.clampedDesc || fullHtml;

  if (!animated || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !clampedHtml || clampedHtml === fullHtml) {
    isDescCollapsing = false;
    desc.style.transition = 'none';
    desc.style.maxHeight = '';
    if (clampedHtml) {
      desc.innerHTML = clampedHtml;
    }
    clearLightboxPhotoMask();
    return;
  }

  const currentHeight = desc.clientHeight;
  const targetHeight = desc.dataset.clampedHeight
    ? parseFloat(desc.dataset.clampedHeight)
    : 0;

  const { layerFull, layerClamped } = setupDescCrossfade(desc, fullHtml, clampedHtml, 'collapse');

  desc.style.transition = 'none';
  if (currentHeight > 0) {
    desc.style.maxHeight = `${currentHeight}px`;
    void desc.offsetHeight;
  }
  desc.style.transition = 'max-height 0.32s cubic-bezier(0.22, 1, 0.36, 1)';
  desc.style.maxHeight = targetHeight > 0 ? `${targetHeight}px` : '';

  // Trigger text crossfade into ellipses as the container approaches the clamp zone
  descCrossfadeTimer = setTimeout(() => {
    if (!content.classList.contains('desc-open')) {
      layerFull.style.opacity = '0';
      layerClamped.style.opacity = '1';
    }
  }, 120);

  let finalized = false;
  const finalizeCollapse = () => {
    if (finalized) return;
    finalized = true;
    if (descCrossfadeTimer !== null) {
      clearTimeout(descCrossfadeTimer);
      descCrossfadeTimer = null;
    }
    isDescCollapsing = false;
    desc.removeEventListener('transitionend', onCollapseEnd);
    if (!content.classList.contains('desc-open')) {
      desc.style.transition = 'none';
      if (desc.dataset.clampedDesc) {
        desc.innerHTML = desc.dataset.clampedDesc;
      }
      desc.style.maxHeight = '';
      void desc.offsetHeight;
      desc.style.transition = '';
      clearLightboxPhotoMask();
    }
  };

  const onCollapseEnd = (e: TransitionEvent) => {
    if (e.propertyName === 'max-height' && !content.classList.contains('desc-open')) {
      finalizeCollapse();
    }
  };
  desc.addEventListener('transitionend', onCollapseEnd);
  setTimeout(finalizeCollapse, 340);

  animatePhotoMaskTransition(340);
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
  if (!opening) {
    collapseLightboxDesc(true);
    return;
  }

  if (descCrossfadeTimer !== null) {
    clearTimeout(descCrossfadeTimer);
    descCrossfadeTimer = null;
  }

  isDescCollapsing = false;
  content.classList.add('desc-open');
  btn.textContent = getDescToggleLabel(true);
  btn.setAttribute('aria-expanded', 'true');
  desc.classList.add('desc-expanded');

  const startH = desc.clientHeight;
  const fullHtml = desc.dataset.fullDesc || desc.innerHTML;
  const clampedHtml = desc.dataset.clampedDesc || fullHtml;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !clampedHtml || clampedHtml === fullHtml) {
    desc.style.transition = 'none';
    desc.innerHTML = fullHtml;
    desc.style.maxHeight = `${desc.scrollHeight}px`;
    updateLightboxPhotoMask();
  } else {
    const { layerFull, layerClamped } = setupDescCrossfade(desc, fullHtml, clampedHtml, 'expand');

    desc.style.transition = 'none';
    if (startH > 0) {
      desc.style.maxHeight = `${startH}px`;
      void desc.offsetHeight;
    }
    desc.style.transition = 'max-height 0.32s cubic-bezier(0.22, 1, 0.36, 1)';
    desc.style.maxHeight = `${desc.scrollHeight}px`;
    animatePhotoMaskTransition(340);

    requestAnimationFrame(() => {
      layerFull.style.opacity = '1';
      layerClamped.style.opacity = '0';
    });

    descCrossfadeTimer = setTimeout(() => {
      if (content.classList.contains('desc-open')) {
        desc.innerHTML = fullHtml;
      }
    }, 280);
  }

  if (getLightboxLayout() === 'phone') {
    hideFilmstripIfReady();
  }
}

export function resetDescToggle() {
  cancelDescFlipTransition();
  clearLightboxPhotoMask();
  let content = domRefs.lightboxContent;
  let info = domRefs.lightboxInfo;
  let btn = domRefs.lightboxDescToggle;
  let desc = domRefs.lightboxDesc;
  if (content) content.classList.remove('desc-open');
  if (info) info.classList.remove('desc-open');
  if (btn) {
    btn.textContent = getDescToggleLabel(false);
    btn.setAttribute('aria-expanded', 'false');
  }
  if (desc) {
    desc.style.maxHeight = '';
    desc.style.clipPath = '';
    desc.style.transition = '';
    desc.classList.remove('desc-expanded');
    if (desc.dataset.clampedDesc) {
      desc.innerHTML = desc.dataset.clampedDesc;
    }
  }
}

function handleLightboxLayoutResize() {
  updateLightboxLayout();
  if (!domRefs.lightbox?.classList.contains('open')) return;
  if (isStackedLayout()) {
    updateLightboxDescPreview();
    updateMobileImgWrapHeight(true);
    updateLightboxPhotoMask();
  } else {
    updateMobileImgWrapHeight();
    clearLightboxPhotoMask();
    let desc = domRefs.lightboxDesc;
    if (desc && desc.dataset.fullDesc) {
      desc.innerHTML = desc.dataset.fullDesc;
    }
    let btn = domRefs.lightboxDescToggle;
    if (btn) {
      btn.classList.add('no-desc');
    }
  }
}

window.addEventListener('resize', handleLightboxLayoutResize, { passive: true });
window.addEventListener('orientationchange', handleLightboxLayoutResize, { passive: true });

if (typeof window !== 'undefined' && window.visualViewport) {
  window.visualViewport.addEventListener('resize', handleLightboxLayoutResize, { passive: true });
}

if (typeof document !== 'undefined' && 'fonts' in document) {
  document.fonts.ready.then(handleLightboxLayoutResize);
  document.fonts.addEventListener?.('loadingdone', handleLightboxLayoutResize);
}

