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

export function getPhotoThumbSrc(p: Photo): string {
  if (!p) return '';
  if (p.thumb) return p.thumb;
  if (p.src && p.src.includes('photos/') && !p.src.includes('photos/thumbs/')) {
    return p.src.replace('photos/', 'photos/thumbs/');
  }
  return p.src || '';
}

function extractPaletteFromImage(img: HTMLImageElement): DynamicColorPalette | null {
  try {
    if (!sharedCanvas) {
      sharedCanvas = document.createElement('canvas');
      sharedCanvas.width = 10;
      sharedCanvas.height = 10;
      sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (!sharedCtx) return null;
    sharedCtx.drawImage(img, 0, 0, 10, 10);
    const imgData = sharedCtx.getImageData(0, 0, 10, 10).data;

    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let i = 0; i < imgData.length; i += 4) {
      const a = imgData[i + 3];
      if (a > 200) {
        rSum += imgData[i];
        gSum += imgData[i + 1];
        bSum += imgData[i + 2];
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

      return {
        color: `hsl(${hsl.h}, ${s}%, ${l}%)`,
        muted: `hsla(${hsl.h}, ${s}%, ${l}%, 0.78)`,
        faint: `hsla(${hsl.h}, ${s}%, ${l}%, 0.40)`,
        ambient: `hsl(${hsl.h}, ${Math.min(Math.max(hsl.s, 28), 50)}%, 13.5%)`
      };
    }
    return null;
  } catch (e) {
    sharedCanvas = null;
    sharedCtx = null;
    console.warn("Dynamic text color extraction failed (possibly CORS):", e);
    return null;
  }
}

export function preloadPhotoColor(p: Photo): DynamicColorPalette | null {
  if (!p || state.currentLightboxIsMotion) return null;
  const thumbSrc = getPhotoThumbSrc(p);
  if (!thumbSrc) return null;

  const cachedPalette = colorCache.get(thumbSrc);
  if (cachedPalette) return cachedPalette;

  // 1. If thumbnail is already rendered and loaded in the DOM with anonymous crossOrigin, extract instantly
  let domImg: HTMLImageElement | null = null;
  try {
    domImg = document.querySelector(`img[src="${CSS.escape(thumbSrc)}"]`) as HTMLImageElement | null;
  } catch {
    domImg = null;
  }
  if (domImg && domImg.complete && domImg.naturalWidth > 0 && domImg.crossOrigin === 'anonymous') {
    const pal = extractPaletteFromImage(domImg);
    if (pal) {
      colorCache.set(thumbSrc, pal);
      return pal;
    }
  }

  // 2. Otherwise load via cacheImage
  const cached = cacheImage(thumbSrc, true);
  if (!cached) return null;

  if (cached.decoded || (cached.img.complete && cached.img.naturalWidth > 0)) {
    const pal = extractPaletteFromImage(cached.img);
    if (pal) {
      colorCache.set(thumbSrc, pal);
      return pal;
    }
  } else {
    const onDone = () => {
      if (!colorCache.has(thumbSrc) && cached.img.complete && cached.img.naturalWidth > 0) {
        const pal = extractPaletteFromImage(cached.img);
        if (pal) colorCache.set(thumbSrc, pal);
      }
    };
    if (cached.decodePromise) {
      cached.decodePromise.then(onDone).catch(() => {});
    } else {
      cached.img.addEventListener('load', onDone, { once: true });
    }
  }

  return null;
}

export function preloadAdjacentPhotoColors(currentIndex: number, photoList?: Photo[]) {
  if (state.currentLightboxIsMotion) return;
  const list = photoList || (state.activePhotos as Photo[]);
  if (!list || !list.length) return;
  const len = list.length;

  const offsets = [-1, 1, -2, 2, -3, 3];
  for (const offset of offsets) {
    const idx = (currentIndex + offset + len) % len;
    const p = list[idx];
    if (p) preloadPhotoColor(p);
  }
}

export function warmUpAllPhotoColors(photoList?: Photo[]) {
  if (state.currentLightboxIsMotion) return;
  const list = photoList || (state.activePhotos as Photo[]);
  if (!list || !list.length) return;

  let idx = 0;
  const batchSize = 6;
  function processBatch() {
    const end = Math.min(idx + batchSize, list.length);
    for (; idx < end; idx++) {
      preloadPhotoColor(list[idx]);
    }
    if (idx < list.length) {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(processBatch, { timeout: 1000 });
      } else {
        setTimeout(processBatch, 40);
      }
    }
  }
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(processBatch, { timeout: 1000 });
  } else {
    setTimeout(processBatch, 40);
  }
}

export function updateDynamicTextColor(p: Photo) {
  if (state.currentLightboxIsMotion) {
    resetDynamicTextColor();
    return;
  }

  const thumbSrc = getPhotoThumbSrc(p);
  if (!thumbSrc) {
    resetDynamicTextColor();
    return;
  }

  if (colorCache.has(thumbSrc)) {
    applyColorPalette(colorCache.get(thumbSrc)!);
    return;
  }

  // Attempt synchronous extraction
  const pal = preloadPhotoColor(p);
  if (pal) {
    applyColorPalette(pal);
    return;
  }

  const cached = cacheImage(thumbSrc, true);
  if (!cached) {
    resetDynamicTextColor();
    return;
  }

  const applyWhenReady = () => {
    const currentSet = state.currentLightboxIsMotion ? motionProjects : state.activePhotos;
    const curPhoto = currentSet && currentSet[state.cur] ? (currentSet[state.cur] as Photo) : null;

    if (colorCache.has(thumbSrc)) {
      if (curPhoto && getPhotoThumbSrc(curPhoto) === thumbSrc) {
        applyColorPalette(colorCache.get(thumbSrc)!);
      }
      return;
    }

    if (cached.img.complete && cached.img.naturalWidth > 0) {
      const palette = extractPaletteFromImage(cached.img);
      if (palette) {
        colorCache.set(thumbSrc, palette);
        if (curPhoto && getPhotoThumbSrc(curPhoto) === thumbSrc) {
          applyColorPalette(palette);
        }
      } else if (curPhoto && getPhotoThumbSrc(curPhoto) === thumbSrc) {
        resetDynamicTextColor();
      }
    }
  };

  if (cached.decodePromise) {
    cached.decodePromise.then(applyWhenReady).catch(() => {});
  } else {
    cached.img.addEventListener('load', applyWhenReady, { once: true });
    cached.img.addEventListener('error', () => {
      const currentSet = state.currentLightboxIsMotion ? motionProjects : state.activePhotos;
      const curPhoto = currentSet && currentSet[state.cur] ? (currentSet[state.cur] as Photo) : null;
      if (curPhoto && getPhotoThumbSrc(curPhoto) === thumbSrc) {
        resetDynamicTextColor();
      }
    }, { once: true });
  }
}
