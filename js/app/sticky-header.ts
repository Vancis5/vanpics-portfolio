import { domRefs } from './dom.js';

// Initialize observer
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStickyHeaderObserver);
} else {
  // Run next tick to make sure domRefs are fully initialized
  setTimeout(initStickyHeaderObserver, 0);
}

function initStickyHeaderObserver() {
  const header = domRefs.galleryHeader;
  if (!header) return;

  const stickyTop = parseFloat(window.getComputedStyle(header).top) || 0;

  const observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    const stuck = entry.intersectionRatio < 1 && entry.boundingClientRect.top <= stickyTop;
    document.body.classList.toggle('gallery-header-stuck', stuck);
  }, {
    threshold: [1],
    rootMargin: `-${stickyTop + 1}px 0px 0px 0px`
  });

  observer.observe(header);
}

export function updateStickyHeaderSurface() {
  const header = domRefs.galleryHeader;
  if (!header) return;
  const stickyTop = parseFloat(window.getComputedStyle(header).top) || 0;
  const rect = header.getBoundingClientRect();
  const stuck = rect.top <= stickyTop && (window.pageYOffset || document.documentElement.scrollTop || 0) > 0;
  document.body.classList.toggle('gallery-header-stuck', stuck);
}
