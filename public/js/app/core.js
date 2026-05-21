var pushNextState = false;
var isPopState = false;

// ── MOTION: swap this to change which video plays ──
var motionProjects = (typeof videos !== 'undefined' && Array.isArray(videos)) ? videos.filter(function (v) {
  return !!v.thumb || !!v.src;
}) : [];
var currentMotionIndex = 0;

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getMotionPosterMarkup(item) {
  if (!item.thumb) return '';
  return '<media-poster><img src="' + item.thumb + '" alt="' + escapeHtml(item.title) + ' thumbnail"></media-poster>';
}

function getMotionThumbnailMarkup(item) {
  if (item.thumb) return '<img src="' + item.thumb + '" alt="' + escapeHtml(item.title) + '" loading="lazy">';
  return '<div class="motion-card-fallback" aria-hidden="true"></div>';
}

function getVideoPlayerMarkup(item) {
  return [
    '<div class="motion-player-prime" id="motion-player-instance">',
    '<video-player>',
    '<media-container class="media-minimal-skin media-minimal-skin--video">',
    '<video src="' + item.src + '" playsinline controlslist="nodownload"></video>',
    getMotionPosterMarkup(item),
    '<media-buffering-indicator class="media-buffering-indicator">',
    '<svg class="media-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" aria-hidden="true" viewBox="0 0 18 18"><rect width="2" height="5" x="8" y=".5" opacity=".5" rx="1"><animate attributeName="opacity" begin="0s" calcMode="linear" dur="1s" repeatCount="indefinite" values="1;0"/></rect><rect width="2" height="5" x="12.243" y="2.257" opacity=".45" rx="1" transform="rotate(45 13.243 4.757)"><animate attributeName="opacity" begin="0.125s" calcMode="linear" dur="1s" repeatCount="indefinite" values="1;0"/></rect><rect width="5" height="2" x="12.5" y="8" opacity=".4" rx="1"><animate attributeName="opacity" begin="0.25s" calcMode="linear" dur="1s" repeatCount="indefinite" values="1;0"/></rect><rect width="5" height="2" x="10.743" y="12.243" opacity=".35" rx="1" transform="rotate(45 13.243 13.243)"><animate attributeName="opacity" begin="0.375s" calcMode="linear" dur="1s" repeatCount="indefinite" values="1;0"/></rect><rect width="2" height="5" x="8" y="12.5" opacity=".3" rx="1"><animate attributeName="opacity" begin="0.5s" calcMode="linear" dur="1s" repeatCount="indefinite" values="1;0"/></rect><rect width="2" height="5" x="3.757" y="10.743" opacity=".25" rx="1" transform="rotate(45 4.757 13.243)"><animate attributeName="opacity" begin="0.625s" calcMode="linear" dur="1s" repeatCount="indefinite" values="1;0"/></rect><rect width="5" height="2" x=".5" y="8" opacity=".15" rx="1"><animate attributeName="opacity" begin="0.75s" calcMode="linear" dur="1s" repeatCount="indefinite" values="1;0"/></rect><rect width="5" height="2" x="2.257" y="3.757" opacity=".1" rx="1" transform="rotate(45 4.757 4.757)"><animate attributeName="opacity" begin="0.875s" calcMode="linear" dur="1s" repeatCount="indefinite" values="1;0"/></rect></svg>',
    '</media-buffering-indicator>',
    '<media-controls class="media-controls">',
    '<media-tooltip-group>',
    '<div class="media-button-group">',
    '<media-play-button commandfor="motion-play-tooltip" class="media-button media-button--subtle media-button--icon media-button--play"><svg class="media-icon media-icon--restart" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" aria-hidden="true" viewBox="0 0 18 18"><path fill="currentColor" d="M9 17a8 8 0 0 1-8-8h1.5a6.5 6.5 0 1 0 1.43-4.07l1.643 1.643A.25.25 0 0 1 5.396 7H1.25A.25.25 0 0 1 1 6.75V2.604a.25.25 0 0 1 .427-.177l1.438 1.438A8 8 0 1 1 9 17"/><path fill="currentColor" d="m11.61 9.639-3.331 2.07a.826.826 0 0 1-1.15-.266.86.86 0 0 1-.129-.452V6.849C7 6.38 7.374 6 7.834 6c.158 0 .312.045.445.13l3.331 2.071a.858.858 0 0 1 0 1.438"/></svg><svg class="media-icon media-icon--play" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" aria-hidden="true" viewBox="0 0 18 18"><path fill="currentColor" d="m13.473 10.476-6.845 4.256a1.697 1.697 0 0 1-2.364-.547 1.77 1.77 0 0 1-.264-.93v-8.51C4 3.78 4.768 3 5.714 3c.324 0 .64.093.914.268l6.845 4.255a1.763 1.763 0 0 1 0 2.953"/></svg><svg class="media-icon media-icon--pause" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" aria-hidden="true" viewBox="0 0 18 18"><rect width="4" height="12" x="3" y="3" fill="currentColor" rx="1.75"/><rect width="4" height="12" x="11" y="3" fill="currentColor" rx="1.75"/></svg></media-play-button>',
    '<media-tooltip id="motion-play-tooltip" side="top" class="media-tooltip"></media-tooltip>',
    '<media-seek-button commandfor="motion-seek-backward-tooltip" seconds="-10" class="media-button media-button--subtle media-button--icon media-button--seek"><div class="media-icon__container"><svg class="media-icon media-icon--flipped" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" aria-hidden="true" viewBox="0 0 18 18"><path fill="currentColor" d="M1 9c0 2.21.895 4.21 2.343 5.657l1.06-1.06a6.5 6.5 0 1 1 9.665-8.665l-1.641 1.641a.25.25 0 0 0 .177.427h4.146a.25.25 0 0 0 .25-.25V2.604a.25.25 0 0 0-.427-.177l-1.438 1.438A8 8 0 0 0 1 9"/></svg><span class="media-icon__label">10</span></div></media-seek-button>',
    '<media-tooltip id="motion-seek-backward-tooltip" side="top" class="media-tooltip">Seek backward 10 seconds</media-tooltip>',
    '<media-seek-button commandfor="motion-seek-forward-tooltip" seconds="10" class="media-button media-button--subtle media-button--icon media-button--seek"><div class="media-icon__container"><svg class="media-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" aria-hidden="true" viewBox="0 0 18 18"><path fill="currentColor" d="M1 9c0 2.21.895 4.21 2.343 5.657l1.06-1.06a6.5 6.5 0 1 1 9.665-8.665l-1.641 1.641a.25.25 0 0 0 .177.427h4.146a.25.25 0 0 0 .25-.25V2.604a.25.25 0 0 0-.427-.177l-1.438 1.438A8 8 0 0 0 1 9"/></svg><span class="media-icon__label">10</span></div></media-seek-button>',
    '<media-tooltip id="motion-seek-forward-tooltip" side="top" class="media-tooltip">Seek forward 10 seconds</media-tooltip>',
    '</div>',
    '<div class="media-time-controls"><media-time-group class="media-time-group"><media-time type="current" class="media-time media-time--current"></media-time><media-time-separator class="media-time-separator"></media-time-separator><media-time type="duration" class="media-time media-time--duration"></media-time></media-time-group><media-time-slider class="media-slider"><media-slider-track class="media-slider__track"><media-slider-fill class="media-slider__fill"></media-slider-fill><media-slider-buffer class="media-slider__buffer"></media-slider-buffer></media-slider-track><media-slider-thumb class="media-slider__thumb"></media-slider-thumb></media-time-slider></div>',
    '<div class="media-button-group"><media-playback-rate-button commandfor="motion-rate-tooltip" class="media-button media-button--subtle media-button--icon media-button--playback-rate"></media-playback-rate-button><media-tooltip id="motion-rate-tooltip" side="top" class="media-tooltip">Toggle playback rate</media-tooltip><media-mute-button commandfor="motion-volume-popover" class="media-button media-button--subtle media-button--icon media-button--mute"><svg class="media-icon media-icon--volume-off" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" aria-hidden="true" viewBox="0 0 18 18"><path fill="currentColor" d="M.714 6.008h3.072l4.071-3.857c.5-.376 1.143 0 1.143.601V15.28c0 .602-.643.903-1.143.602l-4.071-3.858H.714c-.428 0-.714-.3-.714-.752V6.76c0-.451.286-.752.714-.752M14.5 7.586l-1.768-1.768a1 1 0 1 0-1.414 1.414L13.085 9l-1.767 1.768a1 1 0 0 0 1.414 1.414l1.768-1.768 1.768 1.768a1 1 0 0 0 1.414-1.414z"/></svg><svg class="media-icon media-icon--volume-low" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" aria-hidden="true" viewBox="0 0 18 18"><path fill="currentColor" d="M.714 6.008h3.072l4.071-3.857c.5-.376 1.143 0 1.143.601V15.28c0 .602-.643.903-1.143.602l-4.071-3.858H.714c-.428 0-.714-.3-.714-.752V6.76c0-.451.286-.752.714-.752m10.568.59a.91.91 0 0 1 0-1.316.91.91 0 0 1 1.316 0c1.203 1.203 1.47 2.216 1.522 3.208q.012.255.011.51c0 1.16-.358 2.733-1.533 3.803a.7.7 0 0 1-.298.156c-.382.106-.873-.011-1.018-.156a.91.91 0 0 1 0-1.316c.57-.57.995-1.551.995-2.487 0-.944-.26-1.667-.995-2.402"/></svg><svg class="media-icon media-icon--volume-high" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" aria-hidden="true" viewBox="0 0 18 18"><path fill="currentColor" d="M15.6 3.3c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4C15.4 5.9 16 7.4 16 9s-.6 3.1-1.8 4.3c-.4.4-.4 1 0 1.4.2.2.5.3.7.3.3 0 .5-.1.7-.3C17.1 13.2 18 11.2 18 9s-.9-4.2-2.4-5.7"/><path fill="currentColor" d="M.714 6.008h3.072l4.071-3.857c.5-.376 1.143 0 1.143.601V15.28c0 .602-.643.903-1.143.602l-4.071-3.858H.714c-.428 0-.714-.3-.714-.752V6.76c0-.451.286-.752.714-.752m10.568.59a.91.91 0 0 1 0-1.316.91.91 0 0 1 1.316 0c1.203 1.203 1.47 2.216 1.522 3.208q.012.255.011.51c0 1.16-.358 2.733-1.533 3.803a.7.7 0 0 1-.298.156c-.382.106-.873-.011-1.018-.156a.91.91 0 0 1 0-1.316c.57-.57.995-1.551.995-2.487 0-.944-.26-1.667-.995-2.402"/></svg></media-mute-button><media-popover id="motion-volume-popover" open-on-hover delay="200" close-delay="100" side="top" class="media-popover media-popover--volume"><media-volume-slider class="media-slider" orientation="vertical" thumb-alignment="edge"><media-slider-track class="media-slider__track"><media-slider-fill class="media-slider__fill"></media-slider-fill></media-slider-track><media-slider-thumb class="media-slider__thumb media-slider__thumb--persistent"></media-slider-thumb></media-volume-slider></media-popover><media-fullscreen-button commandfor="motion-fullscreen-tooltip" class="media-button media-button--subtle media-button--icon media-button--fullscreen"><svg class="media-icon media-icon--fullscreen-enter" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" aria-hidden="true" viewBox="0 0 18 18"><path fill="currentColor" d="M15.25 2a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V3.5h-3.75a.75.75 0 0 1-.743-.648L10 2.75a.75.75 0 0 1 .75-.75z"/><path fill="currentColor" d="M14.72 2.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06zM2.75 10a.75.75 0 0 1 .75.75v3.75h3.75a.75.75 0 0 1 .743.648L8 15.25a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 1 .75-.75"/><path fill="currentColor" d="M6.72 10.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06z"/></svg><svg class="media-icon media-icon--fullscreen-exit" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" aria-hidden="true" viewBox="0 0 18 18"><path fill="currentColor" d="M10.75 2a.75.75 0 0 1 .75.75V6.5h3.75a.75.75 0 0 1 .743.648L16 7.25a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 1-.75-.75"/><path fill="currentColor" d="M14.72 2.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06zM7.25 10a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V11.5H2.75a.75.75 0 0 1-.743-.648L2 10.75a.75.75 0 0 1 .75-.75z"/><path fill="currentColor" d="M6.72 10.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06z"/></svg></media-fullscreen-button><media-tooltip id="motion-fullscreen-tooltip" side="top" class="media-tooltip"></media-tooltip></div>',
    '</media-tooltip-group>',
    '</media-controls>',
    '<div class="media-overlay"></div>',
    '</media-container>',
    '</video-player>',
    '<button type="button" class="motion-start-button" aria-label="Play video" onclick="startUnifiedMotionPlayer(\'motion-player-instance\')"><svg class="motion-start-button__icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>',
    '</div>'
  ].join('');
}

function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w-]+/g, '')  // Remove all non-word chars
    .replace(/--+/g, '-');    // Replace multiple - with single -
}

var domRefs = {
  loader: document.getElementById('loader'),
  cursor: document.getElementById('cursor'),
  cursorRing: document.getElementById('cursor-ring'),
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

(function initHeroTagline() {
  var taglines = [
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
  var el = document.querySelector('#hero-identity p');

  if (el) {
    var visited = localStorage.getItem('van_v3_visited');
    var selected;
    if (!visited) {
      selected = taglines[0];
      localStorage.setItem('van_v3_visited', 'true');
    } else {
      selected = taglines[Math.floor(Math.random() * taglines.length)];
    }
    el.innerHTML = selected;
  }
})();

var currentCategory = 'all';
// Initial Route Detection: Determine category before building UI to prevent transition flicker
if (window.location.hash) {
  var initialHash = window.location.hash.substring(1).split('/')[0];
  if (initialHash === 'figures') currentCategory = 'figures';
  if (initialHash === 'motion') currentCategory = 'motion';
}

var activePhotos = [];
var carouselPhotos = [];

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
  return photos.filter(function (p) {
    if (!p.title) return false;
    if (category === 'figures') return p.category === 'figures';
    return p.category !== 'figures';
  });
}

function updateActivePhotos() {
  activePhotos = getPhotoLibrary(currentCategory);
}

updateActivePhotos();
carouselPhotos = photos.filter(function (p) { return p.heroSlide === true && p.title !== ''; });
if (carouselPhotos.length === 0) carouselPhotos = photos.filter(function (p) { return p.title !== ''; });

// Pre-cache first 6 carousel images to warm up the browser cache without triggering "unused preload" warnings
carouselPhotos.slice(0, 6).forEach(function (p) {
  var img = new Image();
  img.src = p.src;
});
var cur = 0;
var isMobile = window.matchMedia('(hover: none)').matches;
var heroVisible = true, pageVisible = true;
var heroRafId = null, glowRafId = null;

function syncVisualViewportVars() {
  var vv = window.visualViewport;
  var height = vv ? vv.height : window.innerHeight;
  var bottomInset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
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
var glowBall = domRefs.glowBall;
var glowX = window.innerWidth / 2, glowY = window.innerHeight / 2;
var glowTargetX = glowX, glowTargetY = glowY;

if (glowBall && domRefs.hero) {
  var hero = domRefs.hero;
  var mouseInHero = false;
  hero.addEventListener('mouseenter', function () { mouseInHero = true; startLoops(); });
  hero.addEventListener('mouseleave', function () { mouseInHero = false; });
  hero.addEventListener('mousemove', function (e) {
    var rect = hero.getBoundingClientRect();
    glowTargetX = e.clientX - rect.left;
    glowTargetY = e.clientY - rect.top;
  });
  function animateGlow() {
    var scrollFade = Math.max(0, 1 - (window.scrollY / 350));
    var targetOp = (mouseInHero && heroVisible && pageVisible) ? scrollFade : 0;

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
