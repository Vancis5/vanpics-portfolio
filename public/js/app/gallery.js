let cardObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      let card = entry.target;
      let img = card.querySelector('img');

      let reveal = function () {
        card.classList.add('revealed');
        cardObserver.unobserve(card);
      };

      if (img && img.complete && img.naturalHeight !== 0) {
        reveal();
      } else if (img) {
        img.addEventListener('load', reveal, { once: true });
      }
    }
  });
}, { rootMargin: '0px 0px -60px 0px' });

function revealCards(scope) {
  let root = scope || getActiveGalleryPanel() || document;
  root.querySelectorAll('.photo-card:not(.revealed)').forEach(function (card) {
    cardObserver.observe(card);
  });
}

// Masonry: scroll reveal handles fade-in.
// Aspect ratios are cached in localStorage to prevent CLS on repeat visits.
let RATIO_CACHE_KEY = 'van_ratios_v1';
let ratioCache = {};
try {
  let stored = localStorage.getItem(RATIO_CACHE_KEY);
  if (stored) ratioCache = JSON.parse(stored);
} catch (e) { }

function saveRatioCache() {
  try { localStorage.setItem(RATIO_CACHE_KEY, JSON.stringify(ratioCache)); } catch (e) { }
}

let GALLERY_CATEGORIES = ['all', 'figures', 'motion'];
let GALLERY_SCROLL_MEMORY_KEY = 'van_gallery_scroll_v2';
let galleryScrollPositions = { all: null, figures: null, motion: null };
let galleryPanelsBuilt = false;
let galleryScrollSaveRaf = null;

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

function normalizeGalleryCategory(category) {
  return GALLERY_CATEGORIES.indexOf(category) >= 0 ? category : 'all';
}

function rememberGalleryScroll(category) {
  category = normalizeGalleryCategory(category);
  galleryScrollPositions[category] = window.pageYOffset || document.documentElement.scrollTop || 0;
  try { sessionStorage.setItem(GALLERY_SCROLL_MEMORY_KEY, JSON.stringify(galleryScrollPositions)); } catch (e) { }
}

function queueGalleryScrollMemory() {
  if (domRefs.lightbox && domRefs.lightbox.classList.contains('open')) return;
  if (galleryScrollSaveRaf) return;

  galleryScrollSaveRaf = requestAnimationFrame(function () {
    galleryScrollSaveRaf = null;
    rememberGalleryScroll(currentCategory);
  });
}

window.addEventListener('scroll', queueGalleryScrollMemory, { passive: true });

function getGalleryAnchorScrollY() {
  let section = domRefs.gallerySection;
  if (!section) return 0;
  return section.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0);
}

function getGalleryStickyStartScrollY() {
  let section = domRefs.gallerySection;
  let header = document.querySelector('#gallery-header');
  if (!section || !header) return getGalleryAnchorScrollY();

  let scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  let sectionTop = section.getBoundingClientRect().top + scrollY;
  let sectionStyles = window.getComputedStyle(section);
  let headerStyles = window.getComputedStyle(header);
  let sectionPaddingTop = parseFloat(sectionStyles.paddingTop) || 0;
  let stickyTop = parseFloat(headerStyles.top) || 0;

  return Math.max(0, sectionTop + sectionPaddingTop - stickyTop);
}

function isGalleryHeaderStuck() {
  let scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  return scrollY >= getGalleryStickyStartScrollY() - 1;
}

function getMaxPageScroll() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

function restoreWindowScroll(scrollY) {
  let clampedScroll = Math.max(0, Math.min(scrollY, getMaxPageScroll()));
  if (window.lenis) window.lenis.scrollTo(clampedScroll, { immediate: true });
  else window.scrollTo({ top: clampedScroll, behavior: 'auto' });
  return clampedScroll;
}

function getGalleryTargetScroll(category, options) {
  options = options || {};
  category = normalizeGalleryCategory(category);
  let saved = galleryScrollPositions[category];
  let targetScrollY = Number.isFinite(saved) ? saved : getGalleryAnchorScrollY();

  if (options.lockToStickyStart) {
    targetScrollY = Math.max(targetScrollY, getGalleryStickyStartScrollY());
  }

  return targetScrollY;
}

function refreshGalleryScrollMetrics() {
  if (window.lenis && typeof window.lenis.resize === 'function') window.lenis.resize();
  if (window.updateStickyHeaderSurface) window.updateStickyHeaderSurface();
  if (window.updateCustomScrollbar) window.updateCustomScrollbar();
}

function getCategoryItems(category) {
  if (category === 'motion') return motionProjects;
  return getPhotoLibrary(category);
}

function getGalleryPanel(category) {
  let masonry = domRefs.masonry;
  if (!masonry) return null;

  category = normalizeGalleryCategory(category);
  let panel = masonry.querySelector('.masonry-panel[data-category="' + category + '"]');
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
  return getGalleryPanel(currentCategory);
}

function updateGalleryNav(category) {
  let photoBtn = document.querySelector('#gallery-header .photographs-btn');
  let figuresBtn = document.querySelector('#gallery-header .figures-btn');
  let motionBtn = document.querySelector('#gallery-header .motion-btn');

  [photoBtn, figuresBtn, motionBtn].forEach(function (button) {
    if (button) {
      button.classList.remove('active');
      button.classList.add('inactive');
    }
  });

  if (category === 'all' && photoBtn) {
    photoBtn.classList.remove('inactive');
    photoBtn.classList.add('active');
  }
  if (category === 'figures' && figuresBtn) {
    figuresBtn.classList.remove('inactive');
    figuresBtn.classList.add('active');
  }
  if (category === 'motion' && motionBtn) {
    motionBtn.classList.remove('inactive');
    motionBtn.classList.add('active');
  }
}

function setActiveGalleryPanel(category, options) {
  options = options || {};
  category = normalizeGalleryCategory(category);

  let masonry = domRefs.masonry;
  let gallerySec = domRefs.gallerySection;
  if (!masonry) return null;

  let activePanel = null;
  GALLERY_CATEGORIES.forEach(function (cat) {
    let panel = getGalleryPanel(cat);
    if (!panel) return;
    let isActive = cat === category;
    panel.hidden = !isActive;
    panel.classList.toggle('is-active', isActive);
    panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    if (isActive) activePanel = panel;
    else panel.classList.remove('is-entering');
  });

  masonry.classList.toggle('motion-grid-active', category === 'motion');
  if (gallerySec) gallerySec.classList.toggle('motion-active', category === 'motion');
  updateGalleryNav(category);

  if (activePanel && options.animate) {
    activePanel.classList.remove('is-entering');
    void activePanel.offsetWidth;
    activePanel.classList.add('is-entering');
    setTimeout(function () {
      activePanel.classList.remove('is-entering');
    }, 500);
  }

  requestAnimationFrame(function () {
    revealCards(activePanel);
    refreshGalleryScrollMetrics();
  });

  return activePanel;
}

function rebuildGallery(newCategory, options) {
  options = options || {};
  newCategory = normalizeGalleryCategory(newCategory);

  if (!galleryPanelsBuilt) buildMasonry();

  let previousCategory = normalizeGalleryCategory(currentCategory);
  let currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  let lockToStickyStart = !options.preserveScroll && isGalleryHeaderStuck();
  let targetScrollY = options.preserveScroll ? currentScrollY : getGalleryTargetScroll(newCategory, {
    lockToStickyStart: lockToStickyStart
  });

  if (previousCategory !== newCategory && !Number.isFinite(galleryScrollPositions[previousCategory])) {
    rememberGalleryScroll(previousCategory);
  }

  currentCategory = newCategory;
  updateActivePhotos();

  if (!domRefs.lightbox.classList.contains('open') && !isPopState) {
    let catSlug = getCategorySlug(newCategory);
    let curHash = window.location.hash.substring(1);
    if (!curHash.startsWith(catSlug)) {
      history.pushState(null, null, '#' + catSlug);
    }
  }

  window.dispatchEvent(new Event('category-change'));
  setActiveGalleryPanel(newCategory, { animate: options.animate });

  requestAnimationFrame(function () {
    restoreWindowScroll(targetScrollY);
    refreshGalleryScrollMetrics();
    setTimeout(refreshGalleryScrollMetrics, 120);
    if (typeof options.onReady === 'function') options.onReady();
  });
}

function initFilters() {
  let photoBtn = document.querySelector('#gallery-header .photographs-btn');
  let figuresBtn = document.querySelector('#gallery-header .figures-btn');
  let motionBtn = document.querySelector('#gallery-header .motion-btn');

  updateGalleryNav(currentCategory);

  [
    { button: photoBtn, category: 'all' },
    { button: figuresBtn, category: 'figures' },
    { button: motionBtn, category: 'motion' }
  ].forEach(function (item) {
    if (!item.button) return;

    item.button.addEventListener('click', function () {
      if (currentCategory === item.category) return;
      rebuildGallery(item.category, { animate: true });
    });
  });
}

function buildMasonry(category) {
  let masonry = domRefs.masonry;
  if (!masonry) return;

  if (!category) {
    let shouldRestoreScroll = galleryPanelsBuilt;
    if (shouldRestoreScroll) rememberGalleryScroll(currentCategory);

    GALLERY_CATEGORIES.forEach(function (cat) {
      buildMasonry(cat);
    });

    galleryPanelsBuilt = true;
    setActiveGalleryPanel(currentCategory);

    if (shouldRestoreScroll) {
      requestAnimationFrame(function () {
        restoreWindowScroll(getGalleryTargetScroll(currentCategory, {
          lockToStickyStart: isGalleryHeaderStuck()
        }));
        refreshGalleryScrollMetrics();
      });
    }
    return;
  }

  category = normalizeGalleryCategory(category);
  let panel = getGalleryPanel(category);
  if (!panel) return;

  panel.innerHTML = '';
  let lastYear = null;
  let isMotion = category === 'motion';
  let items = getCategoryItems(category);
  let yearGrid = null;
  let columns = [];
  let colHeights = [];
  let numCols = (window.innerWidth >= 1024) ? 4 : 3;

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
      for (let c = 0; c < numCols; c++) {
        let col = document.createElement('div');
        col.className = 'masonry-column';
        yearGrid.appendChild(col);
        columns.push(col);
        colHeights.push(0);
      }

      panel.appendChild(yearSection);
      lastYear = currentYear;
    }

    let card = document.createElement('div');
    card.className = isMotion ? 'photo-card motion-card' : 'photo-card';
    let imgEl = document.createElement('img');

    let basePath = isMotion ? (p.thumb || "") : (p.src || "");
    let thumbPath = basePath.includes('thumbs/') ? basePath : basePath.replace('photos/', 'photos/thumbs/');

    imgEl.src = thumbPath;
    imgEl.alt = p.title || "video";
    imgEl.loading = i < 8 ? 'eager' : 'lazy';
    imgEl.decoding = i < 8 ? 'sync' : 'async';

    let r = parseFloat(p.aspectRatio || ratioCache[basePath] || 1);
    imgEl.style.aspectRatio = r;

    if (!p.aspectRatio && !ratioCache[basePath]) {
      imgEl.addEventListener('load', function () {
        if (imgEl.naturalWidth && imgEl.naturalHeight) {
          let ratio = (imgEl.naturalWidth / imgEl.naturalHeight).toFixed(4);
          ratioCache[basePath] = ratio;
          imgEl.style.aspectRatio = ratio;
          saveRatioCache();
        }
      });
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

    card.addEventListener('click', (function (idx, cardCategory) {
      return function () {
        if (currentCategory !== cardCategory) {
          currentCategory = cardCategory;
          updateActivePhotos();
        }
        openLightbox(idx, 0, cardCategory === 'motion');
      };
    })(i, category));

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

  if (category === currentCategory) setTimeout(function () { revealCards(panel); }, 150);
}
