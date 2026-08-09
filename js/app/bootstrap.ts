import { APP_CONFIG } from './config.js';
import { domRefs } from './dom.js';
import { state, updateActivePhotos } from './state.js';
import { getInternalCategory, motionProjects, updateMediaLibrary } from './media-data.js';
import { slugify, pruneRatioCache } from './utils.js';
import { closeLightbox, initBlurRenderer, openLightbox, startUnifiedMotionPlayer, toggleLightboxDesc } from './lightbox.js';
import { buildMasonry, initFilters, rebuildGallery, getMasonryColumnCount } from './gallery.js';
import { buildCarousel, recalculateCarouselLayout, setCarouselReadyCallback, tick, triggerExposurePulse } from './hero-carousel.js';
import { animateGlow, setStartLoopsCallback } from './core.js';
import { updateStickyHeaderSurface } from './sticky-header.js';
import { initLightboxMouseNav } from './lightbox-nav.js';
import type { Photo, Video } from '../types.js';

const MEDIA_CACHE_KEY = 'vanpics_media_cache_v1';

// buildCarousel internally waits for images, then calls onReady
// we hook into that by wrapping the final reveal
const LOADER_CONFIG = APP_CONFIG.loader;
const ROUTING_CONFIG = APP_CONFIG.routing;
const MASONRY_CONFIG = APP_CONFIG.masonry;

function liftLoader() {
  const loader = domRefs.loader;
  if (loader) {
    loader.classList.remove('visible');
    loader.classList.add('lifting');
  }
  triggerExposurePulse();
  setTimeout(function () { if (loader) loader.style.display = 'none'; }, LOADER_CONFIG.liftDuration);
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(initBlurRenderer);
  } else {
    setTimeout(initBlurRenderer, 1500);
  }
}

// Lift loader via direct callback — no MutationObserver (flaky in Firefox)
let _loaderLifted = false;
function safeLift() { if (!_loaderLifted) { _loaderLifted = true; liftLoader(); } }
// Hard fallback: lift after 4s no matter what
setTimeout(safeLift, LOADER_CONFIG.hardFallbackDelay);
setCarouselReadyCallback(function () { setTimeout(safeLift, LOADER_CONFIG.carouselReadyDelay); });

function scrollToGallery() {
  const lenis = (window as any).lenis;
  if (lenis) {
    lenis.scrollTo('#gallery-section');
  } else {
    domRefs.gallerySection.scrollIntoView({ behavior: 'smooth' });
  }
}

function bindStaticUiHandlers() {
  if (domRefs.scrollHint) domRefs.scrollHint.addEventListener('click', scrollToGallery);
  if (domRefs.lightboxClose) domRefs.lightboxClose.addEventListener('click', closeLightbox);
  initLightboxMouseNav();

  document.addEventListener('click', function (e) {
    const target = e.target as HTMLElement;
    if (!target) return;
    const descButton = target.closest('#lightbox-desc-toggle');
    if (descButton) {
      toggleLightboxDesc();
      return;
    }

    const startButton = target.closest('.motion-start-button[data-player-id]') as HTMLElement;
    if (!startButton) return;
    const playerId = startButton.dataset.playerId;
    if (playerId) startUnifiedMotionPlayer(playerId);
  });
}

function initScrollHintDismiss() {
  if (!domRefs.scrollHint) return;

  function onScroll() {
    if (!domRefs.scrollHint) return;
    const heroHeight = domRefs.hero ? domRefs.hero.offsetHeight : window.innerHeight;
    if (window.scrollY >= heroHeight * 0.5) {
      domRefs.scrollHint.classList.add('faded-out');
      window.removeEventListener('scroll', onScroll);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

bindStaticUiHandlers();
initScrollHintDismiss();

updateStickyHeaderSurface();
window.addEventListener('resize', updateStickyHeaderSurface, { passive: true });
window.addEventListener('orientationchange', updateStickyHeaderSurface, { passive: true });

// Rebuild masonry on resize to handle column count changes (width-only check to avoid mobile address bar flicker)
let _masonryResizeTimer: any;
let _lastMasonryWidth = window.innerWidth;
let _lastColumnCount = getMasonryColumnCount();
window.addEventListener('resize', function () {
  if (window.innerWidth === _lastMasonryWidth) return;
  _lastMasonryWidth = window.innerWidth;

  clearTimeout(_masonryResizeTimer);
  _masonryResizeTimer = setTimeout(function () {
    const oldIsMobile = state.isMobile;
    state.isMobile = window.matchMedia('(hover: none)').matches;
    if (state.isMobile !== oldIsMobile) {
      buildCarousel(true);
    } else {
      recalculateCarouselLayout();
    }

    const newColumnCount = getMasonryColumnCount();
    if (newColumnCount !== _lastColumnCount) {
      _lastColumnCount = newColumnCount;
      buildMasonry();
    }
  }, MASONRY_CONFIG.resizeDebounce);
});

// Visibility & Animation Loop Management
export function startLoops() {
  if (state.heroVisible && state.pageVisible) {
    if (!state.heroRafId) state.heroRafId = requestAnimationFrame(tick);
    if (!state.glowRafId && typeof animateGlow === 'function') state.glowRafId = requestAnimationFrame(animateGlow);
  }
}

setStartLoopsCallback(startLoops);

const heroObs = new IntersectionObserver(function (entries) {
  state.heroVisible = entries[0].isIntersecting;
  startLoops();
}, { threshold: 0 });
heroObs.observe(domRefs.hero);

document.addEventListener('visibilitychange', function () {
  state.pageVisible = !document.hidden;
  startLoops();
});

// Deep Link Initial Load
let _isInitialDeepLink = true; // true only for the very first checkHash call (from renderUI)

function checkHash() {
  const fullHash = window.location.hash.substring(1);

  const lb = domRefs.lightbox;
  const isLbOpen = lb && lb.classList.contains('open');

  // If no item slug and lightbox is open, close it (User clicked back from item to category)
  if (fullHash.split('/').length < 2 && isLbOpen) {
    closeLightbox();
    return;
  }

  if (!fullHash) {
    _isInitialDeepLink = false;
    return;
  }

  const parts = fullHash.split('/');
  const catSlug = parts[0];
  const itemSlug = parts[1];

  const targetCat = getInternalCategory(catSlug);

  // 1. If we're not in the right category, switch it first
  if (state.currentCategory !== targetCat) {
    rebuildGallery(targetCat);
    // Wait for rebuild, then re-check for the item
    setTimeout(checkHash, ROUTING_CONFIG.galleryRecheckDelay);
    return;
  }

  // 2. If we are in the right category, check for the specific item
  if (itemSlug && itemSlug.trim().length > 0) {
    const items = state.currentCategory === 'motion' ? motionProjects : state.activePhotos;
    if (items.length === 0 && state.currentCategory !== 'motion') {
      setTimeout(checkHash, ROUTING_CONFIG.itemRecheckDelay);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const itemTitleSlug = slugify(items[i].title);
      if (itemTitleSlug && itemTitleSlug === itemSlug) {
        // If already open to this item, do nothing
        if (isLbOpen && state.cur === i) return;

        // Deep link guard: if the user landed directly on this photo URL (e.g. from a
        // share link), there's no history entry beneath it — back would exit the site.
        // Fix: replace the current entry with a clean #cat URL, then push the photo
        // hash back on top so back always lands safely on the category view.
        if (_isInitialDeepLink && itemSlug) {
          history.replaceState(null, '', '#' + catSlug);
          history.pushState(null, '', '#' + catSlug + '/' + itemSlug);
        }
        _isInitialDeepLink = false;

        state.isPopState = true;
        openLightbox(i, 0, state.currentCategory === 'motion');
        setTimeout(function () { state.isPopState = false; }, ROUTING_CONFIG.itemRecheckDelay);
        return;
      }
    }
  }

  _isInitialDeepLink = false;
}

window.addEventListener('popstate', function () {
  state.isPopState = true;
  checkHash();
  setTimeout(function () { state.isPopState = false; }, ROUTING_CONFIG.popstateResetDelay);
});

// ─── HELPERS ───
function processPhotos(raw: any[]) {
  return raw.map((p: any) => ({
    ...p,
    aspectRatio: typeof p.aspect_ratio === 'number' ? p.aspect_ratio : (p.aspect_ratio ? parseFloat(p.aspect_ratio) : undefined),
    heroSlide: p.hero_slide === 1 || p.hero_slide === true,
    rawSrc: p.raw_src || null
  }));
}

function processVideos(raw: any[]) {
  return raw.map((v: any) => ({
    ...v,
    thumb: v.poster || '',
    aspectRatio: typeof v.aspect_ratio === 'number' ? v.aspect_ratio : (v.aspect_ratio ? parseFloat(v.aspect_ratio) : undefined)
  }));
}

function isUntitled(p: any) {
  const t = (p.title || '').toLowerCase().trim();
  return !t || t === 'untitled';
}

function applyCarouselPhotos(photos: Photo[]) {
  state.carouselPhotos = photos.filter((p: Photo) => p.heroSlide === true && !isUntitled(p));
  if (state.carouselPhotos.length === 0) state.carouselPhotos = photos.filter((p: Photo) => !isUntitled(p));
}

function getStartupImageUrls(photos: Photo[]) {
  return Array.from(new Set(
    photos.filter((p: Photo) => p.heroSlide === true && !isUntitled(p)).slice(0, 6).map((p: Photo) => p.thumb || p.src).filter(Boolean)
  ));
}

function decodeImageUrl(url: string, timeoutMs?: number) {
  return new Promise<void>(resolve => {
    if (!url) {
      resolve();
      return;
    }

    const img = new Image();
    let settled = false;
    const done = function () {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, timeoutMs || 1600);

    function finish() {
      if (img.decode) img.decode().then(done).catch(done);
      else done();
    }

    img.onload = finish;
    img.onerror = done;
    img.src = url;

    if (img.complete) finish();
  });
}

async function warmStartupImages(photos: Photo[]) {
  await Promise.all(getStartupImageUrls(photos).map(url => decodeImageUrl(url, 1800)));
}

function updateFooterStats(photos: Photo[], videos: Video[]) {
  const photographs = photos.filter((p: Photo) => p.category !== 'figures' && !isUntitled(p));
  const figures = photos.filter((p: Photo) => p.category === 'figures' && !isUntitled(p));
  const motion = videos ? videos.filter((v: Video) => (!!v.thumb || !!v.src) && !isUntitled(v)) : [];

  let since = '—';
  const years = photos
    .map((p: Photo) => p.date ? new Date(p.date).getFullYear() : NaN)
    .filter((y: number) => !isNaN(y) && y > 1900);
  if (years.length > 0) since = String(Math.min(...years));

  function set(id: string, num: number) {
    const el = document.getElementById(id);
    if (!el) return;
    const numEl = el.querySelector('.stat-num');
    if (numEl) numEl.textContent = num > 0 ? String(num) : '—';
  }

  set('stat-photographs', photographs.length);
  set('stat-figures', figures.length);
  set('stat-motion', motion.length);

  const sinceEl = document.getElementById('stat-since');
  if (sinceEl) {
    const numEl = sinceEl.querySelector('.stat-num');
    if (numEl) numEl.textContent = since;
  }
}

function renderUI(photos: Photo[], videos: Video[]) {
  updateMediaLibrary(photos, videos);
  updateActivePhotos();
  applyCarouselPhotos(photos);
  buildCarousel();
  buildMasonry();
  initFilters();
  updateFooterStats(photos, videos);

  setTimeout(checkHash, ROUTING_CONFIG.galleryRecheckDelay);
}

// ─── CLOUDFLARE R2/D1 DATABASE LOADING ───
// Stale-while-revalidate: renders instantly from localStorage cache on repeat visits,
// always fetches fresh data in background to keep the cache warm.
(async function loadDynamicMedia() {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://vanpics-cms-api.lorzanofrancisevan.workers.dev';

  function updateViewsStat(total: number) {
    const viewsEl = document.getElementById('stat-views');
    if (viewsEl) {
      const numEl = viewsEl.querySelector('.stat-num');
      if (numEl) numEl.textContent = total.toLocaleString();
    }
  }

  // Record atomic view count via Durable Object
  const handleViews = function (res: Response) {
    if (res.ok) {
      res.json().then(function (data: any) {
        if (data && typeof data.total === 'number') {
          updateViewsStat(data.total);
        }
      }).catch(function () {});
    }
  };

  if (!sessionStorage.getItem('pv_tracked')) {
    fetch(`${API_BASE_URL}/api/views?path=${encodeURIComponent(window.location.pathname)}`, {
      method: 'POST',
    })
      .then(function (res) {
        sessionStorage.setItem('pv_tracked', '1');
        handleViews(res);
      })
      .catch(function () {});
  } else {
    fetch(`${API_BASE_URL}/api/views?path=${encodeURIComponent(window.location.pathname)}`)
      .then(handleViews)
      .catch(function () {});
  }


  let renderedFromCache = false;
  let renderedPhotos: any[] = [];
  let renderedVideos: any[] = [];


  // ── 1. Instant render from localStorage cache ──
  try {
    const raw = localStorage.getItem(MEDIA_CACHE_KEY);
    if (raw) {
      const { photos, videos } = JSON.parse(raw);
      if (Array.isArray(photos) && photos.length > 0) {
        renderedPhotos = processPhotos(photos);
        renderedVideos = processVideos(videos || []);
        warmStartupImages(photos).catch(function() {});
        renderUI(photos, videos || []);
        renderedFromCache = true;
        // Carousel readiness lifts the curtain after the first hero thumbnails decode.
      }
    }
  } catch (e) {
    // corrupt cache — fall through to fresh fetch
  }

  // ── 2. Fetch fresh data from R2 (always, to keep cache warm) ──
  let newPhotos = [];
  let newVideos = [];

  try {
    const [photosRes, videosRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/photos?limit=500`),
      fetch(`${API_BASE_URL}/api/videos?limit=500`)
    ]);

    if (photosRes.ok && videosRes.ok) {
      const photosData = await photosRes.json();
      const videosData = await videosRes.json();
      newPhotos = processPhotos(Array.isArray(photosData) ? photosData : photosData.items || []);
      newVideos = processVideos(Array.isArray(videosData) ? videosData : videosData.items || []);

      // Store fresh data to cache for next visit
      try {
        localStorage.setItem(MEDIA_CACHE_KEY, JSON.stringify({ photos: newPhotos, videos: newVideos }));
      } catch (e) { /* quota exceeded — not critical */ }

      // Prune orphaned aspect ratio cache entries
      const allSrcs = [
        ...newPhotos.flatMap((p: Photo) => [p.src, p.thumb].filter((s): s is string => Boolean(s))),
        ...newVideos.flatMap((v: Video) => [v.src, v.thumb].filter((s): s is string => Boolean(s)))
      ];
      pruneRatioCache(allSrcs);
    }
  } catch (err) {
    console.warn('Failed to fetch media from Cloudflare R2:', err);
  }

  if (!renderedFromCache) {
    // ── First ever visit: fire image warm in parallel, render immediately ──
    if (newPhotos.length > 0) {
      warmStartupImages(newPhotos).catch(function() {});
    }
    renderUI(newPhotos, newVideos);
    if (state.carouselPhotos.length === 0) safeLift();
  } else if (newPhotos.length > 0) {
    // ── Already rendered from cache: compare fresh data against what we rendered ──
    const photoSig = (p: Photo) => `${p.id}-${p.title || ''}-${p.src || ''}-${p.thumb || ''}-${p.category || ''}-${p.heroSlide}-${p.aspectRatio || ''}-${p.date || ''}-${p.location || ''}-${p.desc || ''}`;
    const videoSig = (v: Video) => `${v.id}-${v.title || ''}-${v.src || ''}-${v.thumb || ''}-${v.date || ''}-${v.desc || ''}`;

    const photosSame = newPhotos.length === renderedPhotos.length &&
                       newPhotos.every((p: Photo, idx: number) => photoSig(p) === photoSig(renderedPhotos[idx]));
    const videosSame = newVideos.length === renderedVideos.length &&
                       newVideos.every((v: Video, idx: number) => videoSig(v) === videoSig(renderedVideos[idx]));
    const dataChanged = !(photosSame && videosSame);

    // Update data store
    updateMediaLibrary(newPhotos, newVideos);
    updateActivePhotos();
    applyCarouselPhotos(newPhotos);
    updateFooterStats(newPhotos, newVideos);

    // If data actually changed (e.g. user set a photo as draft in CMS), rebuild UI
    if (dataChanged) {
      buildCarousel(true);
      buildMasonry();
    }
  }
})();
