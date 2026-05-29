let pushNextState = false;
let isPopState = false;
var domRefs = window.domRefs;
var escapeHtml = window.escapeHtml;
var slugify = window.slugify;

var photoLibrary = window.photoLibrary;

// ── MOTION: swap this to change which video plays ──
var motionProjects = window.motionProjects;
var getCategorySlug = window.getCategorySlug;
var getInternalCategory = window.getInternalCategory;
var getPhotoLibrary = window.getPhotoLibrary;
var getMotionThumbnailMarkup = window.getMotionThumbnailMarkup;
var getVideoPlayerMarkup = window.getVideoPlayerMarkup;

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

let currentCategory = 'all';
// Initial Route Detection: Determine category before building UI to prevent transition flicker
if (window.location.hash) {
  const initialHash = window.location.hash.substring(1).split('/')[0];
  if (initialHash === 'figures') currentCategory = 'figures';
  if (initialHash === 'motion') currentCategory = 'motion';
}

let activePhotos = [];
let carouselPhotos = [];

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

// GLOW BALL
const glowBall = domRefs.glowBall;
let glowX = window.innerWidth / 2, glowY = window.innerHeight / 2;
let glowTargetX = glowX, glowTargetY = glowY;
let mouseInHero = false;

// Declared at outer scope so bootstrap.js can always find it via typeof check,
// even under strict mode or future ES module migration.
var animateGlow = null;

if (glowBall && domRefs.hero) {
  const hero = domRefs.hero;
  hero.addEventListener('mouseenter', function () { mouseInHero = true; startLoopsIfReady(); });
  hero.addEventListener('mouseleave', function () { mouseInHero = false; });
  hero.addEventListener('mousemove', function (e) {
    const rect = hero.getBoundingClientRect();
    glowTargetX = e.clientX - rect.left;
    glowTargetY = e.clientY - rect.top;
  });
  animateGlow = function () {
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
  };
}
