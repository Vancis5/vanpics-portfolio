import { domRefs } from './dom.js';
import { getPhotoAspectRatio, saveRatioToCache } from './utils.js';
import { cacheImage, getImageCacheEntry } from './lightbox-cache.js';
import { getVideoPlayerMarkup } from './motion-markup.js';
import { Photo, Video } from '../types.js';

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
  wrap.classList.remove('photo-error');
  wrap.classList.add('photo-loaded');
  if (img) img.removeAttribute('data-loading-photo');
  if (img) img.style.opacity = '1';
  if (domRefs.lightboxPhotoError) domRefs.lightboxPhotoError.textContent = '';
  clearTimeout(photoPlaceholderTimer);
  photoPlaceholderTimer = setTimeout(function () {
    wrap.classList.remove('photo-loading', 'photo-placeholder-visible', 'photo-loaded');
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
  let token = ++photoPlaceholderToken;
  clearTimeout(photoPlaceholderTimer);
  wrap.style.setProperty('--lightbox-photo-ratio', String(ratio));
  img.alt = p.title || '';
  img.removeAttribute('title');
  if (domRefs.lightboxPhotoError) domRefs.lightboxPhotoError.textContent = '';

  // ── Cache hit: image already decoded, swap instantly with no placeholder ──
  const cached = getImageCacheEntry(p.src);
  if (cached && cached.decoded) {
    wrap.classList.remove('photo-loading', 'photo-placeholder-visible', 'photo-loaded', 'photo-error');
    img.removeAttribute('data-loading-photo');
    img.style.opacity = '0';
    img.src = p.src;
    if (cached.img.naturalWidth && cached.img.naturalHeight) {
      let r = cached.img.naturalWidth / cached.img.naturalHeight;
      wrap.style.setProperty('--lightbox-photo-ratio', String(r));
    }
    setTimeout(() => {
      if (token !== photoPlaceholderToken) return;
      img.style.opacity = '1';
    }, 20);
    return;
  }

  // ── Cache miss: show placeholder while loading ──
  let previewSrc = p.thumb || (p.src ? p.src.replace('photos/', 'photos/thumbs/') : '');
  wrap.classList.remove('photo-placeholder-visible', 'photo-loaded', 'photo-error');
  wrap.classList.add('photo-loading');
  if (previewSrc) {
    img.removeAttribute('data-loading-photo');
    img.style.opacity = '0';
    img.src = previewSrc;
    setTimeout(() => {
      if (token !== photoPlaceholderToken) return;
      img.style.opacity = '1';
    }, 20);
  } else {
    wrap.classList.add('photo-placeholder-visible');
    img.dataset.loadingPhoto = 'true';
  }

  // Load and decode the image entirely off-DOM in the background cache.
  // This prevents the DOM injection from stalling the CSS entrance animations.
  let cacheEntry = cacheImage(p.src);

  if (cacheEntry && cacheEntry.decodePromise) {
    cacheEntry.decodePromise.then(() => {
      if (token !== photoPlaceholderToken) return;
      
      if (cacheEntry.img.naturalWidth && cacheEntry.img.naturalHeight) {
        let r = cacheEntry.img.naturalWidth / cacheEntry.img.naturalHeight;
        wrap.style.setProperty('--lightbox-photo-ratio', String(r));
      }

      // Swap immediately at full opacity to prevent double-fading/flickering
      img.src = p.src;
      clearLightboxPhotoPlaceholder(token);
      img.style.opacity = '1';
    });
  } else {
    // Fallback just in case
    img.src = p.src;
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
  let ratio = p.aspectRatio || (16 / 9);
  shell.style.aspectRatio = String(ratio);
  
  // Set custom properties for responsive width & info-clamp sizing
  let wrap = domRefs.lightboxImgWrap;
  if (wrap) {
    wrap.style.setProperty('--lightbox-photo-ratio', String(ratio));
  }
  if (domRefs.lightboxContent) {
    domRefs.lightboxContent.style.setProperty('--lightbox-photo-ratio', String(ratio));
  }

  // Clear inline width override to let CSS handle it
  shell.style.width = '';
  
  shell.innerHTML = getVideoPlayerMarkup(p);
  shell.style.opacity = '1';
  shell.style.display = 'block'; // Ensure it's not hidden

  // Double-tap/double-click gesture for fullscreen
  const container = shell.querySelector('media-container') as HTMLElement | null;
  if (container) {
    let lastTap = 0;
    
    // Desktop double-click
    container.addEventListener('dblclick', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('media-controls') || target.closest('.motion-start-button')) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      
      const videoPlayer = container.closest('video-player') || container;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        if (videoPlayer && videoPlayer.requestFullscreen) {
          videoPlayer.requestFullscreen().catch(() => {});
        } else {
          container.requestFullscreen().catch(() => {});
        }
      }
    });

    // Mobile double-tap
    container.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('media-controls') || target.closest('.motion-start-button')) {
        return;
      }
      
      const now = Date.now();
      if (now - lastTap < 300) {
        e.preventDefault();
        e.stopPropagation();
        
        const videoPlayer = container.closest('video-player') || container;
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          if (videoPlayer && videoPlayer.requestFullscreen) {
            videoPlayer.requestFullscreen().catch(() => {});
          } else {
            container.requestFullscreen().catch(() => {});
          }
        }
        lastTap = 0;
      } else {
        lastTap = now;
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
