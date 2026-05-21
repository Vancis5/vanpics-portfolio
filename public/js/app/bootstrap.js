// buildCarousel internally waits for images, then calls onReady
// we hook into that by wrapping the final reveal
function liftLoader() {
  var loader = document.getElementById('loader');
  loader.classList.add('lifting');
  setTimeout(function () { loader.style.display = 'none'; }, 750);
}

// Lift loader via direct callback — no MutationObserver (flaky in Firefox)
var _loaderLifted = false;
function safeLift() { if (!_loaderLifted) { _loaderLifted = true; liftLoader(); } }
// Hard fallback: lift after 4s no matter what
setTimeout(safeLift, 4000);
// Expose for buildCarousel to call after rows are visible
window.__onCarouselReady = function () { setTimeout(safeLift, 120); };

buildCarousel();
buildMasonry();
initFilters();

(function initStickyHeaderSurface() {
  var header = document.getElementById('gallery-header');
  if (!header) return;

  window.updateStickyHeaderSurface = function (scroll) {
    // Use provided scroll or fallback to current position
    var s = (typeof scroll === 'number') ? scroll : (window.scrollY || 0);
    document.body.classList.toggle('gallery-header-stuck', header.getBoundingClientRect().top <= 0.5);
  };

  window.updateStickyHeaderSurface();
  window.addEventListener('resize', window.updateStickyHeaderSurface, { passive: true });
  window.addEventListener('orientationchange', window.updateStickyHeaderSurface, { passive: true });
})();

// Rebuild masonry on resize to handle column count changes (width-only check to avoid mobile address bar flicker)
var _masonryResizeTimer;
var _lastMasonryWidth = window.innerWidth;
window.addEventListener('resize', function () {
  if (window.innerWidth === _lastMasonryWidth) return;
  _lastMasonryWidth = window.innerWidth;

  clearTimeout(_masonryResizeTimer);
  _masonryResizeTimer = setTimeout(function () {
    buildMasonry();
  }, 200);
});

// Visibility & Animation Loop Management
function startLoops() {
  if (heroVisible && pageVisible) {
    if (!heroRafId) heroRafId = requestAnimationFrame(tick);
    if (!glowRafId && typeof animateGlow === 'function') glowRafId = requestAnimationFrame(animateGlow);
  }
}

var heroObs = new IntersectionObserver(function (entries) {
  heroVisible = entries[0].isIntersecting;
  startLoops();
}, { threshold: 0 });
heroObs.observe(document.getElementById('hero'));

document.addEventListener('visibilitychange', function () {
  pageVisible = !document.hidden;
  startLoops();
});

// Deep Link Initial Load
function checkHash() {
  var fullHash = window.location.hash.substring(1);

  var lb = document.getElementById('lightbox');
  var isLbOpen = lb && lb.classList.contains('open');

  // If no item slug and lightbox is open, close it (User clicked back from item to category)
  if (fullHash.split('/').length < 2 && isLbOpen) {
    closeLightbox();
    return;
  }

  if (!fullHash) return;

  var parts = fullHash.split('/');
  var catSlug = parts[0];
  var itemSlug = parts[1];

  var targetCat = getInternalCategory(catSlug);

  // 1. If we're not in the right category, switch it first
  if (currentCategory !== targetCat) {
    rebuildGallery(targetCat);
    // Wait for rebuild, then re-check for the item
    setTimeout(checkHash, 300);
    return;
  }

  // 2. If we are in the right category, check for the specific item
  if (itemSlug) {
    var items = currentCategory === 'motion' ? motionProjects : activePhotos;
    if (items.length === 0 && currentCategory !== 'motion') {
      setTimeout(checkHash, 100);
      return;
    }

    for (var i = 0; i < items.length; i++) {
      if (slugify(items[i].title) === itemSlug) {
        // If already open to this item, do nothing
        if (isLbOpen && cur === i) return;

        isPopState = true;
        openLightbox(i, 0, currentCategory === 'motion');
        setTimeout(function () { isPopState = false; }, 100);
        return;
      }
    }
  }
}

window.addEventListener('popstate', function () {
  isPopState = true;
  checkHash();
  setTimeout(function () { isPopState = false; }, 500);
});

// Defer slightly to ensure layout is ready
setTimeout(checkHash, 300);
