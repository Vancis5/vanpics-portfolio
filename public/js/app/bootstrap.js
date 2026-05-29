import { APP_CONFIG } from './config.js';
import { domRefs } from './dom.js';
import { state } from './state.js';
import { getInternalCategory, motionProjects } from './media-data.js';
import { slugify } from './utils.js';
import { closeLightbox, openLightbox, startUnifiedMotionPlayer, toggleLightboxDesc } from './lightbox.js';
import { buildMasonry, initFilters, rebuildGallery } from './gallery.js';
import { buildCarousel, setCarouselReadyCallback, tick } from './hero-carousel.js';
import { animateGlow, setStartLoopsCallback } from './core.js';
import { updateStickyHeaderSurface } from './sticky-header.js';

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
buildCarousel();
buildMasonry();
initFilters();

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

// Defer slightly to ensure layout is ready
setTimeout(checkHash, ROUTING_CONFIG.galleryRecheckDelay);
