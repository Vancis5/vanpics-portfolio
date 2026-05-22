(function () {
  console.log("🚀 Applying Firefox Super-Switch + Hero Pause + Thumb Hand-off...");

  // 1. CSS: Kill all blurs and hide the background layers entirely
  const style = document.createElement('style');
  style.innerHTML = `
        .lightbox-bg-blur, .lightbox-bg-blur-inner, #lightbox-bg { display: none !important; }
        #lightbox { background: #000 !important; }
        #lightbox-desc { filter: none !important; }
        @keyframes lbInfoIn { 
            from { opacity: 0; transform: translateX(var(--lb-from-x)) translateY(var(--lb-from-y)); } 
            to { opacity: 1; transform: translateX(0) translateY(0); } 
        }
        @keyframes lbInfoOut { from { opacity: 1; } to { opacity: 0; } }
    `;
  document.head.appendChild(style);

  // 2. JS: Disable the blur logic (no-op)
  window.setLightboxBlur = () => { };

  // 3. JS: Delay Preloading (wait until after the 1200ms mark)
  const originalPreload = window.loadSwipeNeighbors;
  window.loadSwipeNeighbors = () => {
    setTimeout(originalPreload, 1200);
  };

  // 4. JS: Loop Management & Hero Pause
  window.isLightboxOpen = false;
  const originalStartLoops = window.startLoops;
  window.startLoops = () => {
    if (!window.isLightboxOpen) originalStartLoops?.();
  };

  const originalOpen = window.openLightbox;
  window.openLightbox = (idx, direction) => {
    window.isLightboxOpen = true;
    if (window.heroRafId) { cancelAnimationFrame(window.heroRafId); window.heroRafId = null; }
    if (window.glowRafId) { cancelAnimationFrame(window.glowRafId); window.glowRafId = null; }

    const p = activePhotos[idx];
    if (!p) return;
    const img = document.getElementById('lightbox-img');
    const thumbPath = p.src.replace('photos/', 'photos/thumbs/');

    // The Hijack: Load thumb first for animation speed
    // We pass a modified photo object to the original openLightbox or just let it run
    // Actually, since originalOpen sets img.src, we'll let it finish then instantly overwrite it.
    originalOpen(idx, direction);

    // Force the thumbnail for the animation period
    img.src = thumbPath;

    // After the animation ends (400ms is your img transition), swap to high-res
    setTimeout(() => {
      if (window.isLightboxOpen && cur === idx) {
        img.src = p.src;
      }
    }, 500);
  };

  const originalClose = window.closeLightbox;
  window.closeLightbox = () => {
    window.isLightboxOpen = false;
    originalClose();
    window.startLoops();
  };

  // 5. JS: Override animateInfo to delay the 'Ghost Removal' jank
  window.animateInfo = (dir) => {
    let info = document.getElementById('lightbox-info');
    let hasContent = info && parseFloat(window.getComputedStyle(info).opacity) > 0.05;
    if (hasContent) {
      let ghost = info.cloneNode(true);
      ghost.style.position = 'absolute';
      ghost.style.top = info.offsetTop + 'px';
      ghost.style.left = info.offsetLeft + 'px';
      ghost.style.width = info.offsetWidth + 'px';
      ghost.style.pointerEvents = 'none';
      ghost.style.animation = 'lbInfoOut 0.22s ease forwards';
      ghost.style.zIndex = '1';
      info.parentNode.appendChild(ghost);
      setTimeout(() => { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 1500);
    }
    let fromX = dir === 0 ? 0 : (dir > 0 ? 24 : -24);
    let fromY = dir === 0 ? 16 : 0;
    let clone = info.cloneNode(true);
    clone.style.setProperty('--lb-from-x', fromX + 'px');
    clone.style.setProperty('--lb-from-y', fromY + 'px');
    clone.style.animation = 'lbInfoIn 0.55s cubic-bezier(0.22,1,0.36,1) forwards';
    info.parentNode.replaceChild(clone, info);
  };

  console.log("✅ Firefox Thumb-Handoff active. 100% smooth target.");
})();
