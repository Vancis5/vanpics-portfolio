import type { Photo } from '../types.js';
import { galleryStore } from './stores/gallery-store.js';
import { uiStore } from './stores/ui-store.js';

export { galleryStore } from './stores/gallery-store.js';
export { uiStore } from './stores/ui-store.js';

export function updateActivePhotos(): Photo[] {
  return galleryStore.updateActivePhotos();
}

export interface AppState {
  pushNextState: boolean;
  isPopState: boolean;
  currentCategory: string;
  activePhotos: Photo[];
  carouselPhotos: Photo[];
  cur: number;
  isMobile: boolean;
  heroVisible: boolean;
  pageVisible: boolean;
  heroRafId: number | null;
  glowRafId: number | null;
  heroScrollY: number;
  currentLightboxIsMotion: boolean;
  isManuallyNavigating: boolean;
  isUserTouching: boolean;
  isTouchingFilmstrip: boolean;
  fsRaf: number | null;
  filmstripHideTimer: any;
  lbZoomLevel: number;
  lbZoomPanX: number;
  lbZoomPanY: number;
  lastInputType: 'pointer' | 'keyboard';
}

export const state: AppState = new Proxy({} as AppState, {
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
