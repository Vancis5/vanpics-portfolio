var blurFlip = false;

function refreshLightboxInfoRefs() {
  var info = domRefs.lightboxInfoWrap ? domRefs.lightboxInfoWrap.querySelector('#lightbox-info') : null;
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

function setLightboxBlur(src) {
  if (!src) return;
  var active = domRefs.blurLayerA.classList.contains('active') ? domRefs.blurLayerB : domRefs.blurLayerA;
  var inactive = active.id === 'blur-layer-a' ? domRefs.blurLayerB : domRefs.blurLayerA;

  // Resolve blur path: strip 'thumbs/' if present so it points to the correct blur asset
  var blurPath = src.replace('photos/', 'photos/blur/').replace('thumbs/', '');
  var inner = active.querySelector('.lightbox-bg-blur-inner');
  if (inner) inner.style.backgroundImage = 'url(' + blurPath + ')';

  active.classList.add('active');
  inactive.classList.remove('active');

  blurFlip = !blurFlip;
}

// updates text + blur bg only — image src is set separately to avoid double-load
function setLightboxContent(p) {
  if (!p) return;
  refreshLightboxInfoRefs();

  var safeTitle = p.title || '';
  var safeDesc = p.desc || '';
  var content = domRefs.lightboxContent;
  var btn = domRefs.lightboxDescToggle;
  var descEl = domRefs.lightboxDesc;
  var isCollapsingOpenDesc = content && content.classList.contains('desc-open');
  var preSwapImgRect = null;
  var preSwapInfoRect = null;

  if (isCollapsingOpenDesc && isMobile) {
    var preSwapImgWrap = domRefs.lightboxImgWrap;
    var preSwapInfoWrap = domRefs.lightboxInfoWrap;
    if (preSwapImgWrap && preSwapInfoWrap) {
      preSwapImgRect = preSwapImgWrap.getBoundingClientRect();
      preSwapInfoRect = preSwapInfoWrap.getBoundingClientRect();
    }
    if (descEl) descEl.style.transition = 'none';
  }

  if (domRefs.lightboxTitle) domRefs.lightboxTitle.textContent = safeTitle;
  if (descEl) descEl.innerHTML = safeDesc;
  var locItem = domRefs.metaLocation;
  if (p.location) {
    if (domRefs.metaLocationText) domRefs.metaLocationText.textContent = p.location;
    if (locItem) locItem.style.display = 'inline-flex';
  } else if (locItem) {
    locItem.style.display = 'none';
  }

  var dateItem = domRefs.metaDate;
  if (p.date) {
    if (domRefs.metaDateText) domRefs.metaDateText.textContent = p.date;
    if (dateItem) dateItem.style.display = 'inline-flex';
  } else if (dateItem) {
    dateItem.style.display = 'none';
  }

  var musicItem = domRefs.metaMusic;
  if (p.music) {
    if (domRefs.metaMusicText) domRefs.metaMusicText.textContent = p.music;
    if (musicItem) musicItem.style.display = 'inline-flex';
  } else if (musicItem) {
    musicItem.style.display = 'none';
  }

  // Deep Link: Automatically update the URL hash dynamically for routing tracking
  var catSlug = getCategorySlug(currentCategory);
  var slug = slugify(safeTitle);
  var newHash = '#' + catSlug + '/' + slug;
  if (slug && window.location.hash !== newHash) {
    if (isPopState) {
      history.replaceState(null, null, newHash);
    } else if (pushNextState) {
      history.pushState(null, null, newHash);
      pushNextState = false;
    } else {
      history.replaceState(null, null, newHash);
    }
  }

  // conditionally hide the "read" toggle when photo has no description
  if (btn) {
    var hasDesc = safeDesc.replace(/<[^>]*>/g, '').trim().length > 0;
    btn.classList.toggle('no-desc', !hasDesc);
  }

  updateLightboxDescPreview();

  if (content && content.classList.contains('desc-open')) {
    // Mobile: GPU FLIP to gracefully and safely collapse without dropping frames natively
    if (isMobile) {
      var imgWrap = domRefs.lightboxImgWrap;
      var infoWrap = domRefs.lightboxInfoWrap;

      var startImg = preSwapImgRect || imgWrap.getBoundingClientRect();
      var startInfo = preSwapInfoRect || infoWrap.getBoundingClientRect();

      content.classList.remove('desc-open');
      if (btn) btn.textContent = 'read more';
      updateLightboxDescPreview();

      var endImg = imgWrap.getBoundingClientRect();
      var endInfo = infoWrap.getBoundingClientRect();

      var dImg = startImg.top - endImg.top;
      var dInfo = startInfo.top - endInfo.top;

      imgWrap.style.transition = 'none';
      imgWrap.style.transform = 'translateY(' + dImg + 'px)';
      infoWrap.style.transition = 'none';
      infoWrap.style.transform = 'translateY(' + dInfo + 'px)';

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          imgWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
          imgWrap.style.transform = '';
          infoWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
          infoWrap.style.transform = '';
          setTimeout(function () {
            descEl.style.transition = '';
            imgWrap.style.transition = '';
            infoWrap.style.transition = '';
          }, 450);
        });
      });
    } else {
      // Desktop: Hardware accelerated glide down — FLIP animation
      var imgWrap = domRefs.lightboxImgWrap;
      var infoWrap = domRefs.lightboxInfoWrap;

      var startImg = imgWrap.getBoundingClientRect();
      var startInfo = infoWrap.getBoundingClientRect();

      content.classList.remove('desc-open');
      if (btn) btn.textContent = 'read more';
      updateLightboxDescPreview();

      var endImg = imgWrap.getBoundingClientRect();
      var endInfo = infoWrap.getBoundingClientRect();

      var dImg = startImg.top - endImg.top;
      var dInfo = startInfo.top - endInfo.top;

      imgWrap.style.transition = 'none';
      imgWrap.style.transform = 'translateY(' + dImg + 'px)';
      infoWrap.style.transition = 'none';
      infoWrap.style.transform = 'translateY(' + dInfo + 'px)';

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          imgWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
          imgWrap.style.transform = '';
          infoWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
          infoWrap.style.transform = '';
          setTimeout(function () {
            imgWrap.style.transition = '';
            infoWrap.style.transition = '';
          }, 450);
        });
      });
    }
  } else if (btn) {
    btn.textContent = 'read more';
    updateLightboxDescPreview();
  }
}

function updateLightboxDescPreview() {
  var desc = domRefs.lightboxDesc;
  var btn = domRefs.lightboxDescToggle;
  var content = domRefs.lightboxContent;
  if (!desc || !btn || !content || !isMobile) return;

  var hasDesc = desc.textContent.trim().length > 0;
  desc.classList.toggle('desc-expanded', content.classList.contains('desc-open'));

  if (!hasDesc) {
    desc.classList.remove('desc-overflow');
    btn.classList.add('no-desc');
    return;
  }

  var styles = window.getComputedStyle(desc);
  var lineHeight = parseFloat(styles.lineHeight);
  if (!lineHeight) lineHeight = parseFloat(styles.fontSize) * 1.75;
  var previewHeight = lineHeight * 2;
  var hasOverflow = desc.scrollHeight > previewHeight + 1;

  desc.classList.toggle('desc-overflow', hasOverflow);
  btn.classList.toggle('no-desc', !hasOverflow);
}


function animateInfo(dir) {
  var info = domRefs.lightboxInfo;
  if (!info || !info.parentNode) {
    domRefs.lightboxInfo = domRefs.lightboxInfoWrap ? domRefs.lightboxInfoWrap.querySelector('#lightbox-info') : null;
    info = domRefs.lightboxInfo;
    if (!info || !info.parentNode) return;
  }

  // only animate exit if there's visible content (opacity > 0 means it's shown)
  var hasContent = info && parseFloat(window.getComputedStyle(info).opacity) > 0.05;
  if (hasContent) {
    // create exit ghost — absolutely positioned so it doesn't shift layout
    var ghost = info.cloneNode(true);
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
  var fromX = dir === 0 ? 0 : (dir > 0 ? 24 : -24);
  var fromY = dir === 0 ? 16 : 0;
  var clone = info.cloneNode(true);
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
var navGen = 0;

var currentLightboxIsMotion = false;
function getCurrentLightboxItems() {
  return currentLightboxIsMotion ? motionProjects : activePhotos;
}

function openLightbox(i, direction, isMotion) {
  var lb = domRefs.lightbox;
  if (lb && !lb.classList.contains('open') && !isPopState) {
    pushNextState = true;
  }

  cur = i;
  isManuallyNavigating = true;
  currentLightboxIsMotion = !!isMotion;
  var p = getCurrentLightboxItems()[i];

  if (!p) return;
  var img = domRefs.lightboxImg;
  var playerShell = domRefs.motionPlayerShell;

  if (isMotion) lb.classList.add('mode-motion');
  else lb.classList.remove('mode-motion');

  // Mobile: already open — natively smooth scroll
  if (lb.classList.contains('open') && isMobile && mobileScrollToSlide && !isMotion) {
    // Fallback to 1 if direction evaluates to 0 or is mathematically missing
    var dir = (typeof direction === 'number' && direction !== 0) ? direction : 1;
    mobileScrollToSlide(i, true, dir);

    cur = i;
    updateFilmstrip();
    return;
  }

  if (lb.classList.contains('open')) {
    var dir = (typeof direction === 'number' && direction !== 0) ? direction : 1;
    var exitX = dir > 0 ? '-6%' : '6%';
    var enterX = dir > 0 ? '6%' : '-6%';
    var gen = ++navGen;

    // exit current media immediately — snappy
    img.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    img.style.opacity = '0';
    img.style.transform = 'translateX(' + exitX + ') scale(0.98)';
    playerShell.style.opacity = '0';

    // hide info panel immediately so old text isn't visible
    var infoEl = domRefs.lightboxInfo;
    if (infoEl) {
      infoEl.style.animation = 'none';
      infoEl.style.opacity = '0';
    }

    // update blur bg immediately (visual polish) — text stays hidden until image ready
    // MOVED to afterLoad() to prevent network progressive rendering from lagging JS animations
    showFilmstripIfReady();

    var entered = false;

    function doEnter() {
      if (entered || gen !== navGen) return;
      entered = true;

      // blank src, position off-screen, fully invisible — nothing bleeds through
      img.onload = null; img.onerror = null;
      img.src = '';
      img.style.transition = 'none';
      img.style.transform = 'translateX(' + enterX + ') scale(0.98)';
      img.style.opacity = '0';
      playerShell.innerHTML = '';
      playerShell.style.opacity = '0';

      // assign handlers BEFORE setting src — Firefox fires load before handler if src set first
      var loadFired = false;
      function afterLoad() {
        if (loadFired || gen !== navGen) return;
        loadFired = true;
        img.onload = null; img.onerror = null;

        var bSrc = isMotion ? p.thumb : p.src;
        setLightboxBlur(bSrc);
        setLightboxContent(p);

        if (!isMotion) loadSwipeNeighbors();

        requestAnimationFrame(function () {
          if (gen !== navGen) return;
          animateInfo(dir);
          void img.offsetWidth; // force reflow

          if (isMotion) {
            renderVideoInLightbox(p);
            playerShell.style.transition = 'opacity 0.35s ease';
            playerShell.style.opacity = '1';
          } else {
            img.style.transition = 'opacity 0.32s ease, transform 0.4s cubic-bezier(0.16,1,0.3,1)';
            img.style.opacity = '1';
            img.style.transform = 'translateX(0) scale(1)';
          }
        });
      }

      requestAnimationFrame(function () {
        if (gen !== navGen) return;
        if (isMotion) {
          afterLoad();
        } else {
          img.onload = function () { clearTimeout(loadFallback); afterLoad(); };
          img.onerror = function () { clearTimeout(loadFallback); afterLoad(); };
          img.src = p.src;
          var loadFallback = setTimeout(afterLoad, 700);
          // decode() waits for full pixel decode — reliable in Firefox unlike img.complete
          if (img.decode) img.decode().then(function () { clearTimeout(loadFallback); afterLoad(); }).catch(function () { });
        }
      });
    }

    if (isMotion) {
      doEnter();
    } else {
      // probe starts the network request — doEnter fires after min 150ms exit time
      var probe = new Image();
      var probeReady = false;
      var minWaitDone = false;
      function maybeEnter() { if (probeReady && minWaitDone) doEnter(); }
      probe.onload = probe.onerror = function () { probeReady = true; maybeEnter(); };
      probe.src = p.src;
      // decode() fires after pixel decode — reliable Firefox alternative to img.complete
      if (probe.decode) probe.decode().then(function () { probeReady = true; maybeEnter(); }).catch(function () { });
      setTimeout(function () { minWaitDone = true; maybeEnter(); }, 150);
      setTimeout(doEnter, 600); // hard fallback
    }

  } else {
    // INITIAL OPEN
    var openGen = ++navGen;

    // media starts invisible — no content yet
    img.onload = null; img.onerror = null;
    img.src = '';
    img.style.transition = 'none';
    img.style.opacity = '0';
    img.style.transform = '';
    playerShell.innerHTML = '';
    playerShell.style.opacity = '0';

    // info panel fully hidden — no stale text visible
    var infoEl2 = domRefs.lightboxInfo;
    if (infoEl2) {
      infoEl2.style.animation = 'none';
      infoEl2.style.opacity = '0';
    }

    var header = domRefs.galleryHeader;
    var masonry = domRefs.masonry;
    var headerRect = header ? header.getBoundingClientRect() : null;
    var masonryRect = masonry ? masonry.getBoundingClientRect() : null;

    lb.classList.add('open');
    document.body.classList.add('lightbox-open');
    lb.scrollTop = 0;
    document.body.style.overflow = 'hidden';

    // ── FLIP: Invert ──
    if (header && headerRect) {
      var last = header.getBoundingClientRect();
      var dX = headerRect.left - last.left;
      var dY = headerRect.top - last.top;
      header.style.transition = 'none';
      header.style.transform = 'translate(' + dX + 'px, ' + dY + 'px)';
    }
    if (masonry && masonryRect) {
      var lastM = masonry.getBoundingClientRect();
      var dXm = masonryRect.left - lastM.left;
      var dYm = masonryRect.top - lastM.top;
      masonry.style.transition = 'none';
      masonry.style.transform = 'translate(' + dXm + 'px, ' + dYm + 'px)';
    }

    requestAnimationFrame(function () {
      var ease = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
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

    var hint = document.getElementById('swipe-hint');
    if (hint) {
      hint.classList.add('visible');
      setTimeout(function () { hint.classList.remove('visible'); }, 2500);
    }

    var openLoadFired = false;
    function afterOpenLoad() {
      if (openLoadFired || openGen !== navGen) return;
      openLoadFired = true;
      img.onload = null; img.onerror = null;

      var bSrc = isMotion ? p.thumb : p.src;
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

    // handlers BEFORE src — Firefox-safe
    var openFallback;
    requestAnimationFrame(function () {
      if (isMotion) {
        afterOpenLoad();
      } else {
        img.onload = function () { clearTimeout(openFallback); afterOpenLoad(); };
        img.onerror = function () { clearTimeout(openFallback); afterOpenLoad(); };
        img.src = p.src;
        openFallback = setTimeout(afterOpenLoad, 700);
        // decode() waits for pixel decode — reliable in Firefox unlike img.complete
        if (img.decode) img.decode().then(function () { clearTimeout(openFallback); afterOpenLoad(); }).catch(function () { });
      }
    });
  }
}

function renderVideoInLightbox(p) {
  var shell = domRefs.motionPlayerShell;
  if (!shell) return;
  var ratio = p.aspectRatio || (16 / 9);
  shell.style.aspectRatio = ratio;
  shell.style.width = 'min(100%, calc((100svh - 15rem) * ' + ratio + '))';
  shell.innerHTML = getVideoPlayerMarkup(p);
  shell.style.opacity = '1';
  shell.style.display = 'block'; // Ensure it's not hidden
}

function startUnifiedMotionPlayer(id) {
  var prime = document.getElementById(id);
  if (!prime) return;
  var video = prime.querySelector('video');
  prime.classList.add('is-started');
  if (video) video.play().catch(function () { });
}

function closeLightbox() {
  var lb = domRefs.lightbox;
  if (!lb.classList.contains('open')) return;

  var header = domRefs.galleryHeader;
  var masonry = domRefs.masonry;
  var headerRect = header ? header.getBoundingClientRect() : null;
  var masonryRect = masonry ? masonry.getBoundingClientRect() : null;

  var img = domRefs.lightboxImg;
  var activeGen = ++navGen; // invalidates all pending callbacks
  lb.classList.remove('open');
  document.body.classList.remove('lightbox-open');
  document.body.style.overflow = '';
  clearFilmstripHideTimerIfReady();
  hideFilmstripIfReady();
  setFilmstripLiftZoneDisplay('none');

  // ── FLIP: Invert ──
  if (header && headerRect) {
    var last = header.getBoundingClientRect();
    var dX = headerRect.left - last.left;
    var dY = headerRect.top - last.top;
    header.style.transition = 'none';
    header.style.transform = 'translate(' + dX + 'px, ' + dY + 'px)';
  }
  if (masonry && masonryRect) {
    var lastM = masonry.getBoundingClientRect();
    var dXm = masonryRect.left - lastM.left;
    var dYm = masonryRect.top - lastM.top;
    masonry.style.transition = 'none';
    masonry.style.transform = 'translate(' + dXm + 'px, ' + dYm + 'px)';
  }

  requestAnimationFrame(function () {
    var ease = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
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

  var playerShell = domRefs.motionPlayerShell;
  if (playerShell) playerShell.innerHTML = '';

  domRefs.blurLayerA.classList.remove('active');
  domRefs.blurLayerB.classList.remove('active');
  // Reset hash to category on close
  if (window.location.hash && !isPopState) {
    var catSlug = getCategorySlug(currentCategory);
    history.pushState(null, null, '#' + catSlug);
  }

  // Delay DOM teardown until the opacity fade finishes
  setTimeout(function () {
    if (activeGen !== navGen) return; // Abort if user reopened lightbox quickly
    if (img) {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      img.classList.remove('zoomed');
      img.style.transition = '';
      img.style.transform = '';
      img.style.transformOrigin = '';
      img.style.opacity = '';
    }

    var info = domRefs.lightboxInfo;
    if (info) {
      info.style.animation = 'none';
      info.style.opacity = '0';
      info.style.transition = '';
      info.style.filter = '';
      info.style.transform = '';
    }

    var content = domRefs.lightboxContent;
    if (content) {
      content.classList.remove('desc-open');
      content.style.transition = '';
      content.style.transform = '';
      content.style.transformOrigin = '';
      content.style.opacity = '';
    }
    var lb = domRefs.lightbox;
    if (lb) lb.classList.remove('zoom-active');

    if (isMobile) {
      var mWrap = domRefs.lightboxImgWrap;
      if (mWrap) {
        mWrap.style.transform = '';
        mWrap.style.overflowX = '';
        mWrap.style.overflowY = '';
      }
      lbZoomLevel = 1;
      lbZoomPanX = 0;
      lbZoomPanY = 0;
      var slides = mWrap ? mWrap.querySelectorAll('.snap-slide') : [];
      for (var si = 0; si < slides.length; si++) {
        slides[si].style.opacity = '';
        slides[si].style.transition = '';
        var slideImg = slides[si].querySelector('img');
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

    var dark = domRefs.lightboxZoomDarken;
    if (dark) dark.style.opacity = '0';
  }, 400);
}

function toggleLightboxDesc() {
  var content = domRefs.lightboxContent;
  var btn = domRefs.lightboxDescToggle;
  if (!content || !btn || btn.classList.contains('no-desc')) return;

  var imgWrap = domRefs.lightboxImgWrap;
  var infoWrap = domRefs.lightboxInfoWrap;
  var desc = domRefs.lightboxDesc;
  var opening = !content.classList.contains('desc-open');

  if (!imgWrap || !infoWrap) {
    content.classList.toggle('desc-open', opening);
    btn.textContent = opening ? 'read less' : 'read more';
    updateLightboxDescPreview();
    if (opening) hideFilmstripIfReady();
    else showFilmstripIfReady();
    return;
  }

  var startImg = imgWrap.getBoundingClientRect();
  var startInfo = infoWrap.getBoundingClientRect();

  content.classList.toggle('desc-open', opening);
  btn.textContent = opening ? 'read less' : 'read more';
  updateLightboxDescPreview();
  if (opening) hideFilmstripIfReady();
  else showFilmstripIfReady();

  var endImg = imgWrap.getBoundingClientRect();
  var endInfo = infoWrap.getBoundingClientRect();
  var dImg = startImg.top - endImg.top;
  var dInfo = startInfo.top - endInfo.top;

  imgWrap.style.transition = 'none';
  imgWrap.style.transform = 'translateY(' + dImg + 'px)';
  infoWrap.style.transition = 'none';
  infoWrap.style.transform = 'translateY(' + dInfo + 'px)';
  if (desc) void desc.offsetHeight;

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      imgWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
      imgWrap.style.transform = '';
      infoWrap.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
      infoWrap.style.transform = '';
      setTimeout(function () {
        imgWrap.style.transition = '';
        infoWrap.style.transition = '';
      }, 450);
    });
  });
}

// reset desc expansion on new photo
function resetDescToggle() {
  var info = domRefs.lightboxInfo;
  var btn = domRefs.lightboxDescToggle;
  if (info) info.classList.remove('desc-open');
  if (btn) btn.textContent = 'read more';
}

function loadSwipeNeighbors() {
  if (currentLightboxIsMotion) return;
  var currentSet = getCurrentLightboxItems();
  var prev = (cur - 1 + currentSet.length) % currentSet.length;
  var next = (cur + 1) % currentSet.length;
  var p1 = new Image(); p1.src = currentSet[prev].src; if (p1.decode) p1.decode().catch(function () { });
  var p2 = new Image(); p2.src = currentSet[next].src; if (p2.decode) p2.decode().catch(function () { });
}

function navigateLightbox(d) {
  if (typeof lbZoomLevel !== 'undefined' && lbZoomLevel > 1) resetZoom();
  var currentSet = getCurrentLightboxItems();
  cur = (cur + d + currentSet.length) % currentSet.length;
  openLightbox(cur, d, currentLightboxIsMotion);
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeLightbox();
  }
  if (e.key === 'ArrowRight') navigateLightbox(1);
  if (e.key === 'ArrowLeft') navigateLightbox(-1);
});

// desktop: click bg to close
if (!isMobile) domRefs.lightboxBg.addEventListener('click', closeLightbox);
