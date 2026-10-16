import { domRefs } from './dom.js';
import { getPhotoAspectRatio, saveRatioToCache } from './utils.js';
import { cacheImage, getImageCacheEntry, isLbSrcUrl, lightboxSrc, markLbSrcFailed } from './lightbox-cache.js';
import { getVideoPlayerMarkup } from './motion-markup.js';
import { Photo, Video } from '../types.js';
import { updateMobileImgWrapHeight } from './lightbox/renderer.js';
import { loadVideoPlayer } from './video-player-loader.js';
import { clearSwapOverlay, crossfadeToFull } from './lightbox-swap.js';
import { getLightboxLayout } from './lightbox/layout.js';

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

// Redo this photo against the original after its 1600px tier failed to load. False when `usedSrc`
// was not the lb tier (nothing different to try), so a broken original reaches the normal error.
function retryWithOriginal(p: Photo, usedSrc: string) {
  if (!isLbSrcUrl(p, usedSrc)) return false;
  markLbSrcFailed(p.lbSrc);
  prepareLightboxPhoto(p);
  return true;
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
    let r = ratio;
    if (cached.img.naturalWidth && cached.img.naturalHeight) {
      r = cached.img.naturalWidth / cached.img.naturalHeight;
    }
    wrap.style.setProperty('--lightbox-photo-ratio', String(r));
    img.src = fullSrc;
    img.style.filter = '';
    const commitCacheHit = () => {
      if (token !== photoPlaceholderToken) return;
      img.style.opacity = '1';
      clearLightboxPhotoPlaceholder(token);
      updateMobileImgWrapHeight();
    };
    if (img.decode) {
      img.decode().then(commitCacheHit).catch(commitCacheHit);
    } else {
      commitCacheHit();
    }
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
        if (thumbImg.naturalWidth && thumbImg.naturalHeight) {
          wrap.style.setProperty('--lightbox-photo-ratio', String(thumbImg.naturalWidth / thumbImg.naturalHeight));
        }
        img.src = previewSrc;
        thumbShown = true;
        const commitThumb = () => {
          if (token !== photoPlaceholderToken) return;
          wrap.classList.remove('photo-placeholder-visible');
          img.style.opacity = '1';
          updateMobileImgWrapHeight();
        };
        if (img.decode) {
          img.decode().then(commitThumb).catch(commitThumb);
        } else {
          commitThumb();
        }
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
        if (retryWithOriginal(p, fullSrc)) return;
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
            if (retryWithOriginal(p, fullSrc)) return;
            showLightboxPhotoError(token);
          };
        }
      }
    }).catch(() => {
      if (token !== photoPlaceholderToken) return;
      if (retryWithOriginal(p, fullSrc)) return;
      img.src = fullSrc;
      img.onload = function () {
        if (token !== photoPlaceholderToken) return;
        clearLightboxPhotoPlaceholder(token);
        img.style.opacity = '1';
        updateMobileImgWrapHeight();
      };
      img.onerror = function () {
        if (token !== photoPlaceholderToken) return;
        if (retryWithOriginal(p, fullSrc)) return;
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
      if (retryWithOriginal(p, fullSrc)) return;
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
  if (shell.style.opacity !== '0') {
    shell.style.opacity = '1';
  }
  shell.style.display = 'block'; // Ensure it's not hidden
  updateMobileImgWrapHeight();

  // Play/pause gesture handling (desktop only; mobile/tablet tap toggles controls)
  const container = shell.querySelector('media-container') as HTMLElement | null;
  if (container) {
    container.addEventListener('click', (e: MouseEvent) => {
      const isTouchOrTablet = window.matchMedia('(hover: none)').matches || getLightboxLayout() !== 'desktop';
      if (isTouchOrTablet) {
        return;
      }

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

let swipeInitialVolume = 1;
let restoreVolumeRafId: number | null = null;
let motionFadeRafId: number | null = null;

export function initMotionSwipeVolume() {
  if (restoreVolumeRafId !== null) {
    cancelAnimationFrame(restoreVolumeRafId);
    restoreVolumeRafId = null;
  }
  const shell = domRefs.motionPlayerShell;
  const video = shell ? (shell.querySelector('video') as HTMLVideoElement | null) : null;
  if (video && !video.paused && !video.muted) {
    swipeInitialVolume = video.volume > 0 ? video.volume : 1;
  } else {
    swipeInitialVolume = 0;
  }
}

export function updateMotionSwipeVolume(dy: number, maxDist = 300) {
  if (swipeInitialVolume <= 0) return;
  const shell = domRefs.motionPlayerShell;
  const video = shell ? (shell.querySelector('video') as HTMLVideoElement | null) : null;
  if (!video || video.paused) return;

  const progress = Math.min(1, Math.max(0, dy / maxDist));
  const newVol = Math.max(0, swipeInitialVolume * (1 - progress));
  try {
    video.volume = newVol;
  } catch (_) {}
}

export function restoreMotionSwipeVolume(durationMs = 200) {
  if (swipeInitialVolume <= 0) return;
  const shell = domRefs.motionPlayerShell;
  const video = shell ? (shell.querySelector('video') as HTMLVideoElement | null) : null;
  if (!video || video.paused) return;

  if (restoreVolumeRafId !== null) {
    cancelAnimationFrame(restoreVolumeRafId);
    restoreVolumeRafId = null;
  }

  const currentVolume = video.volume;
  const targetVolume = swipeInitialVolume;
  if (currentVolume >= targetVolume) return;

  const startTime = performance.now();
  const tick = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    try {
      video.volume = Math.min(targetVolume, currentVolume + (targetVolume - currentVolume) * progress);
    } catch (_) {}

    if (progress < 1 && !video.paused) {
      restoreVolumeRafId = requestAnimationFrame(tick);
    } else {
      restoreVolumeRafId = null;
    }
  };
  restoreVolumeRafId = requestAnimationFrame(tick);
}

export function killMotionPlayer() {
  if (restoreVolumeRafId !== null) {
    cancelAnimationFrame(restoreVolumeRafId);
    restoreVolumeRafId = null;
  }
  if (motionFadeRafId !== null) {
    cancelAnimationFrame(motionFadeRafId);
    motionFadeRafId = null;
  }
  swipeInitialVolume = 1;

  const shell = domRefs.motionPlayerShell;
  if (!shell) return;
  const video = shell.querySelector('video') as HTMLVideoElement | null;
  if (video) {
    try {
      video.muted = true;
      video.volume = 0;
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (_) {}
  }
  shell.innerHTML = '';
}

export function fadeOutMotionVideo(durationMs = 300): Promise<void> {
  return new Promise((resolve) => {
    if (restoreVolumeRafId !== null) {
      cancelAnimationFrame(restoreVolumeRafId);
      restoreVolumeRafId = null;
    }
    if (motionFadeRafId !== null) {
      cancelAnimationFrame(motionFadeRafId);
      motionFadeRafId = null;
    }

    const shell = domRefs.motionPlayerShell;
    const video = shell ? (shell.querySelector('video') as HTMLVideoElement | null) : null;

    if (!video || video.paused || video.muted || video.volume <= 0) {
      if (video && !video.paused) {
        try {
          video.muted = true;
          video.pause();
        } catch (_) {}
      }
      resolve();
      return;
    }

    const startVolume = video.volume;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      try {
        video.volume = Math.max(0, startVolume * (1 - progress));
      } catch (_) {}

      if (progress < 1 && !video.paused) {
        motionFadeRafId = requestAnimationFrame(tick);
      } else {
        motionFadeRafId = null;
        try {
          video.muted = true;
          video.volume = 0;
          video.pause();
        } catch (_) {}
        resolve();
      }
    };

    motionFadeRafId = requestAnimationFrame(tick);
  });
}

export function fadeOutAndKillMotionVideo(durationMs = 300): Promise<void> {
  const shell = domRefs.motionPlayerShell;
  const video = shell ? (shell.querySelector('video') as HTMLVideoElement | null) : null;
  const isPlaying = !!(video && !video.paused && !video.muted && video.volume > 0);

  if (!isPlaying) {
    killMotionPlayer();
    return Promise.resolve();
  }

  return fadeOutMotionVideo(durationMs).then(() => {
    killMotionPlayer();
  });
}
