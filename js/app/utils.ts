export function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

const RATIO_CACHE_KEY = 'van_ratios_v1';
let ratioCacheMemory: Record<string, string> = {};

try {
  if (typeof localStorage !== 'undefined') {
    let stored = localStorage.getItem(RATIO_CACHE_KEY);
    if (stored) ratioCacheMemory = JSON.parse(stored);
  }
} catch (e) {}

export function saveRatioToCache(src: string, width: number, height: number) {
  if (!src || !width || !height) return;
  try {
    let ratio = (width / height).toFixed(4);
    ratioCacheMemory[src] = ratio;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(RATIO_CACHE_KEY, JSON.stringify(ratioCacheMemory));
    }
  } catch (e) {}
}

export function isRatioCached(src: string): boolean {
  return !!(src && ratioCacheMemory[src]);
}

export function getPhotoAspectRatio(p: any, isMotion = false): number {
  if (!p) return isMotion ? 1.777 : 1;

  let pRatio = p.aspectRatio !== undefined && p.aspectRatio !== null ? Number(p.aspectRatio) : NaN;
  if (!isNaN(pRatio) && pRatio > 0 && pRatio !== 1) {
    return pRatio;
  }

  let basePath = isMotion ? (p.thumb || "") : (p.src || "");
  if (basePath && ratioCacheMemory[basePath]) {
    let cachedVal = Number(ratioCacheMemory[basePath]);
    if (cachedVal > 0) return cachedVal;
  }

  if (!isNaN(pRatio) && pRatio > 0) {
    return pRatio;
  }

  return isMotion ? 1.777 : 1;
}

