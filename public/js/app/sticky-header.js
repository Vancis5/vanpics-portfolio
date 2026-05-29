import { domRefs } from './dom.js';

export function updateStickyHeaderSurface() {
  const header = domRefs.galleryHeader;
  if (!header) return;

  document.body.classList.toggle('gallery-header-stuck', header.getBoundingClientRect().top <= 0.5);
}
