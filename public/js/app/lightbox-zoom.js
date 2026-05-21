// Continuous Zoom Physics Framework
var lbZoomLevel = 1;
var lbZoomPanX = 0;
var lbZoomPanY = 0;
var isDraggingZoom = false;
var lastDragX = 0;
var lastDragY = 0;

function updateZoomTransform(img) {
  var mWrap = document.getElementById('lightbox-img-wrap');
  var lb = document.getElementById('lightbox');
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
    var dark = document.getElementById('lightbox-zoom-darken');
    if (dark) dark.style.opacity = '0';
    showFilmstrip();
    if (isMobile) {
      mWrap.style.transform = ''; // revert translation
      mWrap.style.overflowX = 'auto'; // restore gallery swipe
      mWrap.style.overflowY = 'hidden';
      mWrap.scrollLeft = cur * mWrap.offsetWidth; // explicitly bind scroll back unconditionally
      var slides = mWrap.querySelectorAll('.snap-slide');
      for (var i = 0; i < slides.length; i++) slides[i].style.opacity = '1';
    }
  } else {
    if (lb) lb.classList.add('zoom-active');
    img.style.position = 'relative';
    img.style.zIndex = '100'; // Make sure the image pops cleanly above bounds

    // Mobile gets unconstrained panning, but auto-resets if dragged extremely far off-screen
    var zw = img.offsetWidth * lbZoomLevel;
    var zh = img.offsetHeight * lbZoomLevel;

    if (isMobile) {
      var limitX = (zw / 2) + (window.innerWidth / 2) - 80;
      var limitY = (zh / 2) + (window.innerHeight / 2) - 80;
      if (Math.abs(lbZoomPanX) > Math.max(0, limitX) || Math.abs(lbZoomPanY) > Math.max(0, limitY)) {
        resetZoom();
        return;
      }
    } else {
      // Desktop stays clamped so it's impossible to lose the image with the mouse
      var maxPanX = Math.max(0, (zw - window.innerWidth) / 2);
      var maxPanY = Math.max(0, (zh - window.innerHeight) / 2);
      lbZoomPanX = Math.max(-maxPanX, Math.min(maxPanX, lbZoomPanX));
      lbZoomPanY = Math.max(-maxPanY, Math.min(maxPanY, lbZoomPanY));
    }

    img.style.transform = 'translate(' + lbZoomPanX + 'px, ' + lbZoomPanY + 'px) scale(' + lbZoomLevel + ')';
    var hint = document.getElementById('swipe-hint');
    if (hint) hint.classList.remove('visible');

    if (!img.dataset.zoomAnimated) {
      img.classList.add('zoomed');
    } else {
      img.classList.remove('zoomed');
    }

    // zoom cursor
    if (!isMobile) img.style.cursor = 'grab';
    if (isDraggingZoom) img.style.cursor = 'grabbing';

    var dark = document.getElementById('lightbox-zoom-darken');
    // base darkness leaps to 30%, climbing dynamically to 90%
    if (dark) dark.style.opacity = Math.min(0.95, 0.3 + (lbZoomLevel - 1) * 0.5);
    hideFilmstrip();

    if (isMobile && mWrap.style.overflowX !== 'visible') {
      // Prevent browser from zero-ing out scroll when we swap to visible overflow
      mWrap.style.transform = 'translateX(-' + (cur * mWrap.offsetWidth) + 'px)';
      mWrap.style.overflowX = 'visible'; // allow zoom popping over descriptions and screens!
      mWrap.style.overflowY = 'visible';
      var slides = mWrap.querySelectorAll('.snap-slide');
      for (var i = 0; i < slides.length; i++) {
        if (parseInt(slides[i].dataset.idx) !== cur) slides[i].style.opacity = '0';
      }
    } else if (isMobile) {
      // already visible, ensure neighbors are hidden while panning to prevent peeking
      var slides = mWrap.querySelectorAll('.snap-slide');
      for (var i = 0; i < slides.length; i++) {
        if (parseInt(slides[i].dataset.idx) !== cur) slides[i].style.opacity = '0';
      }
    }
  }
}

function resetZoom() {
  lbZoomLevel = 1;
  var imgs = document.querySelectorAll('.zoomable');
  for (var i = 0; i < imgs.length; i++) updateZoomTransform(imgs[i]);
}

function toggleImageZoom(e) {
  if (isMobile) return; // Mobile tap logic is strictly handled in lbEl click listener
  var img = e.target;
  if (!img.classList.contains('zoomable')) return;
  e.stopPropagation();
  if (lbZoomLevel > 1) { resetZoom(); }
}
document.getElementById('lightbox-img').addEventListener('click', toggleImageZoom);

// Desktop mouse panning
var mWrap = document.getElementById('lightbox-img-wrap');
mWrap.addEventListener('mousedown', function (e) {
  if (isMobile || lbZoomLevel <= 1) return;
  isDraggingZoom = true;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  var img = document.getElementById('lightbox-img');
  if (img) img.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', function (e) {
  if (!isDraggingZoom) return;
  var dx = e.clientX - lastDragX;
  var dy = e.clientY - lastDragY;
  lbZoomPanX += dx;
  lbZoomPanY += dy;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  var img = document.getElementById('lightbox-img');
  if (img) updateZoomTransform(img);
});
window.addEventListener('mouseup', function () {
  if (isDraggingZoom) {
    isDraggingZoom = false;
    var img = document.getElementById('lightbox-img');
    if (img && lbZoomLevel > 1) img.style.cursor = 'grab';
  }
});


// Desktop: Mouse wheel / Touchpad pinch -> Zoom
document.getElementById('lightbox-img-wrap').addEventListener('wheel', function (e) {
  var lb = document.getElementById('lightbox');
  var mWrap = document.getElementById('lightbox-img-wrap');
  if (!lb.classList.contains('open') || isMobile) return;

  var img = isMobile ? mWrap.querySelector('.snap-slide[data-idx="' + cur + '"] img') : document.getElementById('lightbox-img');
  if (!img || !img.classList.contains('zoomable')) return;

  e.preventDefault();

  var scaleDelta = e.deltaY * -0.01;
  var newScale = Math.min(Math.max(1, lbZoomLevel + scaleDelta), 6);
  if (newScale === lbZoomLevel) return;

  var ratio = newScale / lbZoomLevel;
  var rect = img.getBoundingClientRect();

  var cx = rect.left + rect.width / 2;
  var cy = rect.top + rect.height / 2;
  var mx = e.clientX - cx;
  var my = e.clientY - cy;

  lbZoomPanX -= mx * (ratio - 1);
  lbZoomPanY -= my * (ratio - 1);
  lbZoomLevel = newScale;

  updateZoomTransform(img);
}, { passive: false });
