import { domRefs } from './dom.js';
import { state } from './state.js';
import { getCategorySlug, motionProjects } from './media-data.js';
import { getVideoPlayerMarkup } from './motion-markup.js';
import { slugify } from './utils.js';
import { hideFilmstripIfReady, showFilmstripIfReady, clearFilmstripHideTimerIfReady, setFilmstripLiftZoneDisplay } from './core.js';
import { resetZoom } from './lightbox-zoom.js';
import { updateFilmstrip } from './filmstrip.js';

let blurFlip = false;
let mobileScrollToSlideCallback = null;
let photoPlaceholderTimer = null;
let photoPlaceholderToken = 0;

export function setMobileScrollToSlideCallback(callback) {
  mobileScrollToSlideCallback = typeof callback === 'function' ? callback : null;
}

function refreshLightboxInfoRefs() {
  let info = domRefs.lightboxInfoWrap ? domRefs.lightboxInfoWrap.querySelector('#lightbox-info') : null;
  if (!info) return null;

  domRefs.lightboxInfo = info;
  domRefs.lightboxTitle = info.querySelector('#lightbox-title');
  domRefs.lightboxDescToggle = info.querySelector('#lightbox-desc-toggle');
  domRefs.lightboxDesc = info.querySelector('#lightbox-desc');
  domRefs.metaLocation = info.querySelector('#meta-location');
  domRefs.metaLocationText = info.querySelector('#meta-location-text');
  domRefs.metaDate = info.querySelector('#meta-date');
  domRefs.metaDateText = info.querySelector('#meta-date-text');
  domRefs.metaMusic = info.querySelector('#meta-music');
  domRefs.metaMusicText = info.querySelector('#meta-music-text');
  return info;
}

export function setLightboxBlur(src) {
  if (!src) return;
  let active = domRefs.blurLayerA.classList.contains('active') ? domRefs.blurLayerB : domRefs.blurLayerA;
  let inactive = active.id === 'blur-layer-a' ? domRefs.blurLayerB : domRefs.blurLayerA;

  // Resolve blur path: strip 'thumbs/' if present so it points to the correct blur asset
  let blurPath = src.replace('photos/', 'photos/blur/').replace('thumbs/', '');
  let inner = active.querySelector('.lightbox-bg-blur-inner');
  if (inner) inner.style.backgroundImage = 'url(' + blurPath + ')';

  active.classList.add('active');
  inactive.classList.remove('active');

  blurFlip = !blurFlip;
}

function clearLightboxPhotoPlaceholder(expectedToken) {
  if (expectedToken && expectedToken !== photoPlaceholderToken) return;
  if (!expectedToken) photoPlaceholderToken++;
  let wrap = domRefs.lightboxImgWrap;
  let img = domRefs.lightboxImg;
  if (!wrap) return;
  wrap.classList.remove('photo-error');
  wrap.classList.add('photo-loaded');
  if (img) img.removeAttribute('data-loading-photo');
  if (img) img.style.opacity = '1';
  if (domRefs.lightboxPhotoError) domRefs.lightboxPhotoError.textContent = '';
  clearTimeout(photoPlaceholderTimer);
  photoPlaceholderTimer = setTimeout(function () {
    wrap.classList.remove('photo-loading', 'photo-placeholder-visible', 'photo-loaded');
  }, 260);
}

function showLightboxPhotoError(expectedToken) {
  if (expectedToken !== photoPlaceholderToken) return;
  let wrap = domRefs.lightboxImgWrap;
  let img = domRefs.lightboxImg;
  if (!wrap) return;
  wrap.classList.remove('photo-loaded');
  wrap.classList.add('photo-loading', 'photo-placeholder-visible', 'photo-error');
  if (img) img.removeAttribute('data-loading-photo');
  if (domRefs.lightboxPhotoError) domRefs.lightboxPhotoError.textContent = 'image failed to load';
}

export function prepareLightboxPhoto(p) {
  let img = domRefs.lightboxImg;
  let wrap = domRefs.lightboxImgWrap;
  if (!img || !wrap || !p) return;

  let ratio = Number(p.aspectRatio) > 0 ? Number(p.aspectRatio) : 1;
  let token = ++photoPlaceholderToken;
  clearTimeout(photoPlaceholderTimer);
  wrap.style.setProperty('--lightbox-photo-ratio', ratio);
  wrap.classList.remove('photo-placeholder-visible', 'photo-loaded', 'photo-error');
  wrap.classList.add('photo-loading');
  img.dataset.loadingPhoto = 'true';
  if (domRefs.lightboxPhotoError) domRefs.lightboxPhotoError.textContent = '';
  requestAnimationFrame(function () {
    wrap.classList.add('photo-placeholder-visible');
  });

  img.onload = function () {
    if (token !== photoPlaceholderToken) return;
    img.onload = null;
    img.onerror = null;
    clearLightboxPhotoPlaceholder(token);
  };
  img.onerror = function () {
    if (token !== photoPlaceholderToken) return;
    img.onload = null;
    img.onerror = null;
    showLightboxPhotoError(token);
  };
  img.src = p.src;

  if (img.complete && img.naturalWidth > 0) {
    requestAnimationFrame(function () { clearLightboxPhotoPlaceholder(token); });
  }
}

function runDescFlipTransition(options) {
  let imgWrap = domRefs.lightboxImgWrap;
  let infoWrap = domRefs.lightboxInfoWrap;
  let applyLayoutChange = options.applyLayoutChange;
  let cleanup = options.cleanup;

  if (!imgWrap || !infoWrap) {
    applyLayoutChange();
    if (cleanup) cleanup();
    return;
  }

  let startImg = options.startImgRect || imgWrap.getBoundingClientRect();
  let startInfo = options.startInfoRect || infoWrap.getBoundingClientRect();

  applyLayoutChange();

  let endImg = imgWrap.getBoundingClientRect();
  let endInfo = infoWrap.getBoundingClientRect();
  let dImg = startImg.top - endImg.top;
  let dInfo = startInfo.top - endInfo.top;

  imgWrap.style.transition = 'none';
  imgWrap.style.transform = 'translateY(' + dImg + 'px)';
  infoWrap.style.transition = 'none';
  infoWrap.style.transform = 'translateY(' + dInfo + 'px)';
  if (options.afterInvert) options.afterInvert();

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      imgWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
      imgWrap.style.transform = '';
      infoWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
      infoWrap.style.transform = '';
      setTimeout(function () {
        imgWrap.style.transition = '';
        infoWrap.style.transition = '';
        if (cleanup) cleanup();
      }, 450);
    });
  });
}

// updates text + blur bg only — image src is set separately to avoid double-load
export function setLightboxContent(p) {
  if (!p) return;
  refreshLightboxInfoRefs();

  let safeTitle = p.title || '';
  let safeDesc = p.desc || '';
  let content = domRefs.lightboxContent;
  let btn = domRefs.lightboxDescToggle;
  let descEl = domRefs.lightboxDesc;
  let isCollapsingOpenDesc = content && content.classList.contains('desc-open');
  let preSwapImgRect = null;
  let preSwapInfoRect = null;

  if (isCollapsingOpenDesc && state.isMobile) {
    let preSwapImgWrap = domRefs.lightboxImgWrap;
    let preSwapInfoWrap = domRefs.lightboxInfoWrap;
    if (preSwapImgWrap && preSwapInfoWrap) {
      preSwapImgRect = preSwapImgWrap.getBoundingClientRect();
      preSwapInfoRect = preSwapInfoWrap.getBoundingClientRect();
    }
    if (descEl) descEl.style.transition = 'none';
  }

  if (domRefs.lightboxTitle) domRefs.lightboxTitle.textContent = safeTitle;
  if (descEl) descEl.innerHTML = safeDesc;
  let locItem = domRefs.metaLocation;
  if (p.location) {
    if (domRefs.metaLocationText) domRefs.metaLocationText.textContent = p.location;
    if (locItem) locItem.style.display = 'inline-flex';
  } else if (locItem) {
    locItem.style.display = 'none';
  }

  let dateItem = domRefs.metaDate;
  if (p.date) {
    if (domRefs.metaDateText) domRefs.metaDateText.textContent = p.date;
    if (dateItem) dateItem.style.display = 'inline-flex';
  } else if (dateItem) {
    dateItem.style.display = 'none';
  }

  let musicItem = domRefs.metaMusic;
  if (p.music) {
    if (domRefs.metaMusicText) domRefs.metaMusicText.textContent = p.music;
    if (musicItem) musicItem.style.display = 'inline-flex';
  } else if (musicItem) {
    musicItem.style.display = 'none';
  }

  // Deep Link: Automatically update the URL hash dynamically for routing tracking
  let catSlug = getCategorySlug(state.currentCategory);
  let slug = slugify(safeTitle);
  let newHash = '#' + catSlug + '/' + slug;
  if (slug && window.location.hash !== newHash) {
    if (state.isPopState) {
      history.replaceState(null, null, newHash);
    } else if (state.pushNextState) {
      history.pushState(null, null, newHash);
      state.pushNextState = false;
    } else {
      history.replaceState(null, null, newHash);
    }
  }

  // conditionally hide the "read" toggle when photo has no description
  if (btn) {
    let hasDesc = safeDesc.replace(/<[^>]*>/g, '').trim().length > 0;
    btn.classList.toggle('no-desc', !hasDesc);
  }

  updateLightboxDescPreview();

  if (content && content.classList.contains('desc-open')) {
    runDescFlipTransition({
      startImgRect: state.isMobile ? preSwapImgRect : null,
      startInfoRect: state.isMobile ? preSwapInfoRect : null,
      applyLayoutChange: function () {
        content.classList.remove('desc-open');
        if (btn) btn.textContent = 'read more';
        updateLightboxDescPreview();
      },
      cleanup: state.isMobile && descEl ? function () { descEl.style.transition = ''; } : null
    });
  } else if (btn) {
    btn.textContent = 'read more';
    updateLightboxDescPreview();
  }
}

function updateLightboxDescPreview() {
  let desc = domRefs.lightboxDesc;
  let btn = domRefs.lightboxDescToggle;
  let content = domRefs.lightboxContent;
  if (!desc || !btn || !content || !state.isMobile) return;

  let hasDesc = desc.textContent.trim().length > 0;
  desc.classList.toggle('desc-expanded', content.classList.contains('desc-open'));

  if (!hasDesc) {
    desc.classList.remove('desc-overflow');
    btn.classList.add('no-desc');
    return;
  }

  let styles = window.getComputedStyle(desc);
  let lineHeight = parseFloat(styles.lineHeight);
  if (!lineHeight) lineHeight = parseFloat(styles.fontSize) * 1.75;
  let previewHeight = lineHeight * 2;
  let hasOverflow = desc.scrollHeight > previewHeight + 1;

  desc.classList.toggle('desc-overflow', hasOverflow);
  btn.classList.toggle('no-desc', !hasOverflow);
}


export function animateInfo(dir) {
  let info = domRefs.lightboxInfo;
  if (!info || !info.parentNode) {
    domRefs.lightboxInfo = domRefs.lightboxInfoWrap ? domRefs.lightboxInfoWrap.querySelector('#lightbox-info') : null;
    info = domRefs.lightboxInfo;
    if (!info || !info.parentNode) return;
  }

  // only animate exit if there's visible content (opacity > 0 means it's shown)
  let hasContent = info && parseFloat(window.getComputedStyle(info).opacity) > 0.05;
  if (hasContent) {
    // create exit ghost — absolutely positioned so it doesn't shift layout
    let ghost = info.cloneNode(true);
    ghost.style.position = 'absolute';
    ghost.style.top = info.offsetTop + 'px';
    ghost.style.left = info.offsetLeft + 'px';
    ghost.style.width = info.offsetWidth + 'px';
    ghost.style.pointerEvents = 'none';
    ghost.removeAttribute('onclick'); // prevent stale tap capture on mobile
    ghost.style.animation = 'lbInfoOut 0.22s ease forwards';
    ghost.style.willChange = 'filter, opacity';
    ghost.style.zIndex = '1';
    info.parentNode.appendChild(ghost);
    setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 250);
  }

  // clone-replace for enter — clean slate, no animation-cancel issues
  let fromX = dir === 0 ? 0 : (dir > 0 ? 24 : -24);
  let fromY = dir === 0 ? 16 : 0;
  let clone = info.cloneNode(true);
  clone.style.setProperty('--lb-from-x', fromX + 'px');
  clone.style.setProperty('--lb-from-y', fromY + 'px');
  clone.style.animation = 'lbInfoIn 0.55s cubic-bezier(0.22,1,0.36,1) forwards';
  clone.style.willChange = 'filter, opacity, transform';
  // clear any lingering inline transition/filter from swipe scroll handler
  clone.style.transition = '';
  clone.style.filter = '';
  info.parentNode.replaceChild(clone, info);
  domRefs.lightboxInfo = clone;
  refreshLightboxInfoRefs();
}

// increments each navigation so stale callbacks from aborted navigations are ignored
let navGen = 0;

function getCurrentLightboxItems() {
  return state.currentLightboxIsMotion ? motionProjects : state.activePhotos;
}

export function openLightbox(i, direction, isMotion) {
  let lb = domRefs.lightbox;
  if (lb && !lb.classList.contains('open') && !state.isPopState) {
    state.pushNextState = true;
  }

  state.cur = i;
  state.isManuallyNavigating = true;
  state.currentLightboxIsMotion = !!isMotion;
  let p = getCurrentLightboxItems()[i];

  if (!p) return;
  let img = domRefs.lightboxImg;
  let imgWrap = domRefs.lightboxImgWrap;
  let playerShell = domRefs.motionPlayerShell;

  if (isMotion) lb.classList.add('mode-motion');
  else lb.classList.remove('mode-motion');
  if (isMotion) clearLightboxPhotoPlaceholder();

  // Mobile: already open — natively smooth scroll
  if (lb.classList.contains('open') && state.isMobile && mobileScrollToSlideCallback && !isMotion) {
    // Fallback to 1 if direction evaluates to 0 or is mathematically missing
    let dir = (typeof direction === 'number' && direction !== 0) ? direction : 1;
    mobileScrollToSlideCallback(i, true, dir);

    state.cur = i;
    updateFilmstrip();
    return;
  }

  if (lb.classList.contains('open')) {
    let dir = (typeof direction === 'number' && direction !== 0) ? direction : 1;
    let exitX = dir > 0 ? '-6%' : '6%';
    let enterX = dir > 0 ? '6%' : '-6%';
    let gen = ++navGen;

    // exit current media immediately — snappy
    img.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    img.style.opacity = '0';
    img.style.transform = 'translateX(' + exitX + ') scale(0.98)';
    playerShell.style.opacity = '0';

    // hide info panel immediately so old text isn't visible
    let infoEl = domRefs.lightboxInfo;
    if (infoEl) {
      infoEl.style.animation = 'none';
      infoEl.style.opacity = '0';
    }

    // update blur bg immediately (visual polish)
    showFilmstripIfReady();

    let entered = false;

    function doEnter() {
      if (entered || gen !== navGen) return;
      entered = true;

      // blank src, position off-screen, fully invisible — nothing bleeds through
      img.onload = null; img.onerror = null;
      img.src = '';
      img.style.transition = 'none';
      img.style.transform = '';
      img.style.opacity = '0';
      imgWrap.style.transition = 'none';
      imgWrap.style.transform = 'translateX(' + enterX + ') scale(0.98)';
      imgWrap.style.opacity = '0';
      playerShell.innerHTML = '';
      playerShell.style.opacity = '0';

      // Start the new media immediately instead of waiting for decode.
      let bSrc = isMotion ? p.thumb : p.src;
      setLightboxBlur(bSrc);
      setLightboxContent(p);
      if (!isMotion) {
        prepareLightboxPhoto(p);
        loadSwipeNeighbors();
      }

      requestAnimationFrame(function () {
        if (gen !== navGen) return;
        animateInfo(dir);
        void img.offsetWidth; // force reflow

        if (isMotion) {
          renderVideoInLightbox(p);
          playerShell.style.transition = 'opacity 0.35s ease';
          playerShell.style.opacity = '1';
        } else {
          imgWrap.style.transition = 'opacity 0.24s ease, transform 0.34s cubic-bezier(0.16,1,0.3,1)';
          imgWrap.style.opacity = '1';
          imgWrap.style.transform = 'translateX(0) scale(1)';
          img.style.transition = 'opacity 0.24s ease';
          img.style.opacity = '1';
        }
      });
    }

    if (isMotion) {
      doEnter();
    } else {
      setTimeout(doEnter, 70);
    }

  } else {
    // INITIAL OPEN
    let openGen = ++navGen;

    // media starts invisible — no content yet
    img.onload = null; img.onerror = null;
    img.src = '';
    img.style.transition = 'none';
    img.style.opacity = '0';
    img.style.transform = '';
    imgWrap.style.transition = '';
    imgWrap.style.opacity = '';
    imgWrap.style.transform = '';
    playerShell.innerHTML = '';
    playerShell.style.opacity = '0';

    // info panel fully hidden — no stale text visible
    let infoEl2 = domRefs.lightboxInfo;
    if (infoEl2) {
      infoEl2.style.animation = 'none';
      infoEl2.style.opacity = '0';
    }

    let header = domRefs.galleryHeader;
    let masonry = domRefs.masonry;
    let headerRect = header ? header.getBoundingClientRect() : null;
    let masonryRect = masonry ? masonry.getBoundingClientRect() : null;

    lb.classList.add('open');
    document.body.classList.add('lightbox-open');
    lb.scrollTop = 0;
    document.body.style.overflow = 'hidden';

    // ── FLIP: Invert ──
    if (header && headerRect) {
      let last = header.getBoundingClientRect();
      let dX = headerRect.left - last.left;
      let dY = headerRect.top - last.top;
      header.style.transition = 'none';
      header.style.transform = 'translate(' + dX + 'px, ' + dY + 'px)';
    }
    if (masonry && masonryRect) {
      let lastM = masonry.getBoundingClientRect();
      let dXm = masonryRect.left - lastM.left;
      let dYm = masonryRect.top - lastM.top;
      masonry.style.transition = 'none';
      masonry.style.transform = 'translate(' + dXm + 'px, ' + dYm + 'px)';
    }

    requestAnimationFrame(function () {
      let ease = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
      if (header) {
        header.style.transition = ease;
        header.style.transform = '';
      }
      if (masonry) {
        masonry.style.transition = ease;
        masonry.style.transform = '';
      }
    });

    setFilmstripLiftZoneDisplay('block');
    window.dispatchEvent(new Event('lightbox-open'));
    setTimeout(showFilmstripIfReady, 300);

    let hint = document.getElementById('swipe-hint');
    if (hint) {
      hint.classList.add('visible');
      setTimeout(function () { hint.classList.remove('visible'); }, 2500);
    }

    let openLoadFired = false;
    function afterOpenLoad() {
      if (openLoadFired || openGen !== navGen) return;
      openLoadFired = true;
      if (isMotion) {
        img.onload = null;
        img.onerror = null;
      }

      let bSrc = isMotion ? p.thumb : p.src;
      setLightboxBlur(bSrc);
      setLightboxContent(p);
      if (!isMotion) loadSwipeNeighbors();

      requestAnimationFrame(function () {
        if (openGen !== navGen) return;
        animateInfo(0);
        void img.offsetWidth; // force reflow — Firefox transition fix

        if (isMotion) {
          renderVideoInLightbox(p);
          playerShell.style.transition = 'opacity 0.45s ease';
          playerShell.style.opacity = '1';
        } else {
          img.style.transition = 'opacity 0.45s ease';
          img.style.opacity = '1';
        }
      });
    }

    // Start the image immediately; the browser paints it as soon as pixels arrive.
    requestAnimationFrame(function () {
      if (isMotion) {
        afterOpenLoad();
      } else {
        prepareLightboxPhoto(p);
        afterOpenLoad();
      }
    });
  }
}

export function renderVideoInLightbox(p) {
  let shell = domRefs.motionPlayerShell;
  if (!shell) return;
  let ratio = p.aspectRatio || (16 / 9);
  shell.style.aspectRatio = ratio;
  shell.style.width = 'min(100%, calc((100svh - 15rem) * ' + ratio + '))';
  shell.innerHTML = getVideoPlayerMarkup(p);
  shell.style.opacity = '1';
  shell.style.display = 'block'; // Ensure it's not hidden
}

export function startUnifiedMotionPlayer(id) {
  let prime = document.getElementById(id);
  if (!prime) return;
  let video = prime.querySelector('video');
  prime.classList.add('is-started');
  if (video) video.play().catch(function () { });
}

export function closeLightbox() {
  let lb = domRefs.lightbox;
  if (!lb.classList.contains('open')) return;

  let header = domRefs.galleryHeader;
  let masonry = domRefs.masonry;
  let headerRect = header ? header.getBoundingClientRect() : null;
  let masonryRect = masonry ? masonry.getBoundingClientRect() : null;

  let img = domRefs.lightboxImg;
  let activeGen = ++navGen; // invalidates all pending callbacks
  lb.classList.remove('open');
  document.body.classList.remove('lightbox-open');
  document.body.style.overflow = '';
  clearFilmstripHideTimerIfReady();
  hideFilmstripIfReady();
  setFilmstripLiftZoneDisplay('none');

  // ── FLIP: Invert ──
  if (header && headerRect) {
    let last = header.getBoundingClientRect();
    let dX = headerRect.left - last.left;
    let dY = headerRect.top - last.top;
    header.style.transition = 'none';
    header.style.transform = 'translate(' + dX + 'px, ' + dY + 'px)';
  }
  if (masonry && masonryRect) {
    let lastM = masonry.getBoundingClientRect();
    let dXm = masonryRect.left - lastM.left;
    let dYm = masonryRect.top - lastM.top;
    masonry.style.transition = 'none';
    masonry.style.transform = 'translate(' + dXm + 'px, ' + dYm + 'px)';
  }

  requestAnimationFrame(function () {
    let ease = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
    if (header) {
      header.style.transition = ease;
      header.style.transform = '';
    }
    if (masonry) {
      masonry.style.transition = ease;
      masonry.style.transform = '';
    }

    // Restart Lenis and sync state once transition has a head start
    setTimeout(function () {
      if (window.lenis) {
        window.lenis.start();
        window.lenis.animatedScroll = window.lenis.targetScroll = window.scrollY;
        window.lenis.emit(); // Force sync of all UI driven by scroll hub
      }
    }, 400);
  });

  let playerShell = domRefs.motionPlayerShell;
  if (playerShell) playerShell.innerHTML = '';

  domRefs.blurLayerA.classList.remove('active');
  domRefs.blurLayerB.classList.remove('active');
  // Reset hash to category on close
  if (window.location.hash && !state.isPopState) {
    let catSlug = getCategorySlug(state.currentCategory);
    history.pushState(null, null, '#' + catSlug);
  }

  // Delay DOM teardown until the opacity fade finishes
  setTimeout(function () {
    if (activeGen !== navGen) return; // Abort if user reopened lightbox quickly
    if (img) {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      img.removeAttribute('data-loading-photo');
      clearLightboxPhotoPlaceholder();
      img.classList.remove('zoomed');
      img.style.transition = '';
      img.style.transform = '';
      img.style.transformOrigin = '';
      img.style.opacity = '';
    }
    if (domRefs.lightboxImgWrap) {
      domRefs.lightboxImgWrap.style.transition = '';
      domRefs.lightboxImgWrap.style.transform = '';
      domRefs.lightboxImgWrap.style.opacity = '';
    }

    let info = domRefs.lightboxInfo;
    if (info) {
      info.style.animation = 'none';
      info.style.opacity = '0';
      info.style.transition = '';
      info.style.filter = '';
      info.style.transform = '';
    }

    let content = domRefs.lightboxContent;
    if (content) {
      content.classList.remove('desc-open');
      content.style.transition = '';
      content.style.transform = '';
      content.style.transformOrigin = '';
      content.style.opacity = '';
    }
    let lb = domRefs.lightbox;
    if (lb) lb.classList.remove('zoom-active');

    if (state.isMobile) {
      let mWrap = domRefs.lightboxImgWrap;
      if (mWrap) {
        mWrap.style.transform = '';
        mWrap.style.overflowX = '';
        mWrap.style.overflowY = '';
      }
      state.lbZoomLevel = 1;
      state.lbZoomPanX = 0;
      state.lbZoomPanY = 0;
      let slides = mWrap ? mWrap.querySelectorAll('.snap-slide') : [];
      for (let si = 0; si < slides.length; si++) {
        slides[si].style.opacity = '';
        slides[si].style.transition = '';
        let slideImg = slides[si].querySelector('img');
        if (slideImg) {
          slideImg.classList.remove('zoomed');
          slideImg.style.transform = '';
          slideImg.style.position = '';
          slideImg.style.zIndex = '';
          slideImg.style.cursor = '';
          delete slideImg.dataset.zoomAnimated;
        }
      }
    }

    let dark = domRefs.lightboxZoomDarken;
    if (dark) dark.style.opacity = '0';
  }, 400);
}

export function toggleLightboxDesc() {
  let content = domRefs.lightboxContent;
  let btn = domRefs.lightboxDescToggle;
  if (!content || !btn || btn.classList.contains('no-desc')) return;

  let desc = domRefs.lightboxDesc;
  let opening = !content.classList.contains('desc-open');

  runDescFlipTransition({
    applyLayoutChange: function () {
      content.classList.toggle('desc-open', opening);
      btn.textContent = opening ? 'read less' : 'read more';
      updateLightboxDescPreview();
      if (opening) hideFilmstripIfReady();
      else showFilmstripIfReady();
    },
    afterInvert: function () {
      if (desc) void desc.offsetHeight;
    }
  });
}

// reset desc expansion on new photo
export function resetDescToggle() {
  let info = domRefs.lightboxInfo;
  let btn = domRefs.lightboxDescToggle;
  if (info) info.classList.remove('desc-open');
  if (btn) btn.textContent = 'read more';
}

export let loadSwipeNeighbors = function () {
  if (state.currentLightboxIsMotion) return;
  let currentSet = getCurrentLightboxItems();
  let prev = (state.cur - 1 + currentSet.length) % currentSet.length;
  let next = (state.cur + 1) % currentSet.length;
  let p1 = new Image(); p1.src = currentSet[prev].src; if (p1.decode) p1.decode().catch(function () { });
  let p2 = new Image(); p2.src = currentSet[next].src; if (p2.decode) p2.decode().catch(function () { });
};

export function setLoadSwipeNeighbors(fn) {
  loadSwipeNeighbors = fn;
}

export function navigateLightbox(d) {
  if (typeof state.lbZoomLevel !== 'undefined' && state.lbZoomLevel > 1) resetZoom();
  let currentSet = getCurrentLightboxItems();
  state.cur = (state.cur + d + currentSet.length) % currentSet.length;
  openLightbox(state.cur, d, state.currentLightboxIsMotion);
}

document.addEventListener('keydown', function (e) {
  let target = e.target;
  let isTyping = target && (
    target.matches && target.matches('input, textarea, select, [contenteditable="true"]')
  );
  if (isTyping || !domRefs.lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') {
    closeLightbox();
  }
  if (e.key === 'ArrowRight') navigateLightbox(1);
  if (e.key === 'ArrowLeft') navigateLightbox(-1);
});

// desktop: click bg to close
if (!state.isMobile) domRefs.lightboxBg.addEventListener('click', closeLightbox);
