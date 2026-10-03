import { saveRatioToCache } from './utils.js';

interface CacheEntry {
  img: HTMLImageElement;
  decoded: boolean;
  decodePromise: Promise<any> | null;
}

const _full = new Map<string, CacheEntry>();
const _thumb = new Map<string, CacheEntry>();
const MAX = { full: 6, thumb: 24 };

export function cacheImage(src: string, eagerDecode: boolean = false) {
  if (!src) return null;
  const isThumb = src.includes('/thumbs/') || src.includes('-thumb.');
  const bucket = isThumb ? _thumb : _full;
  let cached = bucket.get(src);
  if (cached) {
    bucket.delete(src);
    bucket.set(src, cached);
    if (eagerDecode && !cached.decoded && cached.img && cached.img.decode) {
      cached.img.decode().then(() => {
        if (cached && cached.img.naturalWidth > 0) cached.decoded = true;
      }).catch(() => {});
    }
    return cached;
  }
  if (bucket.size >= (isThumb ? MAX.thumb : MAX.full)) {
    bucket.delete(bucket.keys().next().value!);
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const entry = {
    img,
    decoded: false,
    decodePromise: null as Promise<any> | null
  };
  entry.decodePromise = new Promise(resolve => {
    function markDecoded() {
      const cacheDimensions = () => {
        if (img.naturalWidth && img.naturalHeight) {
          saveRatioToCache(src, img.naturalWidth, img.naturalHeight);
        }
      };
      entry.decoded = (img.naturalWidth > 0);
      if (eagerDecode && img.decode) {
        img.decode().then(function () {
          entry.decoded = (img.naturalWidth > 0);
          cacheDimensions();
          resolve(entry);
        }).catch(function () {
          entry.decoded = (img.naturalWidth > 0);
          cacheDimensions();
          resolve(entry);
        });
      } else {
        cacheDimensions();
        resolve(entry);
      }
    }

    img.onload = markDecoded;
    img.onerror = function () { resolve(entry); };
    img.src = src;
    if (img.complete && img.naturalWidth > 0) markDecoded();
  });
  bucket.set(src, entry);
  return entry;
}

export function getLightboxBlurPath(src: string) {
  if (!src) return '';
  if (src.includes('photos/') && !src.includes('photos/thumbs/')) {
    return src.replace('photos/', 'photos/thumbs/');
  }
  return src;
}

export function getCachedImageDecode(src: string) {
  let cached = cacheImage(src);
  if (!cached) return Promise.resolve(null);
  if (cached.decoded) return Promise.resolve(cached);
  return cached.decodePromise || Promise.resolve(cached);
}

export function getImageCacheEntry(src: string) {
  return _thumb.get(src) || _full.get(src);
}
