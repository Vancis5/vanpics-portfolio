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
  }
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

  const cached = cacheImage(thumbSrc);
  if (!cached) {
    resetDynamicTextColor();
    return;
  }

  function processColor() {
    // Verify that we are still displaying the same photo
    const currentSet = state.currentLightboxIsMotion ? motionProjects : state.activePhotos;
    if (!currentSet || currentSet[state.cur] !== p) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 10;
      canvas.height = 10;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(cached!.img, 0, 0, 10, 10);
      const imgData = ctx.getImageData(0, 0, 10, 10).data;

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

        // Mute saturation to a beautiful elegant range (18% - 35%)
        const s = Math.min(Math.max(hsl.s * 0.75, 18), 35);

        // Lightness kept high and highly readable (82% - 85%) to guarantee contrast
        const l = Math.min(Math.max(hsl.l, 82), 85);

        const lbEl = domRefs.lightbox;
        if (lbEl) {
          lbEl.style.setProperty('--dynamic-text-color', `hsl(${hsl.h}, ${s}%, ${l}%)`);
          lbEl.style.setProperty('--dynamic-text-muted', `hsla(${hsl.h}, ${s}%, ${l}%, 0.78)`);
          lbEl.style.setProperty('--dynamic-text-faint', `hsla(${hsl.h}, ${s}%, ${l}%, 0.40)`);
        }
      } else {
        resetDynamicTextColor();
      }
    } catch (e) {
      console.warn("Dynamic text color extraction failed (possibly CORS):", e);
      resetDynamicTextColor();
    }
  }

  if (cached.decoded) {
    processColor();
  } else if (cached.decodePromise) {
    cached.decodePromise.then(processColor);
  } else {
    cached.img.addEventListener('load', function onLoad() {
      cached.img.removeEventListener('load', onLoad);
      processColor();
    });
    cached.img.addEventListener('error', function onError() {
      cached.img.removeEventListener('error', onError);
      resetDynamicTextColor();
    });
  }
}
