import { domRefs } from './dom.js';

// Initialize observer
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStickyHeaderObserver);
  } else {
    // Run next tick to make sure domRefs are fully initialized
    setTimeout(initStickyHeaderObserver, 0);
  }
}

function initStickyHeaderObserver() {
  const header = domRefs.galleryHeader;
  if (!header) return;

  const sentinel = document.createElement('div');
  sentinel.id = 'gallery-header-sentinel';
  sentinel.style.height = '1px';
  sentinel.style.marginTop = '-1px';
  sentinel.style.pointerEvents = 'none';
  sentinel.style.visibility = 'hidden';

  header.parentNode?.insertBefore(sentinel, header);

  const observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    const stuck = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    document.body.classList.toggle('gallery-header-stuck', stuck);
  }, {
    threshold: [0]
  });

  observer.observe(sentinel);
}

export function updateStickyHeaderSurface() {
  // Now handled asynchronously and layout-free by IntersectionObserver.
  // We keep this function as a no-op to maintain the module signature.
}
