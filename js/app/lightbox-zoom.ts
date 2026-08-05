import { domRefs } from './dom.js';
import { state } from './state.js';
import { hideFilmstripIfReady, showFilmstripIfReady } from './core.js';
import { getLastSideNavTime } from './lightbox-nav.js';

const LUCIDE_ZOOM_IN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='-4 -4 32 32' fill='none' stroke='%23ddd8cf' stroke-width='2.7' stroke-linecap='round' stroke-linejoin='round' style='filter:drop-shadow(0 1.5px 2px %23000)'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3Cline x1='11' y1='8' x2='11' y2='14'/%3E%3Cline x1='8' y1='11' x2='14' y2='11'/%3E%3C/svg%3E") 11 11, zoom-in`;

const LUCIDE_ZOOM_OUT = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='-4 -4 32 32' fill='none' stroke='%23ddd8cf' stroke-width='2.7' stroke-linecap='round' stroke-linejoin='round' style='filter:drop-shadow(0 1.5px 2px %23000)'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3Cline x1='8' y1='11' x2='14' y2='11'/%3E%3C/svg%3E") 11 11, zoom-out`;

const LUCIDE_GRAB = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='-4 -4 32 32' fill='none' stroke='%23ddd8cf' stroke-width='2.7' stroke-linecap='round' stroke-linejoin='round' style='filter:drop-shadow(0 1.5px 2px %23000)'%3E%3Cpath d='M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0'/%3E%3Cpath d='M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2'/%3E%3Cpath d='M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8'/%3E%3Cpath d='M18 8a2 2 0 0 1 2 2v4a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'/%3E%3C/svg%3E") 11 11, grab`;

const LUCIDE_GRABBING = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='-4 -4 32 32' fill='none' stroke='%23ddd8cf' stroke-width='2.7' stroke-linecap='round' stroke-linejoin='round' style='filter:drop-shadow(0 1.5px 2px %23000)'%3E%3Cpath d='M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0'/%3E%3Cpath d='M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2'/%3E%3Cpath d='M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8'/%3E%3Cpath d='M18 8a2 2 0 0 1 2 2v4a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'/%3E%3C/svg%3E") 11 11, grabbing`;

// Continuous Zoom Physics Framework
let isDraggingZoom = false;
let lastDragX: number | null = null;
let lastDragY: number | null = null;
let lastTapTime = 0;
let zoomTransitionTimeout: any = null;
let isSpacePressed = false;
let dragDistance = 0;
let startX = 0;
let startY = 0;
let activeRawLoader: HTMLImageElement | null = null;

export function updateZoomTransform(img: any, smooth = true) {
  if (state.currentLightboxIsMotion) return;
  let mWrap = domRefs.lightboxImgWrap;
  let lb = domRefs.lightbox;
  
  // Clear any pending transition timeout
  if (zoomTransitionTimeout) {
    clearTimeout(zoomTransitionTimeout);
    zoomTransitionTimeout = null;
  }

  // Cancel active raw loader if zoomed back below 1.2x
  if (state.lbZoomLevel < 1.2) {
    if (activeRawLoader) {
      activeRawLoader.onload = null;
      activeRawLoader.onerror = null;
      activeRawLoader = null;
    }
    img.removeAttribute('data-loading-raw');
    let wrap = domRefs.lightboxImgWrap;
    if (wrap) wrap.classList.remove('raw-loading');
  }
  
  if (state.lbZoomLevel <= 1) {
    state.lbZoomLevel = 1;
    state.lbZoomPanX = 0;
    state.lbZoomPanY = 0;

    const finalizeReset = () => {
      if (lb) lb.classList.remove('zoom-active');
      img.style.position = '';
      img.style.zIndex = '';
      if (state.isMobile && mWrap) {
        mWrap.style.transform = ''; // revert translation
        mWrap.style.overflowX = 'auto'; // restore gallery swipe
        mWrap.style.overflowY = 'hidden';
        mWrap.scrollLeft = state.cur * mWrap.offsetWidth; // explicitly bind scroll back unconditionally
        let slides = mWrap.querySelectorAll('.snap-slide') as NodeListOf<HTMLElement>;
        for (let i = 0; i < slides.length; i++) slides[i].style.opacity = '1';
      }
    };
    
    // Apply smooth transition when resetting
    if (smooth) {
      img.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
      zoomTransitionTimeout = setTimeout(() => {
        img.style.transition = '';
        finalizeReset();
      }, 300);
    } else {
      img.style.transition = '';
      finalizeReset();
    }
    img.style.transform = '';
    // reset cursor
    img.style.removeProperty('cursor');
    img.classList.remove('zoomed');
    let dark = domRefs.lightboxZoomDarken;
    if (dark) dark.style.opacity = '0';
    let info = domRefs.lightboxInfoWrap;
    let infoInner = domRefs.lightboxInfo;
    if (info) {
      info.style.filter = '';
      // Mobile: only transition filter — transform is owned by updateMobileImgWrapHeight
      info.style.transition = state.isMobile
        ? 'filter 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        : 'filter 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
      if (state.isMobile) {
        // snap-clear inner child scale instantly — no transition so navigation doesn't animate it
        if (infoInner) { infoInner.style.transition = ''; infoInner.style.transform = ''; infoInner.style.transformOrigin = ''; }
      } else {
        info.style.transform = '';
        info.style.transformOrigin = '';
      }
      // Clear transition after it finishes so it doesn't persist and slow down swipe filter changes
      const _infoCaptured = info;
      setTimeout(() => { _infoCaptured.style.transition = ''; }, 320);
    }
    showFilmstripIfReady();
  } else {
    if (lb) lb.classList.add('zoom-active');
    hideFilmstripIfReady();

    // Load full-resolution photo in the background when zooming in >= 1.3x
    const currentItem = state.currentLightboxIsMotion ? null : state.activePhotos[state.cur];
    if (state.lbZoomLevel >= 1.3 && currentItem && currentItem.rawSrc && img.src !== currentItem.rawSrc && !img.dataset.loadingRaw) {
      img.dataset.loadingRaw = 'true';
      let wrap = domRefs.lightboxImgWrap;
      if (wrap) wrap.classList.add('raw-loading');

      if (activeRawLoader) {
        activeRawLoader.onload = null;
        activeRawLoader.onerror = null;
      }
      const rawLoader = new Image();
      activeRawLoader = rawLoader;
      rawLoader.src = currentItem.rawSrc;
      rawLoader.onload = () => {
        activeRawLoader = null;
        img.removeAttribute('data-loading-raw');
        if (wrap) wrap.classList.remove('raw-loading');
        
        // Verify we are still on the same photo and still zoomed in >= 1.3x
        if (state.lbZoomLevel >= 1.3 && state.cur === state.activePhotos.indexOf(currentItem)) {
          img.src = currentItem.rawSrc;
        }
      };
      rawLoader.onerror = () => {
        activeRawLoader = null;
        img.removeAttribute('data-loading-raw');
        if (wrap) wrap.classList.remove('raw-loading');
        console.warn('Failed to load raw image:', currentItem.rawSrc);
      };
    }
    img.style.position = 'relative';
    img.style.zIndex = '100'; // Make sure the image pops cleanly above bounds

    // Panning is unconstrained during drag, but auto-resets on release if mostly off-screen

    img.style.transform = 'translate(' + state.lbZoomPanX + 'px, ' + state.lbZoomPanY + 'px) scale(' + state.lbZoomLevel + ')';
    let hint = document.getElementById('swipe-hint');
    if (hint) hint.classList.remove('visible');

    // Apply smooth transition for zoom actions, instant for drag
    if (smooth) {
      img.classList.remove('zoomed');
      img.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
      zoomTransitionTimeout = setTimeout(() => {
        img.classList.add('zoomed');
        img.style.transition = '';
      }, 250);
    } else {
      img.classList.add('zoomed');
    }

    // zoom cursor
    if (!state.isMobile) img.style.setProperty('cursor', isSpacePressed ? LUCIDE_GRAB : LUCIDE_ZOOM_OUT, 'important');
    if (isDraggingZoom) img.style.setProperty('cursor', LUCIDE_GRABBING, 'important');

    let dark = domRefs.lightboxZoomDarken;
    if (dark) dark.style.opacity = String(Math.min(0.85, 0.25 + (state.lbZoomLevel - 1) * 0.45));
    let infoBlur = Math.min(40, (state.lbZoomLevel - 1) * 20);
    const infoScale = Math.max(0.82, 1 - (state.lbZoomLevel - 1) * 0.1);
    let infoWrap = domRefs.lightboxInfoWrap;
    let infoInner = domRefs.lightboxInfo;
    if (infoWrap) {
      const easing = 'cubic-bezier(0.16, 1, 0.3, 1)';
      if (state.isMobile) {
        // Blur on wrap (filter only — no transform transition, owned by updateMobileImgWrapHeight)
        infoWrap.style.transition = smooth ? `filter 0.25s ${easing}` : '';
        infoWrap.style.filter = infoBlur > 0.1 ? `blur(${infoBlur.toFixed(1)}px)` : '';
        if (infoInner) {
          infoInner.style.transition = smooth ? `transform 0.25s ${easing}` : '';
          infoInner.style.transformOrigin = 'center top';
          infoInner.style.transform = infoScale < 0.999 ? `scale(${infoScale.toFixed(3)})` : '';
        }
      } else {
        infoWrap.style.transition = smooth ? `filter 0.25s ${easing}, transform 0.25s ${easing}` : '';
        infoWrap.style.transformOrigin = 'center center';
        infoWrap.style.filter = infoBlur > 0.1 ? `blur(${infoBlur.toFixed(1)}px)` : '';
        infoWrap.style.transform = infoScale < 0.999 ? `scale(${infoScale.toFixed(3)})` : '';
      }
    }

    if (state.isMobile && mWrap.style.overflowX !== 'visible') {
      // Prevent browser from zero-ing out scroll when we swap to visible overflow
      mWrap.style.transform = 'translateX(-' + (state.cur * mWrap.offsetWidth) + 'px)';
      mWrap.style.overflowX = 'visible'; // allow zoom popping over descriptions and screens!
      mWrap.style.overflowY = 'visible';
      let slides = mWrap.querySelectorAll('.snap-slide') as NodeListOf<HTMLElement>;
      for (let i = 0; i < slides.length; i++) {
        if (parseInt(slides[i].dataset.idx || '0') !== state.cur) slides[i].style.opacity = '0';
      }
    } else if (state.isMobile) {
      // already visible, ensure neighbors are hidden while panning to prevent peeking
      let slides = mWrap.querySelectorAll('.snap-slide') as NodeListOf<HTMLElement>;
      for (let i = 0; i < slides.length; i++) {
        if (parseInt(slides[i].dataset.idx || '0') !== state.cur) slides[i].style.opacity = '0';
      }
    }
  }
}

export function resetZoom() {
  state.lbZoomLevel = 1;
  let imgs = document.querySelectorAll('.zoomable');
  for (let i = 0; i < imgs.length; i++) updateZoomTransform(imgs[i]);
}

export function toggleImageZoom(e: any) {
  if (state.currentLightboxIsMotion) return;
  let img = e.target as HTMLImageElement;
  if (!img.classList.contains('zoomable')) return;

  // Ignore zoom attempts during or right after side navigation (400ms buffer)
  if (Date.now() - getLastSideNavTime() < 400) {
    e.stopPropagation();
    e.preventDefault();
    return;
  }
  
  // If we just dragged the image, don't toggle zoom!
  if (dragDistance > 5) {
    dragDistance = 0;
    e.stopPropagation();
    e.preventDefault();
    return;
  }
  
  e.stopPropagation();
  
  if (state.isMobile) {
    // Double-tap to zoom on mobile
    const now = Date.now();
    if (now - lastTapTime < 300) {
      // Double tap detected
      if (state.lbZoomLevel > 1) {
        resetZoom();
      } else {
        // Zoom to tap position
        const rect = img.getBoundingClientRect();
        const tapX = e.clientX - rect.left;
        const tapY = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        state.lbZoomLevel = 3; // 3x zoom on double-tap
        state.lbZoomPanX = (centerX - tapX) * 2;
        state.lbZoomPanY = (centerY - tapY) * 2;
        updateZoomTransform(img, true);
      }
      lastTapTime = 0;
    } else {
      lastTapTime = now;
    }
    return;
  }
  
  // Desktop: click to reset if zoomed, or zoom in if not
  if (state.lbZoomLevel > 1) { 
    resetZoom(); 
  } else {
    state.lbZoomLevel = 2.5;
    updateZoomTransform(img, true);
  }
}
if (domRefs.lightboxImg) {
  domRefs.lightboxImg.addEventListener('click', toggleImageZoom);
  domRefs.lightboxImg.addEventListener('dragstart', (e) => e.preventDefault());
}

// Desktop mouse panning - only when left-click is held OR spacebar is pressed
let mWrap = domRefs.lightboxImgWrap;
let isMouseDownOnZoomed = false;
let isPanningActive = false;

mWrap.addEventListener('mousedown', function (e) {
  if (state.isMobile || state.lbZoomLevel <= 1) return;
  if (e.button !== 0) return; // Only left-click
  isMouseDownOnZoomed = true;
  isPanningActive = false;
  isDraggingZoom = false;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  startX = e.clientX;
  startY = e.clientY;
  dragDistance = 0;
});

window.addEventListener('mousemove', function (e) {
  // If left click is not held anymore, reset dragging zoom state
  if ((isMouseDownOnZoomed || isDraggingZoom) && (e.buttons & 1) === 0) {
    isMouseDownOnZoomed = false;
    isPanningActive = false;
    isDraggingZoom = false;
    lastDragX = null;
    lastDragY = null;
    let img = domRefs.lightboxImg;
    if (img && state.lbZoomLevel > 1) {
      img.style.setProperty('cursor', isSpacePressed ? LUCIDE_GRAB : LUCIDE_ZOOM_OUT, 'important');
      checkAutoZoomOut(img);
    }
  }

  if (!isMouseDownOnZoomed || state.lbZoomLevel <= 1) {
    lastDragX = null;
    lastDragY = null;
    return;
  }
  
  const dxTotal = e.clientX - startX;
  const dyTotal = e.clientY - startY;
  dragDistance = Math.sqrt(dxTotal * dxTotal + dyTotal * dyTotal);

  // Only switch to grab/pan icon when user actually moves the mouse past drag threshold (>4px)
  if (dragDistance > 4 && !isPanningActive) {
    isPanningActive = true;
    isDraggingZoom = true;
    let img = domRefs.lightboxImg;
    if (img) img.style.setProperty('cursor', LUCIDE_GRABBING, 'important');
  }

  if (!isPanningActive) return;
  
  if (lastDragX === null || lastDragY === null) {
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    return;
  }
  
  let dx = e.clientX - lastDragX;
  let dy = e.clientY - lastDragY;
  state.lbZoomPanX += dx;
  state.lbZoomPanY += dy;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  let img = domRefs.lightboxImg;
  if (img) {
    updateZoomTransform(img, false); // No transition during drag for responsiveness
  }
});

window.addEventListener('mouseup', function () {
  if (isMouseDownOnZoomed || isDraggingZoom) {
    isMouseDownOnZoomed = false;
    isPanningActive = false;
    isDraggingZoom = false;
    lastDragX = null;
    lastDragY = null;
    let img = domRefs.lightboxImg;
    if (img && state.lbZoomLevel > 1) {
      img.style.setProperty('cursor', isSpacePressed ? LUCIDE_GRAB : LUCIDE_ZOOM_OUT, 'important');
      checkAutoZoomOut(img);
    }
  }
});

// Spacebar panning support
window.addEventListener('keydown', function (e) {
  let target = e.target as HTMLElement;
  let isTyping = target && (
    target.matches && target.matches('input, textarea, select, [contenteditable="true"]')
  );
  if (isTyping) return;

  if (e.code === 'Space' && state.lbZoomLevel > 1) {
    e.preventDefault();
    if (!isSpacePressed) {
      isSpacePressed = true;
      lastDragX = null;
      lastDragY = null;
      let img = domRefs.lightboxImg;
      if (img) img.style.setProperty('cursor', LUCIDE_GRAB, 'important');
    }
  }
});
window.addEventListener('keyup', function (e) {
  if (e.code === 'Space') {
    isSpacePressed = false;
    lastDragX = null;
    lastDragY = null;
    let img = domRefs.lightboxImg;
    if (img && state.lbZoomLevel > 1) {
      img.style.setProperty('cursor', LUCIDE_ZOOM_OUT, 'important');
      checkAutoZoomOut(img);
    }
  }
});


// Desktop: Mouse wheel / Touchpad pinch -> Zoom
domRefs.lightboxImgWrap.addEventListener('wheel', function (e) {
  let lb = domRefs.lightbox;
  if (!lb.classList.contains('open') || state.isMobile) return;
  if (state.currentLightboxIsMotion) return;

  let img = state.isMobile ? mWrap.querySelector('.snap-slide[data-idx="' + state.cur + '"] img') : domRefs.lightboxImg;
  if (!img || !img.classList.contains('zoomable')) return;

  e.preventDefault();

  // Improved zoom curve: exponential for better control at different zoom levels
  const delta = Math.abs(e.deltaY);
  const direction = e.deltaY > 0 ? -1 : 1;
  
  // Use logarithmic scaling for more natural feel
  let zoomFactor;
  if (delta < 50) {
    zoomFactor = 1.05; // Fine control
  } else if (delta < 150) {
    zoomFactor = 1.15; // Medium control
  } else {
    zoomFactor = 1.25; // Coarse control
  }
  
  let newScale;
  if (direction > 0) {
    newScale = Math.min(6, state.lbZoomLevel * zoomFactor);
  } else {
    newScale = Math.max(1, state.lbZoomLevel / zoomFactor);
  }
  
  if (newScale === state.lbZoomLevel) return;

  state.lbZoomLevel = newScale;

  updateZoomTransform(img, true);
}, { passive: false });

export function checkAutoZoomOut(img: HTMLImageElement) {
  if (state.lbZoomLevel <= 1) return;
  let mWrap = domRefs.lightboxImgWrap;
  if (!mWrap) return;

  const viewWidth = mWrap.offsetWidth;
  const viewHeight = mWrap.offsetHeight;
  const imgWidth = img.offsetWidth * state.lbZoomLevel;
  const imgHeight = img.offsetHeight * state.lbZoomLevel;

  const imgLeft = (viewWidth / 2) + state.lbZoomPanX - (imgWidth / 2);
  const imgRight = (viewWidth / 2) + state.lbZoomPanX + (imgWidth / 2);
  const imgTop = (viewHeight / 2) + state.lbZoomPanY - (imgHeight / 2);
  const imgBottom = (viewHeight / 2) + state.lbZoomPanY + (imgHeight / 2);

  const x1 = Math.max(0, imgLeft);
  const y1 = Math.max(0, imgTop);
  const x2 = Math.min(viewWidth, imgRight);
  const y2 = Math.min(viewHeight, imgBottom);

  const intersectWidth = Math.max(0, x2 - x1);
  const intersectHeight = Math.max(0, y2 - y1);
  const intersectArea = intersectWidth * intersectHeight;

  const imgArea = imgWidth * imgHeight;
  const viewArea = viewWidth * viewHeight;
  const maxPossibleVisibleArea = Math.min(imgArea, viewArea);

  if (intersectArea < 0.5 * maxPossibleVisibleArea) {
    resetZoom();
  }
}
