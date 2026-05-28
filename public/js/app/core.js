let pushNextState = false;
let isPopState = false;

const photoLibrary = (typeof photos !== 'undefined' && Array.isArray(photos)) ? photos : [];

// ── MOTION: swap this to change which video plays ──
const motionProjects = (typeof videos !== 'undefined' && Array.isArray(videos)) ? videos.filter(function (v) {
  return !!v.thumb || !!v.src;
}) : [];
let currentMotionIndex = 0;

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createMotionPosterElement(item) {
  const poster = document.createElement('media-poster');
  const img = document.createElement('img');
  img.src = item.thumb;
  img.alt = (item.title || '') + ' thumbnail';
  poster.appendChild(img);
  return poster;
}

function getMotionThumbnailMarkup(item) {
  if (item.thumb) return '<img src="' + escapeHtml(item.thumb) + '" alt="' + escapeHtml(item.title) + '" loading="lazy">';
  return '<div class="motion-card-fallback" aria-hidden="true"></div>';
}

function getVideoPlayerMarkup(item) {
  const template = document.getElementById('motion-player-template');
  if (!template) return '';

  const playerId = 'motion-player-instance';
  const fragment = template.content.cloneNode(true);
  const shell = fragment.querySelector('.motion-player-prime');
  const video = fragment.querySelector('video');
  const posterSlot = fragment.querySelector('[data-motion-poster-slot]');
  const startButton = fragment.querySelector('.motion-start-button');

  if (shell) shell.id = playerId;
  if (video) video.src = item.src || '';
  if (startButton) startButton.dataset.playerId = playerId;

  if (posterSlot) {
    if (item.thumb) {
      posterSlot.replaceWith(createMotionPosterElement(item));
    } else {
      posterSlot.remove();
    }
  }

  const wrap = document.createElement('div');
  wrap.appendChild(fragment);
  return wrap.innerHTML;
}

function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w-]+/g, '')  // Remove all non-word chars
    .replace(/--+/g, '-');    // Replace multiple - with single -
}

const domRefs = {
  loader: document.getElementById('loader'),
  cursor: document.getElementById('cursor'),
  cursorRing: document.getElementById('cursor-ring'),
  scrollHint: document.getElementById('scroll-hint'),
  customScrollbar: document.getElementById('custom-scrollbar'),
  customScrollbarThumb: document.getElementById('custom-scrollbar-thumb'),
  hero: document.getElementById('hero'),
  glowBall: document.getElementById('glow-ball'),
  heroRows: [
    document.getElementById('row-0'),
    document.getElementById('row-1'),
    document.getElementById('row-2'),
    document.getElementById('row-3')
  ],
  gallerySection: document.getElementById('gallery-section'),
  galleryHeader: document.getElementById('gallery-header'),
  masonry: document.getElementById('masonry'),
  lightbox: document.getElementById('lightbox'),
  lightboxBg: document.getElementById('lightbox-bg'),
  lightboxClose: document.getElementById('lightbox-close'),
  blurLayerA: document.getElementById('blur-layer-a'),
  blurLayerB: document.getElementById('blur-layer-b'),
  lightboxContent: document.getElementById('lightbox-content'),
  lightboxZoomDarken: document.getElementById('lightbox-zoom-darken'),
  lightboxImgWrap: document.getElementById('lightbox-img-wrap'),
  lightboxImg: document.getElementById('lightbox-img'),
  motionPlayerShell: document.getElementById('motion-player-shell'),
  lightboxInfoWrap: document.getElementById('lightbox-info-wrap'),
  lightboxInfo: document.getElementById('lightbox-info'),
  lightboxTitle: document.getElementById('lightbox-title'),
  lightboxDescToggle: document.getElementById('lightbox-desc-toggle'),
  lightboxDesc: document.getElementById('lightbox-desc'),
  metaLocation: document.getElementById('meta-location'),
  metaLocationText: document.getElementById('meta-location-text'),
  metaDate: document.getElementById('meta-date'),
  metaDateText: document.getElementById('meta-date-text'),
  metaMusic: document.getElementById('meta-music'),
  metaMusicText: document.getElementById('meta-music-text'),
  filmstripWrap: document.getElementById('filmstrip-wrap'),
  filmstrip: document.getElementById('filmstrip'),
  filmstripLiftZone: document.getElementById('filmstrip-lift-zone'),
  siteFooter: document.getElementById('site-footer')
};

function showFilmstripIfReady() {
  if (typeof window.showFilmstrip === 'function') window.showFilmstrip();
}

function hideFilmstripIfReady() {
  if (typeof window.hideFilmstrip === 'function') window.hideFilmstrip();
}

function clearFilmstripHideTimerIfReady() {
  if (typeof filmstripHideTimer !== 'undefined' && filmstripHideTimer) {
    window.clearTimeout(filmstripHideTimer);
  }
}

function setFilmstripLiftZoneDisplay(display) {
  const liftZone = domRefs.filmstripLiftZone;
  if (liftZone) liftZone.style.display = display;
}

function startLoopsIfReady() {
  if (typeof window.startLoops === 'function') window.startLoops();
}

(function initHeroTagline() {
  const taglines = [
    "collection of all the pics i've ever taken <br> more soon",
    "still adding stuff. check back sometime",
    "i keep the ones nobody else would keep",
    "some of these i really wanna remember",
    "taken between doing other things",
    "things i saw while looking for something else",
    "light, shadow, and a bit of luck",
    "a little bit of everything",
    "started as a habit",
    "taken when something was worth keeping"
  ];
  const el = document.querySelector('#hero-identity p');

  if (el) {
    const visited = localStorage.getItem('van_v3_visited');
    let selected;
    if (!visited) {
      selected = taglines[0];
      localStorage.setItem('van_v3_visited', 'true');
    } else {
      selected = taglines[Math.floor(Math.random() * taglines.length)];
    }
    el.innerHTML = selected;
  }
})();

let currentCategory = 'all';
// Initial Route Detection: Determine category before building UI to prevent transition flicker
if (window.location.hash) {
  const initialHash = window.location.hash.substring(1).split('/')[0];
  if (initialHash === 'figures') currentCategory = 'figures';
  if (initialHash === 'motion') currentCategory = 'motion';
}

let activePhotos = [];
let carouselPhotos = [];

function getCategorySlug(cat) {
  if (cat === 'all') return 'photographs';
  if (cat === 'figures') return 'figures';
  return 'motion';
}

function getInternalCategory(slug) {
  if (slug === 'figures') return 'figures';
  if (slug === 'motion') return 'motion';
  return 'all';
}

function getPhotoLibrary(category) {
  if (category === 'motion') return [];
  return photoLibrary.filter(function (p) {
    if (!p.title) return false;
    if (category === 'figures') return p.category === 'figures';
    return p.category !== 'figures';
  });
}

function updateActivePhotos() {
  activePhotos = getPhotoLibrary(currentCategory);
}

updateActivePhotos();
carouselPhotos = photoLibrary.filter(function (p) { return p.heroSlide === true && p.title !== ''; });
if (carouselPhotos.length === 0) carouselPhotos = photoLibrary.filter(function (p) { return p.title !== ''; });

// Pre-cache first 6 carousel images to warm up the browser cache without triggering "unused preload" warnings
carouselPhotos.slice(0, 6).forEach(function (p) {
  const img = new Image();
  img.src = p.src;
});
let cur = 0;
const isMobile = window.matchMedia('(hover: none)').matches;
let heroVisible = true, pageVisible = true;
let heroRafId = null, glowRafId = null;

function syncVisualViewportVars() {
  const vv = window.visualViewport;
  const height = vv ? vv.height : window.innerHeight;
  const bottomInset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
  if (height) document.documentElement.style.setProperty('--app-height', height + 'px');
  document.documentElement.style.setProperty('--browser-bottom', bottomInset + 'px');
}

syncVisualViewportVars();
window.addEventListener('resize', syncVisualViewportVars, { passive: true });
window.addEventListener('orientationchange', syncVisualViewportVars, { passive: true });
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncVisualViewportVars, { passive: true });
  window.visualViewport.addEventListener('scroll', syncVisualViewportVars, { passive: true });
}

// GLOW BALL
const glowBall = domRefs.glowBall;
let glowX = window.innerWidth / 2, glowY = window.innerHeight / 2;
let glowTargetX = glowX, glowTargetY = glowY;

if (glowBall && domRefs.hero) {
  const hero = domRefs.hero;
  let mouseInHero = false;
  hero.addEventListener('mouseenter', function () { mouseInHero = true; startLoopsIfReady(); });
  hero.addEventListener('mouseleave', function () { mouseInHero = false; });
  hero.addEventListener('mousemove', function (e) {
    const rect = hero.getBoundingClientRect();
    glowTargetX = e.clientX - rect.left;
    glowTargetY = e.clientY - rect.top;
  });
  function animateGlow() {
    const scrollFade = Math.max(0, 1 - (window.scrollY / 350));
    const targetOp = (mouseInHero && heroVisible && pageVisible) ? scrollFade : 0;

    if (glowBall.style.opacity != targetOp) {
      glowBall.style.opacity = targetOp;
    }

    // Stop loop only if target is 0 AND transition is essentially done
    if (targetOp === 0 && (!glowBall.style.opacity || parseFloat(glowBall.style.opacity) < 0.01)) {
      glowRafId = null;
      return;
    }

    glowX += (glowTargetX - glowX) * 0.08;
    glowY += (glowTargetY - glowY) * 0.08;
    glowBall.style.left = glowX + 'px';
    glowBall.style.top = glowY + 'px';
    glowRafId = requestAnimationFrame(animateGlow);
  }
}
