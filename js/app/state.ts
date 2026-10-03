import { galleryStore } from './stores/gallery-store.js';
import { uiStore } from './stores/ui-store.js';
import type { Photo } from '../types.js';

export { galleryStore } from './stores/gallery-store.js';
export { uiStore } from './stores/ui-store.js';

export function updateActivePhotos(): Photo[] {
  return galleryStore.updateActivePhotos();
}

export const state = new Proxy({} as any, {
  get(_target, prop: string) {
    if (prop in galleryStore) {
      return (galleryStore as any)[prop];
    }
    if (prop in uiStore) {
      return (uiStore as any)[prop];
    }
    return undefined;
  },
  set(_target, prop: string, value: any) {
    if (prop in galleryStore) {
      (galleryStore as any)[prop] = value;
      return true;
    }
    (uiStore as any)[prop] = value;
    return true;
  }
});
