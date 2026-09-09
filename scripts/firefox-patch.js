import { state } from '../js/app/state.js';
import { domRefs } from '../js/app/dom.js';
import { tick } from '../js/app/hero-carousel.js';

export const isFirefox = typeof navigator !== 'undefined' && (
  /firefox/i.test(navigator.userAgent) ||
  (typeof window !== 'undefined' && (
    window.__FORCE_FIREFOX_PATCH === true ||
    new URLSearchParams(window.location.search).has('firefox-patch')
  ))
);

function applyThumbHandoff() {
  if (!state || state.currentLightboxIsMotion) return;
  const currentIdx = state.cur;
  const photo = state.activePhotos?.[currentIdx];
  if (!photo) return;

  const img = domRefs.lightboxImg || document.getElementById('lightbox-img');
  if (!img) return;

  const thumbPath = photo.thumb || (photo.src ? photo.src.replace('photos/', 'photos/thumbs/') : '');
  if (!thumbPath) return;

  // Force lightweight thumbnail during animation to prevent compositor jank
  img.src = thumbPath;

  // Immediately extract and set the ambient background color for this photo
  updateAmbientBg(photo);

  // Swap to high-res once entrance/navigation transition settles
  setTimeout(() => {
    const lb = domRefs.lightbox || document.getElementById('lightbox');
    if (lb?.classList.contains('open') && state.cur === currentIdx) {
      img.src = photo.src;
    }
  }, 500);
}

function updateAmbientBg(photo) {
  if (!photo) return;
  const lb = domRefs.lightbox || document.getElementById('lightbox');
  if (!lb) return;
  const src = photo.thumb || (photo.src ? photo.src.replace('photos/', 'photos/thumbs/') : '');
  if (!src) return;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 8;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 8, 8);
      const data = ctx.getImageData(0, 0, 8, 8).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 180) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
      }
      if (count > 0) {
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        const max = Math.max(r, g, b) / 255;
        const min = Math.min(r, g, b) / 255;
        let h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          const rn = r / 255, gn = g / 255, bn = b / 255;
          switch (max) {
            case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
            case gn: h = (bn - rn) / d + 2; break;
            case bn: h = (rn - gn) / d + 4; break;
          }
          h = Math.round(h * 60);
          s = Math.round(s * 100);
        }
        const sat = Math.min(Math.max(s, 30), 55);
        const col = `hsl(${h}, ${sat}%, 14%)`;
        lb.style.setProperty('--lightbox-ambient-bg', col);
      }
    } catch (e) {}
  };
  img.src = src;
}

if (typeof document !== 'undefined' && isFirefox) {
  document.documentElement.classList.add('is-firefox');

  // 1. CSS: Kill canvas blur, disable heavy backdrop/filter blur passes in Firefox
  const styleId = 'firefox-patch-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* 1. Ambient solid background equivalent to liquid blur */
      html.is-firefox #lightbox-blur-canvas,
      html.is-firefox .lightbox-bg-blur,
      html.is-firefox .lightbox-bg-blur-inner,
      html.is-firefox #lightbox::before {
        display: none !important;
      }
      html.is-firefox #lightbox-bg {
        display: block !important;
        background-color: var(--lightbox-ambient-bg, #181616) !important;
        transition: background-color 0.5s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      html.is-firefox #lightbox {
        background-color: var(--lightbox-ambient-bg, #181616) !important;
        transition: background-color 0.5s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }

      /* 2. Subnav: kill backdrop blur */
      html.is-firefox #gallery-header,
      html.is-firefox .enable-header-blur #gallery-header {
        -webkit-backdrop-filter: none !important;
        backdrop-filter: none !important;
        background: rgba(13, 12, 12, 0.95) !important;
      }

      /* 3. Lightbox chevrons: kill blur during hover & fade */
      html.is-firefox .lightbox-nav-arrow,
      html.is-firefox #lightbox-nav-arrow-left,
      html.is-firefox #lightbox-nav-arrow-right {
        filter: none !important;
        will-change: opacity, transform !important;
      }

      /* 4. Filmstrip: kill blur during fade in / out and zoom */
      html.is-firefox #filmstrip-wrap,
      html.is-firefox #filmstrip-wrap.visible,
      html.is-firefox #lightbox.zoom-active #filmstrip-wrap,
      html.is-firefox #lightbox.zoom-active #filmstrip-lift-zone {
        filter: none !important;
        transition: opacity 0.25s ease, transform 0.25s ease, visibility 0.25s !important;
      }

      /* 5. Desc & Info text: kill blur during zoom in / out & transitions */
      html.is-firefox #lightbox-info-wrap,
      html.is-firefox #lightbox-info,
      html.is-firefox #lightbox-desc {
        filter: none !important;
        backdrop-filter: none !important;
      }

      /* 6. Mobile & desktop image and video containers: kill blur everywhere */
      html.is-firefox .snap-slide,
      html.is-firefox .snap-slide img,
      html.is-firefox .snap-slide-inner,
      html.is-firefox #lightbox-img,
      html.is-firefox #lightbox-img-wrap,
      html.is-firefox #lightbox-content,
      html.is-firefox #motion-player-shell,
      html.is-firefox media-container,
      html.is-firefox media-controls,
      html.is-firefox media-tooltip {
        filter: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      /* 7. Hover effects: nuke mix-blend-mode, scaling, and 1.4s transition pileups */
      html.is-firefox .photo-card-overlay::before {
        display: none !important;
      }
      html.is-firefox .photo-card-overlay {
        transition: opacity 0.15s ease !important;
      }
      html.is-firefox .photo-card img {
        transition: opacity 0.15s ease !important;
      }
      html.is-firefox .photo-card:hover img,
      html.is-firefox .carousel-item:hover img,
      html.is-firefox .motion-card:hover img {
        transform: none !important;
        filter: none !important;
      }
      html.is-firefox .photo-card:hover .photo-card-overlay {
        opacity: 1 !important;
      }
      html.is-firefox .motion-card:hover .photo-card-title {
        text-shadow: none !important;
      }
      html.is-firefox #site-footer:hover .footer-bg-blur {
        filter: none !important;
      }

      /* 8. Hero Carousel performance in Firefox: nuke blur30, layer promotion, transform churn */
      html.is-firefox #hero-identity::before {
        filter: none !important;
        background: radial-gradient(ellipse at bottom left, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.75) 45%, transparent 75%) !important;
      }
      html.is-firefox .carousel-row {
        will-change: transform !important;
      }
      html.is-firefox .carousel-item {
        transform: none !important;
        contain: strict !important;
      }
      html.is-firefox .carousel-item::before {
        box-shadow: none !important;
      }
      html.is-firefox .carousel-item img {
        transition: opacity 0.4s ease !important;
        will-change: auto !important;
      }

      @keyframes lbInfoIn {
        from { opacity: 0; transform: translateX(var(--lb-from-x)) translateY(var(--lb-from-y)); }
        to { opacity: 1; transform: translateX(0) translateY(0); }
      }
      @keyframes lbInfoOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // 2. JS: Disable WebGL blur passes
  window.__killBlur = true;
  window.setLightboxBlur = () => {};

  // 3. Loop Management: Pause hero carousel & glow loops while lightbox is open
  window.addEventListener('lightbox-open', () => {
    if (!isFirefox) return;

    if (state.heroRafId) {
      cancelAnimationFrame(state.heroRafId);
      state.heroRafId = null;
    }
    if (state.glowRafId) {
      cancelAnimationFrame(state.glowRafId);
      state.glowRafId = null;
    }

    applyThumbHandoff();
  });

  window.addEventListener('lightbox-close', () => {
    if (!isFirefox) return;

    if (!state.heroRafId && state.heroVisible && state.pageVisible) {
      state.heroRafId = requestAnimationFrame(tick);
    }
  });

  console.log('🦊 [Firefox Patch] Active: WebGL blur disabled, hero/glow paused in lightbox, thumb handoff enabled.');
}
