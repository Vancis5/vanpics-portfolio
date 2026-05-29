// buildCarousel internally waits for images, then calls onReady
// we hook into that by wrapping the final reveal
const LOADER_CONFIG = window.APP_CONFIG.loader;
const ROUTING_CONFIG = window.APP_CONFIG.routing;
const MASONRY_CONFIG = window.APP_CONFIG.masonry;

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
// Expose for buildCarousel to call after rows are visible
window.__onCarouselReady = function () { setTimeout(safeLift, LOADER_CONFIG.carouselReadyDelay); };

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

(function initStickyHeaderSurface() {
  const header = domRefs.galleryHeader;
  if (!header) return;

  window.updateStickyHeaderSurface = function (scroll) {
    // Use provided scroll or fallback to current position
    const s = (typeof scroll === 'number') ? scroll : (window.scrollY || 0);
    document.body.classList.toggle('gallery-header-stuck', header.getBoundingClientRect().top <= 0.5);
  };

  window.updateStickyHeaderSurface();
  window.addEventListener('resize', window.updateStickyHeaderSurface, { passive: true });
  window.addEventListener('orientationchange', window.updateStickyHeaderSurface, { passive: true });
})();

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
  if (heroVisible && pageVisible) {
    if (!heroRafId) heroRafId = requestAnimationFrame(tick);
    if (!glowRafId && typeof animateGlow === 'function') glowRafId = requestAnimationFrame(animateGlow);
  }
}

window.startLoops = startLoops;

const heroObs = new IntersectionObserver(function (entries) {
  heroVisible = entries[0].isIntersecting;
  startLoops();
}, { threshold: 0 });
heroObs.observe(domRefs.hero);

document.addEventListener('visibilitychange', function () {
  pageVisible = !document.hidden;
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
  if (currentCategory !== targetCat) {
    rebuildGallery(targetCat);
    // Wait for rebuild, then re-check for the item
    setTimeout(checkHash, ROUTING_CONFIG.galleryRecheckDelay);
    return;
  }

  // 2. If we are in the right category, check for the specific item
  if (itemSlug) {
    const items = currentCategory === 'motion' ? motionProjects : activePhotos;
    if (items.length === 0 && currentCategory !== 'motion') {
      setTimeout(checkHash, ROUTING_CONFIG.itemRecheckDelay);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      if (slugify(items[i].title) === itemSlug) {
        // If already open to this item, do nothing
        if (isLbOpen && cur === i) return;

        isPopState = true;
        openLightbox(i, 0, currentCategory === 'motion');
        setTimeout(function () { isPopState = false; }, ROUTING_CONFIG.itemRecheckDelay);
        return;
      }
    }
  }
}

window.addEventListener('popstate', function () {
  isPopState = true;
  checkHash();
  setTimeout(function () { isPopState = false; }, ROUTING_CONFIG.popstateResetDelay);
});

// Defer slightly to ensure layout is ready
setTimeout(checkHash, ROUTING_CONFIG.galleryRecheckDelay);
