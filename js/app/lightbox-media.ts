import { domRefs } from './dom.js';
import { getPhotoAspectRatio, saveRatioToCache } from './utils.js';
import { cacheImage, getImageCacheEntry } from './lightbox-cache.js';
import { getVideoPlayerMarkup } from './motion-markup.js';
import { Photo, Video } from '../types.js';
import { updateMobileImgWrapHeight } from './lightbox/renderer.js';

let photoPlaceholderTimer: any = null;
let photoPlaceholderToken = 0;

export function getPhotoPlaceholderToken() {
  return photoPlaceholderToken;
}

export function setPhotoPlaceholderToken(val: number) {
  photoPlaceholderToken = val;
}

export function clearLightboxPhotoPlaceholder(expectedToken?: number) {
  if (expectedToken && expectedToken !== photoPlaceholderToken) return;
  if (!expectedToken) photoPlaceholderToken++;
  let wrap = domRefs.lightboxImgWrap;
  let img = domRefs.lightboxImg;
  if (!wrap) return;
  wrap.classList.remove('photo-error', 'photo-placeholder-visible');
  wrap.classList.add('photo-loaded');
  if (img) img.removeAttribute('data-loading-photo');
  if (img) img.style.opacity = '1';
  if (domRefs.lightboxPhotoError) domRefs.lightboxPhotoError.textContent = '';
  clearTimeout(photoPlaceholderTimer);
  photoPlaceholderTimer = setTimeout(function () {
    wrap.classList.remove('photo-loading', 'photo-loaded');
  }, 260);
}

export function showLightboxPhotoError(expectedToken?: number) {
  if (expectedToken !== photoPlaceholderToken) return;
  let wrap = domRefs.lightboxImgWrap;
  let img = domRefs.lightboxImg;
  if (!wrap) return;
  wrap.classList.remove('photo-loaded');
  wrap.classList.add('photo-loading', 'photo-placeholder-visible', 'photo-error');
  if (img) img.removeAttribute('data-loading-photo');
  if (domRefs.lightboxPhotoError) domRefs.lightboxPhotoError.textContent = 'image failed to load';
}

export function prepareLightboxPhoto(p: Photo) {
  let img = domRefs.lightboxImg;
  let wrap = domRefs.lightboxImgWrap;
  if (!img || !wrap || !p) return;

  wrap.querySelectorAll('.lightbox-hires-layer').forEach(el => el.remove());

  let ratio = getPhotoAspectRatio(p);
  let token = ++photoPlaceholderToken;
  clearTimeout(photoPlaceholderTimer);
  wrap.style.setProperty('--lightbox-photo-ratio', String(ratio));
  img.alt = p.title || '';
  img.removeAttribute('title');
  if (domRefs.lightboxPhotoError) domRefs.lightboxPhotoError.textContent = '';

  // ── Cache hit: image already decoded, swap instantly with no placeholder ──
  const cached = getImageCacheEntry(p.src);
  if (cached && (cached.decoded || (cached.img && cached.img.complete && cached.img.naturalWidth > 0))) {
    wrap.classList.remove('photo-loading', 'photo-placeholder-visible', 'photo-error');
    wrap.classList.add('photo-loaded');
    img.removeAttribute('data-loading-photo');
    img.src = p.src;
    img.style.opacity = '1';
    img.style.filter = '';
    if (cached.img.naturalWidth && cached.img.naturalHeight) {
      let r = cached.img.naturalWidth / cached.img.naturalHeight;
      wrap.style.setProperty('--lightbox-photo-ratio', String(r));
    }
    clearLightboxPhotoPlaceholder(token);
    updateMobileImgWrapHeight();
    return;
  }

  // ── Cache miss: show preview immediately without blank gap ──
  let previewSrc = p.thumb || (p.src ? p.src.replace('photos/', 'photos/thumbs/') : '');
  wrap.classList.remove('photo-loaded', 'photo-error');
  wrap.classList.add('photo-loading', 'photo-placeholder-visible');
  img.removeAttribute('data-loading-photo');

  if (previewSrc) {
    img.src = previewSrc;
    img.style.opacity = '1';
    img.style.filter = 'blur(4px)';
    updateMobileImgWrapHeight();
  } else {
    img.style.opacity = '0';
    img.dataset.loadingPhoto = 'true';
  }

  function promoteHiRes(calcRatio?: number) {
    if (token !== photoPlaceholderToken) return;
    if (calcRatio) wrap.style.setProperty('--lightbox-photo-ratio', String(calcRatio));

    const hiRes = document.createElement('img');
    hiRes.className = 'lightbox-hires-layer';
    hiRes.crossOrigin = 'anonymous';
    hiRes.alt = p.title || '';
    hiRes.draggable = false;
    hiRes.src = p.src;
    hiRes.style.position = 'absolute';
    hiRes.style.inset = '0';
    hiRes.style.width = '100%';
    hiRes.style.height = '100%';
    hiRes.style.objectFit = 'contain';
    hiRes.style.borderRadius = '3px';
    hiRes.style.opacity = '0';
    hiRes.style.transition = 'opacity 0.28s ease';
    hiRes.style.pointerEvents = 'none';
    wrap.appendChild(hiRes);

    requestAnimationFrame(() => {
      if (token !== photoPlaceholderToken) {
        hiRes.remove();
        return;
      }
      hiRes.style.opacity = '1';
      setTimeout(() => {
        if (token !== photoPlaceholderToken) {
          hiRes.remove();
          return;
        }
        img.src = p.src;
        img.style.filter = '';
        hiRes.remove();
        clearLightboxPhotoPlaceholder(token);
        updateMobileImgWrapHeight();
      }, 290);
    });
  }

  // Load and decode the image entirely off-DOM in the background cache
  let cacheEntry = cacheImage(p.src, true);

  if (cacheEntry && cacheEntry.decodePromise) {
    cacheEntry.decodePromise.then(() => {
      if (token !== photoPlaceholderToken) return;
      let r = (cacheEntry.img.naturalWidth && cacheEntry.img.naturalHeight)
        ? (cacheEntry.img.naturalWidth / cacheEntry.img.naturalHeight)
        : undefined;
      promoteHiRes(r);
    }).catch(() => {
      if (token !== photoPlaceholderToken) return;
      const fallbackImg = new Image();
      fallbackImg.crossOrigin = 'anonymous';
      fallbackImg.onload = () => {
        if (token !== photoPlaceholderToken) return;
        let r = (fallbackImg.naturalWidth && fallbackImg.naturalHeight)
          ? (fallbackImg.naturalWidth / fallbackImg.naturalHeight)
          : undefined;
        promoteHiRes(r);
      };
      fallbackImg.onerror = () => {
        if (token !== photoPlaceholderToken) return;
        showLightboxPhotoError(token);
      };
      fallbackImg.src = p.src;
    });
  } else {
    const fallbackImg = new Image();
    fallbackImg.crossOrigin = 'anonymous';
    fallbackImg.onload = () => {
      if (token !== photoPlaceholderToken) return;
      let r = (fallbackImg.naturalWidth && fallbackImg.naturalHeight)
        ? (fallbackImg.naturalWidth / fallbackImg.naturalHeight)
        : undefined;
      promoteHiRes(r);
    };
    fallbackImg.onerror = () => {
      if (token !== photoPlaceholderToken) return;
      showLightboxPhotoError(token);
    };
    fallbackImg.src = p.src;
  }
}

export function renderVideoInLightbox(p: Video) {
  let shell = domRefs.motionPlayerShell;
  if (!shell) return;
  let ratio = p.aspectRatio || (16 / 9);
  shell.style.aspectRatio = String(ratio);
  
  // Set custom properties for responsive width & info-clamp sizing
  let wrap = domRefs.lightboxImgWrap;
  if (wrap) {
    wrap.style.setProperty('--lightbox-photo-ratio', String(ratio));
    wrap.style.filter = 'blur(0px)';
  }
  if (domRefs.lightboxContent) {
    domRefs.lightboxContent.style.setProperty('--lightbox-photo-ratio', String(ratio));
  }

  // Clear inline width override to let CSS handle it
  shell.style.width = '';
  shell.style.filter = 'blur(0px)';
  
  shell.innerHTML = getVideoPlayerMarkup(p);
  shell.style.opacity = '1';
  shell.style.display = 'block'; // Ensure it's not hidden
  updateMobileImgWrapHeight();

  // Play/pause gesture handling
  const container = shell.querySelector('media-container') as HTMLElement | null;
  if (container) {
    container.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('media-controls') || target.closest('.motion-start-button')) {
        return;
      }
      
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
    });
  }
}

export function startUnifiedMotionPlayer(id: string) {
  let prime = document.getElementById(id);
  if (!prime) return;
  let video = prime.querySelector('video');
  prime.classList.add('is-started');
  if (video) video.play().catch(function () { });
}

export function pauseMotionVideo() {
  let shell = domRefs.motionPlayerShell;
  if (!shell) return;
  let video = shell.querySelector('video') as HTMLVideoElement | null;
  if (video && !video.paused) {
    video.pause();
  }
}
