export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: any;
  return function(this: any, ...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

export function escapeHtml(text: string | null | undefined): string {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function slugify(text: string | number): string {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

export const PLACEHOLDER_SVG = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><rect width="100" height="100" fill="#141313"/><path d="M35 38h6l3-3h12l3 3h6a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H35a3 3 0 0 1-3-3V41a3 3 0 0 1 3-3zm15 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-3a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" fill="#666" opacity="0.6"/></svg>`
);

export function setupImagePlaceholderFallback(img: HTMLImageElement, onFallback?: () => void) {
  let isPlaceholder = false;
  function handleLoadError() {
    if (isPlaceholder) return;
    isPlaceholder = true;
    // Preserve the card's aspect ratio before swapping to placeholder
    const card = img.closest('.photo-card, .carousel-item, .filmstrip-thumb') as HTMLElement;
    if (card) {
      const existingRatio = card.style.getPropertyValue('--photo-aspect-ratio') ||
                            card.style.getPropertyValue('--carousel-photo-ratio');
      if (existingRatio) {
        img.style.aspectRatio = existingRatio;
      }
    }
    img.src = PLACEHOLDER_SVG;
    img.classList.add('placeholder-fallback');
    if (onFallback) onFallback();
  }
  img.addEventListener('error', handleLoadError, { once: true });
  if (img.complete && img.naturalWidth === 0) {
    handleLoadError();
  }
  return handleLoadError;
}

export async function fadeInWhenReady(img: HTMLImageElement, ms = 600): Promise<void> {
  img.style.opacity = '0';
  try {
    if (img.decode) await img.decode();
  } catch {
    if (!(img.complete && img.naturalWidth > 0)) {
      await new Promise<void>(resolve => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    }
  }

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || typeof img.animate !== 'function') {
    img.style.opacity = '1';
    return;
  }

  // CSS transitions outrank animations in the cascade, so park the element's own
  // opacity transition while the fade runs, then hand it back untouched.
  const prevTransition = img.style.transition;
  img.style.transition = 'none';
  img.style.opacity = '1'; // resting state; beats base `opacity: 0` rules (e.g. .filmstrip-thumb img)
  const anim = img.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: ms,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  });
  const restore = () => {
    if (img.style.transition === 'none') img.style.transition = prevTransition;
  };
  anim.finished.then(restore, restore);
}

export function getRequiredElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Required element with id "${id}" was not found in the DOM.`);
  }
  return el as T;
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;
  
  const allowedTags = new Set(['A', 'BR']);
  const allowedAttrs: Record<string, Set<string>> = {
    'A': new Set(['href', 'target', 'rel'])
  };

  function sanitize(node: Node): Node {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toUpperCase();
      if (allowedTags.has(tagName)) {
        const cleanEl = doc.createElement(tagName);
        const attrs = allowedAttrs[tagName] || new Set();
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          const attrName = attr.name.toLowerCase();
          if (attrs.has(attrName)) {
            if (attrName === 'href') {
              const normalized = attr.value.replace(/[\u0000-\u001F\u007F\s]+/g, '').toLowerCase();
              if (
                normalized.startsWith('javascript:') ||
                normalized.startsWith('data:') ||
                normalized.startsWith('vbscript:')
              ) {
                continue;
              }
            }
            cleanEl.setAttribute(attr.name, attr.value);
          }
        }
        if (tagName === 'A') {
          cleanEl.setAttribute('rel', 'noopener noreferrer');
        }
        for (let i = 0; i < el.childNodes.length; i++) {
          cleanEl.appendChild(sanitize(el.childNodes[i]));
        }
        return cleanEl;
      }
    }
    return doc.createTextNode(node.textContent || '');
  }

  const cleanBody = doc.createElement('body');
  for (let i = 0; i < body.childNodes.length; i++) {
    cleanBody.appendChild(sanitize(body.childNodes[i]));
  }
  return cleanBody.innerHTML;
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

export function pruneRatioCache(validSrcs: string[]) {
  const validSet = new Set(validSrcs);
  let pruned = false;
  for (const key of Object.keys(ratioCacheMemory)) {
    if (!validSet.has(key)) {
      delete ratioCacheMemory[key];
      pruned = true;
    }
  }
  if (pruned) {
    try {
      localStorage.setItem(RATIO_CACHE_KEY, JSON.stringify(ratioCacheMemory));
    } catch (e) {}
  }
}

export function getPhotoAspectRatio(p: any, isMotion = false): number {
  if (!p) return isMotion ? 1.777 : 1;

  let pRatio = p.aspectRatio !== undefined && p.aspectRatio !== null ? Number(p.aspectRatio) : NaN;
  if (!isNaN(pRatio) && pRatio > 0) {
    return pRatio;
  }

  let basePath = isMotion ? (p.thumb || "") : (p.src || "");
  if (basePath && ratioCacheMemory[basePath]) {
    let cachedVal = Number(ratioCacheMemory[basePath]);
    if (cachedVal > 0) return cachedVal;
  }

  return isMotion ? 1.777 : 1;
}

