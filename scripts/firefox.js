(function () {
  // 1. CSS Injection — hide native scrollbar + native cursor in Firefox
  const style = document.createElement('style');
  style.innerHTML = `
    html { scrollbar-width: none !important; }
    html, html *, html *::before, html *::after { cursor: none !important; }
    .lightbox-bg-blur, .lightbox-bg-blur-inner, #lightbox-bg { display: none !important; }
    #lightbox { background: #000 !important; }
    #lightbox-desc { filter: none !important; }
  `;
  document.head.appendChild(style);

  // 2. JS Overrides
  window.setLightboxBlur = () => {};
  const originalOpen = window.openLightbox;
  window.openLightbox = (idx, dir) => {
    originalOpen(idx, dir);
    const p = activePhotos[idx];
    if (!p) return;
    const img = document.getElementById('lightbox-img');
    img.src = p.src.replace('photos/', 'photos/thumbs/');
    setTimeout(() => { if (cur === idx) img.src = p.src; }, 500);
  };

  // 3. CUSTOM DRAGGABLE SCROLLBAR (Optimised — no layout thrash)
  const vanTrack = document.createElement('div');
  const vanThumb = document.createElement('div');

  Object.assign(vanTrack.style, {
    position: 'fixed', right: '0', top: '0', bottom: '0', width: '40px',
    zIndex: '2147483647', pointerEvents: 'auto', background: 'transparent', cursor: 'none'
  });
  Object.assign(vanThumb.style, {
    position: 'absolute', right: '2px', width: '5px',
    backgroundColor: 'rgba(221, 216, 207, 0.18)', borderRadius: '10px',
    pointerEvents: 'none', transition: 'background 0.2s, width 0.1s'
  });

  document.documentElement.appendChild(vanTrack);
  vanTrack.appendChild(vanThumb);

  // Cache dimensions — only update on resize, not every frame
  let winH = window.innerHeight;
  let docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  let thumbH = Math.max(40, winH * (winH / docH));

  const refreshCache = () => {
    winH = window.innerHeight;
    docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    thumbH = Math.max(40, winH * (winH / docH));
  };

  let isDrag = false, sY, sS;
  let rafPending = false;

  const syncUI = () => {
    rafPending = false;
    if (isDrag) return;
    const st = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (docH <= winH + 10) { vanTrack.style.display = 'none'; return; }
    vanTrack.style.display = 'block';
    const availableTrack = winH - thumbH;
    const scrollPct = Math.min(1, Math.max(0, st / (docH - winH)));
    vanThumb.style.height = thumbH + 'px';
    vanThumb.style.transform = `translateY(${scrollPct * availableTrack}px)`;
  };

  // Only sync on actual scroll, not on a timer
  window.addEventListener('scroll', () => {
    if (!rafPending) { rafPending = true; requestAnimationFrame(syncUI); }
  }, { passive: true });

  window.addEventListener('resize', () => { refreshCache(); syncUI(); });
  window.addEventListener('category-change', () => { setTimeout(() => { refreshCache(); syncUI(); }, 600); });

  // Drag interaction
  vanTrack.addEventListener('mousedown', (e) => {
    isDrag = true;
    sY = e.clientY;
    sS = window.pageYOffset || document.documentElement.scrollTop || 0;
    document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
    vanThumb.style.backgroundColor = 'rgba(221, 216, 207, 0.6)';
    vanThumb.style.width = '7px';
    document.body.style.userSelect = 'none';
    e.preventDefault(); e.stopPropagation();
  }, true);

  window.addEventListener('mousemove', (e) => {
    if (!isDrag) return;
    const availableScroll = docH - winH;
    const availableTrack = winH - thumbH;
    const target = sS + (e.clientY - sY) * (availableScroll / availableTrack);
    document.documentElement.scrollTop = target;
    document.body.scrollTop = target;

    // Sync thumb visually during drag without calling syncUI (avoids read)
    const movePct = Math.min(1, Math.max(0, document.documentElement.scrollTop / availableScroll));
    vanThumb.style.transform = `translateY(${movePct * availableTrack}px)`;
  }, true);

  window.addEventListener('mouseup', () => {
    if (!isDrag) return;
    isDrag = false;
    document.documentElement.style.removeProperty('scroll-behavior');
    vanThumb.style.backgroundColor = 'rgba(221, 216, 207, 0.18)';
    vanThumb.style.width = '5px';
    document.body.style.userSelect = '';
  }, true);

  vanTrack.onmouseenter = () => { vanThumb.style.backgroundColor = 'rgba(221, 216, 207, 0.25)'; };
  vanTrack.onmouseleave = () => { if (!isDrag) vanThumb.style.backgroundColor = 'rgba(221, 216, 207, 0.18)'; };

  // Initial render
  refreshCache();
  syncUI();

  console.log('✅ Firefox: native cursor hidden, optimised scrollbar active.');
})();
