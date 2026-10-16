import { domRefs } from './dom.js';
import { state, updateActivePhotos } from './state.js';
import { getCategorySlug, getPhotoLibrary, motionProjects } from './media-data.js';
import { openLightbox, preloadLightboxBlurNeighbors } from './lightbox.js';
import { preloadPhotoColor, warmUpAllPhotoColors } from './lightbox-color.js';
import { updateCustomScrollbar } from './custom-scrollbar.js';
import { updateStickyHeaderSurface } from './sticky-header.js';
import { getPhotoAspectRatio, saveRatioToCache, isRatioCached, setupImagePlaceholderFallback } from './utils.js';

let galleryLastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
let gallerySuppressScrollRevealUntil = 0;
let galleryRevealRepairTimer: any = null;
let galleryTabSwitchSettleTimer: any = null;
const GALLERY_REVEAL_CLEANUP_MS = 850;
const GALLERY_TAB_SWITCH_SETTLE_MS = 920;

function clearCardRevealTimers(card: HTMLElement) {
  if (card.dataset.revealCleanupTimer) {
    window.clearTimeout(Number(card.dataset.revealCleanupTimer));
  }
  if (card.dataset.revealFallbackTimer) {
    window.clearTimeout(Number(card.dataset.revealFallbackTimer));
  }
}

function cleanupCardScrollReveal(card: HTMLElement) {
  clearCardRevealTimers(card);
  card.classList.remove('pending-reveal');
  card.classList.remove('revealed');
  delete card.dataset.revealPending;
  delete card.dataset.revealCleanupTimer;
  delete card.dataset.revealFallbackTimer;
}

function showCardWithoutScrollReveal(card: HTMLElement) {
  cleanupCardScrollReveal(card);
}

function finishCardScrollReveal(card: HTMLElement) {
  if (!card.classList.contains('pending-reveal')) {
    cleanupCardScrollReveal(card);
    return;
  }

  card.classList.add('revealed');

  if (card.dataset.revealCleanupTimer) return;
  let cleanupTimer = window.setTimeout(function () {
    cleanupCardScrollReveal(card);
  }, GALLERY_REVEAL_CLEANUP_MS);
  card.dataset.revealCleanupTimer = String(cleanupTimer);
}

function playCardScrollReveal(card: HTMLElement) {
  if (!card.classList.contains('pending-reveal')) return;
  finishCardScrollReveal(card);
}

// The loops below keep layout READS (getBoundingClientRect / innerHeight) and class WRITES in
// separate passes. Interleaving them forces a fresh style/layout flush for every card; the first
// animation frame at startup spent ~100ms (6x CPU throttle) doing exactly that. The reveal classes
// only change opacity/transform/will-change, which never move other cards, so reading every rect
// up front yields the same values the interleaved loops saw.
function getViewportHeight() {
  return window.innerHeight || document.documentElement.clientHeight || 0;
}

// Read pass: returns the cards of `root` matching `selector` that intersect the viewport.
function collectCardsInViewport(root: HTMLElement | Document, selector: string) {
  const viewportHeight = getViewportHeight();
  const visible: HTMLElement[] = [];
  root.querySelectorAll(selector).forEach(function (cardEl) {
    const card = cardEl as HTMLElement;
    const rect = card.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < viewportHeight) visible.push(card);
  });
  return visible;
}

function repairVisiblePendingCards(scope?: HTMLElement | Document | null) {
  let root = scope || getActiveGalleryPanel() || document;

  collectCardsInViewport(root, '.photo-card.pending-reveal').forEach(playCardScrollReveal);
}

function scheduleGalleryRevealRepair(scope: HTMLElement | Document | null, delay?: number) {
  if (galleryRevealRepairTimer) window.clearTimeout(galleryRevealRepairTimer);

  galleryRevealRepairTimer = window.setTimeout(function () {
    galleryRevealRepairTimer = null;
    repairVisiblePendingCards(scope);
  }, delay || 0);
}

let cardObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    let card = entry.target as HTMLElement;
    if (entry.isIntersecting) {
      playCardScrollReveal(card);
      cardObserver.unobserve(card);
    }
  });
}, { rootMargin: '0px 0px 50px 0px' });

let galleryPreloadObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      let card = entry.target as HTMLElement;
      let img = card.querySelector<HTMLImageElement>('img');
      if (img) {
        if (img.loading !== 'eager') {
          img.loading = 'eager';
        }
        if (!img.complete) {
          const preloader = new Image();
          preloader.src = img.src;
        }
      }
      galleryPreloadObserver.unobserve(card);
    }
  });
}, { rootMargin: '1600px 0px 1600px 0px' });

export function revealCards(scope: any, options?: any) {
  options = options || {};
  let root = scope || getActiveGalleryPanel() || document;
  let viewportHeight = getViewportHeight();

  // Read pass first, then apply (see the note above armCardsBelowViewport).
  const measured = (Array.from(root.querySelectorAll('.photo-card')) as HTMLElement[]).map(function (card) {
    return { card: card, top: card.getBoundingClientRect().top };
  });

  measured.forEach(function (entry) {
    const card = entry.card;
    if (entry.top < viewportHeight) {
      showCardWithoutScrollReveal(card);
      cardObserver.unobserve(card);
    } else if (!card.classList.contains('revealed')) {
      card.classList.add('pending-reveal');
      cardObserver.observe(card);
    }
    galleryPreloadObserver.observe(card);
  });
}

function settleGalleryTabSwitch(panel: HTMLElement | null) {
  if (!panel) return;

  if (galleryTabSwitchSettleTimer) {
    window.clearTimeout(galleryTabSwitchSettleTimer);
    galleryTabSwitchSettleTimer = null;
  }

  revealCards(panel, { immediate: true });
  refreshGalleryScrollMetrics();
}

// Masonry: scroll reveal handles fade-in.
// Aspect ratios are resolved using getPhotoAspectRatio and cached in utils.ts.

function revealImageOnLoad(img: HTMLImageElement) {
  if (!img) return;
  let card = img.closest('.photo-card');
  function reveal() {
    img.classList.add('media-loaded');
    if (card) {
      card.classList.add('photo-loaded');
    }
  }

  setupImagePlaceholderFallback(img, reveal);

  if (img.complete) {
    requestAnimationFrame(reveal);
  } else {
    img.addEventListener('load', reveal, { once: true });
    img.addEventListener('error', reveal, { once: true });
  }
}

let GALLERY_CATEGORIES = ['all', 'figures', 'motion'];
let GALLERY_SCROLL_MEMORY_KEY = 'van_gallery_scroll_v2';
let galleryScrollPositions: Record<string, number | null> = { all: null, figures: null, motion: null };
let galleryPanelsBuilt = false;
let builtCategories = new Set<string>();
let galleryBlurPreloadTimer: any = null;

try {
  let storedScrollPositions = sessionStorage.getItem(GALLERY_SCROLL_MEMORY_KEY);
  if (storedScrollPositions) {
    let parsedScrollPositions = JSON.parse(storedScrollPositions);
    GALLERY_CATEGORIES.forEach(function (cat) {
      let value = parsedScrollPositions[cat];
      if (Number.isFinite(value)) galleryScrollPositions[cat] = value;
    });
  }
} catch (e) { }

function normalizeGalleryCategory(category: string) {
  return GALLERY_CATEGORIES.indexOf(category) >= 0 ? category : 'all';
}

function rememberGalleryScroll(category: string) {
  category = normalizeGalleryCategory(category);
  galleryScrollPositions[category] = window.pageYOffset || document.documentElement.scrollTop || 0;
  try { sessionStorage.setItem(GALLERY_SCROLL_MEMORY_KEY, JSON.stringify(galleryScrollPositions)); } catch (e) { }
}

function resetGalleryScrollMemory() {
  GALLERY_CATEGORIES.forEach(function (cat) {
    galleryScrollPositions[cat] = null;
  });
  try { sessionStorage.setItem(GALLERY_SCROLL_MEMORY_KEY, JSON.stringify(galleryScrollPositions)); } catch (e) { }
}

function updateGalleryScrollDirection() {
  let scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  if (Math.abs(scrollY - galleryLastScrollY) > 1) {
    galleryLastScrollY = scrollY;
  }
}

let galleryScrollSaveTimer: any = null;
function queueGalleryScrollMemory() {
  if (domRefs.lightbox && domRefs.lightbox.classList.contains('open')) return;

  if (galleryScrollSaveTimer) {
    window.clearTimeout(galleryScrollSaveTimer);
  }

  galleryScrollSaveTimer = window.setTimeout(function () {
    galleryScrollSaveTimer = null;
    rememberGalleryScroll(state.currentCategory);
  }, 150);
}

function handleGalleryScroll() {
  updateGalleryScrollDirection();
  queueGalleryScrollMemory();
}

window.addEventListener('scroll', handleGalleryScroll, { passive: true });

function getElementDocumentTop(el: HTMLElement): number {
  let top = 0;
  let curr: HTMLElement | null = el;
  while (curr) {
    top += curr.offsetTop;
    curr = curr.offsetParent as HTMLElement | null;
  }
  return top;
}

function getGalleryAnchorScrollY() {
  let section = domRefs.gallerySection;
  if (!section) return 0;
  return getElementDocumentTop(section);
}

function getGalleryStickyStartScrollY() {
  let header = document.querySelector('#gallery-header') as HTMLElement;
  if (!header) return getGalleryAnchorScrollY();

  let headerTop = getElementDocumentTop(header);
  let headerStyles = window.getComputedStyle(header);
  let stickyTop = parseFloat(headerStyles.top) || 0;

  return Math.max(0, Math.round(headerTop - stickyTop));
}

function isGalleryHeaderStuck() {
  let scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  return scrollY >= getGalleryStickyStartScrollY();
}

function getMaxPageScroll() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

function restoreWindowScroll(scrollY: number) {
  let clampedScroll = Math.max(0, Math.min(scrollY, getMaxPageScroll()));
  const lenis = (window as any).lenis;
  if (lenis) lenis.scrollTo(clampedScroll, { immediate: true });
  else window.scrollTo({ top: clampedScroll, behavior: 'auto' });
  return clampedScroll;
}

function getGalleryTargetScroll(category: string, options?: any): number {
  options = options || {};
  category = normalizeGalleryCategory(category);
  let saved = galleryScrollPositions[category];
  let targetScrollY = (saved !== null && Number.isFinite(saved)) ? saved : getGalleryAnchorScrollY();

  if (options.lockToStickyStart) {
    targetScrollY = Math.max(targetScrollY, getGalleryStickyStartScrollY());
  }

  return targetScrollY;
}

function refreshGalleryScrollMetrics() {
  const lenis = (window as any).lenis;
  if (lenis && typeof lenis.resize === 'function') lenis.resize();
  updateStickyHeaderSurface();
  updateCustomScrollbar();
}

function getCategoryItems(category: string) {
  if (category === 'motion') return motionProjects;
  return getPhotoLibrary(category);
}

function getCategoryIndex(category: string) {
  return GALLERY_CATEGORIES.indexOf(normalizeGalleryCategory(category));
}

function getGalleryPanel(category: string): HTMLElement | null {
  let masonry = domRefs.masonry;
  if (!masonry) return null;

  category = normalizeGalleryCategory(category);
  let panel = masonry.querySelector('.masonry-panel[data-category="' + category + '"]') as HTMLElement;
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'masonry-panel';
    panel.dataset.category = category;
    panel.hidden = true;
    masonry.appendChild(panel);
  }
  return panel;
}

function getActiveGalleryPanel() {
  return getGalleryPanel(state.currentCategory);
}

function scheduleGalleryBlurPreload(centerIndex: number, delay?: number) {
  if (state.currentCategory === 'motion') return;
  if (galleryBlurPreloadTimer) window.clearTimeout(galleryBlurPreloadTimer);

  galleryBlurPreloadTimer = window.setTimeout(function () {
    galleryBlurPreloadTimer = null;
    preloadLightboxBlurNeighbors(centerIndex || 0, 1);
  }, delay ?? 350);
}

export function getMasonryColumnCount() {
  if (window.innerWidth >= 1024) return 4;
  if (window.innerWidth >= 640) return 3;
  return 2;
}

function updateGalleryNav(category: string) {
  let photoBtn = document.querySelector('#gallery-header .photographs-btn') as HTMLElement | null;
  let figuresBtn = document.querySelector('#gallery-header .figures-btn') as HTMLElement | null;
  let motionBtn = document.querySelector('#gallery-header .motion-btn') as HTMLElement | null;

  [photoBtn, figuresBtn, motionBtn].forEach(function (button) {
    if (button) {
      button.classList.remove('active');
      button.classList.add('inactive');
      button.setAttribute('aria-pressed', 'false');
      button.blur();
    }
  });

  if (category === 'all' && photoBtn) {
    photoBtn.classList.remove('inactive');
    photoBtn.classList.add('active');
    photoBtn.setAttribute('aria-pressed', 'true');
  }
  if (category === 'figures' && figuresBtn) {
    figuresBtn.classList.remove('inactive');
    figuresBtn.classList.add('active');
    figuresBtn.setAttribute('aria-pressed', 'true');
  }
  if (category === 'motion' && motionBtn) {
    motionBtn.classList.remove('inactive');
    motionBtn.classList.add('active');
    motionBtn.setAttribute('aria-pressed', 'true');
  }
}

function setActiveGalleryPanel(category: string, options?: any) {
  options = options || {};
  category = normalizeGalleryCategory(category);

  if (!builtCategories.has(category)) {
    buildMasonry(category);
  }

  let masonry = domRefs.masonry;
  let gallerySec = domRefs.gallerySection;
  if (!masonry) return null;

  let activePanel: HTMLElement | null = null;
  for (const cat of GALLERY_CATEGORIES) {
    let panel = getGalleryPanel(cat);
    if (!panel) continue;
    let isActive = cat === category;
    panel.hidden = !isActive;
    panel.classList.toggle('is-active', isActive);
    panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    if (isActive) activePanel = panel;
    else panel.classList.remove('is-entering');
  }

  masonry.classList.toggle('motion-grid-active', category === 'motion');
  if (gallerySec) gallerySec.classList.toggle('motion-active', category === 'motion');
  updateGalleryNav(category);

  if (activePanel) {
    if (options.animate) {
      activePanel.style.setProperty('--masonry-x', (options.direction || 1) > 0 ? '-36px' : '36px');
      activePanel.classList.remove('is-entering');
      void activePanel.offsetWidth;
      activePanel.classList.add('is-entering');
      setTimeout(function () {
        activePanel.classList.remove('is-entering');
        activePanel.style.removeProperty('--masonry-x');
      }, 820);
    }
  }

  requestAnimationFrame(function () {
    revealCards(activePanel, { immediate: true });
    refreshGalleryScrollMetrics();
  });

  return activePanel;
}

export function rebuildGallery(newCategory: string, options?: any) {
  options = options || {};
  newCategory = normalizeGalleryCategory(newCategory);

  if (!galleryPanelsBuilt) buildMasonry();
  if (!builtCategories.has(newCategory)) buildMasonry(newCategory);

  let previousCategory = normalizeGalleryCategory(state.currentCategory);
  let tabDirection = typeof options.direction === 'number'
    ? options.direction
    : (getCategoryIndex(newCategory) > getCategoryIndex(previousCategory) ? -1 : 1);
  let currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  let headerWasStuck = isGalleryHeaderStuck();
  let targetScrollY = currentScrollY;

  if (!options.preserveScroll) {
    if (headerWasStuck) {
      targetScrollY = getGalleryTargetScroll(newCategory, {
        lockToStickyStart: true
      });
    } else {
      resetGalleryScrollMemory();
    }
  }

  if (previousCategory !== newCategory && !Number.isFinite(galleryScrollPositions[previousCategory])) {
    rememberGalleryScroll(previousCategory);
  }

  state.currentCategory = newCategory;
  updateActivePhotos();

  if (!domRefs.lightbox.classList.contains('open') && !state.isPopState) {
    let catSlug = getCategorySlug(newCategory);
    let curHash = window.location.hash.substring(1);
    if (!curHash.startsWith(catSlug)) {
      history.pushState(null, '', '#' + catSlug);
    }
  }

  window.dispatchEvent(new Event('category-change'));
  warmUpAllPhotoColors();
  gallerySuppressScrollRevealUntil = performance.now() + GALLERY_TAB_SWITCH_SETTLE_MS;
  let activePanel = setActiveGalleryPanel(newCategory, { animate: options.animate, direction: tabDirection });
  restoreWindowScroll(targetScrollY);
  galleryLastScrollY = targetScrollY;

  requestAnimationFrame(function () {
    restoreWindowScroll(targetScrollY);
    settleGalleryTabSwitch(activePanel);
    refreshGalleryScrollMetrics();
    setTimeout(refreshGalleryScrollMetrics, 120);
    if (typeof options.onReady === 'function') options.onReady();
  });
}

export function initFilters() {
  let photoBtn = document.querySelector('#gallery-header .photographs-btn') as HTMLElement;
  let figuresBtn = document.querySelector('#gallery-header .figures-btn') as HTMLElement;
  let motionBtn = document.querySelector('#gallery-header .motion-btn') as HTMLElement;

  updateGalleryNav(state.currentCategory);

  [
    { button: photoBtn, category: 'all' },
    { button: figuresBtn, category: 'figures' },
    { button: motionBtn, category: 'motion' }
  ].forEach(function (item) {
    if (!item.button) return;

    item.button.addEventListener('click', function () {
      if (state.currentCategory === item.category) return;
      rebuildGallery(item.category, { animate: true });
    });

    item.button.addEventListener('keydown', function (e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        (item.button as HTMLElement).click();
      }
    });
  });
}

export function buildMasonry(category?: string) {
  let masonry = domRefs.masonry;
  if (!masonry) return;

  if (!category) {
    let shouldRestoreScroll = galleryPanelsBuilt;
    if (shouldRestoreScroll) rememberGalleryScroll(state.currentCategory);

    const categoriesToBuild = builtCategories.size === 0
      ? [normalizeGalleryCategory(state.currentCategory)]
      : Array.from(builtCategories);

    categoriesToBuild.forEach(function (cat) {
      buildMasonry(cat);
    });

    galleryPanelsBuilt = true;
    setActiveGalleryPanel(state.currentCategory);

    if (shouldRestoreScroll) {
      requestAnimationFrame(function () {
        restoreWindowScroll(getGalleryTargetScroll(state.currentCategory, {
          lockToStickyStart: isGalleryHeaderStuck()
        }));
        refreshGalleryScrollMetrics();
      });
    }
    return;
  }

  const normalizedCategory = normalizeGalleryCategory(category);
  builtCategories.add(normalizedCategory);
  let panel = getGalleryPanel(normalizedCategory);
  if (!panel) return;

  panel.querySelectorAll('.photo-card').forEach(function (card) {
    cardObserver.unobserve(card);
    galleryPreloadObserver.unobserve(card);
  });

  panel.innerHTML = '';
  let lastYear: string | null = null;
  let isMotion = category === 'motion';
  let items = getCategoryItems(category);
  let yearGrid: HTMLDivElement | null = null;
  let columns: HTMLDivElement[] = [];
  let colHeights: number[] = [];
  let numCols = getMasonryColumnCount();

  items.forEach(function (p, i) {
    let currentYear = p.date ? (p.date.match(/\d{4}/) || ["undated"])[0] : "undated";

    if (currentYear !== lastYear) {
      let yearSection = document.createElement('section');
      yearSection.className = 'masonry-year';

      let header = document.createElement('div');
      header.className = 'date-header';
      header.textContent = currentYear;
      yearSection.appendChild(header);

      yearGrid = document.createElement('div');
      yearGrid.className = 'masonry-year-grid';
      yearSection.appendChild(yearGrid);

      columns = [];
      colHeights = [];
      if (!isMotion) {
        for (let c = 0; c < numCols; c++) {
          let col = document.createElement('div');
          col.className = 'masonry-column';
          yearGrid.appendChild(col);
          columns.push(col);
          colHeights.push(0);
        }
      }

      panel.appendChild(yearSection);
      lastYear = currentYear;
    }

    let card = document.createElement('div');
    card.className = isMotion ? 'photo-card motion-card' : 'photo-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', p.title ? `View ${p.title}` : 'View photo');
    let imgEl = document.createElement('img');
    imgEl.className = 'photo-card-img';
    imgEl.crossOrigin = 'anonymous';

    let basePath = isMotion ? (p.thumb || "") : (p.src || "");
    let thumbPath = p.thumb || (basePath.includes('thumbs/') ? basePath : basePath.replace('photos/', 'photos/thumbs/'));

    let r = getPhotoAspectRatio(p, isMotion);
    imgEl.src = thumbPath;
    imgEl.alt = p.title || "video";
    imgEl.loading = i < 8 ? 'eager' : 'lazy';
    if (i < 4) {
      (imgEl as any).fetchPriority = 'high';
    }
    imgEl.decoding = 'async';

    setupImagePlaceholderFallback(imgEl);

    if (galleryPanelsBuilt && imgEl.complete) {
      card.classList.add('no-transition');
      card.classList.add('photo-loaded');
      imgEl.classList.add('media-loaded');
      setTimeout(function () {
        card.classList.remove('no-transition');
      }, 50);
    } else {
      revealImageOnLoad(imgEl);
    }

    card.style.setProperty('--photo-aspect-ratio', String(r));
    imgEl.style.aspectRatio = String(r);

    if ((p.aspectRatio === undefined || p.aspectRatio === null) && !isRatioCached(basePath)) {
      imgEl.addEventListener('load', function () {
        if (imgEl.naturalWidth && imgEl.naturalHeight) {
          let ratio = imgEl.naturalWidth / imgEl.naturalHeight;
          saveRatioToCache(basePath, imgEl.naturalWidth, imgEl.naturalHeight);
          card.style.setProperty('--photo-aspect-ratio', String(ratio.toFixed(4)));
          imgEl.style.aspectRatio = String(ratio.toFixed(4));
        }
      }, { once: true });
    }

    let overlay = document.createElement('div');
    overlay.className = 'photo-card-overlay';
    let titleEl = document.createElement('div');
    titleEl.className = 'photo-card-title';
    titleEl.textContent = p.title || "";
    let dateEl = document.createElement('div');
    dateEl.className = 'photo-card-date';
    dateEl.textContent = p.date || "undated";
    overlay.appendChild(titleEl);
    overlay.appendChild(dateEl);
    card.appendChild(imgEl);
    card.appendChild(overlay);

    card.dataset.idx = String(i);
    card.dataset.category = category;

    if (yearGrid) {
      if (isMotion) {
        yearGrid.appendChild(card);
      } else {
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
      }
    }
  });

  if (category === state.currentCategory) setTimeout(function () { revealCards(panel); }, 150);
}

function isMobileOrTablet(): boolean {
  if (state.isMobile) return true;
  if (typeof window !== 'undefined') {
    if (window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches) {
      return true;
    }
    if (window.innerWidth < 1024) {
      return true;
    }
  }
  return false;
}

let masonrySwipeHappened = false;
let masonrySwipeResetTimer: any = null;

function markMasonrySwipeHappened() {
  masonrySwipeHappened = true;
  if (masonrySwipeResetTimer) clearTimeout(masonrySwipeResetTimer);
  masonrySwipeResetTimer = setTimeout(function () {
    masonrySwipeHappened = false;
    masonrySwipeResetTimer = null;
  }, 300);
}

function navigateSubnav(step: 1 | -1) {
  if (isLightboxActiveOrTransitioning()) return;
  const current = normalizeGalleryCategory(state.currentCategory);
  let curIndex = GALLERY_CATEGORIES.indexOf(current);
  if (curIndex === -1) curIndex = 0;

  const nextIndex = (curIndex + step + GALLERY_CATEGORIES.length) % GALLERY_CATEGORIES.length;
  const nextCategory = GALLERY_CATEGORIES[nextIndex];
  if (nextCategory === current) return;

  rebuildGallery(nextCategory, { animate: true, direction: step === 1 ? -1 : 1 });
}

function isLightboxActiveOrTransitioning(): boolean {
  if (state.isLightboxDismissing || state.isLightboxClosing) return true;
  if (performance.now() - (state.lightboxClosedTime || 0) < 450) return true;
  const lb = domRefs.lightbox;
  if (lb && (
    lb.classList.contains('open') ||
    lb.classList.contains('is-closing') ||
    lb.classList.contains('is-dismissing') ||
    lb.classList.contains('dismiss-committed')
  )) {
    return true;
  }
  if (typeof document !== 'undefined' && document.body && (
    document.body.classList.contains('lightbox-open') ||
    document.body.classList.contains('lightbox-closing') ||
    document.body.classList.contains('lightbox-dismissing')
  )) {
    return true;
  }
  return false;
}

let masonryTouchStartX = 0;
let masonryTouchStartY = 0;
let masonryTouchStartTime = 0;
let masonryTouchActive = false;
let masonryIsScrolling = false;
let masonryIsHorizontalSwipe = false;

let masonryPointerStartX = 0;
let masonryPointerStartY = 0;
let masonryPointerStartTime = 0;
let masonryPointerActive = false;

// Delegated event listeners for gallery cards and swipe navigation
const masonry = domRefs.masonry;
const galleryArea = domRefs.gallerySection || domRefs.masonry;

if (galleryArea) {
  galleryArea.addEventListener('touchstart', function (e: TouchEvent) {
    if (isLightboxActiveOrTransitioning()) {
      masonryTouchActive = false;
      return;
    }

    const target = e.target as HTMLElement | null;
    if (!target || !target.closest('#masonry, #gallery-section') || target.closest('#lightbox, #gallery-header')) {
      masonryTouchActive = false;
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      masonryTouchStartX = touch.clientX;
      masonryTouchStartY = touch.clientY;
      masonryTouchStartTime = performance.now();
      masonryTouchActive = true;
      masonryIsScrolling = false;
      masonryIsHorizontalSwipe = false;
    } else {
      masonryTouchActive = false;
    }

    const card = target.closest('.photo-card') as HTMLElement | null;
    if (!card) return;
    const idx = parseInt(card.dataset.idx || '0', 10);
    const cardCategory = card.dataset.category || 'all';

    if (cardCategory === 'motion') return;
    if (state.currentCategory !== cardCategory) return;
    scheduleGalleryBlurPreload(idx, 100);
  }, { passive: true });

  galleryArea.addEventListener('touchmove', function (e: TouchEvent) {
    if (!masonryTouchActive || e.touches.length !== 1 || !isMobileOrTablet()) return;
    if (isLightboxActiveOrTransitioning()) {
      masonryTouchActive = false;
      return;
    }

    const touch = e.touches[0];
    const diffX = touch.clientX - masonryTouchStartX;
    const diffY = touch.clientY - masonryTouchStartY;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    if (!masonryIsScrolling && !masonryIsHorizontalSwipe) {
      if (absX > 8 || absY > 8) {
        if (absY >= absX) {
          masonryIsScrolling = true;
        } else {
          masonryIsHorizontalSwipe = true;
        }
      }
    }
  }, { passive: true });

  galleryArea.addEventListener('touchend', function (e: TouchEvent) {
    if (!masonryTouchActive) return;
    masonryTouchActive = false;

    if (masonryIsScrolling || !isMobileOrTablet()) return;
    if (isLightboxActiveOrTransitioning()) return;
    if (!e.changedTouches || e.changedTouches.length === 0) return;

    const endTarget = e.target as HTMLElement | null;
    if (!endTarget || !endTarget.closest('#masonry, #gallery-section') || endTarget.closest('#lightbox, #gallery-header')) return;

    const touch = e.changedTouches[0];
    const diffX = touch.clientX - masonryTouchStartX;
    const diffY = touch.clientY - masonryTouchStartY;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);
    const elapsed = performance.now() - masonryTouchStartTime;

    const minDistance = elapsed < 250 ? 30 : 40;
    if (absX >= minDistance && absX > absY * 1.5 && elapsed < 1000) {
      markMasonrySwipeHappened();
      if (diffX < 0) {
        navigateSubnav(1);
      } else {
        navigateSubnav(-1);
      }
    }
  }, { passive: true });

  galleryArea.addEventListener('touchcancel', function () {
    masonryTouchActive = false;
    masonryIsScrolling = false;
    masonryIsHorizontalSwipe = false;
  }, { passive: true });

  galleryArea.addEventListener('pointerdown', function (e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    if (!isMobileOrTablet()) return;
    if (isLightboxActiveOrTransitioning()) return;
    if (e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (!target || !target.closest('#masonry, #gallery-section') || target.closest('#lightbox, #gallery-header')) return;

    masonryPointerStartX = e.clientX;
    masonryPointerStartY = e.clientY;
    masonryPointerStartTime = performance.now();
    masonryPointerActive = true;
  });

  galleryArea.addEventListener('pointerup', function (e: PointerEvent) {
    if (e.pointerType === 'touch' || !masonryPointerActive) return;
    masonryPointerActive = false;
    if (!isMobileOrTablet()) return;
    if (isLightboxActiveOrTransitioning()) return;

    const endTarget = e.target as HTMLElement | null;
    if (!endTarget || !endTarget.closest('#masonry, #gallery-section') || endTarget.closest('#lightbox, #gallery-header')) return;

    const diffX = e.clientX - masonryPointerStartX;
    const diffY = e.clientY - masonryPointerStartY;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);
    const elapsed = performance.now() - masonryPointerStartTime;

    const minDistance = elapsed < 250 ? 30 : 40;
    if (absX >= minDistance && absX > absY * 1.5 && elapsed < 1000) {
      markMasonrySwipeHappened();
      if (diffX < 0) {
        navigateSubnav(1);
      } else {
        navigateSubnav(-1);
      }
    }
  });

  masonry.addEventListener('pointercancel', function (e: PointerEvent) {
    if (e.pointerType !== 'touch') {
      masonryPointerActive = false;
    }
  });
}

if (masonry) {
  masonry.addEventListener('pointerover', function (e) {
    const card = (e.target as HTMLElement).closest('.photo-card') as HTMLElement | null;
    if (!card) return;
    const idx = parseInt(card.dataset.idx || '0', 10);
    const cardCategory = card.dataset.category || 'all';

    if (cardCategory === 'motion') return;
    if (state.currentCategory !== cardCategory) return;
    scheduleGalleryBlurPreload(idx, 350);
    const p = state.activePhotos[idx];
    if (p) preloadPhotoColor(p);
  });

  masonry.addEventListener('pointerout', function (e) {
    const card = (e.target as HTMLElement).closest('.photo-card') as HTMLElement | null;
    if (!card) return;
    const related = e.relatedTarget as Node | null;
    if (related && card.contains(related)) return;

    if (galleryBlurPreloadTimer) {
      window.clearTimeout(galleryBlurPreloadTimer);
      galleryBlurPreloadTimer = null;
    }
  });

  masonry.addEventListener('focusin', function (e) {
    const card = (e.target as HTMLElement).closest('.photo-card') as HTMLElement | null;
    if (!card) return;
    const idx = parseInt(card.dataset.idx || '0', 10);
    const cardCategory = card.dataset.category || 'all';

    if (cardCategory === 'motion') return;
    if (state.currentCategory !== cardCategory) return;
    scheduleGalleryBlurPreload(idx, 200);
  });

  masonry.addEventListener('click', function (e) {
    if (domRefs.lightbox && domRefs.lightbox.classList.contains('open') && !state.isLightboxClosing && !state.isLightboxDismissing) return;
    if (masonrySwipeHappened) {
      masonrySwipeHappened = false;
      return;
    }
    const card = (e.target as HTMLElement).closest('.photo-card') as HTMLElement | null;
    if (!card) return;
    const idx = parseInt(card.dataset.idx || '0', 10);
    const cardCategory = card.dataset.category || 'all';

    state.currentCategory = cardCategory;
    updateActivePhotos();
    openLightbox(idx, 0, cardCategory === 'motion');
  });

  masonry.addEventListener('keydown', function (e) {
    const card = (e.target as HTMLElement).closest('.photo-card') as HTMLElement | null;
    if (!card) return;
    const keyEvt = e as KeyboardEvent;
    if (keyEvt.key === 'Enter' || keyEvt.key === ' ') {
      keyEvt.preventDefault();
      card.click();
    }
  });

  // JIT proactive layer promotion: stays promoted through the ENTIRE animation lifecycle
  // (promotes on pointerenter, stays promoted while hovering, and only unpromotes once
  // the scale-down exit transition has fully finished animating).
  masonry.addEventListener('pointerenter', function (e) {
    const card = (e.target as HTMLElement).closest('.photo-card');
    if (!card) return;
    const img = card.querySelector('.photo-card-img') as HTMLElement | null;
    if (img) img.style.willChange = 'transform';
  }, true);

  masonry.addEventListener('pointerleave', function (e) {
    const card = (e.target as HTMLElement).closest('.photo-card') as HTMLElement | null;
    if (!card) return;
    const img = card.querySelector('.photo-card-img') as HTMLElement | null;
    if (!img) return;

    // Safety fallback: if transitionend never fires (e.g. tab switch), clean up after animation duration + buffer
    const timer = window.setTimeout(function () {
      if (!card.matches(':hover')) {
        img.style.willChange = 'auto';
      }
    }, 1600);
    card.dataset.unpromoteTimer = String(timer);
  }, true);

  masonry.addEventListener('transitionend', function (e) {
    const target = e.target as HTMLElement | null;
    if (!target || !target.classList.contains('photo-card-img')) return;
    const card = target.closest('.photo-card') as HTMLElement | null;
    if (!card) return;

    if (card.dataset.unpromoteTimer) {
      window.clearTimeout(Number(card.dataset.unpromoteTimer));
      delete card.dataset.unpromoteTimer;
    }

    // Only clean up if the cursor is actually off the card (exit transition completed)
    if (!card.matches(':hover')) {
      target.style.willChange = 'auto';
    }
  });
}

