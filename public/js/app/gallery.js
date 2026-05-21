var cardObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      var card = entry.target;
      var img = card.querySelector('img');

      var reveal = function () {
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
var RATIO_CACHE_KEY = 'van_ratios_v1';
var ratioCache = {};
try {
  var stored = localStorage.getItem(RATIO_CACHE_KEY);
  if (stored) ratioCache = JSON.parse(stored);
} catch (e) { }

function saveRatioCache() {
  try { localStorage.setItem(RATIO_CACHE_KEY, JSON.stringify(ratioCache)); } catch (e) { }
}

function rebuildGallery(newCategory, options) {
  options = options || {};
  var m = document.getElementById('masonry');
  if (!m) return;
  var oldCategory = currentCategory;

  // 1. Height Lock: Keep the page at its current length
  var currentHeight = m.offsetHeight;
  m.style.minHeight = currentHeight + 'px';

  // 1.5 Anchor View: Ensure tap switches begin from the gallery header.
  // Swipe commits preserve the user's exact scroll position so sticky state doesn't jump.
  var header = document.getElementById('gallery-header');
  var lockedScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  if (!options.preserveScroll && header) {
    var headerPos = header.getBoundingClientRect().top + window.pageYOffset;
    if (lockedScrollY > headerPos) {
      if (window.lenis) window.lenis.scrollTo(headerPos, { immediate: true });
      else window.scrollTo({ top: headerPos, behavior: 'auto' });
    }
  }

  // 2. Fast Swap
  setTimeout(function () {
    var order = ['all', 'figures', 'motion'];
    var oldIdx = order.indexOf(oldCategory);
    var newIdx = order.indexOf(newCategory);
    var direction = newIdx > oldIdx ? 'right' : 'left';
    var slideX = direction === 'left' ? '-40px' : '40px';

    currentCategory = newCategory;
    updateActivePhotos();

    // Update URL hash for category if lightbox not open
    if (!document.getElementById('lightbox').classList.contains('open') && !isPopState) {
      var catSlug = getCategorySlug(newCategory);
      var curHash = window.location.hash.substring(1);
      // Only update if the hash doesn't already start with this category slug (prevents wiping item slugs)
      if (!curHash.startsWith(catSlug)) {
        history.pushState(null, null, '#' + catSlug);
      }
    }

    window.dispatchEvent(new Event('category-change'));

    m.innerHTML = '';
    m.classList.toggle('motion-grid-active', newCategory === 'motion');
    var gallerySec = document.getElementById('gallery-section');
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
    var photoBtn = document.querySelector('.photographs-btn');
    var figuresBtn = document.querySelector('.figures-btn');
    var motionBtn = document.querySelector('.motion-btn');
    [photoBtn, figuresBtn, motionBtn].forEach(function (b) { if (b) { b.classList.remove('active'); b.classList.add('inactive'); } });
    if (newCategory === 'all' && photoBtn) { photoBtn.classList.remove('inactive'); photoBtn.classList.add('active'); }
    if (newCategory === 'figures' && figuresBtn) { figuresBtn.classList.remove('inactive'); figuresBtn.classList.add('active'); }
    if (newCategory === 'motion' && motionBtn) { motionBtn.classList.remove('inactive'); motionBtn.classList.add('active'); }

    // 4. Cleanup
    var updateCount = 0;
    var updateInterval = setInterval(function () {
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
  var photoBtn = document.querySelector('#gallery-header .photographs-btn');
  var figuresBtn = document.querySelector('#gallery-header .figures-btn');
  var motionBtn = document.querySelector('#gallery-header .motion-btn');

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
  var m = document.getElementById('masonry');
  if (!m) return;
  m.innerHTML = '';
  var lastYear = null;

  var isMotion = (currentCategory === 'motion');
  var items = isMotion ? motionProjects : activePhotos;
  var isSwitching = m.classList.contains('switching');
  var yearGrid = null;
  var columns = [];
  var colHeights = [];
  var numCols = (window.innerWidth >= 1024) ? 4 : 3;

  items.forEach(function (p, i) {
    var currentYear = p.date ? (p.date.match(/\d{4}/) || ["undated"])[0] : "undated";

    if (currentYear !== lastYear) {
      var yearSection = document.createElement('section');
      yearSection.className = 'masonry-year';

      var header = document.createElement('div');
      header.className = 'date-header';
      header.textContent = currentYear;
      yearSection.appendChild(header);

      yearGrid = document.createElement('div');
      yearGrid.className = 'masonry-year-grid';
      yearSection.appendChild(yearGrid);

      columns = [];
      colHeights = [];
      for (var c = 0; c < numCols; c++) {
        var col = document.createElement('div');
        col.className = 'masonry-column';
        yearGrid.appendChild(col);
        columns.push(col);
        colHeights.push(0);
      }

      m.appendChild(yearSection);
      lastYear = currentYear;
    }

    var card = document.createElement('div');
    card.className = isMotion ? 'photo-card motion-card' : 'photo-card';
    if (isSwitching) card.classList.add('revealed');
    var imgEl = document.createElement('img');

    var basePath = isMotion ? (p.thumb || "") : (p.src || "");
    var thumbPath = basePath.includes('thumbs/') ? basePath : basePath.replace('photos/', 'photos/thumbs/');

    imgEl.src = thumbPath;
    imgEl.alt = p.title || "video";
    imgEl.loading = i < 8 ? 'eager' : 'lazy';
    imgEl.decoding = i < 8 ? 'sync' : 'async';

    var r = parseFloat(p.aspectRatio || ratioCache[basePath] || 1);
    imgEl.style.aspectRatio = r;

    if (!p.aspectRatio && !ratioCache[basePath]) {
      imgEl.addEventListener('load', function () {
        if (imgEl.naturalWidth && imgEl.naturalHeight) {
          var ratio = (imgEl.naturalWidth / imgEl.naturalHeight).toFixed(4);
          ratioCache[basePath] = ratio;
          imgEl.style.aspectRatio = ratio;
          saveRatioCache();
        }
      });
    }

    var overlay = document.createElement('div');
    overlay.className = 'photo-card-overlay';
    overlay.innerHTML = '<div class="photo-card-title">' + (p.title || "") + '</div><div class="photo-card-date">' + (p.date || "undated") + '</div>';
    card.appendChild(imgEl);
    card.appendChild(overlay);

    card.addEventListener('click', (function (idx) {
      return function () { openLightbox(idx, 0, isMotion); };
    })(i));

    // Shortest-column distribution
    var shortestIdx = 0;
    var minH = colHeights[0];
    for (var h = 1; h < numCols; h++) {
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
      var topCards = m.querySelectorAll('.photo-card');
      topCards.forEach(function (c, idx) {
        var r = c.getBoundingClientRect();
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
