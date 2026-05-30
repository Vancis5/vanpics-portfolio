export function syncVisualViewportVars() {
  const vv = window.visualViewport;
  const height = vv ? vv.height : window.innerHeight;
  const bottomInset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
  if (height) document.documentElement.style.setProperty('--app-height', height + 'px');
  document.documentElement.style.setProperty('--browser-bottom', bottomInset + 'px');
}

syncVisualViewportVars();
window.addEventListener('resize', syncVisualViewportVars, { passive: true });
window.addEventListener('orientationchange', syncVisualViewportVars, { passive: true });
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncVisualViewportVars, { passive: true });
  window.visualViewport.addEventListener('scroll', syncVisualViewportVars, { passive: true });
}
