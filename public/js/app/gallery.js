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

function revealCards() {
  document.querySelectorAll('.photo-card:not(.revealed)').forEach(function (card) {
    cardObserver.observe(card);
  });
}

// MASONRY — scroll reveal handles fade-in
// aspect ratios cached in localStorage to prevent CLS on repeat visits
let RATIO_CACHE_KEY = 'van_ratios_v1';
let ratioCache = {};
try {
  let stored = localStorage.getItem(RATIO_CACHE_KEY);
  if (stored) ratioCache = JSON.parse(stored);
} catch (e) { }

function saveRatioCache() {
  try { localStorage.setItem(RATIO_CACHE_KEY, JSON.stringify(ratioCache)); } catch (e) { }
}

function rebuildGallery(newCategory, options) {
  options = options || {};
  let m = domRefs.masonry;
  if (!m) return;
  let oldCategory = currentCategory;

  // 1. Height Lock: Keep the page at its current length
  let currentHeight = m.offsetHeight;
  m.style.minHeight = currentHeight + 'px';

  // 1.5 Anchor View: Ensure tap switches begin from the gallery header.
  // Swipe commits preserve the user's exact scroll position so sticky state doesn't jump.
  let header = domRefs.galleryHeader;
  let lockedScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  if (!options.preserveScroll && header) {
    let headerPos = header.getBoundingClientRect().top + window.pageYOffset;
    if (lockedScrollY > headerPos) {
      if (window.lenis) window.lenis.scrollTo(headerPos, { immediate: true });
      else window.scrollTo({ top: headerPos, behavior: 'auto' });
    }
  }

  // 2. Fast Swap
  setTimeout(function () {
    let order = ['all', 'figures', 'motion'];
    let oldIdx = order.indexOf(oldCategory);
    let newIdx = order.indexOf(newCategory);
    let direction = newIdx > oldIdx ? 'right' : 'left';
    let slideX = direction === 'left' ? '-40px' : '40px';

    currentCategory = newCategory;
    updateActivePhotos();

    // Update URL hash for category if lightbox not open
    if (!domRefs.lightbox.classList.contains('open') && !isPopState) {
      let catSlug = getCategorySlug(newCategory);
      let curHash = window.location.hash.substring(1);
      // Only update if the hash doesn't already start with this category slug (prevents wiping item slugs)
      if (!curHash.startsWith(catSlug)) {
        history.pushState(null, null, '#' + catSlug);
      }
    }

    window.dispatchEvent(new Event('category-change'));

    m.innerHTML = '';
    m.classList.toggle('motion-grid-active', newCategory === 'motion');
    let gallerySec = domRefs.gallerySection;
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
    let photoBtn = document.querySelector('.photographs-btn');
    let figuresBtn = document.querySelector('.figures-btn');
    let motionBtn = document.querySelector('.motion-btn');
    [photoBtn, figuresBtn, motionBtn].forEach(function (b) { if (b) { b.classList.remove('active'); b.classList.add('inactive'); } });
    if (newCategory === 'all' && photoBtn) { photoBtn.classList.remove('inactive'); photoBtn.classList.add('active'); }
    if (newCategory === 'figures' && figuresBtn) { figuresBtn.classList.remove('inactive'); figuresBtn.classList.add('active'); }
    if (newCategory === 'motion' && motionBtn) { motionBtn.classList.remove('inactive'); motionBtn.classList.add('active'); }

    // 4. Cleanup
    let updateCount = 0;
    let updateInterval = setInterval(function () {
      if (window.updateCustomScrollbar) window.updateCustomScrollbar();
      if (++updateCount >= 6) clearInterval(updateInterval);
    }, 100);

    setTimeout(function () {
      m.style.minHeight = '';
      if (options.preserveScroll) { if (window.lenis) window.lenis.scrollTo(lockedScrollY, { immediate: true }); else window.scrollTo(0, lockedScrollY); }
      if (window.updateCustomScrollbar) window.updateCustomScrollbar();
    }, 600);

    if (typeof options.onReady === 'function') options.onReady();
  }, 0);
}



function initFilters() {
  let photoBtn = document.querySelector('#gallery-header .photographs-btn');
  let figuresBtn = document.querySelector('#gallery-header .figures-btn');
  let motionBtn = document.querySelector('#gallery-header .motion-btn');

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
  let m = domRefs.masonry;
  if (!m) return;
  m.innerHTML = '';
  let lastYear = null;

  let isMotion = (currentCategory === 'motion');
  let items = isMotion ? motionProjects : activePhotos;
  let isSwitching = m.classList.contains('switching');
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

      m.appendChild(yearSection);
      lastYear = currentYear;
    }

    let card = document.createElement('div');
    card.className = isMotion ? 'photo-card motion-card' : 'photo-card';
    if (isSwitching) card.classList.add('revealed');
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

  // Special handling for the switch reveal
  if (m.classList.contains('switching')) {
    // Force instant reveal for top cards so they ONLY slide horizontally
    setTimeout(function () {
      let topCards = m.querySelectorAll('.photo-card');
      topCards.forEach(function (c, idx) {
        let r = c.getBoundingClientRect();
        if (r.top < window.innerHeight) {
          c.style.transition = 'none'; // Kill vertical lift
          c.classList.add('revealed');
          setTimeout(function () { c.style.transition = ''; }, 100);
        }
      });
    }, 0);
  }

  setTimeout(revealCards, 150);
}
