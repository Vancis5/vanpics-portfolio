import { domRefs } from '../dom.js';

export type LbLayout = 'phone' | 'tablet-portrait' | 'tablet-landscape' | 'desktop';

export function getLightboxLayout(): LbLayout {
  if (typeof window === 'undefined') return 'desktop';
  const isTouch = window.matchMedia('(hover: none)').matches;
  if (!isTouch) {
    return 'desktop';
  }
  const minDim = Math.min(window.innerWidth, window.innerHeight);
  if (minDim >= 600) {
    return window.innerHeight >= window.innerWidth ? 'tablet-portrait' : 'tablet-landscape';
  }
  return 'phone';
}

export function updateLightboxLayout(): LbLayout {
  const layout = getLightboxLayout();
  const lb = domRefs.lightbox || (typeof document !== 'undefined' ? document.getElementById('lightbox') : null);
  if (lb && lb.dataset.lbLayout !== layout) {
    lb.dataset.lbLayout = layout;
  }
  return layout;
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    updateLightboxLayout();
  }, { passive: true });

  window.addEventListener('orientationchange', () => {
    updateLightboxLayout();
  }, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      updateLightboxLayout();
    }, { passive: true });
  }
}
