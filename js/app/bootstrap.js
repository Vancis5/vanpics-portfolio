import { APP_CONFIG } from './config.js';
import { domRefs } from './dom.js';
import { state, updateActivePhotos } from './state.js';
import { getInternalCategory, motionProjects, updateMediaLibrary } from './media-data.js';
import { slugify } from './utils.js';
import { closeLightbox, openLightbox, startUnifiedMotionPlayer, toggleLightboxDesc } from './lightbox.js';
import { buildMasonry, initFilters, rebuildGallery } from './gallery.js';
import { buildCarousel, setCarouselReadyCallback, tick } from './hero-carousel.js';
import { animateGlow, setStartLoopsCallback } from './core.js';
import { updateStickyHeaderSurface } from './sticky-header.js';

const MEDIA_CACHE_KEY = 'vanpics_media_cache_v1';

// buildCarousel internally waits for images, then calls onReady
// we hook into that by wrapping the final reveal
const LOADER_CONFIG = APP_CONFIG.loader;
const ROUTING_CONFIG = APP_CONFIG.routing;
const MASONRY_CONFIG = APP_CONFIG.masonry;

function liftLoader() {
  const loader = domRefs.loader;
  loader.classList.add('lifting');
  setTimeout(function () { loader.style.display = 'none'; }, LOADER_CONFIG.liftDuration);
}

// Lift loader via direct callback — no MutationObserver (flaky in Firefox)
let _loaderLifted = false;
function safeLift() { if (!_loaderLifted) { _loaderLifted = true; liftLoader(); } }
// Hard fallback: lift after 4s no matter what
setTimeout(safeLift, LOADER_CONFIG.hardFallbackDelay);
setCarouselReadyCallback(function () { setTimeout(safeLift, LOADER_CONFIG.carouselReadyDelay); });

function scrollToGallery() {
  if (window.lenis) {
    window.lenis.scrollTo('#gallery-section');
  } else {
    domRefs.gallerySection.scrollIntoView({ behavior: 'smooth' });
  }
}

function bindStaticUiHandlers() {
  if (domRefs.scrollHint) domRefs.scrollHint.addEventListener('click', scrollToGallery);
  if (domRefs.lightboxClose) domRefs.lightboxClose.addEventListener('click', closeLightbox);

  document.addEventListener('click', function (e) {
    const descButton = e.target.closest('#lightbox-desc-toggle');
    if (descButton) {
      toggleLightboxDesc();
      return;
    }

    const startButton = e.target.closest('.motion-start-button[data-player-id]');
    if (!startButton) return;
    startUnifiedMotionPlayer(startButton.dataset.playerId);
  });
}

bindStaticUiHandlers();

updateStickyHeaderSurface();
window.addEventListener('resize', updateStickyHeaderSurface, { passive: true });
window.addEventListener('orientationchange', updateStickyHeaderSurface, { passive: true });

// Rebuild masonry on resize to handle column count changes (width-only check to avoid mobile address bar flicker)
let _masonryResizeTimer;
let _lastMasonryWidth = window.innerWidth;
window.addEventListener('resize', function () {
  if (window.innerWidth === _lastMasonryWidth) return;
  _lastMasonryWidth = window.innerWidth;

  clearTimeout(_masonryResizeTimer);
  _masonryResizeTimer = setTimeout(function () {
    state.isMobile = window.matchMedia('(hover: none)').matches;
    buildCarousel();
    buildMasonry();
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
function checkHash() {
  const fullHash = window.location.hash.substring(1);

  const lb = domRefs.lightbox;
  const isLbOpen = lb && lb.classList.contains('open');

  // If no item slug and lightbox is open, close it (User clicked back from item to category)
  if (fullHash.split('/').length < 2 && isLbOpen) {
    closeLightbox();
    return;
  }

  if (!fullHash) return;

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
  if (itemSlug) {
    const items = state.currentCategory === 'motion' ? motionProjects : state.activePhotos;
    if (items.length === 0 && state.currentCategory !== 'motion') {
      setTimeout(checkHash, ROUTING_CONFIG.itemRecheckDelay);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      if (slugify(items[i].title) === itemSlug) {
        // If already open to this item, do nothing
        if (isLbOpen && state.cur === i) return;

        state.isPopState = true;
        openLightbox(i, 0, state.currentCategory === 'motion');
        setTimeout(function () { state.isPopState = false; }, ROUTING_CONFIG.itemRecheckDelay);
        return;
      }
    }
  }
}

window.addEventListener('popstate', function () {
  state.isPopState = true;
  checkHash();
  setTimeout(function () { state.isPopState = false; }, ROUTING_CONFIG.popstateResetDelay);
});

// ─── HELPERS ───
function processPhotos(raw) {
  return raw.map(p => ({
    ...p,
    aspectRatio: typeof p.aspect_ratio === 'number' ? p.aspect_ratio : parseFloat(p.aspect_ratio || 1.0),
    heroSlide: p.hero_slide === 1 || p.hero_slide === true
  }));
}

function processVideos(raw) {
  return raw.map(v => ({
    ...v,
    thumb: v.poster || '',
    aspectRatio: typeof v.aspect_ratio === 'number' ? v.aspect_ratio : parseFloat(v.aspect_ratio || 1.777)
  }));
}

function applyCarouselPhotos(photos) {
  state.carouselPhotos = photos.filter(p => p.heroSlide === true && p.title !== '');
  if (state.carouselPhotos.length === 0) state.carouselPhotos = photos.filter(p => p.title !== '');
}

function getStartupImageUrls(photos) {
  return Array.from(new Set(
    photos.filter(p => p.heroSlide === true && p.title !== '').slice(0, 6).map(p => p.thumb || p.src).filter(Boolean)
  ));
}

function decodeImageUrl(url, timeoutMs) {
  return new Promise(resolve => {
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

async function warmStartupImages(photos) {
  await Promise.all(getStartupImageUrls(photos).map(url => decodeImageUrl(url, 1800)));
}

function renderUI(photos, videos) {
  updateMediaLibrary(photos, videos);
  updateActivePhotos();
  applyCarouselPhotos(photos);
  buildCarousel();
  buildMasonry();
  initFilters();
  setTimeout(checkHash, ROUTING_CONFIG.galleryRecheckDelay);
}

// ─── CLOUDFLARE R2/D1 DATABASE LOADING ───
// Stale-while-revalidate: renders instantly from localStorage cache on repeat visits,
// always fetches fresh data in background to keep the cache warm.
(async function loadDynamicMedia() {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://vanpics-cms-api.lorzanofrancisevan.workers.dev';
  let renderedFromCache = false;

  // ── 1. Instant render from localStorage cache ──
  try {
    const raw = localStorage.getItem(MEDIA_CACHE_KEY);
    if (raw) {
      const { photos, videos } = JSON.parse(raw);
      if (Array.isArray(photos) && photos.length > 0) {
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
      fetch(`${API_BASE_URL}/api/photos?limit=100`),
      fetch(`${API_BASE_URL}/api/videos?limit=100`)
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
    // ── Already rendered from cache: silently update data store with fresh data ──
    // UI stays stable; fresh data powers lightbox, nav, etc. going forward.
    updateMediaLibrary(newPhotos, newVideos);
    updateActivePhotos();
    applyCarouselPhotos(newPhotos);
  }
})();
