import { domRefs } from './dom.js';
import { getPhotoAspectRatio, saveRatioToCache } from './utils.js';
import { cacheImage, getImageCacheEntry, lightboxSrc } from './lightbox-cache.js';
import { getVideoPlayerMarkup } from './motion-markup.js';
import { Photo, Video } from '../types.js';
import { updateMobileImgWrapHeight } from './lightbox/renderer.js';
import { loadVideoPlayer } from './video-player-loader.js';
import { clearSwapOverlay, crossfadeToFull } from './lightbox-swap.js';

let photoPlaceholderTimer: any = null;
let photoPlaceholderToken = 0;

export function getPhotoPlaceholderToken() {
  return photoPlaceholderToken;
}

export function setPhotoPlaceholderToken(val: number) {
  photoPlaceholderToken = val;
}

export function clearLightboxPhotoPlaceholder(expectedToken?: number) {
  if (expectedToken !== undefined && expectedToken !== photoPlaceholderToken) return;
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

  let ratio = getPhotoAspectRatio(p);
  const fullSrc = lightboxSrc(p);
  let token = ++photoPlaceholderToken;
  clearTimeout(photoPlaceholderTimer);
  clearSwapOverlay(wrap);
  wrap.style.setProperty('--lightbox-photo-ratio', String(ratio));
  img.alt = p.title || '';
  img.removeAttribute('title');
  if (domRefs.lightboxPhotoError) domRefs.lightboxPhotoError.textContent = '';

  // ── Cache hit: image already decoded, swap instantly with no placeholder ──
  const cached = getImageCacheEntry(fullSrc);
  if (cached && (cached.decoded || (cached.img && cached.img.complete && cached.img.naturalWidth > 0))) {
    wrap.classList.remove('photo-loading', 'photo-placeholder-visible', 'photo-error');
    wrap.classList.add('photo-loaded');
    img.removeAttribute('data-loading-photo');
    img.src = fullSrc;
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

  // ── Cache miss: show placeholder while loading ──
  let previewSrc = p.thumb || (p.src ? p.src.replace('photos/', 'photos/thumbs/') : '');
  let thumbShown = false;
  wrap.classList.remove('photo-loaded', 'photo-error');
  wrap.classList.add('photo-loading', 'photo-placeholder-visible');
  img.removeAttribute('data-loading-photo');
  img.style.opacity = '0';
  img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E';

  if (previewSrc) {
    const thumbImg = new Image();
    thumbImg.crossOrigin = 'anonymous';
    thumbImg.onload = function () {
      if (token !== photoPlaceholderToken) return;
      if (wrap.classList.contains('photo-loading') && !wrap.classList.contains('photo-loaded')) {
        img.src = previewSrc;
        thumbShown = true;
        wrap.classList.remove('photo-placeholder-visible');
        img.style.opacity = '1';
        updateMobileImgWrapHeight();
      }
    };
    thumbImg.src = previewSrc;
    if (thumbImg.complete && thumbImg.naturalWidth > 0) {
      thumbImg.onload(new Event('load'));
    }
  } else {
    img.dataset.loadingPhoto = 'true';
  }

  // Load and decode the image entirely off-DOM in the background cache.
  // This prevents the DOM injection from stalling the CSS entrance animations.
  let cacheEntry = cacheImage(fullSrc, true);

  if (cacheEntry && cacheEntry.decodePromise) {
    cacheEntry.decodePromise.then(() => {
      if (token !== photoPlaceholderToken) return;

      if (cacheEntry.img.naturalWidth && cacheEntry.img.naturalHeight) {
        let r = cacheEntry.img.naturalWidth / cacheEntry.img.naturalHeight;
        // Everything that changes the wrap's box (ratio var, dropping .photo-loading) must happen
        // together with the real <img> getting the full photo, never while it still holds the thumb.
        const finishFull = function () {
          wrap.style.setProperty('--lightbox-photo-ratio', String(r));
          clearLightboxPhotoPlaceholder(token);
          img.style.opacity = '1';
          updateMobileImgWrapHeight();
        };
        // Thumb is on screen: fade the full photo in over it instead of hard-cutting the src.
        const fading = thumbShown && crossfadeToFull(
          wrap, img, fullSrc,
          function () { return token === photoPlaceholderToken; },
          finishFull
        );
        if (!fading) {
          img.src = fullSrc;
          finishFull();
        }
      } else {
        img.src = fullSrc;
        if (img.complete && img.naturalWidth > 0) {
          clearLightboxPhotoPlaceholder(token);
          img.style.opacity = '1';
          updateMobileImgWrapHeight();
        } else {
          img.onload = function () {
            if (token !== photoPlaceholderToken) return;
            clearLightboxPhotoPlaceholder(token);
            img.style.opacity = '1';
            updateMobileImgWrapHeight();
          };
          img.onerror = function () {
            if (token !== photoPlaceholderToken) return;
            showLightboxPhotoError(token);
          };
        }
      }
    }).catch(() => {
      if (token !== photoPlaceholderToken) return;
      img.src = fullSrc;
      img.onload = function () {
        if (token !== photoPlaceholderToken) return;
        clearLightboxPhotoPlaceholder(token);
        img.style.opacity = '1';
        updateMobileImgWrapHeight();
      };
      img.onerror = function () {
        if (token !== photoPlaceholderToken) return;
        showLightboxPhotoError(token);
      };
    });
  } else {
    img.src = fullSrc;
    img.onload = function () {
      if (token !== photoPlaceholderToken) return;
      const handleFallbackDecode = () => {
        if (img.naturalWidth && img.naturalHeight) {
          let r = img.naturalWidth / img.naturalHeight;
          wrap.style.setProperty('--lightbox-photo-ratio', String(r));
          saveRatioToCache(p.src, img.naturalWidth, img.naturalHeight);
        }
        clearLightboxPhotoPlaceholder(token);
        img.style.opacity = '1';
        updateMobileImgWrapHeight();
      };
      if (img.decode) {
        img.decode().then(handleFallbackDecode).catch(handleFallbackDecode);
      } else {
        handleFallbackDecode();
      }
    };
    img.onerror = function () {
      if (token !== photoPlaceholderToken) return;
      showLightboxPhotoError(token);
    };
  }
}

export function renderVideoInLightbox(p: Video) {
  let shell = domRefs.motionPlayerShell;
  if (!shell) return;
  void loadVideoPlayer();
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
