let lastHeight = -1;
let lastBottomInset = -1;
let ticking = false;

export function syncVisualViewportVars() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const vv = window.visualViewport;
    const height = Math.round(vv ? vv.height : window.innerHeight);
    const bottomInset = Math.round(vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0);
    if (height && height !== lastHeight) {
      lastHeight = height;
      document.documentElement.style.setProperty('--app-height', height + 'px');
    }
    if (bottomInset !== lastBottomInset) {
      lastBottomInset = bottomInset;
      document.documentElement.style.setProperty('--browser-bottom', bottomInset + 'px');
    }
  });
}

syncVisualViewportVars();
window.addEventListener('resize', syncVisualViewportVars, { passive: true });
window.addEventListener('orientationchange', syncVisualViewportVars, { passive: true });
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncVisualViewportVars, { passive: true });
  window.visualViewport.addEventListener('scroll', syncVisualViewportVars, { passive: true });
}

