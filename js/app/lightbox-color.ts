import { domRefs } from './dom.js';
import { state } from './state.js';
import { motionProjects } from './media-data.js';
import { cacheImage } from './lightbox-cache.js';
import { Photo } from '../types.js';

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number = 0, s: number = 0, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

export function resetDynamicTextColor() {
  const lbEl = domRefs.lightbox;
  if (lbEl) {
    lbEl.style.removeProperty('--dynamic-text-color');
    lbEl.style.removeProperty('--dynamic-text-muted');
    lbEl.style.removeProperty('--dynamic-text-faint');
    lbEl.style.removeProperty('--lightbox-ambient-bg');
  }
}

interface DynamicColorPalette {
  color: string;
  muted: string;
  faint: string;
  ambient: string;
}

const colorCache = new Map<string, DynamicColorPalette>();
let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

function applyColorPalette(palette: DynamicColorPalette | null) {
  const lbEl = domRefs.lightbox;
  if (!lbEl) return;
  if (!palette) {
    resetDynamicTextColor();
    return;
  }
  lbEl.style.setProperty('--dynamic-text-color', palette.color);
  lbEl.style.setProperty('--dynamic-text-muted', palette.muted);
  lbEl.style.setProperty('--dynamic-text-faint', palette.faint);
  lbEl.style.setProperty('--lightbox-ambient-bg', palette.ambient);
}

export function updateDynamicTextColor(p: Photo) {
  if (state.currentLightboxIsMotion) {
    resetDynamicTextColor();
    return;
  }

  const thumbSrc = p.thumb || p.src;
  if (!thumbSrc) {
    resetDynamicTextColor();
    return;
  }

  if (colorCache.has(thumbSrc)) {
    applyColorPalette(colorCache.get(thumbSrc)!);
    return;
  }

  const cached = cacheImage(thumbSrc);
  if (!cached) {
    resetDynamicTextColor();
    return;
  }

  function processColor() {
    const currentSet = state.currentLightboxIsMotion ? motionProjects : state.activePhotos;
    if (!currentSet || currentSet[state.cur] !== p) return;

    if (colorCache.has(thumbSrc)) {
      applyColorPalette(colorCache.get(thumbSrc)!);
      return;
    }

    try {
      if (!sharedCanvas) {
        sharedCanvas = document.createElement('canvas');
        sharedCanvas.width = 10;
        sharedCanvas.height = 10;
        sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
      }
      if (!sharedCtx) return;
      sharedCtx.drawImage(cached!.img, 0, 0, 10, 10);
      const imgData = sharedCtx.getImageData(0, 0, 10, 10).data;

      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const a = imgData[i + 3];
        if (a > 200) {
          rSum += r;
          gSum += g;
          bSum += b;
          count++;
        }
      }

      if (count > 0) {
        const r = Math.round(rSum / count);
        const g = Math.round(gSum / count);
        const b = Math.round(bSum / count);

        const hsl = rgbToHsl(r, g, b);
        const s = Math.min(Math.max(hsl.s * 0.75, 18), 35);
        const l = Math.min(Math.max(hsl.l, 82), 85);

        const palette: DynamicColorPalette = {
          color: `hsl(${hsl.h}, ${s}%, ${l}%)`,
          muted: `hsla(${hsl.h}, ${s}%, ${l}%, 0.78)`,
          faint: `hsla(${hsl.h}, ${s}%, ${l}%, 0.40)`,
          ambient: `hsl(${hsl.h}, ${Math.min(Math.max(hsl.s, 28), 50)}%, 13.5%)`
        };
        colorCache.set(thumbSrc, palette);
        applyColorPalette(palette);
      } else {
        resetDynamicTextColor();
      }
    } catch (e) {
      console.warn("Dynamic text color extraction failed (possibly CORS):", e);
      resetDynamicTextColor();
    }
  }

  const scheduleProcess = () => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(processColor);
    } else {
      setTimeout(processColor, 30);
    }
  };

  if (cached.decoded) {
    scheduleProcess();
  } else if (cached.decodePromise) {
    cached.decodePromise.then(scheduleProcess);
  } else {
    cached.img.addEventListener('load', function onLoad() {
      cached.img.removeEventListener('load', onLoad);
      scheduleProcess();
    });
    cached.img.addEventListener('error', function onError() {
      cached.img.removeEventListener('error', onError);
      resetDynamicTextColor();
    });
  }
}
