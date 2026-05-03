// ─────────────────────────────────────────────
//  FRANCIS EVAN — MAIN APPLICATION
//  Extracted from inline <script> blocks
// ─────────────────────────────────────────────

let pushNextState = false;
let isPopState = false;

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
(function initHeroTagline() {
  const taglines = [
    "collection of all the pics i've ever taken <br> more soon!",
    "still adding stuff. check back sometime",
    "i keep the ones nobody else would keep",
    "some of these i really wanna remember",
    "taken between doing other things",
    "photos i like!",
    "things i saw while looking for something else",
    "light, shadow, and a bit of luck",
    "a little bit of everything",
    "more coming soon, probably",
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
const glowBall = document.getElementById('glow-ball');
let glowX = window.innerWidth / 2, glowY = window.innerHeight / 2;
let glowTargetX = glowX, glowTargetY = glowY;

if (glowBall) {
  const hero = document.getElementById('hero');
  let mouseInHero = false;
  hero.addEventListener('mouseenter', function () { mouseInHero = true; startLoops(); });
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

let blurFlip = false;
function setLightboxBlur(src) {
  if (!src) return;
  const active = document.getElementById('blur-layer-a').classList.contains('active') ? document.getElementById('blur-layer-b') : document.getElementById('blur-layer-a');
  const inactive = active.id === 'blur-layer-a' ? document.getElementById('blur-layer-b') : document.getElementById('blur-layer-a');

  // Resolve blur path: strip 'thumbs/' if present so it points to the correct blur asset
  const blurPath = src.replace('photos/', 'photos/blur/').replace('thumbs/', '');
  const inner = active.querySelector('.lightbox-bg-blur-inner');
  if (inner) inner.style.backgroundImage = 'url(' + blurPath + ')';

  active.classList.add('active');
  inactive.classList.remove('active');

  blurFlip = !blurFlip;
}

// updates text + blur bg only — image src is set separately to avoid double-load
function setLightboxContent(p) {
  if (!p) return;

  const safeTitle = p.title || '';
  const safeDesc = p.desc || '';
  const content = document.getElementById('lightbox-content');
  const btn = document.getElementById('lightbox-desc-toggle');
  const descEl = document.getElementById('lightbox-desc');
  const isCollapsingOpenDesc = content && content.classList.contains('desc-open');
  let preSwapImgRect = null;
  let preSwapInfoRect = null;

  if (isCollapsingOpenDesc && isMobile) {
    const preSwapImgWrap = document.getElementById('lightbox-img-wrap');
    const preSwapInfoWrap = document.getElementById('lightbox-info-wrap');
    if (preSwapImgWrap && preSwapInfoWrap) {
      preSwapImgRect = preSwapImgWrap.getBoundingClientRect();
      preSwapInfoRect = preSwapInfoWrap.getBoundingClientRect();
    }
    if (descEl) descEl.style.transition = 'none';
  }

  document.getElementById('lightbox-title').textContent = safeTitle;
  descEl.innerHTML = safeDesc;
  const locItem = document.getElementById('meta-location');
  if (p.location) {
    document.getElementById('meta-location-text').textContent = p.location;
    locItem.style.display = 'inline-flex';
  } else {
    locItem.style.display = 'none';
  }

  const dateItem = document.getElementById('meta-date');
  if (p.date) {
    document.getElementById('meta-date-text').textContent = p.date;
    dateItem.style.display = 'inline-flex';
  } else {
    dateItem.style.display = 'none';
  }

  const musicItem = document.getElementById('meta-music');
  if (p.music) {
    document.getElementById('meta-music-text').textContent = p.music;
    musicItem.style.display = 'inline-flex';
  } else {
    musicItem.style.display = 'none';
  }

  // Deep Link: Automatically update the URL hash dynamically for routing tracking
  const catSlug = getCategorySlug(currentCategory);
  const slug = slugify(safeTitle);
  const newHash = '#' + catSlug + '/' + slug;
  if (slug && window.location.hash !== newHash) {
    if (isPopState) {
      history.replaceState(null, null, newHash);
    } else if (pushNextState) {
      history.pushState(null, null, newHash);
      pushNextState = false;
    } else {
      history.replaceState(null, null, newHash);
    }
  }

  // conditionally hide the "read" toggle when photo has no description
  if (btn) {
    const hasDesc = safeDesc.replace(/<[^>]*>/g, '').trim().length > 0;
    btn.classList.toggle('no-desc', !hasDesc);
  }

  updateLightboxDescPreview();

  if (content && content.classList.contains('desc-open')) {
    // Mobile: GPU FLIP to gracefully and safely collapse without dropping frames natively
    if (isMobile) {
      const imgWrap = document.getElementById('lightbox-img-wrap');
      const infoWrap = document.getElementById('lightbox-info-wrap');

      const startImg = preSwapImgRect || imgWrap.getBoundingClientRect();
      const startInfo = preSwapInfoRect || infoWrap.getBoundingClientRect();

      content.classList.remove('desc-open');
      if (btn) btn.textContent = 'read more';
      updateLightboxDescPreview();

      const endImg = imgWrap.getBoundingClientRect();
      const endInfo = infoWrap.getBoundingClientRect();

      const dImg = startImg.top - endImg.top;
      const dInfo = startInfo.top - endInfo.top;

      imgWrap.style.transition = 'none';
      imgWrap.style.transform = 'translateY(' + dImg + 'px)';
      infoWrap.style.transition = 'none';
      infoWrap.style.transform = 'translateY(' + dInfo + 'px)';

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          imgWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
          imgWrap.style.transform = '';
          infoWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
          infoWrap.style.transform = '';
          setTimeout(function () {
            descEl.style.transition = '';
            imgWrap.style.transition = '';
            infoWrap.style.transition = '';
          }, 450);
        });
      });
    } else {
      // Desktop: Hardware accelerated glide down — FLIP animation
      const imgWrap = document.getElementById('lightbox-img-wrap');
      const infoWrap = document.getElementById('lightbox-info-wrap');

      const startImg = imgWrap.getBoundingClientRect();
      const startInfo = infoWrap.getBoundingClientRect();

      content.classList.remove('desc-open');
      if (btn) btn.textContent = 'read more';
      updateLightboxDescPreview();

      const endImg = imgWrap.getBoundingClientRect();
      const endInfo = infoWrap.getBoundingClientRect();

      const dImg = startImg.top - endImg.top;
      const dInfo = startInfo.top - endInfo.top;

      imgWrap.style.transition = 'none';
      imgWrap.style.transform = 'translateY(' + dImg + 'px)';
      infoWrap.style.transition = 'none';
      infoWrap.style.transform = 'translateY(' + dInfo + 'px)';

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          imgWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
          imgWrap.style.transform = '';
          infoWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
          infoWrap.style.transform = '';
          setTimeout(function () {
            imgWrap.style.transition = '';
            infoWrap.style.transition = '';
          }, 450);
        });
      });
    }
  } else if (btn) {
    btn.textContent = 'read more';
    updateLightboxDescPreview();
  }
}

function updateLightboxDescPreview() {
  const desc = document.getElementById('lightbox-desc');
  const btn = document.getElementById('lightbox-desc-toggle');
  const content = document.getElementById('lightbox-content');
  if (!desc || !btn || !content || !isMobile) return;

  const hasDesc = desc.textContent.trim().length > 0;
  desc.classList.toggle('desc-expanded', content.classList.contains('desc-open'));

  if (!hasDesc) {
    desc.classList.remove('desc-overflow');
    btn.classList.add('no-desc');
    return;
  }

  const styles = window.getComputedStyle(desc);
  let lineHeight = parseFloat(styles.lineHeight);
  if (!lineHeight) lineHeight = parseFloat(styles.fontSize) * 1.75;
  const previewHeight = lineHeight * 2;
  const hasOverflow = desc.scrollHeight > previewHeight + 1;

  desc.classList.toggle('desc-overflow', hasOverflow);
  btn.classList.toggle('no-desc', !hasOverflow);
}


function animateInfo(dir) {
  const info = document.getElementById('lightbox-info');

  // only animate exit if there's visible content (opacity > 0 means it's shown)
  const hasContent = info && parseFloat(window.getComputedStyle(info).opacity) > 0.05;
  if (hasContent) {
    // create exit ghost — absolutely positioned so it doesn't shift layout
    const ghost = info.cloneNode(true);
    ghost.style.position = 'absolute';
    ghost.style.top = info.offsetTop + 'px';
    ghost.style.left = info.offsetLeft + 'px';
    ghost.style.width = info.offsetWidth + 'px';
    ghost.style.pointerEvents = 'none';
    ghost.removeAttribute('onclick'); // prevent stale tap capture on mobile
    ghost.style.animation = 'lbInfoOut 0.22s ease forwards';
    ghost.style.willChange = 'filter, opacity';
    ghost.style.zIndex = '1';
    info.parentNode.appendChild(ghost);
    setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 250);
  }

  // clone-replace for enter — clean slate, no animation-cancel issues
  const fromX = dir === 0 ? 0 : (dir > 0 ? 24 : -24);
  const fromY = dir === 0 ? 16 : 0;
  const clone = info.cloneNode(true);
  clone.style.setProperty('--lb-from-x', fromX + 'px');
  clone.style.setProperty('--lb-from-y', fromY + 'px');
  clone.style.animation = 'lbInfoIn 0.55s cubic-bezier(0.22,1,0.36,1) forwards';
  clone.style.willChange = 'filter, opacity, transform';
  // clear any lingering inline transition/filter from swipe scroll handler
  clone.style.transition = '';
  clone.style.filter = '';
  info.parentNode.replaceChild(clone, info);
}

// increments each navigation so stale callbacks from aborted navigations are ignored
let navGen = 0;

let currentLightboxIsMotion = false;
function getCurrentLightboxItems() {
  return currentLightboxIsMotion ? motionProjects : activePhotos;
}

function openLightbox(i, direction, isMotion) {
  const lb = document.getElementById('lightbox');
  if (lb && !lb.classList.contains('open') && !isPopState) {
    pushNextState = true;
  }
  
  cur = i;
  isManuallyNavigating = true;
  currentLightboxIsMotion = !!isMotion;
  const p = getCurrentLightboxItems()[i];

  if (!p) return;
  const img = document.getElementById('lightbox-img');
  const playerShell = document.getElementById('motion-player-shell');

  if (isMotion) lb.classList.add('mode-motion');
  else lb.classList.remove('mode-motion');

  // Mobile: already open — natively smooth scroll
  if (lb.classList.contains('open') && isMobile && mobileScrollToSlide && !isMotion) {
    // Fallback to 1 if direction evaluates to 0 or is mathematically missing
    const dir = (typeof direction === 'number' && direction !== 0) ? direction : 1;
    mobileScrollToSlide(i, true, dir);

    cur = i;
    updateFilmstrip();
    return;
  }

  if (lb.classList.contains('open')) {
    const dir = (typeof direction === 'number' && direction !== 0) ? direction : 1;
    const exitX = dir > 0 ? '-6%' : '6%';
    const enterX = dir > 0 ? '6%' : '-6%';
    const gen = ++navGen;

    // exit current media immediately — snappy
    img.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    img.style.opacity = '0';
    img.style.transform = 'translateX(' + exitX + ') scale(0.98)';
    playerShell.style.opacity = '0';

    // hide info panel immediately so old text isn't visible
    const infoEl = document.getElementById('lightbox-info');
    if (infoEl) {
      infoEl.style.animation = 'none';
      infoEl.style.opacity = '0';
    }

    // update blur bg immediately (visual polish) — text stays hidden until image ready
    // MOVED to afterLoad() to prevent network progressive rendering from lagging JS animations
    showFilmstrip();

    let entered = false;

    function doEnter() {
      if (entered || gen !== navGen) return;
      entered = true;

      // blank src, position off-screen, fully invisible — nothing bleeds through
      img.onload = null; img.onerror = null;
      img.src = '';
      img.style.transition = 'none';
      img.style.transform = 'translateX(' + enterX + ') scale(0.98)';
      img.style.opacity = '0';
      playerShell.innerHTML = '';
      playerShell.style.opacity = '0';

      // assign handlers BEFORE setting src — Firefox fires load before handler if src set first
      let loadFired = false;
      function afterLoad() {
        if (loadFired || gen !== navGen) return;
        loadFired = true;
        img.onload = null; img.onerror = null;

        const bSrc = isMotion ? p.thumb : p.src;
        setLightboxBlur(bSrc);
        setLightboxContent(p);

        if (!isMotion) loadSwipeNeighbors();

        requestAnimationFrame(function () {
          if (gen !== navGen) return;
          animateInfo(dir);
          void img.offsetWidth; // force reflow

          if (isMotion) {
            renderVideoInLightbox(p);
            playerShell.style.transition = 'opacity 0.35s ease';
            playerShell.style.opacity = '1';
          } else {
            img.style.transition = 'opacity 0.32s ease, transform 0.4s cubic-bezier(0.16,1,0.3,1)';
            img.style.opacity = '1';
            img.style.transform = 'translateX(0) scale(1)';
          }
        });
      }

      requestAnimationFrame(function () {
        if (gen !== navGen) return;
        if (isMotion) {
          afterLoad();
        } else {
          img.onload = function () { clearTimeout(loadFallback); afterLoad(); };
          img.onerror = function () { clearTimeout(loadFallback); afterLoad(); };
          img.src = p.src;
          const loadFallback = setTimeout(afterLoad, 700);
          // decode() waits for full pixel decode — reliable in Firefox unlike img.complete
          if (img.decode) img.decode().then(function () { clearTimeout(loadFallback); afterLoad(); }).catch(function () { });
        }
      });
    }

    if (isMotion) {
      doEnter();
    } else {
      // probe starts the network request — doEnter fires after min 150ms exit time
      const probe = new Image();
      let probeReady = false;
      let minWaitDone = false;
      function maybeEnter() { if (probeReady && minWaitDone) doEnter(); }
      probe.onload = probe.onerror = function () { probeReady = true; maybeEnter(); };
      probe.src = p.src;
      // decode() fires after pixel decode — reliable Firefox alternative to img.complete
      if (probe.decode) probe.decode().then(function () { probeReady = true; maybeEnter(); }).catch(function () { });
      setTimeout(function () { minWaitDone = true; maybeEnter(); }, 150);
      setTimeout(doEnter, 600); // hard fallback
    }

  } else {
    // INITIAL OPEN
    const openGen = ++navGen;

    // media starts invisible — no content yet
    img.onload = null; img.onerror = null;
    img.src = '';
    img.style.transition = 'none';
    img.style.opacity = '0';
    img.style.transform = '';
    playerShell.innerHTML = '';
    playerShell.style.opacity = '0';

    // info panel fully hidden — no stale text visible
    const infoEl2 = document.getElementById('lightbox-info');
    if (infoEl2) {
      infoEl2.style.animation = 'none';
      infoEl2.style.opacity = '0';
    }

    lb.classList.add('open');
    document.body.classList.add('lightbox-open');
    lb.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    if (typeof liftZone !== 'undefined' && liftZone) liftZone.style.display = 'block';
    // allow other UI (cursor ring) to reset on lightbox open
    window.dispatchEvent(new Event('lightbox-open'));
    setTimeout(showFilmstrip, 300);

    const hint = document.getElementById('swipe-hint');
    if (hint) {
      hint.classList.add('visible');
      setTimeout(function () { hint.classList.remove('visible'); }, 2500);
    }

    let openLoadFired = false;
    function afterOpenLoad() {
      if (openLoadFired || openGen !== navGen) return;
      openLoadFired = true;
      img.onload = null; img.onerror = null;

      const bSrc = isMotion ? p.thumb : p.src;
      setLightboxBlur(bSrc);
      setLightboxContent(p);
      if (!isMotion) loadSwipeNeighbors();

      requestAnimationFrame(function () {
        if (openGen !== navGen) return;
        animateInfo(0);
        void img.offsetWidth; // force reflow — Firefox transition fix

        if (isMotion) {
          renderVideoInLightbox(p);
          playerShell.style.transition = 'opacity 0.45s ease';
          playerShell.style.opacity = '1';
        } else {
          img.style.transition = 'opacity 0.45s ease';
          img.style.opacity = '1';
        }
      });
    }

    // handlers BEFORE src — Firefox-safe
    let openFallback;
    requestAnimationFrame(function () {
      if (isMotion) {
        afterOpenLoad();
      } else {
        img.onload = function () { clearTimeout(openFallback); afterOpenLoad(); };
        img.onerror = function () { clearTimeout(openFallback); afterOpenLoad(); };
        img.src = p.src;
        openFallback = setTimeout(afterOpenLoad, 700);
        // decode() waits for pixel decode — reliable in Firefox unlike img.complete
        if (img.decode) img.decode().then(function () { clearTimeout(openFallback); afterOpenLoad(); }).catch(function () { });
      }
    });
  }
}

function renderVideoInLightbox(p) {
  const shell = document.getElementById('motion-player-shell');
  if (!shell) return;
  const ratio = p.aspectRatio || (16 / 9);
  shell.style.aspectRatio = ratio;
  shell.style.width = 'min(100%, calc((100svh - 15rem) * ' + ratio + '))';
  shell.innerHTML = getVideoPlayerMarkup(p);
  shell.style.opacity = '1';
  shell.style.display = 'block'; // Ensure it's not hidden
}

function startUnifiedMotionPlayer(id) {
  const prime = document.getElementById(id);
  if (!prime) return;
  const video = prime.querySelector('video');
  prime.classList.add('is-started');
  if (video) video.play().catch(function () { });
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (!lb.classList.contains('open')) return;
  const img = document.getElementById('lightbox-img');
  const activeGen = ++navGen; // invalidates all pending callbacks
  lb.classList.remove('open');
  document.body.classList.remove('lightbox-open');
  document.body.style.overflow = '';
  clearTimeout(filmstripHideTimer);
  hideFilmstrip();
  if (typeof liftZone !== 'undefined' && liftZone) liftZone.style.display = 'none';

  const playerShell = document.getElementById('motion-player-shell');
  if (playerShell) playerShell.innerHTML = '';

  document.getElementById('blur-layer-a').classList.remove('active');
  document.getElementById('blur-layer-b').classList.remove('active');
  // Reset hash to category on close
  if (window.location.hash && !isPopState) {
    const catSlug = getCategorySlug(currentCategory);
    history.pushState(null, null, '#' + catSlug);
  }

  // Delay DOM teardown until the opacity fade finishes
  setTimeout(function () {
    if (activeGen !== navGen) return; // Abort if user reopened lightbox quickly
    if (img) {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      img.classList.remove('zoomed');
      img.style.transition = '';
      img.style.transform = '';
      img.style.transformOrigin = '';
      img.style.opacity = '';
    }

    const info = document.getElementById('lightbox-info');
    if (info) {
      info.style.animation = 'none';
      info.style.opacity = '0';
      info.style.transition = '';
      info.style.filter = '';
      info.style.transform = '';
    }

    const content = document.getElementById('lightbox-content');
    if (content) {
      content.classList.remove('desc-open');
      content.style.transition = '';
      content.style.transform = '';
      content.style.transformOrigin = '';
      content.style.opacity = '';
    }
    const lb = document.getElementById('lightbox');
    if (lb) lb.classList.remove('zoom-active');

    if (isMobile) {
      const mWrap = document.getElementById('lightbox-img-wrap');
      if (mWrap) {
        mWrap.style.transform = '';
        mWrap.style.overflowX = '';
        mWrap.style.overflowY = '';
      }
      lbZoomLevel = 1;
      lbZoomPanX = 0;
      lbZoomPanY = 0;
      const slides = mWrap ? mWrap.querySelectorAll('.snap-slide') : [];
      for (let si = 0; si < slides.length; si++) {
        slides[si].style.opacity = '';
        slides[si].style.transition = '';
        const slideImg = slides[si].querySelector('img');
        if (slideImg) {
          slideImg.classList.remove('zoomed');
          slideImg.style.transform = '';
          slideImg.style.position = '';
          slideImg.style.zIndex = '';
          slideImg.style.cursor = '';
          delete slideImg.dataset.zoomAnimated;
        }
      }
    }

    const dark = document.getElementById('lightbox-zoom-darken');
    if (dark) dark.style.opacity = '0';
  }, 400);
}

function toggleLightboxDesc() {
  const content = document.getElementById('lightbox-content');
  const btn = document.getElementById('lightbox-desc-toggle');
  if (!content || !btn || btn.classList.contains('no-desc')) return;

  const imgWrap = document.getElementById('lightbox-img-wrap');
  const infoWrap = document.getElementById('lightbox-info-wrap');
  const desc = document.getElementById('lightbox-desc');
  const opening = !content.classList.contains('desc-open');

  if (!imgWrap || !infoWrap) {
    content.classList.toggle('desc-open', opening);
    btn.textContent = opening ? 'read less' : 'read more';
    updateLightboxDescPreview();
    if (opening) hideFilmstrip();
    else showFilmstrip();
    return;
  }

  const startImg = imgWrap.getBoundingClientRect();
  const startInfo = infoWrap.getBoundingClientRect();

  content.classList.toggle('desc-open', opening);
  btn.textContent = opening ? 'read less' : 'read more';
  updateLightboxDescPreview();
  if (opening) hideFilmstrip();
  else showFilmstrip();

  const endImg = imgWrap.getBoundingClientRect();
  const endInfo = infoWrap.getBoundingClientRect();
  const dImg = startImg.top - endImg.top;
  const dInfo = startInfo.top - endInfo.top;

  imgWrap.style.transition = 'none';
  imgWrap.style.transform = 'translateY(' + dImg + 'px)';
  infoWrap.style.transition = 'none';
  infoWrap.style.transform = 'translateY(' + dInfo + 'px)';
  if (desc) void desc.offsetHeight;

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      imgWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
      imgWrap.style.transform = '';
      infoWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
      infoWrap.style.transform = '';
      setTimeout(function () {
        imgWrap.style.transition = '';
        infoWrap.style.transition = '';
      }, 450);
    });
  });
}

// reset desc expansion on new photo
function resetDescToggle() {
  const info = document.getElementById('lightbox-info');
  const btn = document.getElementById('lightbox-desc-toggle');
  if (info) info.classList.remove('desc-open');
  if (btn) btn.textContent = 'read more';
}

let loadSwipeNeighbors = function () {
  if (currentLightboxIsMotion) return;
  const currentSet = getCurrentLightboxItems();
  const prev = (cur - 1 + currentSet.length) % currentSet.length;
  const next = (cur + 1) % currentSet.length;
  const p1 = new Image(); p1.src = currentSet[prev].src; if (p1.decode) p1.decode().catch(function () { });
  const p2 = new Image(); p2.src = currentSet[next].src; if (p2.decode) p2.decode().catch(function () { });
}

function navigateLightbox(d) {
  if (typeof lbZoomLevel !== 'undefined' && lbZoomLevel > 1) resetZoom();
  const currentSet = getCurrentLightboxItems();
  cur = (cur + d + currentSet.length) % currentSet.length;
  openLightbox(cur, d, currentLightboxIsMotion);
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeLightbox();
  }
  if (e.key === 'ArrowRight') navigateLightbox(1);
  if (e.key === 'ArrowLeft') navigateLightbox(-1);
});

// desktop: click bg to close
if (!isMobile) document.getElementById('lightbox-bg').addEventListener('click', closeLightbox);

// Continuous Zoom Physics Framework
let lbZoomLevel = 1;
let lbZoomPanX = 0;
let lbZoomPanY = 0;
let isDraggingZoom = false;
let lastDragX = 0;
let lastDragY = 0;

function updateZoomTransform(img) {
  const mWrap = document.getElementById('lightbox-img-wrap');
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.toggle('zoom-active', lbZoomLevel > 1);
  if (lbZoomLevel <= 1) {
    lbZoomLevel = 1;
    lbZoomPanX = 0;
    lbZoomPanY = 0;
    if (lb) lb.classList.remove('zoom-active');
    img.style.transform = '';
    // reset cursor
    img.style.cursor = '';
    img.style.position = '';
    img.style.zIndex = '';
    img.classList.remove('zoomed');
    const dark = document.getElementById('lightbox-zoom-darken');
    if (dark) dark.style.opacity = '0';
    showFilmstrip();
    if (isMobile) {
      mWrap.style.transform = ''; // revert translation
      mWrap.style.overflowX = 'auto'; // restore gallery swipe
      mWrap.style.overflowY = 'hidden';
      mWrap.scrollLeft = cur * mWrap.offsetWidth; // explicitly bind scroll back unconditionally
      const slides = mWrap.querySelectorAll('.snap-slide');
      for (let i = 0; i < slides.length; i++) slides[i].style.opacity = '1';
    }
  } else {
    if (lb) lb.classList.add('zoom-active');
    img.style.position = 'relative';
    img.style.zIndex = '100'; // Make sure the image pops cleanly above bounds

    // Mobile gets unconstrained panning, but auto-resets if dragged extremely far off-screen
    const zw = img.offsetWidth * lbZoomLevel;
    const zh = img.offsetHeight * lbZoomLevel;

    if (isMobile) {
      const limitX = (zw / 2) + (window.innerWidth / 2) - 80;
      const limitY = (zh / 2) + (window.innerHeight / 2) - 80;
      if (Math.abs(lbZoomPanX) > Math.max(0, limitX) || Math.abs(lbZoomPanY) > Math.max(0, limitY)) {
        resetZoom();
        return;
      }
    } else {
      // Desktop stays clamped so it's impossible to lose the image with the mouse
      const maxPanX = Math.max(0, (zw - window.innerWidth) / 2);
      const maxPanY = Math.max(0, (zh - window.innerHeight) / 2);
      lbZoomPanX = Math.max(-maxPanX, Math.min(maxPanX, lbZoomPanX));
      lbZoomPanY = Math.max(-maxPanY, Math.min(maxPanY, lbZoomPanY));
    }

    img.style.transform = 'translate(' + lbZoomPanX + 'px, ' + lbZoomPanY + 'px) scale(' + lbZoomLevel + ')';
    const hint = document.getElementById('swipe-hint');
    if (hint) hint.classList.remove('visible');

    if (!img.dataset.zoomAnimated) {
      img.classList.add('zoomed');
    } else {
      img.classList.remove('zoomed');
    }

    // zoom cursor
    if (!isMobile) img.style.cursor = 'grab';
    if (isDraggingZoom) img.style.cursor = 'grabbing';

    const dark = document.getElementById('lightbox-zoom-darken');
    // base darkness leaps to 30%, climbing dynamically to 90%
    if (dark) dark.style.opacity = Math.min(0.95, 0.3 + (lbZoomLevel - 1) * 0.5);
    hideFilmstrip();

    if (isMobile && mWrap.style.overflowX !== 'visible') {
      // Prevent browser from zero-ing out scroll when we swap to visible overflow
      mWrap.style.transform = 'translateX(-' + (cur * mWrap.offsetWidth) + 'px)';
      mWrap.style.overflowX = 'visible'; // allow zoom popping over descriptions and screens!
      mWrap.style.overflowY = 'visible';
      const slides = mWrap.querySelectorAll('.snap-slide');
      for (let i = 0; i < slides.length; i++) {
        if (parseInt(slides[i].dataset.idx) !== cur) slides[i].style.opacity = '0';
      }
    } else if (isMobile) {
      // already visible, ensure neighbors are hidden while panning to prevent peeking
      const slides = mWrap.querySelectorAll('.snap-slide');
      for (let i = 0; i < slides.length; i++) {
        if (parseInt(slides[i].dataset.idx) !== cur) slides[i].style.opacity = '0';
      }
    }
  }
}

function resetZoom() {
  lbZoomLevel = 1;
  const imgs = document.querySelectorAll('.zoomable');
  for (let i = 0; i < imgs.length; i++) updateZoomTransform(imgs[i]);
}

function toggleImageZoom(e) {
  if (isMobile) return; // Mobile tap logic is strictly handled in lbEl click listener
  const img = e.target;
  if (!img.classList.contains('zoomable')) return;
  e.stopPropagation();
  if (lbZoomLevel > 1) { resetZoom(); }
}
document.getElementById('lightbox-img').addEventListener('click', toggleImageZoom);

// Desktop mouse panning
const mWrap = document.getElementById('lightbox-img-wrap');
mWrap.addEventListener('mousedown', function (e) {
  if (isMobile || lbZoomLevel <= 1) return;
  isDraggingZoom = true;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  const img = document.getElementById('lightbox-img');
  if (img) img.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', function (e) {
  if (!isDraggingZoom) return;
  const dx = e.clientX - lastDragX;
  const dy = e.clientY - lastDragY;
  lbZoomPanX += dx;
  lbZoomPanY += dy;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  const img = document.getElementById('lightbox-img');
  if (img) updateZoomTransform(img);
});
window.addEventListener('mouseup', function () {
  if (isDraggingZoom) {
    isDraggingZoom = false;
    const img = document.getElementById('lightbox-img');
    if (img && lbZoomLevel > 1) img.style.cursor = 'grab';
  }
});


// Desktop: Mouse wheel / Touchpad pinch -> Zoom
document.getElementById('lightbox-img-wrap').addEventListener('wheel', function (e) {
  const lb = document.getElementById('lightbox');
  const mWrap = document.getElementById('lightbox-img-wrap');
  if (!lb.classList.contains('open') || isMobile) return;

  const img = isMobile ? mWrap.querySelector('.snap-slide[data-idx="' + cur + '"] img') : document.getElementById('lightbox-img');
  if (!img || !img.classList.contains('zoomable')) return;

  e.preventDefault();

  const scaleDelta = e.deltaY * -0.01;
  const newScale = Math.min(Math.max(1, lbZoomLevel + scaleDelta), 6);
  if (newScale === lbZoomLevel) return;

  const ratio = newScale / lbZoomLevel;
  const rect = img.getBoundingClientRect();

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let mx = e.clientX - cx;
  let my = e.clientY - cy;

  lbZoomPanX -= mx * (ratio - 1);
  lbZoomPanY -= my * (ratio - 1);
  lbZoomLevel = newScale;

  updateZoomTransform(img);
}, { passive: false });

// SWIPE for lightbox
const lbEl = document.getElementById('lightbox');
const imgWrap = document.getElementById('lightbox-img-wrap');
loadSwipeNeighbors = function () { };
let mobileScrollToSlide = null;
let swipeHappened = false;

let lastTapT = 0;

// mobile: tap content area (not interactive elements) to toggle filmstrip
lbEl.addEventListener('click', function (e) {
  if (!isMobile) return;
  if (swipeHappened) { swipeHappened = false; return; }
  if (e.target.closest('button, .filmstrip-thumb, #filmstrip-wrap, #lightbox-info')) return;

  const now = Date.now();
  if (e.target.tagName.toLowerCase() === 'img' && now - lastTapT < 350) {
    // Double tap zoom
    if (lbZoomLevel > 1) {
      resetZoom();
    } else {
      lbZoomLevel = 2.5;
      const img = e.target;
      const rect = img.getBoundingClientRect();
      lbZoomPanX = -(e.clientX - (rect.left + rect.width / 2)) * (lbZoomLevel - 1);
      lbZoomPanY = -(e.clientY - (rect.top + rect.height / 2)) * (lbZoomLevel - 1);
      img.dataset.zoomAnimated = "true";
      updateZoomTransform(img);
      setTimeout(function () {
        delete img.dataset.zoomAnimated;
        img.classList.add('zoomed'); // Disable transition for subsequent panning
      }, 360);
    }
    lastTapT = 0;
  } else {
    lastTapT = now;
    if (filmstripWrap.classList.contains('visible')) {
      hideFilmstrip();
    } else {
      showFilmstrip();
    }
  }
});

// ─── MOBILE SCROLL-SNAP GALLERY ───
// Native scroll container with snap points — browser handles touch physics
if (isMobile) {
  (function () {
    let slidesBuilt = false;
    let snapTimer = null;
    function clearSlides() {
      const slides = imgWrap.querySelectorAll('.snap-slide');
      slides.forEach(function (slide) { slide.remove(); });
      slidesBuilt = false;
      imgWrap.scrollLeft = 0;
    }

    // ── Build slides ──
    function buildSlides() {
      clearSlides();
      if (currentLightboxIsMotion) return;
      if (slidesBuilt) return;
      slidesBuilt = true;
      // Remove old #lightbox-img from flow (CSS hides it, but clear src too)
      const mainImg = document.getElementById('lightbox-img');
      if (mainImg) { mainImg.removeAttribute('src'); }
      activePhotos.forEach(function (p, i) {
        const slide = document.createElement('div');
        slide.className = 'snap-slide';
        slide.dataset.idx = i;
        const img = document.createElement('img');
        img.alt = p.title || '';
        img.draggable = false;
        img.loading = (Math.abs(i - cur) <= 2) ? 'eager' : 'lazy';
        img.src = p.src;
        img.classList.add('zoomable');
        img.addEventListener('click', toggleImageZoom);
        slide.appendChild(img);
        imgWrap.appendChild(slide);
      });
    }

    function scrollToSlide(idx, smooth, dir) {
      if (currentLightboxIsMotion) return;
      const w = imgWrap.offsetWidth;
      if (!w) return;
      if (smooth) {
        window.isAutoRapidScrolling = true;
        imgWrap.style.scrollSnapType = 'none'; // release OS clamp
        let startPos = imgWrap.scrollLeft;
        const targetPos = idx * w;
        const startTime = performance.now();
        const duration = 380; // mathematically sleek transition (faster than OS default)
        const slideDir = dir || (targetPos > startPos ? 1 : -1);

        const info = document.getElementById('lightbox-info');
        // Animate OLD text gracefully exiting and trigger the massive BG blur crossfade immediately
        const finalP = activePhotos[idx];
        setLightboxBlur(finalP.src);

        if (info) {
          info.style.transition = 'opacity 0.18s ease, filter 0.18s ease, transform 0.18s ease';
          info.style.opacity = '0';
          info.style.filter = 'blur(10px)';
          info.style.transform = 'translate3d(' + (-slideDir * 25) + 'px, 0, 0) scale(0.92)';
        }

        function step(time) {
          const elapsed = time - startTime;
          if (elapsed >= duration) {
            imgWrap.scrollTo({ left: targetPos, behavior: 'instant' });
            imgWrap.style.scrollSnapType = ''; // restore OS clamp

            // Allow CSS transition to execute without asynchronous scroll intercepts killing inline physics
            setTimeout(function () { window.isAutoRapidScrolling = false; }, 50);

            setLightboxContent(finalP);
            showFilmstrip();
            if (typeof updateLoading === 'function') updateLoading();

            const info = document.getElementById('lightbox-info');
            if (info) {
              // Ensure any previous 'transition: none' styles are flushed from memory before snapping
              info.style.transition = '';
              void info.offsetWidth;

              // Snap inline styles instantly to starting projection position for the new text
              info.style.transition = 'none';
              info.style.opacity = '0';
              info.style.filter = 'blur(12px)';
              info.style.transform = 'translate3d(' + (slideDir * 25) + 'px, 0, 0) scale(0.92)';

              // Fire arrival execution flush to completely eliminate the double-frame stutter delay
              void info.offsetWidth;

              info.style.transition = 'opacity 0.18s ease, filter 0.18s ease, transform 0.22s cubic-bezier(0.22,1,0.36,1)';
              info.style.opacity = '1';
              info.style.filter = '';
              info.style.transform = '';
            }
            return;
          }
          const t = elapsed / duration;
          const ease = 1 - Math.pow(1 - t, 4); // ease-out quart
          imgWrap.scrollTo({ left: startPos + (targetPos - startPos) * ease, behavior: 'instant' });
          requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      } else {
        imgWrap.scrollTo({ left: idx * w, behavior: 'instant' });
      }
    }
    mobileScrollToSlide = scrollToSlide;

    // Over-scroll loop detection bounds
    let wrapTouchX = 0;
    let isUserTouching = false;
    imgWrap.addEventListener('touchstart', function (e) {
      if (currentLightboxIsMotion) return;
      isUserTouching = true;
      if (e.touches.length === 1) wrapTouchX = e.touches[0].clientX;
    }, { passive: true });
    imgWrap.addEventListener('touchend', function (e) {
      if (currentLightboxIsMotion) return;
      isUserTouching = false;
      if (Math.abs(lbZoomLevel) > 1 || e.changedTouches.length !== 1) return;
      const dx = e.changedTouches[0].clientX - wrapTouchX;
      const maxScroll = imgWrap.scrollWidth - imgWrap.offsetWidth;
      if (imgWrap.scrollLeft >= maxScroll - 5 && dx < -45) {
        // Pulled left while on the last slide -> Loop to 0
        openLightbox(0, 1);
      } else if (imgWrap.scrollLeft <= 5 && dx > 45) {
        // Pulled right while on the first slide -> Loop to end
        openLightbox(activePhotos.length - 1, -1);
      } else {
        // Trigger final settle for current position
        onSnapSettle();
      }
    }, { passive: true });

    // ── Eager-load nearby slides ──
    function updateLoading() {
      if (currentLightboxIsMotion) return;
      const imgs = imgWrap.querySelectorAll('.snap-slide img');
      for (let i = 0; i < imgs.length; i++) {
        const shouldEager = (Math.abs(i - cur) <= 2);
        imgs[i].loading = shouldEager ? 'eager' : 'lazy';
        if (shouldEager && imgs[i].decode && !imgs[i].dataset.decoded) {
          (function (img) {
            img.decode().then(function () { img.dataset.decoded = "true"; }).catch(function () { });
          })(imgs[i]);
        }
      }
    }

    // ── Scroll settle — detect new active slide ──
    function onSnapSettle(targetIdx) {
      if (currentLightboxIsMotion) return;
      if (isUserTouching && typeof targetIdx === 'undefined') return;
      isManuallyNavigating = false; // Reset navigation flag on settle
      const w = imgWrap.offsetWidth;
      if (!w) return;
      const rawNearest = Math.round(imgWrap.scrollLeft / w);
      const idx = typeof targetIdx === 'number' ? targetIdx : Math.max(0, Math.min(rawNearest, activePhotos.length - 1));

      if (idx !== cur) {
        const dir = idx > cur ? 1 : -1;
        cur = idx;
        const p = activePhotos[cur];

        // blur bg crossfade immediately
        setLightboxBlur(p.src);

        setLightboxContent(p);
        showFilmstrip();
        updateLoading();
      }

      // enforce visible opacity if this was called by snap-settle completion (no arg)
      if (typeof targetIdx !== 'number') {
        const info = document.getElementById('lightbox-info');
        if (info) {
          // clear all lingering inline styles to prevent conflicts
          info.style.animation = 'none';
          info.style.transition = 'opacity 0.3s ease, filter 0.3s ease, transform 0.35s cubic-bezier(0.22,1,0.36,1)';
          info.style.opacity = '1';
          info.style.filter = '';
          info.style.transform = '';
          // clean up inline overrides after transition completes
          setTimeout(function () {
            if (!info.parentNode) return;
            info.style.animation = '';
            info.style.transition = '';
          }, 400);
        }
      }
    }

    // scrollend (Chrome 114+, Firefox 109+, Safari 18+)
    imgWrap.addEventListener('scrollend', function () {
      if (currentLightboxIsMotion) return;
      if (window.isAutoRapidScrolling) return; // Prevent layout snaps during math interpolation
      clearTimeout(snapTimer);
      if (!isManuallyNavigating) onSnapSettle();
    });
    imgWrap.addEventListener('scroll', function () {
      if (currentLightboxIsMotion) return;
      clearTimeout(snapTimer);
      snapTimer = setTimeout(onSnapSettle, 150);
      const w = imgWrap.offsetWidth;
      if (!w) return;
      const f = imgWrap.scrollLeft / w;

      const hint = document.getElementById('swipe-hint');
      if (hint && Math.abs(imgWrap.scrollLeft - cur * w) > 10) {
        hint.classList.remove('visible');
      }

      // smoothly sync filmstrip scrub to native drag
      if (!fsRaf && !isManuallyNavigating && !window.isAutoRapidScrolling && !isTouchingFilmstrip) {
        const thumbs = filmstripEl.querySelectorAll('.filmstrip-thumb');
        if (thumbs.length > 0) {
          const thumbW = thumbs[0].offsetWidth;
          const gap = 5;
          const paddingLeft = parseFloat(filmstripEl.style.paddingLeft) || 0;
          const targetCenter = paddingLeft + f * (thumbW + gap) + thumbW / 2;
          startFsSync(targetCenter - filmstripEl.offsetWidth / 2);
        }
      }

      let nearest = Math.round(f);
      nearest = Math.max(0, Math.min(nearest, activePhotos.length - 1));

      // rapid scroll mode suspends normal text updates to keep transition fluid
      if (window.isAutoRapidScrolling) {
        cur = nearest;
        return;
      }

      // preload text underneath if we cross 50% mark — but ONLY if not currently holding
      if (nearest !== cur && !isUserTouching && !isManuallyNavigating) {
        onSnapSettle(nearest);
      }

      const dist = Math.abs(imgWrap.scrollLeft - nearest * w) / w;
      const info = document.getElementById('lightbox-info');
      if (info) {
        info.style.animation = 'none';
        info.style.transition = 'none';
        const swipeDelta = imgWrap.scrollLeft - cur * w;

        if (dist === 0) {
          info.style.opacity = '1';
          info.style.filter = '';
          info.style.transform = '';
        } else {
          // 1:1 physical mapping — fades completely out by 16% scroll distance
          const op = Math.max(0, 1 - dist * 6.25);
          const bl = Math.min(10, dist * 40);
          // Calculate slide direction offset
          const tx = swipeDelta > 0 ? Math.max(-20, -dist * 80) : Math.min(20, dist * 80);

          info.style.opacity = op.toString();
          info.style.filter = 'blur(' + bl + 'px)';
          info.style.transform = 'translateX(' + tx + 'px)';
        }
      }
    }, { passive: true });

    // ── Setup on lightbox open ──
    window.addEventListener('lightbox-open', function () {
      if (currentLightboxIsMotion) {
        clearSlides();
        requestAnimationFrame(function () {
          const motionItem = motionProjects[cur];
          if (motionItem) {
            setLightboxContent(motionItem);
            animateInfo(0);
          }
        });
        return;
      }
      buildSlides();
      requestAnimationFrame(function () {
        scrollToSlide(cur, false);
        updateLoading();
        onSnapSettle(cur);
        const p = activePhotos[cur];
        setLightboxContent(p);
        animateInfo(0);
      });
    });

    // Override loadSwipeNeighbors
    loadSwipeNeighbors = function () { updateLoading(); };

    // Re-align on resize/orientation change
    window.addEventListener('resize', function () {
      if (lbEl.classList.contains('open')) {
        scrollToSlide(cur, false);
      }
    });

    // ─── SWIPE DOWN TO DISMISS & PINCH TO ZOOM ───
    let dStartX = 0, dStartY = 0, dDY = 0;
    let dLocked = false, dChecked = false;
    let dPts = [];
    let isPinching = false, pinchInitDist = 0, pinchInitLevel = 1, pinchInitPanX = 0, pinchInitPanY = 0, pinchInitMx = 0, pinchInitMy = 0, pinchInitCx = 0, pinchInitCy = 0;

    lbEl.addEventListener('touchstart', function (e) {
      if (!lbEl.classList.contains('open')) return;
      // stricter check to prevent interaction fight between filmstrip and dismiss gesture
      if (e.target.closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb')) return;

      if (e.touches.length === 2 && !dLocked) {
        isPinching = true;
        pinchInitDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        pinchInitLevel = lbZoomLevel;
        pinchInitPanX = lbZoomPanX;
        pinchInitPanY = lbZoomPanY;

        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        pinchInitCx = cx;
        pinchInitCy = cy;
        const mWrap = document.getElementById('lightbox-img-wrap');
        const img = mWrap.querySelector('.snap-slide[data-idx="' + cur + '"] img');
        if (img) {
          const rect = img.getBoundingClientRect();
          pinchInitMx = cx - (rect.left + rect.width / 2);
          pinchInitMy = cy - (rect.top + rect.height / 2);
        }

        if (isMobile) {
          const mWrap = document.getElementById('lightbox-img-wrap');
          const slides = mWrap.querySelectorAll('.snap-slide');
          for (let i = 0; i < slides.length; i++) {
            if (parseInt(slides[i].dataset.idx) !== cur) {
              slides[i].style.transition = 'none';
              slides[i].style.opacity = '0';
            }
          }
        }
        return;
      }

      if (isPinching) return;

      if (lbZoomLevel > 1 && e.touches.length === 1) {
        dStartX = e.touches[0].clientX;
        dStartY = e.touches[0].clientY;
        return;
      }

      dStartX = e.touches[0].clientX;
      dStartY = e.touches[0].clientY;
      dDY = 0;
      dLocked = false;
      dChecked = false;
      dPts = [{ y: dStartY, t: Date.now() }];
    }, { passive: false });

    lbEl.addEventListener('touchmove', function (e) {
      if (e.target.closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb')) return;
      if (isPinching && e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const ratio = dist / pinchInitDist;
        const newScale = Math.min(Math.max(1, pinchInitLevel * ratio), 6);
        if (newScale === lbZoomLevel) return;

        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const dx = cx - pinchInitCx;
        const dy = cy - pinchInitCy;

        lbZoomLevel = newScale;
        lbZoomPanX = pinchInitPanX - pinchInitMx * (newScale / pinchInitLevel - 1) + dx;
        lbZoomPanY = pinchInitPanY - pinchInitMy * (newScale / pinchInitLevel - 1) + dy;

        const mWrap = document.getElementById('lightbox-img-wrap');
        const img = mWrap.querySelector('.snap-slide[data-idx="' + cur + '"] img');
        if (img) updateZoomTransform(img);
        return;
      }

      if (lbZoomLevel > 1 && e.touches.length === 1 && !isPinching) {
        e.preventDefault();
        const dx = e.touches[0].clientX - dStartX;
        const dy = e.touches[0].clientY - dStartY;
        lbZoomPanX += dx;
        lbZoomPanY += dy;
        dStartX = e.touches[0].clientX;
        dStartY = e.touches[0].clientY;
        const mWrap = document.getElementById('lightbox-img-wrap');
        const img = mWrap.querySelector('.snap-slide[data-idx="' + cur + '"] img');
        if (img) updateZoomTransform(img);
        return;
      }

      if (isPinching || e.touches.length !== 1) return;

      if (dChecked && !dLocked) return;
      const dx = e.touches[0].clientX - dStartX;
      const dy = e.touches[0].clientY - dStartY;
      dPts.push({ y: e.touches[0].clientY, t: Date.now() });
      if (dPts.length > 8) dPts.shift();

      if (!dChecked && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        dChecked = true;
        dLocked = dy > 0 && Math.abs(dy) > Math.abs(dx);
      }

      if (dLocked && dy > 0) {
        dDY = dy;
        e.preventDefault();
        const content = document.getElementById('lightbox-content');
        content.style.transition = 'none';
        const tilt = Math.max(-10, (dy / 400) * -10); // reduced from -25
        content.style.transformOrigin = 'bottom left';
        content.style.transform = 'translateY(' + dy + 'px) rotate(' + tilt + 'deg)';
        content.style.opacity = Math.max(0.15, 1 - dy / 400);

        const info = document.getElementById('lightbox-info');
        if (info) {
          const blurVal = Math.min(18, (dy / 300) * 18);
          const txtOpac = Math.max(0, 1 - dy / 180);
          info.style.transition = 'none';
          info.style.filter = 'blur(' + blurVal + 'px)';
          info.style.opacity = txtOpac;
        }
      }
    }, { passive: false });

    lbEl.addEventListener('touchend', function (e) {
      if (e.target.closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb')) return;
      if (e.touches.length < 2) {
        if (isPinching && e.touches.length === 1 && lbZoomLevel > 1) {
          dStartX = e.touches[0].clientX;
          dStartY = e.touches[0].clientY;
        }
        isPinching = false;

        if (lbZoomLevel <= 1 && isMobile) {
          const mWrap = document.getElementById('lightbox-img-wrap');
          const slides = mWrap.querySelectorAll('.snap-slide');
          for (let i = 0; i < slides.length; i++) {
            slides[i].style.transition = '';
            slides[i].style.opacity = '1';
          }
        }
      }

      if (!dLocked) return;
      let vy = 0;
      if (dPts.length >= 2) {
        const a = dPts[Math.max(0, dPts.length - 4)], b = dPts[dPts.length - 1];
        const dt = b.t - a.t;
        if (dt > 0) vy = (b.y - a.y) / dt;
      }
      if (dDY > 100 || vy > 0.35) {
        swipeHappened = true;
        const content = document.getElementById('lightbox-content');
        content.style.transition = 'transform 0.28s ease-out, opacity 0.28s ease-out';
        content.style.transform = 'translateY(' + window.innerHeight + 'px) rotate(-30deg)';
        content.style.opacity = '0';

        const info = document.getElementById('lightbox-info');
        if (info) {
          info.style.transition = 'opacity 0.2s ease, filter 0.2s ease';
          info.style.filter = 'blur(18px)';
          info.style.opacity = '0';
        }

        setTimeout(function () {
          closeLightbox();
        }, 280);
      } else {
        const content = document.getElementById('lightbox-content');
        content.style.transition = 'transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.35s ease';
        content.style.transform = '';
        content.style.opacity = '1';

        const info = document.getElementById('lightbox-info');
        if (info) {
          info.style.transition = 'opacity 0.35s ease, filter 0.35s ease';
          info.style.filter = '';
          info.style.opacity = '1';
        }

        setTimeout(function () {
          if (content) {
            content.style.transition = '';
            content.style.transformOrigin = '';
          }
          if (info) {
            info.style.transition = '';
          }
        }, 360);
      }
      dLocked = false;
      dChecked = false;
    }, { passive: true });

    lbEl.addEventListener('touchend', function (e) {
      if (!lbEl.classList.contains('open') || !currentLightboxIsMotion) return;
      if (isPinching || dLocked || e.changedTouches.length !== 1 || lbZoomLevel > 1) return;
      if (e.target.closest('#filmstrip-wrap, #filmstrip-lift-zone, .filmstrip-thumb, button')) return;

      const dx = e.changedTouches[0].clientX - dStartX;
      const dy = e.changedTouches[0].clientY - dStartY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        swipeHappened = true;
        navigateLightbox(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  })();
}

const cardObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      const card = entry.target;
      const img = card.querySelector('img');

      const reveal = function () {
        card.classList.add('revealed');
        cardObserver.unobserve(card);
      };

      if (img && img.complete && img.naturalHeight !== 0) {
        reveal();
      } else if (img) {
        img.addEventListener('load', reveal, { once: true });
        img.addEventListener('error', reveal, { once: true });
      }
    }
  });
}, { rootMargin: '0px 0px -60px 0px' });

function revealCards() {
  document.querySelectorAll('.photo-card:not(.revealed)').forEach(function (card) {
    cardObserver.observe(card);
  });
}

// MASONRY — scroll reveal handles fade-in
// aspect ratios cached in localStorage to prevent CLS on repeat visits
const RATIO_CACHE_KEY = 'van_ratios_v1';
let ratioCache = {};
try {
  const stored = localStorage.getItem(RATIO_CACHE_KEY);
  if (stored) ratioCache = JSON.parse(stored);
} catch (e) { }

function saveRatioCache() {
  try { localStorage.setItem(RATIO_CACHE_KEY, JSON.stringify(ratioCache)); } catch (e) { }
}

function rebuildGallery(newCategory, options) {
  options = options || {};
  const m = document.getElementById('masonry');
  if (!m) return;
  const oldCategory = currentCategory;

  // 1. Height Lock: Keep the page at its current length
  const currentHeight = m.offsetHeight;
  m.style.minHeight = currentHeight + 'px';

  // 1.5 Anchor View: Ensure tap switches begin from the gallery header.
  // Swipe commits preserve the user's exact scroll position so sticky state doesn't jump.
  const header = document.getElementById('gallery-header');
  const lockedScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  if (!options.preserveScroll && header) {
    const headerPos = header.getBoundingClientRect().top + window.pageYOffset;
    if (lockedScrollY > headerPos) {
      if (window.lenis) window.lenis.scrollTo(headerPos, { immediate: true });
      else window.scrollTo({ top: headerPos, behavior: 'auto' });
    }
  }

  // 2. Fast Swap
  setTimeout(function () {
    const order = ['all', 'figures', 'motion'];
    const oldIdx = order.indexOf(oldCategory);
    const newIdx = order.indexOf(newCategory);
    const direction = newIdx > oldIdx ? 'right' : 'left';
    const slideX = direction === 'left' ? '-40px' : '40px';

    currentCategory = newCategory;
    updateActivePhotos();

    // Update URL hash for category if lightbox not open
    if (!document.getElementById('lightbox').classList.contains('open') && !isPopState) {
      const catSlug = getCategorySlug(newCategory);
      const curHash = window.location.hash.substring(1);
      // Only update if the hash doesn't already start with this category slug (prevents wiping item slugs)
      if (!curHash.startsWith(catSlug)) {
        history.pushState(null, null, '#' + catSlug);
      }
    }

    window.dispatchEvent(new Event('category-change'));

    m.innerHTML = '';
    m.classList.toggle('motion-grid-active', newCategory === 'motion');
    const gallerySec = document.getElementById('gallery-section');
    if (gallerySec) gallerySec.classList.toggle('motion-active', newCategory === 'motion');
    m.classList.remove('switching');
    m.style.transition = '';
    m.style.transform = '';

    if (options.animate) {
      m.style.setProperty('--masonry-x', slideX);
      void m.offsetWidth;
      m.classList.add('switching');
    }

    buildMasonry();
    if (!options.animate) {
      m.querySelectorAll('.photo-card').forEach(function (card) {
        card.style.transition = 'none';
        card.classList.add('revealed');
        setTimeout(function () { card.style.transition = ''; }, 80);
      });
    }
    requestAnimationFrame(function () {
      m.style.minHeight = Math.max(currentHeight, m.offsetHeight) + 'px';
      if (options.preserveScroll) { if (window.lenis) window.lenis.scrollTo(lockedScrollY, { immediate: true }); else window.scrollTo(0, lockedScrollY); }
      if (window.updateCustomScrollbar) window.updateCustomScrollbar();
    });

    // 3. Update Nav UI
    const photoBtn = document.querySelector('.photographs-btn');
    const figuresBtn = document.querySelector('.figures-btn');
    const motionBtn = document.querySelector('.motion-btn');
    [photoBtn, figuresBtn, motionBtn].forEach(function (b) { if (b) { b.classList.remove('active'); b.classList.add('inactive'); } });
    if (newCategory === 'all' && photoBtn) { photoBtn.classList.remove('inactive'); photoBtn.classList.add('active'); }
    if (newCategory === 'figures' && figuresBtn) { figuresBtn.classList.remove('inactive'); figuresBtn.classList.add('active'); }
    if (newCategory === 'motion' && motionBtn) { motionBtn.classList.remove('inactive'); motionBtn.classList.add('active'); }

    // 4. Cleanup
    let updateCount = 0;
    const updateInterval = setInterval(function () {
      if (window.updateCustomScrollbar) window.updateCustomScrollbar();
      if (++updateCount >= 6) clearInterval(updateInterval);
    }, 100);

    setTimeout(function () {
      m.style.minHeight = '';
      if (options.preserveScroll) { if (window.lenis) window.lenis.scrollTo(lockedScrollY, { immediate: true }); else window.scrollTo(0, lockedScrollY); }
      if (window.updateCustomScrollbar) window.updateCustomScrollbar();
    }, 600);
  }, 0);
}



function initFilters() {
  const photoBtn = document.querySelector('#gallery-header .photographs-btn');
  const figuresBtn = document.querySelector('#gallery-header .figures-btn');
  const motionBtn = document.querySelector('#gallery-header .motion-btn');

  // Highlight initial category based on detected route
  [photoBtn, figuresBtn, motionBtn].forEach(function (b) { if (b) { b.classList.remove('active'); b.classList.add('inactive'); } });
  if (currentCategory === 'all' && photoBtn) { photoBtn.classList.remove('inactive'); photoBtn.classList.add('active'); }
  if (currentCategory === 'figures' && figuresBtn) { figuresBtn.classList.remove('inactive'); figuresBtn.classList.add('active'); }
  if (currentCategory === 'motion' && motionBtn) { motionBtn.classList.remove('inactive'); motionBtn.classList.add('active'); }

  if (photoBtn) {
    photoBtn.addEventListener('click', function () {
      if (currentCategory === 'all') return;
      rebuildGallery('all', { animate: true });
    });
  }

  if (figuresBtn) {
    figuresBtn.addEventListener('click', function () {
      if (currentCategory === 'figures') return;
      rebuildGallery('figures', { animate: true });
    });
  }

  if (motionBtn) {
    motionBtn.addEventListener('click', function () {
      if (currentCategory === 'motion') return;
      rebuildGallery('motion', { animate: true });
    });
  }


}

function buildMasonry() {
  const m = document.getElementById('masonry');
  if (!m) return;
  m.innerHTML = '';
  let lastYear = null;

  const isMotion = (currentCategory === 'motion');
  const items = isMotion ? motionProjects : activePhotos;
  const isSwitching = m.classList.contains('switching');
  let yearGrid = null;
  let columns = [];
  let colHeights = [];
  const numCols = (window.innerWidth >= 1024) ? 4 : 3;

  items.forEach(function (p, i) {
    const currentYear = p.date ? (p.date.match(/\d{4}/) || ["undated"])[0] : "undated";

    if (currentYear !== lastYear) {
      const yearSection = document.createElement('section');
      yearSection.className = 'masonry-year';

      const header = document.createElement('div');
      header.className = 'date-header';
      header.textContent = currentYear;
      yearSection.appendChild(header);

      yearGrid = document.createElement('div');
      yearGrid.className = 'masonry-year-grid';
      yearSection.appendChild(yearGrid);

      columns = [];
      colHeights = [];
      for (let c = 0; c < numCols; c++) {
        const col = document.createElement('div');
        col.className = 'masonry-column';
        yearGrid.appendChild(col);
        columns.push(col);
        colHeights.push(0);
      }

      m.appendChild(yearSection);
      lastYear = currentYear;
    }

    const card = document.createElement('div');
    card.className = isMotion ? 'photo-card motion-card' : 'photo-card';
    const imgEl = document.createElement('img');

    const basePath = isMotion ? (p.thumb || "") : (p.src || "");
    const thumbPath = basePath.includes('thumbs/') ? basePath : basePath.replace('photos/', 'photos/thumbs/');

    imgEl.src = thumbPath;
    imgEl.alt = p.title || "video";
    imgEl.loading = 'lazy';

    const r = parseFloat(p.aspectRatio || ratioCache[basePath] || 1);
    imgEl.style.aspectRatio = r;

    if (!p.aspectRatio && !ratioCache[basePath]) {
      imgEl.addEventListener('load', function () {
        if (imgEl.naturalWidth && imgEl.naturalHeight) {
          const ratio = (imgEl.naturalWidth / imgEl.naturalHeight).toFixed(4);
          ratioCache[basePath] = ratio;
          imgEl.style.aspectRatio = ratio;
          saveRatioCache();
        }
      });
    }

    const overlay = document.createElement('div');
    overlay.className = 'photo-card-overlay';
    overlay.innerHTML = '<div class="photo-card-title">' + (p.title || "") + '</div><div class="photo-card-date">' + (p.date || "undated") + '</div>';
    card.appendChild(imgEl);
    card.appendChild(overlay);

    card.addEventListener('click', (function (idx) {
      return function () { openLightbox(idx, 0, isMotion); };
    })(i));

    // Shortest-column distribution
    let shortestIdx = 0;
    let minH = colHeights[0];
    for (let h = 1; h < numCols; h++) {
      if (colHeights[h] < minH) {
        minH = colHeights[h];
        shortestIdx = h;
      }
    }

    if (columns[shortestIdx]) {
      columns[shortestIdx].appendChild(card);
      colHeights[shortestIdx] += (1 / r);
    }
  });

  setTimeout(revealCards, 150);
}



// PARALLAX
let scrollY = 0;
window.addEventListener('scroll', function () { scrollY = window.scrollY; }, { passive: true });

// CAROUSEL
const ROW_CONFIG = [{ dir: -1 }, { dir: 1 }, { dir: -1 }, { dir: 1 }];
// cruise speed scaled by device — mobile narrower so same px/frame looks faster
const CRUISE_SPEED = isMobile ? 0.28 : (window.innerWidth < 1024 ? 0.36 : 0.45);
const EASE_FRAMES = 120;
const START_SPEED_MULT = 8.0;

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function getCurrentSpeed(frame) {
  if (frame >= EASE_FRAMES) return CRUISE_SPEED;
  const t = frame / EASE_FRAMES;
  return CRUISE_SPEED * START_SPEED_MULT + (CRUISE_SPEED - CRUISE_SPEED * START_SPEED_MULT) * easeOutCubic(t);
}

const rowState = ROW_CONFIG.map(function (c) { return { dir: c.dir, offset: 0, setWidth: 0 }; });
let easeFrame = 0;

function buildCarousel() {
  const rowIds = ['row-0', 'row-1', 'row-2', 'row-3'];
  const rows = rowIds.map(function (id) { return document.getElementById(id); });

  // show/hide row-3 based on device
  if (isMobile) {
    rows[3].style.display = 'flex';
  } else {
    rows[3].style.display = 'none';
  }

  const activeRows = isMobile ? rows : rows.slice(0, 3);
  const activeRowCount = activeRows.length;

  if (carouselPhotos.length === 0) { startLoops(); return; }

  // rows stay visible; eager images handle their own fade-in
  activeRows.forEach(function (r) { r.style.opacity = '1'; });

  const groups = [];
  for (let g = 0; g < activeRowCount; g++) groups.push([]);
  carouselPhotos.forEach(function (p, i) { groups[i % activeRowCount].push(p); });

  const eagerImgs = [];

  activeRows.forEach(function (row, ri) {
    const group = groups[ri].length > 0 ? groups[ri] : carouselPhotos;
    const copies = Math.max(2, Math.ceil((window.innerWidth * 3) / 220 / group.length));

    for (let c = 0; c < copies * 2; c++) {
      group.forEach(function (p) {
        const img = document.createElement('img');
        const thumbPath = p.src.replace('photos/', 'photos/thumbs/');
        img.src = thumbPath; img.alt = p.title; img.draggable = false;
        if (c === 0) {
          img.loading = 'eager';
          // start invisible — fade in on load so images don't cut in on cold load
          img.style.opacity = '0';
          img.addEventListener('load', function () { img.style.opacity = '1'; });
          img.addEventListener('error', function () { img.style.opacity = '1'; });
          eagerImgs.push(img);
        } else {
          img.loading = 'lazy';
        }
        img.addEventListener('click', function () {
          const targetCat = (p.category === 'figures') ? 'figures' : 'all';
          if (currentCategory === targetCat) {
            const idx = activePhotos.indexOf(p);
            if (idx >= 0) openLightbox(idx);
          } else {
            rebuildGallery(targetCat);
            // Wait for the async rebuildGallery to update activePhotos
            setTimeout(function () {
              const idx = activePhotos.indexOf(p);
              if (idx >= 0) openLightbox(idx);
            }, 100);
          }
        });
        row.appendChild(img);
      });
    }
  });

  let loaded = 0;
  let total = eagerImgs.length;

  function onImageReady() {
    if (++loaded < total) return;
    // defer to next paint — Firefox offsetWidth is 0 if read before layout pass
    requestAnimationFrame(function () {
      activeRows.forEach(function (row, ri) {
        const group = groups[ri].length > 0 ? groups[ri] : carouselPhotos;
        const copies = Math.max(2, Math.ceil((window.innerWidth * 3) / 220 / group.length));
        const imgs = Array.from(row.querySelectorAll('img'));
        let w = 0;
        for (let i = 0; i < group.length * copies && i < imgs.length; i++) w += (imgs[i].offsetWidth || 220) + 10;
        rowState[ri].setWidth = w > 0 ? w : group.length * copies * 230;
        if (ROW_CONFIG[ri].dir === 1) rowState[ri].offset = -rowState[ri].setWidth;
      });
      activeRows.forEach(function (r) { r.style.opacity = '1'; }); // already visible, belt-and-suspenders
      if (window.__onCarouselReady) window.__onCarouselReady();
      startLoops();
    });
  }

  if (total === 0) { activeRows.forEach(function (r) { r.style.opacity = '1'; }); startLoops(); return; }
  eagerImgs.forEach(function (img) {
    let counted = false;
    function countOnce() { if (!counted) { counted = true; onImageReady(); } }
    img.addEventListener('load', countOnce);
    img.addEventListener('error', countOnce);
    if (img.complete) {
      // already cached — decode() waits for pixel decode before resolving
      if (img.decode) {
        img.decode().then(countOnce).catch(countOnce);
      } else {
        // no decode() — nudge src to retrigger load event (cached, no network hit)
        const s = img.src; img.src = ''; img.src = s;
      }
    }
  });
}

function tick() {
  if (!heroVisible || !pageVisible) { heroRafId = null; return; }
  const rowIds = isMobile ? ['row-0', 'row-1', 'row-2', 'row-3'] : ['row-0', 'row-1', 'row-2'];
  const rows = rowIds.map(function (id) { return document.getElementById(id); });
  const speed = getCurrentSpeed(easeFrame);
  if (easeFrame < EASE_FRAMES + 10) easeFrame++;

  const px = [scrollY * 0.18, -scrollY * 0.12, scrollY * 0.22, -scrollY * 0.15];

  rowState.forEach(function (state, ri) {
    if (ri >= rows.length) return;
    state.offset += speed * state.dir;
    if (state.setWidth > 0) {
      if (state.dir === -1 && state.offset < -state.setWidth) state.offset += state.setWidth;
      if (state.dir === 1 && state.offset > 0) state.offset -= state.setWidth;
    }
    rows[ri].style.transform = 'translateX(' + (state.offset + px[ri]) + 'px)';
  });

  heroRafId = requestAnimationFrame(tick);
}

// CURSOR - mouse only
const isMouseDevice = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
if (isMouseDevice) {
  const cursor = document.getElementById('cursor');
  const ring = document.getElementById('cursor-ring');
  let mx = 0, my = 0, rx = 0, ry = 0;
  let cursorVisible = false;
  let isDraggingScrollbar = false;

  // Fade out when cursor leaves the viewport — use both document and documentElement for cross-browser coverage
  function hideCursor() {
    cursor.style.opacity = '0'; ring.style.opacity = '0';
    cursorVisible = false;
  }
  function showCursor() {
    if (cursorVisible) return;
    cursorVisible = true;
    cursor.style.opacity = '1'; ring.style.opacity = '1';
  }

  let cursorTimeout;
  function resetCursorTimeout() {
    showCursor();
    clearTimeout(cursorTimeout);
    // If mouse is idle for 2s, fade out to prevent "stuck" feeling over overlays
    cursorTimeout = setTimeout(hideCursor, 2000);
  }

  document.addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY;
    cursor.style.left = mx + 'px'; cursor.style.top = my + 'px';

    if (isDraggingScrollbar) {
      hideCursor();
    } else {
      resetCursorTimeout();
    }
  });

  // the thin ring that follows the dot around
  (function animateRing() { rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2; ring.style.left = rx + 'px'; ring.style.top = ry + 'px'; requestAnimationFrame(animateRing); })();

  // Respond to hold (mousedown)
  window.addEventListener('mousedown', function (e) {
    // If clicking near the right edge (scrollbar zone), hide the cursor
    if (e.clientX >= window.innerWidth - 32) {
      isDraggingScrollbar = true;
      hideCursor();
      return;
    }

    cursor.style.transform = 'translate(-50%,-50%) scale(0.65)';
    ring.style.transform = 'translate(-50%,-50%) scale(0.9)';
  });
  window.addEventListener('mouseup', function () {
    isDraggingScrollbar = false;
    showCursor();
    cursor.style.transform = 'translate(-50%,-50%) scale(1)';
    ring.style.transform = 'translate(-50%,-50%) scale(1)';
  });

  window.addEventListener('blur', hideCursor);

  document.addEventListener('mouseleave', hideCursor);
  document.documentElement.addEventListener('mouseleave', hideCursor);
  document.addEventListener('mouseenter', showCursor);
  document.documentElement.addEventListener('mouseenter', showCursor);
  document.addEventListener('contextmenu', function () { hideCursor(); cursor.style.transform = 'translate(-50%,-50%) scale(0.6)'; });
  // Delegated hover for cursor ring — works on dynamically added cards and carousel imgs
  const interactiveSelector = 'button, .photo-card, #scroll-hint, .carousel-row img, .footer-instagram';
  document.addEventListener('mouseover', function (e) {
    if (e.target.matches(interactiveSelector) || e.target.closest('.photo-card, #scroll-hint, .footer-instagram')) {
      ring.style.width = '44px'; ring.style.height = '44px'; ring.style.borderColor = 'rgba(221,216,207,0.4)';
    }
  });
  document.addEventListener('mouseout', function (e) {
    if (e.target.matches(interactiveSelector) || e.target.closest('.photo-card, #scroll-hint, .footer-instagram')) {
      ring.style.width = '28px'; ring.style.height = '28px'; ring.style.borderColor = 'rgba(221,216,207,0.25)';
    }
  });

  // reset ring when lightbox opens — hover context is lost when carousel img is covered
  window.addEventListener('lightbox-open', function () {
    ring.style.width = '28px'; ring.style.height = '28px'; ring.style.borderColor = 'rgba(221,216,207,0.25)';
  });
}

// ADVANCED CUSTOM SCROLLBAR CONTROLLER
(function initCustomScrollbar() {
  const track = document.getElementById('custom-scrollbar');
  const thumb = document.getElementById('custom-scrollbar-thumb');
  if (!track || !thumb) return;

  let isDragging = false;
  let startY, startScroll;
  let fadeTimer = null;

  function updateThumb() {
    const winH = window.innerHeight;
    const docH = document.documentElement.scrollHeight;
    const scrollT = window.pageYOffset || document.documentElement.scrollTop;

    if (docH <= winH + 5) {
      track.style.display = 'none';
      return;
    } else {
      track.style.display = 'block';
    }

    const thumbH = Math.max(30, (winH / docH) * winH);
    const maxTrack = winH - thumbH;
    const maxScroll = docH - winH;
    const thumbY = (scrollT / maxScroll) * maxTrack;

    thumb.style.height = thumbH + 'px';
    thumb.style.transform = 'translateY(' + thumbY + 'px)';

    if (isMobile) {
      track.classList.add('moving');
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(function () {
        if (!isDragging) track.classList.remove('moving');
      }, 3000);
    }
  }

  // Track interaction (click to jump + start dragging)
  track.addEventListener('mousedown', function (e) {
    isDragging = true;
    track.classList.add('dragging');
    document.body.classList.add('is-dragging-scrollbar');

    const winH = window.innerHeight;
    const docH = document.documentElement.scrollHeight;
    const thumbH = parseFloat(thumb.style.height);
    const maxTrack = winH - thumbH;
    const maxScroll = docH - winH;

    // Jump to clicked position immediately IF clicking the track, not the thumb
    // We check vertical bounds so grabbing the 'invisible hit zone' next to the thumb still counts as a grab
    const thumbRect = thumb.getBoundingClientRect();
    const isClickingThumb = e.clientY >= thumbRect.top && e.clientY <= thumbRect.bottom;

    if (!isClickingThumb) {
      const clickY = e.clientY - (thumbH / 2); // Center thumb on click
      const scrollPos = (clickY / maxTrack) * maxScroll;
      if (window.lenis) window.lenis.scrollTo(scrollPos, { immediate: true }); else window.scrollTo(0, scrollPos);
    }

    startY = e.clientY;
    startScroll = window.pageYOffset || document.documentElement.scrollTop;

    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  window.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    const deltaY = e.clientY - startY;
    const winH = window.innerHeight;
    const docH = document.documentElement.scrollHeight;
    const thumbH = parseFloat(thumb.style.height);
    const maxTrack = winH - thumbH;
    const maxScroll = docH - winH;

    const scrollDelta = (deltaY / maxTrack) * maxScroll;
    if (window.lenis) window.lenis.scrollTo(startScroll + scrollDelta, { immediate: true }); else window.scrollTo(0, startScroll + scrollDelta);
  });

  window.addEventListener('mouseup', function () {
    if (isDragging) {
      isDragging = false;
      track.classList.remove('dragging');
      document.body.classList.remove('is-dragging-scrollbar');
      document.body.style.userSelect = '';
      if (isMobile) {
        clearTimeout(fadeTimer);
        fadeTimer = setTimeout(function () { track.classList.remove('moving'); }, 3000);
      }
    }
  });

  window.addEventListener('scroll', updateThumb, { passive: true });
  window.addEventListener('resize', updateThumb);
  window.addEventListener('load', updateThumb);

  if (window.ResizeObserver) {
    new ResizeObserver(updateThumb).observe(document.body);
  }

  window.updateCustomScrollbar = updateThumb;
  updateThumb();
})();

// FILMSTRIP
const filmstripWrap = document.getElementById('filmstrip-wrap');
const filmstripEl = document.getElementById('filmstrip');
let filmstripHideTimer = null;
let filmstripBuilt = false;
window.addEventListener('category-change', function () {
  filmstripBuilt = false;
  if (typeof filmstripEl !== 'undefined' && filmstripEl) {
    filmstripEl.innerHTML = '';
  }
  // Also reset mobile slides if they exist
  const imgWrap = document.getElementById('lightbox-img-wrap');
  if (imgWrap) {
    const slides = imgWrap.querySelectorAll('.snap-slide');
    for (let i = 0; i < slides.length; i++) slides[i].remove();
  }
});
const liftZone = document.getElementById('filmstrip-lift-zone');

function buildFilmstrip() {
  if (filmstripBuilt) return;
  filmstripBuilt = true;

  const currentSet = currentLightboxIsMotion ? motionProjects : activePhotos;

  // Photos: 52px thumb + gap, Motion: 78px thumb
  const THUMB_W = currentLightboxIsMotion ? (window.innerWidth >= 640 ? 78 : 68) : (window.innerWidth >= 640 ? 62 : 52);
  const pad = (window.innerWidth / 2) - (THUMB_W / 2);
  filmstripEl.style.paddingLeft = pad + 'px';
  filmstripEl.style.paddingRight = pad + 'px';
  filmstripEl.innerHTML = '';

  currentSet.forEach(function (p, i) {
    const thumb = document.createElement('div');
    thumb.className = 'filmstrip-thumb';
    if (currentLightboxIsMotion) thumb.classList.add('mode-motion');
    thumb.dataset.idx = i;
    const img = document.createElement('img');
    const thumbPath = currentLightboxIsMotion ? p.thumb : p.src.replace('photos/', 'photos/thumbs/');
    img.src = thumbPath;
    img.alt = p.title;
    img.loading = 'lazy';
    thumb.appendChild(img);
    thumb.addEventListener('click', (function (idx) {
      return function () {
        const d = idx === cur ? 0 : (idx > cur ? 1 : -1);
        cur = idx;
        openLightbox(idx, d, currentLightboxIsMotion);
      };
    })(i));
    filmstripEl.appendChild(thumb);
  });

  initFilmstripDrag();
}

let fsRaf = null;
let fsVelocity = 0;
let fsTarget = 0;
let isManuallyNavigating = false;
let isTouchingFilmstrip = false;
let fsSyncTarget = null;
let fsSyncRaf = null;

// Smooth lerp loop for mobile filmstrip tracking during swipe.
// Uses frame-rate-independent exponential decay so the filmstrip
// chases the target position without jitter or abrupt transitions.
function startFsSync(target) {
  if (window.fsLenis) window.fsLenis.stop();
  fsSyncTarget = target;
  if (fsSyncRaf) return;
  let prevTime = 0;
  function syncLoop(time) {
    if (fsSyncTarget === null) {
      if (window.fsLenis) window.fsLenis.start();
      fsSyncRaf = null;
      return;
    }
    const dt = prevTime ? Math.min(time - prevTime, 33) : 16;
    prevTime = time;
    const current = filmstripEl.scrollLeft;
    const diff = fsSyncTarget - current;
    if (Math.abs(diff) < 0.5) {
      filmstripEl.scrollLeft = fsSyncTarget;
      if (window.fsLenis) window.fsLenis.start();
      fsSyncRaf = null;
      fsSyncTarget = null;
      return;
    }
    const alpha = 1 - Math.exp(-14 * dt / 1000);
    filmstripEl.scrollLeft = current + diff * alpha;
    fsSyncRaf = requestAnimationFrame(syncLoop);
  }
  fsSyncRaf = requestAnimationFrame(syncLoop);
}

function stopFsSync() {
  if (fsRaf) { cancelAnimationFrame(fsRaf); fsRaf = null; }
  if (fsSyncRaf) { cancelAnimationFrame(fsSyncRaf); fsSyncRaf = null; }
  fsSyncTarget = null;
  isManuallyNavigating = false;
  if (window.fsLenis) window.fsLenis.start();
}

function updateFilmstrip() {
  const oldActive = filmstripEl.querySelector('.filmstrip-thumb.active');
  if (oldActive) oldActive.classList.remove('active');

  const active = filmstripEl.querySelector('.filmstrip-thumb[data-idx="' + cur + '"]');
  if (active) {
    active.classList.add('active');
    const wrapW = filmstripEl.offsetWidth;
    const thumbL = active.offsetLeft;
    const thumbW = active.offsetWidth;
    fsTarget = thumbL - wrapW / 2 + thumbW / 2;
    if (!isMobile || isManuallyNavigating) {
      if (fsRaf || fsSyncRaf) {
        // If already animating, drop into lerp mode for smooth continuous chasing
        if (fsRaf) {
          cancelAnimationFrame(fsRaf);
          fsRaf = null;
        }
        startFsSync(fsTarget);
      } else {
        // Cold start: play strict smooth cubic ease 
        stopFsSync();
        let startPos = filmstripEl.scrollLeft;
        let startTime = null;
        const duration = 400; // graceful duration

        function step(time) {
          if (!startTime) {
            startTime = time;
            if (window.fsLenis) window.fsLenis.stop();
          }
          const elapsed = time - startTime;
          if (elapsed >= duration) {
            filmstripEl.scrollLeft = fsTarget;
            if (window.fsLenis) window.fsLenis.start();
            fsRaf = null;
            isManuallyNavigating = false;
            return;
          }
          const t = Math.min(1, elapsed / duration);
          const ease = 1 - Math.pow(1 - t, 4);
          filmstripEl.scrollLeft = startPos + (fsTarget - startPos) * ease;
          fsRaf = requestAnimationFrame(step);
        }
        fsRaf = requestAnimationFrame(step);
      }
    } else {
      if (!isTouchingFilmstrip) startFsSync(fsTarget);
    }
  }
}

let isUserInteracting = false;
document.getElementById('lightbox').addEventListener('touchstart', function () {
  isUserInteracting = true;
  clearTimeout(filmstripHideTimer);
}, { passive: true });
window.addEventListener('touchend', function () {
  isUserInteracting = false;
  isTouchingFilmstrip = false;
  if (filmstripWrap.classList.contains('visible')) {
    clearTimeout(filmstripHideTimer);
    filmstripHideTimer = setTimeout(hideFilmstrip, 2800);
  }
}, { passive: true });

document.getElementById('lightbox').addEventListener('mousedown', function () {
  isUserInteracting = true;
  clearTimeout(filmstripHideTimer);
}, { passive: true });
window.addEventListener('mouseup', function () {
  isUserInteracting = false;
  isTouchingFilmstrip = false;
  if (filmstripWrap.classList.contains('visible')) {
    clearTimeout(filmstripHideTimer);
    filmstripHideTimer = setTimeout(hideFilmstrip, 2800);
  }
}, { passive: true });

function showFilmstrip() {
  buildFilmstrip();
  updateFilmstrip();
  filmstripWrap.classList.add('visible');
  document.getElementById('lightbox').classList.add('filmstrip-visible');
  clearTimeout(filmstripHideTimer);
  if (!isUserInteracting) {
    filmstripHideTimer = setTimeout(hideFilmstrip, 2800);
  }
}

function hideFilmstrip() {
  // Don't hide if the cursor is still in the wrap or the lift zone
  if (filmstripWrap.matches(':hover') || (liftZone && liftZone.matches(':hover'))) {
    filmstripHideTimer = setTimeout(hideFilmstrip, 1000);
    return;
  }
  filmstripWrap.classList.remove('visible');
  document.getElementById('lightbox').classList.remove('filmstrip-visible');
}

// keep filmstrip visible while hovering it
filmstripWrap.addEventListener('mouseenter', function () { clearTimeout(filmstripHideTimer); });
filmstripWrap.addEventListener('mouseleave', function () {
  // grace period — prevents flicker and allows cursor to move back in
  filmstripHideTimer = setTimeout(hideFilmstrip, 300);
});
filmstripWrap.addEventListener('touchstart', function () {
  clearTimeout(filmstripHideTimer);
  isTouchingFilmstrip = true;
  stopFsSync();
}, { passive: true });
filmstripWrap.addEventListener('touchend', function () {
  filmstripHideTimer = setTimeout(hideFilmstrip, 2000);
  isTouchingFilmstrip = false;
}, { passive: true });

// invisible lift zone — hovering bottom of screen revives hidden filmstrip
if (liftZone) {
  liftZone.addEventListener('mouseenter', function () {
    clearTimeout(filmstripHideTimer);
    showFilmstrip();
  });
  liftZone.addEventListener('mouseleave', function () {
    // if mouse left lift zone without entering filmstrip, wait a bit
    filmstripHideTimer = setTimeout(hideFilmstrip, 600);
  });
}

// Capture wheel events early to trigger UI logic (scroll handled by fsLenis)
filmstripWrap.addEventListener('wheel', function (e) {
  stopFsSync();
  clearTimeout(filmstripHideTimer);
  filmstripHideTimer = setTimeout(hideFilmstrip, 2000);
}, { passive: true, capture: true });

// click-drag scroll
function initFilmstripDrag() {
  let isDragging = false;
  let dragStartX = 0;
  let scrollStart = 0;
  let dragMoved = false;

  filmstripEl.addEventListener('mousedown', function (e) {
    isDragging = true;
    dragMoved = false;
    isTouchingFilmstrip = true;
    stopFsSync();
    if (window.fsLenis) window.fsLenis.stop();
    dragStartX = e.clientX;
    scrollStart = filmstripEl.scrollLeft;
    filmstripEl.classList.add('dragging');
    clearTimeout(filmstripHideTimer);
  });

  document.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 3) dragMoved = true;
    filmstripEl.scrollLeft = scrollStart - dx;
  });

  document.addEventListener('mouseup', function () {
    if (!isDragging) return;
    isDragging = false;
    filmstripEl.classList.remove('dragging');
    if (window.fsLenis) window.fsLenis.start();
    filmstripHideTimer = setTimeout(hideFilmstrip, 1500);
  });

  // suppress click on thumbs if we just dragged
  filmstripEl.addEventListener('click', function (e) {
    if (dragMoved) { e.stopPropagation(); dragMoved = false; }
  }, true);
}


// buildCarousel internally waits for images, then calls onReady
// we hook into that by wrapping the final reveal
function liftLoader() {
  const loader = document.getElementById('loader');
  loader.classList.add('lifting');
  setTimeout(function () { loader.style.display = 'none'; }, 750);
}

// Lift loader via direct callback — no MutationObserver (flaky in Firefox)
let _loaderLifted = false;
function safeLift() { if (!_loaderLifted) { _loaderLifted = true; liftLoader(); } }
// Hard fallback: lift after 4s no matter what
setTimeout(safeLift, 4000);
// Expose for buildCarousel to call after rows are visible
window.__onCarouselReady = function () { setTimeout(safeLift, 120); };

buildCarousel();
buildMasonry();
initFilters();

(function initStickyHeaderSurface() {
  const header = document.getElementById('gallery-header');
  if (!header) return;

  function updateStickyHeaderSurface() {
    document.body.classList.toggle('gallery-header-stuck', header.getBoundingClientRect().top <= 0.5);
  }

  updateStickyHeaderSurface();
  window.addEventListener('scroll', updateStickyHeaderSurface, { passive: true });
  window.addEventListener('resize', updateStickyHeaderSurface, { passive: true });
  window.addEventListener('orientationchange', updateStickyHeaderSurface, { passive: true });
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
  }, 200);
});

// Visibility & Animation Loop Management
function startLoops() {
  if (heroVisible && pageVisible) {
    if (!heroRafId) heroRafId = requestAnimationFrame(tick);
    if (!glowRafId && typeof animateGlow === 'function') glowRafId = requestAnimationFrame(animateGlow);
  }
}

const heroObs = new IntersectionObserver(function (entries) {
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
  const fullHash = window.location.hash.substring(1);
  
  const lb = document.getElementById('lightbox');
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
    setTimeout(checkHash, 300);
    return;
  }

  // 2. If we are in the right category, check for the specific item
  if (itemSlug) {
    const items = currentCategory === 'motion' ? motionProjects : activePhotos;
    if (items.length === 0 && currentCategory !== 'motion') {
      setTimeout(checkHash, 100);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      if (slugify(items[i].title) === itemSlug) {
        // If already open to this item, do nothing
        if (isLbOpen && cur === i) return;
        
        isPopState = true;
        openLightbox(i, 0, currentCategory === 'motion');
        setTimeout(function() { isPopState = false; }, 100);
        return;
      }
    }
  }
}

window.addEventListener('popstate', function() {
  isPopState = true;
  checkHash();
  setTimeout(function() { isPopState = false; }, 500);
});

// Defer slightly to ensure layout is ready
setTimeout(checkHash, 300);

// ─── Firefox Compat & Footer Observer ───
if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
  document.write('<script src="scripts/firefox.js"><\/script>');
}

// Footer brightness on mobile scroll
const footerObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (window.matchMedia('(hover: none)').matches) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      } else {
        entry.target.classList.remove('is-visible');
      }
    }
  });
}, { threshold: 0.85 });

const siteFooter = document.getElementById('site-footer');
if (siteFooter) footerObserver.observe(siteFooter);

// ─── Lenis Smooth Scroll ───
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {

  const lenis = new Lenis({
    lerp: 0.09,
    smoothWheel: true,
    wheelMultiplier: 1,
    infinite: false,
    autoResize: false, // Prevent Lenis from reading transient 0 values during reflows
  });

  window.lenis = lenis;

  // ── Filmstrip Lenis ──
  const filmstripEl = document.getElementById('filmstrip');
  if (filmstripEl) {
    window.fsLenis = new Lenis({
      wrapper: filmstripEl,
      content: filmstripEl,
      orientation: 'horizontal',
      gestureOrientation: 'both',
      smoothWheel: true,
      lerp: 0.09,
      autoResize: false
    });

    let _fsResizeTimer;
    new ResizeObserver(function () {
      clearTimeout(_fsResizeTimer);
      _fsResizeTimer = setTimeout(function () {
        if (window.fsLenis) window.fsLenis.resize();
      }, 150);
    }).observe(filmstripEl);
  }

  // ── Anti-Desync Guard ──
  // If Lenis's internal state ever silently detaches from the real window scroll
  // (a known edge case with Chrome scroll anchoring during lazy loading),
  // force it back into sync when idle. This completely prevents the "stuck/teleport" bug.
  setInterval(function () {
    if (lenis && lenis.isScrolling === false && !lenis.isStopped && !lenis.isLocked) {
      const realY = window.scrollY || window.pageYOffset || 0;
      if (Math.abs(lenis.targetScroll - realY) > 5) {
        lenis.targetScroll = lenis.animatedScroll = realY;
        lenis.emit(); // ensure internal state propagates
      }
    }
  }, 25); // lenis masonry guard time

  // Manual RAF
  function lenisRaf(time) {
    lenis.raf(time);
    if (window.fsLenis) window.fsLenis.raf(time);
    requestAnimationFrame(lenisRaf);
  }
  requestAnimationFrame(lenisRaf);

  // Lightbox sync
  window.addEventListener('lightbox-open', function () { lenis.stop(); });

  const _origCloseLightbox = closeLightbox;
  closeLightbox = function () {
    _origCloseLightbox();
    setTimeout(function () {
      lenis.start();
      lenis.animatedScroll = lenis.targetScroll = window.scrollY;
    }, 450);
  };

  // Override Lenis CSS classes that conflict with site overflow rules
  const ls = document.createElement('style');
  ls.textContent = 'html.lenis,html.lenis body{height:auto}html.lenis,html.lenis-scrolling{overflow-x:clip!important;overflow-y:auto!important}html.lenis-stopped{overflow:hidden}';
  document.head.appendChild(ls);
}
