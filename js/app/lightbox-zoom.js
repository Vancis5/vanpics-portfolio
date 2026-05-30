import { domRefs } from './dom.js';
import { state } from './state.js';
import { hideFilmstripIfReady, showFilmstripIfReady } from './core.js';

// Continuous Zoom Physics Framework
let isDraggingZoom = false;
let lastDragX = 0;
let lastDragY = 0;

export function updateZoomTransform(img) {
  let mWrap = domRefs.lightboxImgWrap;
  let lb = domRefs.lightbox;
  if (lb) lb.classList.toggle('zoom-active', state.lbZoomLevel > 1);
  if (state.lbZoomLevel <= 1) {
    state.lbZoomLevel = 1;
    state.lbZoomPanX = 0;
    state.lbZoomPanY = 0;
    if (lb) lb.classList.remove('zoom-active');
    img.style.transform = '';
    // reset cursor
    img.style.cursor = '';
    img.style.position = '';
    img.style.zIndex = '';
    img.classList.remove('zoomed');
    let dark = domRefs.lightboxZoomDarken;
    if (dark) dark.style.opacity = '0';
    showFilmstripIfReady();
    if (state.isMobile) {
      mWrap.style.transform = ''; // revert translation
      mWrap.style.overflowX = 'auto'; // restore gallery swipe
      mWrap.style.overflowY = 'hidden';
      mWrap.scrollLeft = state.cur * mWrap.offsetWidth; // explicitly bind scroll back unconditionally
      let slides = mWrap.querySelectorAll('.snap-slide');
      for (let i = 0; i < slides.length; i++) slides[i].style.opacity = '1';
    }
  } else {
    if (lb) lb.classList.add('zoom-active');
    img.style.position = 'relative';
    img.style.zIndex = '100'; // Make sure the image pops cleanly above bounds

    // Mobile gets unconstrained panning, but auto-resets if dragged extremely far off-screen
    let zw = img.offsetWidth * state.lbZoomLevel;
    let zh = img.offsetHeight * state.lbZoomLevel;

    if (state.isMobile) {
      let limitX = (zw / 2) + (window.innerWidth / 2) - 80;
      let limitY = (zh / 2) + (window.innerHeight / 2) - 80;
      if (Math.abs(state.lbZoomPanX) > Math.max(0, limitX) || Math.abs(state.lbZoomPanY) > Math.max(0, limitY)) {
        resetZoom();
        return;
      }
    } else {
      // Desktop stays clamped so it's impossible to lose the image with the mouse
      let maxPanX = Math.max(0, (zw - window.innerWidth) / 2);
      let maxPanY = Math.max(0, (zh - window.innerHeight) / 2);
      state.lbZoomPanX = Math.max(-maxPanX, Math.min(maxPanX, state.lbZoomPanX));
      state.lbZoomPanY = Math.max(-maxPanY, Math.min(maxPanY, state.lbZoomPanY));
    }

    img.style.transform = 'translate(' + state.lbZoomPanX + 'px, ' + state.lbZoomPanY + 'px) scale(' + state.lbZoomLevel + ')';
    let hint = document.getElementById('swipe-hint');
    if (hint) hint.classList.remove('visible');

    if (!img.dataset.zoomAnimated) {
      img.classList.add('zoomed');
    } else {
      img.classList.remove('zoomed');
    }

    // zoom cursor
    if (!state.isMobile) img.style.cursor = 'grab';
    if (isDraggingZoom) img.style.cursor = 'grabbing';

    let dark = domRefs.lightboxZoomDarken;
    // base darkness leaps to 30%, climbing dynamically to 90%
    if (dark) dark.style.opacity = Math.min(0.95, 0.3 + (state.lbZoomLevel - 1) * 0.5);
    hideFilmstripIfReady();

    if (state.isMobile && mWrap.style.overflowX !== 'visible') {
      // Prevent browser from zero-ing out scroll when we swap to visible overflow
      mWrap.style.transform = 'translateX(-' + (state.cur * mWrap.offsetWidth) + 'px)';
      mWrap.style.overflowX = 'visible'; // allow zoom popping over descriptions and screens!
      mWrap.style.overflowY = 'visible';
      let slides = mWrap.querySelectorAll('.snap-slide');
      for (let i = 0; i < slides.length; i++) {
        if (parseInt(slides[i].dataset.idx) !== state.cur) slides[i].style.opacity = '0';
      }
    } else if (state.isMobile) {
      // already visible, ensure neighbors are hidden while panning to prevent peeking
      let slides = mWrap.querySelectorAll('.snap-slide');
      for (let i = 0; i < slides.length; i++) {
        if (parseInt(slides[i].dataset.idx) !== state.cur) slides[i].style.opacity = '0';
      }
    }
  }
}

export function resetZoom() {
  state.lbZoomLevel = 1;
  let imgs = document.querySelectorAll('.zoomable');
  for (let i = 0; i < imgs.length; i++) updateZoomTransform(imgs[i]);
}

export function toggleImageZoom(e) {
  if (state.isMobile) return; // Mobile tap logic is strictly handled in lbEl click listener
  let img = e.target;
  if (!img.classList.contains('zoomable')) return;
  e.stopPropagation();
  if (state.lbZoomLevel > 1) { resetZoom(); }
}
domRefs.lightboxImg.addEventListener('click', toggleImageZoom);

// Desktop mouse panning
let mWrap = domRefs.lightboxImgWrap;
mWrap.addEventListener('mousedown', function (e) {
  if (state.isMobile || state.lbZoomLevel <= 1) return;
  isDraggingZoom = true;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  let img = domRefs.lightboxImg;
  if (img) img.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', function (e) {
  if (!isDraggingZoom) return;
  let dx = e.clientX - lastDragX;
  let dy = e.clientY - lastDragY;
  state.lbZoomPanX += dx;
  state.lbZoomPanY += dy;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  let img = domRefs.lightboxImg;
  if (img) updateZoomTransform(img);
});
window.addEventListener('mouseup', function () {
  if (isDraggingZoom) {
    isDraggingZoom = false;
    let img = domRefs.lightboxImg;
    if (img && state.lbZoomLevel > 1) img.style.cursor = 'grab';
  }
});


// Desktop: Mouse wheel / Touchpad pinch -> Zoom
domRefs.lightboxImgWrap.addEventListener('wheel', function (e) {
  let lb = domRefs.lightbox;
  if (!lb.classList.contains('open') || state.isMobile) return;

  let img = state.isMobile ? mWrap.querySelector('.snap-slide[data-idx="' + state.cur + '"] img') : domRefs.lightboxImg;
  if (!img || !img.classList.contains('zoomable')) return;

  e.preventDefault();

  let scaleDelta = e.deltaY * -0.01;
  let newScale = Math.min(Math.max(1, state.lbZoomLevel + scaleDelta), 6);
  if (newScale === state.lbZoomLevel) return;

  let ratio = newScale / state.lbZoomLevel;
  let rect = img.getBoundingClientRect();

  let cx = rect.left + rect.width / 2;
  let cy = rect.top + rect.height / 2;
  let mx = e.clientX - cx;
  let my = e.clientY - cy;

  state.lbZoomPanX -= mx * (ratio - 1);
  state.lbZoomPanY -= my * (ratio - 1);
  state.lbZoomLevel = newScale;

  updateZoomTransform(img);
}, { passive: false });
